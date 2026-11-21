import ExpoModulesCore

struct PinnedNoteRecord: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var body: String = ""
  @Field var url: String? = nil
  @Field var sortKey: Double = 0

  func toNote() -> PinnedNote {
    PinnedNote(id: id, title: title, body: body, url: url, sortKey: sortKey)
  }
}

public class PinnedNotificationsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PinnedNotifications")

    Events("onNoteOpen")

    OnStartObserving("onNoteOpen") {
      DispatchQueue.main.async {
        PinnedNotificationDelegate.shared.openHandler = { [weak self] id in
          self?.sendEvent("onNoteOpen", ["id": id])
        }
      }
    }

    OnStopObserving("onNoteOpen") {
      DispatchQueue.main.async {
        PinnedNotificationDelegate.shared.openHandler = nil
      }
    }

    AsyncFunction("sync") { (notes: [PinnedNoteRecord], promise: Promise) in
      PinnedNotifier.shared.sync(notes.map { $0.toNote() }) {
        promise.resolve(nil)
      }
    }

    AsyncFunction("getPermissionStatus") { (promise: Promise) in
      PinnedNotifier.shared.permissionStatus { promise.resolve($0) }
    }

    AsyncFunction("requestPermission") { (promise: Promise) in
      PinnedNotifier.shared.requestPermission { promise.resolve($0) }
    }

    // On the main queue: the delegate's pending state is only touched there
    AsyncFunction("consumePendingNoteOpen") { () -> String? in
      PinnedNotificationDelegate.shared.consumePendingOpen()
    }.runOnQueue(.main)
  }
}
