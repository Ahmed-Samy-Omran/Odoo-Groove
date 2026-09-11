/**
 * options.js
 * Settings page: language, default mode, shortcut hint.
 */

import { getSettings, setSettings } from './storage.js';

const t = (key) => {
  try {
    return chrome.i18n.getMessage(key) || key;
  } catch {
    return key;
  }
};

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.title = t('optionsTitle');
}

function resolveLanguage(value) {
  if (value !== 'auto') return value === 'ar' ? 'ar' : 'en';
  let ui = 'en';
  try {
    ui = chrome.i18n.getUILanguage() || 'en';
  } catch {
    ui = 'en';
  }
  return ui.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

const languageSelect = document.getElementById('language');
const modeSelect = document.getElementById('defaultMode');
const savedBadge = document.getElementById('saved');
let hideSavingTimer = null;

function notifySaved() {
  savedBadge.hidden = false;
  document.body.dataset.saving = 'true';
  clearTimeout(hideSavingTimer);
  hideSavingTimer = setTimeout(() => {
    savedBadge.hidden = true;
    delete document.body.dataset.saving;
  }, 1600);
}

async function init() {
  applyI18n();

  const { language, defaultMode } = await getSettings();
  languageSelect.value = language;
  modeSelect.value = defaultMode;

  const lang = resolveLanguage(language);
  document.documentElement.lang = lang;
  document.body.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

  languageSelect.addEventListener('change', async () => {
    await setSettings({ language: languageSelect.value });
    const lang = resolveLanguage(languageSelect.value);
    document.documentElement.lang = lang;
    document.body.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    applyI18n();
    notifySaved();
  });

  modeSelect.addEventListener('change', async () => {
    await setSettings({ defaultMode: modeSelect.value });
    notifySaved();
  });

  const badge = document.querySelector('.shortcut');
  try {
    const [cmd] = await chrome.commands.getAll();
    if (cmd && cmd.shortcut) badge.textContent = cmd.shortcut;
  } catch {
    badge.textContent = 'Ctrl+Shift+O';
  }
}

init().catch((err) => {
  console.error('[Odoo Groove] options init failed', err);
});