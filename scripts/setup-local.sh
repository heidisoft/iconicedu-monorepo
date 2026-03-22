#!/usr/bin/env bash
# scripts/setup-local.sh
# One-time local dev bootstrap. Run from the repo root.
# Usage:
#   ./scripts/setup-local.sh          # Check prereqs, install deps, start Supabase, print env values
#   ./scripts/setup-local.sh --fill   # Same, but also write Supabase vars into .env files automatically

set -euo pipefail

FILL=false
for arg in "$@"; do
  [[ "$arg" == "--fill" ]] && FILL=true
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[setup]${RESET} $*"; }
success() { echo -e "${GREEN}[setup]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[setup]${RESET} $*"; }
error()   { echo -e "${RED}[setup] ERROR:${RESET} $*" >&2; }

# ── 1. Prerequisite checks ────────────────────────────────────────────────────

info "Checking prerequisites..."

check_cmd() {
  local cmd="$1" install_hint="$2"
  if ! command -v "$cmd" &>/dev/null; then
    error "'$cmd' not found. $install_hint"
    exit 1
  fi
  success "$cmd found ($(${cmd} --version 2>&1 | head -1))"
}

check_cmd node   "Install Node.js >= 20 from https://nodejs.org"
check_cmd pnpm   "Install pnpm: npm install -g pnpm@9.12.0"
check_cmd supabase "Install Supabase CLI: brew install supabase/tap/supabase"
check_cmd docker "Install Docker Desktop from https://www.docker.com/products/docker-desktop"

# Check Docker is running
if ! docker info &>/dev/null; then
  error "Docker daemon is not running. Start Docker Desktop and try again."
  exit 1
fi
success "Docker daemon is running"

# Optional tools (warn, don't fail)
for tool in railway eas; do
  if command -v "$tool" &>/dev/null; then
    success "$tool found"
  else
    warn "'$tool' not found (optional for local dev)."
    [[ "$tool" == "railway" ]] && warn "  Install: npm install -g @railway/cli"
    [[ "$tool" == "eas" ]]     && warn "  Install: npm install -g eas-cli"
  fi
done

echo ""

# ── 2. Copy .env files from examples (non-destructive) ────────────────────────

info "Checking .env files..."

copy_env_if_missing() {
  local example="$1" target="$2"
  if [[ -f "$target" ]]; then
    success "$target already exists, skipping"
  elif [[ -f "$example" ]]; then
    cp "$example" "$target"
    success "Created $target from $example"
  else
    warn "No example found at $example — skipping"
  fi
}

copy_env_if_missing "apps/api/.env.example"        "apps/api/.env"
copy_env_if_missing "apps/web/.env.local.example"  "apps/web/.env.local"
copy_env_if_missing "apps/mobile/.env.example"     "apps/mobile/.env"

echo ""

# ── 3. Install dependencies ───────────────────────────────────────────────────

info "Installing pnpm dependencies..."
pnpm install
success "Dependencies installed"
echo ""

# ── 4. Start Supabase ─────────────────────────────────────────────────────────

info "Starting local Supabase stack (this may take a minute on first run)..."
supabase start
echo ""

# ── 5. Read Supabase status ───────────────────────────────────────────────────

info "Reading Supabase connection details..."

STATUS_JSON=$(supabase status --output json 2>/dev/null)

