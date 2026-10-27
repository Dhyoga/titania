#!/usr/bin/env python3
"""Build data/<slug>/voices.json from the saved huaxu voices page, the voices_ja/ folder and voice_pairings.json.

Usage: python3 build_voices.py stigmata veritas zero [--data data] [--pairings voice_pairings.json]
       python3 build_voices.py --check crepuscule      (compare with the shipped file, ignoring entry order; write nothing)

One entry per file in voices_ja/, in file stem order. A file that a line of the page links as its Japanese audio gets that
line's title and English text; any other file gets an empty text and a note. The Board action pairing (`animation`) comes only
from voice_pairings.json (clip name -> line title): a title that matches no line, or more than one, or a line claimed by two
clips, is an error, and nothing is written for that frame. Crepuscule's shipped file is never regenerated (only --check).
"""
import argparse
import json
import sys
from pathlib import Path

from download_construct import nuxt_payload

NO_TEXT_NOTE = "no wiki text for this audio variant: add a subtitle by hand or leave empty"


class FrameError(Exception):
    """Everything wrong with one frame's data, one message per line."""

    def __init__(self, slug, problems):
        super().__init__(f"{slug}: " + "; ".join(problems))
        self.slug = slug
        self.problems = problems


def page_lines(slug, root):
    """The `lines` of the page's voices payload."""
    path = root / "wiki" / "voices.html"
    if not path.is_file():
        raise FrameError(slug, [f"{path} is missing (run download_construct.py {slug})"])
    payload = nuxt_payload(path.read_text(encoding="utf-8"))
    voices = next((v for k, v in (payload or {}).get("data", {}).items()
                   if k.endswith("/voices") and isinstance(v, dict) and "lines" in v), None)
    if voices is None:
        raise FrameError(slug, [f"{path} has no voices.lines in its payload"])
    return voices["lines"]


def build(slug, root, pairings):
    """voices.json content (a dict) for one frame. Raises FrameError listing every problem found."""
    problems = []
    lines = page_lines(slug, root)
    stems = sorted(p.stem for p in (root / "voices_ja").glob("*.mp3"))
    if not stems:
        raise FrameError(slug, [f"{root / 'voices_ja'} has no mp3 files"])

    by_stem = {}
    for line in lines:
        jp = (line.get("audio") or {}).get("jp")
        if not jp:
            continue
        stem = jp.rsplit("/", 1)[1]
        if stem in by_stem:
            first = by_stem[stem]
            if first["text"] != line["text"]:
                problems.append(f"two lines of the page link {stem} with different text ({first['name']!r}, {line['name']!r})")
            else:  # a wiki duplicate (e.g. "Battle over" / "Battle Over"): the first line of the page is kept
                print(f"  note {slug}: {stem} is linked by {first['name']!r} and {line['name']!r} (same text); using the first",
                      file=sys.stderr)
            continue
        by_stem[stem] = line
    missing = sorted(s for s in by_stem if s not in set(stems))
    if missing:
        problems.append(f"the page links audio that is not in voices_ja/: {', '.join(missing[:5])}")

    entries = []
    for stem in stems:
        line = by_stem.get(stem)
        if line:
            entries.append({"id": stem, "file": f"{stem}.mp3", "title": line["name"], "text": line["text"], "lang": "en"})
        else:
            entries.append({"id": stem, "file": f"{stem}.mp3", "text": "", "lang": "en", "note": NO_TEXT_NOTE})

    claimed = {}
    for clip, title in (pairings.get(slug) or {}).items():
        found = [e for e in entries if e.get("title") == title]
        if len(found) != 1:
            problems.append(f"{clip} is paired with {title!r}, which matches {len(found)} lines")
            continue
        entry = found[0]
        if entry["id"] in claimed:
            problems.append(f"{clip} and {claimed[entry['id']]} are both paired with {title!r}")
            continue
        claimed[entry["id"]] = clip
        # `animation` sits after `file`, as in Crepuscule's file.
        position = list(entry).index("file") + 1
        items = list(entry.items())
        items.insert(position, ("animation", clip))
        entry.clear()
        entry.update(items)

    if problems:
        raise FrameError(slug, problems)
    return {"version": 1, "audioLang": "ja", "textLang": "en", "entries": entries}


def by_id(data):
    """Content without the order of the entries (the shipped Crepuscule file keeps the file browser's order)."""
    return {**{k: v for k, v in data.items() if k != "entries"}, "entries": {e["id"]: e for e in data["entries"]}}


def render(data):
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slugs", nargs="+")
    ap.add_argument("--data", default="data")
    ap.add_argument("--pairings", default=str(Path(__file__).with_name("voice_pairings.json")))
    ap.add_argument("--check", action="store_true", help="compare with the existing voices.json instead of writing it")
    args = ap.parse_args()

    pairings = json.loads(Path(args.pairings).read_text(encoding="utf-8"))
    failed = False
    for slug in args.slugs:
        root = Path(args.data) / slug
        target = root / "voices.json"
        try:
            text = render(build(slug, root, pairings))
        except FrameError as e:
            print(f"ERROR {e}", file=sys.stderr)
            failed = True
            continue
        if args.check:
            same = target.is_file() and by_id(json.loads(target.read_text(encoding="utf-8"))) == by_id(json.loads(text))
            print(f"{slug}: {'identical to' if same else 'DIFFERS from'} {target}")
            failed |= not same
            continue
        if slug == "crepuscule":
            print("ERROR crepuscule: its shipped voices.json is not regenerated (use --check)", file=sys.stderr)
            failed = True
            continue
        target.write_text(text, encoding="utf-8")
        paired = sum(1 for e in json.loads(text)["entries"] if "animation" in e)
        print(f"{slug}: wrote {target} ({len(json.loads(text)['entries'])} entries, {paired} paired)")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
