import { test, expect } from '@playwright/test';
import { ContactListApi } from '../../src/helpers/apiClient';
import { timedFetch } from '../../src/helpers/timedFetch';
import { saveEvidenceJson } from '../../src/helpers/evidence';

const base = () => process.env.CONTACT_LIST_BASE_URL ?? 'https://thinking-tester-contact-list.herokuapp.com';

test.describe('Negative API scenarios', () => {
  test('POST /users/login with unknown user returns 401', async ({}, testInfo) => {
    const api = new ContactListApi(base());
    const res = await api.login({ email: `missing_${Date.now()}@example.com`, password: 'NoSuchUser123!' });
    await saveEvidenceJson('neg_login_unknown_user', {
      request: { email: '(dynamic)', password: '[REDACTED]' },
      response: { status: res.status, durationMs: res.durationMs, body: res.json },
    }, testInfo);
    expect(res.status).toBe(401);
  });

  test('POST /users/login with wrong password returns 401', async ({}, testInfo) => {
    const api = new ContactListApi(base());
    const created = await api.addUser({
      firstName: 'Neg',
      lastName: 'User',
      email: `neg_${Date.now()}@test.com`,
      password: 'CorrectPass123!',
    });
    expect(created.status).toBe(201);
    const email = (created.json as { user: { email: string } }).user.email;
    const bad = await api.login({ email, password: 'WrongPass123!' });
    await saveEvidenceJson('neg_login_wrong_password', {
      setup: { addUser: { status: created.status, durationMs: created.durationMs } },
      request: { email, password: '[WRONG]' },
      response: { status: bad.status, durationMs: bad.durationMs, body: bad.json },
    }, testInfo);
    expect(bad.status).toBe(401);

    const token = (created.json as { token: string }).token;
    const del = await api.deleteMe(token);
    expect([200, 204]).toContain(del.status);
  });

  test('POST /contacts without Authorization returns 401', async ({}, testInfo) => {
    const url = `${base().replace(/\/$/, '')}/contacts`;
    const res = await timedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'X', lastName: 'Y' }),
    });
    await saveEvidenceJson('neg_contacts_no_auth', {
      request: { method: 'POST', path: '/contacts', auth: 'none' },
      response: { status: res.status, durationMs: res.durationMs },
    }, testInfo);
    expect(res.status).toBe(401);
  });

  test('POST /contacts with invalid bearer token returns 401', async ({}, testInfo) => {
    const api = new ContactListApi(base());
    const res = await api.addContact('definitely-not-valid.jwt.token', {
      firstName: 'X',
      lastName: 'Y',
      birthdate: '2000-01-01',
      email: 'x@y.com',
      phone: '1',
      street1: 's',
      city: 'c',
      stateProvince: 'st',
      postalCode: '1',
      country: 'USA',
    });
    await saveEvidenceJson('neg_contacts_invalid_token', {
      request: { method: 'POST', path: '/contacts', auth: 'Bearer invalid' },
      response: { status: res.status, durationMs: res.durationMs, body: res.json },
    }, testInfo);
    expect(res.status).toBe(401);
  });

  test('PATCH /users/me with invalid bearer token is rejected', async ({}, testInfo) => {
    const api = new ContactListApi(base());
    const res = await api.patchMe('not-a-valid-token', { password: 'Whatever123!' });
    await saveEvidenceJson('neg_patch_invalid_token', {
      request: { method: 'PATCH', path: '/users/me', auth: 'Bearer invalid' },
      response: { status: res.status, durationMs: res.durationMs, body: res.json },
    }, testInfo);
    expect([400, 401]).toContain(res.status);
  });
});
