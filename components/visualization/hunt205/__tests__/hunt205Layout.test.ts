import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildToneAngleTable } from '../Hunt205LayoutLoader';

const loadLayout = () => {
  const filePath = path.resolve(__dirname, '../../../../assets/hunt205_ring_layout.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

const EPS = 1e-6;

const approx = (a: number, b: number, tol = 1e-3) => Math.abs(a - b) <= tol;

describe('Hunt205 layout', () => {
  it('has 41 tones and 245 labels with complete id coverage', () => {
    const layout = loadLayout();
    expect(layout.tones).toHaveLength(41);
    expect(layout.labels).toHaveLength(245);

    const toneIds = layout.tones.map(t => t.tone_id).sort((a, b) => a - b);
    const labelIds = layout.labels.map(l => l.label_id).sort((a, b) => a - b);

    expect(toneIds[0]).toBe(0);
    expect(toneIds[toneIds.length - 1]).toBe(40);
    expect(new Set(toneIds).size).toBe(41);

    expect(labelIds[0]).toBe(0);
    expect(labelIds[labelIds.length - 1]).toBe(244);
    expect(new Set(labelIds).size).toBe(245);
  });

  it('builds angle table with tone_id 0 at -90 degrees and consistent steps', () => {
    const layout = loadLayout();
    const table = buildToneAngleTable(layout);
    const stepDeg = 360 / 41;
    const tone0 = table.byToneId.get(0);
    const tone1 = table.byToneId.get(1);
    expect(tone0).toBeTruthy();
    expect(tone1).toBeTruthy();
    if (!tone0 || !tone1) return;

    expect(approx(tone0.angleRad, -Math.PI / 2, EPS)).toBe(true);
    expect(approx(tone0.angleDeg, -90, 1e-6)).toBe(true);
    expect(approx(tone1.angleDeg - tone0.angleDeg, stepDeg, 1e-6)).toBe(true);
  });

  it('stores angle degrees and radians for every tone', () => {
    const layout = loadLayout();
    const table = buildToneAngleTable(layout);
    expect(table.list).toHaveLength(layout.tones.length);
    table.list.forEach((entry) => {
      expect(Number.isFinite(entry.angleDeg)).toBe(true);
      expect(Number.isFinite(entry.angleRad)).toBe(true);
    });
  });
});