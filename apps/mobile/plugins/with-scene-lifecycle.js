/* Expo config plugins are CommonJS modules loaded by prebuild. */
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  withInfoPlist,
  withAppDelegate,
  withXcodeProject,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

// Apps built with the iOS 27 SDK fail to launch unless they adopt the UIScene
// life cycle. Expo SDK 55 still creates the window in the app delegate, so move
// window creation into plugins/scene/SceneDelegate.swift.
const sceneFile = 'ICONICAcademy/SceneDelegate.swift';
const windowBlock =
  /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\([\s\S]*?\)\s*#endif/;
module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (value) => {
    value.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return value;
  });
  config = withAppDelegate(config, (value) => {
    let contents = value.modResults.contents;
    if (!contents.includes('var launchOptions:'))
      contents = contents.replace(
        'var reactNativeFactory: RCTReactNativeFactory?',
        'var reactNativeFactory: RCTReactNativeFactory?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?',
      );
    contents = contents.replace(
      windowBlock,
      '    // SceneDelegate creates the window and starts React Native.\n    self.launchOptions = launchOptions',
    );
    value.modResults.contents = contents;
    return value;
  });
  config = withDangerousMod(config, [
    'ios',
    (value) => {
      fs.copyFileSync(
        path.join(__dirname, 'scene/SceneDelegate.swift'),
        path.join(value.modRequest.platformProjectRoot, sceneFile),
      );
      return value;
    },
  ]);
  config = withXcodeProject(config, (value) => {
    const project = value.modResults;
    if (!project.hasFile(sceneFile) && !project.hasFile('SceneDelegate.swift'))
      project.addSourceFile(
        sceneFile,
        { target: project.getFirstTarget().uuid },
        project.getFirstProject().firstProject.mainGroup,
      );
    return value;
  });
  return config;
};
