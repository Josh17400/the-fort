#!/usr/bin/env python3
"""Run test_plat.js: the game's Plat seam against a scripted window.Shell, in one headless Edge.

Builds a throwaway page from ../index.html with test_plat.js injected right after <head> (where
build_www.py injects shell.js), loads it with --dump-dom and prints the page title, which holds the
result. Exit status 1 on any failure. Local only (the CI runner runs test_shell.cjs and the checks).

Run:  python native/test_plat.py        (BROWSER=<path> to use another Chromium)
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

NATIVE = Path(__file__).resolve().parent
sys.path.insert(0, str(NATIVE / "assets"))
from render_art import browser  # noqa: E402  (same Edge/Chromium lookup)


def main() -> None:
    html = (NATIVE.parent / "index.html").read_text(encoding="utf-8")
    test = (NATIVE / "test_plat.js").read_text(encoding="utf-8")
    if html.count("<head>") != 1:
        sys.exit("error: index.html must contain exactly one <head>")
    page = html.replace("<head>", "<head><script>" + test + "</script>", 1)
    work = Path(tempfile.mkdtemp(prefix="fort_plat_"))
    try:
        f = work / "plat.html"
        f.write_text(page, encoding="utf-8")
        out = subprocess.run(
            [browser(), "--headless=new", "--user-data-dir=" + str(work / "profile"), "--autoplay-policy=no-user-gesture-required",
             "--virtual-time-budget=20000", "--dump-dom", f.as_uri()],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=140).stdout
    finally:
        shutil.rmtree(work, ignore_errors=True)
    m = re.search(r"<title>(.*?)</title>", out, re.S)
    title = m.group(1) if m else "NO TITLE"
    print(title)
    sys.exit(0 if re.match(r"PLAT pass=\d+ fail=0$", title) else 1)


if __name__ == "__main__":
    main()
