"""Runs tests/fixtures.json against the url_state spec mirror.

Usage: python3 tests/run.py
Exits non-zero on any failure.
"""

import json
import os
import sys

from python.url_state_spec import (
    build_toggle_url,
    get_debug_mode,
    get_toggle_action,
    is_odoo_like,
    is_supported_url,
    read_page_state,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def parse_result(url):
    """Compare semantics (decoded query, path, hash) across implementations."""
    from urllib.parse import parse_qsl, urlsplit

    split = urlsplit(url)
    params = dict(parse_qsl(split.query, keep_blank_values=True))
    return {
        "query": params,
        "path": split.path,
        "hash": split.fragment,
    }


def main():
    with open(os.path.join(ROOT, "tests", "fixtures.json"), encoding="utf-8") as fh:
        fixtures = json.load(fh)

    failures = 0
    total = 0

    def check(name, got, expect):
        nonlocal failures, total
        total += 1
        if got != expect:
            failures += 1
            print(f"  FAIL {name}\n    got:      {got!r}\n    expected: {expect!r}")

    for case in fixtures["state"]:
        raw = case["url"]
        check(case["name"] + " (supported)", is_supported_url(raw), case["expect"]["supported"])
        check(case["name"] + " (debugMode)", get_debug_mode(raw), case["expect"]["debugMode"])
        check(case["name"] + " (odooLike)", is_odoo_like(raw), case["expect"]["odooLike"])
        check(case["name"] + " (state)", read_page_state(raw)["state"], case["expect"]["state"])

    for case in fixtures["build"]:
        result_url = build_toggle_url(case["url"], case["target"])
        if case.get("expectPassthrough"):
            check(case["name"] + " (passthrough)", result_url, case["url"])
            continue
        result = parse_result(result_url)
        expect = case["expect"]
        check(case["name"] + " (debug)", result["query"].get("debug"), expect["debug"])
        check(case["name"] + " (path)", result["path"], expect["pathname"])
        check(case["name"] + " (hash)", "#" + result["hash"] if result["hash"] else "", expect["hash"])
        others = sorted(list(item) for item in result["query"].items() if item[0] != "debug")
        check(case["name"] + " (other params)", others, sorted(expect["otherParams"]))

    for case in fixtures["toggle"]:
        check(case["name"], get_toggle_action(case["url"], case["panelMode"]), case["expect"])

    print(f"\nurl-state spec: {total - failures}/{total} checks passed")
    if failures:
        print(f"{failures} failures")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())