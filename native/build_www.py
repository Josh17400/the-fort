#!/usr/bin/env python3
"""Rebuild native/www from ../index.html (the game), shell.js, the Capacitor runtime and the bundled fonts.

www/index.html is the game with three changes, nothing else:
  1. right after <head>: the build stamp (window.FORT_BUILD / FORT_VERSION), capacitor.js and shell.js,
     so window.Shell exists before the game's first script runs and Plat takes its native branch;
  2. the fonts.googleapis.com stylesheet swapped for fonts/fonts.css (the app must render offline);
  3. nothing is minified or reordered, so a device bug maps 1:1 onto the repo's index.html.

It also refuses to build when the AdMob app id in index.html (PLAT_IDS.admobApp) differs from
GADApplicationIdentifier in ios/App/App/Info.plist, and reports every PLACEHOLDER id still in PLAT_IDS.
With --release a placeholder is an error instead of a warning.

Run before every `npx cap sync ios`:   python build_www.py [--release]
Env: BUILD_NUMBER (CI: the GitHub run number) is stamped into the page for the Settings build line.
"""

import argparse
import os
import plistlib
import re
import shutil
import sys
from pathlib import Path

NATIVE = Path(__file__).resolve().parent
ROOT = NATIVE.parent
GAME = ROOT / "index.html"
SHELL = NATIVE / "shell.js"
FONTS = NATIVE / "fonts"
# registerPlugin comes from this runtime, not the injected bridge; without it every plugin lookup
# in shell.js fails and ads, the store and the save mirror silently no-op on device.
CAP_RUNTIME = NATIVE / "node_modules" / "@capacitor" / "core" / "dist" / "capacitor.js"
INFO_PLIST = NATIVE / "ios" / "App" / "App" / "Info.plist"
PBXPROJ = NATIVE / "ios" / "App" / "App.xcodeproj" / "project.pbxproj"
# Files next to index.html that the page loads by relative path.
ROOT_FILES = ("apple-touch-icon.png",)
WWW = NATIVE / "www"
MARKER = "<head>"
INJECTED = ('src="capacitor.js"', 'src="shell.js"', "window.FORT_BUILD")
GOOGLE_FONTS = re.compile(
    r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\s*'
    r'<link href="https://fonts\.googleapis\.com/css2\?[^"]*" rel="stylesheet">')
LOCAL_FONTS = '<link rel="stylesheet" href="fonts/fonts.css">'

# Google's published iOS test ids: fine for TestFlight, never for the App Store.
TEST_ADMOB = "ca-app-pub-3940256099942544"


def fail(msg: str) -> None:
    sys.exit("error: " + msg)


def warn(msg: str) -> None:
    # GitHub Actions turns this into an annotation on the run; locally it is a plain line.
    print(("::warning::" if os.environ.get("GITHUB_ACTIONS") else "warning: ") + msg)


def plat_ids(html: str) -> dict:
    m = re.search(r"const PLAT_IDS=\{(.*?)\n\};", html, re.S)
    if not m:
        fail("const PLAT_IDS={...}; not found in index.html")
    ids = dict(re.findall(r"^\s*(\w+):'([^']*)'", m.group(1), re.M))
    for key in ("admobApp", "rewarded", "interstitial", "rcKey", "lbDaily"):
        if key not in ids:
            fail(f"PLAT_IDS.{key} not found in index.html")
    return ids


def marketing_version() -> str:
    if not PBXPROJ.is_file():
        return ""
    versions = set(re.findall(r"MARKETING_VERSION = ([0-9.]+);", PBXPROJ.read_text(encoding="utf-8")))
    if len(versions) > 1:
        fail(f"{PBXPROJ} has different MARKETING_VERSION values for Debug and Release: {sorted(versions)}")
    return versions.pop() if versions else ""


