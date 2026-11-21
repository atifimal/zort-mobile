package expo.modules.pinnednotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** The Unpin and Delete buttons of a note's expanded notification. */
class NotificationActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(EXTRA_NOTE_ID) ?: return
    val action = NoteAction.from(intent.getStringExtra(EXTRA_ACTION)) ?: return
    PinnedNotifier(context).onAction(id, action)
  }

  companion object {
    const val EXTRA_NOTE_ID = "noteId"
    const val EXTRA_ACTION = "action"
  }
}
