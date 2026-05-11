const Database = require('better-sqlite3');

const REMOTE_BASE = 'https://lexisync-backend-production.up.railway.app';
const USERNAME = 'admin';
const PASSWORD = 'admin123456';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function req(method, url, options = {}, retries = 8) {
  let lastErr = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url, { method, ...options });
      if ([502, 503, 504].includes(res.status)) {
        await sleep((i + 1) * 1500);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      await sleep((i + 1) * 1500);
    }
  }
  throw lastErr || new Error(`request failed: ${method} ${url}`);
}

function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = 'word,phonetic,definition,part_of_speech';
  const body = rows.map((r) => [esc(r.word), esc(r.phonetic), esc(r.definition), esc(r.part_of_speech)].join(','));
  return [head, ...body].join('\n');
}

async function login() {
  const res = await req('POST', `${REMOTE_BASE}/api/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.access_token;
}

async function clearRemote(headers) {
  const res = await req('POST', `${REMOTE_BASE}/api/words/admin/clear-all`, { headers });
  if (!res.ok) throw new Error(`clear failed: ${res.status} ${await res.text()}`);
}

async function importWords(headers, rows, label) {
  const form = new FormData();
  form.append('file', new Blob([toCsv(rows)], { type: 'text/csv' }), `${label}.csv`);
  const res = await req('POST', `${REMOTE_BASE}/api/words/import/csv`, { headers, body: form });
  if (!res.ok) throw new Error(`import ${label} failed: ${res.status} ${await res.text()}`);
}

async function getRemoteCategories(headers) {
  const res = await req('GET', `${REMOTE_BASE}/api/words/categories`, { headers });
  if (!res.ok) throw new Error(`get categories failed: ${res.status} ${await res.text()}`);
  const cats = await res.json();
  return new Map(cats.map((c) => [c.name, c.id]));
}

async function getAllRemoteWords(headers) {
  const out = new Map();
  const pageSize = 100;
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const u = new URL(`${REMOTE_BASE}/api/words`);
    u.searchParams.set('page', String(page));
    u.searchParams.set('page_size', String(pageSize));
    const res = await req('GET', u.toString(), { headers });
    if (!res.ok) throw new Error(`list words failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const words = data.words || [];
    if (words.length === 0) break;
    for (const w of words) out.set(String(w.word).toLowerCase(), w.id);
    if (words.length < pageSize) break;
    page += 1;
  }
  return out;
}

async function batchLink(headers, categoryId, ids) {
  const chunkSize = 100;
  let linked = 0;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const res = await req('POST', `${REMOTE_BASE}/api/words/categories/batch-link`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_ids: chunk, category_id: categoryId }),
    });
    if (!res.ok) throw new Error(`link failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    linked += data.linked || 0;
  }
  return linked;
}

async function main() {
  const db = new Database('D:/trae/LexiSync/backend/lexisync.db', { readonly: true });
  const rows = db.prepare(`
    SELECT DISTINCT lower(w.word) AS word, COALESCE(w.phonetic, '') AS phonetic, COALESCE(w.definition, '') AS definition, COALESCE(w.part_of_speech, '') AS part_of_speech
    FROM words w
    WHERE w.word IS NOT NULL AND w.word <> '' AND w.definition IS NOT NULL AND w.definition <> ''
    ORDER BY lower(w.word)
  `).all();

  const links = db.prepare(`
    SELECT c.name AS category_name, lower(w.word) AS word
    FROM word_category_links l
    JOIN words w ON w.id = l.word_id
    JOIN word_categories c ON c.id = l.category_id
    ORDER BY c.name
  `).all();
  db.close();

  const catMap = new Map();
  for (const r of links) {
    if (!catMap.has(r.category_name)) catMap.set(r.category_name, []);
    catMap.get(r.category_name).push(r.word);
  }

  const token = await login();
  const headers = { Authorization: `Bearer ${token}` };
  await clearRemote(headers);
  console.log('remote cleared');

  const chunkSize = 1800;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await importWords(headers, chunk, `restore_${Math.floor(i / chunkSize) + 1}`);
    console.log(`import chunk ${Math.floor(i / chunkSize) + 1}: ${chunk.length}`);
  }

  const remoteCats = await getRemoteCategories(headers);
  const remoteWordMap = await getAllRemoteWords(headers);
  console.log(`remote words: ${remoteWordMap.size}`);

  for (const [catName, words] of catMap.entries()) {
    const catId = remoteCats.get(catName);
    if (!catId) continue;
    const ids = words.map((w) => remoteWordMap.get(w)).filter(Boolean);
    const linked = await batchLink(headers, catId, ids);
    console.log(`${catName}: local=${words.length}, linked=${linked}`);
  }

  const finalRes = await req('GET', `${REMOTE_BASE}/api/words/categories`, { headers });
  const finalCats = await finalRes.json();
  console.log('final cloud category counts:');
  for (const c of finalCats) {
    console.log(`${c.name}: ${c.word_count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
