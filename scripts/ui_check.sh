#!/usr/bin/env bash
set -euo pipefail

BASELINE_FILE="ui_baseline/dist.sha256"
CURRENT_FILE="ui_baseline/dist.current.sha256"

if [ ! -f "$BASELINE_FILE" ]; then
  echo "Missing $BASELINE_FILE. Run: npm run ui:baseline" >&2
  exit 2
fi

bash scripts/ui_fingerprint.sh "$CURRENT_FILE" >/dev/null

if diff -u "$BASELINE_FILE" "$CURRENT_FILE" >/tmp/ui_fingerprint.diff; then
  rm -f "$CURRENT_FILE" /tmp/ui_fingerprint.diff
  echo "UI fingerprint matches baseline."
  exit 0
fi

echo "UI fingerprint differs from baseline:" >&2
cat /tmp/ui_fingerprint.diff >&2
exit 1
