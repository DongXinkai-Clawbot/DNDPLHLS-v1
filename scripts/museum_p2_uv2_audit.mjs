/**
 * museum_p2_uv2_audit
 * Lightweight guardrails for P2 Batch 1 (UV2 unwrap readiness).
 *
 * This is a static-code audit to prevent regressions:
 * - merged static geometries must ensure uv2 exists (copy uv -> uv2)
 * - baked lighting hookup must use uv2-driven maps (aoMap/lightMap)
 *
 * Run: pnpm museum:p2-uv2-audit
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ARCH = path.join(ROOT, 'components/museum/MuseumArchitecture.tsx');

const findings = [];

if (!fs.existsSync(ARCH)) {
  findings.push('Missing MuseumArchitecture.tsx');
} else {
  const txt = fs.readFileSync(ARCH, 'utf8');

  if (!txt.includes("setAttribute('uv2'") && !txt.includes('setAttribute("uv2"')) {
    findings.push('UV2 not ensured on merged geometries (expected uv -> uv2 copy).');
  }

  const usesLightMap = /lightMap=\{/.test(txt);
  const usesAoMap = /aoMap=\{/.test(txt);

  if (!usesLightMap) findings.push('No lightMap hook detected in MuseumArchitecture.tsx (expected for P2).');
  if (!usesAoMap) findings.push('No aoMap hook detected in MuseumArchitecture.tsx (expected for P2).');

  // Guard: prevent enabling runtime SSAO for P2 (should be baked strategy)
  if (/SSAO|AmbientOcclusionPass|EffectComposer/.test(txt)) {
    findings.push('Found SSAO/post stack references in MuseumArchitecture.tsx. P2 must rely on baked AO.');
  }
}

if (findings.length) {
  console.error('\nMuseum P2 UV2 audit: FAIL\n');
  for (const f of findings) console.error(`- ${f}`);
  console.error('\nFix findings and re-run.\n');
  process.exit(1);
}

console.log('Museum P2 UV2 audit: PASS');
