import fs from 'node:fs/promises';
import path from 'node:path';
import jsQR from 'jsqr';
import sharp from 'sharp';

async function decodeRaw(width: number, height: number, rgba: Buffer): Promise<string | null> {
  const code = jsQR(new Uint8ClampedArray(rgba), width, height, { inversionAttempts: 'attemptBoth' });
  return code?.data ?? null;
}

export async function decodeQrFromPngBuffer(buffer: Buffer): Promise<string | null> {
  const variants: Array<() => Promise<{ width: number; height: number; data: Buffer }>> = [
    async () => {
      const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, data };
    },
    async () => {
      const { data, info } = await sharp(buffer)
        .resize({ width: 800, height: 800, fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, data };
    },
    async () => {
      const { data, info } = await sharp(buffer)
        .resize({ width: 400, height: 400, fit: 'inside' })
        .greyscale()
        .threshold(128)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, data };
    },
  ];

  for (const v of variants) {
    const { width, height, data } = await v();
    const text = await decodeRaw(width, height, data);
    if (text) return text;
  }
  return null;
}

export async function decodeQrFromPngFile(filePath: string): Promise<string | null> {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const buf = await fs.readFile(abs);
  return decodeQrFromPngBuffer(buf);
}

export type QrCredentials = { email: string; password: string };

export function parseQrCredentials(payload: string): QrCredentials {
  const trimmed = payload.trim();
  const obj = JSON.parse(trimmed) as Record<string, unknown>;
  const email = (obj.email ?? obj.Email) as string | undefined;
  const password = (obj.password ?? obj.Password) as string | undefined;
  if (!email || !password) {
    throw new Error('QR payload must be JSON with email/password (case-insensitive keys supported).');
  }
  return { email, password };
}
