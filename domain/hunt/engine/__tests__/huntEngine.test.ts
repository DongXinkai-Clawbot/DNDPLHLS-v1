import { parseMusicXmlString } from '../../../musicxml/parseMusicXml';
import { buildHuntEngine } from '../index';

const buildEngine = (xml: string) => {
  const result = parseMusicXmlString(xml, { ticksPerQuarter: 480, sourceType: 'xml' });
  return buildHuntEngine(result, { ticksPerQuarter: 480 });
};

const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>`;

const wrapScore = (body: string) => `${xmlHeader}\n<score-partwise version="3.1">\n  <part-list>\n    <score-part id="P1"><part-name>Test</part-name></score-part>\n  </part-list>\n  <part id="P1">\n${body}\n  </part>\n</score-partwise>`;

test('splits notes crossing forbidden beat boundaries in 4/4', () => {
  const xml = wrapScore(`    <measure number="1">\n      <attributes>\n        <divisions>1</divisions>\n        <time><beats>4</beats><beat-type>4</beat-type></time>\n      </attributes>\n      <note>\n        <rest/>\n        <duration>1</duration>\n        <voice>1</voice>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch><step>C</step><octave>4</octave></pitch>\n        <duration>2</duration>\n        <voice>1</voice>\n        <type>half</type>\n      </note>\n      <note>\n        <rest/>\n        <duration>1</duration>\n        <voice>1</voice>\n        <type>quarter</type>\n      </note>\n    </measure>`);
  const engine = buildEngine(xml);
  const measure = engine.logical.measures[0];
  const notes = measure.events.filter((e) => e.kind === 'note');
  const starts = notes.map((n) => n.startTick).sort((a, b) => a - b);
  expect(starts).toEqual([480, 960]);
  const tieStarts = notes.map((n: any) => n.tieStart).filter(Boolean).length;
  const tieStops = notes.map((n: any) => n.tieStop).filter(Boolean).length;
  expect(tieStarts).toBeGreaterThan(0);
  expect(tieStops).toBeGreaterThan(0);
});

test('groups beams within 6/8 beat boundaries', () => {
  const xml = wrapScore(`    <measure number="1">\n      <attributes>\n        <divisions>2</divisions>\n        <time><beats>6</beats><beat-type>8</beat-type></time>\n      </attributes>\n      ${Array.from({ length: 6 })
        .map(
          () => `      <note>\n        <pitch><step>C</step><octave>4</octave></pitch>\n        <duration>1</duration>\n        <voice>1</voice>\n        <type>eighth</type>\n      </note>`
        )
        .join('\n')}
    </measure>`);
  const engine = buildEngine(xml);
  const level1Beams = engine.layout.beams.filter((b) => b.level === 1);
  expect(level1Beams.length).toBeGreaterThanOrEqual(2);
  const ticksByBeam = level1Beams.map((beam) =>
    beam.noteIds
      .map((id) => {
        const note = engine.layout.events.find((e) => e.id === id);
        return note?.startTick ?? 0;
      })
      .sort((a, b) => a - b)
  );
  const hasSplit =
    ticksByBeam.some((ticks) => ticks[0] === 0 && ticks[ticks.length - 1] <= 720) &&
    ticksByBeam.some((ticks) => ticks[0] >= 720);
  expect(hasSplit).toBe(true);
});

test('assigns stem direction for multiple voices', () => {
  const xml = wrapScore(`    <measure number="1">\n      <attributes>\n        <divisions>1</divisions>\n        <time><beats>4</beats><beat-type>4</beat-type></time>\n      </attributes>\n      <note>\n        <pitch><step>C</step><octave>5</octave></pitch>\n        <duration>1</duration>\n        <voice>1</voice>\n        <type>quarter</type>\n      </note>\n      <backup><duration>1</duration></backup>\n      <note>\n        <pitch><step>C</step><octave>3</octave></pitch>\n        <duration>1</duration>\n        <voice>2</voice>\n        <type>quarter</type>\n      </note>\n    </measure>`);
  const engine = buildEngine(xml);
  const notes = engine.layout.events.filter((e) => e.kind === 'note');
  const voice1 = notes.find((n) => n.voiceId.includes('voice-1')) as any;
  const voice2 = notes.find((n) => n.voiceId.includes('voice-2')) as any;
  expect(voice1?.stem?.direction).toBe('up');
  expect(voice2?.stem?.direction).toBe('down');
});
