# Multidimensional Tuning Lattice (Dynamic N-Dimensional Prime-Limit Harmonic Lattice & Synthesizer)
**Version:** 2.2.6  
**Primary stack:** React 18 + TypeScript + Three.js (React Three Fiber/Drei) + Zustand + Tailwind + Web Audio + (optional) Web MIDI + (Android app) Capacitor + ARCore

> This README is intentionally **ultra-extreme detail** and is written as a **complete, feature-level specification of what the app already contains**, including UI entry points, behavior, settings properties, and tool modules.  
> It is **not** an AR-only document—AR is treated as one subsystem among many.

---

## 0) What this app is (the “mental model”)
This app is a *microtonal theory + visualization + performance workstation* built around one core representation:

- **Ratios (Just Intonation / harmonic relations)** are represented as **prime-factor exponent vectors** (Monzos / prime vectors).
- Those vectors are rendered as positions inside a **multidimensional lattice**, typically viewed in **3D** (with configurable geometry/projections).
- Selection of lattice nodes can:
  - play sound via **internal WebAudio synth**
  - map to and from **MIDI input/output** (Web MIDI on desktop, plus retuning tools)
  - feed analysis tools such as **ratio statistics**, **progressions**, **chord comparison**
  - integrate with high-level tools: **Adaptive Temperament Solver**, **Comma Search**, **Harmonic Superposition**
  - integrate with the **Sethares roughness engine** (timbre → dissonance metrics)
  - optionally project into **AR** (WebXR or Android native ARCore) for spatial interaction

You can think of the app as three tightly-connected layers:

1) **Lattice layer (geometry + generation):** create and navigate the harmonic lattice  
2) **Sound + IO layer (audio + MIDI + retuning):** hear and control it in real time  
3) **Utilities layer (math/tools/solver/library/training):** analyze, solve, learn, practice  

---

## 0.5 Repository hygiene (tracked vs ignored)

| Category | Tracked | Ignored |
| --- | --- | --- |
| Source code | `src/`, `components/`, `store/`, `utils/`, `domain/`, `engine/` | build outputs |
| Documentation | `docs/`, `openspec/`, `ARCHITECTURE.md` | temp exports |
| Assets | `public/`, `ui_baseline/` (intentional) | `dist/`, `build/`, `coverage/` |
| Tests | `tests/` | `test-results/`, `playwright-report/` |
| Mobile | `android/` sources | `android/app/build/`, `android/.gradle/` |
| Local env | `.env.example` | `.env*` (real secrets), `certs/` |

Notes:
- `ui_baseline/` is intentionally tracked for visual regression baselines.
- Generated output must not be committed; `.gitignore` is the source of truth.

## 0.6 Git hooks (local dev)
- `postinstall` configures repo-local hooks under `.githooks/` when `.git` exists.
- Pre-commit runs only lightweight checks (conflict markers, import hygiene).
- If the repo is used as a ZIP drop without `.git`, the hook installer no-ops safely.
- Dev workflows should use `package.json` scripts (no machine-specific batch files).

---

## 1) Primary UI layout: what you see first
### 1.1 The 3D lattice viewport (main canvas)
- Central interactive scene:
  - nodes (ratios) rendered as instanced objects
  - edges optionally rendered (depending on mode)
  - optional overlays/labels
- Camera controls:
  - rotate / pan / zoom (mouse + touch)
  - “view mode” (auto vs fixed) affects how the camera behaves relative to lattice changes

### 1.2 Top Bar (global controls)
The top bar is the main “always available” control surface. It typically includes:

- **Project title / status indicator**
- **Selection navigation:** “Prev / Next” through selection history
- **Selection status** (current selection target and/or mode)
- **View mode toggle:** e.g. `VIEW: AUTO` vs fixed
- **ORIGIN** action: jump camera/selection back to origin reference
- **PURE** action: (contextual) toggles a purity-related view/behavior (e.g. ratio labeling vs name; or purity constraints depending on mode)
- **MENU**: opens the main overlay panel system (settings/tools/library/help/etc)
- **Axis / dimension selectors**: e.g. `X`, `Y`, `3L`, `5L` etc (contextual controls for which lattice axes / generators are being emphasized or constrained)
- **Search** input: “Search note or ratio…” with a **GO** action
  - accepts note-ish queries and ratio-ish queries (see Search section)

### 1.3 Overlay system (panels)
Most advanced functionality is exposed through overlay panels. The main “Settings panel” is actually a multi-tab system (GEN/AUDIO/TIMBRE/VIS/MIDI/RETUNE/SHORTCUT/DAW/EXT/TOOLS/MATH/SYM/LIBRARY/THEORY/HELP).

### 1.4 Mobile UI shell
On mobile:
- A **MobileControlCenter** with:
  - **MobileDrawer** (safe drag handle; avoids accidental close)
  - **MobileNavBar**
  - **MobileOverlay** layer system
  - **MobileErrorBoundary** (crash containment + user-friendly recovery)

