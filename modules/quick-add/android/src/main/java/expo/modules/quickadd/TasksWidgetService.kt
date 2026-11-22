package expo.modules.quickadd

import android.content.Context
import android.content.Intent
import android.text.format.DateFormat
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import java.text.SimpleDateFormat
import java.util.Date

/** The rows of the Tasks widget's list. */
class TasksWidgetService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = TasksRowFactory(applicationContext)
}

private class TasksRowFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
  private var tasks: List<WidgetTask> = emptyList()
  private var now = System.currentTimeMillis()

  override fun onCreate() {}

  /** Soonest first; tasks without a date after the others, newest first. */
  override fun onDataSetChanged() {
    now = System.currentTimeMillis()
    tasks = TaskStore(context).all().sortedWith(
      compareBy<WidgetTask>({ it.due == null }, { it.due ?: 0L }).thenByDescending { it.createdAt },
    )
  }

  override fun onDestroy() {}

  override fun getCount() = tasks.size

  override fun getViewAt(position: Int): RemoteViews {
    val task = tasks.getOrNull(position) ?: return RemoteViews(context.packageName, R.layout.tasks_widget_item)
    return RemoteViews(context.packageName, R.layout.tasks_widget_item).apply {
      setTextViewText(R.id.task_title, task.title)

      val due = task.due
      val late = due != null && due < now
      val today = due != null && !late && TaskStore.startOfDay(due) == TaskStore.startOfDay(now)
      // Colors are resources in the layout, picked by visibility: resolved here, they'd follow the
      // app's own theme setting instead of the home screen's light or dark mode
      setViewVisibility(R.id.task_meta, if (due != null) View.VISIBLE else View.GONE)
      val label = due?.let { formatDue(it) } ?: ""
      for ((view, shown) in listOf(R.id.task_due to (!late && !today), R.id.task_due_today to today, R.id.task_due_late to late)) {
        setViewVisibility(view, if (shown) View.VISIBLE else View.GONE)
        setTextViewText(view, label)
      }
      setViewVisibility(R.id.task_repeat, if (task.repeats) View.VISIBLE else View.GONE)
      setViewVisibility(R.id.task_ring, if (late) View.GONE else View.VISIBLE)
      setViewVisibility(R.id.task_ring_late, if (late) View.VISIBLE else View.GONE)

      setContentDescription(
        R.id.task_check,
        context.getString(R.string.tasks_widget_mark_done, task.title),
      )
      setOnClickFillInIntent(R.id.task_check, TaskWidgetActionActivity.fillIn(TaskWidgetActionActivity.ACTION_COMPLETE, task.id))
      setOnClickFillInIntent(R.id.task_body, TaskWidgetActionActivity.fillIn(TaskWidgetActionActivity.ACTION_OPEN, task.id))
    }
  }

  override fun getLoadingView(): RemoteViews? = null

  override fun getViewTypeCount() = 1

  override fun getItemId(position: Int) = tasks.getOrNull(position)?.id?.hashCode()?.toLong() ?: position.toLong()

  override fun hasStableIds() = true

  /** As in the app (task-format.ts formatDue): Today / Tomorrow / Yesterday, a weekday, or a date; then the time. */
  private fun formatDue(due: Long): String {
    val locale = context.resources.configuration.locales[0]
    val today = TaskStore.startOfDay(now)
    val day = TaskStore.startOfDay(due)
    val date = Date(due)
    val name = when (day) {
      today -> context.getString(R.string.tasks_widget_today)
      TaskStore.addDays(today, 1) -> context.getString(R.string.tasks_widget_tomorrow)
      TaskStore.addDays(today, -1) -> context.getString(R.string.tasks_widget_yesterday)
      else -> {
        val skeleton = when {
          day > today && day < TaskStore.addDays(today, 7) -> "EEE"
          sameYear(day, today) -> "EEEdMMM"
          else -> "dMMMyyyy"
        }
        SimpleDateFormat(DateFormat.getBestDateTimePattern(locale, skeleton), locale).format(date)
      }
    }
    // The phone's 12 or 24 hour setting
    val time = DateFormat.getTimeFormat(context).format(date)
    return context.getString(R.string.tasks_widget_day_time, name, time)
  }

  private fun sameYear(a: Long, b: Long): Boolean {
    val calendar = java.util.Calendar.getInstance()
    calendar.timeInMillis = a
    val year = calendar.get(java.util.Calendar.YEAR)
    calendar.timeInMillis = b
    return year == calendar.get(java.util.Calendar.YEAR)
  }
}
