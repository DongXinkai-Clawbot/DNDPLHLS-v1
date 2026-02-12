# Architecture Map

This repository contains a web-first React/Vite app with optional Capacitor Android packaging. The app runs in multiple user-facing modes (Lattice, Museum, AR) and provides math-driven tools (Math Lab, Consequential Builder, Retuner, etc.) via overlays.

## Runtime entry
- `index.html` mounts React once via `index.tsx`.
- `index.tsx` wraps the app in error boundaries and mounts `App.tsx`.
- `App.tsx` selects the active mode and overlays.

## Styles system (Tailwind + CSS entry)
- Tailwind MUST go through the local build pipeline (PostCSS/Vite). No CDN injection in `index.html`.
- CSS has a single entry point: `index.tsx` imports `index.css`.
- Do not add additional global CSS links in `index.html` (prevents duplicate load and ordering issues).
- Mobile-only tweaks are injected by `scripts/build-mobile.js` via `public/mobile-optimizations.css`.

## Device model (single source of truth)
- Device capabilities live in `utils/capabilities.ts` (`getDeviceCapabilities`).
- `hooks/useDeviceType.ts` is a thin reactive wrapper over those capabilities.
- Performance tiers (`utils/performancePolicy.ts`) must only depend on `getDeviceCapabilities`.
- Avoid UA-regex duplication in features; all mobile/low-end checks should flow from the shared model.

## Mobile stability entrypoint
- Centralized in `utils/mobileStability.ts`.
- Other modules should not install their own memory pollers or WebGL error listeners.
- Use `performMobileCleanup()` and `initMobileStability()` instead of ad-hoc handlers.

## Top-level modes
### Lattice mode
- 3D scene: `components/Lattice3D.tsx`
- UI overlays:
  - Desktop: `components/DesktopOverlay.tsx`
  - Mobile: `components/mobile/MobileOverlay.tsx`

### Museum mode
- Scene: `components/museum/MuseumScene.tsx`
- UX + HUD:
  - `components/museum/MuseumUX.tsx`
  - `components/museum/MuseumHUD.tsx`
- Materials/shaders: `components/museum/materials.ts` and nearby files.

### AR mode
- Container: `components/ARContainer.tsx`
- Toggle is controlled by settings (`settings.isArActive`) from the store.

## Overlay architecture
Overlays are UI "apps" layered on top of the 3D scene and share state via the store.

- Overlay router: `components/app/ModeRouter.tsx`
- Overlay shells: `components/app/AppShell.tsx`, `components/overlays/SimpleOverlay.tsx`
- Key overlays:
  - Consequential Builder: `components/overlays/ConsequentialBuilder*.tsx`
  - Math Lab: `components/overlays/math/*`
  - Retune/MIDI: `components/overlays/settingsTabsPart2/*`, `components/retuner/*`
  - Library/Settings/Theory: `components/overlays/*`

## Math Lab (Function Grapher)
Math Lab is a mini environment for function visualization, dot editing, and mapping to audio.

### Entry + layout
- Entry: `components/overlays/math/MathFunctionTab.tsx`
- Left panel: Library and Object list (`FunctionGallery.tsx`, `MathObjectList.tsx`)
- Center: `GraphEditor.tsx` (SVG graph + dot interaction)
- Right: `NoteSetInspector.tsx` (mapping, playback, dot list, export)

### Data model
Types: `typesPart1.ts`
- `MathObject` (function definition, type, params, color, mapping flags)
- `MathNoteSet` (dots + mapping + playback + export)
- `MathDot` (point, label, role, locks, metadata)
- `MathSamplingSettings` (sampling strategy, quantization, mapping)

Schema + migrations: `utils/mathLabSchema.ts`
- Defines `MATHLAB_SCHEMA_VERSION`
- `createDefaultMathLabState()`
- `migrateMathLabState()` with validation/sanitization

### Sampling + rendering pipeline
- Sampling utilities: `utils/mathLabUtils.ts`
  - `sampleObject()` routes to explicit/parametric/polar/implicit samplers
  - `resampleByArcLength()` provides arc-length sampling
  - Implicit uses marching-squares-like segment stitching
