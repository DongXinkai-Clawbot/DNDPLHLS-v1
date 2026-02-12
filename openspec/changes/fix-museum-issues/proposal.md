# Proposal: Fix Museum Issues (Performance + UX)

## Status
Status: Done on 2026-01-11

## Why
The museum experience suffered from performance regressions, UI layering issues, and unreliable interactions that made the mode unstable on real devices.

## What
- Remove performance bottlenecks (overdraw, excessive lights, heavy post-processing).
- Fix HUD layering and runtime renderer sync issues.
- Harden interaction triggers and onboarding UX.

## Impact
Stabilizes the museum mode on mobile/low-end devices and reduces visual/interaction regressions.

## References
- `spec.md` (source requirements and detailed completion notes)
