# Design: Fix Museum Performance

## Status
Status: Active on 2026-01-28

## Design Summary
- Run only one heavy scene at a time (lattice vs museum) to reduce GPU load.
- Decouple player movement updates from per-frame store writes where possible.
- Apply mobile-leaning renderer defaults (DPR/shadows) through quality presets.

## Open Items
- Remove remaining store writes in `PlayerController` frame loop.
- Confirm mobile-specific quality defaults for museum rendering.
