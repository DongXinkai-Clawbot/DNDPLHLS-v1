import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHunt205Layout } from '../components/visualization/hunt205/Hunt205LayoutLoader';
import { resolveToneBindings } from '../components/visualization/hunt205/Hunt205ToneResolver';
import { computeToneStates, DEFAULT_HUNT205_RING_CONFIG } from '../components/visualization/hunt205/Hunt205RingRenderer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const layout = loadHunt205Layout();
const report = {
  meta: {
    timestamp: new Date().toISOString(),
    tones: layout.tones.length,
    labels: layout.labels.length,
    layoutSource: layout.meta?.source ?? null,
    periodCents: layout.meta?.period_cents ?? 1200
  },
  tests: []
};

const assert = (cond, message) => {
  if (!cond) {
    const err = new Error(message);
    err.name = 'AssertionError';
    throw err;
  }
};

const tone0 = layout.tones[0];
const tone1 = layout.tones[1];
const tone2 = layout.tones[2];
const label0 = layout.labels[0];

const makeEvent = (id, start, end, pitch, velocity = 0.7) => ({
  event_id: id,
  start_time_ms: start,
  end_time_ms: end,
  pitch_representation: pitch,
  velocity
});

const pushTest = (id, detail) => {
  report.tests.push({ id, ...detail });
};

