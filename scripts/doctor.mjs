import { spawn } from 'node:child_process';

function spawnAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'cmd.exe' : 'npm';
const npmArgsPrefix = isWindows ? ['/c', 'npm'] : [];

const steps = [
  { label: '[1/6] check:conflicts', cmd: npmCmd, args: [...npmArgsPrefix, 'run', 'check:conflicts'] },
  { label: '[2/6] lint (boundary guard)', cmd: npmCmd, args: [...npmArgsPrefix, 'run', 'lint'] },
  { label: '[3/6] depcheck (no circular deps)', cmd: npmCmd, args: [...npmArgsPrefix, 'run', 'depcheck'] },
  { label: '[4/6] typecheck', cmd: npmCmd, args: [...npmArgsPrefix, 'run', 'typecheck'] },
  { label: '[5/6] test', cmd: npmCmd, args: [...npmArgsPrefix, 'test'] },
  { label: '[6/6] ui:check:shots (build + preview + screenshots)', cmd: npmCmd, args: [...npmArgsPrefix, 'run', 'ui:check'] },
];

for (const s of steps) {
  console.log(`\n==> ${s.label}`);
  await spawnAsync(s.cmd, s.args);
}

console.log('\nAll checks passed.');
