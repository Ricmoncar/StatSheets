"""Copy the live StatSheets data into the `next_` sandbox collections.

The /next/ preview of the Angular rebuild reads and writes `next_characters`,
`next_folders` and so on, so nothing done in the preview can touch the real
data. This script refreshes that copy from the real collections.

SAFETY: it only ever READS the real collections (GET), and every write goes
through `write_batch`, which refuses any document path whose top-level
collection does not start with `next_`.

Usage:
  python3 copy_to_sandbox.py            # dry run: counts what would be copied
  python3 copy_to_sandbox.py --write    # copy for real
  ... --only=characters,folders         # just these top-level collections
  ... --no-subs                         # skip the subcollections (much faster)
"""
import json
import sys
import urllib.parse
import urllib.error
import urllib.request

KEY = "AIzaSyBRtoLzS--wz_6sD4rWMgzcwZnHVHUBNdg"
PROJECT = "projects/statsheets-3668d/databases/(default)"
BASE = f"https://firestore.googleapis.com/v1/{PROJECT}/documents"
PREFIX = "next_"

# top-level collections, and the subcollections that live under their documents
COLLECTIONS = {
    "characters": ["gallery"],
    "folders": [],
    "art_requests": ["images"],
    "bk_gallery": [],
    "tierlists": [],
    "suggestions": [],
    "general_suggestions": [],
    "playlists": [],
    "heightchart": [],
    "enc": [],
    "finalHour": [],
    "nmt": [],
    "lol": [],
    "crtl": [],
    "beyondLimits": [],
    "nara_canvases": ["strokes", "meta"],
    "gifs": [],
    "fonts": [],
}

MAX_BATCH_BYTES = 6 * 1024 * 1024
MAX_BATCH_WRITES = 400   # Firestore allows at most 500 writes per commit


def get(url):
    with urllib.request.urlopen(url, timeout=180) as r:
        return json.load(r)


def list_docs(path):
    """Every document directly in the collection at `path` (relative to BASE), raw REST form."""
    docs, token = [], None
    while True:
        q = {"pageSize": 100, "key": KEY}
        if token:
            q["pageToken"] = token
        d = get(f"{BASE}/{path}?{urllib.parse.urlencode(q)}")
        docs.extend(d.get("documents", []))
        token = d.get("nextPageToken")
        if not token:
            return docs


def rel(name):
    """Document path relative to .../documents/."""
    return name.split("/documents/", 1)[1]


def sandbox_path(path):
    out = PREFIX + path
    top = out.split("/", 1)[0]
    if not top.startswith(PREFIX) or top == PREFIX:
        raise SystemExit(f"REFUSING to write outside the sandbox: {out}")
    return out


def write_batch(writes, dry):
    if not writes:
        return
    for w in writes:  # second, independent check right before sending
        top = rel(w["update"]["name"]).split("/", 1)[0]
        if not top.startswith(PREFIX):
            raise SystemExit(f"REFUSING to write outside the sandbox: {w['update']['name']}")
    if dry:
        return
    body = json.dumps({"writes": writes}).encode()
    req = urllib.request.Request(f"{BASE}:commit?key={KEY}", data=body, method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            r.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:600]
        names = ", ".join(rel(w["update"]["name"]) for w in writes[:3])
        raise SystemExit(f"commit failed ({e.code}) for {len(writes)} writes starting {names}: {detail}")


def main():
    dry = "--write" not in sys.argv
    only = next((a.split("=", 1)[1].split(",") for a in sys.argv if a.startswith("--only=")), None)
    no_subs = "--no-subs" in sys.argv
    pending, size, total_docs, total_bytes = [], 0, 0, 0

    def add(doc):
        nonlocal pending, size, total_docs, total_bytes
        w = {"update": {"name": f"{PROJECT}/documents/{sandbox_path(rel(doc['name']))}",
                        "fields": doc.get("fields", {})}}
        n = len(json.dumps(w))
        if pending and (size + n > MAX_BATCH_BYTES or len(pending) >= MAX_BATCH_WRITES):
            write_batch(pending, dry)
            pending, size = [], 0
        pending.append(w)
        size += n
        total_docs += 1
        total_bytes += n

    for top, subs in COLLECTIONS.items():
        if only and top not in only:
            continue
        if no_subs:
            subs = []
        docs = list_docs(top)
        sub_count = 0
        for d in docs:
            add(d)
            for sub in subs:
                for sd in list_docs(f"{rel(d['name'])}/{sub}"):
                    add(sd)
                    sub_count += 1
        print(f"{top:22s} {len(docs):4d} docs" + (f"  + {sub_count} in {', '.join(subs)}" if subs else ""))
    write_batch(pending, dry)
    print(f"{'DRY RUN, nothing written' if dry else 'WRITTEN'}: {total_docs} documents, {total_bytes // 1024} KB")


if __name__ == "__main__":
    main()
