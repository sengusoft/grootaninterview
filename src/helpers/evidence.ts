import fs from 'node:fs';
import path from 'node:path';
import type { TestInfo } from '@playwright/test';

const evidenceRoot = path.join(process.cwd(), 'evidence');

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function ensureEvidenceDir(): void {
  fs.mkdirSync(evidenceRoot, { recursive: true });
}

export function evidencePath(stepName: string, ext: 'png' | 'json'): string {
  ensureEvidenceDir();
  const safe = stepName.replace(/[^a-zA-Z0-9_-]+/g, '_');
  return path.join(evidenceRoot, `${stamp()}_${safe}.${ext}`);
}

/**
 * Save a PNG screenshot to evidence/ and optionally attach it to the Playwright HTML report.
 */
export async function saveEvidencePng(
  stepName: string,
  data: Buffer,
  testInfo?: TestInfo,
): Promise<string> {
  const p = evidencePath(stepName, 'png');
  await fs.promises.writeFile(p, data);
  if (testInfo) {
    await testInfo.attach(stepName, { body: data, contentType: 'image/png' });
  }
  return p;
}

/**
 * Save a JSON response/payload to evidence/ and optionally attach it to the Playwright HTML report.
 */
export async function saveEvidenceJson(
  stepName: string,
  data: unknown,
  testInfo?: TestInfo,
): Promise<string> {
  const p = evidencePath(stepName, 'json');
  const json = JSON.stringify(data, null, 2);
  await fs.promises.writeFile(p, json, 'utf8');
  if (testInfo) {
    await testInfo.attach(stepName, { body: json, contentType: 'application/json' });
  }
  return p;
}
