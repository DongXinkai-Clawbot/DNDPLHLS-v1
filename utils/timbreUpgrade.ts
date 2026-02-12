export type TimbreUpgradeInput = {
  sourceTypes?: string[];
  styleTargets?: string[];
  moodKeywords?: string[];
  reference?: string;
  enabledModules?: string[];
  maxDistortion?: string;
  dynamicRange?: string;
  space?: string;
  stereoWidth?: string;
  noiseTolerance?: string;
  outputFormat?: string;
  peakLimit?: string;
  truePeakLimit?: string;
  lufsTarget?: string;
};

export const TIMBRE_UPGRADE_OPTIONS = {
  sourceTypes: [
    'Vocal',
    'Drums',
    'Bass',
    'Guitar',
    'Piano',
    'Strings',
    'Brass',
    'Woodwinds',
    'Synth Lead',
    'Pad',
    'Pluck',
    'FX',
    'Ambient/Atmosphere',
    'Full Mix',
    'Other'
  ],
  styleTargets: ['Modern', 'Vintage', 'Cinematic', 'Electronic', 'Lo-fi', 'Hyperpop', 'Trap', 'Rock', 'Jazz', 'Classical', 'Experimental', 'Cyber', 'Ambient'],
  moodKeywords: ['Warm', 'Cold', 'Bright', 'Dark', 'Aggressive', 'Silky', 'Airy', 'Heavy', 'Transparent', 'Grainy', 'Metallic', 'Woody', 'Glassy'],
  maxDistortion: ['None', 'Light', 'Audible', 'Heavy'],
  dynamicRange: ['Wide', 'Medium', 'Tight', 'In-your-face'],
  space: ['Near', 'Mid', 'Far', 'Immersive', '3D'],
  stereoWidth: ['Narrow', 'Natural', 'Wide', 'Ultra-wide but mono-safe'],
  noiseTolerance: ['Zero', 'Some', 'Noticeable'],
  outputFormat: ['48k/24bit WAV', '44.1k/16bit WAV', 'Other'],
  peakLimitOptions: ['-1 dBFS', '-0.3 dBFS', '-2 dBFS'],
  truePeakLimitOptions: ['-1 dBTP', '-0.5 dBTP', '-2 dBTP'],
  lufsTargetOptions: ['-18 LUFS', '-14 LUFS', '-9 LUFS']
} as const;

export const DEFAULT_TIMBRE_UPGRADE_INPUT: TimbreUpgradeInput = {
  sourceTypes: ['Synth Lead'],
  styleTargets: ['Modern'],
  moodKeywords: ['Warm', 'Airy', 'Transparent'],
  reference: 'No reference - design from scratch.',
  enabledModules: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
  maxDistortion: 'Light',
  dynamicRange: 'Medium',
  space: 'Mid',
  stereoWidth: 'Natural',
  noiseTolerance: 'Some',
  outputFormat: '48k/24bit WAV',
  peakLimit: '-1 dBFS',
  truePeakLimit: '-1 dBTP',
  lufsTarget: '-14 LUFS'
};

type NormalizedInput = Required<TimbreUpgradeInput> & {
  defaultsUsed: string[];
  optionalBranches: string[];
};

