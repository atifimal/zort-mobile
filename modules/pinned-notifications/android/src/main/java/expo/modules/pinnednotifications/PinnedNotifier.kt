package expo.modules.pinnednotifications

import android.annotation.SuppressLint
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
 * Posts one notification per note.
 *
 * The notifications are "ongoing", so "Clear all" leaves them alone and on Android 13 and
 * older they can't be swiped away at all. From Android 14 on, the system lets the user swipe
 * ongoing notifications away anyway, so each one also carries a delete intent: when it's
 * dismissed, [NotificationDismissedReceiver] posts it again for as long as the note exists.
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
   * Makes the shade match [notes]: removes notifications of deleted notes, and posts only the
   * notes that are new, changed, or missing from the shade. Re-posting unchanged notes is
   * avoided because the system rate-limits notification updates per app.
   */
  fun sync(notes: List<PinnedNote>) {
    val previous = store.all().associateBy { it.id }
    store.replaceAll(notes)

    val wanted = notes.map { it.id }.toSet()
    val shown = shownTags()
    (shown + previous.keys).filter { it !in wanted }.forEach { cancel(it) }

    notes.forEach { note ->
      if (previous[note.id] != note || note.id !in shown) post(note)
    }
  }

  /** Posts every stored note again, e.g. after a reboot. */
  fun restoreAll() {
    val shown = shownTags()
    store.all().forEach { if (it.id !in shown) post(it) }
  }

  /** Called when the user dismissed [id]'s notification: brings it back if the note still exists. */
  fun onDismissed(id: String) {
    store.get(id)?.let { post(it) }
  }

  @SuppressLint("MissingPermission") // checked by canNotify()
  private fun post(note: PinnedNote) {
    if (!canNotify()) return
    ensureChannel()

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
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
      .setContentIntent(openIntent(note))
      .setDeleteIntent(dismissIntent(note.id))

    if (note.body.isNotBlank()) {
      builder.setContentText(note.body)
      builder.setStyle(NotificationCompat.BigTextStyle().bigText(note.body))
    }

    try {
      manager.notify(note.id, NOTIFICATION_ID, builder.build())
    } catch (e: SecurityException) {
      // Permission was revoked between canNotify() and notify(); the next sync will retry.
    }
  }

  private fun cancel(id: String) = manager.cancel(id, NOTIFICATION_ID)

  private fun shownTags(): Set<String> {
    val system = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    return system.activeNotifications
      .filter { it.id == NOTIFICATION_ID && it.tag != null }
      .map { it.tag }
      .toSet()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    // Low importance: shown in the shade and status bar, but never makes a sound or pops up,
    // which matters because a dismissed note is re-posted immediately.
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

  companion object {
    const val CHANNEL_ID = "pinned_notes"
    private const val NOTIFICATION_ID = 7319
    private const val ACCENT_COLOR = 0xFF0969DA.toInt()
  }
}