---

## 2) Feature map (complete module inventory)
Below is a *functional map* of what exists in the current app:

### 2.1 Lattice generation + visualization
- Prime-limit lattice generation (multi-gen system)
- Expansion controls (distance, direction, per-prime lengths)
- Roots/origins (primary + secondary origins)
- Geometry modes (projections / layouts)
- Spiral modes (alternate embedding/arrangement)
- Display modes (labels, opacity, visibility ranges, surface ratio text)
- Simplification/deduplication and connectivity checks
- Loop options (Gen0/Gen1 loop detection/visual loop shaping)
- Comma spreading panel (visual and/or analytic spreading rules)
- Branch limits panel (limit how far or which branches expand)
- Equal-step generator (EDO / equal divisions) and expression parsing
- Original axis roots (select axis anchoring scheme)

### 2.2 Sound engine (internal synth)
- WebAudio-based poly synth with patch editor
- Separate patches for lead vs chord contexts
- Envelope, filter, LFO, unison, glide/portamento
- Gain staging and safe defaults
- Tuner panel integration (reference tuning + monitoring)
- Timbre layer integration (timbre presets / timbre settings)

### 2.3 Timbre / synthesis utilities
- Timbre tab (global timbre settings)
- Timbre MSEG editor (multi-segment envelope generator for timbre shaping)
- Sethares experiment view (timbre partials ↔ roughness analysis)
- Spectrum editor + advanced partial table
- Roughness curve + triad heatmap
- Optional hover audio audition inside Sethares experiments
- Sethares MIDI integration helpers (for driving/reflecting experiments)

### 2.4 MIDI + retuning ecosystem
- Web MIDI connectivity (desktop)
- Device manager panel (connect/disconnect/choose devices)
- MIDI input mapping section
- MIDI output section
- Mapping strategies (cent matching / lattice search, axis lock behaviors, filters)
- Calibration workflow (align physical key to lattice origin)
- Key filters (e.g. white keys only, black keys only)
- MIDI file retune section:
  - choose scale
  - apply custom scale to MIDI retuning workflow
  - Scala archive picker integration
  - custom scale generation helpers

### 2.5 External / DAW retuning (Retuner)
- Retuner settings panel (external destinations)
- Plugin manager (output destinations + plugin-style configuration)
- Destination types (internal routing abstraction)
- MPE zone configuration
- Retuning snapshots and sync logic

### 2.6 Tools + math + analysis
- Ratio Tool (single / chord / derive modes)
- Ratio Statistics Panel
- Comparison Tray (compare selected sets/chords)
- Progression Panel (sequence/progression management)
- Scale Builder (build/assemble scales)
- Retune Snap Panel (capture + recall tuning snapshots)
- Consequential Builder (guided builder workflow, buffered inputs, structured view)
- Math Function Tab:
  - Function gallery
  - Graph editor
  - Math object list
  - Note set inspector

### 2.7 Symmetry + shortcuts + utility tabs
- SYM tab (symmetry/structure tools + axis constraint behaviors)
- Keys/Shortcut tab (keyboard shortcuts and mappings)
- Library tab (Scala archive browsing/selection workflow)
- Theory overlay (learn mode) with multi-part content
- Help tab (in-app help and usage guidance)

### 2.8 Simple Mode (human-friendly guided experience)
A dedicated overlay system:
- Simple tutorial (step-driven)
- Simple prompt (guided actions)
- Simple manual config
- Simple comma search
- Harmonic superposition
- Adaptive temperament solver
- Electives (extra guided utilities)
- Specialized UI widgets: quad weight pad, octa pad, octa-cube 3D view

### 2.9 Ear training
- Ear training overlay + panels
- Pro settings panel
- Stats + mistakes tracking
- Content pools for training (intervals/compare/drift etc)

### 2.10 Microtonal Museum (3D experiential module)
A distinct “world” feature set:
- Museum scene + environment + architecture
- Player controller + tour controller
- Wayfinding + HUD + inspect panels
- Acoustics controller + exhibit audio
- Lighting tuning + renderer tuner + performance probe
- Exit ritual system + finale plaque
- Debug tooling (luma debug, performance probe)

### 2.11 DevZone experiments
- DevZone loader + DevZone
- Example experiment: TrichromaticExperiment

### 2.12 AR subsystem (two paths)
- Desktop / non-AR platforms: **Simulated AR** (interaction mode, no SLAM)
- WebXR AR (where available): browser-based AR
- Android native ARCore (inside app):
  - 6DoF world tracking (SLAM)
  - plane detection
  - anchors
  - occlusion (plane-based + depth-based for supported devices)
  - C3 modes: fullscreen AR + panel viewport AR (plan A: AR view behind WebView + viewport window)

