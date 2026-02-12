# Exhibit Stand – Artifact A Enhancement Execution Checklist

Goal: upgrade the current Artifact A stand (ceramic/stone instrument-like object with plaque) with the remaining agreed details, without adding UI/gamey cues, without new lights, and with minimal perf impact.

Scope (must complete in next code change):
- Foot/contact detailing (pads + base seam) so the stand feels physically grounded
- Plaque refinement (border + bevel) while staying non-UI
- “Screw hint” micro-details (four fasteners) to read as service panel, not decoration
- Ceramic/stone material tuning (color/roughness ranges) to feel less “flat” and more like fired ceramic / basalt-like stone
- Provide measurable before/after evidence: code line deltas + screenshot set + short “what improved” list

Non-goals:
- No emissive guidance, blinking, breathe/pulse lighting, or HUD reliance
- No text labels, no “press E” prompts, no interaction changes beyond collider alignment if needed
- No heavy textures; prefer procedural/parameter-based material variation

---

## 0. Change Management & Baseline Capture (must be done before editing code)

### 0.1 Record file line counts (baseline)
Record line counts for:
- `mm/components/museum/ExhibitStand.tsx`
- `mm/components/museum/materials.ts`

Store the numbers in the PR description (or commit message) under a **Baseline** heading.

### 0.2 Capture 3 baseline screenshots (fixed viewpoints)
Using the same camera FOV and postprocessing as normal runtime:
1. **Mid distance**: a stand with its exhibit in context (shows silhouette + top cap read)
2. **Near**: close-up of the front face (shows plaque + any micro-detail)
3. **Ground contact**: low angle at base (shows contact shadow / seam / pads)

Name them (or log them) as:
- `stand_A_before_mid.png`
- `stand_A_before_near.png`
- `stand_A_before_base.png`

---

## 1. Geometry Enhancements (ExhibitStand.tsx)

### 1.1 Add foot pads (4x) – subtle, physically grounded
**Intent:** remove “box placed on floor” feel.

Implementation steps:
- Add 4 small pads under the base plinth corners.
- Each pad should be:
  - Height: 0.003–0.006m
  - Footprint: 0.05–0.09m square (or rounded)
  - Slightly inset from the base outer edge (2–4cm) so it looks plausible.
- Material: use an existing dark/neutral material (`shadowGap` or a new `artifactRubber` if absolutely needed). Avoid gloss.

Acceptance:
- From the base screenshot, pads read as contact/anti-vibration elements, not “lego studs”.
- No collision issues (pads are visual only; collider remains a single cuboid).

### 1.2 Add a base seam (contact seam) – thin shadow line around base
**Intent:** add manufacturing realism.

Implementation steps:
- Introduce a thin seam band or a slightly recessed strip around the base plinth perimeter:
  - Thickness: 0.008–0.015m
  - Height: 0.01–0.02m
  - Color: near-black, rough
- Prefer seam band slightly recessed inward rather than outward protrusion.

Acceptance:
- The seam is visible in near/mid shots only; it should not become a “navigation line”.

### 1.3 Plaque refinement: add border + bevel
**Intent:** make plaque read as a real plate, not a colored rectangle.

Implementation steps:
- Replace the current plaque mesh with two layers:
  1) **Plaque backing** (slightly larger), subtle bevel/rounded edge
  2) **Inset plate** (slightly smaller and recessed by 1–2mm)
- Dimensions (relative to main body face):
  - Width: 0.45–0.60 of body width
  - Height: 0.12–0.18 of body height
  - Thickness: 0.004–0.01m
- Keep it centered or slightly lower-than-center (museum furniture convention).

Acceptance:
- At close range, the border/bevel catches a tiny highlight and reads as metal platework.
- No text, no emissive.

### 1.4 “Screw hint” micro-details (4 fasteners)
**Intent:** suggest service panel without making it “sci-fi”.

Implementation steps:
- Add 4 small fasteners at plaque corners (or panel corners), either:
  - Tiny cylinders (radius 0.003–0.005m, height 0.001–0.002m)
  - Or tiny recessed dots (preferred if you want maximum subtlety).
- Material: same as plaque or slightly darker; must not sparkle.

Acceptance:
- Screws are barely noticeable at mid distance, visible only in close-up.
- Screws do not look like “buttons”.

---

## 2. Material Tuning (materials.ts + ExhibitStand.tsx)

### 2.1 Ceramic/stone palette tuning
**Intent:** “ceramic/stone” should look fired/mineral, not flat UI color.

Implementation steps:
- Adjust `artifactCeramic`:
  - Roughness target: 0.88–0.96 (very matte)
  - Metalness: 0.0
  - Color range: low-saturation cool/warm greys (avoid pure blue or pure black)
  - Add subtle deterministic variation (already supported by `seed` jitter); keep variation within ±3–5% brightness.
- Ensure top cap / trims do NOT become glossy; keep highlight width broad and soft.

Acceptance:
- In mid shot, the body reads as matte ceramic/stone with gentle variation, not a uniform flat fill.

### 2.2 Plaque material tuning
**Intent:** plaque reads as brushed/aged metal, but remains quiet.

Implementation steps:
- Adjust `artifactPlaque`:
  - Roughness target: 0.35–0.55
  - Metalness: 0.55–0.80
  - Color: slightly warm grey; avoid high chroma gold/brass.
- Keep specular under control; no “shiny badge”.

Acceptance:
- Plaque catches a restrained highlight only at certain angles.

---

## 3. Physics/Interaction Safety (ExhibitStand.tsx)

### 3.1 Collider integrity
- Keep **one** `CuboidCollider` for the whole stand.
- Verify the collider still covers the new maximum extents (pads/seam should be excluded visually).

Acceptance:
- Player movement does not snag on the stand.
- Sensor triggers at the same distance as before (or better aligned).

---

## 4. Evidence & Reporting (required output after implementation)

### 4.1 Line delta reporting (must include totals)
Provide per-file and total line deltas:
- Added lines
- Removed lines
- Net change

Files to report:
- `ExhibitStand.tsx`
- `materials.ts`

### 4.2 After screenshots (same viewpoints as baseline)
Produce:
- `stand_A_after_mid.png`
- `stand_A_after_near.png`
- `stand_A_after_base.png`

### 4.3 “What improved” (must be specific and observable)
At minimum:
- Grounding realism improved (pads + seam)
- Plaque reads as real platework (border + bevel)
- Service panel believability improved (screw hints)
- Ceramic/stone feels less flat (palette + roughness + controlled variation)
- No new UI/game cues introduced (confirm: no emissive, no blinking, no HUD reliance)

---

## 5. Definition of Done (all must be true)
- All steps in sections 1–4 completed
- Screenshots before/after captured from same viewpoints
- Line deltas reported
- Visual result remains “museum object”, not “NPC” and not “game beacon”


## Guardrail: P0 regression audit

Run this before/after changes to keep P0 constraints intact:

- `pnpm museum:p0-audit`
