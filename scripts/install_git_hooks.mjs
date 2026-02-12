import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const GIT_DIR = path.join(ROOT, '.git');
const HOOKS_PATH = '.githooks';
const PRE_COMMIT = path.join(ROOT, HOOKS_PATH, 'pre-commit');

function log(msg) {
  console.log(`[hooks] ${msg}`);
}

// If this folder is used as a zip drop (no .git), do nothing and succeed.
if (!fs.existsSync(GIT_DIR)) {
  log('No .git directory found; skipping hook installation.');
  process.exit(0);
}

const git = process.platform === 'win32' ? 'git.exe' : 'git';

// If git is not available, do nothing and succeed.
const gitVersion = spawnSync(git, ['--version'], { stdio: 'ignore' });
if (gitVersion.status !== 0) {
  log('git not found; skipping hook installation.');
  process.exit(0);
}

// Ensure the pre-commit hook script exists.
if (!fs.existsSync(PRE_COMMIT)) {
  log(`Missing ${HOOKS_PATH}/pre-commit; skipping hook installation.`);
  process.exit(0);
}

// Point git to the repo-local hooks folder.
const cfg = spawnSync(git, ['config', 'core.hooksPath', HOOKS_PATH], { stdio: 'ignore' });
if (cfg.status !== 0) {
  log('Failed to set core.hooksPath; skipping hook installation.');
  process.exit(0);
}

// Best-effort make executable on POSIX.
try {
  fs.chmodSync(PRE_COMMIT, 0o755);
} catch {
  // Ignore on platforms that don't support chmod
}

log(`Installed git hooks (core.hooksPath=${HOOKS_PATH}).`);
