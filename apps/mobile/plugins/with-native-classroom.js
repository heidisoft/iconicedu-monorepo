/* Expo config plugins are CommonJS modules loaded by prebuild. */
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  withInfoPlist,
  withEntitlementsPlist,
  withXcodeProject,
  withPodfile,
  withAndroidManifest,
  withMainActivity,
  withMainApplication,
  withAppBuildGradle,
  withGradleProperties,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist');
const group = 'group.com.heidisoft.iconicedu.classroom';
const targetName = 'ClassroomBroadcast';
module.exports = function withNativeClassroom(config) {
  config = withInfoPlist(config, (value) => {
    value.modResults.NSCameraUsageDescription =
      'ICONIC Academy uses your camera when you choose classroom video or take a photo, for example to join a live class or attach an image to a message.';
    value.modResults.NSMicrophoneUsageDescription =
      'ICONIC Academy uses your microphone when you choose classroom audio or record a voice message, for example to speak during a live class.';
    value.modResults.NSBluetoothAlwaysUsageDescription =
      'Use Bluetooth headsets for classroom audio.';
    value.modResults.UIBackgroundModes = [
      ...new Set([...(value.modResults.UIBackgroundModes ?? []), 'audio']),
    ];
    return value;
  });
  config = withEntitlementsPlist(config, (value) => {
    value.modResults['com.apple.security.application-groups'] = [
      ...new Set([
        ...(value.modResults['com.apple.security.application-groups'] ?? []),
        group,
      ]),
    ];
    return value;
  });
  config = withDangerousMod(config, [
    'ios',
    (value) => {
      const folder = path.join(value.modRequest.platformProjectRoot, targetName);
      fs.mkdirSync(folder, { recursive: true });
      fs.copyFileSync(
        path.join(__dirname, 'classroom/ClassroomControls.mm'),
        path.join(
          value.modRequest.platformProjectRoot,
          'ICONICAcademy/ClassroomControls.mm',
        ),
      );
      fs.copyFileSync(
        path.join(__dirname, 'classroom/SampleHandler.mm'),
        path.join(folder, 'SampleHandler.mm'),
      );
      fs.writeFileSync(
        path.join(folder, `${targetName}.entitlements`),
        plist.default.build({ 'com.apple.security.application-groups': [group] }),
      );
      fs.writeFileSync(
        path.join(folder, `${targetName}-Info.plist`),
        plist.default.build({
          CFBundleDisplayName: 'Classroom Screen Share',
          CFBundleExecutable: '$(EXECUTABLE_NAME)',
          CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
          CFBundleName: '$(PRODUCT_NAME)',
          CFBundlePackageType: 'XPC!',
          CFBundleShortVersionString: '$(MARKETING_VERSION)',
          CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
          NSExtension: {
            NSExtensionPointIdentifier: 'com.apple.broadcast-services-upload',
            NSExtensionPrincipalClass: 'SampleHandler',
            NSExtensionAttributes: {
              RPBroadcastProcessMode: 'RPBroadcastProcessModeSampleBuffer',
            },
          },
        }),
      );
      return value;
    },
  ]);
  config = withXcodeProject(config, (value) => {
    const project = value.modResults;
    if (
      !project.hasFile('ICONICAcademy/ClassroomControls.mm') &&
      !project.hasFile('ClassroomControls.mm')
    )
      project.addSourceFile(
        'ICONICAcademy/ClassroomControls.mm',
        { target: project.getFirstTarget().uuid },
        project.getFirstProject().firstProject.mainGroup,
      );
    for (const file of Object.values(project.pbxFileReferenceSection())) {
      if (!file || typeof file !== 'object') continue;
      if (String(file.name).replaceAll('"', '') === 'ClassroomControls.mm')
        file.path = 'ICONICAcademy/ClassroomControls.mm';
      if (String(file.path).endsWith('.mm'))
        file.lastKnownFileType = 'sourcecode.cpp.objcpp';
    }
    const entry = Object.entries(project.pbxNativeTargetSection()).find(
      ([, target]) =>
        target &&
        typeof target === 'object' &&
        String(target.name).replaceAll('"', '') === targetName,
    );
    const existing = entry?.[1];
    project.hash.project.objects.PBXTargetDependency ??= {};
    project.hash.project.objects.PBXContainerItemProxy ??= {};
    const updateVersions = () => {
      for (const item of Object.values(project.pbxXCBuildConfigurationSection())) {
        if (
          item &&
          typeof item === 'object' &&
          item.buildSettings &&
          String(item.buildSettings.PRODUCT_NAME).includes(targetName)
        )
          Object.assign(item.buildSettings, {
            MARKETING_VERSION: config.version,
            CURRENT_PROJECT_VERSION: config.ios.buildNumber ?? '1',
          });
      }
    };
    if (existing) {
      const extensionId = Object.entries(project.pbxNativeTargetSection()).find(
        ([, target]) => target === existing,
      )?.[0];
      if (extensionId && !project.getFirstTarget().firstTarget.dependencies.length)
        project.addTargetDependency(project.getFirstTarget().uuid, [extensionId]);
      updateVersions();
      return value;
    }
    const target = project.addTarget(
      targetName,
      'app_extension',
      targetName,
      `${config.ios.bundleIdentifier}.classroom-broadcast`,
    );
    const groupEntry = project.addPbxGroup(
      ['SampleHandler.mm', `${targetName}-Info.plist`, `${targetName}.entitlements`],
      targetName,
      targetName,
    );
    project.addToPbxGroup(
      groupEntry.uuid,
      project.getFirstProject().firstProject.mainGroup,
    );
    project.addBuildPhase(
      [`${targetName}/SampleHandler.mm`],
      'PBXSourcesBuildPhase',
      'Sources',
      target.uuid,
    );
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
    for (const framework of [
      'ReplayKit',
      'CoreGraphics',
      'CoreVideo',
      'CoreMedia',
      'VideoToolbox',
    ])
      project.addFramework(`${framework}.framework`, { target: target.uuid });
    for (const item of Object.values(project.pbxXCBuildConfigurationSection())) {
      if (
        !item ||
        typeof item !== 'object' ||
        !item.buildSettings ||
        !String(item.buildSettings.PRODUCT_NAME).includes(targetName)
      )
        continue;
      Object.assign(item.buildSettings, {
        CODE_SIGN_ENTITLEMENTS: `${targetName}/${targetName}.entitlements`,
        IPHONEOS_DEPLOYMENT_TARGET: '15.1',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        ENABLE_BITCODE: 'NO',
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        CLANG_CXX_LANGUAGE_STANDARD: '"c++17"',
        MARKETING_VERSION: config.version,
        CURRENT_PROJECT_VERSION: config.ios.buildNumber ?? '1',
        CODE_SIGN_STYLE: 'Automatic',
      });
    }
    return value;
  });
  config = withPodfile(config, (value) => {
    if (!value.modResults.contents.includes(`target '${targetName}'`))
      value.modResults.contents += `\n# Native classroom ReplayKit broadcast extension.\ntarget '${targetName}' do\n  pod 'ZoomVideoSDK/ZoomVideoSDKScreenShare', '2.6.0'\nend\n`;
    return value;
  });
  config = withGradleProperties(config, (value) => {
    const setting = value.modResults.find(
      (item) => item.type === 'property' && item.key === 'android.minSdkVersion',
    );
    if (setting) setting.value = String(Math.max(28, Number(setting.value)));
    else
      value.modResults.push({
        type: 'property',
        key: 'android.minSdkVersion',
        value: '28',
      });
    return value;
  });
  config = withAndroidManifest(config, (value) => {
    const manifest = value.modResults.manifest;
    manifest['uses-permission'] ??= [];
    for (const name of [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.BLUETOOTH_CONNECT',
    ])
      if (!manifest['uses-permission'].some((item) => item.$['android:name'] === name))
        manifest['uses-permission'].push({ $: { 'android:name': name } });
    const app = manifest.application[0];
    app.service ??= [];
    if (!app.service.some((item) => item.$['android:name'] === '.ClassroomAudioService'))
      app.service.push({
        $: {
          'android:name': '.ClassroomAudioService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone|mediaPlayback',
        },
      });
    if (!app.service.some((item) => item.$['android:name'] === '.ClassroomShareService'))
      app.service.push({
        $: {
          'android:name': '.ClassroomShareService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaProjection',
        },
      });
    return value;
  });
  config = withMainApplication(config, (value) => {
    if (!value.modResults.contents.includes('add(ClassroomControlsPackage())'))
      value.modResults.contents = value.modResults.contents.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n              add(ClassroomControlsPackage())',
      );
    return value;
  });
  config = withMainActivity(config, (value) => {
    const marker = '// Native classroom screen capture';
    if (!value.modResults.contents.includes(marker))
      value.modResults.contents = value.modResults.contents.replace(
        'class MainActivity : ReactActivity() {',
        `class MainActivity : ReactActivity() {\n  ${marker}\n  override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {\n    super.onActivityResult(requestCode, resultCode, data)\n    if (requestCode == 1001 && resultCode == android.app.Activity.RESULT_OK && data != null) {\n      val service = android.content.Intent(this, ClassroomShareService::class.java).putExtra("capture", data)\n      startForegroundService(service)\n    }\n  }\n`,
      );
    return value;
  });
  config = withAppBuildGradle(config, (value) => {
    if (!value.modResults.contents.includes('us.zoom.videosdk:zoomvideosdk-core'))
      value.modResults.contents = value.modResults.contents.replace(
        'dependencies {',
        'dependencies {\n    implementation "us.zoom.videosdk:zoomvideosdk-core:2.6.0"',
      );
    return value;
  });
  config = withDangerousMod(config, [
    'android',
    (value) => {
      const folder = path.join(
        value.modRequest.platformProjectRoot,
        'app/src/main/java/com/heidisoft/iconicedu',
      );
      fs.mkdirSync(folder, { recursive: true });
      fs.copyFileSync(
        path.join(__dirname, 'classroom/ClassroomVideoViewManager.kt'),
        path.join(folder, 'ClassroomVideoViewManager.kt'),
      );
      fs.copyFileSync(
        path.join(__dirname, 'classroom/ClassroomAudioService.kt'),
        path.join(folder, 'ClassroomAudioService.kt'),
      );
      fs.copyFileSync(
        path.join(__dirname, 'classroom/ClassroomControlsPackage.kt'),
        path.join(folder, 'ClassroomControlsPackage.kt'),
      );
      fs.copyFileSync(
        path.join(__dirname, 'classroom/ClassroomShareService.kt'),
        path.join(folder, 'ClassroomShareService.kt'),
      );
      return value;
    },
  ]);
  config.extra ??= {};
  config.extra.eas ??= {};
  config.extra.eas.build ??= {};
  config.extra.eas.build.experimental ??= {};
  config.extra.eas.build.experimental.ios ??= {};
  config.extra.eas.build.experimental.ios.appExtensions = [
    {
      targetName,
      bundleIdentifier: `${config.ios.bundleIdentifier}.classroom-broadcast`,
      entitlements: { 'com.apple.security.application-groups': [group] },
    },
  ];
  return config;
};
