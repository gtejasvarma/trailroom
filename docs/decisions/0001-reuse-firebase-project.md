# 0001 — Reuse the existing Firebase project

Status: accepted, 2026-08-29

## Decision

Use the existing Firebase/GCP project `virtual-tryon-tejas` as Trailroom's project — including as
the production project referenced by the M0 deploy guard — rather than creating a new one.

## Context

`virtual-tryon-tejas` was created months ago during an earlier attempt at this same product
(virtual try-on). `docs/BUILD_PLAN.md` §0.3 has already committed to a Firebase/GCP stack, so a
project has to exist before M2 (the vertical slice) can deploy anything, and before M0's
`PreToolUse` guard can know what "production" means.

## Reasoning

Same product, not a fresh idea — reusing it avoids fragmenting billing/history across two projects
for no product reason, and the alternative (spin up a new project) has no advantage here beyond
starting "clean," which isn't actually a requirement.

## Follow-up required before this project is trusted as prod

These were not verified as part of this decision and should be checked before M2 deploys anything
real to it:

- [ ] Billing is still active on the project
- [ ] No leftover Firestore/Storage data or Auth users from the earlier attempt that could bleed
      into M1's eval fixtures or M2's test data if reused carelessly
- [ ] Sole IAM owner is confirmed (no stale collaborator access from the earlier attempt)

## Consequence

`PROD_PROJECT_ID=virtual-tryon-tejas` is wired into `.claude/hooks/guard.sh` — any `gcloud`/`firebase
deploy` command referencing this project ID is blocked from agent execution and must be run manually.
