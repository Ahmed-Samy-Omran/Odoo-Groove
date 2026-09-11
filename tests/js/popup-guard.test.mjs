/**
 * Real-JavaScript test of the popup's rapid-click guard using a minimal
 * DOM + chrome stub (no jsdom dependency).
 * Run: node --test tests/js/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

function stubElement(initial = {}) {
  const el = {
    textContent: '',
    title: '',
    hidden: false,
    disabled: false,
    checked: false,
    value: initial.value ?? '',
    dataset: {},
    classList: [],
    style: {},
    listeners: {},
    setAttribute(name, value) {
      this[name] = value;
    },
    getAttribute(name) {
      return this[name] ?? null;
    },
    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    },
  };
  return el;
}

function makeClassList(initial = []) {
  const cls = [...initial];
  cls.add = (name) => {
    if (!cls.includes(name)) cls.push(name);
  };
  cls.remove = (name) => {
    const i = cls.indexOf(name);
    if (i >= 0) cls.splice(i, 1);
  };
  return cls;
}

function makeEnv() {
  const modeInputs = [
    { ...stubElement(), value: 'normal' },
    { ...stubElement(), value: 'assets' },
    { ...stubElement(), value: 'tests' },
    { ...stubElement(), value: 'off' },
  ];
  const els = {
    settingsBtn: stubElement(),
    toggleBtn: stubElement(),
    toggleLabel: stubElement(),
    statusText: stubElement(),
    domainText: stubElement(),
    monkeyBadge: stubElement(),
    version: stubElement(),
  };
  const byId = new Map([
    ['settingsBtn', els.settingsBtn],
    ['toggleBtn', els.toggleBtn],
    ['toggleLabel', els.toggleLabel],
    ['statusText', els.statusText],
    ['domainText', els.domainText],
    ['monkeyBadge', els.monkeyBadge],
    ['version', els.version],
  ]);
  const body = stubElement();
  body.classList = makeClassList(['state-loading']);

  globalThis.document = {
    body,
    documentElement: {
      lang: 'en',
    },
    querySelector(sel) {
      if (sel.startsWith('#')) return byId.get(sel.slice(1)) ?? null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '#modeFieldset input[name="mode"]') return modeInputs;
      return [];
    },
  };

  let currentUrl = 'https://x.odoo.com/web?foo=1';
  let updateCount = 0;
  let releaseUpdate = null;
  const completeListeners = [];

  globalThis.chrome = {
    i18n: {
      getMessage(key) {
        return key;
      },
      getUILanguage() {
        return 'en';
      },
    },
    runtime: {
      getManifest: () => ({ version: '1.0.0' }),
      openOptionsPage() {},
    },
    storage: {
      local: {
        async get(defaults) {
          return { ...defaults };
        },
      },
    },
    tabs: {
      async query() {
        return [{ id: 1, url: currentUrl }];
      },
      async update(id, props) {
        updateCount += 1;
        currentUrl = props.url;
        return new Promise((resolve) => {
          releaseUpdate = () => resolve({ id, ...props });
        });
      },
      onUpdated: {
        addListener(fn) {
          completeListeners.push(fn);
        },
        removeListener(fn) {
          const i = completeListeners.indexOf(fn);
          if (i >= 0) completeListeners.splice(i, 1);
        },
      },
    },
  };

  return {
    els,
    modeInputs,
    get updateCount() {
      return updateCount;
    },
    get currentUrl() {
      return currentUrl;
    },
    release() {
      releaseUpdate?.();
      releaseUpdate = null;
      // Real browsers emit onUpdated asynchronously after tabs.update resolves.
      setTimeout(() => {
        for (const fn of [...completeListeners]) fn(1, { status: 'complete' });
      }, 0);
    },
    clickToggle() {
      for (const fn of els.toggleBtn.listeners.click ?? []) fn();
    },
    flush: () => new Promise((r) => setTimeout(r, 15)),
  };
}

let importCounter = 0;
async function importPopup() {
  // Cache-bust the specifier so each test gets a fresh module instance
  // (ESM otherwise caches the first evaluated module).
  importCounter += 1;
  const url = new URL('../../src/popup.js', import.meta.url);
  url.searchParams.set('v', String(importCounter));
  return await import(url.href);
}

test('rapid repeated clicks are blocked while a toggle is in flight', async () => {
  const env = makeEnv();
  await importPopup(); // popup.init() runs against the stubbed environment
  await env.flush();

  // First click: off -> on. tabs.update is held pending (navigation in flight).
  env.clickToggle();
  await env.flush();
  assert.equal(env.updateCount, 1, 'one update issued');
  assert.equal(env.els.toggleBtn.disabled, true, 'toggle disabled during navigation');
  assert.equal(new URL(env.currentUrl).searchParams.get('debug'), '1');

  // Rapid second click while busy must be ignored.
  env.clickToggle();
  await env.flush();
  assert.equal(env.updateCount, 1, 'second click ignored while busy');

  // Navigation completes -> popup re-reads state, resets busy.
  env.release();
  await env.flush();
  assert.equal(env.els.toggleBtn.disabled, false, 'toggle re-enabled after navigation');

  // Third click now works (on -> off) and state flips again.
  env.clickToggle();
  await env.flush();
  assert.equal(env.updateCount, 2, 'a new toggle starts after completion');
  assert.equal(new URL(env.currentUrl).searchParams.get('debug'), '0');
  env.release();
  await env.flush();
  assert.equal(env.els.statusText.textContent, 'statusOff', 'state re-read after navigation');
});

test('mode radio selection applies its target mode immediately', async () => {
  const env = makeEnv();
  await importPopup();
  await env.flush();

  const assets = env.modeInputs.find((i) => i.value === 'assets');
  for (const fn of assets.listeners.change ?? []) fn();
  await env.flush();
  assert.equal(env.updateCount, 1);
  assert.equal(new URL(env.currentUrl).searchParams.get('debug'), 'assets');
  env.release();
  await env.flush();
  assert.equal(env.els.statusText.textContent, 'statusAssets');
});