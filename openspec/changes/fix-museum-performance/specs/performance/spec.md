# Museum Performance Specification

## ADDED Requirements

### Requirement: Exclusive Scene Rendering
- Scenario: When the user enters the Museum mode, the main `Lattice3D` scene SHALL be unmounted to free GPU context.

### Requirement: Physics Loop Optimization
- Scenario: The physics simulation loop SHALL NOT trigger React state updates (re-renders) more than 10 times per second (throttled) or SHALL rely entirely on Refs for visual updates.

## Microtonality Museum Requirements
- See [Microtonality Museum Requirements](../microtonality-museum/spec.md).
