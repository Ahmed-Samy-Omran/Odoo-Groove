/**
 * Real-JavaScript tests for src/url-state.js.
 * Run: node --test tests/js/
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildToggleUrl,
  getDebugMode,
  getToggleAction,
  isOdooLike,
  isSupportedUrl,
  readPageState,
  modeToQueryValue,
} from '../../src/url-state.js';

const fixtures = JSON.parse(
  readFileSync(new URL('../fixtures.json', import.meta.url), 'utf8')
);

function parseResult(url) {
  const u = new URL(url);
  const others = [...u.searchParams.entries()]
    .filter(([k]) => k !== 'debug')
    .map(([k, v]) => [k, v])
    .sort();
  return { query: Object.fromEntries(u.searchParams), path: u.pathname, hash: u.hash, others };
}

test('fixtures: state detection', () => {
  for (const c of fixtures.state) {
    assert.equal(isSupportedUrl(c.url), c.expect.supported, `${c.name}: supported`);
    assert.equal(getDebugMode(c.url), c.expect.debugMode, `${c.name}: debugMode`);
    assert.equal(isOdooLike(c.url), c.expect.odooLike, `${c.name}: odooLike`);
    assert.equal(readPageState(c.url).state, c.expect.state, `${c.name}: state`);
  }
});

test('fixtures: build toggle url', () => {
  for (const c of fixtures.build) {
    const built = buildToggleUrl(c.url, c.target);
    if (c.expectPassthrough) {
      assert.equal(built, c.url, `${c.name}: passthrough`);
      continue;
    }
    const r = parseResult(built);
    assert.equal(r.query.debug, c.expect.debug, `${c.name}: debug`);
    assert.equal(r.path, c.expect.pathname, `${c.name}: path`);
    assert.equal(r.hash, c.expect.hash, `${c.name}: hash`);
    assert.deepEqual(r.others, c.expect.otherParams, `${c.name}: other params`);
  }
});

test('fixtures: toggle decision', () => {
  for (const c of fixtures.toggle) {
    assert.equal(getToggleAction(c.url, c.panelMode), c.expect, c.name);
  }
});

test('scenario: no debug -> off, build on keeps everything', () => {
  const url = 'https://example.com/odoo';
  assert.deepEqual(readPageState(url), {
    supported: true,
    debugMode: null,
    odooLike: true,
    state: 'off',
  });
  const r = parseResult(buildToggleUrl(url, '1'));
  assert.equal(r.query.debug, '1');
  assert.equal(r.path, '/odoo');
  assert.equal(r.hash, '');
});

test('scenario: debug=1 -> on; off restores path/hash', () => {
  assert.equal(readPageState('https://example.com/odoo?debug=1').state, 'on');
  const r = parseResult(buildToggleUrl('https://example.com/odoo?debug=1', '0'));
  assert.equal(r.query.debug, '0');
  assert.equal(r.path, '/odoo');
});

test('scenario: debug=0 -> off', () => {
  assert.equal(readPageState('https://example.com/odoo?debug=0').state, 'off');
});

test('scenario: debug=assets -> assets', () => {
  assert.equal(readPageState('https://example.com/odoo?debug=assets').state, 'assets');
});

test('scenario: other query params preserved', () => {
  const url = 'https://example.com/odoo?foo=bar&lang=ar';
  assert.equal(readPageState(url).state, 'off');
  const r = parseResult(buildToggleUrl(url, '1'));
  assert.equal(r.query.debug, '1');
  assert.deepEqual(r.others.sort(), [['foo', 'bar'], ['lang', 'ar']].sort());
});

test('scenario: hash preserved', () => {
  const url = 'https://example.com/odoo?debug=1#action=123';
  assert.equal(readPageState(url).state, 'on');
  const r = parseResult(buildToggleUrl(url, '0'));
  assert.equal(r.hash, '#action=123');
  assert.equal(r.query.debug, '0');
});

test('scenario: Odoo Online', () => {
  assert.equal(readPageState('https://acme.odoo.com/web').odooLike, true);
  assert.equal(readPageState('https://branch-pr-7.staging.odoo.sh/odooxx/web').odooLike, true);
});

test('scenario: internal domain', () => {
  assert.equal(readPageState('http://odoo:8069/odoo').state, 'off');
  assert.equal(readPageState('http://10.0.0.5:8069/web').state, 'off');
});

test('scenario: login page', () => {
  const url = 'https://example.com/odoo/web/login';
  assert.equal(readPageState(url).state, 'off');
  assert.equal(readPageState(url).odooLike, true);
});

test('scenario: non-Odoo page', () => {
  assert.equal(readPageState('https://news.yahoo.com/tech/article').state, 'unknown');
});

test('unsupported + invalid URLs never crash', () => {
  for (const bad of ['chrome://extensions/', 'edge://settings/privacy', 'file:///tmp/a.html',
    'about:blank', '', 'not a url', 'https://', 'javascript:void(0)', 'ht tp://x.com']) {
    assert.equal(isSupportedUrl(bad), false, `supported ${bad}`);
    assert.equal(readPageState(bad).state, 'unsupported', `state ${bad}`);
    assert.equal(buildToggleUrl(bad, '1'), bad, `build passthrough ${bad}`);
  }
});

test('bare ?debug behaves like off', () => {
  assert.equal(getDebugMode('https://example.com/odoo?debug'), '0');
  assert.equal(readPageState('https://example.com/odoo?debug').state, 'off');
});

test('duplicate debug params: first one wins and set dedups', () => {
  const url = 'https://example.com/odoo?debug=1&x=1&debug=0';
  assert.equal(getDebugMode(url), '1');
  const r = parseResult(buildToggleUrl(url, 'tests'));
  assert.equal(r.query.debug, 'tests');
  assert.deepEqual(r.others, [['x', '1']]);
});

test('rebuilt url remains parseable and computes state', () => {
  const urls = [
    'https://example.com/odoo/web?foo=bar#action=1',
    'https://example.com/odoo?debug=assets&utm_source=x',
    'https://shop.example.com/shop/category/2',
    'http://odoo:8069/web?debug=0#menu_id=1',
  ];
  for (const url of urls) {
    const rebuilt = buildToggleUrl(url, '1');
    const state = readPageState(rebuilt).state;
    assert.equal(state, 'on');
    assert.ok(rebuilt.startsWith('http'));
  }
});

test('modeToQueryValue defaults to normal for unknown modes', () => {
  assert.equal(modeToQueryValue('normal'), '1');
  assert.equal(modeToQueryValue('off'), '0');
  assert.equal(modeToQueryValue('assets'), 'assets');
  assert.equal(modeToQueryValue('tests'), 'tests');
  assert.equal(modeToQueryValue('bogus'), '1');
});

test('toggle round-trip: on then off preserves path/hash/other params', () => {
  const start = 'https://example.com/odoo/web?lang=ar&debug=1#action=abc';
  const off = buildToggleUrl(start, '0');
  const r = parseResult(off);
  assert.equal(r.query.debug, '0');
  assert.deepEqual(r.others, [['lang', 'ar']]);
  assert.equal(r.path, '/odoo/web');
  assert.equal(r.hash, '#action=abc');
  assert.equal(getToggleAction(off, 'normal'), '1');
});

test('invariant fuzz: path, hash, and non-debug params always survive', () => {
  const fuzz = [
    'https://example.com/a/b?z=9&debug=assets&y=8#frag',
    'https://example.com/odoo?sp=a%20b&q=%2Fpath%2Fx#anchor',
    'https://example.com/odoo/web?redirect=%2Fweb%23action%3D1',
    'https://example.com/odoo?empty=&onlykey#h',
  ];
  for (const url of fuzz) {
    const orig = new URL(url);
    const before = new Map([...orig.searchParams].filter(([k]) => k !== 'debug'));
    for (const target of ['1', '0', 'assets', 'tests']) {
      const rebuilt = buildToggleUrl(url, target);
      const after = new URL(rebuilt);
      assert.equal(after.pathname, orig.pathname, `${url} target ${target} path`);
      assert.equal(after.hash, orig.hash, `${url} target ${target} hash`);
      const afterRest = new Map([...after.searchParams].filter(([k]) => k !== 'debug'));
      assert.deepEqual([...afterRest.entries()].sort(), [...before.entries()].sort(), `${url} other params`);
      assert.equal(after.searchParams.get('debug'), target);
    }
  }
});