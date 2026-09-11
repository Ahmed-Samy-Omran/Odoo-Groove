/**
 * core.js
 * Shared tab operations used by the popup and the service worker.
 */

import { buildToggleUrl, getToggleAction, isSupportedUrl, readPageState } from './url-state.js';

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export async function getActivePageState() {
  const tab = await getActiveTab();
  const url = tab && typeof tab.url === 'string' ? tab.url : '';
  return { tab, url, pageState: readPageState(url) };
}

function waitForTabComplete(tabId, timeoutMs = 6000) {
  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
      }
    };
    const onUpdated = (updatedId, info) => {
      if (updatedId === tabId && info.status === 'complete') {
        cleanup();
        resolve();
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

/**
 * Applies an Odoo debug query value ('1' | '0' | 'assets' | 'tests')
 * to the current page and waits for the navigation to complete.
 * Throws { code: 'unsupported' | 'no-tab' } when not applicable.
 */
export async function applyMode(tab, targetValue) {
  if (!tab || !tab.id) throw { code: 'no-tab' };
  const raw = tab.url;
  if (!isSupportedUrl(raw)) throw { code: 'unsupported' };
  const nextUrl = buildToggleUrl(raw, targetValue);
  await chrome.tabs.update(tab.id, { url: nextUrl });
  await waitForTabComplete(tab.id);
}

/** Convenience: run a full on/off toggle from the primary button. */
export async function toggleDebugMode(tab, panelMode) {
  const raw = tab.url;
  const target = getToggleAction(raw, panelMode);
  await applyMode(tab, target);
  return target;
}