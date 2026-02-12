# Dependency Cycle Gate (depcheck)

Tool: dependency-cruiser (`depcruise`)

Scope:
- include: `components/`, `engine/`, `store/`, `utils/`, `hooks/`, and root runtime files
- exclude: `dist/`, `android/`, `api/`, `node_modules/`, `ui_baseline/`, `test-results/`

Rules:
- `no-circular` is error (hard gate)
- `no-orphans` optional (not enforced yet)

Command:
- `npm run depcheck`
