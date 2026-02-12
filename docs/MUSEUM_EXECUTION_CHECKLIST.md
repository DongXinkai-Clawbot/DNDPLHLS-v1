# Museum Refactor — Final Execution Checklist (Implemented)

This checklist is both:
- a record of what was changed in this rebuild, and
- a to-do template for future iterations.

## A) Route & Entry (No-404)

- [x] Switch museum entry route to **hash** route: `#/museum`
- [x] App listens to `hashchange` (not `popstate`) and sets `appMode`
- [x] Normalize accidental `/museum` landings into `#/museum` when possible (index rewrite case)
- [x] Landing page museum card navigates to `#/museum`
- [x] Global store `initialAppMode` uses hash route

Files:
- `App.tsx`
- `components/LandingPage.tsx`
- `store/storeImpl.ts`

## B) Space Architecture (Entrance → Spine → Galleries → Finale → Exit)

- [x] Replace monolithic environment with museum-grade topology:
  - Entrance vestibule (narrow/dark)
  - Spine corridor with continuous forward beacon
  - 3 side galleries with single rejoin back to spine
  - Finale (higher/brighter center)
  - Exit corridor (narrower/darker cooling)
- [x] Add **colliders** for floors and walls (Rapier)

Files:
- `components/museum/MuseumArchitecture.tsx`
- `components/museum/MuseumEnvironment.tsx`

## C) Lighting System (3 Layers, Quality-Scaled)

- [x] Orientation layer: very low ambient + hemi
- [x] Guiding layer: subtle spine rhythm lights
- [x] Attention layer: gallery focus lights + finale key light
- [x] Shadows only in high quality (single key light)

Files:
- `components/museum/MuseumLighting.tsx`
- `components/museum/MuseumScene.tsx`

## D) Wayfinding Without HUD

- [x] Floor guiding strip on spine
- [x] Door beacons at thresholds
- [x] Finale center beacon ring

Files:
- `components/museum/MuseumWayfinding.tsx`

## E) UX Rules & HUD Discipline

- [x] First-time onboarding overlay explains pointer lock (click) and release (Esc)
- [x] Inspect prompt appears only when:
  - pointer-locked
  - speed is low (paused)
  - short dwell time passes
- [x] Esc hierarchy enforced: Inspect → PointerLock → Menu

Files:
- `components/museum/MuseumUX.tsx`
- `components/museum/MuseumHUD.tsx`
- `components/museum/PlayerController.tsx`
- `store/museumStore.ts`

## F) Exhibit Placement Alignment

- [x] Reposition exhibit stands into the new galleries so they do not obstruct the spine.

Files:
- `data/museumExhibits.ts`

## G) Spec Contract

- [x] Add a pass/fail museum UX spec with test script + coordinate contract

Files:
- `MUSEUM_UX_SPEC.md`
