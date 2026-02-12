/**
 * museum_p0_audit
 * Lightweight guardrails to prevent regressions on P0 "museum-ness":
 * - no "follow the floor line" onboarding copy
 * - no breathe / pulsing guide lights
 * - wayfinding should not rely on transparent emissive runway materials
 *
 * Run: pnpm museum:p0-audit
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const TARGET_FILES = [
  'components/museum/MuseumUX.tsx',
  'components/museum/MuseumHUD.tsx',
  'components/museum/MuseumLighting.tsx',
  'components/museum/MuseumWayfinding.tsx'
].map((p) => path.join(ROOT, p));

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function findAll(text, re) {
  const out = [];
  let m;
  while ((m = re.exec(text))) out.push(m[0]);
  return out;
}

const findings = [];

for (const file of TARGET_FILES) {
  if (!fs.existsSync(file)) {
    findings.push({ file, message: 'Missing expected file (audit target).' });
    continue;
  }
  const txt = read(file);

  // 1) Onboarding / HUD copy should not instruct route-following
  const copyHits = findAll(txt, /follow the floor line/gi);
  if (copyHits.length) {
    findings.push({ file, message: 'Route-instruction copy found ("follow the floor line").', excerpt: copyHits[0] });
  }

  // 2) No breathe/pulse guide lights (we keep the codebase clean even if not used)
  const breatheHits = findAll(txt, /\bbreathe\b/gi);
  if (path.basename(file) === 'MuseumLighting.tsx' && breatheHits.length) {
    findings.push({ file, message: 'Found "breathe" in MuseumLighting.tsx. Remove/avoid animated guide intensities.' });
  }

  // 3) Wayfinding runway guard: avoid transparent emissive reliance
  if (path.basename(file) === 'MuseumWayfinding.tsx') {
    const transparentHits = findAll(txt, /transparent\s*\n|transparent\s/g);
    const emissiveIntHits = findAll(txt, /emissiveIntensity=\{0\.(1[0-9]|[2-9][0-9])\}/g); // >= 0.10
    if (transparentHits.length) {
      findings.push({ file, message: 'Wayfinding uses transparent material; prefer physical inlay geometry.', excerpt: transparentHits[0] });
    }
    if (emissiveIntHits.length) {
      findings.push({
        file,
        message: 'Wayfinding emissiveIntensity too high; should not be primary readability.',
        excerpt: emissiveIntHits[0]
      });
    }
  }
}

if (findings.length) {
  console.error('\nMuseum P0 audit: FAIL\n');
  for (const f of findings) {
    console.error(`- ${f.file}: ${f.message}${f.excerpt ? `\n  ↳ ${f.excerpt}` : ''}`);
  }
  console.error('\nFix findings and re-run.\n');
  process.exit(1);
}

console.log('Museum P0 audit: PASS');
