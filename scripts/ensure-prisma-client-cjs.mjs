/**
 * После `prisma generate` в node_modules/.prisma/client есть полный package.json (exports, imports).
 * Если добавить только type commonjs без потери полей — Jest и Node корректно резолвят #main-entry-point.
 * На случай отсутствия package.json создаём минимальный с type commonjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = path.join(root, 'node_modules', '.prisma', 'client');
const pkgPath = path.join(clientDir, 'package.json');

if (!fs.existsSync(clientDir)) {
  console.warn('ensure-prisma-client-cjs: node_modules/.prisma/client отсутствует, пропуск');
  process.exit(0);
}

let pkg = {};
if (fs.existsSync(pkgPath)) {
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    pkg = {};
  }
}

pkg.type = 'commonjs';

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('ensure-prisma-client-cjs:', pkgPath, '(type=commonjs)');
