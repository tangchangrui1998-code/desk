#!/usr/bin/env python3
"""Build FoeDesk runtime character art and a migration manifest.

The legacy project is read-only. This script only reads its character artwork
and configuration, then writes normalized WebP assets into the new app.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / "travel-collection"
SOURCE_ART = LEGACY / "src/assets/characters"
GAME_CONFIG = LEGACY / "src/config/gameConfig.ts"
CHEAT_CONFIG = LEGACY / "src/config/cheatCodes.ts"
OUTPUT_ART = ROOT / "app/src/assets/characters"
OUTPUT_THUMBS = ROOT / "app/src/assets/thumbnails"
OUTPUT_MANIFEST = ROOT / "app/src/core/companions/legacy-appearance-manifest.json"
OUTPUT_AUDIT = ROOT / "docs/SKIN_MIGRATION_AUDIT.json"

CANVAS = (1024, 1536)
THUMBNAIL = (200, 300)


def quoted(line: str, field: str) -> str | None:
    match = re.search(rf"\b{re.escape(field)}: '([^']*)'", line)
    return match.group(1) if match else None


def parse_game_config() -> list[dict[str, object]]:
    text = GAME_CONFIG.read_text(encoding="utf-8")
    imports = {
        variable: filename
        for variable, filename in re.findall(
            r"import\s+(\w+)\s+from\s+'\.\./assets/characters/([^']+\.png)';",
            text,
        )
    }
    section = text.split("export const SKINS: SkinDefinition[] = [", 1)[1].split("];", 1)[0]
    entries: list[dict[str, object]] = []
    for line in section.splitlines():
        if not line.lstrip().startswith("{ id:"):
            continue
        art_match = re.search(r"art: \{ idle: (\w+) \}", line)
        if not art_match:
            raise RuntimeError(f"Missing art reference: {line}")
        source_name = imports[art_match.group(1)]
        skin_id = quoted(line, "id")
        unlock_source = quoted(line, "unlockSource")
        if not skin_id or not unlock_source:
            raise RuntimeError(f"Invalid skin entry: {line}")
        name = quoted(line, "name")
        description = quoted(line, "description")
        if skin_id == "boy-default":
            name, description = "日常轻装", "轻便、柔和的日常装束。"
        elif skin_id == "girl-default":
            name = "初见斗篷"
        elif skin_id == "rabbit-default":
            name, description = "初见长耳装", "为长耳朵留出舒适位置的日常装束。"
        preserve_ids = {
            "boy-default", "boy-raincoat", "boy-starry",
            "girl-default", "girl-forest", "girl-exchange-01",
            "rabbit-default", "rabbit-courier",
            "mystery-default", "mystery-exchange-01",
        }
        entries.append(
            {
                "id": skin_id,
                "companionId": quoted(line, "characterId"),
                "name": name,
                "description": description,
                "color": quoted(line, "color"),
                "accent": quoted(line, "accent"),
                "sourceFile": source_name,
                "assetFile": f"{skin_id}.webp",
                "thumbnailFile": f"{skin_id}.webp",
                "legacyUnlockSource": unlock_source,
                "unlockType": "hidden-code" if unlock_source == "code" else "initial",
                "identityMode": "preserve" if skin_id in preserve_ids else "roleplay",
                "renderMode": "backdrop" if skin_id == "mystery-code-moon-tide" else "transparent",
            }
        )
    return entries


def parse_cheat_codes() -> dict[str, dict[str, str]]:
    text = CHEAT_CONFIG.read_text(encoding="utf-8")
    section = text.split("const SKIN_CHEAT_CODES: SkinCheatCode[] = [", 1)[1].split("];", 1)[0]
    result: dict[str, dict[str, str]] = {}
    for block in re.findall(r"\{(.*?)\}", section, flags=re.DOTALL):
        skin_id = quoted(block, "skinId")
        if not skin_id:
            continue
        result[skin_id] = {
            "id": quoted(block, "id") or skin_id,
            "code": quoted(block, "code") or "",
            "badge": quoted(block, "badge") or "暗",
            "unlockedMessage": quoted(block, "unlockedMessage") or "隐藏外观已解锁。",
            "activatedMessage": quoted(block, "activatedMessage") or "隐藏外观已切换。",
        }
    return result


def fit_on_canvas(source: Image.Image) -> Image.Image:
    image = source.convert("RGBA")
    scale = min(CANVAS[0] / image.width, CANVAS[1] / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    resized = image.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    x = (CANVAS[0] - size[0]) // 2
    y = CANVAS[1] - size[1]
    canvas.alpha_composite(resized, (x, y))
    return canvas


def write_assets(entries: list[dict[str, object]]) -> None:
    OUTPUT_ART.mkdir(parents=True, exist_ok=True)
    OUTPUT_THUMBS.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        source_path = SOURCE_ART / str(entry["sourceFile"])
        with Image.open(source_path) as source:
            runtime = fit_on_canvas(source)
        runtime.save(
            OUTPUT_ART / str(entry["assetFile"]),
            format="WEBP",
            quality=90,
            method=6,
            exact=True,
        )
        thumbnail = runtime.resize(THUMBNAIL, Image.Resampling.LANCZOS)
        thumbnail.save(
            OUTPUT_THUMBS / str(entry["thumbnailFile"]),
            format="WEBP",
            quality=84,
            method=6,
            exact=True,
        )


def main() -> None:
    entries = parse_game_config()
    codes = parse_cheat_codes()
    for entry in entries:
        if entry["unlockType"] == "hidden-code":
            code = codes.get(str(entry["id"]))
            if not code:
                raise RuntimeError(f"Missing code for {entry['id']}")
            entry["unlock"] = {"type": "hidden-code", "codeId": code["id"]}
            entry["cheatCode"] = code
        else:
            entry["unlock"] = {"type": "initial"}

    if len(entries) != 61:
        raise RuntimeError(f"Expected 61 appearances, found {len(entries)}")
    if "--manifest-only" not in sys.argv:
        write_assets(entries)
    runtime_entries = []
    for entry in entries:
        runtime_entries.append({key: value for key, value in entry.items() if key not in {
            "sourceFile", "legacyUnlockSource", "unlockType"
        }})
    OUTPUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_MANIFEST.write_text(
        json.dumps({"version": 1, "appearances": runtime_entries}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    OUTPUT_AUDIT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_AUDIT.write_text(
        json.dumps({
            "version": 1,
            "sourceProject": "travel-collection",
            "policy": {
                "initial": "旧默认、旅行、地图和兑换外观改为直接可用，不迁移旧玩法条件。",
                "hidden-code": "旧暗号外观继续通过隐藏内容解锁系统提供。",
                "identity": "基础换装标记 preserve；职业、物种或身份变化标记 roleplay 并应用人格覆写。",
                "moon-tide": "原图没有透明通道，保留为 backdrop 模式。",
            },
            "appearances": entries,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Migrated {len(entries)} appearances ({len(codes)} hidden codes).")


if __name__ == "__main__":
    main()