- Graph render: `components/overlays/math/GraphEditor.tsx`
  - SSOT sampling: active NoteSet mapping > global Math Lab sampling
  - Adaptive sampling while interacting (lower res during drag/zoom)
  - Optional invalid-point policy (break/skip/mark/clamp)
  - Implicit draws `segments` instead of flattening points
  - Vector fields rendered as arrow grids (worker-backed)

### Mapping + playback
- Dot → pitch mapping: `utils/mathDotPitch.ts`
  - Supports ratio/cents/hz/bounded, quantization, normalize-to-octave
- Playback and export: `NoteSetInspector.tsx`
  - `playSet()` uses note/chord mode and timing fields
  - Export to keyboard uses mapping + order + dedupe

### Variable bindings (parameter control)
- Extract variable names: `utils/mathVariableUtils.ts`
- Stored in `mathLab.unifiedFunctionState` and edited in `NoteSetInspector.tsx`

## Consequential Builder (scale generator)
- Entry: `components/overlays/ConsequentialBuilder*.tsx`
- Scale runtime: `utils/consequentialScale.ts`
- Export from Math Lab: `MathObjectList.handleExport()` → `ConsequentialScaleConfig`

## Retune / MIDI subsystem
### MIDI runtime
- Device access + routing: `engine/midi/deviceManager.ts`
- SysEx transport queue: `engine/midi/sysexQueue.ts`
- Tuning map sync: `engine/midi/tuningMapSync.ts`
- Tests: `engine/midi/__tests__/`

### Retune preview + score overlay
- Realtime player: `utils/midiRealtimePlayer.ts`
- Retune section UI: `components/overlays/settingsTabsPart2/MidiFileRetuneSection.tsx`
- Horizontal score overlay: `components/overlays/PureRatioHorizontalScoreOverlay.tsx`
- Score timeline data: `domain/scoreTimeline/*`

### Retuner engine (current shape)
- Destination abstraction: `domain/retuner/destination.ts` (`OutputDestination`, `DestinationType`)
- Core engine: `engine/retuner/retunerEngine.ts`
  - Outputs notes/pitch bend via `transport.sendMidi(...)`
  - `handleNoteOn(inputNote, velocity, targetHz, inputChannel)` requires targetHz
- WebMIDI transport: `midiOut.ts` (actual byte send)

## External–External DAW pipeline (current gaps + target architecture)
This section documents the state of external input/output retuning and the upgrade plan for DAW workflows.

### Current gaps (code-verified)
- Destination types include `webmidi`, `mts-esp`, `native-host`, `internal`, but transport implementation is only complete for WebMIDI (`midiOut.ts`).
- `RetunerEngine.handleNoteOn(...)` requires `targetHz` which external MIDI input does not provide; a mapper layer is missing.
- Output preflight is lazy and can race with first note (PB range config and MPE zone config timing).
- `mts-esp-master` mixes broadcast semantics with note output, making behavior ambiguous.
- Destination status fields exist but lack a complete lifecycle and diagnostics.
- No loopback guard or input router for DAW setups; multi-input/multi-output routing is missing.

### Target architecture (MVP → Pro → Full)
#### MVP (external input → PB/MPE output, no first-note detune)
- Select external MIDI inputs.
- Choose a destination (at least WebMIDI).
- Map external notes → targetHz/targetCents via a mapper layer.
- Preflight output (PB range/MPE config) before first note.
- Panic + loopback guard.
- Minimum observability: input status, destination status, retune status.

#### Pro (daily DAW workflow)
- Routing matrix (multi-destination, zones, per-route overrides).
- MPE config throttling (avoid CC storms).
- Tuning-change policy (new-notes-only / immediate / ramp).
- Diagnostics panel with recent input/output events.

#### Full (native host + MTS-ESP)
- Native-host transport with lifecycle and capability reporting.
- MTS-ESP broadcast-only and broadcast+passthrough modes.
- Client handshake + client count + broadcast policies.

## External–External upgrade plan (modules + files)
### 1) Transport layer per destination
Introduce multiple transports with runtime status and preflight:
- WebMidiTransport (existing; add preflight + config queue)
- NativeHostTransport (new)
- MtsEspTransport (new)