const pickDefaults = (input?: TimbreUpgradeInput): NormalizedInput => {
  const defaultsUsed: string[] = [];
  const optionalBranches: string[] = [];

  const pickArray = (key: keyof TimbreUpgradeInput, fallback: string[], branches: string[]) => {
    const value = input?.[key];
    if (!Array.isArray(value) || value.length === 0) {
      defaultsUsed.push(String(key));
      optionalBranches.push(...branches);
      return [...fallback];
    }
    return [...value];
  };

  const pickValue = (key: keyof TimbreUpgradeInput, fallback: string, branches: string[]) => {
    const value = input?.[key];
    if (!value || value.trim().length === 0) {
      defaultsUsed.push(String(key));
      optionalBranches.push(...branches);
      return fallback;
    }
    return value;
  };

  const styleTargets = pickArray('styleTargets', DEFAULT_TIMBRE_UPGRADE_INPUT.styleTargets || [], [
    'Style options: Cinematic / Vintage / Experimental / Cyber'
  ]);

  const isLoud = styleTargets.some(s => s.includes('Hyperpop') || s.includes('Trap'));
  const isWide = styleTargets.some(s => s.includes('Ambient') || s.includes('Cinematic') || s.includes('Classical'));
  const autoLufs = isLoud ? '-9 LUFS' : isWide ? '-18 LUFS' : (DEFAULT_TIMBRE_UPGRADE_INPUT.lufsTarget || '-14 LUFS');

  const lufsTarget = input?.lufsTarget && input.lufsTarget.trim().length > 0 ? input.lufsTarget : autoLufs;
  if (!input?.lufsTarget) {
    defaultsUsed.push('lufsTarget');
    optionalBranches.push('LUFS options: -18 (wide dynamic/ambient/classical) / -14 (balanced) / -9 (louder)');
  }
  const optionalBranchSet = new Set(optionalBranches);
  if (optionalBranchSet.size === 0) {
    [
      'Source options: Vocal / Drums / Bass / Guitar / Piano / Strings / Brass / Woodwinds / Synth / Full Mix',
      'Module options: M1-M12 (enable/disable by role)',
      'Style options: Cinematic / Vintage / Experimental / Cyber',
      'Mood options: Bright / Dark / Aggressive / Silky',
      'Max distortion: None / Light / Audible / Heavy',
      'Dynamic range: Wide / Medium / Tight / In-your-face',
      'Space: Near / Mid / Far / Immersive / 3D',
      'Stereo width: Narrow / Natural / Wide / Ultra-wide but mono-safe',
      'Noise tolerance: Zero / Some / Noticeable',
      'Output format: 48k/24bit WAV / 44.1k/16bit WAV / Other',
      'Peak options: -1 dBFS (safe) / -0.3 dBFS (hotter)',
      'True peak options: -1 dBTP / -0.5 dBTP',
      'LUFS options: -18 (wide dynamic/ambient/classical) / -14 (balanced) / -9 (louder)'
    ].forEach(item => optionalBranchSet.add(item));
  }

  return {
    sourceTypes: pickArray('sourceTypes', DEFAULT_TIMBRE_UPGRADE_INPUT.sourceTypes || [], [
      'Source options: Vocal / Drums / Bass / Guitar / Piano / Strings / Brass / Woodwinds / Synth / Full Mix'
    ]),
    styleTargets,
    moodKeywords: pickArray('moodKeywords', DEFAULT_TIMBRE_UPGRADE_INPUT.moodKeywords || [], [
      'Mood options: Bright / Dark / Aggressive / Silky'
    ]),
    reference: pickValue('reference', DEFAULT_TIMBRE_UPGRADE_INPUT.reference || 'No reference.', [
      'Reference options: Track A/B/C or "No reference - design from scratch"'
    ]),
    enabledModules: pickArray('enabledModules', DEFAULT_TIMBRE_UPGRADE_INPUT.enabledModules || [], [
      'Module options: M1-M12 (enable/disable by role)'
    ]),
    maxDistortion: pickValue('maxDistortion', DEFAULT_TIMBRE_UPGRADE_INPUT.maxDistortion || 'Light', [
      'Max distortion: None / Light / Audible / Heavy'
    ]),
    dynamicRange: pickValue('dynamicRange', DEFAULT_TIMBRE_UPGRADE_INPUT.dynamicRange || 'Medium', [
      'Dynamic range: Wide / Medium / Tight / In-your-face'
    ]),
    space: pickValue('space', DEFAULT_TIMBRE_UPGRADE_INPUT.space || 'Mid', [
      'Space: Near / Mid / Far / Immersive / 3D'
    ]),
    stereoWidth: pickValue('stereoWidth', DEFAULT_TIMBRE_UPGRADE_INPUT.stereoWidth || 'Natural', [
      'Stereo width: Narrow / Natural / Wide / Ultra-wide but mono-safe'
    ]),
    noiseTolerance: pickValue('noiseTolerance', DEFAULT_TIMBRE_UPGRADE_INPUT.noiseTolerance || 'Some', [
      'Noise tolerance: Zero / Some / Noticeable'
    ]),
    outputFormat: pickValue('outputFormat', DEFAULT_TIMBRE_UPGRADE_INPUT.outputFormat || '48k/24bit WAV', [
      'Output format: 48k/24bit WAV / 44.1k/16bit WAV / Other'
    ]),
    peakLimit: pickValue('peakLimit', DEFAULT_TIMBRE_UPGRADE_INPUT.peakLimit || '-1 dBFS', [
      'Peak options: -1 dBFS (safe) / -0.3 dBFS (hotter)'
    ]),
    truePeakLimit: pickValue('truePeakLimit', DEFAULT_TIMBRE_UPGRADE_INPUT.truePeakLimit || '-1 dBTP', [
      'True peak options: -1 dBTP / -0.5 dBTP'
    ]),
    lufsTarget,
    defaultsUsed,
    optionalBranches: Array.from(optionalBranchSet)
  };
};

type ModuleSpec = {
  id: string;
  title: string;
  goal: string;
  ranges: string[];
  starting: string[];
  listening: string[];
  failures: string[];
  alternatives: string[];
  deep?: string[];
};

