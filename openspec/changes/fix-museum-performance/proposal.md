# Proposal: Fix Museum Performance

## Status
Status: Active on 2026-01-28

Notes: Core performance refactors landed, but the remaining tasks in `tasks.md` are not fully completed.

## Why
Mobile users experience single-digit FPS and crashes due to GPU/CPU overload.

## What
-   **Exclusive Rendering:** Refactor `App.tsx` to unmount background scenes when `MuseumScene` is active.
-   **Physics Decoupling:** Refactor `PlayerController.tsx` to decouple the physics loop from React state updates by using Refs.
-   **Mobile Scene Tuning:** Optimize `MuseumScene.tsx` settings (DPR, Shadows) for mobile.

## Impact
Critical performance improvement; touches `App.tsx` and `components/museum/`.


## Progress Notes (2026-01 Rebuild)

Performance-critical changes were addressed as part of the museum refactor:
- Removed expensive environment complexity and grid-like light spam.
- Kept shadows off for low/medium quality; only enabled a single key shadow in high quality.
- Throttled store updates remain (5Hz) and movement HUD is gated by player speed.
