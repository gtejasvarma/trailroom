#!/bin/bash
# Stop hook. Blocks the agent from ending its turn on a red verify suite.
set -uo pipefail

cat >/dev/null # drain stdin, Stop hooks don't need the payload

if ! OUTPUT=$(npm run verify 2>&1); then
  echo "$OUTPUT" >&2
  exit 2
fi

exit 0
