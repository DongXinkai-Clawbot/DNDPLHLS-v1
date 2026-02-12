import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PATH = path.join(__dirname, '..', 'assets', 'hunt205_ring_layout.json');

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
};

const reportError = (errors, message) => {
  errors.push(message);
};

const toIdSet = (items, key) => {
  const set = new Set();
  items.forEach((item) => set.add(item[key]));
  return set;
};

const buildRange = (min, max) => {
  const list = [];
  for (let i = min; i <= max; i += 1) list.push(i);
  return list;
};

const validateLayout = (layout) => {
  const errors = [];
  if (!layout || typeof layout !== 'object') {
    reportError(errors, 'Layout root is not an object.');
    return { ok: false, errors };
  }

  const tones = Array.isArray(layout.tones) ? layout.tones : [];
  const labels = Array.isArray(layout.labels) ? layout.labels : [];
  const meta = layout.meta || {};

  if (tones.length !== 41) {
    reportError(errors, `tones count mismatch: expected 41, got ${tones.length}`);
  }
  if (labels.length !== 245) {
    reportError(errors, `labels count mismatch: expected 245, got ${labels.length}`);
  }

  const toneIds = toIdSet(tones, 'tone_id');
  const labelIds = toIdSet(labels, 'label_id');

  const expectedToneIds = buildRange(0, 40);
  expectedToneIds.forEach((id) => {
    if (!toneIds.has(id)) reportError(errors, `tone_id missing: ${id}`);
  });

  const expectedLabelIds = buildRange(0, 244);
  expectedLabelIds.forEach((id) => {
    if (!labelIds.has(id)) reportError(errors, `label_id missing: ${id}`);
  });

  const allowedLayers = Array.isArray(meta.radial_layers) && meta.radial_layers.length
    ? new Set(meta.radial_layers)
    : new Set([0, 1, 2]);

  labels.forEach((label) => {
    if (!Number.isInteger(label.parent_tone_id) || label.parent_tone_id < 0 || label.parent_tone_id > 40) {
      reportError(errors, `label ${label.label_id} has invalid parent_tone_id: ${label.parent_tone_id}`);
    }
    if (!allowedLayers.has(label.radial_layer)) {
      reportError(errors, `label ${label.label_id} has invalid radial_layer: ${label.radial_layer}`);
    }
  });

  return { ok: errors.length === 0, errors };
};

const filePath = process.argv[2] || DEFAULT_PATH;
if (!fs.existsSync(filePath)) {
  console.error(JSON.stringify({ ok: false, errors: [`File not found: ${filePath}`] }, null, 2));
  process.exit(1);
}

try {
  const layout = readJson(filePath);
  const result = validateLayout(layout);
  console.log(JSON.stringify({ file: filePath, ...result }, null, 2));
  if (!result.ok) process.exit(1);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ ok: false, errors: [`Failed to parse JSON: ${message}`] }, null, 2));
  process.exit(1);
}
