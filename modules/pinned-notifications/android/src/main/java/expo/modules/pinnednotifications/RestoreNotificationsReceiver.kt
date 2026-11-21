package expo.modules.pinnednotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Brings the shade up to date when it may be out of step: notifications and alarms don't
 * survive a reboot or an app update, a clock or time zone change moves every time window,
 * and the alarm set for the next start or end of a note's window.
 */
class RestoreNotificationsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      ACTION_REFRESH -> PinnedNotifier(context).refresh()
    }
  }

  companion object {
    const val ACTION_REFRESH = "expo.modules.pinnednotifications.REFRESH"
  }
}