try {
  // T1: single note (cents)
  const eventsT1 = [
    makeEvent('T1-note', 0, 1000, { type: 'cents', cents: tone0.cent_value }, 0.6)
  ];
  const bindingsT1 = resolveToneBindings(eventsT1, layout, { periodCents: report.meta.periodCents });
  assert(bindingsT1[0].tone_id === tone0.tone_id, 'T1: tone mapping mismatch');
  const statesT1a = computeToneStates(bindingsT1, 100, DEFAULT_HUNT205_RING_CONFIG);
  const stateT1a = statesT1a.get(tone0.tone_id);
  assert(stateT1a?.activeCount === 1, 'T1: expected activeCount=1 at 100ms');
  const statesT1b = computeToneStates(bindingsT1, 1200, DEFAULT_HUNT205_RING_CONFIG);
  const stateT1b = statesT1b.get(tone0.tone_id);
  assert(stateT1b?.activeCount === 0, 'T1: expected inactive after end');
  pushTest('T1', { bindings: bindingsT1, sample: { at100: stateT1a, at1200: stateT1b } });

  // T2: alternating notes
  const eventsT2 = [
    makeEvent('T2-a', 0, 200, { type: 'cents', cents: tone0.cent_value }, 0.5),
    makeEvent('T2-b', 220, 420, { type: 'cents', cents: tone1.cent_value }, 0.55)
  ];
  const bindingsT2 = resolveToneBindings(eventsT2, layout, { periodCents: report.meta.periodCents });
  assert(bindingsT2[0].tone_id === tone0.tone_id, 'T2: first tone mapping mismatch');
  assert(bindingsT2[1].tone_id === tone1.tone_id, 'T2: second tone mapping mismatch');
  const stateT2a = computeToneStates(bindingsT2, 100, DEFAULT_HUNT205_RING_CONFIG).get(tone0.tone_id);
  const stateT2b = computeToneStates(bindingsT2, 300, DEFAULT_HUNT205_RING_CONFIG).get(tone1.tone_id);
  assert(stateT2a?.activeCount === 1, 'T2: expected tone0 active at 100ms');
  assert(stateT2b?.activeCount === 1, 'T2: expected tone1 active at 300ms');
  pushTest('T2', { bindings: bindingsT2, sample: { at100: stateT2a, at300: stateT2b } });

  // T3: chord
  const eventsT3 = [
    makeEvent('T3-a', 0, 500, { type: 'cents', cents: tone0.cent_value }, 0.7),
    makeEvent('T3-b', 0, 500, { type: 'cents', cents: tone1.cent_value }, 0.75),
    makeEvent('T3-c', 0, 500, { type: 'cents', cents: tone2.cent_value }, 0.8)
  ];
  const bindingsT3 = resolveToneBindings(eventsT3, layout, { periodCents: report.meta.periodCents });
  const statesT3 = computeToneStates(bindingsT3, 100, DEFAULT_HUNT205_RING_CONFIG);
  assert(statesT3.get(tone0.tone_id)?.activeCount === 1, 'T3: tone0 should be active');
  assert(statesT3.get(tone1.tone_id)?.activeCount === 1, 'T3: tone1 should be active');
  assert(statesT3.get(tone2.tone_id)?.activeCount === 1, 'T3: tone2 should be active');
  pushTest('T3', { bindings: bindingsT3, sample: { at100: {
    t0: statesT3.get(tone0.tone_id),
    t1: statesT3.get(tone1.tone_id),
    t2: statesT3.get(tone2.tone_id)
  } } });

  // T4: rapid arpeggio
  const eventsT4 = [];
  for (let i = 0; i < 6; i += 1) {
    const tone = layout.tones[i % 3];
    eventsT4.push(makeEvent(`T4-${i}`, i * 60, i * 60 + 40, { type: 'cents', cents: tone.cent_value }, 0.65));
  }
  const bindingsT4 = resolveToneBindings(eventsT4, layout, { periodCents: report.meta.periodCents });
  const statesT4 = computeToneStates(bindingsT4, 120, DEFAULT_HUNT205_RING_CONFIG);
  const activeT4 = Array.from(statesT4.values()).filter((s) => s.activeCount > 0).length;
  assert(activeT4 >= 1, 'T4: expected at least one active tone during arpeggio');
  pushTest('T4', { bindings: bindingsT4, activeCountAt120: activeT4 });

  // T5: overlapping same tone
  const eventsT5 = [
    makeEvent('T5-a', 0, 500, { type: 'cents', cents: tone0.cent_value }, 0.6),
    makeEvent('T5-b', 200, 700, { type: 'cents', cents: tone0.cent_value }, 0.8)
  ];
  const bindingsT5 = resolveToneBindings(eventsT5, layout, { periodCents: report.meta.periodCents });
  const statesT5a = computeToneStates(bindingsT5, 300, DEFAULT_HUNT205_RING_CONFIG);
  const overlapState = statesT5a.get(tone0.tone_id);
  assert(overlapState?.activeCount === 2, 'T5: expected activeCount=2 during overlap');
  const statesT5b = computeToneStates(bindingsT5, 600, DEFAULT_HUNT205_RING_CONFIG);
  const tailState = statesT5b.get(tone0.tone_id);
  assert(tailState?.activeCount === 1, 'T5: expected activeCount=1 after first note ends');
  pushTest('T5', { bindings: bindingsT5, sample: { at300: overlapState, at600: tailState } });

  // Label mapping test (if any label exists)
  if (label0?.text) {
    const eventsLabel = [
      makeEvent('T-label', 0, 100, { type: 'label', label: label0.text }, 0.5)
    ];
    const bindingsLabel = resolveToneBindings(eventsLabel, layout, { periodCents: report.meta.periodCents });
    assert(bindingsLabel[0].label_id === label0.label_id, 'Label mapping: label_id mismatch');
    assert(bindingsLabel[0].tone_id === label0.parent_tone_id, 'Label mapping: tone_id mismatch');
    pushTest('Label', { bindings: bindingsLabel });
  }

  report.status = 'ok';
} catch (err) {
  report.status = 'failed';
  report.error = { name: err?.name || 'Error', message: err?.message || String(err) };
  report.stack = err?.stack || null;
  process.exitCode = 1;
}

const outDir = path.join(__dirname, '..', 'test-results');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, 'hunt205_testcases_report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`Hunt205 testcases report written to ${outPath}`);

