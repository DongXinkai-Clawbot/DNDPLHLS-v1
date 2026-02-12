# P1 Visual Realism Execution Checklist (Batch Plan)

This checklist operationalizes the visual/physical realism improvements identified in the technical analysis.
**Rule:** apply changes in batches. Before *any* code change, update docs + capture baselines.

---

## P1 Scope Overview

### Goals
- Reduce “gamey” rendering cues while keeping WebGL performance predictable.
- Increase architectural credibility (edge highlight, material micro-variation, grounded contact).
- Keep P0 constraints intact (no HUD navigation, no pulsing guide lights).

### Non-goals
- No real-time ray tracing.
- No heavy post stacks on low/medium tiers.
- No “reward” visuals (no flashing, no progress UI).

---

## Batch Index (in order)

**Batch 0 — Baseline + Guardrails (Docs-only)**
- Capture baselines, define budgets, add regression checks.

**Batch 1 — Edge Realism: Bevel Strategy (P1)**
- Replace sharp Box-only edges in key read surfaces with bevelled geometry or rounded primitives.

**Batch 2 — Contact & Weight: AO Strategy (P1/P2)**
- Choose one of: (A) baked AO into lightmap / vertex AO, (B) very-light SSAO for high tier only, (C) AO decals.
- Must not introduce shimmer or heavy blur.

**Batch 3 — Material Micro-Detail (P2)**
- Add tiling detail normal + roughness modulation on walls/floor/trim (lightweight, optional per quality tier).

**Batch 4 — Static Lighting: Lightmap Baking (P2)**
- Bake GI/AO for static architecture, apply as lightmap (or multiply) without runtime cost spikes.

**Batch 5 — Decal System Upgrade (P3)**
- Convert “shadowGap” and fine inlays to robust decals (polygonOffset, depthWrite discipline) to avoid z-fighting.

Each batch requires: (1) doc update, (2) code change, (3) line-count report, (4) before/after screenshots, (5) measurable improvements.

---

## Batch 0 — Baseline + Guardrails (Docs-only)

### 0.1 Baseline capture (must-do)
- Record line counts for target files:
  - `mm/components/museum/MuseumScene.tsx`
  - `mm/components/museum/MuseumArchitecture.tsx`
  - `mm/components/museum/MuseumLighting.tsx`
  - `mm/components/museum/MuseumWayfinding.tsx`
  - `mm/components/museum/materials.ts`
- Capture 5 reference screenshots (fixed camera positions):
  1. Entrance looking down spine
  2. A gallery door threshold (close)
  3. Wall–floor corner (AO/contact)
  4. ExhibitStand on floor (contact shadow)
  5. Finale interior wall planes (gradient)
- Run `pnpm museum:p0-audit` and record PASS.

### 0.2 Render budgets (write down as constants in docs)
- Active dynamic lights target (medium tier): <= 10 total visible contributions.
- Shadow policy:
  - High tier: limited shadow-casters (directional + 1–2 key spots) only.
  - Medium/Low: no dynamic shadows; rely on baked/AO/decals.
- Post policy:
  - Medium/Low: none.
  - High: optional lightweight SSAO only if stable (no shimmer).

### 0.3 Add a new audit (P1 visual)

- Commands:
  - `pnpm museum:p1-baseline`
  - `pnpm museum:p1-visual-audit`

- Add `museum:p1-visual-audit` script to check:
  - `physicallyCorrectLights` not accidentally toggled per tier without docs update
  - no reintroduction of transparent emissive wayfinding
  - no excessive dynamic shadow casters on medium/low

**Acceptance:** Batch 0 is complete when baselines exist, `pnpm museum:p1-baseline` has been run, and P0 audit still passes.

---

## Batch 1 — Edge Realism: Bevel Strategy (P1)

### 1.1 Choose bevel approach (must choose one per object family)
- **Option A (Preferred):** Replace key BoxGeometry pieces with `RoundedBox` (drei) where feasible.
- **Option B:** Use `ExtrudeGeometry` with `bevelEnabled: true` for trims/frames.
- **Option C:** Fake bevel via “bevel strip” geometry only for hero edges (last resort).

