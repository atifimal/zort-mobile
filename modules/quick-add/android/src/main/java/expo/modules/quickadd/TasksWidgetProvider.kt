package expo.modules.quickadd

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews

/**
 * The Tasks home screen widget (4×4): the tasks still to do, soonest first, each with a check
 * circle; a + that opens the quick-add window for a task. Its list comes from [TaskStore], which
 * the app fills, less dated tasks due more than a few days out ([TaskStore.shown]); it redraws on every sync, at midnight and when a due time passes (to mark it
 * late), and when the clock, time zone or language changes.
 */
class TasksWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, widgetIds: IntArray) {
    update(context, manager, widgetIds)
  }

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ACTION_REFRESH,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_LOCALE_CHANGED -> refresh(context)
      else -> super.onReceive(context, intent)
    }
  }

  override fun onDisabled(context: Context) {
    // The last Tasks widget was removed
    alarmManager(context).cancel(refreshIntent(context))
  }

  companion object {
    private const val ACTION_REFRESH = "expo.modules.quickadd.TASKS_WIDGET_REFRESH"
    private const val TASKS_URL = "zort://tasks"

    /** Redraws every Tasks widget from the store; does nothing if none is placed. */
    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, TasksWidgetProvider::class.java))
      if (ids.isNotEmpty()) update(context, manager, ids)
    }

    private fun update(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val tasks = TaskStore(context).all()
      val now = System.currentTimeMillis()
      for (id in ids) manager.updateAppWidget(id, views(context, id, tasks, now))
      @Suppress("DEPRECATION")
      manager.notifyAppWidgetViewDataChanged(ids, R.id.tasks_list)
      scheduleRefresh(context, tasks, now)
    }

    private fun views(context: Context, widgetId: Int, all: List<WidgetTask>, now: Long) =
      RemoteViews(context.packageName, R.layout.tasks_widget).apply {
        // Count only what the list shows: tasks due later than a few days out are left off
        val tasks = TaskStore.shown(all, now)
        val today = TaskStore.startOfDay(now)
        val overdue = tasks.count { it.due != null && TaskStore.startOfDay(it.due) < today }
        setTextViewText(
          R.id.tasks_count,
          when (tasks.size) {
            0 -> context.getString(R.string.tasks_widget_all_done)
            1 -> context.getString(R.string.tasks_widget_count_one)
            else -> context.getString(R.string.tasks_widget_count_many, tasks.size)
          },
        )
        setViewVisibility(R.id.tasks_overdue, if (overdue > 0) View.VISIBLE else View.GONE)
        setTextViewText(R.id.tasks_overdue, context.getString(R.string.tasks_widget_overdue, overdue))

        setOnClickPendingIntent(R.id.tasks_header, openUrl(context, TASKS_URL, 0))
        setOnClickPendingIntent(R.id.tasks_add, addTask(context))
        setOnClickPendingIntent(R.id.tasks_empty, addTask(context))

        // The list's rows come from TasksWidgetService; the data URI keeps each widget's adapter apart
        val adapter = Intent(context, TasksWidgetService::class.java)
          .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        adapter.data = Uri.parse(adapter.toUri(Intent.URI_INTENT_SCHEME))
        @Suppress("DEPRECATION")
        setRemoteAdapter(R.id.tasks_list, adapter)
        setEmptyView(R.id.tasks_list, R.id.tasks_empty)
        // Rows fill in what was tapped (check or open) and which task; see TaskWidgetActionActivity
        setPendingIntentTemplate(
          R.id.tasks_list,
          PendingIntent.getActivity(
            context,
            REQUEST_ROW,
            Intent(context, TaskWidgetActionActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
          ),
        )
      }

    private fun addTask(context: Context): PendingIntent =
      PendingIntent.getActivity(
        context,
        REQUEST_ADD,
        QuickAddActivity.intent(context, "task"),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    fun openUrl(context: Context, url: String, requestCode: Int): PendingIntent =
      PendingIntent.getActivity(
        context,
        requestCode,
        openIntent(context, url),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    /** The app at `url` (Expo Router's deep link), in its own task. */
    fun openIntent(context: Context, url: String): Intent =
      Intent(Intent.ACTION_VIEW, Uri.parse(url))
        .setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    /** At the next midnight, or the next due time before it (it turns late): one alarm, inexact. */
    private fun scheduleRefresh(context: Context, tasks: List<WidgetTask>, now: Long) {
      var next = TaskStore.addDays(TaskStore.startOfDay(now), 1)
      for (task in tasks) {
        val due = task.due ?: continue
        if (due in (now + 1) until next) next = due
      }
      // A minute late is fine; inexact alarms need no permission and cost no battery to speak of
      alarmManager(context).set(AlarmManager.RTC, next + 1000, refreshIntent(context))
    }

    private fun refreshIntent(context: Context): PendingIntent =
      PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, TasksWidgetProvider::class.java).setAction(ACTION_REFRESH),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    private fun alarmManager(context: Context) = context.getSystemService(AlarmManager::class.java)

    // Request codes of the widget's activity PendingIntents, apart from the Quick add widget's
    private const val REQUEST_ROW = 7001
    private val REQUEST_ADD = "task".hashCode()
  }
}
