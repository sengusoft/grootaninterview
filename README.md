# Contact List — Playwright + API hybrid automation

End-to-end and API tests for [Thinking Tester Contact List](https://thinking-tester-contact-list.herokuapp.com/). Official API reference: [Postman documenter](https://documenter.getpostman.com/view/4012288/TzK2bEa8).

## What is implemented

- **QR**: Decodes `fixtures/reference-qr.png` (or `REFERENCE_QR_PATH`). If the file is missing, a user is created via `POST /users` and a matching QR PNG is generated so the flow is self-contained. The same PNG bytes are injected into the `/addUser` HTML response so a **page screenshot** can be decoded and compared to the reference payload (parity when you replace the fixture with your email PNG).
- **API**: `POST /users/login` → `PATCH /users/me` with `{ "password": "..." }` → `POST /contacts` (expects **201**) → teardown `DELETE /users/me` (expects **200**). Each call records **duration** in `evidence/*.json`.
- **UI**: Login on `/` (`#email`, `#password`, `#submit`), assert **Contact List** header, then contact table row (cookie forced to API token before `/contactList` because the app’s `document.cookie` parsing breaks some JWTs).
- **Evidence**: `evidence/<iso-timestamp>_<step>.png|json` (gitignored). Playwright **video** is on for every test; traces on failure.
- **Negative API tests**: wrong password, missing auth, bad bearer, bad PATCH token.
- **Reporting**: see [Reporting deliverables](#reporting-deliverables-items-1-3) below.

## Reporting deliverables (items 1–3)

### 1. Previous vs current execution (comparison report)

| Run | Command | What you get |
|-----|---------|--------------|
| **Previous (all pass)** | `npm run test:baseline` | `reports/baseline/results.json` — all executed tests **passed**; the regression marker test is **skipped** (not a failure). |
| **Current (one failed case)** | `npm run test:current` | `reports/current/results.json` — same tests; the marker test records a **failed** assertion (for the diff) while the process still exits **0** (`test.fail()`). |
| **Comparison HTML** | `npm run test:report:compare` | `reports/comparison.html` — summary cards, **changed tests** table (skipped → failed), and **full per-test tables** for baseline and current (status, duration, links to screenshot/video attachments). |

**One command (baseline → current → comparison):**

```powershell
npm run test:compare:full
start reports\comparison.html
```

Run `test:compare:full` whenever you want fresh **previous** and **current** JSON plus an updated comparison page.

### 2. Per-step evidence (`evidence/`)

During the hybrid and negative API tests, files are written as:

`<ISO-timestamp>_<stepName>.png` or `.json`

Examples: `2026-04-16T15-11-24-471Z_step01_page_qr.png`, `2026-04-16T15-11-27-489Z_step02_login_initial.json`.

The same payloads are also **attached** to each test in the Playwright HTML report (see below).

### 3. Detailed HTML report (Playwright built-in)

After any `playwright test` run:

- **`playwright-report/index.html`** — full Playwright report: **screenshots** (`screenshot: on`), **video** (`video: on`), traces on failure, and **attachments** (step PNGs / API JSON) per test.

```powershell
npx playwright show-report
```

Allure is not required; the built-in HTML reporter plus `reports/comparison.html` cover the ask.

## Verified API contract (smoke-checked against the live app)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/users` | Register; **201**; body includes `user` and `token`. |
| POST | `/users/login` | **200**; `Set-Cookie: token=…`; JSON `user`, `token`. Wrong creds **401**. |
| PATCH | `/users/me` | **200**; header `Authorization: Bearer <token>`; body e.g. `{ "password": "NewPass…" }`. |
| POST | `/contacts` | **201**; Bearer required; `lastName` max length **20** in current API validation. |
| DELETE | `/users/me` | **200**; Bearer required. |

## Prerequisites

- Node.js **18+**
- Windows PowerShell (commands below use PowerShell syntax)

## Install

```powershell
npm install
```

Browsers: `postinstall` runs `playwright install chromium`. For a clean manual install: `npx playwright install chromium`.

## QR 

Copy your email QR image to:

`fixtures/reference-qr.png`

The decoded text must be JSON with `email` and `password` for a user that **already exists** on the target server (or use the self-bootstrap path by omitting the file).

## Run tests

```powershell

# Full suite (JSON under reports/current/ because RUN_PROFILE defaults to non-baseline)
npx playwright test

# Baseline JSON (all executed tests pass; one skipped marker test)
npm run test:baseline

# Current JSON (same suite + one intentional failure for comparison)
npm run test:current

# HTML diff-style summary (needs baseline + current JSON from above)
npm run test:report:compare

# All three in order: baseline → current → comparison.html
npm run test:compare:full
```

Open `reports\comparison.html` after `test:report:compare` or `test:compare:full`.

HTML report (last run): `npx playwright show-report` or `playwright-report\index.html`.



## Project layout

- `tests/hybrid/contact-flow.spec.ts` — main hybrid flow
- `tests/hybrid/negative-api.spec.ts` — invalid API cases
- `tests/hybrid/report-regression.spec.ts` — intentional failure only when `RUN_PROFILE=current` and `INCLUDE_REGRESSION_MARKER=1` (the `test:current` script sets both)
- `src/helpers/` — API client, timed `fetch`, QR decode, evidence writers
- `scripts/compare-reports.mjs` — baseline vs current JSON → `reports/comparison.html`