---

## 3) Deep UI tour: Settings Panel tabs (what each tab does)
The settings panel is the central hub for configuration. Tabs are:

- **GEN** — lattice generation, prime limits, expansion, roots, loops  
- **AUDIO** — synth patches, tuner, playback behavior  
- **TIMBRE** — timbre presets/settings, MSEG, timbre shaping  
- **VIS** — rendering, labels, opacity, geometry/spiral modes  
- **MIDI** — devices, mapping, input/output behaviors  
- **RETUNE** — MIDI file retuning workflow  
- **SHORTCUT** — keyboard shortcuts & quick actions  
- **DAW/EXT** — external retuning destinations and plugin manager  
- **TOOLS** — harmonic utilities (Ratio Tool) integrated into the panel system  
- **MATH** — graph/function tools, note-set inspector  
- **SYM** — symmetry tools / structure / special mappings  
- **LIBRARY** — Scala archive browsing and selection  
- **THEORY** — learn-mode overlay content  
- **HELP** — usage help and guidance  

Below is a functional description of each tab.

---

## 4) GEN tab (Generation): lattice creation & growth controls
GEN is where you define **what lattice exists**.

### 4.1 Prime limit and generator limits
- **maxPrimeLimit**: choose the highest prime allowed in ratios shown (e.g. 11-limit, 19-limit).
- Optional per-generation prime limits:
  - gen1MaxPrimeLimit … gen4MaxPrimeLimit
- Optional explicit prime sets per generation:
  - gen1PrimeSet … gen4PrimeSet

**User-facing behavior:** changing prime limit changes what ratios are allowed and therefore what nodes can appear.

### 4.2 Root limits and origins
- **rootLimits**: primes treated as foundational axes for root growth.
- **secondaryOrigins**: additional origin anchors (multiple centers).

**User-facing behavior:** origins allow multi-center lattice views; root limits affect which primes define “main” structure.

### 4.3 Expansion direction and distance parameters
- **expansionDirection**: both / positive / negative
- **expansionA / expansionB**: core expansion radii/parameters (app uses these to bound generation)
- **expansionDistancePanel**: provides the UI for how far the lattice grows and which branches are included.

### 4.4 Generation length controls
- **gen0MaxLength**: hard cap on generation length
- **gen0MaxDisplayLength**: display cap (performance + readability)
- **gen0CustomizeEnabled**: per-prime custom lengths enabled
- **gen0Lengths**: per prime default length (e.g. 3:12, 5:12…)
- **gen0Ranges**: optional per-prime range overrides
- **gen1Lengths / gen2Lengths / gen3Lengths / gen4Lengths**: similar for higher gens (if enabled by app flow)

**User-facing behavior:** lengths determine how many steps along each prime axis are generated, heavily affecting node count and performance.

### 4.5 Loop options panels (Gen0 + Gen1)
Two dedicated panels exist:
- **Gen0LoopOptionsPanel**
- **Gen1LoopOptionsPanel**

These are used to:
- detect/shape loops (commas) visually
- optionally adjust vector lengths to create loop closure effects (where supported)

### 4.6 Branch limits panel
- **BranchLimitsPanel** constrains which “branches” of the lattice expand (depth/width constraints).

**User-facing behavior:** prevents runaway growth; focuses the lattice on musically relevant substructures.

### 4.7 Comma spreading panel
- **CommaSpreadingPanel** configures how commas (small discrepancies) are distributed/visualized/handled.

**User-facing behavior:** affects how temperament-like behaviors appear in the lattice layout or analysis.

### 4.8 Equal step panel (EDO / expression inputs)
- **EqualStepPanel**: generate equal-step structures (EDO-like) and supports math expressions in inputs.

**User-facing behavior:** lets users create equal divisions and compare them to JI structures.

---

## 5) VIS tab (Visual): how lattice is rendered
VIS controls **how you see** the lattice.

### 5.1 Display mode panel
- **DisplayModePanel**: high-level visual presets and toggles (labels on/off, density, readability modes).

### 5.2 Geometry mode panel
- **GeometryModePanel**: selects projection/geometry arrangement rules for the 3D layout.
- **OriginalAxisRootsPanel**: chooses how axis roots are anchored and how axis vectors are interpreted.

### 5.3 Spiral mode panel
- **SpiralModePanel**: alternative “spiral” embedding settings.
- Also exposed via lattice overlay components:
  - `SpiralSettings.tsx`

### 5.4 Expansion distance panel
- **ExpansionDistancePanel** exists in VIS/GEN context (depending on UI grouping) to tune how dense the shown lattice is.

### 5.5 Simplification panel
- **SimplificationPanel**:
  - dedup rules
  - connectivity checks
  - node/edge simplification logic
  - performance-friendly reductions that preserve musical meaning