const moduleLibrary: ModuleSpec[] = [
  {
    id: 'M1',
    title: 'Cleanup & Repair (De-noise / De-click / De-ess / De-resonance)',
    goal: 'Remove non-musical noise and harsh resonances so later dynamics/saturation do not magnify problems.',
    ranges: [
      'De-noise reduction: 2-6 dB (conservative) / 6-12 dB (standard) / 12-20 dB (aggressive)',
      'De-noise smoothing: medium-high; threshold catches noise but preserves tails',
      'De-ess reduction: 1-3 dB / 3-6 dB / 6-10 dB',
      'De-resonance: Q=4-10, dynamic cut 1-4 dB (rarely >6 dB)',
      'De-plosive: 30-100 Hz dynamic EQ, Attack 0-10 ms, Release 80-200 ms',
      'De-click: threshold-based or manual cleanup on sharp clicks'
    ],
    starting: [
      'Capture a noise print or use adaptive mode; prefer two light passes over one heavy pass.',
      'Plosive control order: manual clip repair > dynamic EQ at 50-80 Hz (Q=1-2) > side-chained multiband.',
      'De-ess: male 5-8 kHz / female 6-10 kHz, Attack 0-2 ms, Release 40-120 ms.',
      'Resonance control should be dynamic, only when the peak appears.'
    ],
    listening: [
      'Tails should not pump or gurgle; silence should stay stable.',
      'Sibilants stay clear but not lisped; brightness should not collapse.',
      'After resonance control, the sound should feel steadier and more expensive, not thinner.'
    ],
    failures: [
      'Watery artifacts: reduce reduction, increase smoothing, split into two passes.',
      'Tail loss: lower sensitivity or lengthen release; switch to dynamic EQ.',
      'Too thin: back off static cuts or narrow the Q.'
    ],
    alternatives: [
      'Manual edit/clip repair instead of heavy broadband denoise.',
      'Dynamic EQ instead of aggressive static cuts.'
    ],
    deep: [
      '1.1 De-noise',
      '  Goal: lower noise floor while preserving natural tails.',
      '  Start: reduction 2-6 dB, smoothing medium-high, adaptive or noise print.',
      '  Range: 2-6 dB (conservative) / 6-12 dB (standard) / 12-20 dB (aggressive).',
      '  Check: tails do not gurgle or shimmer; silence does not pump.',
      '  Fix: watery -> reduce reduction, increase smoothing, split passes.',
      '  Fix: tails lost -> lower sensitivity or lengthen release; use multiband.',
      '1.2 De-plosive',
      '  Goal: control 20-120 Hz bursts without thinning.',
      '  Method order: manual clip repair -> dynamic EQ 30-100 Hz -> sidechain multiband.',
      '  Start: 50-80 Hz, Q=1-2, Attack 0-10 ms, Release 80-200 ms.',
      '  Check: plosives controlled, body intact.',
      '1.3 De-ess',
      '  Goal: control 4-10 kHz sibilance without killing air.',
      '  Start: male 5-8 kHz / female 6-10 kHz, 1-3 dB reduction.',
      '  Double stage: 6-8 kHz for spikes, 10-12 kHz for grit.',
      '  Check: "s" stays clear, not lisped; brightness remains.',
      '1.4 De-resonance',
      '  Goal: suppress harsh/boxy peaks dynamically.',
      '  Common zones: 200-450 Hz (box), 700-1.2 kHz (nasal), 2.5-5 kHz (harsh), 7-9 kHz (grit).',
      '  Start: Q 4-10, dynamic cut 1-4 dB (rarely >6 dB).',
      '  Check: tone feels more premium and stable, not thin.',
      '1.5 De-click',
      '  Goal: remove sharp clicks without softening the attack.',
      '  Start: manual repair or light threshold-based declip on isolated spikes.'
    ]
  },
  {
    id: 'M2',
    title: 'Surgical EQ (Structure EQ)',
    goal: 'Remove non-musical energy so the tonal shaping is clean and controlled.',
    ranges: [
      'HPF: Vocal 60-120 Hz / Guitar 70-120 Hz / Piano 30-60 Hz / Pad 80-200 Hz',
      'HPF slope: 12 dB/oct (gentle) to 24 dB/oct (cleaner)',
      'LPF: 12-18 kHz (gentle trimming), slope 6-12 dB/oct',
      'Problem peaks: 200-450 Hz (box), 700-1.2 kHz (nasal), 2.5-5 kHz (harsh)'
    ],
    starting: [
      'Start with HPF and move up slowly; stop when body begins to thin.',
      'LPF only if the top end is noise-dominant.'
    ],
    listening: [
      'Low end tightens without losing weight.',
      'Top end cleans up without sounding dull.'
    ],
    failures: [
      'Body loss: lower HPF cutoff or switch to a gentle low shelf.',
      'Air loss: ease off LPF or replace with a gentle shelf.'
    ],
    alternatives: [
      'Dynamic EQ for intermittent problems.',
      'Multiband compression for unstable bands.'
    ],
    deep: [
      '2.1 HPF strategy',
      '  Goal: remove rumble without thinning.',
      '  Start: vocal 60-120 Hz, guitar 70-120 Hz, piano 30-60 Hz, pad 80-200 Hz.',
      '  Slope: 12 dB/oct natural -> 24 dB/oct cleaner.',
      '  Check: weight stays, rumble gone.',
      '  Fix: if thin, lower cutoff or swap to low shelf.',
      '2.2 LPF strategy',
      '  Goal: trim noisy ultra-highs while preserving air.',
      '  Start: LPF 12-18 kHz, slope 6-12 dB/oct.',
      '  Check: air remains, hiss reduced.',
      '2.3 Narrow resonant cuts',
      '  Goal: remove whistles/boxiness without tone loss.',
      '  Start: Q 6-10, -1 to -4 dB, prefer dynamic.'
    ]
  },
  {
    id: 'M3',
    title: 'Tone EQ (Musical EQ)',
    goal: 'Shape the expensive tone, clarity, and style.',
    ranges: [
      'Low: 60-100 Hz (weight), 100-200 Hz (warmth), 200-350 Hz (mud)',
      'Mid: 600-900 Hz (body), 1-2 kHz (presence), 2-4 kHz (edge)',
      'High: 10-12 kHz (silk), 14-18 kHz (air)'
    ],
    starting: [
      'Tighten: -1 to -3 dB @ 200-350 Hz (wide Q).',
      'Warmth: +0.5 to +2 dB @ 120-180 Hz (wide Q).',
      'Air: +0.5 to +2 dB @ 10-12 kHz (shelf).'
    ],
    listening: [
      'Midrange clarity and forwardness improve without harshness.',
      'Highs feel silky, not gritty.'
    ],
    failures: [
      'Harsh: dynamic cut 2.5-4 kHz.',
      'Thin/plasticky: add 600-800 Hz very lightly.'
    ],
    alternatives: [
      'Switch to softer saturation instead of pushing bright EQ.'
    ],
    deep: [
      '3.1 Low-end expensive',
      '  Goal: weight and warmth with clean shape.',
      '  Start: +0.5 to +2 dB @ 120-180 Hz (warmth), -1 to -3 dB @ 200-350 Hz (mud).',
      '  Trick: add 70-90 Hz and trim 250 Hz for weight without mud.',
      '3.2 Midrange clarity',
      '  Goal: intelligibility and presence without harshness.',
      '  Start: +1 to +2 dB @ 1-2 kHz (presence), dynamic cut 2.5-4 kHz if sharp.',
      '  Fix: if thin/plastic, add 600-800 Hz +0.5 to +1.5 dB.',
      '3.3 High-end air',
      '  Goal: silk and air without grit.',
      '  Start: shelf +0.5 to +2 dB @ 10-12 kHz; dynamic cut 7-9 kHz if gritty.',
      '  Rule: de-ess before boosting air.'
    ]
  },
  {
    id: 'M4',
    title: 'Dynamics (Compression / Multiband / Dynamic EQ)',
    goal: 'Control macro and micro dynamics, determine in-your-face feel.',
    ranges: [
      'Light: Ratio 1.5-2:1, GR 1-3 dB, Attack 20-40 ms, Release 80-200 ms',
      'Standard: Ratio 2-4:1, GR 3-6 dB, Attack 10-30 ms, Release 50-150 ms',
      'Aggressive: Ratio 4-8:1, GR 6-12 dB, Attack 1-10 ms, Release 30-120 ms',
      'Parallel: Ratio 6-20:1, GR 10-20 dB, blend 5-40%',
      'Multiband: 0-120 / 120-500 / 500-4k / 4-20k Hz'
    ],
    starting: [
      'Parallel compression: heavy comp channel blended 5-40%.',
      'Multiband: slow low-band attack/release, faster highs.'
    ],
    listening: [
      'Closer feel increases while transients stay present.',
      'No pumping or breathing unless stylistic.'
    ],
    failures: [
      'Pumping: lengthen release or raise threshold.',
      'Flattened tone: reduce depth or simplify to single-band.'
    ],
    alternatives: [
      'Dynamic EQ for issues that only appear occasionally.'
    ],
    deep: [
      '4.1 Single-band compression',
      '  Goal: tighten dynamics and bring the sound forward.',
      '  Conservative: Ratio 1.5-2:1, GR 1-3 dB, A 20-40 ms, R 80-200 ms.',
      '  Standard: Ratio 2-4:1, GR 3-6 dB, A 10-30 ms, R 50-150 ms.',
      '  Aggressive: Ratio 4-8:1, GR 6-12 dB, A 1-10 ms, R 30-120 ms.',
      '  Check: closer feel without pumping or loss of attack.',
      '4.2 Parallel compression',
      '  Goal: density without losing transients; mix 5-40%.',
      '  Start: Ratio 6-20:1, GR 10-20 dB, A 1-10 ms, R 30-100 ms.',
      '  Tip: EQ the parallel path (cut lows, add mids).',
      '4.3 Multiband',
      '  Goal: control low end while keeping highs airy.',
      '  Bands: 0-120 / 120-500 / 500-4k / 4-20k Hz.',
      '  Low band: slower attack/release; high band: faster.',
      '4.4 Dynamic EQ',
      '  Goal: only act when problems appear.',
      '  Common nodes: 200-350 Hz (mud), 2-5 kHz (harsh), 6-9 kHz (sibilance).'
    ]
  },
  {
    id: 'M5',
    title: 'Harmonics & Saturation (Tape / Tube / Exciter)',
    goal: 'Add density and character for a more premium tone.',
    ranges: [
      'Tape: warm/rounded; Tube: mid-rich; Transformer: hard/forward',
      'Soft clip: louder/controlled; Hard clip: aggressive/modern',
      'Exciter: adds air but can raise grit; use sparingly',
      'Drive: start inaudible, increase until density appears without obvious distortion'
    ],
    starting: [
      'Clean before saturating; saturation magnifies problems.',
      'EQ after saturation to shape generated harmonics.'
    ],
    listening: [
      'Bypass should sound flatter and cheaper.',
      'No extra harshness or smeared highs.'
    ],
    failures: [
      'Muddy/dirty: reduce drive or switch to a softer type.',
      'Harsh top: reduce exciter or dynamic cut 7-9 kHz.'
    ],
    alternatives: [
      'Use multiband saturation only on the target band.'
    ],
    deep: [
      '5.1 Saturation types',
      '  Tape = warm/rounded, Tube = mid-rich, Transformer = punch/edge.',
      '  Soft clip = louder/controlled, Hard clip = aggressive/modern.',
      '  Exciter = air but can add grit; use sparingly.',
      '5.2 Golden method',
      '  Clean -> Saturate -> EQ shape -> light dynamics.',
      '  Start: drive from inaudible until density appears without distortion.',
      '  Check: bypass sounds flatter/cheaper; no added harshness.',
      '5.3 Multiband saturation',
      '  Low adds audibility, mid adds presence, high adds sheen carefully.'
    ]
  },
  {
    id: 'M6',
    title: 'Transient & Micro-dynamics (Transient / Envelope)',
    goal: 'Make the attack clear, grain controlled, and tails clean.',
    ranges: [
      'Attack increase = more punch; Sustain increase = thicker body',
      'Envelope: Attack shapes material, Release shapes tail and space',
      'Transient tools: +/-5 to 35% on attack or sustain (source dependent)'
    ],
    starting: [
      'Soft or blurry: increase attack slightly.',
      'Too sharp: reduce attack or add sustain for roundness.'
    ],
    listening: [
      'Clearer without unwanted clicking.'
    ],
    failures: [
      'Overly spiky: reduce attack or add short room reverb.'
    ],
    alternatives: [
      'Parallel compression for density instead of heavy transient boost.'
    ],
    deep: [
      '6.1 Transient shaping',
      '  Goal: clear attacks without clickiness.',
      '  Drums: more attack = more snap; too much = sharp click.',
      '  Plucks: small attack boost for clarity; watch click.',
      '6.2 Envelope shaping',
      '  Attack shapes onset texture; Decay shapes bounce; Release shapes tail/space.',
      '  Synths: short attack = percussive; longer attack = silky.'
    ]
  },
  {
    id: 'M7',
    title: 'Stereo & Depth (M/S / Width / Depth)',
    goal: 'Stable center, wide sides, phase-safe depth.',
    ranges: [
      'Side HPF: 100-250 Hz',
      'Side air: +0.5 to +2 dB @ 10-14 kHz',
      'Pre-delay: 10-30 ms (forward), 30-60 ms (larger space)',
      'Width: +0-35% depending on mono safety'
    ],
    starting: [
      'Keep lead in the Mid; widen pads and ambience.',
      'Use subtle early reflections before extreme widening.'
    ],
    listening: [
      'Mono compatibility stays strong.',
      'Phase correlation avoids long negative values.'
    ],
    failures: [
      'Mono loss: reduce width or remove Haas delay.'
    ],
    alternatives: [
      'Short early reflections instead of heavy widening.'
    ],
    deep: [
      '7.1 Mid/Side strategy',
      '  Goal: stable center with wide sides and mono safety.',
      '  Start: side HPF 100-250 Hz, side air +0.5 to +2 dB @ 10-14 kHz.',
      '  Check: mono still solid, no long negative correlation.',
      '7.2 Depth trio',
      '  Early reflections + short room + pre-delay define front/back.',
      '  Rule: bigger pre-delay = closer; more tail = farther.'
    ]
  },
  {
    id: 'M8',
    title: 'Space & Glue (Reverb / Delay / Convolution)',
    goal: 'Add spatial shell and cohesion without pushing the source too far back.',
    ranges: [
      'Short room: 0.4-1.2 s',
      'Medium room/hall: 1.2-2.8 s',
      'Pre-delay: 10-40 ms',
      'Delay: 10-30 ms (Haas thickness) or tempo 1/8-1/4'
    ],
    starting: [
      'Up-close: short reverb + early reflections + larger pre-delay.',
      'Distant: longer tail + smaller pre-delay + more HF damping.'
    ],
    listening: [
      'Space feels premium without washing out transients.',
      'Tails stay out of the groove.'
    ],
    failures: [
      'Mud: reduce mix or damp highs more.'
    ],
    alternatives: [
      'Use a short delay (10-30 ms) for thickness instead of long reverb.'
    ],
    deep: [
      '8.1 Reverb as timbre shell',
      '  Convolution gives realistic instrument/room texture.',
      '  Up-close: short room + early reflections + larger pre-delay.',
      '  Distant: longer tail + smaller pre-delay + more HF damping.',
      '8.2 Delay as timbre enhancer',
      '  1/8 or 1/4 adds body; 10-30 ms adds width (watch phase).'
    ]
  },
  {
    id: 'M9',
    title: 'Motion & Life (Modulation / Automation)',
    goal: 'Avoid static timbre; add subtle motion and breathing.',
    ranges: [
      'Level randomization +/-0.3-1 dB',
      'Filter cutoff drift +/-1-3%',
      'Width drift +/-3-8%',
      'Modulation rate: slow, < 0.5 Hz for subtle motion'
    ],
    starting: [
      'Keep modulation slow and subtle.'
    ],
    listening: [
      'More alive without wobble or seasickness.'
    ],
    failures: [
      'Too unstable: reduce depth or rate.'
    ],
    alternatives: [
      'Subtle chorus instead of random modulation.'
    ],
    deep: [
      '9.1 Micro-randomization',
      '  Small, slow shifts to avoid mechanical feel.',
      '  Start: level +/-0.3 to 1 dB, cutoff +/-1-3%, width +/-3-8%.',
      '9.2 Chorus/Phaser/Flanger',
      '  Chorus = wide/silky, Phaser = flowing, Flanger = metallic.'
    ]
  },
  {
    id: 'M10',
    title: 'Texture & Layering (Layering / Resampling / Granular)',
    goal: 'Add complementary layers for density and signature.',
    ranges: [
      'Layer blend: 5-30% (texture layers often very low)',
      'Resample blend: 5-20%'
    ],
    starting: [
      'Layer roles: one for body, one for presence, one for air, one for texture.'
    ],
    listening: [
      'Bypassing layers should noticeably reduce richness.'
    ],
    failures: [
      'Clash or mud: EQ each layer to be complementary, not overlapping.'
    ],
    alternatives: [
      'Light saturation + EQ instead of a heavy layer stack.'
    ],
    deep: [
      '10.1 Layering principle',
      '  Layers add information, not volume.',
      '  Roles: base weight + mid presence + high air + texture/noise layer.',
      '10.2 Classic stacks',
      '  Lead: main + sub octave + noise air + light distortion layer.',
      '  Vocal: dry + parallel saturation + whisper air + gentle doubler.',
      '10.3 Resampling',
      '  Process extreme, then mix back 5-20% for premium texture.'
    ]
  },
  {
    id: 'M11',
    title: 'Character Modules (Lo-fi / VHS / Bitcrush / Formant)',
    goal: 'Imprint a recognizable style signature without losing control.',
    ranges: [
      'Wow/Flutter: 0.1-0.8% (light)',
      'Bitcrush: 12-8 bit (light) / 8-6 bit (heavy)',
      'Formant shift: +/-1-3 (light)'
    ],
    starting: [
      'Start subtle; increase until the character appears but clarity remains.'
    ],
    listening: [
      'Style is clear but not dirty or broken.'
    ],
    failures: [
      'Harsh or sandy: reduce bitcrush or keep it on high band only.'
    ],
    alternatives: [
      'Soft saturation + light noise for mild character instead of heavy FX.'
    ],
    deep: [
      '11.1 Lo-fi / VHS / Cassette',
      '  Subtle wow/flutter + softened highs + light noise + gentle compression.',
      '  Check: nostalgic without losing clarity.',
      '11.2 Bitcrush / Downsample',
      '  Apply to high layer only; keep core clean.',
      '  Start: 12-10 bit (light), 10-8 bit (standard), 8-6 bit (aggressive).',
      '11.3 Formant / Spectral morph',
      '  Shift resonance body for cyber/experimental tones.'
    ]
  },
  {
    id: 'M12',
    title: 'Final QC (Limiter / Clipper / Translation)',
    goal: 'Lock loudness and peaks while keeping tone intact across systems.',
    ranges: [
      'Soft clip: 1-3 dB peak catch',
      'Limiter: 1-4 dB gain lift',
      'True Peak: <= -1 dBTP (safe)'
    ],
    starting: [
      'Clip first, then limiter; multiple gentle stages are safer.'
    ],
    listening: [
      'Highs not crushed, lows not flattened.',
      'Translation holds on phone, mono, headphones, car.'
    ],
    failures: [
      'Distortion: reduce pre-gain or raise threshold.',
      'Smearing: lower limiter gain or slow release.'
    ],
    alternatives: [
      'Lower target LUFS or use a gentler limiter.'
    ],
    deep: [
      '12.1 Clip/Limiter order',
      '  Clip to catch peaks, limit to raise overall level.',
      '  Start: clip 1-2 dB, limiter +1-4 dB.',
      '  Check: highs not crushed, lows not flattened.',
      '12.2 Translation checks',
      '  Phone: midrange still clear.',
      '  Small speakers: lead still present.',
      '  Mono: no phase collapse.',
      '  Headphones: sibilance not sharp.',
      '  Car: low end not boomy.'
    ]
  }
];

