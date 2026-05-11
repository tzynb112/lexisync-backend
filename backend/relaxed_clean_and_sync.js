const Database = require('better-sqlite3');

const REMOTE_BASE = 'https://lexisync-backend-production.up.railway.app';
const USERNAME = 'admin';
const PASSWORD = 'admin123456';

const TARGET_COUNTS = {
  '小学词汇': 700,
  '中考词汇': 2000,
  '高考词汇': 3500,
  '四级词汇': 4500,
  '六级词汇': 5500,
  '考研词汇': 6000,
  '专四词汇': 8000,
  '专八词汇': 13000,
  'TOEFL词汇': 8000,
  'GRE词汇': 12000,
  'IELTS词汇': 7000,
};

const CATEGORY_ORDER = Object.keys(TARGET_COUNTS);

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

function isBadNoiseWord(word) {
  const w = String(word || '').trim().toLowerCase();
  if (!w) return true;
  if (/\d/.test(w)) return true;
  if (!/^[a-z][a-z'-]*[a-z]$/.test(w)) return true;
  // Kill obvious abbreviation noise: a-c / b-v / c-a / d-pa ...
  if (/^[a-z]-[a-z]{1,2}$/.test(w)) return true;
  if (/^[a-z]{1,2}-[a-z]{1,2}$/.test(w)) return true;
  // Repeated gibberish like aaaa / bbbb.
  if (/^([a-z])\1{3,}$/.test(w)) return true;
  // Extremely long technical terms are low-value for this learning product.
  if (w.length > 18) return true;
  return false;
}

function isBadDefinitionNoise(definition) {
  const d = String(definition || '').toLowerCase();
  if (!d) return true;
  if (d.includes('abbr.')) return true;
  if (d.includes('缩写') || d.includes('缩略') || d.includes('首字母')) return true;
  if (d.includes('american association') || d.includes('american academy')) return true;
  return false;
}

function shouldFilterByCategory(entry, categoryName) {
  const w = String(entry.word || '').toLowerCase();
  const strictCats = new Set([
    '小学词汇', '中考词汇', '高考词汇', '四级词汇', '六级词汇', '考研词汇', '专四词汇'
  ]);
  if (!strictCats.has(categoryName)) return false;
  if (/^a{3,}/.test(w)) return true;
  if (isBadDefinitionNoise(entry.definition)) return true;
  return false;
}

function qualityScore(word, definition = '') {
  const w = String(word || '').toLowerCase();
  let s = 0;
  if (/^[a-z]+$/.test(w)) s += 8;
  if (w.length >= 4 && w.length <= 10) s += 4;
  if (w.length >= 3) s += 2;
  if (w.includes('-')) s -= 2;
  if (w.includes("'")) s -= 1;
  if (definition && String(definition).trim().length > 1) s += 1;
  return s;
}

function uniqueByWord(rows) {
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    const w = String(r.word || '').trim().toLowerCase();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    out.push({
      word: w,
      phonetic: r.phonetic || '',
      definition: r.definition || w,
      part_of_speech: r.part_of_speech || '',
      score: qualityScore(w, r.definition || ''),
    });
  }
  return out;
}

function pickCategoryRows(categoryRows, globalPool, target, categoryName) {
  const cleanLocal = uniqueByWord(categoryRows).filter((x) => {
    if (isBadNoiseWord(x.word)) return false;
    if (shouldFilterByCategory(x, categoryName)) return false;
    return true;
  });
  cleanLocal.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  const selected = [];
  const seen = new Set();

  for (const w of cleanLocal) {
    if (selected.length >= target) break;
    selected.push(w);
    seen.add(w.word);
  }

  if (selected.length < target) {
    for (const w of globalPool) {
      if (selected.length >= target) break;
      if (seen.has(w.word)) continue;
      if (shouldFilterByCategory(w, categoryName)) continue;
      selected.push(w);
      seen.add(w.word);
    }
  }

  return selected.slice(0, target);
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
  if (!res.ok) throw new Error(`categories failed: ${res.status} ${await res.text()}`);
  const cats = await res.json();
  return new Map(cats.map((c) => [c.name, c.id]));
}

async function getAllRemoteWords(headers) {
  const out = new Map();
  let page = 1;
  const pageSize = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const u = new URL(`${REMOTE_BASE}/api/words`);
    u.searchParams.set('page', String(page));
    u.searchParams.set('page_size', String(pageSize));
    const res = await req('GET', u.toString(), { headers });
    if (!res.ok) throw new Error(`list words failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    const words = j.words || [];
    if (words.length === 0) break;
    for (const w of words) out.set(String(w.word).toLowerCase(), w.id);
    if (words.length < pageSize) break;
    page += 1;
  }
  return out;
}

async function batchLink(headers, categoryId, ids) {
  let linked = 0;
  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const res = await req('POST', `${REMOTE_BASE}/api/words/categories/batch-link`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_ids: chunk, category_id: categoryId }),
    });
    if (!res.ok) throw new Error(`link failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    linked += j.linked || 0;
  }
  return linked;
}

function loadCategoryRows(db, categoryName) {
  const stmt = db.prepare(`
    SELECT w.word, COALESCE(w.phonetic,'') AS phonetic, COALESCE(w.definition,'') AS definition, COALESCE(w.part_of_speech,'') AS part_of_speech
    FROM words w
    JOIN word_category_links l ON l.word_id = w.id
    JOIN word_categories c ON c.id = l.category_id
    WHERE c.name = ?
  `);
  return stmt.all(categoryName);
}

async function main() {
  const db = new Database('D:/trae/LexiSync/backend/lexisync.db', { readonly: true });
  const allRowsRaw = db.prepare(`
    SELECT DISTINCT lower(word) AS word, COALESCE(phonetic,'') AS phonetic, COALESCE(definition,'') AS definition, COALESCE(part_of_speech,'') AS part_of_speech
    FROM words
    WHERE word IS NOT NULL AND word <> '' AND definition IS NOT NULL AND definition <> ''
  `).all();

  const globalPool = uniqueByWord(allRowsRaw)
    .filter((x) => !isBadNoiseWord(x.word))
    .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));

  const selectedByCategory = new Map();
  const union = new Map();

  for (const cat of CATEGORY_ORDER) {
    const rows = loadCategoryRows(db, cat);
    const selected = pickCategoryRows(rows, globalPool, TARGET_COUNTS[cat], cat);
    selectedByCategory.set(cat, selected.map((x) => x.word));
    for (const w of selected) {
      if (!union.has(w.word)) union.set(w.word, w);
    }
    const rawNoise = rows.filter((r) => isBadNoiseWord(r.word)).length;
    console.log(`${cat}: source=${rows.length}, source_noise=${rawNoise}, selected=${selected.length}`);
  }
  db.close();

  const importRows = Array.from(union.values()).sort((a, b) => a.word.localeCompare(b.word));
  console.log(`unique words to import: ${importRows.length}`);

  const token = await login();
  const headers = { Authorization: `Bearer ${token}` };
  await clearRemote(headers);
  console.log('remote cleared');

  const chunkSize = 1800;
  for (let i = 0; i < importRows.length; i += chunkSize) {
    const chunk = importRows.slice(i, i + chunkSize);
    await importWords(headers, chunk, `relaxed_${Math.floor(i / chunkSize) + 1}`);
    console.log(`import chunk ${Math.floor(i / chunkSize) + 1}: ${chunk.length}`);
  }

  const remoteCats = await getRemoteCategories(headers);
  const remoteWordMap = await getAllRemoteWords(headers);
  console.log(`remote indexed: ${remoteWordMap.size}`);

  for (const cat of CATEGORY_ORDER) {
    const cid = remoteCats.get(cat);
    if (!cid) continue;
    const words = selectedByCategory.get(cat) || [];
    const ids = words.map((w) => remoteWordMap.get(w)).filter(Boolean);
    const linked = await batchLink(headers, cid, ids);
    console.log(`${cat}: target=${TARGET_COUNTS[cat]}, linked=${linked}`);
  }

  const statRes = await req('GET', `${REMOTE_BASE}/api/words/categories`, { headers });
  const stats = await statRes.json();
  console.log('final cloud stats:');
  for (const s of stats) {
    console.log(`${s.name}: ${s.word_count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
