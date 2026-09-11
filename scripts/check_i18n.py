"""Verifies locale parity for the extension's _locales.

Checks that every `en` message key exists in every other locale, that message
names are valid Chrome i18n keys, and that placeholders used inside message
text match each locale's declared placeholders.

Usage: python3 scripts/check_i18n.py
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCALES_DIR = os.path.join(ROOT, "_locales")

KEY_RE = re.compile(r"^[A-Za-z0-9_]+$")
PLACEHOLDER_RE = re.compile(r"__[A-Za-z0-9_]+__")


def load(locale):
    path = os.path.join(LOCALES_DIR, locale, "messages.json")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def main():
    locales = sorted(os.listdir(LOCALES_DIR))
    if not locales:
        print("no locales found under _locales/")
        sys.exit(1)

    messages = {loc: load(loc) for loc in locales}
    base_locale, base = messages[locales[0]], messages[locales[0]]
    problems = []

    for key in base:
        if not KEY_RE.match(key):
            problems.append(f"invalid key name: {key!r}")

    for key in base:
        for loc, msgs in messages.items():
            if key not in msgs:
                problems.append(f"key {key!r} missing in {loc}")

    for loc, msgs in messages.items():
        for key, msg in msgs.items():
            if key not in base:
                problems.append(f"key {key!r} in {loc} is not in {base_locale}")
                continue
            base_msg = base[key].get("message", "")
            if base_msg and "message" not in msg:
                problems.append(f"key {key!r} in {loc} missing 'message'")

    for loc, msgs in messages.items():
        for key, msg in msgs.items():
            text = msg.get("message", "")
            used = set(PLACEHOLDER_RE.findall(text))
            declared = set(msg.get("placeholders", {}).keys())
            declared_tokens = {f"__{p}__" for p in declared}
            if used != declared_tokens:
                problems.append(
                    f"key {key!r} in {loc}: text uses {sorted(used)} but "
                    f"declares {sorted(declared_tokens)}"
                )
            for pname in declared:
                if not KEY_RE.match(pname):
                    problems.append(f"key {key!r} in {loc}: bad placeholder {pname!r}")

    if problems:
        print(f"{len(problems)} i18n problem(s):")
        for p in problems:
            print(" -", p)
        sys.exit(1)

    print(f"OK: {len(locales)} locale(s), {len(base)} key(s), all in sync.")


if __name__ == "__main__":
    main()