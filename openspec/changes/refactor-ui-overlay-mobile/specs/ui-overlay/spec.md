## ADDED Requirements
### Requirement: Device-aware overlay selection
The system SHALL detect mobile devices and render a mobile overlay when appropriate.

#### Scenario: Mobile device detected
- **WHEN** the viewport width is below the mobile threshold or Capacitor reports a mobile platform
- **THEN** the mobile overlay is rendered instead of the desktop overlay

#### Scenario: Desktop device detected
- **WHEN** the viewport width is at or above the mobile threshold and Capacitor does not report a mobile platform
- **THEN** the desktop overlay is rendered

### Requirement: Headless overlay logic
The system SHALL expose overlay business logic via reusable hooks to support multiple UIs.

#### Scenario: Keyboard, MIDI, and audio logic extracted
- **WHEN** overlays are rendered
- **THEN** they invoke shared hooks for keyboard, MIDI, and audio behavior

### Requirement: Mobile overlay UI
The system SHALL provide a mobile overlay that uses touch-first navigation and drawers.

#### Scenario: Mobile navigation usage
- **WHEN** a user taps a navigation item on mobile
- **THEN** the corresponding panel opens in a bottom drawer