export const TIMBRE_UPGRADE_MODULES = moduleLibrary.map((module) => ({
  id: module.id,
  label: `${module.id} ${module.title}`
}));
export const TIMBRE_UPGRADE_MODULE_LIBRARY = moduleLibrary;
const bandMap = [
  {
    band: 'Sub (20-60 Hz)',
    contribution: 'Scale, impact, heartbeat.',
    effect: 'Boost = bigger and deeper; Cut = cleaner but thinner.',
    range: 'Suggested: HPF 20-40 Hz or low shelf -1 to -3 dB; slow dynamics for control.',
    check: 'Low volume still feels weighty; peaks not pinned.',
    avoid: 'Avoid headroom loss and mud; keep sub clean and centered.',
    alternatives: 'Use low-end harmonic generation for audibility.'
  },
  {
    band: 'Low (60-120 Hz)',
    contribution: 'Weight, power, thickness.',
    effect: 'Boost = heavier; Cut = tighter and faster.',
    range: 'Suggested: +0.5 to +2 dB or dynamic control 1-3 dB.',
    check: 'Low end is stable and anchored.',
    avoid: 'Use multiband or dynamic EQ to avoid boom and overhang.',
    alternatives: 'Light saturation for low-end audibility.'
  },
  {
    band: 'Low-mid (120-350 Hz)',
    contribution: 'Warmth, wood, body.',
    effect: 'Boost = warm but can get muddy; Cut = clear but can get thin.',
    range: 'Suggested: wide Q -1 to -3 dB; dynamic cut when it blooms.',
    check: 'Clearer without hollowing out.',
    avoid: 'Do not over-cut; it makes the sound cheap or hollow.',
    alternatives: 'Dynamic EQ only when it blooms.'
  },
  {
    band: 'Mid (350 Hz-2 kHz)',
    contribution: 'Core information, intelligibility, emotion.',
    effect: 'Boost = clearer/forward; Cut = softer/farther.',
    range: 'Suggested: +0.5 to +2 dB @ 1-2 kHz; dynamic cut 700-1.2 kHz.',
    check: 'Clarity improves without nasal harshness.',
    avoid: 'Control nasal peaks dynamically rather than large static cuts.',
    alternatives: 'Light saturation instead of hard boosts.'
  },
  {
    band: 'High-mid (2-6 kHz)',
    contribution: 'Presence, bite, attack.',
    effect: 'Boost = more edge; Cut = smoother.',
    range: 'Suggested: +0.5 to +1.5 dB @ 2-4 kHz; dynamic cut 1-4 dB if harsh.',
    check: 'More presence without listener fatigue.',
    avoid: 'Use dynamic control here to avoid harshness.',
    alternatives: 'Switch to a softer saturation type.'
  },
  {
    band: 'High (6-12 kHz)',
    contribution: 'Brightness, detail.',
    effect: 'Boost = brighter but risks sibilance; Cut = smoother but darker.',
    range: 'Suggested: +0.5 to +2 dB @ 10-12 kHz; dynamic cut 7-9 kHz.',
    check: 'Details are clear, no gritty sand.',
    avoid: 'De-ess before boosting; avoid brittle grit.',
    alternatives: 'Gentle exciter instead of hard EQ.'
  },
  {
    band: 'Air (12-20 kHz)',
    contribution: 'Air, sheen, luxury.',
    effect: 'Boost = more openness; Cut = cleaner.',
    range: 'Suggested: shelf +0.5 to +2 dB @ 12-16 kHz.',
    check: 'Air increases without lifting noise.',
    avoid: 'Denoise first; keep boosts subtle to avoid hiss.',
    alternatives: 'Soft exciter for air instead of large EQ.'
  }
];
export const TIMBRE_UPGRADE_BAND_MAP = bandMap;

