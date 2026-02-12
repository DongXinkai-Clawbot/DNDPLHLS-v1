# Lighting Calibration & Standards

> **Objective**: Ensure the museum environment maintains a consistent, high-quality visual standard across different displays and quality settings, preventing "white wall washout" and ensuring readability.

## 1. Core Calibration Values (ACES Filmic)

We use **ACES Filmic Tone Mapping**. This curve compresses highlights aggressively. To avoid flat, washed-out walls, we must strictly control exposure and albedo.

### 1.1 Exposure Baselines (MuseumScene.tsx)

These values are calibrated to keep a standard 18% grey card reading as "grey" and prevent light walls from hitting the highlight compression shoulder too early.

- **Low Quality**: `1.15` (Safe baseline for simple lighting)
- **Medium Quality**: `1.25` (Standard balanced baseline)
- **High Quality**: `1.35` (Slightly higher to account for richer shadow contrast)

**Rule**: Do NOT exceed `1.4` base exposure without extensive testing. Values near `1.8 - 2.0` are strictly prohibited as they destroy highlight detail.

### 1.2 Brightness Adjustment (User Preference)

The user `brightness` setting (0.5 - 1.5) must **NOT** be a multiplier.
It is an **Offset** to the exposure value (EV).

- Formula: `Exposure = BaseExposure + (Brightness - 1.0) * 0.6`
- Range: Approx ±0.3 EV.
- **Why**: Multipliers cause exponential blowouts. Offsets are linear and controllable.

## 2. Material Standards (materials.ts)

### 2.1 Albedo Limits

To prevent energy conservation violations and washout:

- **Max Wall Albedo**: Hex `#d6d1c8` (approx 0.7 linear). NEVER use white (`#ffffff`) or near-white (`#eeeeee`) for large surfaces.
- **MicroDetail**: Must be enabled for: `wallPlaster`, `wallAccent`, `floorSpine`, `floorGallery`, `floorFinale`.
- **Edge Darkening**: A shader-based fake AO (4-5% darkening) is required on edges to ground the geometry.

## 3. Lighting Limits (MuseumLighting.tsx)

### 3.1 Ambient / Hemi

These lights are for "safety visibility" only, not for illumination.

- **Ambient**: Max `0.65`
- **Hemi**: Max `1.05`

### 3.2 Key Lights & Spots

- **Finale Key**: Max `7.5`. Use falloff and distance to shape it, not global intensity.
- **Door Slots**: Max `0.3`. High intensity here washes out the adjacent wall immediately.

## 4. Verification & Testing

### 4.1 "Luma Overlimit" Debug View

Enable by appending `?debugLuma=1` to the URL.
- **Visual**: Magenta pixels indicate Luma > 0.9.
- **Pass Criteria**:
    - **Spine Walls**: < 1% Magenta pixels.
    - **Finale Walls**: < 5% Magenta pixels (excluding the light source itself).
    - **Door Frames**: Zero washout.

### 4.2 Standard Test Angles

When tuning, verify these 4 camera angles:
1.  **Vestibule Entrance**: Looking straight at the first wall.
2.  **Spine Mid-point**: Looking at the side wall (checking for flat shading).
3.  **Gallery Threshold**: Looking at the door frame/shadow gap detail.
4.  **Finale Center**: Looking outwards at the curved walls (highest risk of washout).

## 5. Forbidden Actions

- ❌ **Do NOT** upload 1x1 white textures as placeholders for Lightmaps/AO. (The code now auto-rejects them).
- ❌ **Do NOT** set Exposure > 1.5.
- ❌ **Do NOT** revert brightness to a multiplier.
- ❌ **Do NOT** disable `microDetail` on walls.
