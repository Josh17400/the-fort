#!/usr/bin/env python3
"""Render the app icon and launch splash from art.html into the PNGs @capacitor/assets reads.

  icon-only.png     1024x1024, no alpha (App Store rejects an icon with transparency)
  splash.png        2732x2732
  splash-dark.png   2732x2732 (the game is dark-only, so the same art)

Needs Microsoft Edge (or set BROWSER to a Chromium binary). One headless browser, about 5 s.
Then, from native/:   npx capacitor-assets generate --ios
"""

import base64
import html
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
PAGE = HERE / "art.html"
CANDIDATES = (
    os.environ.get("BROWSER", ""),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
)


def browser() -> str:
    for c in CANDIDATES:
        if c and Path(c).is_file():
            return c
    for name in ("msedge", "google-chrome", "chromium"):
        found = shutil.which(name)
        if found:
            return found
    sys.exit("error: no Edge/Chromium found; set BROWSER to one")


def main() -> None:
    profile = tempfile.mkdtemp(prefix="fort_art_")
    try:
        dom = subprocess.run(
            [browser(), "--headless=new", "--user-data-dir=" + profile, "--allow-file-access-from-files",
             "--virtual-time-budget=15000", "--dump-dom", PAGE.as_uri()],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120).stdout
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    title = re.search(r"<title>(.*?)</title>", dom, re.S)
    if not title or title.group(1) != "ART READY":
        sys.exit("error: art.html did not render: " + (title.group(1) if title else "no page"))
    data = json.loads(html.unescape(re.search(r'<pre id="out">(.*?)</pre>', dom, re.S).group(1)))

    def png(key: str) -> Image.Image:
        raw = base64.b64decode(data[key].split(",", 1)[1])
        return Image.open(io.BytesIO(raw)).convert("RGB")

    outputs = {"icon-only.png": png("icon"), "splash.png": png("splash")}
    outputs["splash-dark.png"] = outputs["splash.png"]
    for name, img in outputs.items():
        img.save(HERE / name, optimize=True)
        print(f"wrote {name} {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
