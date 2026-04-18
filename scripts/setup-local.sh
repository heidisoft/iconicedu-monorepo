#!/usr/bin/env bash
# scripts/setup-local.sh
# One-time local dev bootstrap. Run from the repo root.
# Usage:
#   ./scripts/setup-local.sh             # Check prereqs, install deps, start Supabase, print env values
#   ./scripts/setup-local.sh --fill      # Same, but also write/update local env vars
#   ./scripts/setup-local.sh --sync-env  # Only read Supabase status and sync env files in place

set -euo pipefail

FILL=false
SYNC_ENV_ONLY=false
for arg in "$@"; do
  [[ "$arg" == "--fill" ]] && FILL=true
  [[ "$arg" == "--sync-env" ]] && SYNC_ENV_ONLY=true
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

WEB_ENV_FILE="apps/web/.env.local"
MOBILE_ENV_FILE="apps/mobile/.env"
API_ENV_FILE="apps/api/.env"
WEB_ENV_EXAMPLE_FILE="apps/web/.env.local.example"
MOBILE_ENV_EXAMPLE_FILE="apps/mobile/.env.example"
API_ENV_EXAMPLE_FILE="apps/api/.env.example"
LOCAL_WEB_APP_URL="http://127.0.0.1:3000"
LOCAL_MOBILE_SUPABASE_URL="http://127.0.0.1:54321"

UPDATED_FILES=()
UPDATED_KEYS=()

info()    { echo -e "${CYAN}[setup]${RESET} $*"; }
success() { echo -e "${GREEN}[setup]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[setup]${RESET} $*"; }
error()   { echo -e "${RED}[setup] ERROR:${RESET} $*" >&2; }

record_update() {
  local file="$1" key="$2"
  UPDATED_FILES+=("$file")
  UPDATED_KEYS+=("$file:$key")
}

check_cmd() {
  local cmd="$1" install_hint="$2"
  if ! command -v "$cmd" &>/dev/null; then
    error "'$cmd' not found. $install_hint"
    exit 1
  fi
  success "$cmd found ($(${cmd} --version 2>&1 | head -1))"
}

check_sync_prereqs() {
  info "Checking prerequisites for env sync..."
  check_cmd node "Install Node.js >= 20 from https://nodejs.org"
  check_cmd supabase "Install Supabase CLI: brew install supabase/tap/supabase"
  echo ""
}

check_bootstrap_prereqs() {
  info "Checking prerequisites..."
  check_cmd node "Install Node.js >= 20 from https://nodejs.org"
  check_cmd pnpm "Install pnpm: npm install -g pnpm@9.12.0"
  check_cmd supabase "Install Supabase CLI: brew install supabase/tap/supabase"
  check_cmd docker "Install Docker Desktop from https://www.docker.com/products/docker-desktop"

  if ! docker info &>/dev/null; then
    error "Docker daemon is not running. Start Docker Desktop and try again."
    exit 1
  fi
  success "Docker daemon is running"

  for tool in railway eas; do
    if command -v "$tool" &>/dev/null; then
      success "$tool found"
    else
      warn "'$tool' not found (optional for local dev)."
      [[ "$tool" == "railway" ]] && warn "  Install: npm install -g @railway/cli"
      [[ "$tool" == "eas" ]] && warn "  Install: npm install -g eas-cli"
    fi
  done

  echo ""
}

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

ensure_env_file() {
  local file="$1"
  mkdir -p "$(dirname "$file")"
  [[ -f "$file" ]] || : > "$file"
}

sync_missing_env_vars_from_example() {
  local example="$1" target="$2"

  if [[ ! -f "$example" ]]; then
    warn "No example found at $example — skipping missing var sync"
    return 0
  fi

  ensure_env_file "$target"

  node - "$example" "$target" <<'NODE'
const fs = require('node:fs');
const [exampleFile, targetFile] = process.argv.slice(2);

const readLines = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];

