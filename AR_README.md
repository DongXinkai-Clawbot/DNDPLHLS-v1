
# AR Lattice Projection Extension

This module provides an experimental Augmented Reality (AR) visualization of the harmonic lattice, allowing you to project musical geometry into real-world space using a smartphone camera.

## Setup & Requirements

- **Supported Browsers**: Chrome on Android (stable), Safari on iOS (via WebXR viewer app or modern polyfill), or browsers with WebXR support.
- **Hardware**: AR-capable mobile device (ARCore on Android, ARKit on iOS).
- **Permission**: The application will request Camera access when entering AR mode.

## Usage Guide

1. **Activate**: Open the Desktop or Mobile control menu and toggle **AR Mode**.
2. **Placement (Hit-test)**: Point your camera at a flat surface (floor or table). A cyan reticle appears when a plane is found.
3. **Anchor**: Tap the screen to place the lattice. Once placed, the lattice is locked to that real-world position.
4. **Fallback Placement (Manual)**:
   - If hit-test is unavailable, the app switches to manual placement automatically.
   - Drag to move the lattice, pinch to scale, rotate with two fingers, then press **Lock**.
5. **Interaction**:
   - Walk through the lattice nodes.
   - Use the **AR Controls** panel to adjust lattice/visual/audio settings (AR updates in real-time).
   - Audio functionality is preserved: selection and keyboard shortcuts trigger synthesis.
6. **Exit**: Click the red **EXIT AR** button. The XR session ends and camera resources are released.

## Implementation Details

- **Isolated Logic**: All AR-specific code is contained within `ARContainer.tsx`, `ARLattice.tsx`, and `components/overlays/ARControlPanel.tsx`.
- **Zero Regression**: Standard non-AR functionality is completely unaffected unless `isArActive` is set to true.
- **Lazy Loading**: WebXR dependencies are defined in the import map but only utilized within the `XR` component subtree.
- **Performance**: Uses `InstancedMesh` (reusing `NodeInstances`) for optimal mobile rendering.

## Uninstalling

To remove this feature entirely, delete:
- `components/ARContainer.tsx`
- `components/ARLattice.tsx`
- `AR_README.md`
And revert changes in `App.tsx`, `TopBar.tsx`, `index.html`, and `metadata.json`.
