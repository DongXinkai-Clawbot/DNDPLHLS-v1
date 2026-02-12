import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'android',
  'api',
  'native',
  'ui_baseline',
]);

function shouldSkip(fullPath) {
  const rel = path.relative(ROOT, fullPath);
  const parts = rel.split(path.sep);
  // Skip duplicate nested repo folders entirely.
  if (parts.includes('DNDPLHLS-master') && parts.length > 1) return true;
  if (parts.includes('DNDPLHLS') && parts.length > 1) return true;
  // Skip known heavy or non-app dirs.
  return parts.some(p => SKIP_DIRS.has(p));
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (shouldSkip(full)) continue;
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const isCodeFile = (p) => p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js') || p.endsWith('.jsx');

const importRe = /^(\s*)(import\s+(?:[^;]*?\s+from\s+)?|export\s+[^;]*?\s+from\s+)(["'])([^"']+)(\3)/gm;

function findSpecifiers(text) {
  const out = [];
  importRe.lastIndex = 0;
  let m;
  while ((m = importRe.exec(text)) !== null) {
    out.push({ spec: m[4], index: m.index });
  }
  return out;
}

function isAbsolutePathLike(spec) {
  // Windows drive letter or UNC path
  if (/^[A-Za-z]:\\/.test(spec)) return true;
  if (/^\\\\/.test(spec)) return true;
  // File URL
  if (spec.startsWith('file:')) return true;
  return false;
}

function isForbiddenSpec(spec, relFile) {
  const s = spec.replace(/\\/g, '/');
  const rel = relFile.replace(/\\/g, '/');
  if (s.includes('DNDPLHLS-master/')) return 'must not import from duplicate nested repo folder: DNDPLHLS-master/';
  if (s.includes('/dist/') || s.startsWith('dist/') || s.startsWith('./dist') || s.startsWith('../dist')) {
    return 'must not import build output: dist/';
  }
  if (s.includes('/android/') || s.startsWith('android/') || s.startsWith('./android') || s.startsWith('../android')) {
    return 'must not import mobile build tree: android/';
  }
  if (s.includes('/api/') || s.startsWith('api/') || s.startsWith('./api') || s.startsWith('../api')) {
    return 'must not import server/api sources from app runtime: api/';
  }
  if (isAbsolutePathLike(spec)) return 'must not use absolute filesystem paths in import specifiers';
  if (s.includes('engine/audio')) {
    const allowed = rel.endsWith('audioEngine.ts') || rel.includes('engine/audio/');
    if (!allowed) return 'must import audio via audioEngine.ts facade (no deep engine/audio imports)';
  }
  if (s.includes('engine/timbre')) {
    const allowed = rel.endsWith('timbreEngine.ts') || rel.includes('engine/timbre/');
    if (!allowed) return 'must import timbre via timbreEngine.ts facade (no deep engine/timbre imports)';
  }
  if (s.includes('engine/ear')) {
    const allowed = rel.includes('engine/ear/');
    if (!allowed) return 'must not import deep engine/ear modules from outside the facade';
  }
  return null;
}

const problems = [];

for (const file of walk(ROOT)) {
  if (!isCodeFile(file)) continue;
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  for (const { spec } of findSpecifiers(text)) {
    const reason = isForbiddenSpec(spec, rel);
    if (reason) problems.push({ file: rel, spec, reason });
  }
}

if (problems.length) {
  console.error('\n[lint_boundaries] Forbidden imports found:\n');
  for (const p of problems) {
    console.error(`- ${p.file}  ->  "${p.spec}"  (${p.reason})`);
  }
  console.error('\nFix: remove the forbidden import or route via a proper runtime module.\n');
  process.exit(1);
}

console.log('[lint_boundaries] OK — no forbidden import patterns detected.');