const parseKeys = (lines) => {
  const keys = new Set();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    keys.add(line.slice(0, idx).trim());
  }
  return keys;
};

const exampleLines = readLines(exampleFile);
const targetRaw = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : '';
const targetLines = targetRaw === '' ? [] : targetRaw.split(/\r?\n/);
const targetKeys = parseKeys(targetLines);
const newline = targetRaw.includes('\r\n') ? '\r\n' : '\n';

const additions = [];
for (const line of exampleLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx <= 0) continue;
  const key = line.slice(0, idx).trim();
  if (targetKeys.has(key)) continue;
  additions.push(line);
  targetKeys.add(key);
}

if (additions.length === 0) process.exit(0);

while (targetLines.length > 0 && targetLines[targetLines.length - 1] === '') {
  targetLines.pop();
}

if (targetLines.length > 0) {
  targetLines.push('');
}
targetLines.push(...additions);

fs.writeFileSync(targetFile, `${targetLines.join(newline)}${newline}`);
NODE
}

extract_status_json() {
  local raw="$1"
  STATUS_JSON=$(
    printf '%s' "$raw" | node -e "
      const fs = require('node:fs');
      const raw = fs.readFileSync(0, 'utf8');
      const start = raw.indexOf('{');
      if (start === -1) {
        console.error('Supabase status output did not contain JSON.');
        process.exit(1);
      }
      let depth = 0;
      let inString = false;
      let escaping = false;
      let end = -1;

      for (let i = start; i < raw.length; i += 1) {
        const ch = raw[i];

        if (inString) {
          if (escaping) {
            escaping = false;
          } else if (ch === '\\\\') {
            escaping = true;
          } else if (ch === '\"') {
            inString = false;
          }
          continue;
        }

        if (ch === '\"') {
          inString = true;
          continue;
        }

        if (ch === '{') depth += 1;
        if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }

      if (end === -1) {
        console.error('Supabase status output did not contain a complete JSON object.');
        process.exit(1);
      }

      const parsed = JSON.parse(raw.slice(start, end));
      process.stdout.write(JSON.stringify(parsed));
    "
  )
}

json_get() {
  local key="$1"
  printf '%s' "$STATUS_JSON" | node -e "
    const fs = require('node:fs');
    const data = JSON.parse(fs.readFileSync(0, 'utf8'));
    process.stdout.write(String(data[process.argv[1]] ?? ''));
  " "$key"
}

require_status_value() {
  local value="$1" label="$2"
  if [[ -z "$value" ]]; then
    error "Missing required Supabase status value: $label"
    exit 1
  fi
}

read_supabase_status() {
  info "Reading Supabase connection details..."
  local status_raw
  if ! status_raw=$(supabase status --output json 2>&1); then
    printf '%s\n' "$status_raw" >&2
    error "Failed to read local Supabase status."
    exit 1
  fi

  extract_status_json "$status_raw"

  API_URL=$(json_get "API_URL")
  DB_URL=$(json_get "DB_URL")
  JWT_SECRET=$(json_get "JWT_SECRET")
  PUBLISHABLE_KEY=$(json_get "PUBLISHABLE_KEY")
  ANON_KEY=$(json_get "ANON_KEY")
  SECRET_KEY=$(json_get "SECRET_KEY")
  SERVICE_ROLE_KEY=$(json_get "SERVICE_ROLE_KEY")
  MAILPIT_URL=$(json_get "MAILPIT_URL")
  INBUCKET_URL=$(json_get "INBUCKET_URL")
  STUDIO_URL=$(json_get "STUDIO_URL")
  GRAPHQL_URL=$(json_get "GRAPHQL_URL")
  REST_URL=$(json_get "REST_URL")
  MCP_URL=$(json_get "MCP_URL")
  STORAGE_S3_URL=$(json_get "STORAGE_S3_URL")

  require_status_value "$API_URL" "API_URL"
  require_status_value "$DB_URL" "DB_URL"
  require_status_value "$JWT_SECRET" "JWT_SECRET"
  require_status_value "$PUBLISHABLE_KEY" "PUBLISHABLE_KEY"
  require_status_value "$ANON_KEY" "ANON_KEY"
  require_status_value "$SECRET_KEY" "SECRET_KEY"
  require_status_value "$SERVICE_ROLE_KEY" "SERVICE_ROLE_KEY"

  echo ""
}

