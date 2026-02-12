/**
 * museum_p2_bake_asset_audit
 * Guardrails for P2 baked-lighting asset contract.
 *
 * Checks:
 * - required files exist in /public/lightmaps
 * - files are not 1x1 placeholders (warn/fail depending on mode)
 * - filenames follow contract (<group>_lm.png)
 *
 * Run:
 *  - pnpm museum:p2-bake-audit
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LM_DIR = path.join(ROOT, 'public', 'lightmaps');

const REQUIRED = ['wall_lm.png', 'floor_lm.png', 'finale_lm.png'];

function statSafe(p) {
  try { return fs.statSync(p); } catch { return null; }
}

function isPng(p) {
  return p.toLowerCase().endsWith('.png');
}

function readPngIHDR(file) {
  // Minimal PNG IHDR parse (width/height) without dependencies.
  const buf = fs.readFileSync(file);
  const sig = buf.subarray(0, 8);
  const pngSig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  if (!sig.equals(pngSig)) return null;
  // IHDR chunk starts at byte 8: length(4) + type(4) + data...
  const type = buf.subarray(12, 16).toString('ascii');
  if (type !== 'IHDR') return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { width: w, height: h };
}

const findings = [];

if (!statSafe(LM_DIR)) {
  findings.push(`Missing directory: ${LM_DIR}`);
} else {
  // Required files
  for (const f of REQUIRED) {
    const p = path.join(LM_DIR, f);
    if (!statSafe(p)) findings.push(`Missing required lightmap: ${f}`);
  }

  // Contract: name pattern
  const all = fs.readdirSync(LM_DIR).filter((f) => isPng(f));
  for (const f of all) {
    if (!/^[a-z0-9]+_(lm|ao)\.png$/i.test(f)) {
      findings.push(`Filename violates contract (expected <group>_(lm|ao).png): ${f}`);
    }
  }

  // Placeholder detection (1x1)
  for (const f of REQUIRED) {
    const p = path.join(LM_DIR, f);
    if (!statSafe(p)) continue;
    const ihdr = readPngIHDR(p);
    if (ihdr && ihdr.width === 1 && ihdr.height === 1) {
      const allow = process.env.ALLOW_PLACEHOLDERS === '1';
      if (!allow) findings.push(`Placeholder detected (1x1): ${f} — replace with baked output (or set ALLOW_PLACEHOLDERS=1 for dev)`);
    }
  }
}

if (findings.length) {
  console.error('\nMuseum P2 bake asset audit: FAIL\n');
  for (const s of findings) console.error(`- ${s}`);
  console.error('\nFix the asset contract issues and re-run.\n');
  process.exit(1);
}

console.log('Museum P2 bake asset audit: PASS');
