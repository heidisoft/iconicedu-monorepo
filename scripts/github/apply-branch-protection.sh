#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_FILE="$ROOT_DIR/.github/branch-protection/main.json"
BRANCH="${1:-main}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing config: $CONFIG_FILE" >&2
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN is required." >&2
  echo "Use a GitHub token with admin access to the repository." >&2
  exit 1
fi

REMOTE_URL="$(git -C "$ROOT_DIR" remote get-url origin)"

if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+)/([^.]+)(\.git)?$ ]]; then
  OWNER="${BASH_REMATCH[1]}"
  REPO="${BASH_REMATCH[2]}"
else
  echo "Could not parse owner/repo from origin remote: $REMOTE_URL" >&2
  exit 1
fi

echo "Applying branch protection to ${OWNER}/${REPO} branch ${BRANCH}"

curl --fail --silent --show-error \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" \
  --data-binary @"$CONFIG_FILE"

echo
echo "Branch protection applied."
