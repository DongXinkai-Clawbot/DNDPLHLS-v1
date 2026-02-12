# Refactor Task Checklist (Agent Runbook)

Goal: provide a safe, gated path to split large files without introducing new
errors or UI drift. Each task below includes dependencies, allowed change
boundaries, required commands, acceptance criteria, failure criteria, and
rollback. Execute tasks in order unless a dependency is already satisfied.

Current repo status (verify before starting):
- UI gate is Playwright screenshots: `npm run ui:check:shots`.
- Legacy dist fingerprint exists but is not the hard gate: `npm run ui:check:dist`.
- `npm run verify` already runs UI screenshots as the final step.

Global rules (apply to all tasks):
- Change boundary levels:
  - L0: docs/scripts/config only, no runtime code (`components/`, `engine/`, `store/`, `utils/`).
  - L1: tests, lint rules, types, tooling; no runtime behavior changes.
  - L2: runtime code allowed, API surface must remain stable.
- Required commands:
  - `npm ci`
  - `npm run verify`
  - `npm run ui:check:shots` (if UI screenshots enabled; otherwise `npm run ui:check:dist`)
- Failure criteria:
  - any required command exit code != 0
  - UI check fails
  - new circular dependency (after depcheck is enabled)
  - touched forbidden paths: `dist/`, `android/**/build/`, `node_modules/`
- Rollback:
  - one task per commit; revert the commit on failure
  - if no git available, revert by restoring the previous file versions

Task list (with dependencies)

Task A0: Identify large file targets
- Depends on: none
- Boundary: L0
- Allowed paths: `docs/refactor/TARGETS.md`
- Commands:
  - `rg --files -g '*.ts' -g '*.tsx' | % { $_ } | % { (Get-Content $_).Length, $_ } | sort -Descending | Select-Object -First 30`
  - If git is available: `git ls-files '*.ts' '*.tsx' | xargs wc -l | sort -nr | head -n 30`
- Deliverable: `docs/refactor/TARGETS.md` listing top 10-15 files with:
  - path, line count, domain, split risk (low/med/high)
- Acceptance: file exists and list is reproducible
- Failure: list is missing or not reproducible
- Rollback: delete `docs/refactor/TARGETS.md`

Task A1: Document API surface for each target file
- Depends on: A0
- Boundary: L0
- Allowed paths: `docs/refactor/APISURFACE.md`
- Commands:
  - `rg '^export ' <file>`
  - `rg 'export (type|interface|const|function|class)' <file>`
- Deliverable: `docs/refactor/APISURFACE.md` with:
  - stable export list (must not change)
  - allowed internal changes
  - forbidden changes (names, parameters, return semantics)
- Acceptance: each target file has an export list entry
- Failure: missing export list for any target
- Rollback: delete `docs/refactor/APISURFACE.md`

Task A2a: Facade rules and placeholder dirs
- Depends on: A1
- Boundary: L1
- Allowed paths: `docs/refactor/FACADE_RULES.md`, placeholder dirs under `engine/`
- Commands: none
- Deliverables:
  - `docs/refactor/FACADE_RULES.md` describing facade rules:
    - external imports must use old paths
    - old files become thin re-export facades
    - new implementation lives under new dirs
  - placeholder directories (with `.gitkeep` if needed) for planned splits
- Acceptance: rules doc exists; no runtime code touched
- Failure: any runtime code modified
- Rollback: remove the new doc and placeholder dirs

Task A3: Import boundary enforcement (facade-only)
- Depends on: A2a
- Boundary: L1
- Allowed paths: `scripts/lint_boundaries.mjs` (preferred), or ESLint config if added
- Commands:
  - `npm run lint`
- Changes:
  - forbid deep imports from new internal dirs (ex: `engine/audio/**`)
  - allow imports only from facade entry points (ex: `audioEngine.ts`)
- Acceptance:
  - `npm run lint` passes
  - a known-bad import fails lint
- Failure: lint passes with a known-bad import
- Rollback: revert lint rules

Task A4: Facade split template
- Depends on: A2a
- Boundary: L0
- Allowed paths: `docs/refactor/FACADE_TEMPLATE.md`
- Deliverable: step-by-step split template:
  - move code into new files first
  - keep old file as thin re-export
  - forbid external imports to new dirs
  - verify with `npm run verify`
- Acceptance: template is complete and executable
- Failure: missing steps or verification list
- Rollback: delete the doc

Task B0: Dependency check strategy doc
- Depends on: none
- Boundary: L0
- Allowed paths: `docs/refactor/DEPCHECK.md`
- Deliverable:
  - tool choice (dependency-cruiser preferred)
  - include/exclude paths
  - rules to enforce (no-circular as error)
