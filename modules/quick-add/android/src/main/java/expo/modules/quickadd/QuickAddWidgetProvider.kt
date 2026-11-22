package expo.modules.quickadd

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Build
import android.util.SizeF
import android.widget.RemoteViews

/**
 * The "Quick add" home screen widget: one button for each thing the app can add. A button opens
 * [QuickAddActivity] with that type; the widget itself has no state, so it never needs updating
 * after it's placed.
 */
class QuickAddWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, widgetIds: IntArray) {
    for (id in widgetIds) manager.updateAppWidget(id, views(context))
  }

  private fun views(context: Context): RemoteViews {
    val regular = layout(context, R.layout.quick_add_widget)
    // Android 12+ picks the layout that fits: icons only when the widget is narrow
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return regular
    val compact = layout(context, R.layout.quick_add_widget_compact)
    return RemoteViews(mapOf(SizeF(40f, 40f) to compact, SizeF(230f, 40f) to regular))
  }

  private fun layout(context: Context, layoutId: Int) =
    RemoteViews(context.packageName, layoutId).apply {
      for ((viewId, type) in BUTTONS) setOnClickPendingIntent(viewId, pendingIntent(context, type))
    }

  private fun pendingIntent(context: Context, type: String): PendingIntent =
    PendingIntent.getActivity(
      context,
      // One per type, or they'd all share the first one's extras
      type.hashCode(),
      QuickAddActivity.intent(context, type),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  companion object {
    // The values are the `type` the quick-add window understands (src/quick-add)
    private val BUTTONS = listOf(
      R.id.quick_add_pin_note to "pin-note",
      R.id.quick_add_note to "note",
      R.id.quick_add_link to "link",
    )
  }
}
