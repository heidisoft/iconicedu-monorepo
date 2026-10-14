#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PLATFORM="${1:?Expected ios or android}"
TASK_DIR="${RUNNER_TEMP:-/tmp}/iconic-native-e2e"
mkdir -p "$TASK_DIR"
pnpm canvas:build
pnpm exec expo prebuild --no-install > "$TASK_DIR/prebuild.log" 2>&1
# A fixed runtime version keeps development manifests fast enough for the dev launcher.
NATIVE_CLASSROOM_E2E_RUNTIME_VERSION=native-classroom-e2e \
  REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 pnpm exec expo start --dev-client --port 8085 --lan > "$TASK_DIR/metro.log" 2>&1 &
METRO_PID=$!
EMULATOR_PID=''
LINK_API_PID=''
cleanup() {
  if [[ -n "$LINK_API_PID" ]]; then kill "$LINK_API_PID" 2>/dev/null || true; fi
  kill "$METRO_PID" 2>/dev/null || true
  if [[ -n "$EMULATOR_PID" ]]; then kill "$EMULATOR_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT
if [[ "$PLATFORM" == ios ]]; then
  (cd ios && pod install) > "$TASK_DIR/pods.log" 2>&1
  DEVICE_ID=$(xcrun simctl list devices available --json | node -e '
    let input="";process.stdin.on("data",data=>input+=data).on("end",()=>{
      const device=Object.values(JSON.parse(input).devices).flat().find(item=>item.isAvailable&&item.name.includes("iPad"));
      if(!device)process.exit(1);process.stdout.write(device.udid);
    });')
  if ! xcodebuild -workspace ios/ICONICAcademy.xcworkspace -scheme ICONICAcademy \
      -configuration Debug -sdk iphonesimulator -destination "platform=iOS Simulator,id=$DEVICE_ID" \
      -derivedDataPath "$TASK_DIR/derived" CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build > "$TASK_DIR/build.log" 2>&1; then
    tail -120 "$TASK_DIR/build.log"; exit 1
  fi
  xcrun simctl boot "$DEVICE_ID" || true
  xcrun simctl bootstatus "$DEVICE_ID" -b
  xcrun simctl install "$DEVICE_ID" "$TASK_DIR/derived/Build/Products/Debug-iphonesimulator/ICONICAcademy.app"
elif [[ "$PLATFORM" == android ]]; then
  # GitHub's Ubuntu image ships the SDK command-line tools without putting them on PATH.
  SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if [[ -z "$SDK_ROOT" ]]; then echo 'ANDROID_HOME is not set'; exit 1; fi
  if [[ -d "$SDK_ROOT/cmdline-tools/latest/bin" ]]; then PATH="$SDK_ROOT/cmdline-tools/latest/bin:$PATH"; fi
  if [[ -d "$SDK_ROOT/platform-tools" ]]; then PATH="$SDK_ROOT/platform-tools:$PATH"; fi
  export PATH
  if ! command -v sdkmanager > /dev/null; then
    echo "sdkmanager not found under $SDK_ROOT/cmdline-tools"; exit 1
  fi
  (yes || true) | sdkmanager --licenses > "$TASK_DIR/sdk-licenses.log" 2>&1
  # API 36 images need a current emulator; the runner's preinstalled one can lag behind.
  sdkmanager emulator platform-tools 'system-images;android-36;google_apis;x86_64' > "$TASK_DIR/sdk.log" 2>&1
  # avdmanager and the emulator must agree on where AVDs live, or the emulator reports
  # "Unknown AVD name" and never reaches adb.
  export ANDROID_AVD_HOME="$HOME/.android/avd"
  mkdir -p "$ANDROID_AVD_HOME"
  if ! printf 'no\n' | avdmanager create avd --force -n IconicClassroomTablet \
      -k 'system-images;android-36;google_apis;x86_64' -d pixel_tablet > "$TASK_DIR/avd.log" 2>&1; then
    cat "$TASK_DIR/avd.log"; exit 1
  fi
  if ! "$SDK_ROOT/emulator/emulator" -list-avds | grep -qx IconicClassroomTablet; then
    echo 'The tablet AVD was not created'; cat "$TASK_DIR/avd.log"; exit 1
  fi
  "$ANDROID_HOME/emulator/emulator" -avd IconicClassroomTablet -no-window -no-snapshot -no-audio -gpu swiftshader_indirect > "$TASK_DIR/emulator.log" 2>&1 &
  EMULATOR_PID=$!
  if ! timeout 600 adb wait-for-device; then
    echo 'Emulator did not connect to adb within 10 minutes'; tail -80 "$TASK_DIR/emulator.log"; exit 1
  fi
  for attempt in $(seq 1 120); do
    if [[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]; then break; fi
    sleep 2
  done
  [[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]] || { echo 'Emulator did not finish booting'; exit 1; }
  adb shell settings put global window_animation_scale 0
  adb shell settings put global transition_animation_scale 0
  adb shell settings put global animator_duration_scale 0
  # Reanimated links libworklets.so from its per-ABI CMake task, but only its aggregate
  # externalNativeBuild task waits for Worklets, so build Worklets' native library first.
  WORKLETS_ANDROID=$(node -p "require('path').dirname(require.resolve('react-native-worklets/package.json'))")/android
  list_worklets_libraries() {
    echo 'libworklets.so outputs:'; find "$WORKLETS_ANDROID/build" -name libworklets.so 2>/dev/null || true
  }
  if ! (cd android && ./gradlew :react-native-worklets:externalNativeBuildDebug \
      --no-parallel -PreactNativeArchitectures=x86_64) > "$TASK_DIR/worklets-build.log" 2>&1; then
    tail -120 "$TASK_DIR/worklets-build.log"; exit 1
  fi
  list_worklets_libraries
  if ! (cd android && ./gradlew :app:assembleDebug --no-parallel -PreactNativeArchitectures=x86_64) \
      > "$TASK_DIR/build.log" 2>&1; then
    tail -120 "$TASK_DIR/build.log"; list_worklets_libraries; exit 1
  fi
  DEVICE_ID=$(adb devices | awk '/emulator-/ {print $1; exit}')
  adb -s "$DEVICE_ID" install -r android/app/build/outputs/apk/debug/app-debug.apk
  adb -s "$DEVICE_ID" reverse tcp:8085 tcp:8085
else
  echo 'Expected ios or android'; exit 1
fi
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:8085/status > /dev/null; then break; fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:8085/status > /dev/null
# Prepare the manifest and the exact bundle the dev client requests before Maestro opens
# it. On cold CI runners these took longer than the dev client waits, failing every flow.
fetch_manifest() {
  curl --fail --silent --show-error --max-time 900 -H "expo-platform: $PLATFORM" \
    -H 'accept: application/expo+json,application/json' http://127.0.0.1:8085/
}
STARTED=$SECONDS
MANIFEST=$(fetch_manifest)
echo "Development manifest ready in $((SECONDS - STARTED))s"
BUNDLE_URL=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).launchAsset?.url ?? "")' "$MANIFEST")
if [[ -z "$BUNDLE_URL" ]]; then echo 'Unable to resolve the development bundle URL'; exit 1; fi
STARTED=$SECONDS
curl --fail --silent --show-error --max-time 900 -o /dev/null "$BUNDLE_URL"
echo "Development bundle ready in $((SECONDS - STARTED))s"
STARTED=$SECONDS
fetch_manifest > /dev/null
echo "Repeat manifest request took $((SECONDS - STARTED))s"
maestro --device "$DEVICE_ID" test .maestro/classroom-ui.yaml .maestro/classroom-join-failure.yaml .maestro/classroom-moderation.yaml .maestro/classroom-student.yaml .maestro/classroom-link-entry.yaml .maestro/classroom-deep-links.yaml .maestro/classroom-export.yaml .maestro/classroom-annotations.yaml .maestro/classroom-media-controls.yaml .maestro/classroom-whiteboard-write.yaml
node scripts/verify-classroom-export.mjs "$PLATFORM" "$DEVICE_ID"

if [ "$PLATFORM" = "android" ]; then
  maestro --device "$DEVICE_ID" test .maestro/classroom-picture-in-picture.yaml
fi

# Exercise the real OS link, encrypted recovery, HTTP client, entry and SDK preview.
node scripts/classroom-link-test-api.mjs > "$TASK_DIR/link-api.log" 2>&1 &
LINK_API_PID=$!
for attempt in $(seq 1 20); do
  if curl --silent --fail http://127.0.0.1:8999/__health > /dev/null; then break; fi
  sleep 1
done
curl --silent --fail http://127.0.0.1:8999/__health > /dev/null
if [[ "$PLATFORM" == android ]]; then adb -s "$DEVICE_ID" reverse tcp:8999 tcp:8999; fi
maestro --device "$DEVICE_ID" test -e RUN_ID="$PLATFORM-${GITHUB_RUN_ID:-local}-$(date +%s)" .maestro/classroom-network-links.yaml
curl --silent --fail http://127.0.0.1:8999/__assert
