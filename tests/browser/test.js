/**
 * Browser-run mirror of tests/run.py against the real src/url-state.js.
 * Serve the project root (e.g. `python3 -m http.server`) and open
 * http://localhost:8000/tests/browser/ .
 */

import {
  buildToggleUrl,
  getDebugMode,
  getToggleAction,
  isOdooLike,
  isSupportedUrl,
  readPageState,
} from '../../src/url-state.js';

const resultsEl = document.getElementById('results');
const summaryEl = document.getElementById('summary');

let total = 0;
let failures = 0;

function check(name, got, expect) {
  total += 1;
  const ok = JSON.stringify(got) === JSON.stringify(expect);
  if (!ok) failures += 1;
  const li = document.createElement('li');
  li.className = ok ? 'pass' : 'fail';
  li.textContent = `${ok ? 'PASS' : 'FAIL'} ${name}` + (ok ? '' : ` — got ${JSON.stringify(got)}, expected ${JSON.stringify(expect)}`);
  resultsEl.appendChild(li);
}

async function main() {
  const res = await fetch('../fixtures.json');
  const fixtures = await res.json();

  for (const case of fixtures.state) {
    const e = case.expect;
    check(`${case.name} (supported)`, isSupportedUrl(case.url), e.supported);
    check(`${case.name} (debugMode)`, getDebugMode(case.url), e.debugMode);
    check(`${case.name} (odooLike)`, isOdooLike(case.url), e.odooLike);
    check(`${case.name} (state)`, readPageState(case.url).state, e.state);
  }

  for (const case of fixtures.build) {
    const result = new URL(buildToggleUrl(case.url, case.target));
    const e = case.expect;
    check(`${case.name} (debug)`, result.searchParams.get('debug'), e.debug);
    check(`${case.name} (path)`, result.pathname, e.pathname);
    check(`${case.name} (hash)`, result.hash, e.hash);
    const others = [...result.searchParams.entries()].filter(([k]) => k !== 'debug').sort();
    check(`${case.name} (other params)`, others, e.otherParams.sort());
  }

  for (const case of fixtures.toggle) {
    check(case.name, getToggleAction(case.url, case.panelMode), case.expect);
  }

  summaryEl.textContent = `url-state spec: ${total - failures}/${total} checks passed`;
  summaryEl.classList.toggle('fail', failures > 0);
  summaryEl.classList.toggle('pass', failures === 0);
}

main().catch((err) => {
  summaryEl.textContent = 'Error running tests';
  summaryEl.classList.add('fail');
  const li = document.createElement('li');
  li.className = 'fail';
  li.textContent = String(err);
  resultsEl.appendChild(li);
});