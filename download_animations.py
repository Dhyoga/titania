#!/usr/bin/env python3
"""Download animation clips into data/<slug>/anim/ (the Generic skin of each frame in PREFABS).

The clip list comes from each prefab's manifest.json (the same file the wiki's model viewer reads); the files are
fetched one by one with a pause between requests, are validated as JSON, and existing valid files are skipped, so the
script can be re-run after an interruption. Personal use only (Kuro Games' assets). Output is git-ignored.

Usage: python3 download_animations.py [slug ...] [--delay 0.25]
  (default)  the Generic skin of each frame (shukra, pavo) -> data/<slug>/anim/
  --skins    kept for the layout of anim-skins/, but SKIN_PREFABS is empty here (no other skin is used), so it downloads nothing
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

from download_construct import PREFABS

BASE = "https://assets.huaxu.app/models/charaterprefab"
HEADERS = {"User-Agent": "Mozilla/5.0"}

# PREFABS (imported above) is the Generic skin of each frame: one table with download_construct.py, which downloads the model of
# the same prefab.
# Other skin prefabs per frame: none are used (Qu's models are not shown beyond their Generic skin), so --skins does nothing.
SKIN_PREFABS = {}


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
            for prefab in SKIN_PREFABS.get(slug, []):
                download_prefab(slug, prefab, Path(args.out) / slug / "anim-skins" / prefab, args.delay, failed)
        else:
            download_prefab(slug, PREFABS[slug], Path(args.out) / slug / "anim", args.delay, failed)

    print(f"\nfailures: {len(failed)}")
    for f in failed:
        print("  ", *f)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
