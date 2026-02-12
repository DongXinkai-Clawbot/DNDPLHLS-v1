import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.gradle',
  '.idea',
  '.vscode',
  'native',
  'android/app/build',
  'android/.gradle',
  'harmonic-lattice-native-ar',
]);

const EXCLUDE_FILES = new Set([
  path.join('scripts', 'check-conflicts.mjs'),
]);

const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.css', '.scss', '.sass', '.less',
  '.html', '.md', '.txt', '.yml', '.yaml',
  '.xml', '.gradle', '.properties',
  '.gitignore', '.gitattributes',
  '.c', '.cpp', '.h',
]);

const CONFLICT_START = /^<{7}(\s|$)/;
const CONFLICT_MID = /^={7}(\s|$)/;
const CONFLICT_END = /^>{7}(\s|$)/;

function shouldExcludeDir(relPath) {
  const parts = relPath.split(path.sep).filter(Boolean);
  // Exclude if any segment is in EXCLUDE_DIRS
  for (const p of parts) {
    if (EXCLUDE_DIRS.has(p)) return true;
  }
  // Also exclude nested duplicated repo if present
  if (parts.includes('DNDPLHLS-master') && parts.length > 1) return true;
  return false;
}

function isTextCandidate(filePath) {
  const ext = path.extname(filePath);
  if (TEXT_EXTS.has(ext)) return true;
  // Also scan files with no ext but known names
  const base = path.basename(filePath);
  return base === 'Dockerfile' || base === 'Makefile' || base === 'LICENSE';
}

function fileHasConflictMarkers(absPath) {
  // Read small chunk first to skip binaries quickly
  const fd = fs.openSync(absPath, 'r');
  try {
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    if (n <= 0) return false;
    // If contains NUL, treat as binary
    for (let i = 0; i < n; i++) {
      if (buf[i] === 0) return false;
    }
  } finally {
    fs.closeSync(fd);
  }

  const text = fs.readFileSync(absPath, 'utf8');
  const lines = text.split(/\r?\n/);
  let sawStart = false;
  let sawMid = false;
  for (const line of lines) {
    if (!sawStart) {
      if (CONFLICT_START.test(line)) {
        sawStart = true;
        sawMid = false;
      }
      continue;
    }
    if (!sawMid) {
      if (CONFLICT_MID.test(line)) {
        sawMid = true;
      } else if (CONFLICT_START.test(line)) {
        // Restart if we hit another start marker.
        sawStart = true;
        sawMid = false;
      }
      continue;
    }
    if (CONFLICT_END.test(line)) return true;
    if (CONFLICT_START.test(line)) {
      sawStart = true;
      sawMid = false;
    }
  }
  return false;
}

function walk(dirAbs, relBase = '') {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  const hits = [];
  for (const e of entries) {
    const rel = path.join(relBase, e.name);
    const abs = path.join(dirAbs, e.name);

    if (e.isDirectory()) {
      if (shouldExcludeDir(rel)) continue;
      hits.push(...walk(abs, rel));
      continue;
    }

    if (!e.isFile()) continue;
    if (!isTextCandidate(abs)) continue;
    if (EXCLUDE_FILES.has(rel)) continue;

    try {
      if (fileHasConflictMarkers(abs)) hits.push(rel);
    } catch {
      // Ignore unreadable files
    }
  }
  return hits;
}

const matches = walk(ROOT, '');
if (matches.length) {
  console.error('Found git conflict markers in:');
  for (const m of matches) console.error(`- ${m}`);
  process.exit(1);
}

console.log('No git conflict markers found.');
