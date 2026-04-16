import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { ContactListApi, redactToken, type ContactBody } from '../../src/helpers/apiClient';
import { saveEvidenceJson, saveEvidencePng } from '../../src/helpers/evidence';
import { decodeQrFromPngBuffer, decodeQrFromPngFile, parseQrCredentials } from '../../src/helpers/qr';
import { installQrImageInjection } from '../helpers/qrInjection';

const NEW_PASSWORD = process.env.E2E_NEW_PASSWORD ?? 'PlaywrightNewPass123!';

test.describe.configure({ mode: 'serial' });

test.describe('Hybrid flow — QR, API password reset, UI login, API contact, UI table', () => {
  test.setTimeout(120_000);
  let api: ContactListApi;
  let referencePng: Buffer;
  let qrSource: 'fixture' | 'generated';
  let creds: { email: string; password: string };
  let token: string | null = null;
  let contactPayload: ContactBody;

  test.beforeAll(async () => {
    const base = process.env.CONTACT_LIST_BASE_URL ?? 'https://thinking-tester-contact-list.herokuapp.com';
    api = new ContactListApi(base);

    const refPath = process.env.REFERENCE_QR_PATH ?? path.join('fixtures', 'reference-qr.png');
    if (fs.existsSync(refPath)) {
      referencePng = fs.readFileSync(refPath);
      qrSource = 'fixture';
    } else {
      qrSource = 'generated';
      const email = `e2e_qr_${Date.now()}@test.com`;
      const password = `Init_${Date.now().toString(36)}Aa1!`;
      const created = await api.addUser({
        firstName: 'QR',
        lastName: 'Bootstrap',
        email,
        password,
      });
      expect(created.status, `bootstrap addUser failed: ${created.text}`).toBe(201);
      const payload = JSON.stringify({ email, password });
      referencePng = await QRCode.toBuffer(payload, {
        type: 'png',
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
      });
    }

    const refText = await decodeQrFromPngBuffer(referencePng);
    expect(refText, 'Could not decode reference QR PNG').toBeTruthy();
    creds = parseQrCredentials(refText!);

  

    contactPayload = {
      firstName: 'Sengu',
      lastName: `C${Date.now().toString(36)}`.slice(0, 20),
      birthdate: '1990-03-23',
      email: `sengusoft@gmail.com`,
      phone: '9965379950',
      street1: 'Erode',
      city: 'Erode',
      stateProvince: 'Tamil Nadu',
      postalCode: '638109',
      country: 'India',
    };
  });

  test.afterAll(async () => {
    if (!token) return;
    const del = await api.deleteMe(token);
    await saveEvidenceJson('teardown_delete_users_me', {
      request: { method: 'DELETE', path: '/users/me' },
      response: { status: del.status, durationMs: del.durationMs, body: redactToken(del.json) },
    });
    expect([200, 204]).toContain(del.status);
  });

  test('Step 1 — page QR matches reference PNG decode', async ({ page, baseURL }, testInfo) => {
    test.skip(!baseURL, 'baseURL missing');

    const pngBase64 = referencePng.toString('base64');
    await installQrImageInjection(page, pngBase64);
    await page.goto('/addUser');

    const qr = page.locator('#e2e-qr');
    await expect(qr).toBeVisible();
    const shot = await qr.screenshot({ type: 'png' });
    await saveEvidencePng('step01_page_qr', shot, testInfo);

    const fromPage = await decodeQrFromPngBuffer(Buffer.from(shot));
    expect(fromPage, 'Decode failed for page QR screenshot').toBeTruthy();

    let fromFile: string | null = null;
    if (qrSource === 'fixture') {
      const refPath = process.env.REFERENCE_QR_PATH ?? path.join('fixtures', 'reference-qr.png');
      fromFile = await decodeQrFromPngFile(refPath);
      expect(fromFile, 'Decode failed for reference file').toBeTruthy();
      expect(fromPage!.trim()).toBe(fromFile!.trim());
    } else {
      expect(fromPage!.trim()).toBe(JSON.stringify(creds));
    }

    await saveEvidenceJson('step01_qr_decode', {
      referenceSource: qrSource,
      pagePayload: fromPage,
      filePayload: qrSource === 'fixture' ? fromFile : JSON.stringify(creds),
    }, testInfo);
  });

  test('Step 2 — API login + PATCH password (timed)', async ({}, testInfo) => {
    const login = await api.login({ email: creds.email, password: creds.password });
    await saveEvidenceJson('step02_login_initial', {
      response: {
        status: login.status,
        durationMs: login.durationMs,
        body: redactToken(login.json),
      },
    }, testInfo);
    expect(login.status).toBe(200);
    const loginJson = login.json as { token?: string };
    expect(loginJson.token).toBeTruthy();
    const initialToken = loginJson.token!;

    const patch = await api.patchMe(initialToken, { password: NEW_PASSWORD });
    await saveEvidenceJson('step02_patch_password', {
      request: { password: '[REDACTED]' },
      response: { status: patch.status, durationMs: patch.durationMs, body: redactToken(patch.json) },
    }, testInfo);
    expect(patch.status).toBe(200);

    const relogin = await api.login({ email: creds.email, password: NEW_PASSWORD });
    await saveEvidenceJson('step02_login_after_patch', {
      response: {
        status: relogin.status,
        durationMs: relogin.durationMs,
        body: redactToken(relogin.json),
      },
    }, testInfo);
    expect(relogin.status).toBe(200);
    token = (relogin.json as { token: string }).token;
  });

  test('Step 3 — UI login with updated password (timed)', async ({ page, baseURL }, testInfo) => {
    test.skip(!baseURL, 'baseURL missing');
    const t0 = Date.now();
    await page.goto('/');
    await page.locator('#email').fill(creds.email);
    await page.locator('#password').fill(NEW_PASSWORD);
    await page.locator('#submit').click();
    await expect(page.locator('header h1')).toHaveText('Contact List', { timeout: 60_000 });
    const loginMs = Date.now() - t0;
    await saveEvidencePng('step03_ui_after_login', await page.screenshot({ type: 'png', fullPage: true }), testInfo);
    await saveEvidenceJson('step03_ui_login_timing', { durationMs: loginMs, url: page.url() }, testInfo);
    expect(loginMs).toBeLessThan(120_000);
  });

  test('Step 4 — API add contact returns 201 (timed)', async ({}, testInfo) => {
    expect(token).toBeTruthy();
    const res = await api.addContact(token!, contactPayload);
    await saveEvidenceJson('step04_post_contacts', {
      request: contactPayload,
      response: { status: res.status, durationMs: res.durationMs, body: res.json },
    }, testInfo);
    expect(res.status).toBe(201);
    const body = res.json as Record<string, unknown>;
    expect(body.firstName).toBe(contactPayload.firstName);
    expect(body.lastName).toBe(contactPayload.lastName);
    expect(body.email).toBe(contactPayload.email);
    expect(body.phone).toBe(contactPayload.phone);
    expect(body.birthdate).toBe(contactPayload.birthdate);
  });

  test('Step 5 — Contacts table shows new row + highlighted screenshot', async ({ page, baseURL }, testInfo) => {
    test.skip(!baseURL, 'baseURL missing');
    expect(token).toBeTruthy();
    await page.context().clearCookies();
    await page.context().addCookies([{ name: 'token', value: token!, url: baseURL }]);
    await page.goto('/contactList');
    await expect(page.locator('header h1')).toHaveText('Contact List');
    const row = page.locator('tr.contactTableBodyRow').filter({ hasText: contactPayload.email });
    await expect(row).toBeVisible({ timeout: 60_000 });
    await expect(row).toContainText(contactPayload.email);
    await expect(row).toContainText(contactPayload.phone);
    await expect(row).toContainText(contactPayload.birthdate);

    await row.evaluate((el) => {
      (el as HTMLElement).style.outline = '4px solid #e11d48';
      (el as HTMLElement).style.outlineOffset = '2px';
    });
    await saveEvidencePng('step05_contact_row_highlight', await page.screenshot({ type: 'png', fullPage: true }), testInfo);
  });
});
