import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const layoutPath = path.join(__dirname, '..', 'assets', 'hunt205_ring_layout.json');

const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));
const tones = layout.tones ?? [];
const labels = layout.labels ?? [];
const N = tones.length || 41;

const angleTable = tones.map((tone) => {
  const idx = Number.isFinite(tone.angle_index) ? tone.angle_index : tone.tone_id;
  const rad = (idx / N) * Math.PI * 2 - Math.PI / 2;
  const deg = (rad * 180) / Math.PI;
  return { tone_id: tone.tone_id, angle_index: idx, angle_rad: rad, angle_deg: deg };
});

const sorted = [...angleTable].sort((a, b) => a.tone_id - b.tone_id);
const stepDegs = [];
for (let i = 1; i < sorted.length; i += 1) {
  stepDegs.push(sorted[i].angle_deg - sorted[i - 1].angle_deg);
}

const minStep = Math.min(...stepDegs);
const maxStep = Math.max(...stepDegs);

const report = {
  file: layoutPath,
  tones: tones.length,
  labels: labels.length,
  tone_id_min: Math.min(...tones.map(t => t.tone_id)),
  tone_id_max: Math.max(...tones.map(t => t.tone_id)),
  label_id_min: Math.min(...labels.map(l => l.label_id)),
  label_id_max: Math.max(...labels.map(l => l.label_id)),
  angle_step_deg_expected: 360 / N,
  angle_step_deg_min: minStep,
  angle_step_deg_max: maxStep,
  tone0_angle_deg: sorted[0]?.angle_deg,
  tone0_angle_rad: sorted[0]?.angle_rad,
  sample_angles: sorted.slice(0, 10)
};

console.log(JSON.stringify(report, null, 2));

if (layout?.meta?.source === 'placeholder-auto') {
  console.warn('WARN: layout meta.source indicates placeholder data; labels not sourced from screenshot.');
}