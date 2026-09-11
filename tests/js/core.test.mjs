/**
 * Real-JavaScript integration tests for src/core.js with a stubbed
 * chrome.tabs API (no extension host is needed).
 * Run: node --test tests/js/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { applyMode, getActivePageState, getActiveTab, toggleDebugMode } from '../../src/core.js';

function fakeChrome() {
  const updatedListeners = [];
  let activeTab = null;
  const updates = [];
  return {
    _setActive(tab) {
      activeTab = tab;
    },
    _updates: updates,
    _emitComplete(tabId) {
      for (const fn of [...updatedListeners]) fn(tabId, { status: 'complete' });
    },
    tabs: {
      query: async () => (activeTab ? [activeTab] : []),
      update: async (id, props) => {
        updates.push({ id, props });
        return { id, ...props };
      },
      onUpdated: {
        addListener: (fn) => updatedListeners.push(fn),
        removeListener: (fn) => {
          const i = updatedListeners.indexOf(fn);
          if (i >= 0) updatedListeners.splice(i, 1);
        },
      },
    },
    runtime: {},
  };
}

const tab = (id, url) => ({ id, url });

test('getActiveTab returns the active tab', async () => {
  const chrome = fakeChrome();
  globalThis.chrome = chrome;
  chrome._setActive(tab(1, 'https://x.odoo.com/web'));
  const got = await getActiveTab();
  assert.equal(got.id, 1);
  assert.equal(got.url, 'https://x.odoo.com/web');
});

test('getActivePageState classifies the active tab', async () => {
  const chrome = fakeChrome();
  globalThis.chrome = chrome;
  chrome._setActive(tab(2, 'https://x.odoo.com/web?debug=1'));
  const { pageState, url } = await getActivePageState();
  assert.equal(pageState.state, 'on');
  assert.equal(pageState.supported, true);
});

test('toggle off -> on updates the tab to ?debug=1 and waits for complete', async () => {
  const chrome = fakeChrome();
  globalThis.chrome = chrome;
  const t = tab(7, 'https://x.odoo.com/web?lang=ar');
  chrome._setActive(t);

  const pending = toggleDebugMode(t, 'normal');
  assert.equal(chrome._updates.length, 1, 'tabs.update called once');
  const { props } = chrome._updates[0];
  const u = new URL(props.url);
  assert.equal(u.searchParams.get('debug'), '1');
  assert.equal(u.pathname, '/web');
  assert.deepEqual([...u.searchParams].filter(([k]) => k !== 'debug'), [['lang', 'ar']]);

  let settled = false;
  pending.then((target) => {
    settled = true;
    assert.equal(target, '1');
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(settled, false, 'promise waits for navigation completion');
  chrome._emitComplete(7);
  await pending;
  assert.equal(settled, true);
});

test('toggle on -> off flips debug to 0', async () => {
  const chrome = fakeChrome();
  globalThis.chrome = chrome;
  const t = tab(8, 'https://x.odoo.com/web?debug=1');
  chrome._setActive(t);
  const target = await toggleDebugMode(t, 'normal');
  assert.equal(target, '0');
  assert.equal(new URL(chrome._updates[0].props.url).searchParams.get('debug'), '0');
});

test('assets page turns off', async () => {
  const chrome = fakeChrome();
  globalThis.chrome = chrome;
  const t = tab(9, 'https://x.odoo.com/web?debug=assets');
  chrome._setActive(t);
  const target = await toggleDebugMode(t, 'normal');
  assert.equal(target, '0');
});

test('unsupported scheme is rejected and never reaches tabs.update', async () => {
  const chrome = fakeChrome();
  globalThis.chrome = chrome;
  const t = tab(10, 'chrome://extensions/');
  chrome._setActive(t);
  await assert.rejects(() => toggleDebugMode(t, 'normal'), (e) => e.code === 'unsupported');
  assert.equal(chrome._updates.length, 0, 'no tabs.update for chrome://');
});

test('applyMode rejects without a tab', async () => {
  const chrome = fakeChrome();
  globalThis.chrome = chrome;
  await assert.rejects(() => applyMode(null, '1'), (e) => e.code === 'no-tab');
});

test('applyMode resolves only after a navigation completes (or timeout)', async () => {
  const chrome = fakeChrome();
  globalThis.chrome = chrome;
  const t = tab(11, 'https://x.odoo.com/web?debug=0');
  chrome._setActive(t);

  const p = applyMode(t, '1');
  let done = false;
  p.then(() => {
    done = true;
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(done, false, 'still waiting for navigation');
  const timeout = setTimeout(() => {
    assert.fail('should have been released by navigation');
  }, 800);
  chrome._emitComplete(11);
  await p;
  clearTimeout(timeout);
});

test('rapid successive toggles are idempotent on the same URL', async () => {
  const chrome = fakeChrome();
  globalThis.chrome = chrome;
  const t = tab(12, 'https://x.odoo.com/web?debug=1');
  chrome._setActive(t);

  const first = toggleDebugMode(t, 'normal');
  chrome._emitComplete(12);
  await first;
  const second = toggleDebugMode(t, 'normal');
  chrome._emitComplete(12);
  await second;

  assert.equal(chrome._updates.length, 2);
  const u1 = new URL(chrome._updates[0].props.url);
  const u2 = new URL(chrome._updates[1].props.url);
  assert.equal(u1.searchParams.get('debug'), '0');
  assert.equal(u2.searchParams.get('debug'), '0', 'second toggle targets the same state (idempotent)');
});

test('per-tab listener cleanup after completion', async () => {
  const chrome = fakeChrome();
  globalThis.chrome = chrome;
  const { tabs } = chrome;
  const listeners = [];
  tabs.onUpdated.addListener = (fn) => listeners.push(fn);
  tabs.onUpdated.removeListener = (fn) => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
  const t = tab(13, 'https://x.odoo.com/web');
  chrome._setActive(t);
  const p = toggleDebugMode(t, 'normal');
  chrome._emitComplete(13);
  await p;
  assert.equal(listeners.length, 0, 'listener removed after completion');
});