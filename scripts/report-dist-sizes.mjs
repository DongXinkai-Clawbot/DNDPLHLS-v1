import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distAssets = path.join(root, 'dist', 'assets');

if (!fs.existsSync(distAssets)) {
  console.error('[dist-sizes] dist/assets not found. Run `npm run build` first.');
  process.exit(1);
}

const entries = fs.readdirSync(distAssets);
const files = entries
  .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
  .map((name) => {
    const fullPath = path.join(distAssets, name);
    const stat = fs.statSync(fullPath);
    return { name, bytes: stat.size };
  })
  .sort((a, b) => b.bytes - a.bytes);

const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
const report = {
  generatedAt: new Date().toISOString(),
  distAssets: 'dist/assets',
  totalBytes,
  files,
};

const reportsDir = path.join(root, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

const outPath = path.join(reportsDir, 'dist-sizes.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`[dist-sizes] wrote ${path.relative(root, outPath)} (${files.length} files)`);
