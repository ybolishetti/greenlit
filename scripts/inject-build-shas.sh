#!/usr/bin/env bash
# Stamps git-SHA provenance for the current build into .env.production so
# Vite picks them up as VITE_* vars. Run via the `vercel-build` npm script,
# before `vite build`. Requires full git history (Vercel's native git
# integration clones full history by default; a shallow checkout could
# resolve an empty SHA for a file with no commits in the visible range).
set -euo pipefail

interviewer_sha=$(git log -1 --format=%H -- src/lib/ai/prompts/interviewer.md)
diagnostician_sha=$(git log -1 --format=%H -- src/lib/ai/prompts/diagnostician.md)
ui_rules_sha=$(git log -1 --format=%H -- src/lib/intake/uiRules.js)
app_build_sha=$(git rev-parse HEAD)

{
  echo "VITE_INTERVIEWER_PROMPT_SHA=${interviewer_sha}"
  echo "VITE_DIAGNOSTICIAN_PROMPT_SHA=${diagnostician_sha}"
  echo "VITE_UI_RULES_SHA=${ui_rules_sha}"
  echo "VITE_APP_BUILD_SHA=${app_build_sha}"
} >> .env.production
