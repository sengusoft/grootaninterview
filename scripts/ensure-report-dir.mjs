import fs from 'node:fs';
import path from 'node:path';

const which = process.argv[2] ?? 'current';
const dir = path.join('reports', which === 'baseline' ? 'baseline' : 'current');
fs.mkdirSync(dir, { recursive: true });