### 5.6 Node & label rendering (advanced)
The app includes **node-surface ratio labeling** and advanced label placement:
- show ratio text on node surfaces
- place ratio text above node
- filter which nodes show labels:
  - all nodes
  - near center only
  - main axis only
  - combined modes

### 5.7 Rendering materials and density
- node material/shapes are configurable (e.g. sphere-ish vs alternate)
- edge opacity control
- per-prime color and opacity control
- per-generation opacity controls
- “max visible generation” controls density

---

## 6) AUDIO tab: internal synth & playback behavior
AUDIO is where you define **what you hear**.

### 6.1 Patch system (lead + chord)
The app supports separate patches for:
- **leadPatch** (single note / melodic interactions)
- **chordPatch** (poly / chord playback)

Patch editor features include:
- overall gain
- oscillator stack (type + mix gain + optional detune cents)
- envelope (attack/decay/sustain/release in ms)
- filter (type/cutoff/Q + env amount)
- LFO (waveform/rate/depth/target)
- unison (voices/detune/spread)
- glide (portamento ms)

### 6.2 Tuner panel
- reference tuning, monitoring, and “tuner-like” support tools
- assists calibration when working with external devices or temperament experiments

### 6.3 Playback controls
- polyphony limits (where configured)
- release safety / envelope defaults to avoid clicks
- optional chord/stack playback modes (depending on UI state)

---

## 7) TIMBRE tab: timbre presets, shaping & MSEG
TIMBRE is where you define **spectral character** and advanced shaping.

### 7.1 Timbre settings
- choose preset timbres
- adjust timbre parameters (implementation-defined, but stored as `TimbreSettings`)
- integrate with synthesis patch behavior (e.g., how oscillators/partials behave)

### 7.2 Timbre MSEG Editor
- multi-segment envelope editor for timbre modulation
- used for time-evolving timbres (especially relevant when exploring dissonance changes)

### 7.3 Sethares Engine integration (timbre → roughness)
The Sethares subsystem includes:
- Spectrum editor (partials editing)
- Advanced partial table (precise harmonic control)
- Roughness curve visualization
- Triad heatmap visualization
- Hover-audio audition tools
- MIDI integration hooks for experiment control

---

## 8) MIDI tab: device IO + mapping strategies
MIDI is where the lattice becomes a performance interface for external controllers.

### 8.1 Device manager section
- device discovery
- connect/disconnect
- select active input/output devices

### 8.2 MIDI input section
- enable/disable listening
- channel filtering (if used)
- note on/off handling
- calibration workflow:
  - press a physical key
  - set as “pressed reference”
  - align that pitch to **1/1 origin** (or selected origin)
- key filters:
  - white keys only
  - black keys only
  - other gating strategies (where implemented)

### 8.3 MIDI mapping section (how notes map into the lattice)
Mapping strategies supported by the current architecture include:
- **Lattice Search / Cent Matching:** map a MIDI note to the closest lattice node by cents distance relative to a reference.
- **Axis Lock:** map semitone motion to movement along specific lattice axes.
- hybrid behaviors (contextual, depending on configuration)

### 8.4 MIDI output section
- route lattice selections back out as MIDI notes
- use pitch mapping/retuning workflows as configured
- output device selection and channel behavior

---

## 9) RETUNE tab: MIDI file retuning workflow
This tab is specialized for taking MIDI material and applying retuning / custom scales.

### 9.1 MIDI file retune section
- choose a target scale (from:
  - current lattice-derived scale
  - saved MIDI scales
  - Scala archive picker)
- apply scale to retune logic
- utilities for custom scale generation and conversion

---

## 10) DAW/EXT tab: external retuning (Retuner)
This tab is about **sending tuning/mapping out to other environments**.

### 10.1 Retuner settings panel
- defines output destinations and retuning methods
- integrates with destination abstraction (internal vs external)

### 10.2 Plugin manager
- manage “plugins” / destination modules
- configure routing, zones, and output formatting

### 10.3 MPE zone configuration
- MPE zone definitions (lower/upper zone)
- channel ranges and pitch bend ranges (as defined in Retuner domain types)

---

## 11) TOOLS tab: Harmonic Utilities (Ratio Tool)
TOOLS is currently a high-value “do actual theory work quickly” tab.

### 11.1 Ratio Tool modes
The Ratio Tool supports:
- **Single mode:** analyze one ratio at a time
- **Chord mode:** analyze a set of ratios (interval set / chord set)
- **Derive mode:** derive new ratios from existing ones (stacking, combining, or other derivations)
- **View mode:** unified view wrapper for the above

Core capabilities include:
- ratio ↔ cents conversion
- prime factor decomposition
- formatting modes (name/ratio/both)
- apply results to lattice selection
- add derived ratios to keyboard sets (where enabled)

---

## 12) MATH tab: function graphs + note set inspectors
MATH is a mini lab for working with mathematical objects and note sets.

