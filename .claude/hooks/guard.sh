#!/bin/bash
# PreToolUse guard for Bash. Denies destructive commands and any command that
# touches the production Firebase/GCP project. See docs/decisions/0001-reuse-firebase-project.md.
set -uo pipefail

PROD_PROJECT_ID="virtual-tryon-tejas"

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

case "$CMD" in
  *"rm -rf"*)
    deny "Destructive delete blocked. Move to a _trash/ dir instead, or ask the user to run it." ;;
  *"push --force"*|*"push -f"*|*"push --force-with-lease"*)
    deny "Force push blocked." ;;
  *"firebase deploy"*)
    deny "Firebase deploys are manual and run by Tejas only." ;;
esac

if [[ "$CMD" == *"$PROD_PROJECT_ID"* ]] && { [[ "$CMD" == *gcloud* ]] || [[ "$CMD" == *firebase* ]]; }; then
  deny "Production project ($PROD_PROJECT_ID) is out of bounds for agent-run commands."
fi

exit 0
