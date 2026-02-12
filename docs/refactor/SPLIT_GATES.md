# Split Gates (Stage Rules)

Rules:
1) One extraction per task (one module or one functional slice).
2) No multi-file refactor batches in a single step.
3) Facade export surface must remain identical.
4) Every step must pass:
   - `npm ci`
   - `npm run verify`
   - `npm run ui:check:shots`
   - `npm run depcheck` (if enabled)

Failure response:
- revert the task commit
- reattempt with a smaller extraction