### 12.1 Function gallery
- curated reusable math functions (visual + reusable)

### 12.2 Graph editor
- create/edit graphs
- adjust function parameters
- inspect results

### 12.3 Math object list
- manage a list of math objects in the current session
- select to inspect or apply

### 12.4 Note set inspector
- inspect a selected set of notes/ratios
- show derived properties (interval relationships, distributions, etc)

---

## 13) SYM tab: symmetry + structure tools
SYM is for structure-based transforms and symmetry constraints.

Typical use cases:
- constrain movement/expansion to symmetrical substructures
- explore mirrored/cycled lattice subsets
- apply symmetry rules that alter which nodes are emphasized or selectable

---

## 14) SHORTCUT tab (Keys): keyboard shortcuts and fast actions
Keys tab provides:
- shortcut reference
- shortcut remapping (where provided)
- logic gates for “what counts as a shortcut” on desktop vs mobile

---

## 15) LIBRARY tab: Scala archive browsing
- Scala archive picker UI (`ScalaArchivePicker`)
- apply selected scale to current configuration
- use Scala matches in solver contexts (see Simple Mode ATS)

---

## 16) THEORY tab: learn overlay
Theory overlay is multi-part and designed as an in-app guide:
- definitions (prime limits, monzos, commas, temperaments)
- interpreting lattice geometry
- reading ratio labels and cents deviations
- practical “how to use the tools” guidance

---

## 17) HELP tab: usage help
Help includes:
- how to navigate the lattice
- how to select nodes and build sets
- where to find MIDI/retuning controls
- how Simple Mode differs from full mode
- AR notes (platform requirements, simulated vs native)

---

## 18) Analysis panels outside Settings (core overlays)
These are major overlays accessible from menu actions/top bar routes.

### 18.1 Info Panel
- shows details for currently selected node(s)
- formatting depends on ratio display settings contexts:
  - info panel formatting mode can differ from node label formatting
- typical contents:
  - ratio, cents, prime vector, derived labels
  - links/actions: add to chord set, add to keyboard, compare, etc

### 18.2 Comparison Tray
- store multiple selected items/sets for side-by-side comparison
- highlight differences:
  - ratio differences
  - cents deviations
  - prime-limit structure differences

### 18.3 Progression Panel
- manage sequences of selections
- build progressions (musical or analytic)
- step through progression and audition

### 18.4 Ratio Statistics Panel
- compute statistics over currently selected set:
  - interval distribution
  - prime usage distribution
  - size/deviation metrics
  - other summarizations

### 18.5 Scale Builder
- construct scales from selected nodes/ratios
- apply/save/export scale objects
- integrate with Scala archive workflows

### 18.6 Retune Snap Panel
- capture current tuning/mapping snapshot
- recall previous snapshots
- useful when switching between solver outputs or experimental configs

### 18.7 Consequential Builder
A guided “builder” experience for constructing harmonic objects.
- buffered input component
- structured builder view
- multi-part builder implementation for stepwise workflows

---

## 19) Simple Mode (the guided, human-friendly layer)
Simple Mode is *not* a “reduced app”; it is a curated “front door” with dedicated UIs.

### 19.1 Simple tutorial
- step-based guidance
- prompts that teach lattice navigation, selection, and interpretation

### 19.2 Simple manual config
- safe, minimal configuration controls
- avoids exposing overwhelming parameter surfaces

### 19.3 Simple comma search
- find comma-like small differences and loop candidates
- designed for quick discovery rather than full solver theory

### 19.4 Harmonic superposition
- combine structures to reveal overlaps and tension
- visual + selection-based exploration

### 19.5 Adaptive Temperament Solver (ATS)
This is one of the largest tool modules in Simple Mode.
It contains:
- header bar controls
- classic mode panel
- advanced constraints panel
- results section
- enlarged chart modal
- OctaPad / OctaCube visuals
- scala archive match integration
- scale playback integration
- derived solver visuals and actions
- helper utilities for interval sets and constraints

**Typical user flow:**
1) choose target behavior (classic vs advanced)
2) set constraints (intervals, limits, error tolerances)
3) run solver actions
4) inspect results (tables/plots)
5) audition playback
6) apply output to current lattice / export scale

### 19.6 Electives
- optional extra tools surfaced in Simple mode for discovery-driven users

---

## 20) Ear Training subsystem (practice & measurement)
Ear training is a full overlay system with analytics.

### 20.1 Ear Training Overlay
- run training sessions
- choose content pools (interval/compare/drift etc)
- control difficulty / mode

### 20.2 Pro settings panel
- advanced configuration:
  - timing
  - scoring logic
  - content weighting
  - repetition and drift rules

### 20.3 Stats + mistakes panels
- track outcomes over time
- identify common error patterns
- show per-category breakdowns

---

