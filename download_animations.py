#!/usr/bin/env python3
"""Download animation clips into data/<slug>/anim/ (base skin) or data/<slug>/anim-skins/<prefab>/ (--skins).

The clip list comes from each prefab's manifest.json (the same file the wiki's model viewer reads); the files are
fetched one by one with a pause between requests, are validated as JSON, and existing valid files are skipped, so the
script can be re-run after an interruption. Personal use only (Kuro Games' assets). Output is git-ignored.

Usage: python3 download_animations.py [slug ...] [--skins] [--delay 0.25]
  (default)  the base skin of each character -> data/<slug>/anim/
  --skins    every OTHER skin prefab of each character -> data/<slug>/anim-skins/<prefab>/
Clips of one skin only fit the model of that skin (same clip names differ in content between skins).
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://assets.huaxu.app/models/charaterprefab"
HEADERS = {"User-Agent": "Mozilla/5.0"}

# Generic skin of each character, the model variant used by this project.
PREFABS = {
    "crepuscule": "r5biankamd010011",
    "zero": "r2biankamd010011",
    "veritas": "r3biankamd010011",
    "stigmata": "r4biankamd010011",
    "solacetune": "r3hanyingmd010011",
    "zitherwoe": "r2hanyingmd010011",
    "dirge": "r3nietiyamd010011",
}

# Every skin prefab per character (from the model pages of the wiki). The base skin is PREFABS[slug].
SKIN_PREFABS = {
    "crepuscule": ["r5biankamd010021", "r5biankamd010031", "r5biankamd019011", "r5biankamd019241", "r5biankamd019271"],
    "zero": ["r2biankamd010021", "r2biankamd010031", "r2biankamd019011", "r2biankamd019071"],
    "veritas": ["r3biankamd010021", "r3biankamd010031", "r3biankamd019101", "r3biankamd019131", "r3biankamd019141", "r3biankamd019191"],
    "stigmata": ["q4biankamd010011", "r4biankamd010021", "r4biankamd010031", "r4biankamd019011", "r4biankamd019241", "r4biankamd019281"],
    "solacetune": ["r3hanyingmd010021", "r3hanyingmd010031", "r3hanyingmd019011", "r3hanyingmd019021", "r3hanyingmd019141"],
    "zitherwoe": ["r2hanyingmd010021", "r2hanyingmd010031", "r2hanyingmd019011", "r2hanyingmd019141"],
    "dirge": ["r3nietiyamd010021", "r3nietiyamd010031", "r3nietiyamd019011", "r3nietiyamd019421"],
}


def fetch(url, retries=4, total=120):
    """GET with a hard limit: 20 s per socket operation AND `total` seconds for the whole body.

    The socket timeout alone does not help against a server that keeps trickling bytes: it resets on every byte.
    A stalled or over-long attempt is abandoned and retried on a fresh connection.
    """
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as r:
                deadline = time.monotonic() + total
                chunks = []
                while True:
                    chunk = r.read(65536)
                    if not chunk:
                        break
                    chunks.append(chunk)
                    if time.monotonic() > deadline:
                        raise TimeoutError(f"more than {total}s for one file")
                return b"".join(chunks)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            last = e
        except Exception as e:  # noqa: BLE001 - retry on network errors and stalls
            last = e
        print(f"  retry {attempt + 1}/{retries} for {url.rsplit('/', 1)[-1]}: {last}", flush=True)
        time.sleep(1 + attempt * 2)
    raise RuntimeError(f"{url}: {last}")


def valid_json(path):
    try:
        json.loads(path.read_bytes())
        return True
    except Exception:  # noqa: BLE001
        return False


def download_prefab(slug, prefab, root, delay, failed):
    root.mkdir(parents=True, exist_ok=True)
    manifest_bytes = fetch(f"{BASE}/{prefab}/manifest.json")
    (root / "manifest.json").write_bytes(manifest_bytes)
    clips = json.loads(manifest_bytes)["clips"]
    print(f"== {slug} {prefab}: {len(clips)} clips", flush=True)

    done = skipped = size = 0
    for i, clip in enumerate(clips, 1):
        rel = clip["file"]  # e.g. anim/BaseLayer/Born.json
        dest = root / rel.removeprefix("anim/")
        if dest.is_file() and dest.stat().st_size > 0 and valid_json(dest):
            skipped += 1
            size += dest.stat().st_size
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        url = f"{BASE}/{prefab}/{urllib.parse.quote(rel)}"
        try:
            data = fetch(url)
            json.loads(data)  # must be valid JSON
            tmp = dest.with_name(dest.name + ".part")
            tmp.write_bytes(data)
            tmp.rename(dest)
            done += 1
            size += len(data)
        except Exception as e:  # noqa: BLE001
            failed.append((slug, prefab, rel, str(e)))
            print(f"  FAIL {rel}: {e}", file=sys.stderr, flush=True)
        if i % 50 == 0:
            print(f"  {i}/{len(clips)}  downloaded {done}, skipped {skipped}, {size / 1e6:.1f} MB", flush=True)
        time.sleep(delay)
    print(f"  done: {done} downloaded, {skipped} already present, {size / 1e6:.1f} MB total", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slugs", nargs="*")
    ap.add_argument("--out", default="data")
    ap.add_argument("--delay", type=float, default=0.25)
    ap.add_argument("--skins", action="store_true", help="download the other skins instead of the base skin")
    args = ap.parse_args()

    failed = []
    for slug in args.slugs or PREFABS:
        if args.skins:
            for prefab in SKIN_PREFABS[slug]:
                download_prefab(slug, prefab, Path(args.out) / slug / "anim-skins" / prefab, args.delay, failed)
        else:
            download_prefab(slug, PREFABS[slug], Path(args.out) / slug / "anim", args.delay, failed)

    print(f"\nfailures: {len(failed)}")
    for f in failed:
        print("  ", *f)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
