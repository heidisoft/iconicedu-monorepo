import React
import UIKit

// Apps built with the iOS 27 SDK must adopt the UIScene life cycle. The app
// delegate still owns the React Native factory; this delegate owns the window
// and forwards URLs and user activities to the app delegate so Expo
// subscribers and RCTLinkingManager keep receiving them.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    // Scene launches no longer put the opening URL or activity in the launch
    // options, so rebuild them for Linking.getInitialURL().
    var launchOptions = appDelegate.launchOptions ?? [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType: activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)

    // Expo's dev launcher consumes URLs through its app-delegate subscriber,
    // separately from React Native's initial URL. UIScene does not deliver a
    // cold-launch URL to application(_:open:options:), so forward it explicitly
    // once the factory has initialized the launcher.
    if !connectionOptions.urlContexts.isEmpty {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    }
    for activity in connectionOptions.userActivities {
      self.scene(scene, continue: activity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let context = URLContexts.first else { return }
    var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    options[.sourceApplication] = context.options.sourceApplication
    options[.annotation] = context.options.annotation
    options[.openInPlace] = context.options.openInPlace
    _ = appDelegate?.application(UIApplication.shared, open: context.url, options: options)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }
}
