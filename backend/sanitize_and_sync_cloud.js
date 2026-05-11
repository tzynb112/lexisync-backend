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

const BANNED_WORDS = new Set([
  'bra', 'panties', 'underwear', 'lingerie', 'condom', 'porn', 'masturbate',
  'orgasm', 'penis', 'vagina', 'nipple'
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function req(method, url, options = {}, retries = 8) {
  let lastErr = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url, {
        method,
        ...options,
      });
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

function isLikelyValidWord(raw) {
  if (!raw) return false;
  const word = String(raw).trim().toLowerCase();
  if (!word) return false;
  if (word.length < 2 || word.length > 24) return false;
  if (BANNED_WORDS.has(word)) return false;
  if (/\d/.test(word)) return false;
  if (!/^[a-z][a-z'-]*[a-z]$/.test(word)) return false;
  if (/^[a-z]-[a-z]{1,3}$/.test(word)) return false;
  if (/^[a-z]{1,2}-[a-z]{1,2}$/.test(word)) return false;
  if (/^[a-z]{1,4}$/.test(word) && !['able', 'acid', 'aged', 'also', 'area', 'army', 'away', 'baby', 'back', 'ball', 'bank', 'base', 'bath', 'bear', 'beat', 'been', 'best', 'bill', 'bird', 'blue', 'body', 'book', 'born', 'both', 'busy', 'call', 'calm', 'came', 'care', 'case', 'cash', 'city', 'club', 'coal', 'coat', 'cold', 'come', 'cook', 'cool', 'copy', 'cost', 'dark', 'data', 'date', 'days', 'dead', 'deal', 'dear', 'deep', 'desk', 'diet', 'done', 'door', 'down', 'draw', 'drop', 'drug', 'dual', 'duty', 'each', 'earn', 'ease', 'east', 'easy', 'edge', 'else', 'even', 'ever', 'exam', 'face', 'fact', 'fair', 'fall', 'farm', 'fast', 'fear', 'feed', 'feel', 'feet', 'fell', 'felt', 'file', 'fill', 'film', 'find', 'fine', 'fire', 'firm', 'fish', 'five', 'flat', 'flow', 'food', 'foot', 'ford', 'form', 'four', 'free', 'from', 'full', 'fund', 'gain', 'game', 'gave', 'girl', 'give', 'glad', 'goal', 'goes', 'gold', 'gone', 'good', 'gray', 'grew', 'grow', 'half', 'hall', 'hand', 'hang', 'hard', 'harm', 'hate', 'have', 'head', 'hear', 'heat', 'held', 'help', 'here', 'hero', 'high', 'hill', 'hire', 'hold', 'hole', 'holy', 'home', 'hope', 'host', 'hour', 'huge', 'hung', 'hurt', 'idea', 'into', 'iron', 'item', 'join', 'jump', 'just', 'kept', 'knew', 'know', 'lack', 'lady', 'laid', 'lake', 'land', 'last', 'late', 'lead', 'left', 'less', 'life', 'lift', 'like', 'line', 'link', 'list', 'live', 'load', 'loan', 'lock', 'logo', 'long', 'look', 'lord', 'lose', 'loss', 'lost', 'love', 'made', 'mail', 'main', 'make', 'male', 'many', 'mark', 'mass', 'meal', 'mean', 'meet', 'menu', 'mere', 'mike', 'mile', 'milk', 'mind', 'mine', 'miss', 'mode', 'more', 'most', 'move', 'much', 'must', 'name', 'near', 'neck', 'need', 'news', 'next', 'nice', 'nine', 'none', 'nose', 'note', 'okay', 'once', 'only', 'onto', 'open', 'oral', 'over', 'pace', 'pack', 'page', 'paid', 'pain', 'pair', 'pale', 'park', 'part', 'pass', 'past', 'path', 'peak', 'pick', 'pink', 'pipe', 'plan', 'play', 'plot', 'plus', 'poll', 'pool', 'poor', 'port', 'post', 'pull', 'pure', 'push', 'race', 'rail', 'rain', 'rank', 'rare', 'rate', 'read', 'real', 'rear', 'rely', 'rent', 'rest', 'rice', 'rich', 'ride', 'ring', 'rise', 'risk', 'road', 'rock', 'role', 'roll', 'roof', 'room', 'root', 'rose', 'rule', 'rush', 'safe', 'said', 'sale', 'same', 'sand', 'save', 'seat', 'seed', 'seek', 'seem', 'seen', 'self', 'sell', 'send', 'sent', 'ship', 'shop', 'shot', 'show', 'shut', 'sick', 'side', 'sign', 'site', 'size', 'skin', 'slow', 'snow', 'soft', 'soil', 'sold', 'sole', 'some', 'song', 'soon', 'sort', 'soul', 'spot', 'star', 'stay', 'step', 'stop', 'such', 'suit', 'sure', 'take', 'tale', 'talk', 'tall', 'tank', 'task', 'team', 'tech', 'tell', 'tend', 'term', 'test', 'text', 'than', 'that', 'them', 'then', 'they', 'thin', 'this', 'thus', 'till', 'time', 'tiny', 'told', 'toll', 'tone', 'took', 'tool', 'tour', 'town', 'tree', 'trip', 'true', 'turn', 'type', 'unit', 'upon', 'used', 'user', 'vary', 'vast', 'very', 'vice', 'view', 'vote', 'wage', 'wait', 'wake', 'walk', 'wall', 'want', 'ward', 'warm', 'wash', 'wave', 'ways', 'weak', 'wear', 'week', 'well', 'went', 'were', 'west', 'what', 'when', 'whom', 'wide', 'wife', 'wild', 'will', 'wind', 'wine', 'wing', 'wire', 'wise', 'with', 'word', 'wore', 'work', 'yard', 'yeah', 'year', 'your', 'zero'].includes(word)) return false;
  if (/^([a-z])\1{3,}$/.test(word)) return false;
  return true;
}

function qualityScore(word, definition = '') {
  let score = 0;
  const w = word.toLowerCase();
  if (/^[a-z]+$/.test(w)) score += 6;
  if (w.length >= 4 && w.length <= 10) score += 5;
  if (!w.includes('-')) score += 3;
  if (!w.includes("'")) score += 1;
  if (/tion$|ment$|able$|ing$|ness$|ship$|less$|ful$|ize$/.test(w)) score += 1;
  if (definition && definition.length >= 2) score += 1;
  return score;
}

function chooseTopWords(rows, target) {
  const seen = new Set();
  const valid = [];
  for (const row of rows) {
    const word = String(row.word || '').trim().toLowerCase();
    if (!isLikelyValidWord(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    valid.push({
      word,
      phonetic: row.phonetic || '',
      definition: row.definition || word,
      part_of_speech: row.part_of_speech || '',
      score: qualityScore(word, row.definition || ''),
    });
  }
  valid.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  return valid.slice(0, target);
}

async function login() {
  const res = await req('POST', `${REMOTE_BASE}/api/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`login failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function clearRemote(headers) {
  const res = await req('POST', `${REMOTE_BASE}/api/words/admin/clear-all`, { headers });
  if (!res.ok) {
    throw new Error(`clear failed: ${res.status} ${await res.text()}`);
  }
}

async function getRemoteCategories(headers) {
  const res = await req('GET', `${REMOTE_BASE}/api/words/categories`, { headers });
  if (!res.ok) {
    throw new Error(`get categories failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return new Map(data.map((c) => [c.name, c.id]));
}

function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const head = 'word,phonetic,definition,part_of_speech';
  const body = rows.map((r) => [esc(r.word), esc(r.phonetic), esc(r.definition), esc(r.part_of_speech)].join(','));
  return [head, ...body].join('\n');
}

async function importWords(headers, rows, label) {
  const form = new FormData();
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv' });
  form.append('file', blob, `${label}.csv`);
  const res = await req('POST', `${REMOTE_BASE}/api/words/import/csv`, { headers, body: form });
  if (!res.ok) {
    throw new Error(`import failed ${label}: ${res.status} ${await res.text()}`);
  }
}

async function getAllRemoteWords(headers) {
  const map = new Map();
  let page = 1;
  const pageSize = 100;
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
    for (const w of words) {
      map.set(String(w.word).toLowerCase(), w.id);
    }
    if (words.length < pageSize) break;
    page += 1;
  }
  return map;
}

async function batchLink(headers, categoryId, wordIds) {
  const chunkSize = 100;
  let linked = 0;
  for (let i = 0; i < wordIds.length; i += chunkSize) {
    const chunk = wordIds.slice(i, i + chunkSize);
    const res = await req('POST', `${REMOTE_BASE}/api/words/categories/batch-link`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_ids: chunk, category_id: categoryId }),
    });
    if (!res.ok) {
      throw new Error(`batch link failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    linked += data.linked || 0;
  }
  return linked;
}

function loadLocalCategoryRows(db, categoryName) {
  const stmt = db.prepare(`
    SELECT w.word, COALESCE(w.phonetic, '') AS phonetic, COALESCE(w.definition, '') AS definition, COALESCE(w.part_of_speech, '') AS part_of_speech
    FROM words w
    JOIN word_category_links l ON l.word_id = w.id
    JOIN word_categories c ON c.id = l.category_id
    WHERE c.name = ?
  `);
  return stmt.all(categoryName);
}

async function main() {
  const db = new Database('D:/trae/LexiSync/backend/lexisync.db', { readonly: true });
  const selectedByCategory = new Map();
  const unionWords = new Map();

  for (const cat of CATEGORY_ORDER) {
    const rows = loadLocalCategoryRows(db, cat);
    const target = TARGET_COUNTS[cat];
    const picked = chooseTopWords(rows, target);
    selectedByCategory.set(cat, picked.map((x) => x.word));
    for (const w of picked) {
      if (!unionWords.has(w.word)) unionWords.set(w.word, w);
    }
    console.log(`${cat}: source=${rows.length}, selected=${picked.length}`);
  }
  db.close();

  const allRows = Array.from(unionWords.values()).sort((a, b) => a.word.localeCompare(b.word));
  console.log(`unique selected words: ${allRows.length}`);

  const token = await login();
  const headers = { Authorization: `Bearer ${token}` };

  await clearRemote(headers);
  console.log('remote cleared');

  const chunkSize = 1800;
  for (let i = 0; i < allRows.length; i += chunkSize) {
    const chunk = allRows.slice(i, i + chunkSize);
    await importWords(headers, chunk, `sanitized_${Math.floor(i / chunkSize) + 1}`);
    console.log(`imported chunk ${Math.floor(i / chunkSize) + 1}, size=${chunk.length}`);
  }

  const remoteCategories = await getRemoteCategories(headers);
  const remoteWordMap = await getAllRemoteWords(headers);
  console.log(`remote indexed words: ${remoteWordMap.size}`);

  for (const cat of CATEGORY_ORDER) {
    const categoryId = remoteCategories.get(cat);
    if (!categoryId) {
      console.log(`skip missing category: ${cat}`);
      continue;
    }
    const words = selectedByCategory.get(cat) || [];
    const ids = words.map((w) => remoteWordMap.get(w)).filter(Boolean);
    const linked = await batchLink(headers, categoryId, ids);
    console.log(`${cat}: target=${TARGET_COUNTS[cat]} matched_ids=${ids.length} linked=${linked}`);
  }

  const statsRes = await req('GET', `${REMOTE_BASE}/api/words/categories`, { headers });
  const stats = await statsRes.json();
  console.log('final cloud stats:');
  for (const c of stats) {
    console.log(`${c.name}: ${c.word_count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
