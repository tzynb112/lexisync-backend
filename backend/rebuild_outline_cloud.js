const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const REMOTE_BASE = 'https://lexisync-backend-production.up.railway.app';
const USERNAME = 'admin';
const PASSWORD = 'admin123456';

const LOCAL_DB = 'D:/trae/LexiSync/backend/lexisync.db';
const LOCAL_KAOYAN_RAW = 'D:/trae/LexiSync/backend/kaoyan_5500_raw.txt';

const SRC_ENGLISH_VOCAB_SIMPLE = 'D:/trae/LexiSync/tmp_english_vocab/json_original/json-simple';
const SRC_NETEM_JSON = 'D:/trae/LexiSync/tmp_netem_vocab/netem_full_list.json';
const SRC_WORDLISTS_DIR = 'D:/trae/LexiSync/tmp_english_wordlists';

const TARGET_COUNTS = {
  小学词汇: 700,
  中考词汇: 2000,
  高考词汇: 3500,
  四级词汇: 4500,
  六级词汇: 5500,
  考研词汇: 6000,
  专四词汇: 8000,
  专八词汇: 13000,
  TOEFL词汇: 8000,
  GRE词汇: 12000,
  IELTS词汇: 7000,
};

const CATEGORY_ORDER = Object.keys(TARGET_COUNTS);
const BAD_SENTINELS = ['aabomycin', 'aacs', 'aadc', 'aads', 'a-ba', 'a-c', 'aaas'];
const MAX_RETRIES = 8;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function req(method, url, options = {}, retries = MAX_RETRIES) {
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

function normalizeWord(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isWordShapeOk(word) {
  if (!word) return false;
  if (word.length < 2 || word.length > 22) return false;
  if (/\d/.test(word)) return false;
  if (!/^[a-z][a-z'-]*[a-z]$/.test(word)) return false;
  if (/^[a-z]-[a-z]{1,2}$/.test(word)) return false;
  if (/^[a-z]{1,2}-[a-z]{1,2}$/.test(word)) return false;
  if (/^([a-z])\1{3,}$/.test(word)) return false;
  return true;
}

function maybeAbbrNoise(word, definition) {
  const w = normalizeWord(word);
  const d = String(definition || '').toLowerCase();
  if (!d) return false;
  if (!/abbr\.|acronym|initialism|缩写|首字母/.test(d)) return false;
  return w.length <= 6;
}

function fileContains(fileName, keyword) {
  return normalizeWord(fileName).includes(normalizeWord(keyword));
}

function findWordlistFile(keyword) {
  const files = fs.readdirSync(SRC_WORDLISTS_DIR);
  const found = files.find((f) => fileContains(f, keyword));
  if (!found) throw new Error(`missing source file: ${keyword}`);
  return path.join(SRC_WORDLISTS_DIR, found);
}

function pushUniqueOrdered(target, seen, rawWord) {
  const word = normalizeWord(rawWord);
  if (!isWordShapeOk(word)) return;
  if (seen.has(word)) return;
  seen.add(word);
  target.push(word);
}

function parseFirstWordPerLine(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const out = [];
  const seen = new Set();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.toLowerCase().match(/^[a-z]+(?:[-'][a-z]+)*/);
    if (!m) continue;
    pushUniqueOrdered(out, seen, m[0]);
  }
  return out;
}

function parseKaoyanRaw(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const out = [];
  const seen = new Set();
  for (const rawLine of text.split(/\r?\n/)) {
    const token = normalizeWord((rawLine || '').split(/[,\s\t]/)[0]);
    pushUniqueOrdered(out, seen, token);
  }
  return out;
}

function parseNetem5530(filePath) {
  const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rootKey = Object.keys(obj)[0];
  const rows = obj[rootKey] || [];
  const wordKey = Object.keys(rows[0] || {}).find((k) => {
    const v = normalizeWord(rows[0][k]);
    return /^[a-z][a-z'-]*$/.test(v);
  });
  if (!wordKey) return [];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    pushUniqueOrdered(out, seen, row[wordKey]);
  }
  return out;
}

function parseEnglishVocabByPatterns(patterns) {
  const files = fs.readdirSync(SRC_ENGLISH_VOCAB_SIMPLE).filter((f) => patterns.some((re) => re.test(f)));
  files.sort();
  const out = [];
  const seen = new Set();
  for (const file of files) {
    const arr = JSON.parse(fs.readFileSync(path.join(SRC_ENGLISH_VOCAB_SIMPLE, file), 'utf8'));
    for (const row of arr) {
      const word = row.word || row.name || row.headWord;
      pushUniqueOrdered(out, seen, word);
    }
  }
  return out;
}

function mergeLists(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    for (const word of list) {
      pushUniqueOrdered(out, seen, word);
    }
  }
  return out;
}

function qualityScore(word, definition = '') {
  const w = normalizeWord(word);
  let s = 0;
  if (/^[a-z]+$/.test(w)) s += 8;
  if (w.length >= 4 && w.length <= 11) s += 4;
  if (w.length >= 3) s += 2;
  if (!w.includes('-')) s += 1;
  if (definition && definition.trim().length > 1) s += 1;
  return s;
}

function loadLocalWordMeta(db) {
  const rows = db.prepare(`
    SELECT lower(word) AS word, COALESCE(phonetic, '') AS phonetic, COALESCE(definition, '') AS definition, COALESCE(part_of_speech, '') AS part_of_speech
    FROM words
    WHERE word IS NOT NULL AND word <> ''
  `).all();

  const map = new Map();
  for (const row of rows) {
    const word = normalizeWord(row.word);
    if (!isWordShapeOk(word)) continue;
    const current = map.get(word);
    const candidate = {
      word,
      phonetic: row.phonetic || '',
      definition: row.definition || word,
      part_of_speech: row.part_of_speech || '',
    };
    if (!current) {
      map.set(word, candidate);
      continue;
    }
    const currentScore = qualityScore(current.word, current.definition) - (maybeAbbrNoise(current.word, current.definition) ? 6 : 0);
    const nextScore = qualityScore(candidate.word, candidate.definition) - (maybeAbbrNoise(candidate.word, candidate.definition) ? 6 : 0);
    if (nextScore > currentScore) map.set(word, candidate);
  }
  return map;
}

function pickCategoryWords(categoryName, target, candidates, fallbackPool, wordMeta) {
  const selected = [];
  const seen = new Set();

  const tryPush = (word) => {
    const w = normalizeWord(word);
    if (!isWordShapeOk(w)) return;
    if (seen.has(w)) return;
    const meta = wordMeta.get(w);
    if (meta && maybeAbbrNoise(w, meta.definition)) return;
    seen.add(w);
    selected.push(w);
  };

  for (const word of candidates) {
    if (selected.length >= target) break;
    tryPush(word);
  }
  for (const word of fallbackPool) {
    if (selected.length >= target) break;
    tryPush(word);
  }

  if (selected.length < target) {
    throw new Error(`${categoryName} insufficient words: ${selected.length}/${target}`);
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
    for (const w of words) out.set(normalizeWord(w.word), w.id);
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

async function verifySentinels(headers, categoryIdMap) {
  for (const [categoryName, categoryId] of categoryIdMap.entries()) {
    for (const badWord of BAD_SENTINELS) {
      const u = new URL(`${REMOTE_BASE}/api/words`);
      u.searchParams.set('page', '1');
      u.searchParams.set('page_size', '5');
      u.searchParams.set('q', badWord);
      u.searchParams.set('category_id', categoryId);
      const res = await req('GET', u.toString(), { headers });
      if (!res.ok) throw new Error(`verify failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      const hit = (data.words || []).find((w) => normalizeWord(w.word) === badWord);
      if (hit) {
        throw new Error(`bad word still exists: ${categoryName} -> ${badWord}`);
      }
    }
  }
}

function buildSourcePools() {
  const pools = {};

  pools.en_primary = parseEnglishVocabByPatterns([/^PEPXiaoXue\d+_\d+\.json$/]);
  pools.en_zhongkao = parseEnglishVocabByPatterns([/^ChuZhong_\d+\.json$/, /^ChuZhongluan_\d+\.json$/, /^WaiYanSheChuZhong_\d+\.json$/, /^PEPChuZhong\d+_\d+\.json$/]);
  pools.en_gaokao = parseEnglishVocabByPatterns([/^GaoZhong_\d+\.json$/, /^GaoZhongluan_\d+\.json$/, /^PEPGaoZhong_\d+\.json$/, /^BeiShiGaoZhong_\d+\.json$/]);
  pools.en_cet4 = parseEnglishVocabByPatterns([/^CET4_\d+\.json$/, /^CET4luan_\d+\.json$/]);
  pools.en_cet6 = parseEnglishVocabByPatterns([/^CET6_\d+\.json$/, /^CET6luan_\d+\.json$/]);
  pools.en_kaoyan = parseEnglishVocabByPatterns([/^KaoYan_\d+\.json$/, /^KaoYanluan_\d+\.json$/]);
  pools.en_tem4 = parseEnglishVocabByPatterns([/^Level4_\d+\.json$/, /^Level4luan_\d+\.json$/]);
  pools.en_tem8 = parseEnglishVocabByPatterns([/^Level8_\d+\.json$/, /^Level8luan_\d+\.json$/]);
  pools.en_toefl = parseEnglishVocabByPatterns([/^TOEFL_\d+\.json$/]);
  pools.en_gre = parseEnglishVocabByPatterns([/^GRE_\d+\.json$/]);
  pools.en_ielts = parseEnglishVocabByPatterns([/^IELTS_\d+\.json$/, /^IELTSluan_\d+\.json$/]);

  pools.netem_5530 = parseNetem5530(SRC_NETEM_JSON);
  pools.local_kaoyan_raw = parseKaoyanRaw(LOCAL_KAOYAN_RAW);

  pools.txt_primary = parseFirstWordPerLine(findWordlistFile('小学英语大纲词汇'));
  pools.txt_zhongkao = parseFirstWordPerLine(findWordlistFile('中考英语词汇表'));
  pools.txt_highschool = parseFirstWordPerLine(path.join(SRC_WORDLISTS_DIR, 'Highschool_edited.txt'));
  pools.txt_cet4 = parseFirstWordPerLine(path.join(SRC_WORDLISTS_DIR, 'CET4_edited.txt'));
  pools.txt_cet6 = parseFirstWordPerLine(path.join(SRC_WORDLISTS_DIR, 'CET6_edited.txt'));
  pools.txt_cet46 = parseFirstWordPerLine(path.join(SRC_WORDLISTS_DIR, 'CET_4+6_edited.txt'));
  pools.txt_npee = parseFirstWordPerLine(path.join(SRC_WORDLISTS_DIR, 'NPEE_Wordlist.txt'));
  pools.txt_tem48 = parseFirstWordPerLine(findWordlistFile('英语专业四八级词汇表'));
  pools.txt_tem8_star = parseFirstWordPerLine(findWordlistFile('英语专业星标八级词汇'));
  pools.txt_toefl = parseFirstWordPerLine(path.join(SRC_WORDLISTS_DIR, 'TOEFL.txt'));
  pools.txt_gre = parseFirstWordPerLine(path.join(SRC_WORDLISTS_DIR, 'GRE_8000_Words.txt'));
  pools.txt_oald = parseFirstWordPerLine(path.join(SRC_WORDLISTS_DIR, 'OALD8_abridged_edited.txt'));
  pools.txt_coca = parseFirstWordPerLine(path.join(SRC_WORDLISTS_DIR, 'COCA_20000.txt'));

  return pools;
}

function buildCategoryCandidates(pools) {
  return {
    小学词汇: mergeLists(
      pools.txt_primary,
      pools.en_primary,
      pools.txt_zhongkao,
      pools.en_zhongkao,
      pools.txt_highschool,
    ),
    中考词汇: mergeLists(
      pools.txt_zhongkao,
      pools.en_zhongkao,
      pools.txt_highschool,
      pools.en_gaokao,
      pools.txt_cet4,
    ),
    高考词汇: mergeLists(
      pools.txt_highschool,
      pools.en_gaokao,
      pools.txt_cet4,
      pools.en_cet4,
      pools.txt_npee,
    ),
    四级词汇: mergeLists(
      pools.txt_cet4,
      pools.en_cet4,
      pools.txt_cet46,
      pools.en_cet6,
      pools.txt_highschool,
    ),
    六级词汇: mergeLists(
      pools.txt_cet6,
      pools.en_cet6,
      pools.txt_cet46,
      pools.txt_cet4,
      pools.en_cet4,
      pools.txt_npee,
      pools.en_kaoyan,
    ),
    考研词汇: mergeLists(
      pools.netem_5530,
      pools.local_kaoyan_raw,
      pools.txt_npee,
      pools.en_kaoyan,
      pools.txt_cet46,
      pools.en_cet6,
      pools.txt_toefl,
    ),
    专四词汇: mergeLists(
      pools.txt_tem48,
      pools.en_tem4,
      pools.txt_npee,
      pools.txt_cet46,
      pools.en_kaoyan,
      pools.txt_toefl,
      pools.txt_oald,
    ),
    专八词汇: mergeLists(
      pools.txt_tem8_star,
      pools.en_tem8,
      pools.txt_tem48,
      pools.txt_gre,
      pools.txt_toefl,
      pools.txt_oald,
      pools.txt_coca,
    ),
    TOEFL词汇: mergeLists(
      pools.txt_toefl,
      pools.en_toefl,
      pools.txt_gre,
      pools.en_gre,
      pools.txt_oald,
      pools.txt_coca,
    ),
    GRE词汇: mergeLists(
      pools.txt_gre,
      pools.en_gre,
      pools.txt_tem8_star,
      pools.en_tem8,
      pools.txt_toefl,
      pools.txt_oald,
      pools.txt_coca,
    ),
    IELTS词汇: mergeLists(
      pools.en_ielts,
      pools.txt_npee,
      pools.txt_toefl,
      pools.en_toefl,
      pools.txt_cet46,
      pools.txt_oald,
      pools.txt_coca,
    ),
  };
}

async function main() {
  const db = new Database(LOCAL_DB, { readonly: true });
  const wordMeta = loadLocalWordMeta(db);
  db.close();

  const pools = buildSourcePools();
  const categoryCandidates = buildCategoryCandidates(pools);

  const fallbackPool = Array.from(wordMeta.values())
    .filter((x) => !maybeAbbrNoise(x.word, x.definition))
    .sort((a, b) => qualityScore(b.word, b.definition) - qualityScore(a.word, a.definition) || a.word.localeCompare(b.word))
    .map((x) => x.word);

  const selectedByCategory = new Map();
  const unionWords = new Map();
  const report = {};

  for (const category of CATEGORY_ORDER) {
    const target = TARGET_COUNTS[category];
    const selected = pickCategoryWords(category, target, categoryCandidates[category] || [], fallbackPool, wordMeta);
    selectedByCategory.set(category, selected);
    report[category] = {
      target,
      selected: selected.length,
      sample: selected.slice(0, 20),
    };
    for (const w of selected) {
      if (unionWords.has(w)) continue;
      const meta = wordMeta.get(w) || { word: w, phonetic: '', definition: w, part_of_speech: '' };
      unionWords.set(w, meta);
    }
    console.log(`${category}: selected=${selected.length}/${target}`);
  }

  const importRows = Array.from(unionWords.values()).sort((a, b) => a.word.localeCompare(b.word));
  console.log(`unique import rows: ${importRows.length}`);

  fs.writeFileSync(
    'D:/trae/LexiSync/backend/outline_rebuild_report.json',
    JSON.stringify({
      generated_at: new Date().toISOString(),
      categories: report,
      union_count: importRows.length,
      sentinels: BAD_SENTINELS,
    }, null, 2),
    'utf8',
  );

  const token = await login();
  const headers = { Authorization: `Bearer ${token}` };
  await clearRemote(headers);
  console.log('remote cleared');

  const chunkSize = 1800;
  for (let i = 0; i < importRows.length; i += chunkSize) {
    const chunk = importRows.slice(i, i + chunkSize);
    await importWords(headers, chunk, `outline_${Math.floor(i / chunkSize) + 1}`);
    console.log(`imported chunk ${Math.floor(i / chunkSize) + 1}: ${chunk.length}`);
  }

  const remoteCategories = await getRemoteCategories(headers);
  const remoteWordMap = await getAllRemoteWords(headers);
  console.log(`remote indexed words: ${remoteWordMap.size}`);

  const categoryIdMap = new Map();
  for (const category of CATEGORY_ORDER) {
    const categoryId = remoteCategories.get(category);
    if (!categoryId) throw new Error(`missing remote category: ${category}`);
    categoryIdMap.set(category, categoryId);
    const words = selectedByCategory.get(category) || [];
    const ids = words.map((w) => remoteWordMap.get(w)).filter(Boolean);
    const linked = await batchLink(headers, categoryId, ids);
    console.log(`${category}: target=${TARGET_COUNTS[category]} matched=${ids.length} linked=${linked}`);
  }

  await verifySentinels(headers, categoryIdMap);
  console.log(`sentinel check passed: ${BAD_SENTINELS.join(', ')}`);

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
