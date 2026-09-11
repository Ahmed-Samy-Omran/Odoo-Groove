"""Builds the store-ready ZIP (manifest + _locales + src)."""

import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(ROOT, "dist")

INCLUDE_DIRS = ["_locales", "src"]
INCLUDE_FILES = ["manifest.json"]


def collect():
    paths = []
    for name in INCLUDE_FILES:
        paths.append((name, os.path.join(ROOT, name)))
    for directory in INCLUDE_DIRS:
        base = os.path.join(ROOT, directory)
        for root, _, files in os.walk(base):
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, ROOT)
                paths.append((rel.replace(os.sep, "/"), full))
    return paths


def main():
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as fh:
        version = json.load(fh)["version"]
    os.makedirs(DIST_DIR, exist_ok=True)
    out = os.path.join(DIST_DIR, f"odoo-groove-{version}.zip")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for arcname, full in sorted(collect()):
            zf.write(full, arcname)
    print("wrote", out)


if __name__ == "__main__":
    main()