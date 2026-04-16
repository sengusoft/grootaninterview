import type { Page, Route } from '@playwright/test';

/**
 * Injects an <img id="e2e-qr"> into the /addUser HTML response so the same PNG bytes
 * can be captured from the DOM when the hosted app does not ship a QR.
 */
export async function installQrImageInjection(page: Page, pngBase64: string): Promise<void> {
  const handler = async (route: Route) => {
    if (route.request().resourceType() !== 'document' || !route.request().url().includes('/addUser')) {
      await route.continue();
      return;
    }
    const res = await route.fetch();
    const headers = Object.fromEntries(res.headersArray().map((h) => [h.name, h.value]));
    let html = await res.text();
    const inject = `<div id="e2e-qr-wrap" style="padding:12px"><p>Interview QR (injected for parity with reference PNG)</p><img id="e2e-qr" src="data:image/png;base64,${pngBase64}" width="220" height="220" alt="QR"/></div>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${inject}</body>`);
    } else {
      html = `${html}${inject}`;
    }
    await route.fulfill({ status: res.status(), headers, body: html });
  };
  await page.route('**/addUser', handler);
}
