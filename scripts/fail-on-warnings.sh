#!/usr/bin/env bash
# Runs a command and fails if it fails OR prints a warning. A build or install
# that warns still exits 0, so without this the zero-warnings policy (spec §12)
# holds only for the tools that have a --max-warnings flag.
set -uo pipefail

log="$(mktemp)"
trap 'rm -f "$log"' EXIT

"$@" 2>&1 | tee "$log"
status="${PIPESTATUS[0]}"
if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi

# A plain substring match, so CamelCase tokens such as Node's DeprecationWarning
# are caught. It will also flag a word like "forewarned"; that false alarm is
# the safe direction, where a word-boundary match let real warnings through.
pattern='warn|deprecat|\(!\)'
if grep -Eiq "$pattern" "$log"; then
  echo "::error::'$*' printed a warning (zero-warnings policy, spec §12):"
  grep -Ei "$pattern" "$log"
  exit 1
fi
