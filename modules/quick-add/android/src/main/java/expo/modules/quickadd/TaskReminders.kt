package expo.modules.quickadd

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject

/**
 * Task reminders: a notification (with sound, shown on top) when a task's reminder time comes,
 * with Done and Snooze. Scheduled natively from [TaskStore], so they come while the app is
 * closed, after a reboot and after the clock changes.
 *
 * One alarm is set, for the next reminder among all tasks. When it goes off, every reminder
 * whose time came since the last check is sent: the check time is kept, so nothing is sent
 * twice and nothing is lost if the alarm comes late (inexact, or the phone was off).
 */
class TaskReminders(context: Context) {
  private val context = context.applicationContext
  private val prefs = this.context.getSharedPreferences("task_reminders", Context.MODE_PRIVATE)
  private val notifications = NotificationManagerCompat.from(this.context)
  private val alarms = this.context.getSystemService(AlarmManager::class.java)

  /** Exact alarms are allowed (always before Android 12; on 14+ only once the user allows them). */
  fun canBeExact(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()

  /** Sends the reminders that have come since the last check, then sets the next alarm. */
  @Synchronized
  fun deliverDue(now: Long = System.currentTimeMillis()) {
    // The first check sends nothing: reminders start from the moment they're first known
    val last = prefs.getLong(KEY_LAST_CHECK, now)
    val tasks = TaskStore(context).all()
    for (task in tasks) {
      val at = task.remindAt ?: continue
      if (at > last && at <= now) show(task, now)
    }
    val snoozes = snoozes().toMutableMap()
    for ((id, at) in snoozes.entries.toList()) {
      if (at > now) continue
      tasks.firstOrNull { it.id == id }?.let { show(it, now) }
      snoozes.remove(id)
    }
    prefs.edit().putLong(KEY_LAST_CHECK, now).putString(KEY_SNOOZES, JSONObject(snoozes.toMap()).toString()).commit()
  }

  /**
   * After the tasks changed: takes down reminders of tasks that are done, deleted or moved to a
   * later time, forgets their snoozes, and sets the alarm for the next reminder.
   */
  @Synchronized
  fun update(now: Long = System.currentTimeMillis()) {
    val tasks = TaskStore(context).all().associateBy { it.id }
    val snoozes = snoozes().filterKeys { it in tasks }
    prefs.edit().putString(KEY_SNOOZES, JSONObject(snoozes).toString()).commit()

    val manager = context.getSystemService(NotificationManager::class.java)
    for (shown in manager.activeNotifications) {
      if (shown.id != NOTIFICATION_ID) continue
      val id = shown.tag ?: continue
      val task = tasks[id]
      val at = task?.remindAt
      if (task == null || at == null || at > now) notifications.cancel(id, NOTIFICATION_ID)
    }

    val next = (tasks.values.mapNotNull { it.remindAt } + snoozes.values).filter { it > now }.minOrNull()
    if (next == null) {
      alarms.cancel(alarmIntent())
      return
    }
    try {
      if (canBeExact()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarmIntent())
      else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarmIntent())
    } catch (e: SecurityException) {
      // Exact alarms were taken back in the meantime
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarmIntent())
    }
  }

  /** Snooze: the reminder goes away and comes back in [SNOOZE_MINUTES]. */
  @Synchronized
  fun snooze(id: String, now: Long = System.currentTimeMillis()) {
    notifications.cancel(id, NOTIFICATION_ID)
    val snoozes = snoozes() + (id to now + SNOOZE_MINUTES * 60_000L)
    prefs.edit().putString(KEY_SNOOZES, JSONObject(snoozes).toString()).commit()
    update(now)
  }

  private fun snoozes(): Map<String, Long> {
    val raw = prefs.getString(KEY_SNOOZES, null) ?: return emptyMap()
    return try {
      val json = JSONObject(raw)
      json.keys().asSequence().associateWith { json.getLong(it) }
    } catch (e: Exception) {
      emptyMap()
    }
  }

  @SuppressLint("MissingPermission")
  private fun show(task: WidgetTask, now: Long) {
    if (!notifications.areNotificationsEnabled()) return
    ensureChannel()
    val due = task.due ?: return
    val text = TaskFormat.due(context, due, now)
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_task)
      .setContentTitle(task.title)
      .setContentText(if (task.body.isBlank()) text else "$text · ${task.body.lineSequence().first()}")
      .setStyle(NotificationCompat.BigTextStyle().bigText(if (task.body.isBlank()) text else "$text\n${task.body}"))
      .setColor(context.getColor(R.color.qa_accent))
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setWhen(due)
      .setShowWhen(true)
      .setAutoCancel(true)
      .setContentIntent(TasksWidgetProvider.openUrl(context, "zort://tasks/${android.net.Uri.encode(task.id)}", requestCode(task.id, 0)))
      .addAction(0, context.getString(R.string.task_reminder_done), action(ACTION_DONE, task.id, 1))
      .addAction(0, context.getString(R.string.task_reminder_snooze, SNOOZE_MINUTES), action(ACTION_SNOOZE, task.id, 2))
      .build()
    notifications.notify(task.id, NOTIFICATION_ID, notification)
  }

  private fun action(action: String, id: String, slot: Int): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      requestCode(id, slot),
      Intent(context, TaskReminderReceiver::class.java).setAction(action).putExtra(EXTRA_ID, id),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  // Each task's open, done and snooze intents apart from each other and from other tasks'
  private fun requestCode(id: String, slot: Int) = id.hashCode() * 4 + slot

  private fun alarmIntent(): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      0,
      Intent(context, TaskReminderReceiver::class.java).setAction(ACTION_ALARM),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    // High importance: makes its sound and shows on top. Creating it again only updates its name
    // and description (for a language change); the user's own settings for it are kept.
    val channel = NotificationChannel(
      CHANNEL_ID,
      context.getString(R.string.task_reminders_channel_name),
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = context.getString(R.string.task_reminders_channel_description)
      enableVibration(true)
    }
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL_ID = "task_reminders"
    private const val NOTIFICATION_ID = 7100
    const val SNOOZE_MINUTES = 10
    const val ACTION_ALARM = "expo.modules.quickadd.TASK_REMINDER_ALARM"
    const val ACTION_DONE = "expo.modules.quickadd.TASK_REMINDER_DONE"
    const val ACTION_SNOOZE = "expo.modules.quickadd.TASK_REMINDER_SNOOZE"
    const val EXTRA_ID = "id"
    private const val KEY_LAST_CHECK = "lastCheck"
    private const val KEY_SNOOZES = "snoozes"

    /**
     * Checks a task off outside the app (the widget, a reminder's Done): the store moves it on
     * and queues it for the app, then the widget, the reminders and the app (if running) follow.
     */
    fun complete(context: Context, id: String) {
      val now = System.currentTimeMillis()
      val reminders = TaskReminders(context)
      reminders.deliverDue(now)
      TaskStore(context).complete(id, now)
      NotificationManagerCompat.from(context).cancel(id, NOTIFICATION_ID)
      reminders.update(now)
      TasksWidgetProvider.refresh(context)
      TaskEvents.notifyCompleted()
    }
  }
}

/** The reminder alarm, the Done and Snooze buttons, and the events after which alarms are set again. */
class TaskReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(TaskReminders.EXTRA_ID)
    when (intent.action) {
      TaskReminders.ACTION_DONE -> if (id != null) TaskReminders.complete(context, id)
      TaskReminders.ACTION_SNOOZE -> if (id != null) TaskReminders(context).snooze(id)
      // The alarm; or a reboot, an app update or a clock change, which drop or move alarms (and
      // after which reminders missed in the meantime are sent); or exact alarms were allowed
      else -> TaskReminders(context).run {
        deliverDue()
        update()
      }
    }
  }
}
