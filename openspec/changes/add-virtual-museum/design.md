# Technical Design: The Microtonality Museum

## Status
Status: Active on 2026-01-28

## Data Structures

### Exhibit Config (data-driven placement)
| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Stable exhibit identifier. |
| `type` | `'model' | 'text' | 'interactive' | 'audio'` | Exhibit behavior category. |
| `position` | `[number, number, number]` | World position (x,y,z). |
| `rotation` | `[number, number, number]` | Euler rotation (radians). |
| `assets.modelUrl` | `string` | Optional GLB/GLTF path. |
| `assets.audioUrl` | `string` | Optional positional audio path. |
| `content.title` | `string` | Display title. |
| `content.description` | `string` | Exhibit description text. |
| `lighting.intensity` | `number` | Optional spot intensity for the exhibit. |
| `lighting.castShadow` | `boolean` | Optional shadow toggle. |

### Avatar State
| Field | Type | Notes |
| --- | --- | --- |
| `modelUrl` | `string | null` | User-provided avatar model. |
| `viewMode` | `'first-person' | 'third-person'` | Camera mode. |
| `position` | `Vector3` | Current avatar position. |

## Scene Architecture (Layered)
- Scene root: `MuseumScene` owns the Canvas and renderer tuning.
- Physics layer: `Physics` wraps environment, exhibits, and the player controller.
- Interaction layer: `PlayerController` + `ExhibitStand` triggers + `MuseumHUD`.
- Visual layer: environment, lighting, post-processing (quality gated).
- UX layer: onboarding hints, HUD prompts, and menu state.

## Component Responsibilities
| Component | Responsibility | Notes |
| --- | --- | --- |
| `MuseumScene` | Canvas setup, renderer tuning, quality toggles | DPR/shadows derived from graphics settings. |
| `MuseumEnvironment` | Static geometry + colliders | Heavy meshes grouped by material. |
| `PlayerController` | Movement, pointer lock, camera sync | Updates avatar position state. |
| `ExhibitStand` | Exhibit rendering + positional audio | Uses `museumExhibits` config data. |
| `MuseumHUD` | Overlay prompts | Visibility gated by interaction state. |
| `MuseumUX` | Onboarding + menu state | Persistent hints with storage. |
| `MuseumLighting` | Scene lights | Quality-aware presets. |

## Open Items
- AvatarLoader implementation for user GLB/GLTF models.
- Third-person view toggle and camera offsets.