env_has_key() {
  local file="$1" key="$2"
  [[ -f "$file" ]] && grep -Eq "^${key}=" "$file"
}

env_get_value() {
  local file="$1" key="$2"
  if [[ ! -f "$file" ]]; then
    return 0
  fi

  node - "$file" "$key" <<'NODE'
const fs = require('node:fs');
const [file, key] = process.argv.slice(2);
if (!fs.existsSync(file)) process.exit(0);
const text = fs.readFileSync(file, 'utf8');
const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
if (!line) process.exit(0);
process.stdout.write(line.slice(key.length + 1));
NODE
}

set_env_var() {
  local file="$1" key="$2" value="$3"
  local result
  ensure_env_file "$file"
  result=$(
    node - "$file" "$key" "$value" <<'NODE'
const fs = require('node:fs');
const [file, key, value] = process.argv.slice(2);
const exists = fs.existsSync(file);
const original = exists ? fs.readFileSync(file, 'utf8') : '';
const newline = original.includes('\r\n') ? '\r\n' : '\n';
const desired = `${key}=${value}`;
let lines = original === '' ? [] : original.split(/\r?\n/);
const hadTrailingNewline = original.endsWith('\n');
let found = false;
let changed = false;

lines = lines.map((line) => {
  if (!line.startsWith(`${key}=`)) return line;
  found = true;
  if (line !== desired) {
    changed = true;
    return desired;
  }
  return line;
});

if (!found) {
  changed = true;
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  lines.push(desired);
}

if (changed) {
  const output = lines.join(newline) + newline;
  fs.writeFileSync(file, output);
}

process.stdout.write(JSON.stringify({ changed, found, hadTrailingNewline }));
NODE
  )

  if printf '%s' "$result" | grep -q '"changed":true'; then
    record_update "$file" "$key"
  fi
}

generate_secret() {
  node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
}

ensure_env_var() {
  local file="$1" key="$2" default_value="$3"
  local current_value
  current_value=$(env_get_value "$file" "$key")
  if [[ -n "$current_value" ]]; then
    printf '%s' "$current_value"
    return 0
  fi
  set_env_var "$file" "$key" "$default_value"
  printf '%s' "$default_value"
}