Files to extend:
- `engine/retuner/retunerEngine.ts` (select transport per destination + per-dest config cache)
- `domain/retuner/destination.ts` (add status fields, capabilities snapshot)
- `components/retuner/RetunerSettings.tsx` (display status, errors, readiness)

### 2) External Input Mapper (required)
Map input MIDI to targetHz/targetCents before calling the Retuner engine.
- Strategies: 12TET-to-scale, nearest lattice by cents, fixed table, adaptive context
- Fallbacks: 12TET passthrough when scale/lattice unavailable

Files to add/extend:
- `engine/retuner/inputMapper.ts` (new)
- `engine/retuner/retunerEngine.ts` (new external entrypoints)
- `domain/retuner/types.ts` (mapping mode + source filters)
- `components/retuner/RetunerSettings.tsx` (external input controls)

### 3) Output preflight + message ordering
Introduce destination state machine: DISCONNECTED → CONNECTING → PREFLIGHTING → READY → ERROR.
- PB range/MPE config must complete before notes.
- Config messages must be higher priority than note events.

Files to extend:
- `engine/retuner/retunerEngine.ts`
- `midiOut.ts` (priority queue; config vs note)

### 4) MTS-ESP mode split
Define clear semantics:
- Broadcast-only (tuning table only)
- Broadcast + passthrough (tuning table + note passthrough)

Files to extend:
- `domain/retuner/destination.ts`
- `engine/retuner/mtsEspEngine.ts` (new)
- UI in `components/retuner/RetunerSettings.tsx`

### 5) Observability + diagnostics
- Structured error classification.
- Ring buffer of input/output events.
- Loopback guard counters.

Files to extend:
- `components/retuner/RetunerSettings.tsx`
- `utils/logger.ts` or new `retunerDiagnostics.ts`
- store runtime state in `store/storeImpl.ts`

### 6) Input router + zones
Routes define source filters → mapping → destination(s).
- Multi-input selection
- Channel masks and note ranges
- Priority + fan-out (default off)

Files to extend:
- `domain/retuner/types.ts`
- `components/retuner/RetunerSettings.tsx`
- `engine/retuner/inputRouter.ts` (new)

### 7) Tuning change policy
Define how active voices behave during tuning changes:
- new-notes-only / immediate / ramp

Files to extend:
- `engine/retuner/voiceManager.ts`
- `engine/retuner/retunerEngine.ts`

### 8) Panic spec
Normalize panic behavior (all notes off + reset controllers + PB reset).
- Trigger on destination change, zone change, PB range change, user panic.

Files to extend:
- `engine/retuner/retunerEngine.ts`
- `midiOut.ts`
- `components/retuner/RetunerSettings.tsx`

## Audio subsystem
- `audioEngine.ts` manages AudioContext lifecycles, sample registration and synth routing.
- `timbreEngine.ts` defines patch/envelope/harmonics shaping.
- `timbrePresets.ts` provides defaults.

## Store + persistence
### Store
- Zustand store: `store/storeImpl.ts` exports `useStore`.
- Store entry: `store/index.ts` re-exports store implementation.

### Persistence + schema
- Snapshot save/load: `store/logic/snapshot.ts`
- Keys: `store/logic/storageKeys.ts`
- Math Lab schema/migration: `utils/mathLabSchema.ts`
- Storage resets and migrations must go through `resetPersistedState()` and `migrateLegacyStorage()` in `store/logic/storageKeys.ts`.

## Repo hazards (agent critical)
- There is a duplicate nested directory `DNDPLHLS-master/` inside the repo root.
  - Do not import from it.
  - Do not edit it unless the task explicitly targets deduplication.

## Local HTTPS (dev only)
- HTTPS is disabled by default in Vite.
- Enable it only by setting `VITE_HTTPS_KEY` and `VITE_HTTPS_CERT` in your local env.
- Certificate files are local-only and must never be committed.

## Git hooks
- Hooks are installed via `scripts/install_git_hooks.mjs` on `postinstall`.
- Hooks live in `.githooks/` and should remain fast (pre-commit only runs lightweight checks).

## Guardrails (must pass)
- `npm run verify` (runs `doctor`)
- `npm run ui:check` (UI must be identical)
- `npm run sanity:imports`
- `npm run lint` (boundary guard)