- Acceptance: doc exists
- Failure: missing tool/rules
- Rollback: delete the doc

Task B1: Add depcheck tool and script
- Depends on: B0
- Boundary: L1
- Allowed paths: `package.json`, `.dependency-cruiser.cjs`
- Commands:
  - `npm install -D dependency-cruiser`
  - `npm run depcheck`
- Changes:
  - add devDependency
  - add config file with `no-circular` rule
  - add `depcheck` script to `package.json`
- Acceptance: `npm run depcheck` exits 0
- Failure: `depcheck` fails or ignores circulars
- Rollback: revert dependency, config, and script

Task B2: Add depcheck to doctor/verify
- Depends on: B1
- Boundary: L1
- Allowed paths: `scripts/doctor.mjs`
- Commands: `npm run verify`
- Changes:
  - insert depcheck step in doctor
- Acceptance: `npm run verify` passes and depcheck runs
- Failure: verify does not run depcheck
- Rollback: revert doctor change

Task C1: Node version pin (if not already present)
- Depends on: none
- Boundary: L0/L1
- Allowed paths: `.nvmrc`, `.npmrc` (optional), docs note
- Commands: `node -v` (for reference)
- Acceptance: version file exists and is documented
- Failure: missing version pin
- Rollback: delete version files

Task C2: Engines + CI enforcement (if not already present)
- Depends on: C1
- Boundary: L1
- Allowed paths: `package.json`, CI workflow
- Commands: `npm run verify` in CI
- Acceptance: CI uses `.nvmrc` and `engines` is set
- Failure: CI ignores pinned version
- Rollback: revert workflow/engines change

Task D0: Split playbook (SOP)
- Depends on: A1, B2
- Boundary: L0
- Allowed paths: `docs/refactor/SPLIT_PLAYBOOK.md`
- Deliverable:
  - split order: types -> pure logic -> glue -> side-effects
  - forbidden operations per stage
  - required verification commands
- Acceptance: playbook is actionable and sequential
- Failure: missing checklists or gate commands
- Rollback: delete the doc

Task D1: Split task template
- Depends on: D0
- Boundary: L0
- Allowed paths: `docs/refactor/TASK_TEMPLATE.md`
- Deliverable: per-task template with:
  - target file, planned modules, stable exports
  - risk flags (WebAudio/WebGL/MIDI)
  - command outputs and exit codes
- Acceptance: template present and complete
- Failure: missing required fields
- Rollback: delete the doc

Task D2: Stage gating rules
- Depends on: D0
- Boundary: L0
- Allowed paths: `docs/refactor/SPLIT_GATES.md`
- Deliverable:
  - "one extraction per task" rule
  - verify every step
  - forbid multi-file refactors in a single step
- Acceptance: rules are explicit
- Failure: ambiguous or missing gates
- Rollback: delete the doc

Task E1: Bundle analyzer (non-blocking)
- Depends on: none
- Boundary: L1
- Allowed paths: `package.json`, `vite.config.ts`, `reports/`
- Commands:
  - `npm install -D rollup-plugin-visualizer`
  - `npm run analyze`
- Changes:
  - add analyzer plugin only when `ANALYZE=1`
  - add `analyze` script
- Acceptance: report generated, normal build unaffected
- Failure: build changes without `ANALYZE=1`
- Rollback: revert plugin/script

Task E2: Dist size report (non-blocking)
- Depends on: E1 (optional)
- Boundary: L1
- Allowed paths: `scripts/report-dist-sizes.mjs`, `package.json`, `reports/`
- Commands: `npm run sizes`
- Changes:
  - add script to scan `dist/assets/*.(js|css)`
  - output JSON report in `reports/`
- Acceptance: report JSON generated and stable format
- Failure: script errors or modifies build output
- Rollback: revert script and package.json changes

Recommended execution order
- A0 -> A1 -> A2a -> A3 -> A4
- B0 -> B1 -> B2
- C1 -> C2
- D0 -> D1 -> D2
- E1 -> E2
- then actual splits using the playbook and templates

Per-task execution template (copy per task)
- Create branch: `git checkout -b task/<TASK_ID>`
- Only touch allowed paths for the task boundary
- Run:
  - `npm ci`
  - `npm run verify`
  - `npm run ui:check:shots`
  - `npm run depcheck` (if enabled)
- Record exit codes in `docs/refactor/STATUS.md`
- Confirm no changes in `dist/` or `node_modules/`
- Commit: `chore(task): <TASK_ID> <short desc>`
