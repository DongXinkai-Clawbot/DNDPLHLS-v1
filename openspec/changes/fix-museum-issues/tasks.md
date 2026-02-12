# Implementation Tasks

## Status
Status: Done on 2026-01-11

## 1. Build/runtime correctness
- [x] Remove duplicate `requestTeleport` declaration in `MuseumHUD.tsx`.
- [x] Apply renderer sync updates for brightness and quality changes at runtime.

## 2. Performance optimization
- [x] Remove heavy post-processing (SSAO) and reduce bloom/particle load.
- [x] Remove grid spotlights; keep focused lighting only.
- [x] Limit shadow casting to intentional props; architecture receives only.
- [x] Instance repeated wayfinding geometry and decals.

## 3. UI visibility + onboarding
- [x] Ensure `MuseumHUD` renders above the Canvas.
- [x] Persist pointer-lock onboarding hint (one-time).

## 4. Interaction logic
- [x] Harden exhibit collision checks for player detection.
