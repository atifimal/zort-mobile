package expo.modules.quickadd

import android.content.Context
import android.text.format.DateFormat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date

/** Due times as the app shows them (task-format.ts formatDue), for the widget and reminders. */
object TaskFormat {
  /** Today / Tomorrow / Yesterday, a weekday within the coming week, or a date; then the time. */
  fun due(context: Context, due: Long, now: Long): String {
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
          year(day) == year(today) -> "EEEdMMM"
          else -> "dMMMyyyy"
        }
        SimpleDateFormat(DateFormat.getBestDateTimePattern(locale, skeleton), locale).format(date)
      }
    }
    // The phone's 12 or 24 hour setting
    val time = DateFormat.getTimeFormat(context).format(date)
    return context.getString(R.string.tasks_widget_day_time, name, time)
  }

  private fun year(time: Long) = Calendar.getInstance().run {
    timeInMillis = time
    get(Calendar.YEAR)
  }
}
