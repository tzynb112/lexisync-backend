"""Clear all words and category links from Railway, then re-import correctly.

Usage:
    C:\Python314\python.exe reimport.py
"""
import csv
import os
import sys
import requests

BASE = "https://lexisync-backend-production.up.railway.app"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EC_DICT = os.path.join(SCRIPT_DIR, "ecdict.csv")

ADMIN_USER = "admin"
ADMIN_PW = "admin123456"
ADMIN_EMAIL = "admin@lexisync.app"

TAG_CATEGORY = {
    "zk": "中考词汇", "gk": "高考词汇", "cet4": "四级词汇",
    "cet6": "六级词汇", "ky": "考研词汇", "toefl": "TOEFL词汇",
    "gre": "GRE词汇", "ielts": "IELTS词汇",
}

QUALITY_CSVS = {
    "cet4_words.csv": "四级词汇",
    "kaoyan_words.csv": "考研词汇",
    "full_kaoyan_words.csv": "考研词汇",
    "more_kaoyan_words.csv": "考研词汇",
    "more_kaoyan_words2.csv": "考研词汇",
}

def get_token():
    r = requests.post(f"{BASE}/api/auth/register", json={
        "email": ADMIN_EMAIL, "username": ADMIN_USER, "password": ADMIN_PW})
    if r.status_code == 200:
        return r.json()["access_token"]
    r = requests.post(f"{BASE}/api/auth/login", json={
        "username": ADMIN_USER, "password": ADMIN_PW})
    return r.json()["access_token"]

def get_categories(token):
    r = requests.get(f"{BASE}/api/words/categories", headers={"Authorization": f"Bearer {token}"})
    return {c["name"]: {"id": c["id"], "count": c["word_count"]} for c in r.json()}

def clear_all_words(token):
    """Delete all words from Railway page by page."""
    print("Clearing all existing words...")
    page, deleted = 1, 0
    while True:
        r = requests.get(f"{BASE}/api/words?page={page}&page_size=100",
            headers={"Authorization": f"Bearer {token}"}, timeout=30)
        if r.status_code != 200:
            break
        data = r.json()
        words = data.get("words", [])
        if not words:
            break
        for w in words:
            dr = requests.delete(f"{BASE}/api/words/{w['id']}",
                headers={"Authorization": f"Bearer {token}"}, timeout=15)
            if dr.status_code in (200, 204):
                deleted += 1
        print(f"  Page {page}: deleted {deleted} total")
        if page >= data.get("total_pages", 1):
            break
        page += 1
    print(f"  Deleted {deleted} words total")

def upload_csv(token, filepath):
    fname = os.path.basename(filepath)
    with open(filepath, "rb") as f:
        r = requests.post(f"{BASE}/api/words/import/csv",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (fname, f, "text/csv")}, timeout=180)
    if r.status_code != 200:
        print(f"    FAILED ({r.status_code}): {r.text[:200]}")
        return []
    return [w["id"] for w in r.json()]

def batch_link(token, word_ids, category_id):
    if not word_ids:
        return 0
    r = requests.post(f"{BASE}/api/words/categories/batch-link",
        headers={"Authorization": f"Bearer {token}"},
        json={"word_ids": word_ids, "category_id": category_id}, timeout=120)
    if r.status_code != 200:
        print(f"    Link FAILED ({r.status_code}): {r.text[:200]}")
        return 0
    data = r.json()
    return data["linked"]

def create_primary_csv():
    """Create primary school CSV with top ~800 most frequent basic words."""
    out_path = os.path.join(SCRIPT_DIR, "_primary.csv")
    if not os.path.exists(EC_DICT):
        print("ERROR: ecdict.csv not found")
        return out_path, 0

    words = []
    with open(EC_DICT, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            word = row[0].strip()
            if not word or " " in word or word.startswith("'"):
                continue
            bnc_str = row[8].strip() if len(row) > 8 else "0"
            frq_str = row[9].strip() if len(row) > 9 else "0"
            try:
                bnc = int(bnc_str) if bnc_str else 0
                frq = float(frq_str) if frq_str else 0
            except (ValueError, TypeError):
                continue
            if bnc >= 7000 and frq >= 5.5:
                phonetic = row[1].strip() if len(row) > 1 else ""
                definition = row[2].strip() if len(row) > 2 else ""
                translation = row[3].strip() if len(row) > 3 else ""
                pos = row[4].strip() if len(row) > 4 else ""
                full_def = definition
                if translation and translation != definition:
                    full_def = f"{definition}; {translation}"
                words.append((bnc, frq, word, phonetic, full_def, pos))

    words.sort(key=lambda x: (-x[0], -x[1]))
    words = words[:800]  # Top 800

    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["word", "phonetic", "definition", "part_of_speech"])
        for _, _, w, ph, df, ps in words:
            writer.writerow([w, ph, df, ps])

    print(f"  Created primary school CSV: {len(words)} words (top 800 by BNC/frq)")
    return out_path, len(words)

