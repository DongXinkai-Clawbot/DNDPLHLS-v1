# Critical Fixes (Mobile Overlay Refactor)

## Status
Status: Done on 2026-01-28

## Verified Fixes
- Mobile/desktop overlays are selected by a single device-detection source.
- Overlay business logic is centralized in shared hooks to prevent divergence.
- Mobile overlay uses touch-first navigation without breaking desktop parity.
- Desktop overlay layout remains unchanged while sharing state with mobile.
- Entry routing ensures only one overlay stack is mounted at a time.

## Guardrails
- Keep device detection in one place (hook + capabilities).
- Avoid duplicating overlay business logic in mobile-only components.
- Validate mobile drawer safe-area padding and scroll locking after UI changes.
