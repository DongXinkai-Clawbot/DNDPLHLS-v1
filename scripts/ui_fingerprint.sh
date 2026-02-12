#!/usr/bin/env bash
set -euo pipefail

OUT_FILE="${1:-ui_baseline/dist.sha256}"

npm run build >/dev/null

mkdir -p "$(dirname "$OUT_FILE")"
(
  cd dist
  find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum
) > "$OUT_FILE"

echo "Wrote UI fingerprint: $OUT_FILE"
