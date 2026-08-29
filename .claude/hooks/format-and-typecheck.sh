#!/bin/bash
# PostToolUse on Edit|Write. Formats the touched file and typechecks the repo,
# so type errors come back as text in the same turn instead of surfacing later.
set -uo pipefail

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')

[[ -z "$FILE" ]] && exit 0

case "$FILE" in
  *.ts|*.tsx|*.json) ;;
  *) exit 0 ;;
esac
case "$FILE" in
  */packages/*|*/apps/*) ;;
  *) exit 0 ;;
esac

npx --no-install prettier --write "$FILE" >/dev/null 2>&1 || true

if ! TSC_OUTPUT=$(npx --no-install tsc --noEmit -p tsconfig.json 2>&1); then
  echo "$TSC_OUTPUT" >&2
  exit 2
fi

exit 0
