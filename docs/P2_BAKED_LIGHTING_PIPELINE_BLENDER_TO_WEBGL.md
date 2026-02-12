# P2 Baked Lighting Pipeline — Blender → WebGL (three.js)

This document is the **final execution checklist** for producing baked AO/GI assets in Blender and integrating them into the project.
**Rule:** Follow this checklist in order. Do not change runtime lighting to “fake” the result.

---

## Scope

### What we bake (static only)
- **AO**: contact + corners (weight, solidity)
- **GI / lightmaps**: soft gradients + bounce color (air + realism)

### What we do NOT bake
- Dynamic exhibits
- Player, HUD, interactions
- Any animated lighting

### Where these maps are used in code
- `mm/components/museum/MuseumArchitecture.tsx`
  - loads `/public/lightmaps/*.png`
  - attaches `lightMap` to wall/floor materials on **medium/high** tiers
  - ensures `uv2` exists by copying `uv` → `uv2` during merges

---

## Batch Plan (P2)

**Batch 0 — Asset Contract + Baseline (Docs-only)**
- Freeze naming, folder structure, texel density, and bake outputs.
- Define acceptance screenshots.

**Batch 1 — UV2 Unwrap for Static Architecture**
- Ensure all static architecture has a valid UV2 set (non-overlapping, padded).

**Batch 2 — Bake AO**
- Produce AO maps first (fast to iterate, huge realism gain).

**Batch 3 — Bake GI / Lightmaps**
- Produce lightmaps (Cycles bake) and validate gradients.

**Batch 4 — Integrate + Validate in WebGL**
- Replace placeholders, verify color space and flipY, compare screenshots.

**Batch 5 — Optimize (Optional)**
- Consider KTX2 compression after the look is correct.

Each batch requires: changed file list, line delta, before/after screenshots, and observed improvements.

Commands (P2 Batch 0+):
- `pnpm museum:p2-uv2-audit`
- `pnpm museum:p2-bake-baseline`
- `pnpm museum:p2-bake-audit`

---

## Batch 0 — Asset Contract + Baseline (Docs-only)

### 0.1 Folder structure (must match)
In repo:
- `mm/public/lightmaps/`
  - `wall_lm.png`
  - `floor_lm.png`
  - `finale_lm.png`
  - (optional) `wall_ao.png`, `floor_ao.png`, etc.

### 0.2 Naming convention (strict)
- Lightmaps: `<group>_lm.png`
- AO maps: `<group>_ao.png`
Where `<group>` is one of:
- `wall`, `floor`, `finale`, `portal`, `bench` (only if baked separately)

### 0.3 Texel density target
- Spine walls/floor: **256–512 px per 10m** (start conservative)
- Finale interior: **512–1024 px per 10m** (hero zone)
- Door portals: **higher density if baked separately**

### 0.4 Baseline screenshots (fixed)
Capture (same camera poses as P1):
1) Entrance down spine
2) Door threshold close
3) Wall–floor corner
4) ExhibitStand contact
5) Finale wall gradient

Acceptance for P2 is measured against these shots.

---

## Batch 1 — UV2 Unwrap (Static Architecture)

### 1.1 Export strategy
You need a static mesh representation of:
- spine walls/floor
- finale shell
- portals / trims (optional)

**Recommended:** export from code as a simplified static mesh, OR recreate key pieces in Blender using the same dimensions.

### 1.2 UV rules (UV2)

UV2 contract (must hold):
- No overlaps
- Sufficient padding for mipmaps
- Consistent scale within a group
- UV2 must be present at runtime (code ensures uv→uv2 for merged boxes; custom meshes must provide uv2)

- UV2 must be:
  - **non-overlapping**
  - **padded** (margin)
  - consistent scale per group
- Avoid extremely thin islands for trims unless you bake them separately.

### 1.3 Blender checklist (UV2)
- Apply transforms (Ctrl+A → All Transforms)
- Mark seams only where needed
- UV Unwrap into UVMap.001 (or a named “LightmapUV”)
- Pack islands with margin:
  - start: **0.02–0.04** (depends on resolution)

**Acceptance:** UV2 has no overlaps; island padding is visible.

---

## Batch 2 — Bake AO (fast iteration)

