# Facade Split Template (Step-by-Step)

Use this template for every split task.

1) Identify the stable export surface in `docs/refactor/APISURFACE.md`.
2) Create the new internal module directory (if not already present).
3) Move code into internal modules without changing logic or APIs.
4) Update the legacy file to re-export the same symbols.
   - Keep names, parameters, and semantics identical.
5) Ensure no external imports reference the new internal directory.
6) Run gates:
   - `npm ci`
   - `npm run verify`
   - `npm run ui:check:shots`
   - `npm run depcheck` (if enabled)

Rollback:
- revert the commit if any gate fails
