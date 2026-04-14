#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ICONIC Academy — Mobile Development Launcher
#
# Usage:
#   pnpm dev:mobile          (from repo root)
#   pnpm --filter mobile dev:local  (from any directory)
#
# What it does:
#   1. Asks whether to generate and build native projects (expo prebuild +
#      expo run:ios / expo run:android).
#   2. If skipped, starts Metro bundler for the already-installed dev client.
#
# When to rebuild native projects:
#   - First run on a new machine or after a fresh clone
#   - After adding, removing, or updating an Expo plugin in app.json
#   - After installing a package that includes native code
#   - When you see native-related build or runtime errors
#
# You do NOT need to rebuild for normal JS-only changes (screens, logic,
# styling, routing, most API changes).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$MOBILE_DIR"

echo ""
echo "  ──────────────────────────────────────────────────────────────────────"
echo "   ICONIC Academy — Mobile Dev"
echo "  ──────────────────────────────────────────────────────────────────────"
echo ""

# ── Detect whether native directories exist ───────────────────────────────────
HAS_NATIVE=false
{ [ -d "ios" ] || [ -d "android" ]; } && HAS_NATIVE=true

if [ "$HAS_NATIVE" = false ]; then
  echo "  ⚠  Native projects not found (ios/ and android/ are missing)."
  echo "     You must generate them before the dev client can run."
  echo ""
  SHOULD_BUILD=true
else
  echo "  Native projects detected."
  echo ""
  echo "  Rebuild native projects?"
  echo ""
  echo "  Rebuild when:"
  echo "    • First run on a new machine or fresh clone"
  echo "    • You changed app.json plugins or installed native packages"
  echo "    • You're seeing native build errors or unexpected crashes"
  echo ""
  echo "  Skip for normal JS work — screens, logic, styling, routing."
  echo ""
  read -r -p "  Rebuild native projects? [y/N] " answer
  case "$answer" in
    [yY] | [yY][eE][sS]) SHOULD_BUILD=true ;;
    *) SHOULD_BUILD=false ;;
  esac
fi

# ── Optional native build ─────────────────────────────────────────────────────
if [ "$SHOULD_BUILD" = true ]; then
  echo ""
  echo "  ── expo prebuild ────────────────────────────────────────────────────"
  echo ""
  npx expo prebuild

  echo ""
  echo "  ── Select platform ──────────────────────────────────────────────────"
  echo ""
  echo "    1) iOS      — requires Xcode + Simulator or connected iPhone"
  echo "    2) Android  — requires Android Studio + Emulator or connected device"
  echo "    q) Skip     — I will connect the dev client manually"
  echo ""
  read -r -p "  Platform [1]: " platform_answer
  platform_answer="${platform_answer:-1}"

  case "$platform_answer" in
    1 | ios | iOS)
      echo ""
      echo "  ── expo run:ios ─────────────────────────────────────────────────────"
      echo "  This builds the app, installs it on the Simulator, and starts Metro."
      echo ""
      exec npx expo run:ios
      ;;
    2 | android | Android)
      echo ""
      echo "  ── expo run:android ─────────────────────────────────────────────────"
      echo "  This builds the app, installs it on the Emulator, and starts Metro."
      echo ""
      exec npx expo run:android
      ;;
    q | Q | skip)
      echo ""
      echo "  Skipped native build."
      ;;
    *)
      echo ""
      echo "  Unrecognised option — skipping native build."
      ;;
  esac
fi

# ── Start Metro for an already-installed dev client ───────────────────────────
echo ""
echo "  ── Starting Metro bundler ───────────────────────────────────────────"
echo "  Open the ICONIC Academy dev client app on your device and scan the QR"
echo "  code, or press i (iOS Simulator) / a (Android Emulator) in the terminal."
echo ""
exec npx expo start --dev-client --clear
