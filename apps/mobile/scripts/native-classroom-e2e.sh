#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PLATFORM="${1:?Expected ios or android}"
TASK_DIR="${RUNNER_TEMP:-/tmp}/iconic-native-e2e"
mkdir -p "$TASK_DIR"
pnpm canvas:build
pnpm exec expo prebuild --no-install > "$TASK_DIR/prebuild.log" 2>&1
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
  sdkmanager 'system-images;android-36;google_apis;x86_64' > "$TASK_DIR/sdk.log" 2>&1
  printf 'no\n' | avdmanager create avd -n IconicClassroomTablet -k 'system-images;android-36;google_apis;x86_64' -d pixel_tablet
  "$ANDROID_HOME/emulator/emulator" -avd IconicClassroomTablet -no-window -no-snapshot -no-audio -gpu swiftshader_indirect > "$TASK_DIR/emulator.log" 2>&1 &
  EMULATOR_PID=$!
  adb wait-for-device
  for attempt in $(seq 1 120); do
    if [[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]; then break; fi
    sleep 2
  done
  [[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]] || { echo 'Emulator did not finish booting'; exit 1; }
  adb shell settings put global window_animation_scale 0
  adb shell settings put global transition_animation_scale 0
  adb shell settings put global animator_duration_scale 0
  if ! (cd android && ./gradlew :app:assembleDebug --no-parallel -PreactNativeArchitectures=x86_64) > "$TASK_DIR/build.log" 2>&1; then
    tail -120 "$TASK_DIR/build.log"; exit 1
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
maestro --device "$DEVICE_ID" test .maestro/classroom-ui.yaml .maestro/classroom-join-failure.yaml .maestro/classroom-moderation.yaml .maestro/classroom-student.yaml .maestro/classroom-link-entry.yaml .maestro/classroom-deep-links.yaml .maestro/classroom-export.yaml .maestro/classroom-annotations.yaml
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
