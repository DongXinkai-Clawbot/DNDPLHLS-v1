/**
 * museum_p2_texture_report
 * Prints dimensions of P2 baked textures in /public/lightmaps (PNG only).
 *
 * Run: pnpm museum:p2-texture-report
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LM_DIR = path.join(ROOT, 'public', 'lightmaps');

function readPngIHDR(file) {
  const buf = fs.readFileSync(file);
  const sig = buf.subarray(0, 8);
  const pngSig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  if (!sig.equals(pngSig)) return null;
  const type = buf.subarray(12, 16).toString('ascii');
  if (type !== 'IHDR') return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { width: w, height: h };
}

console.log('\nP2 texture report: /public/lightmaps\n');
if (!fs.existsSync(LM_DIR)) {
  console.log('Missing directory:', LM_DIR);
  process.exit(1);
}

const files = fs.readdirSync(LM_DIR).filter((f) => f.toLowerCase().endsWith('.png')).sort();
for (const f of files) {
  const p = path.join(LM_DIR, f);
  const ihdr = readPngIHDR(p);
  if (!ihdr) {
    console.log(`${f}: (not a valid PNG?)`);
  } else {
    console.log(`${f}: ${ihdr.width}x${ihdr.height}`);
  }
}

console.log('\nNote: 1x1 indicates placeholder. Replace with baked outputs before judging lighting.\n');
