# Design: Museum Issue Fixes

## Status
Status: Done on 2026-01-11

## Design Summary
- Runtime renderer sync is handled by `RendererTuner` so brightness/quality changes apply immediately.
- Performance-heavy geometry is grouped/instanced, and shadow casting is limited to intentional props.
- HUD and onboarding prompts are layered above the Canvas and gated by interaction state.

## Key Components
- `components/museum/MuseumScene.tsx` (renderer tuning + quality gates)
- `components/museum/RendererTuner.tsx` (runtime sync)
- `components/museum/MuseumHUD.tsx` (HUD layering)
- `components/museum/MuseumArchitecture.tsx` / `MuseumWayfinding.tsx` (instancing + shadow policy)
- `components/museum/MuseumUX.tsx` (onboarding rules)
