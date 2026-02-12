/**
 * museum_p1_baseline_report
 * Prints line counts for key files used in P1 batches.
 *
 * Run: pnpm museum:p1-baseline
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const TARGETS = [
  'components/museum/MuseumScene.tsx',
  'components/museum/MuseumArchitecture.tsx',
  'components/museum/MuseumLighting.tsx',
  'components/museum/MuseumWayfinding.tsx',
  'components/museum/materials.ts'
];

function lc(file) {
  const txt = fs.readFileSync(file, 'utf8');
  return txt.split(/\r?\n/).length;
}

console.log('\nP1 baseline (line counts)\n');
for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.log(`${rel}: MISSING`);
    continue;
  }
  console.log(`${rel}: ${lc(abs)}`);
}

console.log('\nScreenshots to capture (fixed views):');
console.log('1) Entrance looking down spine');
console.log('2) Gallery door threshold (close)');
console.log('3) Wall–floor corner (AO/contact)');
console.log('4) ExhibitStand on floor (contact)');
console.log('5) Finale interior wall planes (gradient)\n');
