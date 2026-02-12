# Facade Rules (Stable Import Surface)

Purpose: keep external import paths stable while allowing internal refactors.

Rules:
1) External imports must use legacy entry points (facades).
   - Example: `audioEngine.ts` is the only public entry for audio.
2) Legacy entry files become thin facades.
   - Only re-export public symbols, or add a tiny adapter if needed.
3) New implementation code lives in internal directories.
   - Example: `engine/audio/**`, `engine/timbre/**`, `engine/ear/**`.
4) No deep imports from internal directories.
   - Enforced by `npm run lint` rules in `scripts/lint_boundaries.mjs`.
   - Example: UI must import audio APIs from `audioEngine.ts`, not `engine/audio/context`.

Allowed:
- moving code into internal modules
- re-exporting from facades

Forbidden:
- changing external import paths
- bypassing facades to import from internal directories
