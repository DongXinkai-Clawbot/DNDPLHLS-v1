# Implementation Tasks

## Status
Status: Active on 2026-01-28

Notes: Avatar loading and third-person view are still pending.

## 1. Setup & Infrastructure
- [x] Install dependencies: `@react-three/rapier`, `@react-three/postprocessing`, `leva`, `zustand`.
- [x] Create `store/museumStore.ts` for avatar state and interaction logic.
- [x] Create feature flag or route `/museum` in `App.tsx`.

## 2. Environment & Realism
- [x] Build `components/museum/MuseumScene.tsx` setting up the Canvas, Physics, and EffectComposer.
- [x] Build `components/museum/MuseumEnvironment.tsx` with high-quality PBR textures (Floor, Walls) and baked lighting.

## 3. Physics & Avatar
- [x] Build `components/museum/PlayerController.tsx` using `RigidBody` (Capsule) and `useKeyboardControls`.
- [ ] Build `components/museum/AvatarLoader.tsx` to handle `.glb` loading and animation mixing.
- [ ] Implement First/Third person camera switching logic.

## 4. Exhibit System
- [x] Create `data/museumExhibits.ts` config file.
- [x] Build `components/museum/ExhibitStand.tsx` with `PositionalAudio` and `CuboidTrigger` (Proximity).
- [x] Implement `MuseumHUD.tsx` (Overlay) for "Press E to Interact" prompts.
