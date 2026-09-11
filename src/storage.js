/**
 * storage.js
 * Minimal local settings wrapper (chrome.storage.local).
 */

export const SETTINGS_DEFAULTS = Object.freeze({
  language: 'auto', // 'auto' | 'ar' | 'en'
  defaultMode: 'normal', // 'normal' | 'assets' | 'tests' | 'off'
});

export async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_DEFAULTS);
  return { ...SETTINGS_DEFAULTS, ...stored };
}

export async function setSettings(partial) {
  await chrome.storage.local.set(partial);
}