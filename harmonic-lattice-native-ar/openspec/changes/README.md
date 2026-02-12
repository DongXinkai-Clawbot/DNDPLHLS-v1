# Change Status Standard

All change folders under `openspec/changes/` must use the same status vocabulary and date format.

## Status Enum
- Draft
- Active
- Done
- Archived

## Required Format
Use a single-line status field with a date:

```
Status: <Draft|Active|Done|Archived> on YYYY-MM-DD
```

## Where Status Lives
- `proposal.md` MUST include the status field.
- `design.md` and `tasks.md` MUST repeat the same status field.
- If a change folder only has a spec, add the status field to `spec.md` and create the missing files.

## Consistency Rules
- Status must match across `proposal.md`, `design.md`, `tasks.md` (and `spec.md` if present).
- Status changes must include a date.
- Empty files are not allowed. Remove or replace with real content.

## Source of Truth
`openspec/changes/` at the repo root is the canonical source. Archived mirrors (for example the `harmonic-lattice-native-ar/` placeholder) must only contain pointers, not divergent content.