## 21) Microtonal Museum (immersive exploration module)
This is a unique feature: a “museum-like” 3D environment designed for exploration.

### 21.1 Scene and environment
- MuseumScene: sets up the world, environment, lighting, and architecture
- MuseumEnvironment: atmosphere and background
- MuseumArchitecture: layout and structural geometry
- MuseumLighting: lighting design

### 21.2 Player experience
- PlayerController: navigation through museum space
- MuseumWayfinding: guidance and navigation cues
- MuseumHUD: heads-up display for context
- ExhibitStand + ExhibitInspectPanel: interactable exhibits

### 21.3 Audio experience
- MuseumAcousticsController: room/space acoustics logic
- MuseumExhibitAudio: exhibit-specific audio behavior

### 21.4 Performance / tuning tools
- RendererTuner: adjust rendering knobs to fit devices
- MuseumPerformanceProbe: profiling aids

### 21.5 Ritual / narrative completion
- MuseumEntryPlaque + FinalePlaque
- ExitRitualController + exitRitualStore

### 21.6 Debug support
- LumaDebug (visual debug)

---

## 22) DevZone (experimental sandbox)
- DevZone: internal developer playground
- DevZoneLoader: load/unload experiment suites
- Example: TrichromaticExperiment

---

## 23) Search (global “Search note or ratio…”)
Search is a global tool accessible from the top bar.

### 23.1 Acceptable queries
- **ratio-like**: `3/2`, `5/4`, `7:6`, etc
- **note-ish**: textual note names (where supported)
- **cents-ish**: values that can be interpreted as cents offsets (contextual)
- The formatting used to display results is controlled by `ratioDisplay.contexts.search`.

### 23.2 Search behavior
- finds best matching node(s) in the current lattice constraints
- optionally selects a node or opens an info panel depending on context settings

---

## 24) AR subsystem (complete, accurate description)
AR exists as a subsystem with **three runtime levels**:

### 24.1 Level 1: Simulated AR (desktop-safe)
When the platform cannot provide real AR tracking (desktop browser, unsupported device), the app can enter **SIMULATED AR**:
- provides AR-like interaction semantics (camera/touch/mouse) without SLAM
- does not do plane detection, anchors, or occlusion at a sensor level

This is why desktop can display “SIMULATED AR”—it is an intentional fallback.

### 24.2 Level 2: WebXR AR (where available)
If a browser supports WebXR AR:
- the lattice can be projected into AR through the browser pipeline
- capability depends entirely on the browser + device

### 24.3 Level 3: Android Native ARCore (inside app)
In the Android app build (Capacitor), ARCore provides:
- **6DoF world tracking (SLAM)**: camera + IMU fusion
- **plane detection**: horizontal + vertical
- **anchors**: hit-test placement and persistent tracking
- **occlusion**:
  - plane-based occlusion (always available)
  - depth-based occlusion (on depth-supported devices)
- **C3 UI modes (Plan A):**
  - **Fullscreen AR:** UI mostly transparent; AR view visible behind
  - **Panel AR:** only a defined viewport window is transparent; AR is visible “inside” that panel region
  - Achieved by placing the GL AR surface **behind the WebView** and using a **viewport rect** + **scissor** on the native side.

**Important operational note:**  
On desktop, you should *not* expect native ARCore behavior—native ARCore only runs in the Android app, on ARCore-capable hardware, with camera permission granted.

---

## 25) Performance design (how the app stays usable)
### 25.1 Scene instancing
- Nodes and edges are rendered via instancing systems (`NodeInstances`, `EdgeInstances`) to keep draw calls low.

### 25.2 Density/visibility controls
- max visible generation
- per-prime/per-generation opacities
- label filtering and near-center label limits
- max display length caps in generation controls

### 25.3 Heavy compute isolation (principle)
- Tools like solver/roughness curves are designed to avoid blocking core interactions as much as possible.
- Mobile uses error boundaries and safe drawer mechanics.

---

## 26) Persistence (what gets saved)
The app persists key parts of state, typically including:
- settings (AppSettings)
- saved chords / sets
- saved keyboard layouts
- saved MIDI scales (for retuning workflows)
- tuning snapshots (Retune Snap Panel)
- retuner configuration (destinations, zones)

Persistence logic exists in the store layer (`store/logic/persistence.ts`) and is designed to keep sessions stable.

---

## 27) COMPLETE SETTINGS REFERENCE (AppSettings) — property-by-property
This section describes **every property in `AppSettings`** and what it does. Defaults come from `DEFAULT_SETTINGS` (where defined).

> Tip: many of these are *advanced*—the UI intentionally groups them to stay human-friendly. You rarely need to touch everything.

### 27.1 Mode flags
- `isArActive: boolean`  
  Whether AR mode is active (simulated, WebXR, or native depending on platform).
- `isSimpleMode: boolean`  
  Switches into Simple Mode overlay experience.
