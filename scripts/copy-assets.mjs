#!/usr/bin/env node
/**
 * Copy non-TypeScript assets from src/ into dist/ after tsc.
 * tsc itself only handles .ts → .js; SQL schemas, JSON fixtures, etc. need
 * to be ferried across by a build step.
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const assets = [
  ['src/storage/schema.sql', 'dist/storage/schema.sql']
];

for (const [from, to] of assets) {
  const src = resolve(root, from);
  const dst = resolve(root, to);
  if (!existsSync(src)) {
    console.error(`! missing source asset: ${from}`);
    process.exit(1);
  }
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  console.log(`✓ copied ${from} → ${to}`);
}
