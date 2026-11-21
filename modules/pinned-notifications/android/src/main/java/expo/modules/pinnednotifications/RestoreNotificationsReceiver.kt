package expo.modules.pinnednotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Notifications don't survive a reboot or an app update; this posts the notes again. */
class RestoreNotificationsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED ->
        PinnedNotifier(context).restoreAll()
    }
  }
}
