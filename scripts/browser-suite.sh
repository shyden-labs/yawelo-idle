#!/usr/bin/env bash
# Runs one browser suite on every desktop browser, then the shared one-suite
# check on what it ran (#1003): usage `scripts/browser-suite.sh <suite> <config>`.
# Playwright first lists what each browser should run, then runs it; the
# config's reporters write the run's report and assertion counts beside the
# list, in one-suite/<suite>/, and scripts/one-suite-check.ts reads all three.
# It fails when the run fails or the check finds a problem, and always runs
# the check after a run, so a red run still prints every browser's total.
set -uo pipefail

suite="${1:?usage: scripts/browser-suite.sh <suite> <config>}"
config="${2:?usage: scripts/browser-suite.sh <suite> <config>}"
dir="one-suite/$suite"

rm -rf "$dir"
mkdir -p "$dir"
PLAYWRIGHT_JSON_OUTPUT_FILE="$dir/list.json" npx --no playwright test -c "$config" --list --reporter=json || exit 1
npx --no playwright test -c "$config"
run=$?
node scripts/one-suite-check.ts "$dir"
check=$?
if [[ "$run" -ne 0 || "$check" -ne 0 ]]; then
  exit 1
fi
