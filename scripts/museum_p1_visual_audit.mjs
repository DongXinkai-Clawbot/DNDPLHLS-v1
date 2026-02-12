/**
 * museum_p1_visual_audit
 * Guardrails for P1 visual realism work.
 *
 * Goals:
 * - Prevent regression to “gamey” visuals:
 *   - no transparent/emissive runway wayfinding
 *   - no animated “breathe” guide lighting
 *   - keep dynamic shadow-casters constrained by tier
 *
 * Run: pnpm museum:p1-visual-audit
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const FILES = [
  'components/museum/MuseumScene.tsx',
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

for (const file of FILES) {
  if (!fs.existsSync(file)) {
    findings.push({ file, message: 'Missing expected file (audit target).' });
    continue;
  }
  const txt = read(file);

  if (path.basename(file) === 'MuseumWayfinding.tsx') {
    const transparentHits = findAll(txt, /\btransparent\b/gi);
    const emissiveIntHigh = findAll(txt, /emissiveIntensity=\{0\.(1[0-9]|[2-9][0-9])\}/g); // >= 0.10
    if (transparentHits.length) {
      findings.push({ file, message: 'Wayfinding uses transparent material; prefer physical inlay geometry.' });
    }
    if (emissiveIntHigh.length) {
      findings.push({ file, message: 'Wayfinding emissiveIntensity too high; should not drive readability.' });
    }
  }

  if (path.basename(file) === 'MuseumLighting.tsx') {
    const breatheHits = findAll(txt, /\bbreathe\b/gi);
    if (breatheHits.length) {
      findings.push({ file, message: 'Found "breathe" in MuseumLighting.tsx. Keep guide lights static.' });
    }
    // basic heuristic: medium/low should not enable shadows explicitly
    const mediumShadow = findAll(txt, /qualityProfiles\s*=\s*\{[\s\S]*?medium:[\s\S]*?shadows:\s*true/gi);
    if (mediumShadow.length) {
      findings.push({ file, message: 'Medium tier shadows enabled. Prefer baked/AO strategies.' });
    }
  }

  if (path.basename(file) === 'MuseumScene.tsx') {
    // If physicallyCorrectLights is toggled, it must be documented; fail if both legacy and physicallyCorrect are forced off/on inconsistently.
    const legacyHits = findAll(txt, /useLegacyLights\s*=\s*true/gi);
    const physOffHits = findAll(txt, /physicallyCorrectLights\s*=\s*false/gi);
    if (!legacyHits.length || !physOffHits.length) {
      // We allow future change, but it must be intentional. For P1 we keep current behavior stable.
      findings.push({
        file,
        message:
          'Renderer light mode changed (legacy/physicallyCorrect). If you change this, update P1 checklist + budgets.'
      });
    }
  }
}

if (findings.length) {
  console.error('\nMuseum P1 visual audit: FAIL\n');
  for (const f of findings) console.error(`- ${f.file}: ${f.message}`);
  console.error('\nFix findings (or update docs intentionally) and re-run.\n');
  process.exit(1);
}

console.log('Museum P1 visual audit: PASS');