- `simpleLabelMode: 'name' | 'ratio' | 'both'`  
  How labels appear in Simple Mode (and sometimes beyond, depending on display rules).

### 27.2 Prime-limit and generation prime sets
- `maxPrimeLimit: PrimeLimit`  
  Highest allowed prime in the lattice (e.g. 11).
- `gen1MaxPrimeLimit?: PrimeLimit`  
- `gen2MaxPrimeLimit?: PrimeLimit`  
- `gen3MaxPrimeLimit?: PrimeLimit`  
- `gen4MaxPrimeLimit?: PrimeLimit`  
  Optional overrides per generation group.
- `gen1PrimeSet?: PrimeLimit[]`  
- `gen2PrimeSet?: PrimeLimit[]`  
- `gen3PrimeSet?: PrimeLimit[]`  
- `gen4PrimeSet?: PrimeLimit[]`  
  Explicit prime sets per generation group (if used).

### 27.3 Roots and origins
- `rootLimits: PrimeLimit[]`  
  The primes used as “root axes”.
- `secondaryOrigins: OriginConfig[]`  
  Additional origin points/anchors for multi-center structure.

### 27.4 Expansion shaping
- `expansionDirection: 'both' | 'positive' | 'negative'`  
  Limits growth direction along axes.
- `expansionA: number`  
  Primary expansion distance parameter (default 12).
- `expansionB: number`  
  Secondary expansion parameter (default 4).

### 27.5 Gen0 caps and customization
- `gen0MaxLength: number`  
  Hard cap for gen0 path lengths (default 1500).
- `gen0MaxDisplayLength: number`  
  Display cap (default 100).
- `gen0CustomizeEnabled: boolean`  
  Enables per-prime custom lengths.
- `gen0Lengths: Record<PrimeLimit, number>`  
  Per-prime default length values.
- `gen0Ranges: Record<string, any>`  
  Optional custom ranges per prime (implementation-defined structure).

### 27.6 Higher generation length controls
- `gen1Lengths: Record<string, number>`  
- `gen2Lengths: Record<string, number>`  
- `gen3Lengths: Record<string, number>`  
- `gen4Lengths: Record<string, number>`  
  Additional generation length maps (used when those gens are active).

### 27.7 Display/labeling: node surface ratio labels
- `nodeSurfaceRatioLabelsEnabled?: boolean`  
  Enables ratio labels rendered on node surfaces.
- `nodeSurfaceRatioFontScale?: number`  
  Scales text size.
- `nodeSurfaceRatioTexturedMode?: 'both' | 'ratioOnly' | 'textureOnly'`  
  Controls whether ratio text, texture, or both are used.
- `nodeSurfaceRatioPlacement?: 'surface' | 'above'`  
  Places ratio text on surface or floating above the node.

Label filtering:
- `nodeSurfaceRatioFilterMode?: 'all' | 'nearCenter' | 'mainAxis' | 'nearCenterAndMainAxis'`
- `nodeSurfaceRatioNearCenterCount?: number`

### 27.8 Ratio display formatting contexts
- `ratioDisplay?: { ... }`  
  Controls how ratios are formatted in different UI contexts.
  - `autoPowerDigits?: number`  
    Controls formatting of exponent-like output.
  - `contexts?: { infoPanel?, nodeDeriver?, search?, nodeLabels? }`  
    Each can choose a `RatioDisplayMode` (implementation-defined enum).

### 27.9 Timbre and tuner
- `timbre: TimbreSettings`  
  Global timbre configuration object.
- `tuner?: TunerSettings`  
  Tuner panel settings (reference and behavior).

### 27.10 Visuals (rendering)
- `visuals: { ... }`  
  Core rendering configuration:
  - `backgroundColor: string`
  - `backgroundImageUrl: string | null`
  - `limitColors: { [PrimeLimit]: string }`
  - `limitOpacities: { [PrimeLimit]: number }`
  - `genOpacities: { [genNumber: number]: number }`
  - `maxVisibleGen: number`
  - `nodeShape: NodeShape`
  - `nodeMaterial: NodeMaterial`
  - `nodeScale: number`
  - `edgeOpacity: number`
  - `lineRenderingMode: ...` (implementation-defined)
  - additional visual toggles for grid/axes/labels (where present)

> The `visuals` object is intentionally rich: it allows both “performance minimal” and “theory maximal” presentations.

### 27.11 Audio synthesis settings (patches)
- `audio: { ... }`
  - `leadPatch: SynthPatch`  
  - `chordPatch: SynthPatch`  
  - per-patch properties:
    - `name: string`
    - `gain: number`
    - `osc: Array<{ type, gain, detuneCents? }>`
    - `env: { attackMs, decayMs, sustain, releaseMs }`
    - `filter: { enabled, type, cutoffHz, q, envAmount }`
    - `lfo: { enabled, waveform, rateHz, depth, target }`
    - `unison: { enabled, voices, detuneCents, stereoSpread }`
    - `glideMs: number`