### 1.2 Target surfaces (strict scope)
Apply bevel to:
- Door frames / thresholds in primary view corridors
- Bench edges (seat + top rail)
- Exhibit stands (already improved; ensure consistency)
Do NOT bevel:
- Hidden structural solids
- Large wall blocks (performance)

### 1.3 Parameters (default)
- Radius: 0.02–0.06 meters (depending on object scale)
- Segments: 2–4 (keep low)
- Keep UV-less geometry: no custom unwrap required

### 1.4 Verification
- Edge highlights appear under existing lighting without adding new lights.
- No visible “faceting” or banding at camera distances.

**Acceptance:** Before/after shows increased edge readability and perceived “finish quality”.

---

## Batch 2 — Contact & Weight: AO Strategy (P1/P2)

### 2.1 Pick ONE AO implementation (do not stack)
- **A. Baked AO** into lightmaps or a secondary AO texture (preferred).
- **B. Vertex AO** (cheap) for static meshes.
- **C. High-tier SSAO** only (must be stable, no shimmer).

### 2.2 Requirements
- Must strengthen:
  - floor–wall corner
  - stand–floor contact
  - bench legs contact
- Must not:
  - add blur haze
  - create temporal shimmer on movement

### 2.3 Implementation notes
- If SSAO is used:
  - High tier only
  - conservative radius
  - clamp intensity
  - ensure depth precision

**Acceptance:** Contact points read grounded in 3 reference views.

---

## Batch 3 — Material Micro-Detail (P2)

Implementation note (P1):
- We implement a lightweight, texture-free micro-detail shader path first (procedural), gated by quality tier.
- High: roughness variation + subtle normal perturb (micro-bump)
- Medium: roughness variation only
- Low: disabled (fallback to current flat materials)


### 3.1 Detail maps
- Add one tiling detail normal map for:
  - wall plaster
  - stone/ceramic trim
  - floor concrete
- Add subtle roughness variation (either texture or procedural noise in shader)

### 3.2 Quality tiers
- High: normal + roughness
- Medium: normal only or roughness only (choose one)
- Low: none (fallback to current)

### 3.3 Guardrails
- No visible repetitive pattern at 2–6m viewing distance:
  - use low-contrast detail
  - scale appropriately

**Acceptance:** Surfaces stop reading as “perfect plastic planes” under grazing light.

---

## Batch 4 — Static Lighting: Lightmap Baking (P2)

Public placeholder path:
- `/public/lightmaps/*.png` (currently 1x1 placeholders; replace with baked outputs)

Integration (already scaffolded in code):
- `MuseumArchitecture.tsx` loads lightmaps and attaches `lightMap` on wall/floor materials for medium/high tiers.
- `mergeBoxGeometries` ensures `uv2` exists by copying `uv` → `uv2`.


### 4.1 Baking plan
- Identify static mesh groups:
  - spine walls/floor
  - finale shell
  - door frames
- Export to DCC (Blender) for bake OR use an in-engine bake pipeline (if available).

### 4.2 Outputs
- Lightmap (GI)
- AO (optional separate)
- Use atlas + consistent texel density

### 4.3 Runtime integration
- Apply as:
  - `lightMap` + `lightMapIntensity` (three.js)
  - or multiply in shader (if no lightMap path)
- Disable dynamic shadows on medium/low once baked.

**Acceptance:** Wall gradients become smoother; corners gain natural darkness without extra fill lights.

---

## Batch 5 — Decal System Upgrade (P3)

### 5.1 Replace “shadowGap as solid black strip”
Convert to decals for:
- shadow gaps
- hairline seams
- fine inlays

### 5.2 Technical requirements
- Use polygonOffset
- `depthWrite: false` for decals
- stable draw order

### 5.3 Performance
- Decals are instanced where possible
- No alpha-sorting piles

**Acceptance:** No z-fighting flicker on seams; close-up reads as recess, not tape.

---

## Reporting Template (required every batch)

For each batch, provide:

1. Changed files list
2. Total line delta (added/removed/net)
3. Before/after screenshots (the 5 reference views)
4. Improvements (must be observable), mapped to:
   - edge realism
   - contact weight
   - material richness
   - lighting gradients
5. Performance note (qualitative): any obvious FPS regression on medium tier?
