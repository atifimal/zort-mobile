import ExpoModulesCore
import UserNotifications

/// Becomes the notification center delegate at launch. This has to happen before launch
/// finishes, so a dismiss or tap that launched the app is delivered to it.
public class PinnedNotificationsAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = PinnedNotificationDelegate.shared
    PinnedNotifier.shared.registerCategory()
    return true
  }
}
