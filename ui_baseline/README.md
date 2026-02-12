This folder freezes the UI via Playwright visual regression baselines.

- shots/: screenshot baselines for desktop + mobile.
- dist.sha256: legacy build fingerprint (not used by ui:check).

Commands:
- npm run ui:baseline:shots  # generate or update screenshot baselines
- npm run ui:check:shots     # compare screenshots against the baseline
- npm run ui:check           # alias for ui:check:shots
- npm run ui:baseline        # legacy dist fingerprint update
