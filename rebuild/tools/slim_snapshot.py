"""python3 slim_snapshot.py <snapshot-dir> <out-dir>

A copy of a JSON snapshot (see seed_emulator.js) with every large inline
picture (a data:image URL over 24 KB, such as a 1 MB avatar) scaled down to
256 px. The Firestore emulator keeps each version of a document a test writes,
and with the full-size pictures it ran out of memory within a few test runs;
the slim copy looks the same on screen and stays small.
"""
import base64
import io
import json
import os
import sys

from PIL import Image

LIMIT = 24_000
SIDE = 256


def slim(url):
    head, _, data = url.partition(',')
    try:
        im = Image.open(io.BytesIO(base64.b64decode(data)))
        im.load()
    except Exception:
        return url
    im.thumbnail((SIDE, SIDE))
    out = io.BytesIO()
    if im.mode in ('RGBA', 'LA', 'P'):
        im.convert('RGBA').save(out, 'WEBP', quality=80)   # keeps transparency
        kind = 'image/webp'
    else:
        im.convert('RGB').save(out, 'JPEG', quality=80)
        kind = 'image/jpeg'
    return f'data:{kind};base64,' + base64.b64encode(out.getvalue()).decode()


def walk(v):
    if isinstance(v, str):
        return slim(v) if len(v) > LIMIT and v.startswith('data:image/') else v
    if isinstance(v, list):
        return [walk(x) for x in v]
    if isinstance(v, dict):
        return {k: walk(x) for k, x in v.items()}
    return v


def main(src, dst):
    os.makedirs(dst, exist_ok=True)
    for name in sorted(os.listdir(src)):
        if not name.endswith('.json'):
            continue
        with open(os.path.join(src, name)) as f:
            docs = json.load(f)
        before = len(json.dumps(docs))
        docs = walk(docs)
        with open(os.path.join(dst, name), 'w') as f:
            json.dump(docs, f)
        print(f'{name}: {before // 1024} KB -> {len(json.dumps(docs)) // 1024} KB')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
