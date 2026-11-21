import Foundation
import UserNotifications

/// Receives notification events for the whole app (set as the center's delegate at launch).
final class PinnedNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
  static let shared = PinnedNotificationDelegate()

  /// Set while JS listens for `onNoteOpen`. Accessed on the main thread only.
  var openHandler: ((String) -> Void)? {
    didSet { flushPendingOpen() }
  }
  private var pendingOpenNoteId: String?

  /// A note the user opened from a notification before JS was listening (cold start).
  func consumePendingOpen() -> String? {
    let id = pendingOpenNoteId
    pendingOpenNoteId = nil
    return id
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if notification.request.content.categoryIdentifier == PinnedNotifier.categoryId {
      // In the app: straight into Notification Center, no banner over the screen being used
      completionHandler([.list])
    } else {
      completionHandler([.banner, .list, .sound])
    }
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let request = response.notification.request
    guard request.content.categoryIdentifier == PinnedNotifier.categoryId else {
      completionHandler()
      return
    }

    switch response.actionIdentifier {
    case UNNotificationDismissActionIdentifier:
      PinnedNotifier.shared.onDismissed(id: request.identifier, completion: completionHandler)
    case UNNotificationDefaultActionIdentifier:
      DispatchQueue.main.async {
        self.pendingOpenNoteId = request.identifier
        self.flushPendingOpen()
        completionHandler()
      }
    default:
      completionHandler()
    }
  }

  private func flushPendingOpen() {
    guard let handler = openHandler, let id = pendingOpenNoteId else { return }
    pendingOpenNoteId = nil
    handler(id)
  }
}
