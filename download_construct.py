#!/usr/bin/env python3
"""Download the Generic 3D model (GLB), its thumbnail and the voice lines (en + ja) of Qu's frames from huaxu.app.

Usage: python3 download_construct.py shukra pavo [--out data] [--workers 8]

Per slug (a key of PREFABS), writes to <out>/<slug>/{models,icons,voices_en,voices_ja}/ and saves the voices page as
<out>/<slug>/wiki/voices.html (the source of voices.json, see build_voices.py). Only the prefab named in PREFABS is
downloaded: no other skin, coating or chibi. Existing valid files are skipped, so the script is safe to re-run after
an interruption.
"""
import argparse
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

WIKI = "https://huaxu.app/eu/wiki/constructs"
ASSETS = "https://assets.huaxu.app"
HEADERS = {"User-Agent": "Mozilla/5.0"}

# Generic skin of each frame, the only model variant this project downloads (download_animations.py imports this table).
PREFABS = {
    "shukra": "r3qumd010011",
    "pavo": "r2qumd010011",
}


def fetch(url, retries=3):
    last = None
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 - retry on any network error
            last = e
    raise RuntimeError(f"{url}: {last}")


def page(url):
    return fetch(url).decode("utf-8", errors="ignore")


def valid(path, kind):
    if not path.is_file() or path.stat().st_size == 0:
        return False
    if kind == "glb":
        with open(path, "rb") as f:
            return f.read(4) == b"glTF"
    if kind == "webp":
        with open(path, "rb") as f:
            head = f.read(12)
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    return True


def download(job):
    url, dest, kind = job
    if valid(dest, kind):
        return "skip", dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".part")
    try:
        tmp.write_bytes(fetch(url))
        tmp.rename(dest)
        if not valid(dest, kind):
            dest.unlink()
            return "bad", dest
        return "ok", dest
    except Exception as e:  # noqa: BLE001
        tmp.unlink(missing_ok=True)
        print(f"  FAIL {url}: {e}", file=sys.stderr)
        return "fail", dest


def list_dir(path):
    """File names in a directory of the assets file browser."""
    html = page(f"{ASSETS}/browse/{path}")
    return re.findall(r'href="\./([^"/]+\.mp3)"', html)


def nuxt_payload(html):
    """The page's __NUXT_DATA__ resolved into plain Python values, or None.

    Nuxt serialises it with devalue: a flat list where containers refer to other entries by index, and reactive
    wrappers are ["ShallowReactive", i] / ["Reactive", i] / ["Ref", i] / ["ShallowRef", i].
    """
    m = re.search(r'<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return None
    data = json.loads(m.group(1))
    wrappers = {"ShallowReactive", "Reactive", "Ref", "ShallowRef"}

    def at(i):
        return value(data[i])

    def value(x):
        if isinstance(x, dict):
            return {k: at(v) if isinstance(v, int) else v for k, v in x.items()}
        if isinstance(x, list):
            if len(x) == 2 and x[0] in wrappers and isinstance(x[1], int):
                return at(x[1])
            return [at(v) if isinstance(v, int) else v for v in x]
        return x

    return value(data[0])


def icon_jobs(html, root):
    """Thumbnails of the construct's skins (coatings) and chibis: icons/<model file stem>.webp."""
    payload = nuxt_payload(html)
    if not payload:
        return []
    character = next((v for v in payload.get("data", {}).values()
                      if isinstance(v, dict) and "coatings" in v), None)
    if not character:
        return []
    jobs = []
    for coating in character.get("coatings") or []:
        model, icon = coating.get("model"), coating.get("icon")
        if model and icon:  # model: charaterprefab/<id> -> models/<id>.glb
            jobs.append((f"{ASSETS}/glb/{icon}.webp", root / "icons" / f"{model.rsplit('/', 1)[1]}.webp", "webp"))
    for chibi in character.get("chibis") or []:
        model, icon = chibi.get("model"), chibi.get("icon")
        if model and icon:  # model: room/prefab/<id> -> models/<id>_chibi.glb
            jobs.append((f"{ASSETS}/glb/{icon}.webp", root / "icons" / f"{model.rsplit('/', 1)[1]}_chibi.webp", "webp"))
    return jobs


def save_page(html, dest):
    """Keep a fetched page (the source of voices.json). Unchanged content is left alone."""
    data = html.encode("utf-8")
    if dest.is_file() and dest.read_bytes() == data:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)


def plan(slug, root):
    if slug not in PREFABS:
        raise RuntimeError(f"unknown slug '{slug}' (known: {', '.join(PREFABS)})")
    prefab = PREFABS[slug]

    model_html = page(f"{WIKI}/{slug}/model")
    voice_html = page(f"{WIKI}/{slug}/voices")
    save_page(voice_html, root / "wiki" / "voices.html")

    jobs = [(f"{ASSETS}/models/charaterprefab/{prefab}/base.glb", root / "models" / f"{prefab}.glb", "glb")]

    # The thumbnail of that model only, named after it (the payload is on both pages).
    icons = [j for j in (icon_jobs(model_html, root) or icon_jobs(voice_html, root))
             if j[1].stem == prefab]
    if not icons:
        print(f"  WARN no icon for {prefab} found in the page payload", file=sys.stderr)
    jobs += icons

    # English: exactly what the voices page links to.
    en_urls = sorted(set(re.findall(
        r"https://assets\.huaxu\.app/glb/audio/en/\w+/[\w.]+\.mp3", voice_html)))
    for url in en_urls:
        jobs.append((url, root / "voices_en" / url.rsplit("/", 1)[1], "mp3"))

    # Japanese: same voice folder(s), listed from the file browser.
    folders = sorted(set(re.findall(
        r"https://assets\.huaxu\.app/glb/audio/en/(\w+)/", voice_html)))
    for folder in folders:
        for name in list_dir(f"glb/audio/ja/{folder}/"):
            jobs.append((f"{ASSETS}/glb/audio/ja/{folder}/{name}",
                         root / "voices_ja" / name, "mp3"))
    return jobs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slugs", nargs="+")
    ap.add_argument("--out", default="data")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    failed = False
    for slug in args.slugs:
        print(f"== {slug}")
        try:
            jobs = plan(slug, Path(args.out) / slug)
        except Exception as e:  # noqa: BLE001
            print(f"  ERROR {e}", file=sys.stderr)
            failed = True
            continue
        with ThreadPoolExecutor(args.workers) as ex:
            results = list(ex.map(download, jobs))
        counts = {k: sum(1 for r, _ in results if r == k)
                  for k in ("ok", "skip", "bad", "fail")}
        print(f"  {len(jobs)} files: {counts['ok']} downloaded, "
              f"{counts['skip']} skipped, {counts['bad']} invalid, {counts['fail']} failed")
        failed |= bool(counts["bad"] or counts["fail"])
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
