import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';

function spawnAsync(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

const baselineFile = 'ui_baseline/dist.sha256';
const currentFile = 'ui_baseline/dist.current.sha256';

try {
  await fs.access(baselineFile);
} catch {
  console.error(`Missing ${baselineFile}. Run: npm run ui:baseline`);
  process.exit(2);
}

const nodeCmd = process.platform === 'win32' ? 'node.exe' : 'node';
await spawnAsync(nodeCmd, ['scripts/ui_fingerprint.mjs', '--write', currentFile, '--build']);

const [baseline, current] = await Promise.all([
  fs.readFile(baselineFile, 'utf8'),
  fs.readFile(currentFile, 'utf8'),
]);

if (baseline === current) {
  await fs.unlink(currentFile).catch(() => {});
  console.log('UI fingerprint matches baseline.');
  process.exit(0);
}

console.error('UI fingerprint differs from baseline.');
process.exit(1);
