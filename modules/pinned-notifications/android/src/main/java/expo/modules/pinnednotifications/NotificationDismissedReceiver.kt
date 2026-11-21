package expo.modules.pinnednotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Puts a swiped-away note back into the shade, unless it was deleted in the app. */
class NotificationDismissedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(EXTRA_NOTE_ID) ?: return
    PinnedNotifier(context).onDismissed(id)
  }

  companion object {
    const val EXTRA_NOTE_ID = "noteId"
  }
}
