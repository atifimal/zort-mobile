package expo.modules.pinnednotifications

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Posts one notification per pinned note, while the note is inside its time window.
 *
 * The notifications are "ongoing", so "Clear all" leaves them alone and on Android 13 and
 * older they can't be swiped away at all. From Android 14 on, the system lets the user swipe
 * ongoing notifications away anyway, so each one also carries a delete intent: when it's
 * dismissed, [NotificationDismissedReceiver] posts it again for as long as it should be shown.
 *
 * Time windows: a notification with an end time is given a timeout, so the system removes it
 * at that moment. Start times (and the end again, as a safety net) are handled by an alarm
 * set for the next start or end among all notes, which runs [refresh].
 */
class PinnedNotifier(context: Context) {
  private val context = context.applicationContext
  private val manager = NotificationManagerCompat.from(this.context)
  private val store = PinnedNoteStore(this.context)

  /** Notifications can be shown: permission granted, app not blocked, channel not muted to "none". */
  fun canNotify(): Boolean {
    if (!manager.areNotificationsEnabled()) return false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = manager.getNotificationChannel(CHANNEL_ID)
      if (channel != null && channel.importance == NotificationManager.IMPORTANCE_NONE) return false
    }
    return true
  }

  /**
   * Makes the shade match [notes]: removes notifications of notes that are gone or outside
   * their window, and posts only the notes that are new, changed, or missing from the shade.
   * Re-posting unchanged notes is avoided because the system rate-limits notification updates.
   *
   * Notes with an Unpin or Delete still waiting for the app are left out: the list may have
   * been read before the app applied it.
   */
  fun sync(notes: List<PinnedNote>) {
    val pending = store.pendingActions().keys
    val pinned = notes.filter { it.id !in pending }
    val previous = store.all().associateBy { it.id }
    store.replaceAll(pinned)
    update(pinned) { note, shown -> previous[note.id] != note || !shown }
  }

  /** Brings the shade up to date with the clock: after an alarm, a reboot, an app update, a clock change. */
  fun refresh() {
    update(store.all()) { _, shown -> !shown }
  }

  /** Called when the user dismissed [id]'s notification: brings it back if it should still be shown. */
  fun onDismissed(id: String) {
    val note = store.get(id) ?: return
    val now = System.currentTimeMillis()
    // The timeout that removes a note at its end time may land a moment early; that's not a swipe
    if (note.endsAt != null && note.endsAt - now < END_GRACE_MS) return
    if (note.isShownAt(now)) post(note, now)
  }

  /** Unpin or Delete tapped on [id]'s notification. */
  fun onAction(id: String, action: NoteAction) {
    store.recordAction(id, action)
    cancel(id)
    scheduleNextChange(store.all(), System.currentTimeMillis())
    PinnedNotificationEvents.notifyAction()
  }

  private fun update(notes: List<PinnedNote>, shouldPost: (PinnedNote, shown: Boolean) -> Boolean) {
    val now = System.currentTimeMillis()
    val visible = notes.filter { it.isShownAt(now) }
    val wanted = visible.map { it.id }.toSet()
    val shown = shownTags()

    shown.filter { it !in wanted }.forEach { cancel(it) }
    visible.forEach { if (shouldPost(it, it.id in shown)) post(it, now) }

    scheduleNextChange(notes, now)
  }

  @SuppressLint("MissingPermission") // checked by canNotify()
  private fun post(note: PinnedNote, now: Long) {
    if (!canNotify()) return
    ensureChannel()

    try {
      manager.notify(note.id, NOTIFICATION_ID, build(note, now, summary = false))
      manager.notify(note.id, SUMMARY_ID, build(note, now, summary = true))
    } catch (e: SecurityException) {
      // Permission was revoked between canNotify() and notify(); the next sync will retry.
    }
  }

  /**
   * Each note is a group of its own: the note plus a summary for it. From Android 16 the
   * system folds an app's ungrouped notifications (and groups without a summary) into one
   * collapsed "autogroup" as soon as there are two, which hides every note but the first.
   * A group with a single child is drawn as that child alone, so the summary never shows.
   */
  private fun build(note: PinnedNote, now: Long, summary: Boolean) =
    NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_pinned_note)
      .setColor(ACCENT_COLOR)
      .setContentTitle(note.title)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(false)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      // Newest note first, matching the list in the app
      .setSortKey(String.format("%019d", Long.MAX_VALUE - note.sortKey))
      .setGroup("$GROUP_PREFIX${note.id}")
      .setGroupSummary(summary)
      .setContentIntent(openIntent(note))
      .apply {
        if (note.body.isNotBlank()) {
          setContentText(note.body)
          setStyle(NotificationCompat.BigTextStyle().bigText(note.body))
        }
        // Removed by the system exactly at the end time, even if the alarm runs late
        note.endsAt?.let { setTimeoutAfter((it - now).coerceAtLeast(1)) }
        // Only the note itself: dismissing it dismisses its summary too
        if (!summary) {
          setDeleteIntent(dismissIntent(note.id))
          addAction(0, context.getString(R.string.pinned_note_action_unpin), actionIntent(note.id, NoteAction.UNPIN))
          addAction(0, context.getString(R.string.pinned_note_action_delete), actionIntent(note.id, NoteAction.DELETE))
        }
      }
      .build()

  private fun cancel(id: String) {
    manager.cancel(id, NOTIFICATION_ID)
    manager.cancel(id, SUMMARY_ID)
  }

  private fun shownTags(): Set<String> {
    val system = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    return system.activeNotifications
      .filter { it.id == NOTIFICATION_ID && it.tag != null }
      .map { it.tag }
      .toSet()
  }

  /**
   * One alarm, at the next start or end among [notes]. Exact when the app may set exact
   * alarms (granted by default up to Android 13); otherwise the system may run it a few
   * minutes late while the phone is idle. Ends are covered precisely by the timeout anyway.
   */
  private fun scheduleNextChange(notes: List<PinnedNote>, now: Long) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val intent = PendingIntent.getBroadcast(
      context,
      0,
      Intent(context, RestoreNotificationsReceiver::class.java).setAction(RestoreNotificationsReceiver.ACTION_REFRESH),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val next = notes.flatMap { listOfNotNull(it.startsAt, it.endsAt) }.filter { it > now }.minOrNull()
    if (next == null) {
      alarms.cancel(intent)
      return
    }
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()
    try {
      if (exact) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, intent)
      else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, intent)
    } catch (e: SecurityException) {
      // Exact alarms were revoked in the meantime
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, intent)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    // Low importance: shown in the shade and status bar, but never makes a sound or pops up,
    // which matters because a dismissed note is re-posted immediately. Creating an existing
    // channel again only updates its name and description (for a language change).
    val channel = NotificationChannel(
      CHANNEL_ID,
      context.getString(R.string.pinned_notes_channel_name),
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = context.getString(R.string.pinned_notes_channel_description)
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun openIntent(note: PinnedNote): PendingIntent {
    val intent = note.url?.let {
      Intent(Intent.ACTION_VIEW, Uri.parse(it)).setPackage(context.packageName)
    } ?: context.packageManager.getLaunchIntentForPackage(context.packageName)
    ?: Intent()
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(
      context,
      note.id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun dismissIntent(id: String): PendingIntent {
    val intent = Intent(context, NotificationDismissedReceiver::class.java)
      // A distinct data URI per note keeps the PendingIntents apart even if hash codes collide
      .setData(Uri.fromParts("pinned-note", id, null))
      .putExtra(NotificationDismissedReceiver.EXTRA_NOTE_ID, id)
    return PendingIntent.getBroadcast(
      context,
      id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun actionIntent(id: String, action: NoteAction): PendingIntent {
    val intent = Intent(context, NotificationActionReceiver::class.java)
      .setData(Uri.fromParts("pinned-note-${action.value}", id, null))
      .putExtra(NotificationActionReceiver.EXTRA_NOTE_ID, id)
      .putExtra(NotificationActionReceiver.EXTRA_ACTION, action.value)
    return PendingIntent.getBroadcast(
      context,
      id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  companion object {
    const val CHANNEL_ID = "pinned_notes"
    private const val NOTIFICATION_ID = 7319
    private const val SUMMARY_ID = 7320
    private const val GROUP_PREFIX = "pinned-note:"
    private const val ACCENT_COLOR = 0xFF0969DA.toInt()
    private const val END_GRACE_MS = 5_000L
  }
}
