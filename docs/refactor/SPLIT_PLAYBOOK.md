# Split Playbook (SOP)

Purpose: split large files safely without changing behavior or UI.

Order of operations:
1) Types and constants
2) Pure logic (deterministic helpers)
3) Glue code (composition and orchestration)
4) Side-effects (WebAudio/WebGL/MIDI)

Forbidden operations by stage:
- Types stage: no behavior changes, no side-effects
- Pure logic stage: no IO, no runtime state mutation
- Glue stage: no public API changes
- Side-effects stage: no timing/behavior changes

Required gates for every split step:
- `npm ci`
- `npm run verify`
- `npm run ui:check:shots`
- `npm run depcheck` (if enabled in doctor)

Notes:
- Keep legacy file as a thin facade exporting the same names.
- Do not move UI components unless a facade exists and lint allows it.