def check_ids(ids: dict, release: bool) -> None:
    if INFO_PLIST.is_file():
        with INFO_PLIST.open("rb") as f:
            plist_app = plistlib.load(f).get("GADApplicationIdentifier", "")
        if plist_app != ids["admobApp"]:
            fail(f"AdMob app id mismatch: index.html PLAT_IDS.admobApp is {ids['admobApp']!r} but "
                 f"{INFO_PLIST.relative_to(NATIVE).as_posix()} GADApplicationIdentifier is {plist_app!r}. Set both to the same id.")
    placeholders = []
    for key in ("admobApp", "rewarded", "interstitial"):
        if ids[key].startswith(TEST_ADMOB):
            placeholders.append(f"PLAT_IDS.{key} is Google's test id (the app shows test ads)")
    if not ids["rcKey"]:
        placeholders.append("PLAT_IDS.rcKey is empty (the gem shop sells nothing)")
    elif not ids["rcKey"].startswith("appl_"):
        fail(f"PLAT_IDS.rcKey {ids['rcKey']!r} is not a RevenueCat App Store public key (appl_...)")
    if not ids["lbDaily"]:
        placeholders.append("PLAT_IDS.lbDaily is empty (no Game Center leaderboard)")
    # Game Center is optional: an empty leaderboard id never blocks a release.
    blocking = [p for p in placeholders if release and "lbDaily" not in p]
    for p in placeholders:
        if p not in blocking:
            warn("PLACEHOLDER: " + p)
    if blocking:
        fail("--release with placeholder ids still in index.html PLAT_IDS:\n  " + "\n  ".join(blocking))


def validate() -> str:
    for f, hint in ((GAME, ""), (SHELL, ""), (CAP_RUNTIME, "run npm ci in native/"), (FONTS / "fonts.css", "")):
        if not f.is_file():
            fail(f"not found: {f}" + (f" ({hint})" if hint else ""))
    for name in ROOT_FILES:
        if not (ROOT / name).is_file():
            fail(f"not found: {ROOT / name}")
    html = GAME.read_text(encoding="utf-8")
    if html.count(MARKER) != 1:
        fail(f"{GAME} must contain exactly one {MARKER!r}, found {html.count(MARKER)}")
    if any(s in html for s in INJECTED):
        fail(f"{GAME} already loads capacitor.js / shell.js or sets FORT_BUILD - refusing to double-inject")
    if len(GOOGLE_FONTS.findall(html)) != 1:
        fail("the Google Fonts <link> pair in index.html changed; update GOOGLE_FONTS in build_www.py and fonts/fonts.css")
    return html


def stamp_tag() -> str:
    bn = os.environ.get("BUILD_NUMBER", "").strip()
    ver = marketing_version()
    parts = []
    if bn.isdigit():
        parts.append(f'window.FORT_BUILD="{bn}";')
    if ver:
        parts.append(f'window.FORT_VERSION="{ver}";')
    return "<script>" + "".join(parts) + "</script>" if parts else ""


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--release", action="store_true", help="fail on any PLACEHOLDER id (App Store builds)")
    args = ap.parse_args()

    html = validate()
    check_ids(plat_ids(html), args.release)

    inject = MARKER + stamp_tag() + '\n<script src="capacitor.js"></script>\n<script src="shell.js"></script>'
    html = html.replace(MARKER, inject, 1)
    html = GOOGLE_FONTS.sub(LOCAL_FONTS, html, count=1)

    if WWW.exists():
        shutil.rmtree(WWW)
    WWW.mkdir()
    out = WWW / "index.html"
    # Git may check index.html out with CRLF on Windows; the app always gets LF.
    out.write_text(html.replace("\r\n", "\n"), encoding="utf-8", newline="\n")
    shutil.copyfile(SHELL, WWW / "shell.js")
    shutil.copyfile(CAP_RUNTIME, WWW / "capacitor.js")
    shutil.copytree(FONTS, WWW / "fonts", ignore=shutil.ignore_patterns("*.md"))
    for name in ROOT_FILES:
        shutil.copyfile(ROOT / name, WWW / name)

    for f in sorted(p for p in WWW.rglob("*") if p.is_file()):
        print(f"wrote {f.relative_to(NATIVE).as_posix()} ({f.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
