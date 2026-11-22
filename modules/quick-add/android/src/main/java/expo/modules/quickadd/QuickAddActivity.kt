package expo.modules.quickadd

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.core.view.WindowCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * The quick-add window opened from the widget: the "QuickAdd" React component (registered in
 * index.ts), drawn over whatever is behind it. It shares the app's React Native host, so it
 * uses the same database code, validation and notification syncing as the app.
 */
class QuickAddActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Drawn behind the status and navigation bars like the app, so the scrim covers the whole
    // screen and the sheet reaches the bottom edge (React Native pads it with the insets)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.isNavigationBarContrastEnforced = false
    // No state to restore: a recreated window starts fresh, like a new one
    super.onCreate(null)
    // The scrim fades in with the window; the sheet itself is animated by React Native
    @Suppress("DEPRECATION")
    overridePendingTransition(R.anim.quick_add_fade_in, 0)
  }

  override fun getMainComponentName(): String = COMPONENT

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, COMPONENT, fabricEnabled) {
      // The widget button that was tapped becomes the component's `type` prop
      override fun getLaunchOptions(): Bundle =
        Bundle().apply { putString(EXTRA_TYPE, this@QuickAddActivity.intent?.getStringExtra(EXTRA_TYPE)) }
    }

  /** Another widget button while the window is open: start over with that type. */
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    if (intent.getStringExtra(EXTRA_TYPE) == this.intent?.getStringExtra(EXTRA_TYPE)) return
    setIntent(intent)
    recreate()
  }

  override fun finish() {
    super.finish()
    @Suppress("DEPRECATION")
    overridePendingTransition(0, R.anim.quick_add_fade_out)
  }

  companion object {
    const val COMPONENT = "QuickAdd"
    const val EXTRA_TYPE = "type"

    fun intent(context: Context, type: String): Intent =
      Intent(context, QuickAddActivity::class.java)
        .putExtra(EXTRA_TYPE, type)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
  }
}