### 2.1 Bake engine
- **Cycles** (recommended)
- Use **GPU** if available

### 2.2 AO bake settings
- Render Properties → Bake:
  - Bake Type: **Ambient Occlusion**
  - Margin: **8–16 px** (based on output res)
  - Clear Image: on
- AO distance:
  - Start: **0.6–1.2 m** (museum scale)
  - Too small → only tight corners darken
  - Too big → space gets “dirty”

### 2.3 Output
- Format: **PNG** (ok) or **EXR** (best for linear precision)
- Color space: **Non-Color** (data)
- Bit depth: **16-bit** preferred (AO banding prevention)

### 2.4 Validate in Blender
- Apply AO in a test material (multiply) and check:
  - floor–wall corner has contact darkening
  - bench legs contact reads grounded
  - no “black tape” edges

**Acceptance:** AO improves weight without crushing midtones.

---

## Batch 3 — Bake GI / Lightmaps (soft gradients)

### Color management (Blender)
- Use Filmic view transform for look-dev, but bake outputs should be treated as **linear data** for the engine.
- Prefer EXR for grading headroom; if exporting PNG, use 16-bit and avoid gamma baking.


### 3.1 GI bake type
- Cycles Bake Type: **Diffuse**
  - Influence: **Color + Indirect**
  - (Disable Direct if you want runtime lights to remain the “direct” cue)
- Alternative: **Combined** for full lighting (use cautiously)

### 3.2 Scene setup
- Use physically plausible lights in Blender:
  - large area lights for ceiling fixtures
  - warm/cool balance consistent with museum mood
- Use neutral albedo for walls/floor to avoid extreme color casts.

### 3.3 Output
- Format: **EXR** recommended (linear, no banding)
- If PNG:
  - 16-bit
  - ensure it’s treated as linear in engine

### 3.4 Validate gradients
- Check for:
  - smooth wall gradients (no blocky bands)
  - realistic corner falloff
  - no harsh “spot cones” burned into the lightmap

**Acceptance:** gradients feel like real bounced light, not spotlight decals.

---

## Batch 4 — Integrate in WebGL (three.js)

### 4.1 Replace placeholders
Overwrite:
- `/public/lightmaps/wall_lm.png`
- `/public/lightmaps/floor_lm.png`
- `/public/lightmaps/finale_lm.png`

### 4.2 Color space + orientation
- Lightmaps must be sampled as **linear data**
- flipY:
  - In code we set `flipY = false` for lightmaps
- If results look inverted/rotated:
  - your UV2 or export orientation is inconsistent

### 4.3 Intensity tuning (keep conservative)

Group intensity guideline (start points):
- wall: 0.80
- floor: 0.75
- finale: 0.90
(Adjust only after validating the 5 baseline screenshots.)
- Start lightMapIntensity:
  - **0.65–0.95**
- Goal:
  - add air + gradients
  - do not wash out direct lighting hierarchy

### 4.4 Verification pass

Before judging visuals, print texture dimensions:
- `pnpm museum:p2-texture-report`

- Compare 5 baseline screenshots:
  - corners have weight (AO)
  - walls show soft gradients (GI)
  - no new “gamey” fill lights added

**Acceptance:** realism improves without adding dynamic lights.

---

## Batch 5 — Optimize (Optional)

### 5.1 Compression
- Convert EXR/PNG to KTX2 for web delivery after look lock.
- Keep linear sampling and avoid gamma errors.

### 5.2 Mipmaps
- Enable mipmaps for lightmaps to avoid shimmer at distance.
- Ensure padding/margin is sufficient to prevent bleeding.

---

## Troubleshooting

### Lightmap looks too bright / flat
- Reduce `lightMapIntensity`
- Re-bake with less indirect intensity
- Ensure you are not sampling as sRGB

### Seams / bleeding
- Increase bake margin
- Increase UV island padding
- Increase resolution or separate groups

### Banding in gradients
- Use EXR or 16-bit PNG
- Avoid overly compressed textures

---

## Reporting Template (required per batch)

For each P2 batch:
1) Changed docs/files list
2) Line delta (added/removed/net)
3) 5 baseline screenshots (before/after)
4) Improvements observed (weight, gradients, material realism)
5) Performance note (medium tier)
