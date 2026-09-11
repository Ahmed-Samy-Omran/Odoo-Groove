/**
 * popup.js
 * Reads the active tab, renders the monkey state, and toggles Odoo debug.
 */

import { applyMode, getActivePageState } from './core.js';
import { getSettings } from './storage.js';
import { modeToQueryValue } from './url-state.js';

const $ = (sel) => document.querySelector(sel);

const els = {};
const hasApi = typeof chrome !== 'undefined' && !!chrome.tabs && !!chrome.tabs.query;

function t(key) {
  try {
    return chrome.i18n.getMessage(key) || key;
  } catch {
    return key;
  }
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
}

function resolveLanguage(settings) {
  if (settings.language !== 'auto') return settings.language === 'ar' ? 'ar' : 'en';
  let ui = 'en';
  try {
    ui = chrome.i18n.getUILanguage() || 'en';
  } catch {
    ui = 'en';
  }
  return ui.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

const STATUS_KEY = {
  on: 'statusOn',
  off: 'statusOff',
  assets: 'statusAssets',
  tests: 'statusTests',
  unknown: 'statusUnknown',
  unsupported: 'statusUnsupported',
  loading: 'statusLoading',
  error: 'statusError',
};

function setBodyState(state) {
  for (const cls of [...document.body.classList]) {
    if (cls.startsWith('state-')) document.body.classList.remove(cls);
  }
  document.body.classList.add('state-' + state);
}

function stateModePreset(state) {
  if (state === 'assets') return 'assets';
  if (state === 'tests') return 'tests';
  return 'normal';
}

function renderPage(state, currentUrl, busy) {
  setBodyState(state);

  const badge = els.monkeyBadge;
  if (state === 'unknown') {
    badge.textContent = '?';
    badge.hidden = false;
  } else if (state === 'unsupported' || state === 'error') {
    badge.textContent = '!';
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }

  els.statusText.textContent = t(STATUS_KEY[state] || 'statusLoading');

  let host = '';
  if (currentUrl && state !== 'unsupported') {
    try {
      host = new URL(currentUrl).hostname;
    } catch {
      host = '';
    }
  }
  els.domainText.textContent = host;
  els.domainText.hidden = !host;

  const isOn = state === 'on' || state === 'assets' || state === 'tests';
  const isInvalid = state === 'unsupported' || state === 'unknown';
  const isError = state === 'error';

  if (isError) {
    els.toggleLabel.textContent = t('actionRetry');
  } else if (isOn) {
    els.toggleLabel.textContent = t('actionTurnOff');
  } else {
    els.toggleLabel.textContent = t('actionTurnOn');
  }

  els.toggleBtn.disabled = busy || isInvalid;
  els.toggleBtn.setAttribute('aria-pressed', isOn ? 'true' : 'false');

  const preset = stateModePreset(state);
  const lockModes = isInvalid;
  for (const input of els.modeInputs) {
    input.checked = input.value === preset;
    input.disabled = busy || lockModes;
  }
}

function renderLoading(busy) {
  setBodyState('loading');
  els.statusText.textContent = t('statusLoading');
  els.domainText.textContent = '';
  els.domainText.hidden = true;
  els.monkeyBadge.hidden = true;
  els.toggleBtn.disabled = true;
  els.toggleLabel.textContent = t('actionBusy');
  for (const input of els.modeInputs) input.disabled = true;
}

function flashSuccess() {
  document.body.classList.add('data-success');
  setTimeout(() => document.body.classList.remove('data-success'), 700);
}

/* ---- Accordion (Radix-inspired manual toggle) ---- */

function toggleAdvanced() {
  if (!els.advancedTrigger || !els.advancedPanel) return;
  const open = els.advancedTrigger.getAttribute('aria-expanded') === 'true';
  els.advancedTrigger.setAttribute('aria-expanded', String(!open));
  els.advancedPanel.hidden = open;
}

const ui = {
  currentTab: null,
  currentUrl: '',
  currentState: { state: 'loading', supported: true },
  busy: false,
  lastTarget: null,
};

async function refresh() {
  const { tab, url, pageState } = await getActivePageState();
  ui.currentTab = tab;
  ui.currentUrl = url;
  ui.currentState = pageState;
  renderPage(pageState.state, url, ui.busy);
}

function primaryTarget() {
  const { state } = ui.currentState;
  if (state === 'on' || state === 'assets' || state === 'tests') return '0';
  const checked = els.modeInputs.find((i) => i.checked);
  const mode = checked && checked.value !== 'off' ? checked.value : 'normal';
  return modeToQueryValue(mode);
}

async function performToggle(targetValue) {
  if (ui.busy) return;
  ui.busy = true;
  document.body.dataset.busy = 'true';
  renderLoading(true);
  try {
    await applyMode(ui.currentTab, targetValue);
    await refresh();
    flashSuccess();
  } catch (err) {
    ui.currentState.state = 'error';
    ui.lastTarget = targetValue;
    renderPage('error', ui.currentUrl, ui.busy);
  } finally {
    ui.busy = false;
    delete document.body.dataset.busy;
    renderPage(ui.currentState.state, ui.currentUrl, false);
  }
}

async function onPrimary() {
  if (ui.busy) return;
  const { state } = ui.currentState;
  if (state === 'unsupported') return;
  // A failed toggle retries the same target instead of guessing a new one.
  if (state === 'error' && ui.lastTarget != null) {
    await performToggle(ui.lastTarget);
    return;
  }
  await performToggle(primaryTarget());
}

async function onModeSelect(value) {
  if (ui.busy) return;
  if (ui.currentState.state === 'unsupported') return;
  if (stateModePreset(ui.currentState.state) === value && ui.currentState.state !== 'off') return;
  await performToggle(modeToQueryValue(value));
}

function bindEvents() {
  els.settingsBtn?.addEventListener('click', () => {
    try {
      chrome.runtime.openOptionsPage();
    } catch {
      /* no-op in preview mode */
    }
  });
  els.toggleBtn.addEventListener('click', onPrimary);
  for (const input of els.modeInputs) {
    input.addEventListener('change', () => onModeSelect(input.value));
  }
  els.advancedTrigger?.addEventListener('click', toggleAdvanced);
}

function demoRender() {
  const params = new URLSearchParams(location.search);
  const target = params.get('demo') || 'off';
  const valid = ['on', 'off', 'assets', 'tests', 'unknown', 'unsupported', 'error'];
  const state = valid.includes(target) ? target : 'off';
  const host = params.get('host') || 'staging.example.com';
  ui.currentUrl = 'https://' + host + '/web';
  renderPage(state, ui.currentUrl, false);
  console.warn('[Odoo Groove] preview mode (chrome API not available)');
}

async function init() {
  applyI18n();
  els.settingsBtn = $('#settingsBtn');
  els.toggleBtn = $('#toggleBtn');
  els.toggleLabel = $('#toggleLabel');
  els.statusText = $('#statusText');
  els.domainText = $('#domainText');
  els.monkeyBadge = $('#monkeyBadge');
  els.modeInputs = [...document.querySelectorAll('#modeFieldset input[name="mode"]')];
  els.advancedTrigger = $('#advancedTrigger');
  els.advancedPanel = $('#advancedPanel');

  els.version = $('#version');
  try {
    els.version.textContent = 'v' + chrome.runtime.getManifest().version;
  } catch {
    els.version.textContent = 'v1.0.0';
  }

  if (!hasApi) {
    demoRender();
    bindEvents();
    return;
  }

  const settings = await getSettings();
  const lang = resolveLanguage(settings);
  document.documentElement.lang = lang;
  document.body.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

  bindEvents();
  await refresh();
}

init().catch((err) => {
  console.error('[Odoo Groove] popup init failed', err);
  try {
    renderPage('error', '', false);
  } catch {
    /* ignore */
  }
});
