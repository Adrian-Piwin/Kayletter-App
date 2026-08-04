"""Download completed PixelLab jobs listed in assets/pixellab/jobs.json.

    python3 scripts/pig/download_clips.py

Writes raw generated frames only. derive.py poses them into clips/, which is
what the atlas is built from — so a re-download never loses the posing.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JOBS = ROOT / "assets" / "pixellab" / "jobs.json"
CLIPS_DIR = ROOT / "assets" / "pixellab" / "raw"


def download_job(name: str, job_id: str, skip_input: bool) -> int:
    """Fetch all frames for a job. Returns count of frames kept for the clip."""
    out = CLIPS_DIR / name
    out.mkdir(parents=True, exist_ok=True)

    # Probe how many frames exist by fetching until 404.
    kept = 0
    idx = 0
    while True:
        url = f"https://api.pixellab.ai/mcp/images/{job_id}/download?index={idx}"
        dest = out / f"frame-{idx:02d}.png"
        try:
            urllib.request.urlretrieve(url, dest)
        except Exception:
            break
        idx += 1

    files = sorted(out.glob("frame-*.png"))
    if not files:
        return 0

    if skip_input and len(files) > 1:
        # Index 0 is the unchanged input pose — drop it for walk-style loops.
        files[0].unlink(missing_ok=True)
        files = files[1:]
        # Renumber so the atlas builder always sees frame-00…
        for i, f in enumerate(files):
            target = out / f"frame-{i:02d}.png"
            if f != target:
                f.rename(target)
        kept = len(list(out.glob("frame-*.png")))
    else:
        kept = len(files)
    return kept


def main() -> None:
    data = json.loads(JOBS.read_text())
    clips = data["clips"]
    for name, meta in clips.items():
        # Composed clips are built by derive.py out of the idle pose and face
        # patches — there is no generation to fetch.
        if meta.get("source") == "composed":
            continue
        if meta.get("status") == "downloaded" and (CLIPS_DIR / name).exists():
            # Ensure walk (already on disk under docs/) is copied once.
            if name == "walk":
                src = ROOT / meta.get("dir", "")
                dest = CLIPS_DIR / "walk"
                if src.exists() and not dest.exists():
                    dest.mkdir(parents=True, exist_ok=True)
                    # walk was saved with input frame; skip it
                    frames = sorted(src.glob("frame-*.png"))
                    start = 1 if meta.get("skip_input") and len(frames) > 1 else 0
                    for i, f in enumerate(frames[start:]):
                        (dest / f"frame-{i:02d}.png").write_bytes(f.read_bytes())
                    print(f"{name}: copied {len(frames) - start} from {src}")
            else:
                n = len(list((CLIPS_DIR / name).glob("frame-*.png")))
                print(f"{name}: already downloaded ({n} frames)")
            continue

        job_id = meta.get("job_id")
        if not job_id:
            print(f"{name}: no job_id", file=sys.stderr)
            continue

        # Status check via download of index 0
        url0 = f"https://api.pixellab.ai/mcp/images/{job_id}/download?index=0"
        try:
            urllib.request.urlopen(url0, timeout=30)
        except Exception as e:
            print(f"{name}: not ready ({e})")
            continue

        n = download_job(name, job_id, bool(meta.get("skip_input")))
        meta["status"] = "downloaded"
        meta["downloaded_frames"] = n
        print(f"{name}: downloaded {n} frames → {CLIPS_DIR / name}")

    JOBS.write_text(json.dumps(data, indent=2) + "\n")


if __name__ == "__main__":
    main()
