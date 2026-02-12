# API Surface (Top 10 Refactor Targets)

This file captures the stable export surface for each target. When splitting
files, keep these exports identical in name and behavior.

## engine/midi/__tests__/deviceManager.test.ts
Stable exports:
- none (test file)

Allowed internal changes:
- test refactors, helper extraction, reordering of test cases

Forbidden changes:
- removing coverage for existing behaviors without replacement

## components/overlays/simple/AdaptiveTemperamentSolver.tsx
Stable exports:
- `AdaptiveTemperamentSolver` (React component)

Allowed internal changes:
- refactor internal helpers and UI composition

Forbidden changes:
- rename the export
- change the `settings: AppSettings` prop contract

## components/overlays/SettingsTabsPart3.tsx
Stable exports:
- `GenTab` (React component)

Allowed internal changes:
- refactor internal UI logic, split helpers

Forbidden changes:
- rename the export
- change the public props contract

## components/overlays/simple/RatioTool.tsx
Stable exports:
- `RatioTool` (React component)

Allowed internal changes:
- refactor internal UI logic, split helpers

Forbidden changes:
- rename the export
- change the public props contract

## components/setharesEngine/sethares/SetharesExperiment.tsx
Stable exports:
- default export: `SetharesExperiment` (React component)

Allowed internal changes:
- refactor internal helper functions and state

Forbidden changes:
- remove or rename the default export
- change externally observable props or behavior

## components/overlays/SettingsTabsPart2.tsx
Stable exports:
- `KeysTab` (React component)
- `SymTab` (React component)
- `MidiTab` (React component)

Allowed internal changes:
- refactor internal UI logic, split helpers

Forbidden changes:
- rename any export
- change public props contracts

## components/overlays/ear/EarLogic.ts
Stable exports:
- `formatSequenceAnswer`
- `formatDuoAnswer`
- `formatProgressionAnswer`
- `DEFAULT_INTERVAL_RATIOS`
- `buildDefaultIntervalPool`
- `DEFAULT_SCALES`
- `buildIntervalPool`
- `buildChordPool`
- `buildMelodyPool`
- `buildDuoMelodyPool`
- `buildProgressionPool`
- `getSignatureKey`
- `buildQuestionFromSignature`
- `generateQuestion`

Allowed internal changes:
- refactor helper functions and data structures

Forbidden changes:
- rename or remove any export
- change output formatting or question generation behavior

## timbreEngine.ts
Stable exports:
- `TimbreContext` (type)
- `reportTimbreEngineError`
- `clearTimbreEngineError`
- `getTimbreEngineError`
- `updateTimbreModState`
- `getNoteKey`
- `resolveTimbrePatch`
- `panicTimbreEngine`
- `startTimbreVoice`

Allowed internal changes:
- refactor internal helpers and state, split into submodules

Forbidden changes:
- rename or remove any export
- change audio/timbre runtime behavior or timing semantics

## components/museum/MuseumArchitecture.tsx
Stable exports:
- `MuseumArchitecture` (React component)

Allowed internal changes:
- refactor layout helpers and subcomponents

Forbidden changes:
- rename the export
- change externally visible scene composition or behavior
