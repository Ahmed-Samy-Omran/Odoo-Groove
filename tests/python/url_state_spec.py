"""Exact Python mirror of src/url-state.js.

Kept in the same crate so the URL algorithm can be validated in CI
environments without Node. The two implementations must stay in sync;
the fixtures in tests/fixtures.json are shared with the browser test page.
"""

from urllib.parse import urlsplit

MODES = {
    "normal": "1",
    "off": "0",
    "assets": "assets",
    "tests": "tests",
}

ODOO_PATH_PREFIXES = (
    "/web",
    "/odoo",
    "/my",
    "/website",
    "/shop",
    "/event",
    "/contacts",
    "/forum",
    "/blog",
)


def _parse(raw):
    if not isinstance(raw, str) or len(raw) == 0:
        return None
    try:
        split = urlsplit(raw)
    except ValueError:
        return None
    if not split.scheme or not split.netloc:
        return None
    return {
        "scheme": split.scheme,
        "netloc": split.netloc,
        "hostname": (split.hostname or "").lower(),
        "pathname": split.path or "/",
        "query": split.query,
        "fragment": split.fragment,
    }


def is_supported_url(raw):
    parsed = _parse(raw)
    if not parsed:
        return False
    return parsed["scheme"] in ("http", "https")


def get_debug_mode(raw):
    if not is_supported_url(raw):
        return None
    parsed = _parse(raw)
    query = parsed["query"]
    if not query:
        return None
    for part in query.split("&"):
        if not part:
            continue
        key = part.split("=", 1)[0]
        if key == "debug":
            value = part.split("=", 1)[1] if "=" in part else "0"
            value = value.replace("+", " ")
            try:
                from urllib.parse import unquote

                value = unquote(value)
            except Exception:
                pass
            value = value.strip()
            return "0" if value == "" else value
    return None


def is_odoo_like(raw):
    if not is_supported_url(raw):
        return False
    parsed = _parse(raw)
    if "odoo" in parsed["hostname"]:
        return True
    path = parsed["pathname"]
    return any(path == p or path.startswith(p + "/") for p in ODOO_PATH_PREFIXES)


def _debug_value_to_state(value):
    if value is None:
        return None
    if value in ("assets", "tests"):
        return value
    if value in ("0", ""):
        return "off"
    return "on"


def read_page_state(raw):
    if not is_supported_url(raw):
        return {"supported": False, "debugMode": None, "odooLike": False, "state": "unsupported"}
    debug_mode = get_debug_mode(raw)
    odoo_like = is_odoo_like(raw)
    from_param = _debug_value_to_state(debug_mode)
    if from_param is not None:
        state = from_param
    elif odoo_like:
        state = "off"
    else:
        state = "unknown"
    return {"supported": True, "debugMode": debug_mode, "odooLike": odoo_like, "state": state}


def mode_to_query_value(mode):
    return MODES.get(mode, MODES["normal"])


def build_toggle_url(raw, target):
    if not is_supported_url(raw):
        return raw
    parsed = _parse(raw)
    target = str(target)
    query = parsed["query"]
    parts = query.split("&") if query else []
    replaced = False
    new_parts = []
    for part in parts:
        if not part:
            continue
        key = part.split("=", 1)[0]
        if key == "debug":
            if not replaced:
                new_parts.append("debug=" + target)
                replaced = True
            continue
        new_parts.append(part)
    if not replaced:
        new_parts.append("debug=" + target)
    new_query = "&".join(new_parts)
    scheme = parsed["scheme"] + "://"
    netloc = parsed["netloc"]
    path = parsed["pathname"]
    fragment = parsed["fragment"]
    url = scheme + netloc + path
    if new_query:
        url += "?" + new_query
    if fragment:
        url += "#" + fragment
    return url


def get_toggle_action(raw, panel_mode):
    state = read_page_state(raw)["state"]
    if state in ("on", "assets", "tests"):
        return MODES["off"]
    if panel_mode == "off":
        return MODES["off"]
    return mode_to_query_value(panel_mode)