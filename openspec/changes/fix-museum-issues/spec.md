# Fix Museum Performance and Display Issues

## Status
Status: Done on 2026-01-11

## Problem
The Microtonality Museum is currently suffering from:
1. **Severe Performance Lag ("Cards to death"):** Likely caused by expensive post-processing (SSAO) and high particle counts.
2. **Display Issues:** The UI overlay ("Press E to Inspect") is not visible, likely due to z-index layering issues with the 3D Canvas.
3. **Interaction Bugs:** Collision detection for exhibits is unreliable.

## Requirements

### 0. Build and Runtime Correctness (P0)
- **Fix build-breaking duplicate declaration:** Remove the duplicate `requestTeleport` declaration in `components/museum/MuseumHUD.tsx`.
- **Renderer runtime sync:** Ensure the renderer updates at runtime (not only on `Canvas` creation):
  - `toneMappingExposure` must update immediately when `graphics.brightness` changes.
  - `shadowMap.enabled` must update immediately when `graphics.quality` changes.

### 1. Performance Optimization
- **Disable SSAO:** Remove `SSAO` from `EffectComposer` in `MuseumScene.tsx`.
- **Reduce Bloom:** Lower intensity/threshold if needed.
- **Reduce Particles:** Decrease `Stars` count from 5000 to 1500.
- **Remove Grid Spotlights:** Remove the ~288 grid spotlights in `MuseumEnvironment.tsx` that were all casting shadows, causing massive GPU overhead. Only keep focused spotlights.
- **Shadow whitelist for museum architecture:** When shadows are enabled (high quality), only a small set of intentional props should cast shadows. Core architectural geometry (walls/portal solids) and high-count micro-geometry (decals like baseboards/threshold trims) must **receive** shadows but should not **cast** them.
- **Instance repeated wayfinding geometry:** The segmented spine strip is many repeated planes. Render it using instancing (base inlay + emissive hairline edge) to reduce draw calls.

- **Instance visual-only decals by material:** Replace per-decal `<mesh>` rendering with per-material `InstancedMesh` batches (unit box + per-instance scale/rotation/position) to reduce draw calls and geometry churn.

### 2. UI Visibility
- **Fix Z-Index:** Add `z-[100]` (or higher) to the `MuseumHUD` container in `components/museum/MuseumHUD.tsx` to ensure it renders on top of the 3D Canvas.

### 2.5 Onboarding UX
- **One-time pointer-lock onboarding:** The click-to-lock + Esc-to-release hint should be shown only once per user (persist across refresh) using `localStorage`.

### 3. Interaction Logic
- **Robust Collision Detection:** Update `ExhibitStand.tsx` to check `userData.type === 'player'` in addition to `name === 'player'` for more reliable trigger detection.

## Implementation Plan
1. Edit `components/museum/MuseumScene.tsx`.
2. Edit `components/museum/MuseumHUD.tsx`.
3. Edit `components/museum/ExhibitStand.tsx`.

## Progress Notes (2026-01-11)

Implemented a full museum-space refactor focused on museum-grade navigation:

- Removed the monolithic `MuseumEnvironment` (previous heavy geometry/lights) and replaced it with:
  - `MuseumArchitecture.tsx` (whitebox + colliders)
  - `MuseumWayfinding.tsx` (floor strip + door beacons + finale beacon)
  - `MuseumLighting.tsx` (three-layer lighting, quality-scaled; no grid spotlight spam)
- Reworked HUD policy to avoid “prompt spam” while moving:
  - Inspect prompt appears only when pointer-locked **and** speed is low/paused
- Enforced Esc hierarchy in `PlayerController.tsx`: Inspect → PointerLock → Menu
- Switched museum route to hash `#/museum` to avoid static-hosting 404 on refresh.

### P0 Fixes (2026-01-11)
- Fixed a build-blocking duplicate `requestTeleport` declaration in `components/museum/MuseumHUD.tsx`.
- Added a renderer sync layer so `graphics.brightness` and `graphics.quality` changes apply immediately at runtime:
  - `toneMappingExposure` updates without reloading.
  - `shadowMap.enabled` toggles without reloading.
  - Implemented via `components/museum/RendererTuner.tsx` and wired into `components/museum/MuseumScene.tsx`.

### P1 Fixes (2026-01-11)
- Reduced shadow-map cost by removing shadow casting from high-count / large static museum geometry:
  - Walls + portal solids now **receive** shadows but do not cast.
  - Decals (baseboards/threshold trims/niches/inlays) do not cast shadows.
  - Implemented in `components/museum/MuseumArchitecture.tsx`.

- Reduced draw calls for the segmented spine guiding strip by switching repeated planes to instancing:
  - Two `InstancedMesh` batches (base inlay + emissive hairline edge) replace per-segment meshes.
  - Implemented in `components/museum/MuseumWayfinding.tsx`.

- Reduced draw calls for visual-only decals by batching them into per-material instanced meshes:
  - Decals are grouped by `MuseumMaterialKey` and rendered as `InstancedMesh` with per-instance transforms (position/rotation/scale).
  - Implemented in `components/museum/MuseumArchitecture.tsx`.


- Merged static architecture meshes (floors/walls/solids) by material using merged BufferGeometries; kept per-piece colliders.

### P2 Fixes (2026-01-11)
- Persisted the pointer-lock onboarding hint so it appears only once per user (across refresh):
  - Added `mm_museum_onboarding_seen_v1` localStorage key.
  - `ui.onboardingSeen` hydrates from storage and `setOnboardingSeen` writes back.
  - Implemented in `store/museumStore.ts`; UI remains in `components/museum/MuseumUX.tsx`.


- Refined onboarding hint display conditions to reduce friction:
  - Only shows when the museum menu is closed and the pointer is not locked.
  - Avoids a one-frame flash by waiting for the initial pointer-lock state sync.
  - Implemented in `components/museum/MuseumUX.tsx`.
