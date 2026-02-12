import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
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

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function listFilesRecursive(dir) {
  const out = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out;
}

function parseArgs(argv) {
  const args = { outFile: 'ui_baseline/dist.sha256', doBuild: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write') {
      args.outFile = argv[++i] ?? args.outFile;
    } else if (a === '--build') {
      args.doBuild = true;
    }
  }
  return args;
}

const { outFile, doBuild } = parseArgs(process.argv);

if (doBuild) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await spawnAsync(npmCmd, ['run', 'build']);
}

const distDir = path.resolve('dist');
const files = await listFilesRecursive(distDir);

// Stable C-locale style sort on normalized relative paths.
const rel = files.map((f) => {
  const r = path.relative(distDir, f).split(path.sep).join('/');
  return { abs: f, rel: `./${r}` };
});
rel.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

const lines = [];
for (const f of rel) {
  const h = await sha256File(f.abs);
  lines.push(`${h}  ${f.rel}`);
}

await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');

console.log(`Wrote UI fingerprint: ${outFile}`);