def create_ecdict_csv(tag, cat_name):
    """Create CSV for a specific ecdict exam tag."""
    out_path = os.path.join(SCRIPT_DIR, f"_ecdict_{tag}.csv")
    if not os.path.exists(EC_DICT):
        return out_path, 0

    seen = set()
    with open(EC_DICT, "r", encoding="utf-8") as fin, \
         open(out_path, "w", newline="", encoding="utf-8-sig") as fout:
        reader = csv.reader(fin)
        next(reader)
        writer = csv.writer(fout)
        writer.writerow(["word", "phonetic", "definition", "part_of_speech"])
        count = 0
        for row in reader:
            word = row[0].strip()
            if not word or " " in word or word.startswith("'"):
                continue
            tag_str = row[7].strip() if len(row) > 7 else ""
            tags = set(tag_str.split())
            if tag in tags and word not in seen:
                seen.add(word)
                phonetic = row[1].strip() if len(row) > 1 else ""
                definition = row[2].strip() if len(row) > 2 else ""
                translation = row[3].strip() if len(row) > 3 else ""
                pos = row[4].strip() if len(row) > 4 else ""
                full_def = definition
                if translation and translation != definition:
                    full_def = f"{definition}; {translation}"
                writer.writerow([word, phonetic, full_def, pos])
                count += 1

    print(f"  {cat_name} ({tag}): {count} words")
    return out_path, count

def show_stats(token):
    cats = get_categories(token)
    print("\n=== Final Stats ===")
    total = 0
    for name, info in sorted(cats.items(), key=lambda x: -x[1]["count"]):
        count = info["count"]
        total += count
        print(f"  {name}: {count}")
    print(f"  TOTAL: {total}")

def main():
    print("=== Step 0: Clear all existing data ===")
    token = get_token()
    clear_all_words(token)
    print()

    cats = get_categories(token)
    print(f"Categories: {list(cats.keys())}")

    # Step 1: Create quality + ecdict CSVs
    print("\n=== Step 1: Create CSV files ===")
    primary_path, _ = create_primary_csv()
    for tag, cat_name in TAG_CATEGORY.items():
        create_ecdict_csv(tag, cat_name)

    # Step 2: Upload quality CSVs first
    print("\n=== Step 2: Upload quality CSVs ===")
    for fname, cat_name in QUALITY_CSVS.items():
        fpath = os.path.join(SCRIPT_DIR, fname)
        if not os.path.exists(fpath):
            continue
        print(f"  {fname} -> [{cat_name}] ", end="", flush=True)
        wids = upload_csv(token, fpath)
        print(f"{len(wids)} words")
        if wids and cat_name in cats:
            batch_link(token, wids, cats[cat_name]["id"])

    # Step 3: Upload ecdict CSVs (excluding overlaps with quality)
    print("\n=== Step 3: Upload ecdict CSVs ===")
    for tag, cat_name in TAG_CATEGORY.items():
        fpath = os.path.join(SCRIPT_DIR, f"_ecdict_{tag}.csv")
        if not os.path.exists(fpath):
            continue
        print(f"  _ecdict_{tag}.csv -> [{cat_name}] ", end="", flush=True)
        wids = upload_csv(token, fpath)
        print(f"{len(wids)} words (linked: {batch_link(token, wids, cats[cat_name]['id'])})")

    # Step 4: Primary school
    print("\n=== Step 4: Primary school ===")
    if os.path.exists(primary_path):
        print(f"  _primary.csv -> [小学词汇] ", end="", flush=True)
        wids = upload_csv(token, primary_path)
        print(f"{len(wids)} words (linked: {batch_link(token, wids, cats['小学词汇']['id'])})")

    # Step 5: Alias categories (专四 <- 六级, 专八 <- GRE)
    print("\n=== Step 5: Alias categories ===")
    refreshed = get_categories(token)
    for alias, source in [("专四词汇", "六级词汇"), ("专八词汇", "GRE词汇")]:
        if alias not in refreshed or source not in refreshed:
            continue
        sid = refreshed[source]["id"]
        tid = refreshed[alias]["id"]
        page, all_wids = 1, []
        while True:
            r = requests.get(f"{BASE}/api/words/categories/{sid}?page={page}&page_size=100",
                headers={"Authorization": f"Bearer {token}"}, timeout=30)
            if r.status_code != 200:
                break
            data = r.json()
            wids = [w["id"] for w in data.get("words", [])]
            if not wids:
                break
            all_wids.extend(wids)
            if len(wids) < 100:
                break
            page += 1
        if all_wids:
            print(f"  [{alias}] <- [{source}]: {len(all_wids)} words")
            batch_link(token, all_wids, tid)

    # Cleanup temp CSVs
    for f in os.listdir(SCRIPT_DIR):
        if f.startswith("_ecdict_") or f == "_primary.csv":
            os.remove(os.path.join(SCRIPT_DIR, f))

    show_stats(token)
    print("\nDone!")

if __name__ == "__main__":
    main()