### 27.12 MIDI settings (high-level)
- `midi?: { ... }`
  Typically includes:
  - device selection identifiers
  - enable flags for input/output
  - mapping strategy config
  - calibration state
  - filters (white-only / black-only)
  - channel rules and note mapping rules

### 27.13 Retuner settings
- `retuner?: RetunerSettings`  
  External destination and plugin manager configuration.

### 27.14 Symmetry + keys + library + help/theory tab state
Various properties store:
- which subpanels are expanded
- which selected library scale is active
- shortcut mappings and toggles
- symmetry constraints and transform selections
- last-open tab / tab grouping memory

---

## 28) Android build (native app) summary
The repository includes an Android project under `android/` (Capacitor).
Key characteristics:
- ARCore is configured as **required** in the Android manifest for the native AR build variant.
- Native AR rendering uses an OpenGL surface behind the WebView (Plan A) with a viewport-rect based panel mode.

---

## 29) “What’s the fastest way to learn this app?”
If you want a practical ramp:

1) **Start in Simple Mode**  
   - follow the tutorial and try Ratio Tool + Simple Comma Search  
2) Return to full mode and open:
   - **GEN** → adjust prime limit and expansion lengths  
   - **VIS** → enable labels / adjust density  
3) Play sound:
   - **AUDIO** → tweak lead patch and chord patch  
4) Then:
   - **MIDI** → map a controller
   - **Sethares** → explore timbre roughness
   - **ATS** → solve a temperament and apply it
5) Finally, on Android:
   - use native ARCore for spatial lattice placement and interaction

---

## 30) Known constraints 
- Some features depend on platform capabilities:
  - Web MIDI requires browser support and user permission.
  - WebXR AR requires browser/device support.
  - Native ARCore requires Android hardware + ARCore services + camera permission.
- High prime limits + large expansion lengths can generate very large node counts; VIS/GEN limits exist to keep the app responsive.

---

## 31) Glossary (quick reference)
- **Ratio**: frequency proportion like 3/2  
- **Prime limit**: maximum prime allowed in ratio factorization  
- **Monzo / prime vector**: exponent vector representation of a ratio  
- **Comma**: small discrepancy ratio that becomes relevant in temperament  
- **Temperament**: mapping that “collapses” certain commas  
- **EDO**: equal division of the octave (equal-step generator)  
- **Roughness (Sethares)**: modeled sensory dissonance derived from partial interactions  
- **MPE**: MIDI Polyphonic Expression (per-note expressive control)  

---

# Appendix A — Where features live in the code (navigation hints)
If you are auditing features:

- Main overlays: `components/overlays/*`
- Lattice rendering: `components/lattice/*`
- MIDI UI: `components/overlays/settingsTabsPart2/*`
- Advanced visual/generation panels: `components/overlays/settingsTabsPart3/*`
- Simple Mode suite: `components/overlays/simple/*`
- Sethares engine: `components/setharesEngine/*`
- Ear training: `components/overlays/ear/*`
- Microtonal Museum: `components/museum/*`
- Native AR wrapper (web/TS): `nativeAR/*` and `components/nativeAR/*`
- Android native AR implementation: `android/app/src/main/java/.../ar/*`
- Defaults: `constants.ts` (`DEFAULT_SETTINGS`)

---

## Roughness Terrain (3D)

This tool renders a two-axis roughness landscape from a partial spectrum and supports minima search, scale comparison, and exports.

Quick start (browser UI):
- `npm run dev` then open the app and navigate to Roughness Terrain.
- Select a timbre preset, adjust grid resolution, and click **Generate**.
- Use **Compare Scale** for scale consistency checks and **Export** buttons for files.

Quick start (CLI):
- `npm run roughness:terrain -- --out=roughness_output`
- Optional config file: `npm run roughness:terrain -- --config=path/to/config.json --out=roughness_output`

Minimal config (JSON):
```
{
  "baseFreq": 220,
  "timbre": { "preset": "saw", "partialCount": 12 },
  "sampling": { "xSteps": 128, "ySteps": 128 },
  "roughness": { "ampThreshold": 0.001 },
  "normalizationMode": "energy"
}
```

Outputs:
- `grid_raw.bin`, `grid_normalized.bin`: binary matrices
- `grid_normalized.csv`: text matrix
- `minima.csv`: minima list with rational approximations
- `report.txt`: reproducible config summary

Troubleshooting:
- Slow compute: lower grid steps or partial count, or enable auto resolution.
- Flat terrain: spectrum may be too simple; increase partial count.
- Empty view: verify ranges and ensure ratios are positive.
- NaN warnings: check custom spectrum for invalid values.

Minimum environment:
- Node 20
- Modern Chromium-based browser for the 3D view
