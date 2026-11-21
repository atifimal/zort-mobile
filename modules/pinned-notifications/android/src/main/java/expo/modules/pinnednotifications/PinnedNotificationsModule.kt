package expo.modules.pinnednotifications

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class PinnedNoteRecord : Record {
  @Field val id: String = ""
  @Field val title: String = ""
  @Field val body: String = ""
  @Field val url: String? = null
  @Field val sortKey: Double = 0.0

  fun toNote() = PinnedNote(id, title, body, url, sortKey.toLong())
}

class PinnedNotificationsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PinnedNotifications")

    // iOS only (Android opens notes through the deep link in the notification's content intent),
    // declared here so the JS API is the same on both platforms.
    Events("onNoteOpen")

    AsyncFunction("sync") { notes: List<PinnedNoteRecord> ->
      PinnedNotifier(context).sync(notes.map { it.toNote() })
    }

    AsyncFunction("getPermissionStatus") {
      if (PinnedNotifier(context).canNotify()) "granted" else "denied"
    }

    // The runtime permission prompt is shown from JS (PermissionsAndroid).
    AsyncFunction("requestPermission") {
      if (PinnedNotifier(context).canNotify()) "granted" else "denied"
    }

    AsyncFunction("consumePendingNoteOpen") {
      null as String?
    }
  }
}