sync_env_files() {
  info "Syncing local env files in place..."

  sync_missing_env_vars_from_example "$API_ENV_EXAMPLE_FILE" "$API_ENV_FILE"
  sync_missing_env_vars_from_example "$WEB_ENV_EXAMPLE_FILE" "$WEB_ENV_FILE"
  sync_missing_env_vars_from_example "$MOBILE_ENV_EXAMPLE_FILE" "$MOBILE_ENV_FILE"

  set_env_var "$API_ENV_FILE" "DATABASE_URL" "$DB_URL"
  set_env_var "$API_ENV_FILE" "DIRECT_URL" "$DB_URL"
  set_env_var "$API_ENV_FILE" "SUPABASE_URL" "$API_URL"
  set_env_var "$API_ENV_FILE" "SUPABASE_SERVICE_ROLE_KEY" "$SERVICE_ROLE_KEY"
  set_env_var "$API_ENV_FILE" "SUPABASE_ANON_KEY" "$ANON_KEY"
  set_env_var "$API_ENV_FILE" "JWT_SECRET" "$JWT_SECRET"

  ensure_env_var "$API_ENV_FILE" "INTERNAL_REMINDERS_TOKEN_API" "$(generate_secret)" >/dev/null
  ensure_env_var "$API_ENV_FILE" "INTERNAL_ACTIVITY_FEED_TOKEN" "$(generate_secret)" >/dev/null
  ensure_env_var "$API_ENV_FILE" "INTERNAL_NOTIFICATIONS_TOKEN_API" "$(generate_secret)" >/dev/null

  set_env_var "$WEB_ENV_FILE" "NEXT_PUBLIC_SUPABASE_URL" "$API_URL"
  set_env_var "$WEB_ENV_FILE" "SUPABASE_URL" "$API_URL"
  set_env_var "$WEB_ENV_FILE" "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" "$PUBLISHABLE_KEY"
  if env_has_key "$WEB_ENV_FILE" "NEXT_PUBLIC_SUPABASE_ANON_KEY" || ! env_has_key "$WEB_ENV_FILE" "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"; then
    set_env_var "$WEB_ENV_FILE" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$ANON_KEY"
  fi
  set_env_var "$WEB_ENV_FILE" "SUPABASE_SERVICE_ROLE_KEY" "$SERVICE_ROLE_KEY"
  ensure_env_var "$WEB_ENV_FILE" "NEXT_PUBLIC_APP_URL" "$LOCAL_WEB_APP_URL" >/dev/null

  set_env_var "$MOBILE_ENV_FILE" "EXPO_PUBLIC_SUPABASE_URL" "$LOCAL_MOBILE_SUPABASE_URL"
  set_env_var "$MOBILE_ENV_FILE" "EXPO_PUBLIC_SUPABASE_ANON_KEY" "$ANON_KEY"

  success "Local env sync complete."
  echo ""
}

