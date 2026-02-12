# Change: Refactor UI overlay for mobile/desktop separation

## Status
Status: Done on 2026-01-28

## Why
The current UI overlay mixes logic with desktop-centric presentation, making mobile UX unusable and slowing future iteration.

## What Changes
- Introduce device detection to select mobile vs desktop overlays
- Extract overlay business logic into reusable headless hooks
- Add mobile-specific UI components and overlay container
- Keep existing desktop overlay layout intact

## Impact
- Affected specs: ui-overlay
- Affected code: UI overlay components, app entry, hooks