const textureMap = [
  { feel: 'Warm / Glue / Vintage', strategy: 'Slight cut 3-5 kHz + small boost 120-200 Hz + tape saturation + gentle high shelf.' },
  { feel: 'Bright / Hi-Fi / Clear', strategy: 'Clean 200-350 Hz + dynamic control 2-5 kHz + small shelf 10-14 kHz.' },
  { feel: 'Big / Cinematic / Thick', strategy: 'Layering + early reflections for size + stable low-mids + light convolution.' },
  { feel: 'In-your-face / Modern / Commercial', strategy: 'Parallel compression + light clip + 1-2 kHz presence + air after de-ess.' },
  { feel: 'Aggressive / Hard / Punchy', strategy: 'Transformer saturation + transient boost + cautious 2-4 kHz + clipper.' },
  { feel: 'Silky / Detailed / Premium', strategy: 'Dynamic de-resonance + tape/tube saturation + 10-14 kHz silk + short room reverb.' }
];
export const TIMBRE_UPGRADE_TEXTURE_MAP = textureMap;

const routes = [
  {
    name: 'Route 1: Hi-Fi Natural',
    chain: 'M1 -> M2 -> M3 -> M4(light) -> M5(light) -> M7 -> M8(short) -> M12',
    core: 'Cleanup + structure EQ + light compression + light saturation + natural space.',
    why: 'Preserves realism while increasing clarity and premium feel.',
    range: 'GR 1-3 dB, light drive, width 0-15%.',
    check: 'Clarity improves, tails remain natural, space feels believable.',
    risks: 'Over-cleaning can thin the sound; excess air can lift noise.',
    use: 'Vocal, piano, strings, any source needing natural fidelity.',
    ab: 'A/B should sound clearer and more refined, not over-processed.',
    alternatives: 'If thin, ease M1/M2 and add light saturation or short room.'
  },
  {
    name: 'Route 2: Stylized Character',
    chain: 'M1 -> M2 -> M3 -> M4(standard) -> M5(medium) -> M6 -> M7 -> M8 -> M9 -> M11 -> M12',
    core: 'Stronger dynamics + saturation + motion + character modules.',
    why: 'Emphasizes identity and energy for modern production.',
    range: 'GR 3-6 dB, medium drive, width 10-25%.',
    check: 'More character without losing clarity or mono safety.',
    risks: 'Too much style can reduce versatility; phase risk if width too high.',
    use: 'Electronic, pop, rock, hyperpop/trap.',
    ab: 'A/B should feel more alive and signature without dirt.',
    alternatives: 'If too much, reduce M11 or lower M9 depth.'
  },
  {
    name: 'Route 3: Experimental / Futuristic',
    chain: 'M1 -> M2 -> M5 -> M6 -> M9 -> M10 -> M11 -> M8(optional) -> M12',
    core: 'Harmonic shaping + modulation + texture layering + spectral character.',
    why: 'Maximizes uniqueness and futuristic identity.',
    range: 'Medium-heavy drive, texture 10-30%, width 15-35%.',
    check: 'Distinctive yet controllable, no piercing artifacts.',
    risks: 'Easy to lose focus or introduce distortion; manage peaks carefully.',
    use: 'Experimental, cyber, cinematic FX, abstract timbres.',
    ab: 'A/B should feel more futuristic while remaining controlled.',
    alternatives: 'If too distorted, reduce M11 or lower M5/M10 mix.'
  }
];
export const TIMBRE_UPGRADE_ROUTES = routes;

