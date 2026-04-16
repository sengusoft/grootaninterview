import fs from 'node:fs';
import path from 'node:path';

const baselinePath = path.join('reports', 'baseline', 'results.json');
const currentPath = path.join('reports', 'current', 'results.json');
const outHtml = path.join('reports', 'comparison.html');

function readJson(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing report file: ${p}. Run npm run test:baseline and npm run test:current first.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function flattenSpecs(suites) {
  const rows = [];
  const walk = (suite, prefix = '') => {
    const title = [prefix, suite.title].filter(Boolean).join(' > ');
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const result = t.results?.[0];
        const status = result?.status ?? t.status ?? 'unknown';
        const attachments = result?.attachments ?? [];
        rows.push({
          suite: title,
          test: spec.title,
          file: spec.file,
          status,
          duration: result?.duration ?? null,
          attachments,
        });
      }
    }
    for (const child of suite.suites ?? []) {
      walk(child, title);
    }
  };
  for (const s of suites ?? []) walk(s);
  return rows;
}

function summarize(rows) {
  return rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
}

function fmtMs(ms) {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const baseline = readJson(baselinePath);
const current = readJson(currentPath);

const baseRows = flattenSpecs(baseline.suites);
const curRows = flattenSpecs(current.suites);

const key = (r) => `${r.file}::${r.suite}::${r.test}`;
const baseMap = new Map(baseRows.map((r) => [key(r), r]));
const curMap = new Map(curRows.map((r) => [key(r), r]));

const allKeys = [...new Set([...baseMap.keys(), ...curMap.keys()])];

const baseSummary = summarize(baseRows);
const curSummary = summarize(curRows);

function escapeHtml(s) {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function pillClass(status) {
  if (status === 'passed' || status === 'expected') return 'pill-pass';
  if (status === 'skipped') return 'pill-skip';
  if (status === 'unexpected' || status === 'failed' || status === 'timedOut') return 'pill-fail';
  return '';
}

function summaryCard(label, counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pass = (counts.passed ?? 0) + (counts.expected ?? 0);
  const fail = (counts.failed ?? 0) + (counts.unexpected ?? 0) + (counts.timedOut ?? 0);
  const skip = counts.skipped ?? 0;
  return `
    <div class="card">
      <h3>${escapeHtml(label)}</h3>
      <div class="card-total">${total} tests</div>
      <div class="card-row"><span class="dot dot-pass"></span> Passed: ${pass}</div>
      <div class="card-row"><span class="dot dot-fail"></span> Failed: ${fail}</div>
      <div class="card-row"><span class="dot dot-skip"></span> Skipped: ${skip}</div>
    </div>`;
}

function evidenceList(attachments) {
  if (!attachments || attachments.length === 0) return '';
  return attachments.map(a => {
    const name = escapeHtml(a.name);
    if (a.path) {
      const relative = path.relative(path.dirname(outHtml), a.path).replaceAll('\\', '/');
      const icon = a.contentType?.startsWith('image/') ? 'img' : a.contentType?.startsWith('video/') ? 'vid' : 'json';
      return `<a href="${escapeHtml(relative)}" title="${name}" class="ev-link ev-${icon}">${name}</a>`;
    }
    return `<span class="ev-link">${name}</span>`;
  }).join(' ');
}

function fullTable(label, rows) {
  const trs = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.file)}</td>
      <td>${escapeHtml(r.test)}</td>
      <td><span class="pill ${pillClass(r.status)}">${escapeHtml(r.status)}</span></td>
      <td class="num">${fmtMs(r.duration)}</td>
      <td class="ev">${evidenceList(r.attachments)}</td>
    </tr>`).join('');
  return `
    <h2>${escapeHtml(label)} — all tests</h2>
    <table>
      <thead><tr><th>File</th><th>Test</th><th>Status</th><th>Duration</th><th>Evidence</th></tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

function diffTable() {
  const diffs = [];
  for (const k of allKeys) {
    const b = baseMap.get(k);
    const c = curMap.get(k);
    const bs = b?.status ?? 'missing';
    const cs = c?.status ?? 'missing';
    if (bs !== cs) {
      diffs.push({ file: b?.file ?? c?.file, test: b?.test ?? c?.test, baseline: bs, current: cs,
        bDur: b?.duration, cDur: c?.duration });
    }
  }
  if (diffs.length === 0) return '<p>No status differences between baseline and current.</p>';
  const trs = diffs.map(d => `
    <tr>
      <td>${escapeHtml(d.file)}</td>
      <td>${escapeHtml(d.test)}</td>
      <td><span class="pill ${pillClass(d.baseline)}">${escapeHtml(d.baseline)}</span></td>
      <td><span class="pill ${pillClass(d.current)}">${escapeHtml(d.current)}</span></td>
      <td class="num">${fmtMs(d.bDur)}</td>
      <td class="num">${fmtMs(d.cDur)}</td>
    </tr>`).join('');
  return `
    <h2>Changed tests (baseline vs current)</h2>
    <table>
      <thead><tr><th>File</th><th>Test</th><th>Baseline</th><th>Current</th><th>Base dur</th><th>Cur dur</th></tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Playwright Comparison Report</title>
  <style>
    :root { --bg: #f8fafc; --card: #fff; --border: #e2e8f0; --text: #0f172a; --muted: #64748b; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 24px 32px; background: var(--bg); color: var(--text); }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 17px; margin-top: 32px; border-bottom: 2px solid var(--border); padding-bottom: 6px; }
    .meta { color: var(--muted); font-size: 13px; margin-bottom: 20px; }
    .cards { display: flex; gap: 16px; flex-wrap: wrap; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; min-width: 200px; }
    .card h3 { margin: 0 0 8px; font-size: 15px; }
    .card-total { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .card-row { font-size: 13px; margin: 2px 0; display: flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .dot-pass { background: #22c55e; }
    .dot-fail { background: #ef4444; }
    .dot-skip { background: #818cf8; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; background: var(--card); border-radius: 8px; overflow: hidden; }
    th, td { border: 1px solid var(--border); padding: 7px 10px; text-align: left; font-size: 13px; }
    th { background: #f1f5f9; font-weight: 600; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .pill-pass { background: #dcfce7; color: #166534; }
    .pill-fail { background: #fee2e2; color: #991b1b; }
    .pill-skip { background: #e0e7ff; color: #3730a3; }
    .ev { max-width: 340px; }
    .ev-link { display: inline-block; margin: 1px 4px 1px 0; padding: 1px 6px; border-radius: 4px; font-size: 11px; text-decoration: none; }
    a.ev-link { color: #2563eb; background: #eff6ff; }
    a.ev-link:hover { text-decoration: underline; }
    .ev-img::before { content: "IMG "; font-weight: 700; color: #059669; }
    .ev-vid::before { content: "VID "; font-weight: 700; color: #7c3aed; }
    .ev-json::before { content: "JSON "; font-weight: 700; color: #d97706; }
    footer { margin-top: 40px; color: var(--muted); font-size: 12px; }
  </style>
</head>
<body>
  <h1>Playwright Baseline vs Current — Comparison Report</h1>
  <p class="meta">
    Generated: ${new Date().toISOString()}<br>
    Baseline: <code>${escapeHtml(baselinePath)}</code> | Current: <code>${escapeHtml(currentPath)}</code>
  </p>

  <div class="cards">
    ${summaryCard('Baseline run', baseSummary)}
    ${summaryCard('Current run', curSummary)}
  </div>

  ${diffTable()}
  ${fullTable('Baseline', baseRows)}
  ${fullTable('Current', curRows)}

  <footer>Report generated by <code>scripts/compare-reports.mjs</code></footer>
</body>
</html>`;

fs.mkdirSync(path.dirname(outHtml), { recursive: true });
fs.writeFileSync(outHtml, html, 'utf8');
console.log(`Wrote ${outHtml}`);
