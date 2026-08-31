#!/usr/bin/env python3
"""Validate the generated FoeDesk appearance manifest and runtime assets."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "app/src/core/companions/legacy-appearance-manifest.json"
ART = ROOT / "app/src/assets/characters"
THUMBS = ROOT / "app/src/assets/thumbnails"


def main() -> None:
    entries = json.loads(MANIFEST.read_text(encoding="utf-8"))["appearances"]
    errors: list[str] = []
    if len(entries) != 66:
        errors.append(f"expected 66 manifest entries, found {len(entries)}")
    if len({entry["id"] for entry in entries}) != len(entries):
        errors.append("appearance IDs are not unique")
    hidden = [entry for entry in entries if entry["unlock"]["type"] == "hidden-code"]
    if len(hidden) != 50:
        errors.append(f"expected 50 hidden appearances, found {len(hidden)}")

    for entry in entries:
        art = ART / entry["assetFile"]
        thumb = THUMBS / entry["thumbnailFile"]
        if not art.exists() or not thumb.exists():
            errors.append(f"{entry['id']}: missing runtime art or thumbnail")
            continue
        with Image.open(art) as image:
            if image.size != (1024, 1536):
                errors.append(f"{entry['id']}: runtime size is {image.size}")
            if image.mode != "RGBA":
                errors.append(f"{entry['id']}: runtime mode is {image.mode}")
            elif image.getchannel("A").getbbox() is None:
                errors.append(f"{entry['id']}: runtime art is fully transparent")
        with Image.open(thumb) as image:
            if image.size != (200, 300):
                errors.append(f"{entry['id']}: thumbnail size is {image.size}")

    extra_art = {path.name for path in ART.glob("*.webp")} - {entry["assetFile"] for entry in entries}
    extra_thumbs = {path.name for path in THUMBS.glob("*.webp")} - {entry["thumbnailFile"] for entry in entries}
    if extra_art: errors.append(f"unregistered runtime art: {sorted(extra_art)}")
    if extra_thumbs: errors.append(f"unregistered thumbnails: {sorted(extra_thumbs)}")
    if errors:
        raise SystemExit("\n".join(errors))
    print("Validated 66 appearances, 66 runtime WebPs, 66 thumbnails, and 50 hidden codes.")


if __name__ == "__main__":
    main()
