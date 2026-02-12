import React, { useState } from 'react';
import { useStore } from '../../store';
import { notifyError, openConfirm } from '../../utils/notifications';

const Section = ({ title, color, children }: { title: string; color: string; children?: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-gray-800 bg-gray-900/30 rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 cursor-pointer select-none bg-gray-900/50 hover:bg-gray-800 transition-colors text-left focus:outline-none"
      >
        <span className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{title}</span>
        <span className={`text-gray-500 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && (
        <div className="p-4 text-[11px] text-gray-300 leading-relaxed space-y-3 font-sans border-t border-gray-800 animate-in slide-in-from-top-1 fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <code className="px-1 py-0.5 rounded border border-gray-700 bg-black/40 text-[10px] text-gray-200 font-mono">{children}</code>
);

export const HelpTab = () => {
  const nuclearReset = useStore((s) => s.nuclearReset);
  const [clearStep, setClearStep] = useState<'idle' | 'confirm'>('idle');
  const [verifyCode, setVerifyCode] = useState('');
  const [inputCode, setInputCode] = useState('');

  const startClear = () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setVerifyCode(code);
      setClearStep('confirm');
      setInputCode('');
  };

  const doClear = () => {
      if (inputCode === verifyCode) {
          openConfirm({
              title: 'Confirm Full Reset',
              message: 'Are you absolutely sure? This will wipe all local data and reload.',
              confirmLabel: 'Wipe & Reload',
              cancelLabel: 'Cancel',
              onConfirm: () => nuclearReset()
          });
      } else {
          notifyError('Incorrect verification code.', 'Reset');
      }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar pr-2 pb-4">
      <div className="text-center mb-6 pt-2">
        <h3 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-1">
          Dynamic N-Dimensional Prime-Limit Harmonic Lattice & Synthesizer
        </h3>
        <p className="text-[9px] text-blue-400 font-mono font-bold">System v2.2.1 • Comprehensive Manual</p>
      </div>

      <div className="mb-4 p-3 bg-black/30 border border-gray-800 rounded-lg text-[11px] text-gray-300 leading-relaxed">
        <p className="mb-2">
          This manual is organized by workflow: <strong>Explore</strong> (lattice), <strong>Play</strong> (sound/input), <strong>Build</strong>{' '}
          (tools/scale/sequence), and <strong>Learn</strong> (ear training/theory).
        </p>
        <ul className="list-disc pl-5 text-gray-400 space-y-1">
          <li>Expand a section to read it; everything is collapsible to stay usable on mobile/tablet.</li>
          <li>Most “nothing happens” issues come from permissions (audio/mic/MIDI) or very large node counts (performance).</li>
        </ul>
      </div>

      <Section title="0. Quick Start (3 minutes)" color="text-emerald-400">
        <ol className="list-decimal pl-5 space-y-2 text-gray-400">
          <li>
            <strong className="text-white">Generate a lattice:</strong> open <strong>MENU → CONFIG</strong>, go to <strong>GEN</strong>, choose your{' '}
            <strong>Root Axes (Gen 0)</strong> and <strong>Branching Limit</strong>, then press <strong>Apply & Regenerate</strong>.
          </li>
          <li>
            <strong className="text-white">Find a note fast:</strong> use the Search bar at the top of the main screen. As you type, you’ll see candidate
            nodes with <strong>Gen</strong>, <strong>Cents</strong>, and <strong>Ratio</strong>. Click a result to jump/select it.
          </li>
          <li>
            <strong className="text-white">Hear it:</strong> select a node and use the <strong>Info Panel → PLAY</strong>, or add it to the{' '}
            <strong>Virtual Keyboard</strong> (toggle with <Kbd>K</Kbd>) to perform.
          </li>
          <li>
            <strong className="text-white">Analyze intervals/chords:</strong> send nodes to the <strong>Comparison Tray</strong> (toggle with <Kbd>C</Kbd>)
            to view interval ratios and a normalized chord ratio.
          </li>
        </ol>
        <div className="mt-3 p-2 bg-black/40 border border-gray-800 rounded text-gray-400">
          <strong className="text-white">Audio unlock (iOS/iPadOS):</strong> if you hear nothing, press any Play/Test button once to unlock WebAudio, then
          try again.
        </div>
      </Section>

      <Section title="1. Philosophy & Geometry (What the lattice means)" color="text-blue-400">
        <p>
          <strong>The concept:</strong> This app visualizes harmony not as a linear scale, but as a multi-dimensional crystal. In Just Intonation (JI),
          intervals are integer ratios involving prime numbers. We map these primes to spatial vectors.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          <div className="bg-gray-900 p-2 rounded border border-gray-700">
            <strong className="text-white block mb-1">Ratio</strong>
            The pitch relationship, e.g. <Kbd>3/2</Kbd>, <Kbd>5/4</Kbd>, <Kbd>81/80</Kbd>. Ratios multiply; octaves are powers of 2.
          </div>
          <div className="bg-gray-900 p-2 rounded border border-gray-700">
            <strong className="text-white block mb-1">Cents</strong>
            A logarithmic unit: 1200 cents per octave. Great for comparing any tuning to 12‑TET.
          </div>
          <div className="bg-gray-900 p-2 rounded border border-gray-700">
            <strong className="text-white block mb-1">Prime Limit</strong>
            The highest prime allowed in your ratios. Example: “11‑limit” allows primes up to 11 (2,3,5,7,11).
          </div>
          <div className="bg-gray-900 p-2 rounded border border-gray-700">
            <strong className="text-white block mb-1">Prime Vector (Monzo)</strong>
            An exponent vector for primes. Moving one step on an axis adds/subtracts one exponent for that prime.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-gray-900 p-2 rounded border border-gray-700">
            <strong className="text-blue-300 block mb-1">X‑Axis (Prime 3)</strong>
            The Perfect Fifth (<Kbd>3/2</Kbd>). Right is dominant (+1), Left is subdominant (−1).
          </div>
          <div className="bg-gray-900 p-2 rounded border border-gray-700">
            <strong className="text-green-300 block mb-1">Y‑Axis (Prime 5)</strong>
            The Major Third (<Kbd>5/4</Kbd>). Up is Major (+1), Down is Minor (−1).
          </div>
          <div className="bg-gray-900 p-2 rounded border border-gray-700">
            <strong className="text-teal-300 block mb-1">Z‑Axis (Prime 7)</strong>
            The Harmonic Seventh (<Kbd>7/4</Kbd>). Used for blues and barbershop harmony.
          </div>
          <div className="bg-gray-900 p-2 rounded border border-gray-700">
            <strong className="text-purple-300 block mb-1">Hyper‑Axes (11+)</strong>
            Primes 11, 13, 17, 19, 23, 29, 31 map to diagonal vectors to enable N-dimensional navigation.
          </div>
        </div>
      </Section>

      <Section title="2. Operation Modes (Simple vs Advanced)" color="text-yellow-400">
        <p>
          The application operates in two distinct states, toggled via the <strong>Simple Mode</strong> button next to <strong>Ear Trainer</strong> in the
          Settings header.
        </p>
        <div className="space-y-3 mt-2">
          <div className="border-l-2 border-yellow-600 pl-3">
            <strong className="block text-white text-[10px] uppercase">Harmonic Simple Mode</strong>
            A guided educational experience.
            <ul className="list-disc pl-4 mt-1 text-gray-400 space-y-1">
              <li>
                <strong>Tutorial:</strong> an interactive course teaching the physics of sound, from the Monad to commas and temperament.
              </li>
              <li>
                <strong>Electives:</strong> preset modules demonstrating specific phenomena (e.g., Great Diesis).
              </li>
              <li>
                <strong>Simplified UI:</strong> hides complex generation parameters so you can focus on the concept.
              </li>
            </ul>
          </div>
          <div className="border-l-2 border-blue-600 pl-3">
            <strong className="block text-white text-[10px] uppercase">Advanced Mode</strong>
            The full unrestricted lattice engine.
            <ul className="list-disc pl-4 mt-1 text-gray-400 space-y-1">
              <li>Multi-origin generation (secondary roots/scopes).</li>
              <li>Full recursive depth control (Gen 0–4), loops, simplification.</li>
              <li>MIDI integration, custom mapping, sequencer, tuner, timbre engine.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="3. Screen Layout & Key Panels" color="text-sky-400">
        <div className="space-y-3">
          <div className="p-2 bg-black/30 border border-gray-800 rounded">
            <strong className="text-white text-[10px] uppercase block mb-1">Top Bar (Main Screen)</strong>
            <ul className="list-disc pl-4 text-gray-400 space-y-1">
              <li>
                <strong>Status:</strong> current prime-limit, node count, and quick actions (undo/redo, reset center).
              </li>
              <li>
                <strong>Axis selectors:</strong> choose which prime axes are used for navigation moves (X/Y).
              </li>
              <li>
                <strong>Search:</strong> ratio/name/cents; results show Gen + cents + ratio so you can pick precisely.
              </li>
              <li>
                <strong>Pure + MENU:</strong> Pure reduces UI clutter; the circular MENU button sits between Pure and the axis selectors.
              </li>
            </ul>
          </div>

          <div className="p-2 bg-black/30 border border-gray-800 rounded">
            <strong className="text-white text-[10px] uppercase block mb-1">MENU (Quick Actions)</strong>
            <p className="text-gray-400">
              The MENU button opens frequently used panels and quick controls (it may hide if the Info Panel is full—collapse the Info Panel to reveal it).
            </p>
            <ul className="list-disc pl-4 text-gray-400 space-y-1 mt-2">
              <li>
                <strong>Sequencer:</strong> arrange notes/chords into repeatable patterns.
              </li>
              <li>
                <strong>Keyboard / Compare:</strong> quick access to performance and analysis.
              </li>
              <li>
                <strong>AR:</strong> toggles WebXR (supported devices only).
              </li>
              <li>
                <strong>Config:</strong> all settings (GEN/VIS/AUDIO/TIMBRE/MIDI/KEYS/SYM/HELP/THEORY).
              </li>
              <li>
                <strong>Quick controls:</strong> Gen 0 Length (+/-), Node Ratios (Off/Surface/Above), and Node Spacing.
              </li>
            </ul>
          </div>

          <div className="p-2 bg-black/30 border border-gray-800 rounded">
            <strong className="text-white text-[10px] uppercase block mb-1">CONFIG (Settings)</strong>
            <ul className="list-disc pl-4 text-gray-400 space-y-1">
              <li>
                Use <strong>Apply & Regenerate</strong> to commit changes that affect lattice generation.
              </li>
              <li>
                Use <strong>Undo/Redo Config</strong> for quick experimentation without losing your previous setup.
              </li>
              <li>
                Tabs are grouped by workflow: <strong>Lattice</strong> (GEN/VIS), <strong>Sound</strong> (AUDIO/TIMBRE), <strong>Input</strong> (MIDI/KEYS),
                <strong> Utilities</strong> (TOOLS/MATH/SYM), <strong>Learn</strong> (THEORY/HELP).
              </li>
            </ul>
          </div>

          <div className="p-2 bg-black/30 border border-gray-800 rounded">
            <strong className="text-white text-[10px] uppercase block mb-1">Info Panel (Selection)</strong>
            <ul className="list-disc pl-4 text-gray-400 space-y-1">
              <li>
                <strong>PLAY / Locate:</strong> audition and camera-focus the selected identity.
              </li>
              <li>
                <strong>Origins:</strong> add/remove secondary origins for multi-center lattices.
              </li>
              <li>
                <strong>Compare / Keyboard:</strong> send selection to analysis tray or performance keyboard.
              </li>
              <li>
                <strong>Analysis / Scale Builder:</strong> inspect commas, build scales, save custom items.
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="4. Navigation, Movement & Selection" color="text-indigo-300">
        <div className="space-y-3 text-gray-400">
          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Mouse / Touch</strong>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <strong>Drag:</strong> rotate the view.
              </li>
              <li>
                <strong>Wheel / pinch:</strong> zoom.
              </li>
              <li>
                <strong>Right-drag / two-finger drag:</strong> pan.
              </li>
              <li>If movement feels “stuck”, click/tap empty space once to return focus to the canvas.</li>
            </ul>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">WASD Flight</strong>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Use <Kbd>W</Kbd>
                <Kbd>A</Kbd>
                <Kbd>S</Kbd>
                <Kbd>D</Kbd> to move; movement scales with lattice size.
              </li>
              <li>
                <strong>Sprint:</strong> double-tap a direction key, or hold <Kbd>Shift</Kbd> while moving.
              </li>
              <li>
                Adjust rotate/zoom/pan/WASD speeds in <strong>CONFIG → VIS → Navigation Controls</strong>.
              </li>
            </ul>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Selection Workflow</strong>
            <ul className="list-disc pl-4 space-y-1">
              <li>Click a node to select it; the camera may auto-focus (toggleable in settings).</li>
              <li>
                Use <strong>Locate</strong> to jump back to the selected node.
              </li>
              <li>Use selection history (undo/redo selection) if you’re exploring quickly.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="5. Searching & Finding Notes" color="text-cyan-300">
        <div className="space-y-3 text-gray-400">
          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">What you can type</strong>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <strong>Ratios:</strong> <Kbd>3/2</Kbd>, <Kbd>81/80</Kbd>, <Kbd>45/32</Kbd>
              </li>
              <li>
                <strong>Names/symbols:</strong> depends on your current notation settings (SYM tab).
              </li>
              <li>
                <strong>Numbers:</strong> interpreted as “find nearest by cents/position” (helpful for quick jumps).
              </li>
            </ul>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Live suggestions</strong>
            <p>
              Even before pressing <strong>Go</strong>, the search panel shows nearest matches. Each suggestion includes: <strong>Gen</strong>,{' '}
              <strong>Cents</strong>, and <strong>Ratio</strong>.
            </p>
          </div>

          <div className="p-2 bg-black/30 border border-gray-800 rounded">
            <strong className="text-white text-[10px] uppercase block mb-1">Tip</strong>
            If you can’t find an expected ratio, it’s usually not generated yet—raise the prime limit or branching/expansion in <strong>GEN</strong>, then{' '}
            <strong>Apply & Regenerate</strong>.
          </div>
        </div>
      </Section>

      <Section title="6. Lattice Generation Engine (GEN)" color="text-green-400">
        <p className="text-gray-400">
          Found in <strong>CONFIG → GEN</strong>. This engine builds the harmonic graph recursively. If you ever feel lost: adjust generation, then{' '}
          <strong>Apply & Regenerate</strong>.
        </p>

        <div className="space-y-4 mt-3">
          <div>
            <strong className="text-white text-[10px] uppercase block border-b border-gray-700 pb-1 mb-1">Hierarchy of Generations</strong>
            <ul className="space-y-1 text-gray-400">
              <li>
                <strong className="text-gray-300">Gen 0 (Skeleton):</strong> primary highways from 1/1 (root axes).
              </li>
              <li>
                <strong className="text-gray-300">Gen 1 (Sheet):</strong> branches from Gen 0 nodes.
              </li>
              <li>
                <strong className="text-gray-300">Gen 2+ (Volume):</strong> recursive branching; exponential growth—use with care.
              </li>
            </ul>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block border-b border-gray-700 pb-1 mb-1">Root Axes & Prime Limits</strong>
            <ul className="list-disc pl-4 text-gray-400 space-y-1">
              <li>
                <strong>Original Axis Roots (Gen 0):</strong> choose which prime limits act as primary axes (up to 31‑limit).
              </li>
              <li>
                <strong>Branching Limit:</strong> the global maximum prime used anywhere in the lattice.
              </li>
              <li>
                <strong>Per‑Gen Branch Limits:</strong> collapsed by default; expand to cap primes differently per generation.
              </li>
              <li>
                <strong>Tonality Diamond:</strong> when selected, GEN controls are hidden because diamond geometry ignores them.
              </li>
            </ul>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block border-b border-gray-700 pb-1 mb-1">Secondary Origins (Scopes)</strong>
            <p className="text-gray-400">
              You can create multiple centers of expansion. In the Info Panel, use “Add Origin” on any node to make it a new center. This is useful for
              building multiple harmonic neighborhoods without exploding node counts everywhere.
            </p>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block border-b border-gray-700 pb-1 mb-1">Axis Configuration & Loop Finder</strong>
            <ul className="list-disc pl-4 text-gray-400 space-y-1">
              <li>
                Use <strong>Find Loops</strong> to search commas for a prime axis (tolerance up to 1200¢; sizes up to 1500).
              </li>
              <li>The loop list shows a limited number of rows at once—scroll to view more, and choose ordering by size or error.</li>
              <li>Applying a loop “wraps” the axis and can turn lattices into ring-like topologies (cylinder/torus behavior).</li>
            </ul>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block border-b border-gray-700 pb-1 mb-1">Spiral Generator</strong>
            <p className="text-gray-400">
              Spiral mode generates specialized multi-period spirals for selected primes. It’s powerful, but can produce very large node counts. If
              interaction becomes sluggish, reduce expansion/gen depth, enable simplification, or lower the branching limit.
            </p>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block border-b border-gray-700 pb-1 mb-1">Equal Steps / Division (a^(n/k))</strong>
            <p className="text-gray-400">
              Generates equal-step identities using <Kbd>Base^((a·Δn)/k)</Kbd>. Choose Graphite or Helix visualization. Useful for EDO/non‑EDO/equal steps
              that do not form a complete cycle (independent step mapping).
            </p>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block border-b border-gray-700 pb-1 mb-1">Simplification (Performance)</strong>
            <ul className="list-disc pl-4 text-gray-400 space-y-1">
              <li>
                <strong>Enable Simplification:</strong> deduplicates near‑equivalent nodes to stabilize huge lattices.
              </li>
              <li>
                <strong>Ensure Connectivity:</strong> keeps “bridge” notes so the graph stays playable.
              </li>
              <li>
                <strong>Priority Order:</strong> controls which identities survive when pruning.
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="7. Display Modes & Visual Analysis" color="text-cyan-400">
        <p className="text-gray-400">
          Display Mode is selectable in <strong>CONFIG → GEN</strong>. Additional visuals live in <strong>VIS</strong>.
        </p>
        <ul className="list-disc pl-4 space-y-2 mt-2 text-gray-400">
          <li>
            <strong className="text-white">Lattice Geometry:</strong> the standard view; spatial position = prime vector.
          </li>
          <li>
            <strong className="text-white">Pitch Spectrum:</strong> a 1D sorting mode. X = cents; Y/Z use phyllotaxis to avoid overlaps.
          </li>
          <li>
            <strong className="text-white">H-Chroma:</strong> a harmonic helix visualizer. Set <Kbd>a</Kbd> (base), choose a harmonic limit, and display colors as pure hues or primary ratios.
          </li>
          <li>
            <strong className="text-white">Tonality Diamond:</strong> harmonic identity grid by odd-limit (up to 99). GEN controls are hidden here because
            they don’t apply.
          </li>
          <li>
            <strong className="text-white">Temperament Morph:</strong> interpolates pitches between Pure JI and 12‑TET to hear beating appear/disappear.
          </li>
        </ul>
        <div className="mt-3 p-2 bg-black/30 border border-gray-800 rounded text-gray-400">
          <strong className="text-white">Node Spacing + Ratios:</strong> adjust instantly from <strong>MENU</strong> to spread nodes farther apart and to
          show ratios on every node (surface or above).
        </div>
      </Section>

      <Section title="8. Sound (AUDIO) — Getting reliable output" color="text-orange-300">
        <div className="space-y-3 text-gray-400">
          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">WebAudio basics</strong>
            <ul className="list-disc pl-4 space-y-1">
              <li>Browsers require a user gesture to start audio. If you hear silence, press any Play/Test button once.</li>
              <li>On mobile, keep the tab active; background tabs may suspend audio.</li>
              <li>If audio distorts/clips, lower master gain and patch gains; use shorter releases for percussive work.</li>
            </ul>
          </div>
          <div className="p-2 bg-black/30 border border-gray-800 rounded">
            <strong className="text-white text-[10px] uppercase block mb-1">Basic synth patches</strong>
            Some tools use a lightweight patch editor (oscillators + ADSR + filter + LFO + unison). Use <strong>TEST</strong> to preview patches without
            changing your lattice.
          </div>
        </div>
      </Section>

      <Section title="9. Timbre System (TIMBRE) — Professional sound design" color="text-amber-300">
        <div className="space-y-3 text-gray-400">
          <div className="p-2 bg-black/30 border border-gray-800 rounded">
            <strong className="text-white text-[10px] uppercase block mb-1">Engine Mode + Panic</strong>
            Choose <strong>Basic</strong> or <strong>Timbre</strong> engine. Timbre mode enables the modular patch system and advanced performance
            controls. Use <strong>Panic</strong> if a patch hangs or you need instant silence.
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Patch Manager</strong>
            <ul className="list-disc pl-4 space-y-1">
              <li>Select the active patch, duplicate, delete, import/export JSON, and organize with tags/folders.</li>
              <li>Patches are reproducible: same patch + same note trigger = same sound.</li>
            </ul>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Sound Builder (Modules)</strong>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <strong>Osc Bank:</strong> multiple oscillators with detune/mix.
              </li>
              <li>
                <strong>Harmonic Designer:</strong> parametric spectrum + editable partial table.
              </li>
              <li>
                <strong>Noise / Exciter:</strong> burst + sustain noise for attacks/texture.
              </li>
              <li>
                <strong>Envelopes:</strong> amp + filter + spectral decay (higher partials can decay faster).
              </li>
              <li>
                <strong>Filter:</strong> filtering with keytracking.
              </li>
              <li>
                <strong>Nonlinearity:</strong> tanh drive/mix for saturation.
              </li>
              <li>
                <strong>Space:</strong> reverb/resonance.
              </li>
              <li>
                <strong>Karplus:</strong> short-delay feedback module for pluck/metallic hybrids.
              </li>
            </ul>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Macros, Mod Matrix, Mapping</strong>
            <ul className="list-disc pl-4 space-y-1">
              <li>Macros let one knob control many parameters (performance-ready).</li>
              <li>Mod Matrix routes sources (velocity/LFO/keytracking/random/macros) to targets (gain/filter/drive/reverb/etc.).</li>
              <li>Mapping decides where patches apply: global, by note label, and/or by context (lattice/keyboard/sequencer).</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="10. MIDI & Hardware Input (Input workflow)" color="text-purple-400">
        <div className="space-y-4">
          <div className="bg-purple-900/20 p-3 rounded-lg border border-purple-800">
            <strong className="text-purple-300 text-[10px] uppercase block mb-1">Setup</strong>
            <ul className="list-disc pl-4 text-gray-400 space-y-1">
              <li>
                Open <strong>CONFIG → MIDI</strong>, enable MIDI, and grant browser permission.
              </li>
              <li>Web MIDI works best on desktop Chrome/Edge; mobile support varies by platform.</li>
              <li>For stable tuning, prefer mappings that reference actual ratios/frequencies (not 12‑TET assumptions).</li>
            </ul>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-2 border-b border-gray-800 pb-1">Mapping Strategy</strong>
            <div className="space-y-3">
              <div className="p-2 bg-black/40 rounded border border-gray-800">
                <strong className="text-blue-400 text-[10px] uppercase block mb-1">1) Lattice Search (Proximity)</strong>
                Finds the closest generated identity to your incoming key step (pitch-class aware).
                <div className="text-[9px] text-gray-500 mt-1 italic">Best for: exploring the current lattice like a piano roll.</div>
              </div>
              <div className="p-2 bg-black/40 rounded border border-gray-800">
                <strong className="text-purple-400 text-[10px] uppercase block mb-1">2) Axis Lock (Monzo‑Linear)</strong>
                Each key step moves exactly one unit along a chosen prime axis (independent of absolute pitch).
                <div className="text-[9px] text-gray-500 mt-1 italic">Best for: infinite fifth/third spirals and structured exploration.</div>
              </div>
              <div className="p-2 bg-black/40 rounded border border-gray-800">
                <strong className="text-green-400 text-[10px] uppercase block mb-1">3) Custom Map (Identity Table)</strong>
                A per‑key lookup table of ratios/steps with preset saving—ideal for custom temperaments and non‑cyclic scales.
                <div className="text-[9px] text-gray-500 mt-1 italic">Best for: composition and instrument-specific mappings.</div>
              </div>
            </div>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">KEYS Tab (Navigation shortcuts)</strong>
            <p className="text-gray-400">
              Configure keyboard shortcuts for moving along prime axes (including Shift+key variants). This is separate from the Virtual Keyboard
              note-binding system.
            </p>
          </div>
        </div>
      </Section>

      <Section title="11. Tools & Composition (Utilities)" color="text-pink-400">
        <div className="space-y-3">
          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Comparison Tray</strong>
            <p className="text-gray-400">
              A staging area for analysis. Add nodes to see exact interval ratios and a <strong>Global Chord Ratio</strong> normalized via LCM (e.g.{' '}
              <Kbd>4:5:6:7</Kbd>). Saved comparisons can seed other tools (ear training pools, progressions, etc.).
            </p>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Virtual Keyboard</strong>
            <p className="text-gray-400">
              A persistent bank of notes.
              <br />- <strong>Binding:</strong> click “Bind”, then press a computer key (A–Z) to map the selected node.
              <br />- <strong>Octave ±:</strong> the small <Kbd>+</Kbd>/<Kbd>−</Kbd> buttons shift by octaves for performance.
              <br />- <strong>Recording:</strong> built-in <Kbd>.webm</Kbd> recorder.
              <br />- <strong>Saving:</strong> save layouts to local storage.
            </p>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Ratio Tool</strong>
            <p className="text-gray-400">
              Input raw math (<Kbd>3^7 / 2^11</Kbd>) or fractions (<Kbd>81/80</Kbd>). It computes cents/prime vectors and checks whether the node exists
              in your current lattice configuration. The n-limit JI ratio deriver supports zoom, 1/1-to-2/1 length, and width/height resizing (drag its edge).
            </p>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Scale Builder</strong>
            <p className="text-gray-400">
              Build microtonal scales by selecting identities (ratios), ordering them, and saving presets. Use it together with mapping + tuner for
              practical instrument setups.
            </p>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Math Lab</strong>
            <p className="text-gray-400">
              Plot explicit/parametric/implicit math objects, sample them, and optionally map samples to audio playback. Use it for function-based pitch
              explorations, rhythm/motion studies, and generating custom pitch sequences.
            </p>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Symbols & Notation (SYM)</strong>
            <p className="text-gray-400">
              Customize note naming, accidentals, and comma/symbol rendering. This affects search strings, on-node labels, and any mapping that uses “By
              Note Label”.
            </p>
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Theory (Learn)</strong>
            <p className="text-gray-400">
              The Theory overlay provides structured reference material that pairs well with the Simple Mode tutorial. Use it when you want definitions,
              context, and vocabulary for what you’re seeing/hearing.
            </p>
          </div>
        </div>
      </Section>

      <Section title="12. Sequencer & Progressions" color="text-fuchsia-300">
        <div className="space-y-3 text-gray-400">
          <p>
            The <strong>Sequencer</strong> panel arranges steps (notes/chords) into repeatable patterns. Use it to audition chord progressions, melodies,
            and rhythm ideas.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong>Step type:</strong> notes or chords (depending on the selected mode).
            </li>
            <li>
              <strong>Complex rhythm:</strong> supports triplets and n‑lets via beat multipliers and per-step durations.
            </li>
            <li>
              <strong>Playback:</strong> start/stop, tempo, and per-step duration controls.
            </li>
          </ul>
        </div>
      </Section>

      <Section title="13. Ear Training (Advanced)" color="text-yellow-300">
        <div className="space-y-3 text-gray-400">
          <p>
            The Ear Trainer supports practice and repeatable experiments. You can choose whether to play a fixed <Kbd>1/1</Kbd> reference, a random
            standard note, or no reference.
          </p>
          <div className="p-2 bg-black/30 border border-gray-800 rounded">
            <strong className="text-white text-[10px] uppercase block mb-1">Workflow tips</strong>
            <ul className="list-disc pl-4 space-y-1">
              <li>Increase question counts and randomness for real training; use custom pools to control content.</li>
              <li>For melody/progression dictation, enable random rhythm if you want rhythm to be part of the answer.</li>
              <li>You can seed custom content from saved items in the Comparison tray.</li>
              <li>Use the JI Chord Library to pick which chord qualities appear in chord questions.</li>
              <li>Use Play in the JI Chord Library to preview how each chord sounds.</li>
            </ul>
          </div>
          <p className="text-gray-400">
            For deeper experiment presets and phase guides, see <strong>docs/user-manual</strong>.
          </p>
        </div>
      </Section>

      <Section title="EAR TRAINING • PART II (Research Modules)" color="text-yellow-300">
        <p className="text-gray-400">
          <strong>Part II</strong> adds three research-grade perceptual measurement modules. These modules are designed for repeatable experiments, not
          guessing games.
        </p>
        <ul className="list-disc ml-5 space-y-1 text-gray-400">
          <li>
            <strong>Interval Zone Training</strong>: measure tolerance zones (accept/reject) around a target interval.
          </li>
          <li>
            <strong>Spectral Alignment Training</strong>: rate perceived stability under fixed tuning while varying timbre/spectrum.
          </li>
          <li>
            <strong>Continuous Pitch Control</strong>: lock pitch in a continuous space; records cents error and stabilization time.
          </li>
        </ul>
        <p className="text-gray-400">
          Tip: for serious work, keep conditions fixed (timbre, tuning, range) and lock the random seed where available.
        </p>
      </Section>

      <Section title="14. Tuner (Microtonal) — Real instrument calibration" color="text-teal-300">
        <div className="space-y-3 text-gray-400">
          <p>
            The microtonal tuner listens to your instrument (microphone input), finds the nearest target from your mapping/profile, and shows whether you
            are <strong>sharp</strong> or <strong>flat</strong> (in cents).
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Create profiles per instrument (base frequency, mapping mode, steps, mapping data).</li>
            <li>Use “Start” to request microphone permission and begin detection.</li>
            <li>For best results: play a clean tone, reduce room noise, and keep the mic close to the source.</li>
          </ul>
        </div>
      </Section>

      <Section title="15. AR & Mobile notes" color="text-emerald-300">
        <div className="space-y-2 text-gray-400">
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong>AR:</strong> toggle from the MENU; requires WebXR (typically Chrome on Android with ARCore). It also requires HTTPS (or localhost).
            </li>
            <li>
              <strong>iOS:</strong> WebXR AR support is limited; use standard mode if AR is unavailable.
            </li>
            <li>
              <strong>Performance:</strong> large node counts can be heavy on mobile; use simplification and smaller generation settings.
            </li>
          </ul>
        </div>
      </Section>

      <Section title="16. Data, presets & troubleshooting" color="text-red-300">
        <div className="space-y-3 text-gray-400">
          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Backup / Restore</strong>
            Use <strong>CONFIG</strong> header actions to backup/restore settings. If you change many tabs, use Undo/Redo (config history) to step back.
          </div>

          <div>
            <strong className="text-white text-[10px] uppercase block mb-1">Common issues</strong>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <strong>No sound:</strong> unlock WebAudio (press Play/Test once), check master gain, and ensure the tab is active.
              </li>
              <li>
                <strong>Mic/MIDI not working:</strong> grant browser permission; some mobile browsers limit WebMIDI/mic processing.
              </li>
              <li>
                <strong>Can’t find a note:</strong> increase prime limit/branching/expansion, then Apply & Regenerate.
              </li>
              <li>
                <strong>Interaction feels broken:</strong> reduce node count (GEN), enable simplification, and try Node Spacing.
              </li>
              <li>
                <strong>Blank/dark screen after a reset:</strong> refresh; if it persists, clear site data for localhost and reload.
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="CALIBRATION & EXPERIMENT PRACTICE" color="text-teal-300">
        <p className="text-gray-400">
          This system treats results as <strong>condition-dependent</strong>. For reproducible experiments, fix: timbre/synth patch, loudness, tuning
          system, pitch range, and random seed.
        </p>
        <p className="text-gray-400">
          Interpret outcomes as distributions and stability regions, not single-trial correctness. See <strong>docs/calibration</strong> for the full
          Perceptual Calibration Manifesto and experiment guide.
        </p>
      </Section>

      <Section title="DANGER ZONE" color="text-red-500">
        <p className="text-gray-400 mb-3">
          If the application enters an unrecoverable state or you wish to completely wipe all local data (settings, saved chords, keyboards, commas), use the button below. This action cannot be undone.
        </p>
        
        {clearStep === 'idle' ? (
            <button 
                onClick={startClear}
                className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 py-3 rounded font-black uppercase tracking-widest transition-all"
            >
                Clear Everything (Factory Reset)
            </button>
        ) : (
            <div className="bg-red-900/10 border border-red-900/50 p-4 rounded animate-in fade-in zoom-in-95 duration-200">
                <p className="text-red-400 text-xs font-bold mb-2 uppercase text-center">Security Verification</p>
                <p className="text-gray-400 text-center mb-4 text-[10px]">
                    To confirm total erasure, enter the code below:
                </p>
                
                <div className="text-center mb-4">
                    <span className="text-2xl font-mono font-black text-white bg-black/50 px-4 py-2 rounded tracking-widest select-all">
                        {verifyCode}
                    </span>
                </div>

                <input 
                    type="text" 
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="Enter code"
                    className="w-full bg-black border border-red-900/50 rounded p-2 text-center text-white font-mono font-bold mb-3 focus:border-red-500 outline-none"
                />

                <div className="flex gap-2">
                    <button 
                        onClick={() => setClearStep('idle')}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded font-bold text-xs uppercase"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={doClear}
                        disabled={inputCode !== verifyCode}
                        className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded font-bold text-xs uppercase transition-all"
                    >
                        Confirm Wipe
                    </button>
                </div>
            </div>
        )}
      </Section>

      <div className="mt-8 mb-4 p-4 rounded-xl border border-gray-800 bg-gray-900/50 text-center">
        <p className="text-[10px] text-gray-500 font-medium">
            Should you have any inquiries or find any bug, please contact me via email: <a href="mailto:dongxinkaidxk@gmail.com" className="text-blue-400 hover:text-blue-300 hover:underline transition-colors">dongxinkaidxk@gmail.com</a>. Thank you.
        </p>
      </div>
    </div>
  );
};
