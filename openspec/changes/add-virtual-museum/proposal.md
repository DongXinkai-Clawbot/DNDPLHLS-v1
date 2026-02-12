# Proposal: The Microtonality Museum

## Status
Status: Active on 2026-01-28

Notes: Core museum scaffolding exists, but avatar loading and third-person view remain unimplemented.

## Why
To provide an immersive, narrative-driven educational layer that contextualizes the abstract math of microtonality in a realistic physical space. The user needs to "walk" through history and theory.

## What
-   **Extreme Realism:** A high-fidelity 3D gallery environment using PBR materials, Baked Lighting, and Post-Processing (Bloom, SSAO).
-   **Avatar System:** A physics-based character controller (Capsule) that supports loading custom User Avatars (.glb/.vrm) and toggling between 1st/3rd person views.
-   **Spatial Audio:** Exhibits play microtonal examples that get louder as you physically approach them.
-   **Configurable Exhibits:** A data-driven system to place interactive 3D models and text boards without hard-coding.

## Tech Stack
-   **Core:** React Three Fiber, Drei, Zustand.
-   **Physics:** `@react-three/rapier` (for collision and character movement).
-   **Visuals:** `@react-three/postprocessing` (for high-end graphics).
-   **Audio:** Web Audio API via R3F PositionalAudio.
