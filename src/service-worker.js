/**
 * service-worker.js
 * Handles the keyboard command. Popup logic lives in popup.js.
 */

import { getActiveTab, toggleDebugMode } from './core.js';
import { getSettings } from './storage.js';

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-debug') return;
  try {
    const { defaultMode } = await getSettings();
    const tab = await getActiveTab();
    if (!tab) return;
    await toggleDebugMode(tab, defaultMode);
  } catch (err) {
    console.warn('[Odoo Groove] command toggle failed', err);
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[Odoo Groove] installed', details.reason, chrome.runtime.getManifest().version);
});