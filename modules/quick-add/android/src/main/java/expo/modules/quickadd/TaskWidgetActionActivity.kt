package expo.modules.quickadd

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/**
 * Where the Tasks widget's rows lead: an invisible activity that checks a task off (and closes
 * at once) or opens it in the app.
 *
 * An activity, not a broadcast: a widget's list has one click template for all its rows, and
 * opening the app needs an activity launch. Started from the widget, launching one is always
 * allowed; starting the app from a broadcast receiver isn't on recent Android versions.
 */
class TaskWidgetActionActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val id = intent?.getStringExtra(EXTRA_ID)
    if (id != null) {
      when (intent?.getStringExtra(EXTRA_ACTION)) {
        ACTION_COMPLETE -> {
          TaskReminders.complete(this, id)
        }
        ACTION_OPEN -> startActivity(TasksWidgetProvider.openIntent(this, "zort://tasks/${Uri.encode(id)}"))
      }
    }
    finish()
  }

  override fun finish() {
    super.finish()
    @Suppress("DEPRECATION")
    overridePendingTransition(0, 0)
  }

  companion object {
    const val EXTRA_ACTION = "action"
    const val EXTRA_ID = "id"
    const val ACTION_COMPLETE = "complete"
    const val ACTION_OPEN = "open"

    fun fillIn(action: String, id: String): Intent = Intent().putExtra(EXTRA_ACTION, action).putExtra(EXTRA_ID, id)
  }
}