const buildModuleBlock = (module: ModuleSpec, enabled: boolean) => {
  const lines: string[] = [];
  lines.push(`${module.id}. ${module.title}`);
  lines.push(`- Status: ${enabled ? 'Enabled' : 'Disabled (skipped in chain)'}`);
  lines.push(`- Goal: ${module.goal}`);
  lines.push('- Typical parameter ranges:');
  module.ranges.forEach(r => lines.push(`  - ${r}`));
  lines.push('- Recommended starting points:');
  module.starting.forEach(r => lines.push(`  - ${r}`));
  lines.push('- Listening checkpoints:');
  module.listening.forEach(r => lines.push(`  - ${r}`));
  lines.push('- Failure modes and fixes:');
  module.failures.forEach(r => lines.push(`  - ${r}`));
  lines.push('- Alternatives:');
  module.alternatives.forEach(r => lines.push(`  - ${r}`));
  return lines;
};

const buildModuleDeepBlock = (module: ModuleSpec, enabled: boolean) => {
  const lines: string[] = [];
  lines.push(`- ${module.id} ${module.title} [${enabled ? 'ON' : 'OFF'}]`);
  (module.deep || []).forEach(line => lines.push(`  ${line}`));
  return lines;
};

export const buildTimbreUpgradeReport = (input?: TimbreUpgradeInput) => {
  const normalized = pickDefaults(input);
  const lines: string[] = [];
  const activeModules = moduleLibrary.filter((module) => normalized.enabledModules.includes(module.id));
  const moduleChain = activeModules.length > 0 ? activeModules.map((module) => module.id).join(' -> ') : 'None';
  const enabledSet = new Set(normalized.enabledModules);

  const push = (line = '') => lines.push(line);

  push('Timbre Upgrade Report');
  push('');
  push('Input Snapshot:');
  push(`- Source types: ${normalized.sourceTypes.join(' / ')}`);
  push(`- Style targets: ${normalized.styleTargets.join(' / ')}`);
  push(`- Mood keywords: ${normalized.moodKeywords.join(' / ')}`);
  push('- Reference: ' + normalized.reference);
  push('- Enabled modules: ' + (activeModules.length > 0 ? activeModules.map((module) => module.id).join(', ') : 'None'));
  push('Constraints:');
  push(`- Max distortion: ${normalized.maxDistortion}`);
  push(`- Dynamic range: ${normalized.dynamicRange}`);
  push(`- Space: ${normalized.space}`);
  push(`- Stereo width: ${normalized.stereoWidth}`);
  push(`- Noise tolerance: ${normalized.noiseTolerance}`);
  push(`- Output format: ${normalized.outputFormat}`);
  push('Level targets:');
  push(`- Peak <= ${normalized.peakLimit}`);
  push(`- True Peak <= ${normalized.truePeakLimit}`);
  push(`- LUFS target: ${normalized.lufsTarget}`);

  if (normalized.defaultsUsed.length > 0) {
    push('');
    push(`Defaults applied: ${normalized.defaultsUsed.join(', ')}`);
  }
  if (normalized.optionalBranches.length > 0) {
    push('Optional branches:');
    normalized.optionalBranches.forEach(item => push(`- ${item}`));
  }

  push('');
  push('1) Timbre Diagnosis');
  push('- Spectral structure (fundamental, harmonics, formants, harsh peaks, hollows, mud):');
  push('  - Why: defines clarity, density, and perceived quality.');
  push('  - How to judge: spectrum view + narrow-Q sweep for fundamentals, harmonic spread, formants, and resonant spikes.');
  push('  - Parameter ranges: 200-350 Hz (mud), 700-1.2 kHz (nasal), 2.5-5 kHz (harsh), 10-14 kHz (silk/air).');
  push('  - Alternatives: A/B with a reference, check at low volume and mono.');
  push('- Noise structure (breath, room, string/fret, grit, hum):');
  push('  - Why: noise is amplified by compression and saturation.');
  push('  - How to judge: tails and silence for breath, room noise, hiss, electrical hum.');
  push('  - Parameter ranges: hum 50/60 Hz, grit 6-10 kHz, hiss 10-16 kHz.');
  push('  - Alternatives: band-limited denoise or high-band-only reduction.');
  push('- Transient structure (attack, impact, tail, grain, speed):');
  push('  - Why: defines punch, clarity, grain, and speed.');
  push('  - How to judge: zoom waveforms, compare single hits, check clickiness.');
  push('  - Parameter ranges: attack 1-40 ms, sustain 0-200 ms are most audible.');
  push('  - Alternatives: parallel compression to preserve transient bite.');
  push('- Dynamic structure (micro/macro, crest factor):');
  push('  - Why: controls loudness feel, density, and section contrast.');
  push('  - How to judge: crest factor, section contrast, gain reduction meters.');
  push('  - Parameter ranges: GR 1-3 dB (natural) / 3-6 dB (modern) / 6-12 dB (aggressive).');
  push('  - Alternatives: dynamic EQ for momentary issues; parallel compression for density.');
  push('- Stereo structure (width, phase, center, balance, depth):');
  push('  - Why: defines space, image stability, and translation.');
  push('  - How to judge: phase correlation, mono collapse, L/R balance, depth layering.');
  push('  - Parameter ranges: side HPF 100-250 Hz, width +0-35%.');
  push('  - Alternatives: early reflections instead of hard widening.');
  push('- Texture map (audible trait -> strategy):');
  textureMap.forEach(row => push(`  - ${row.feel} -> ${row.strategy}`));

  push('');
  push('2) Timbre Upgrade Blueprint');
  routes.forEach((route) => {
    push(`- ${route.name}`);
    push(`  - Processing chain: ${route.chain}`);
    push(`  - Core modules: ${route.core}`);
    push(`  - Why: ${route.why}`);
    push(`  - Parameter range: ${route.range}`);
    push(`  - How to judge success: ${route.check}`);
    push(`  - Risks: ${route.risks}`);
    push(`  - Best for: ${route.use}`);
    push(`  - A/B focus: ${route.ab}`);
    push(`  - Alternatives: ${route.alternatives}`);
  });

  push('');
  push('3) Modular Processing Chain');
  push(`- Enabled chain (order): ${moduleChain}`);
  moduleLibrary.forEach((module) => {
    buildModuleBlock(module, enabledSet.has(module.id)).forEach(line => push(line));
    push('');
  });

  push('4) Band-by-band Timbre Sculpting');
  bandMap.forEach((b) => {
    push(`- ${b.band}`);
    push(`  - Contribution (why): ${b.contribution}`);
    push(`  - Boost/cut effect: ${b.effect}`);
    push(`  - Parameter range: ${b.range}`);
    push(`  - How to judge: ${b.check}`);
    push(`  - Avoid side effects: ${b.avoid}`);
    push(`  - Alternatives: ${b.alternatives}`);
  });

  push('');
  push('5) Deliverables');
  push('- Enabled module chain (order): ' + moduleChain);
  push('- Parameter targets (conservative / standard / aggressive):');
  push('  - M1 Cleanup');
  push('    - Conservative: denoise 2-6 dB, de-ess 1-3 dB, de-resonance 1-2 dB dynamic');
  push('    - Standard: denoise 6-12 dB, de-ess 3-6 dB, de-resonance 2-4 dB dynamic');
  push('    - Aggressive: denoise 12-20 dB, de-ess 6-10 dB, de-resonance 4-6 dB dynamic');
  push('  - M2 Surgical EQ');
  push('    - Conservative: HPF 60-80 Hz, LPF 18 kHz, gentle Q cuts');
  push('    - Standard: HPF 80-120 Hz, LPF 16 kHz, narrow cuts -1 to -3 dB');
  push('    - Aggressive: HPF 100-160 Hz, LPF 14 kHz, narrow cuts -3 to -6 dB');
  push('  - M3 Tone EQ');
  push('    - Conservative: low-mid -1 dB (200-350 Hz), air +0.5 dB (10-14 kHz)');
  push('    - Standard: low-mid -2 to -3 dB, air +1 to +2 dB');
  push('    - Aggressive: low-mid -3 to -5 dB, air +2 to +4 dB');
  push('  - M4 Dynamics');
  push('    - Conservative: Ratio 1.5-2:1, GR 1-3 dB, A 20-40 ms, R 80-200 ms');
  push('    - Standard: Ratio 2-4:1, GR 3-6 dB, A 10-30 ms, R 50-150 ms');
  push('    - Aggressive: Ratio 4-8:1, GR 6-12 dB, A 1-10 ms, R 30-120 ms');
  push('  - M5 Saturation');
  push('    - Conservative: tape/tube, barely audible drive');
  push('    - Standard: tape/tube/transformer, audible density without grit');
  push('    - Aggressive: harder drive or soft clip, watch harshness');
  push('  - M6 Transient');
  push('    - Conservative: attack +5-10%, sustain +0-5%');
  push('    - Standard: attack +10-20%, sustain +5-10%');
  push('    - Aggressive: attack +20-35%, sustain +10-20% (avoid clicks)');
  push('  - M7 Stereo & Depth');
  push('    - Conservative: width +0-10%, side HPF 150-250 Hz');
  push('    - Standard: width +10-20%, side HPF 120-200 Hz');
  push('    - Aggressive: width +20-35%, side HPF 100-180 Hz (check mono)');
  push('  - M8 Space');
  push('    - Conservative: short room 0.4-0.8 s, mix 5-10%');
  push('    - Standard: room 0.8-1.6 s, mix 10-20%');
  push('    - Aggressive: hall 1.6-2.8 s, mix 20-35%');
  push('  - M9 Motion');
  push('    - Conservative: level drift +/-0.3 dB, width drift +/-3%');
  push('    - Standard: level drift +/-0.6 dB, width drift +/-5%');
  push('    - Aggressive: level drift +/-1 dB, width drift +/-8%');
  push('  - M10 Texture & Layering');
  push('    - Conservative: layer blend 5-10%, resample 5%');
  push('    - Standard: layer blend 10-20%, resample 5-10%');
  push('    - Aggressive: layer blend 20-30%, resample 10-20%');
  push('  - M11 Character');
  push('    - Conservative: light wow/flutter or mild bitcrush (12-10 bit)');
  push('    - Standard: moderate wow/flutter, bitcrush 10-8 bit, light formant');
  push('    - Aggressive: heavy character, bitcrush 8-6 bit (watch grit)');
  push('  - M12 Final QC');
  push('    - Conservative: clip 1 dB, limiter +1-2 dB');
  push('    - Standard: clip 1-2 dB, limiter +2-4 dB');
  push('    - Aggressive: clip 2-3 dB, limiter +4-6 dB (watch distortion)');
  push('- A/B checklist (what to listen for):');
  push('  - Details are clearer without harshness.');
  push('  - Low end is tighter and more stable.');
  push('  - Main body is more forward; space sounds more premium.');
  push('  - Mono remains solid.');
  push('- Fast adaptation rules:');
  push('  - Too dry: add short room/early reflections, light parallel compression.');
  push('  - Too noisy: denoise first, then control 6-10 kHz.');
  push('  - Too dark: clean low-mids, add 10-14 kHz air.');
  push('  - Too bright: dynamic cut 3-5 kHz, reduce exciters if needed.');

  push('');
  push('6) Module Library (Deep)');
  moduleLibrary.forEach((module) => {
    buildModuleDeepBlock(module, enabledSet.has(module.id)).forEach(line => push(line));
  });

  push('');
  push('7) Band Map (Sub -> Air)');
  bandMap.forEach(b => push(`- ${b.band}: ${b.contribution} | ${b.effect} | ${b.avoid}`));

  push('');
  push('8) Target Feel -> Processing Strategy');
  textureMap.forEach(row => push(`- ${row.feel}: ${row.strategy}`));

  return lines.join('\n');
};