API_URL=$(echo "$STATUS_JSON"        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('API URL',''))" 2>/dev/null || echo "")
ANON_KEY=$(echo "$STATUS_JSON"       | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('anon key',''))" 2>/dev/null || echo "")
SERVICE_KEY=$(echo "$STATUS_JSON"    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('service_role key',''))" 2>/dev/null || echo "")
DB_URL=$(echo "$STATUS_JSON"         | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('DB URL',''))" 2>/dev/null || echo "")
JWT_SECRET=$(echo "$STATUS_JSON"     | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('JWT secret',''))" 2>/dev/null || echo "")
INBUCKET_URL=$(echo "$STATUS_JSON"   | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Inbucket URL',''))" 2>/dev/null || echo "")
STUDIO_URL=$(echo "$STATUS_JSON"     | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Studio URL',''))" 2>/dev/null || echo "")

# ── 6. Optionally write vars into .env files ──────────────────────────────────

write_var() {
  local file="$1" key="$2" value="$3"
  if [[ -z "$value" ]]; then return; fi
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    # Replace existing line
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "${file}.bak"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

if [[ "$FILL" == true ]]; then
  info "Writing Supabase vars into .env files (--fill)..."

  # apps/api/.env
  write_var "apps/api/.env" "SUPABASE_URL"          "$API_URL"
  write_var "apps/api/.env" "DATABASE_URL"           "$DB_URL"
  write_var "apps/api/.env" "DIRECT_URL"             "$DB_URL"
  write_var "apps/api/.env" "SUPABASE_SERVICE_ROLE_KEY" "$SERVICE_KEY"
  write_var "apps/api/.env" "JWT_SECRET"             "$JWT_SECRET"

  # apps/web/.env.local
  write_var "apps/web/.env.local" "NEXT_PUBLIC_SUPABASE_URL"      "$API_URL"
  write_var "apps/web/.env.local" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$ANON_KEY"
  write_var "apps/web/.env.local" "SUPABASE_SERVICE_ROLE_KEY"     "$SERVICE_KEY"

  # apps/mobile/.env
  write_var "apps/mobile/.env" "EXPO_PUBLIC_SUPABASE_URL"      "$API_URL"
  write_var "apps/mobile/.env" "EXPO_PUBLIC_SUPABASE_ANON_KEY" "$ANON_KEY"

  success "Supabase vars written. Remaining vars (Daily, PostHog, internal tokens) need manual setup."
fi

# ── 7. Print summary ──────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD} Local Supabase Connection Details${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${CYAN}API URL${RESET}            ${API_URL}"
echo -e "  ${CYAN}Anon Key${RESET}           ${ANON_KEY}"
echo -e "  ${CYAN}Service Role Key${RESET}   ${SERVICE_KEY}"
echo -e "  ${CYAN}DB URL${RESET}             ${DB_URL}"
echo -e "  ${CYAN}JWT Secret${RESET}         ${JWT_SECRET}"
echo ""
echo -e "  ${CYAN}Studio${RESET}             ${STUDIO_URL:-http://127.0.0.1:54323}"
echo -e "  ${CYAN}Inbucket (email)${RESET}   ${INBUCKET_URL:-http://127.0.0.1:54324}"
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

if [[ "$FILL" != true ]]; then
  echo -e "${YELLOW}Tip:${RESET} Re-run with ${BOLD}--fill${RESET} to write these values into your .env files automatically."
  echo ""
fi

echo -e "${BOLD}Seed credentials${RESET} (password: ${BOLD}Seed123!${RESET} for all)"
echo "  heshanmw@gmail.com    — Owner (Marc F)"
echo "  heshanmw+1@gmail.com  — Guardian (Lura H)"
echo "  heshanmw+3@gmail.com  — Educator (Denise R)"
echo "  heshanmw+4@gmail.com  — Educator (Barbara Y)"
echo "  heshanmw+5@gmail.com  — Staff (Harold B)"
echo "  heshanmw+6@gmail.com  — Guardian (Jessica K)"
echo ""

echo -e "${BOLD}Remaining env vars to fill manually:${RESET}"
echo "  apps/api/.env"
echo "    INTERNAL_REMINDERS_TOKEN_API, POSTHOG_KEY"
echo "  apps/web/.env.local"
echo "    DAILY_API_KEY, DAILY_REST_BASE_URL, DAILY_WEBHOOK_SECRET"
echo "    INTERNAL_REMINDERS_TOKEN, INTERNAL_ACTIVITY_FEED_TOKEN"
echo "    NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST"
echo "  apps/mobile/.env"
echo "    EXPO_PUBLIC_POSTHOG_KEY, EXPO_PUBLIC_POSTHOG_HOST"
echo ""
echo -e "${BOLD}Next steps:${RESET}"
echo "  1. Fill in remaining env vars above"
echo "  2. pnpm dev:api    — start NestJS API"
echo "  3. pnpm dev:web    — start Next.js web app"
echo "  4. pnpm dev:mobile — start Expo mobile app"
echo "  OR: pnpm dev       — start all three in parallel"
echo ""
success "Setup complete!"
