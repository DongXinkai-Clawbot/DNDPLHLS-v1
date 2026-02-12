## Context
The current overlay mixes UI presentation with global logic and is optimized for desktop floating windows, which fails on mobile.

## Status
Status: Done on 2026-01-28

## Goals / Non-Goals
- Goals: Separate logic from view, add a mobile overlay without breaking desktop UI, keep Zustand as shared state.
- Non-Goals: Redesign core audio/MIDI logic or change the 3D rendering pipeline.

## Decisions
- Decision: Create headless hooks for keyboard, MIDI, and audio to share across overlays.
- Decision: Use device detection (width + Capacitor when available) to select overlay at runtime.
- Decision: Keep desktop layout intact while introducing mobile-specific components.

## Risks / Trade-offs
- Risk: Mobile and desktop behavior drift if logic is duplicated -> Mitigation: centralize logic in hooks.
- Risk: Device detection false positives -> Mitigation: combine width check with Capacitor platform.

## Migration Plan
- Introduce hooks and mobile components behind device detection, keeping desktop as default.
- Switch App entry to conditional rendering once both overlays are wired.

## Open Questions
- Should any desktop-only keyboard shortcuts be disabled on tablets in landscape?
