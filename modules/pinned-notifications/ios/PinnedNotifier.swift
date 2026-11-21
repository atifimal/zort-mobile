import Foundation
import UserNotifications

/// Posts one notification per pinned note, while the note is inside its time window.
///
/// iOS has no notifications the user can't dismiss. The closest is a category with
/// `.customDismissAction`: iOS then tells the app (launching it in the background if needed)
/// when a notification is dismissed, and the note is posted again for as long as it should be
/// shown. The app also re-posts missing notes every time it comes to the foreground.
///
/// Time windows: a note that starts later is scheduled with a trigger, so iOS delivers it on
/// time even while the app is closed. iOS can't remove a delivered notification at a set time,
/// so a note whose window has ended goes away the next time the app runs (or when it's
/// dismissed, as it's then not posted again).
final class PinnedNotifier {
  static let shared = PinnedNotifier()
  static let categoryId = "pinned-note"
  static let unpinActionId = "pinned-note.unpin"
  static let deleteActionId = "pinned-note.delete"

  let store = PinnedNoteStore()
  private let center = UNUserNotificationCenter.current()

  /// Set while JS listens for `onNoteAction`. Called on any thread.
  var actionHandler: (() -> Void)?

  private init() {}

  func registerCategory() {
    let turkish = Locale.preferredLanguages.first?.hasPrefix("tr") ?? false
    let unpin = UNNotificationAction(
      identifier: Self.unpinActionId,
      title: turkish ? "İğneyi kaldır" : "Unpin",
      options: []
    )
    let delete = UNNotificationAction(
      identifier: Self.deleteActionId,
      title: turkish ? "Sil" : "Delete",
      options: [.destructive]
    )
    let category = UNNotificationCategory(
      identifier: Self.categoryId,
      actions: [unpin, delete],
      intentIdentifiers: [],
      options: [.customDismissAction]
    )
    center.setNotificationCategories([category])
  }

  /// Makes Notification Center match `notes`: removes notifications of notes that are gone or
  /// whose window has ended, posts the notes that are new, changed or missing, and schedules
  /// the ones that start later. Notes with an Unpin or Delete still waiting for the app are
  /// left out: the list may have been read before the app applied it.
  func sync(_ notes: [PinnedNote], completion: @escaping () -> Void) {
    let pending = store.pendingActions()
    let pinned = notes.filter { pending[$0.id] == nil }
    let previous = Dictionary(store.all().map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    store.replaceAll(pinned)

    center.getDeliveredNotifications { delivered in
      self.center.getPendingNotificationRequests { requests in
        let now = Date()
        let shown = Set(
          delivered
            .filter { $0.request.content.categoryIdentifier == Self.categoryId }
            .map(\.request.identifier)
        )
        let scheduled = Set(
          requests
            .filter { $0.content.categoryIdentifier == Self.categoryId }
            .map(\.identifier)
        )

        let wanted = Set(pinned.filter { !$0.hasEnded(at: now) }.map(\.id))
        let stale = Array(shown.union(scheduled).union(previous.keys).subtracting(wanted))
        if !stale.isEmpty {
          self.center.removeDeliveredNotifications(withIdentifiers: stale)
          self.center.removePendingNotificationRequests(withIdentifiers: stale)
        }

        let group = DispatchGroup()
        for note in pinned where wanted.contains(note.id) {
          let changed = previous[note.id] != note
          if let start = note.startDate(after: now) {
            // Still to start: a notification shown for an earlier window of the note goes
            if shown.contains(note.id) { self.center.removeDeliveredNotifications(withIdentifiers: [note.id]) }
            guard changed || !scheduled.contains(note.id) else { continue }
            group.enter()
            self.post(note, at: start) { group.leave() }
          } else if changed || !shown.contains(note.id) {
            group.enter()
            self.post(note, at: nil) { group.leave() }
          }
        }
        group.notify(queue: .main, execute: completion)
      }
    }
  }

  /// The user dismissed `id`'s notification: bring it back if it should still be shown.
  func onDismissed(id: String, completion: @escaping () -> Void) {
    guard let note = store.get(id), note.isShown(at: Date()) else {
      completion()
      return
    }
    post(note, at: nil, completion: completion)
  }

  /// Unpin or Delete tapped on `id`'s notification.
  func onAction(_ action: NoteAction, id: String, completion: @escaping () -> Void) {
    store.record(action, for: id)
    center.removeDeliveredNotifications(withIdentifiers: [id])
    center.removePendingNotificationRequests(withIdentifiers: [id])
    actionHandler?()
    completion()
  }

  func permissionStatus(completion: @escaping (String) -> Void) {
    center.getNotificationSettings { settings in
      switch settings.authorizationStatus {
      case .notDetermined:
        completion("undetermined")
      case .denied:
        completion("denied")
      default:
        completion(settings.alertSetting == .disabled && settings.notificationCenterSetting == .disabled ? "denied" : "granted")
      }
    }
  }

  func requestPermission(completion: @escaping (String) -> Void) {
    center.requestAuthorization(options: [.alert]) { _, _ in
      self.permissionStatus(completion: completion)
    }
  }

  /// Delivers `note` now, or at `date` when it starts later.
  private func post(_ note: PinnedNote, at date: Date?, completion: @escaping () -> Void) {
    registerCategory()

    let content = UNMutableNotificationContent()
    content.title = note.title
    content.body = note.body
    content.categoryIdentifier = Self.categoryId
    // Its own thread, so each note is a separate notification instead of one stack
    content.threadIdentifier = note.id
    content.userInfo = ["noteId": note.id]
    content.sound = nil
    // Passive: goes into Notification Center without lighting the screen or making a sound,
    // which matters because a dismissed note comes straight back.
    content.interruptionLevel = .passive

    let trigger = date.map {
      UNTimeIntervalNotificationTrigger(timeInterval: max(1, $0.timeIntervalSinceNow), repeats: false)
    }
    let request = UNNotificationRequest(identifier: note.id, content: content, trigger: trigger)
    center.add(request) { _ in completion() }
  }
}