print_updates_summary() {
  echo -e "${BOLD}Env updates${RESET}"
  if [[ ${#UPDATED_KEYS[@]} -eq 0 ]]; then
    echo "  No env values changed."
  else
    printf '%s\n' "${UPDATED_KEYS[@]}" | node -e '
      const fs = require("node:fs");
      const entries = fs.readFileSync(0, "utf8").trim().split(/\n+/).filter(Boolean);
      const grouped = new Map();
      for (const entry of entries) {
        const idx = entry.lastIndexOf(":");
        const file = entry.slice(0, idx);
        const key = entry.slice(idx + 1);
        if (!grouped.has(file)) grouped.set(file, []);
        grouped.get(file).push(key);
      }
      for (const [file, keys] of grouped.entries()) {
        console.log(`  ${file}`);
        console.log(`    ${Array.from(new Set(keys)).join(", ")}`);
      }
    '
  fi
  echo ""
}

print_missing_optional_vars() {
  echo -e "${BOLD}Optional env vars still unset${RESET}"
  node - "$API_ENV_FILE" "$WEB_ENV_FILE" "$MOBILE_ENV_FILE" <<'NODE'
const fs = require('node:fs');
const [apiFile, webFile, mobileFile] = process.argv.slice(2);
const groups = [
  {
    file: apiFile,
    keys: ['POSTHOG_KEY', 'POSTHOG_HOST', 'EXPO_ACCESS_TOKEN'],
  },
  {
    file: webFile,
    keys: [
      'DAILY_API_KEY',
      'DAILY_REST_BASE_URL',
      'DAILY_WEBHOOK_SECRET',
      'NEXT_PUBLIC_POSTHOG_KEY',
      'NEXT_PUBLIC_POSTHOG_HOST',
    ],
  },
  {
    file: mobileFile,
    keys: ['EXPO_PUBLIC_POSTHOG_KEY', 'EXPO_PUBLIC_POSTHOG_HOST'],
  },
];

let any = false;
for (const group of groups) {
  const text = fs.existsSync(group.file) ? fs.readFileSync(group.file, 'utf8') : '';
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    values.set(line.slice(0, idx), line.slice(idx + 1).trim());
  }
  const missing = group.keys.filter((key) => !(values.get(key) ?? '').trim());
  if (missing.length === 0) continue;
  any = true;
  console.log(`  ${group.file}`);
  console.log(`    ${missing.join(', ')}`);
}
if (!any) {
  console.log('  None');
}
NODE
  echo ""
}

print_status_summary() {
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD} Local Supabase Connection Details${RESET}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  echo -e "  ${CYAN}API URL${RESET}            ${API_URL}"
  echo -e "  ${CYAN}Publishable Key${RESET}    ${PUBLISHABLE_KEY}"
  echo -e "  ${CYAN}Anon Key${RESET}           ${ANON_KEY}"
  echo -e "  ${CYAN}Secret Key${RESET}         ${SECRET_KEY}"
  echo -e "  ${CYAN}Service Role Key${RESET}   ${SERVICE_ROLE_KEY}"
  echo -e "  ${CYAN}DB URL${RESET}             ${DB_URL}"
  echo -e "  ${CYAN}JWT Secret${RESET}         ${JWT_SECRET}"
  echo ""
  echo -e "  ${CYAN}Studio${RESET}             ${STUDIO_URL:-http://127.0.0.1:54323}"
  echo -e "  ${CYAN}Mailpit${RESET}            ${MAILPIT_URL:-$INBUCKET_URL}"
  echo -e "  ${CYAN}REST${RESET}               ${REST_URL}"
  echo -e "  ${CYAN}GraphQL${RESET}            ${GRAPHQL_URL}"
  echo -e "  ${CYAN}MCP${RESET}                ${MCP_URL}"
  echo -e "  ${CYAN}Storage (S3)${RESET}       ${STORAGE_S3_URL}"
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}

print_seed_credentials() {
  echo -e "${BOLD}Seed credentials${RESET} (password: ${BOLD}Seed123!${RESET} for all)"
  echo "  owner.marc@example.com       — Owner (Marc F)"
  echo "  guardian.lura@example.com    — Guardian (Lura H)"
  echo "  educator.denise@example.com  — Educator (Denise R)"
  echo "  educator.barbara@example.com — Educator (Barbara Y)"
  echo "  staff.harold@example.com     — Staff (Harold B)"
  echo "  guardian.jessica@example.com — Guardian (Jessica K)"
  echo ""
}

print_next_steps() {
  echo -e "${BOLD}Next steps:${RESET}"
  echo "  1. Review optional unset env vars above if you need those integrations locally"
  echo "  2. pnpm dev:api    — start NestJS API"
  echo "  3. pnpm dev:web    — start Next.js web app"
  echo "  4. pnpm mobile:start — start Expo mobile app"
  echo "  OR: pnpm dev       — start all three in parallel"
  echo ""
}

run_sync_mode() {
  check_sync_prereqs
  read_supabase_status
  sync_env_files
  print_status_summary
  print_updates_summary
  print_missing_optional_vars
  echo "Mobile local Supabase URL is pinned to ${LOCAL_MOBILE_SUPABASE_URL} by choice."
  echo ""
  success "Env sync complete!"
}

run_bootstrap_mode() {
  check_bootstrap_prereqs

  info "Checking .env files..."
  copy_env_if_missing "apps/api/.env.example" "$API_ENV_FILE"
  copy_env_if_missing "apps/web/.env.local.example" "$WEB_ENV_FILE"
  copy_env_if_missing "apps/mobile/.env.example" "$MOBILE_ENV_FILE"
  echo ""

  info "Installing pnpm dependencies..."
  pnpm install
  success "Dependencies installed"
  echo ""

  info "Starting local Supabase stack (this may take a minute on first run)..."
  supabase start
  echo ""

  read_supabase_status

  if [[ "$FILL" == true ]]; then
    sync_env_files
  fi

  print_status_summary
  if [[ "$FILL" == true ]]; then
    print_updates_summary
  else
    echo -e "${YELLOW}Tip:${RESET} Re-run with ${BOLD}--fill${RESET} to write these values into your .env files automatically."
    echo ""
  fi
  print_seed_credentials
  print_missing_optional_vars
  print_next_steps
  success "Setup complete!"
}

if [[ "$SYNC_ENV_ONLY" == true ]]; then
  run_sync_mode
else
  run_bootstrap_mode
fi
