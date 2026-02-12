# Refactor Contract

This document captures external behavior that must stay stable during refactors.

## UI Contract (Do Not Change)
- Landing, Lattice, Museum, AR, Setup, Settings, Overlays, Ear Training, Library, Timbre all remain reachable.
- Control labels, tab order, and default toggle states remain unchanged.
- Identical action sequences produce identical visible outcomes (labels, colors, overlays, focus).

## Store Contract (Do Not Change)
- Settings fields, meaning, and persistence format remain stable.
- Undo/redo, session restore, and transient overlays preserve current reset behavior.
- Actions with identical inputs produce identical state changes.

## Engine Contract (Do Not Change)
- Audio unlock/play/stop/record flows behave as before.
- MIDI permissions, connect/disconnect, and retune behavior remain consistent.
- AR start/stop lifecycle and permission fallback remain consistent.
