/**
 * url-state.js
 * Pure, dependency-free Odoo debug-mode URL engine.
 * Works in the extension (Chrome/Edge MV3), in a plain browser,
 * and is mirrored by tests/python/url_state_spec.py.
 */

export const MODES = Object.freeze({
  normal: '1',
  off: '0',
  assets: 'assets',
  tests: 'tests',
});

// Human-facing mode keys, not Odoo query values.
export const MODE_KEYS = Object.freeze(Object.keys(MODES));

const ODOO_PATH_PREFIXES = Object.freeze([
  '/web',
  '/odoo',
  '/my',
  '/website',
  '/shop',
  '/event',
  '/contacts',
  '/forum',
  '/blog',
]);

export function parseUrl(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function isSupportedUrl(raw) {
  const url = parseUrl(raw);
  if (!url) return false;
  return url.protocol === 'http:' || url.protocol === 'https:';
}

/**
 * Returns the decoded `debug` query value, or null when absent.
 * An empty/blank string is treated as off.
 */
export function getDebugMode(raw) {
  if (!isSupportedUrl(raw)) return null;
  const url = parseUrl(raw);
  const value = url.searchParams.get('debug');
  if (value === null) return null;
  return value.trim() === '' ? '0' : value;
}

export function isOdooLike(raw) {
  if (!isSupportedUrl(raw)) return false;
  const url = parseUrl(raw);
  const host = url.hostname.toLowerCase();
  if (host.includes('odoo')) return true;
  const path = url.pathname;
  return ODOO_PATH_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

export const PAGE_STATES = Object.freeze(['on', 'off', 'assets', 'tests', 'unknown', 'unsupported']);

function debugValueToState(value) {
  // value is a normalized (already trimmed) debug query value, or null.
  if (value === null) return null;
  switch (value) {
    case 'assets':
    case 'tests':
      return value;
    case '0':
    case '':
      return 'off';
    default:
      // '1', 'true', 'TRUE', anything truthy -> on.
      return 'on';
  }
}

/**
 * Classifies a page without any side effects.
 * Returns { supported, debugMode, odooLike, state }.
 */
export function readPageState(raw) {
  if (!isSupportedUrl(raw)) {
    return { supported: false, debugMode: null, odooLike: false, state: 'unsupported' };
  }
  const debugMode = getDebugMode(raw);
  const odooLike = isOdooLike(raw);
  const fromParam = debugValueToState(debugMode);
  let state;
  if (fromParam !== null) {
    state = fromParam;
  } else if (odooLike) {
    state = 'off';
  } else {
    state = 'unknown';
  }
  return { supported: true, debugMode, odooLike, state };
}

/** Maps a human mode key ('normal'|'off'|'assets'|'tests') to an Odoo query value. */
export function modeToQueryValue(mode) {
  return Object.prototype.hasOwnProperty.call(MODES, mode) ? MODES[mode] : MODES.normal;
}

/**
 * Builds the next URL, preserving pathname, existing query params and hash.
 * `target` is an Odoo query value: '1' | '0' | 'assets' | 'tests'.
 * Unsupported schemes (chrome://, file://, javascript:, ...) are returned
 * unchanged — they must never be modified.
 */
export function buildToggleUrl(raw, target) {
  if (!isSupportedUrl(raw)) return raw;
  const url = parseUrl(raw);
  url.searchParams.set('debug', String(target));
  return url.href;
}

/**
 * Decides the target query value for the primary toggle.
 * If debug is on (in any mode) we turn it off. Otherwise we turn it on
 * using `panelMode` (a human mode key) — except when the panel selected
 * 'off', in which case we force debug off.
 */
export function getToggleAction(raw, panelMode) {
  const { state } = readPageState(raw);
  if (state === 'on' || state === 'assets' || state === 'tests') return MODES.off;
  if (panelMode === 'off') return MODES.off;
  return modeToQueryValue(panelMode);
}