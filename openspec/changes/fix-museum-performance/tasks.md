# Implementation Tasks

## Status
Status: Active on 2026-01-28

Notes: PlayerController store updates and mobile render tuning are still pending.

- [x] 1. Modify `App.tsx` to conditionally render `Lattice3D` OR `MuseumScene` (Mutually Exclusive).
- [ ] 2. Refactor `PlayerController` to remove `setStore` from `useFrame`.
- [ ] 3. Add mobile specific prop injection (`dpr`, `shadows`) in `MuseumScene`.
