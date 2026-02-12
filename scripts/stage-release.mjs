import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outRel = outIndex >= 0 ? args[outIndex + 1] : 'release/package';
const includeMobile = args.includes('--include-mobile');

const distDir = path.join(ROOT, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('[stage-release] dist not found; run the build first.');
  process.exit(1);
}

const outDir = path.resolve(ROOT, outRel);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const copyIfExists = (relPath, destRel = relPath) => {
  const src = path.join(ROOT, relPath);
  if (!fs.existsSync(src)) return;
  const dest = path.join(outDir, destRel);
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
};

copyIfExists('dist', 'dist');
copyIfExists('capacitor.config.ts');
copyIfExists('package.json');
copyIfExists('package-lock.json');

if (includeMobile) {
  copyIfExists('android');
  copyIfExists('ios');
}

console.log(`[stage-release] staged build at ${path.relative(ROOT, outDir)}`);
