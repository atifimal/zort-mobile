package expo.modules.quickadd

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/** One of a repeating task's next occurrences: when it's due and which one of the series it is. */
data class UpcomingOccurrence(val due: Long, val occurrence: Int)

/** A task still to do, as the app last sent it (see syncTasksWidget in index.ts). */
data class WidgetTask(
  val id: String,
  val title: String,
  /** ms since epoch; null: no date */
  val due: Long?,
  val repeats: Boolean,
  val createdAt: Long,
  val upcoming: List<UpcomingOccurrence>,
  /** Whether the series ends with [upcoming]. */
  val ends: Boolean,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("title", title)
    .put("due", due ?: JSONObject.NULL)
    .put("repeats", repeats)
    .put("createdAt", createdAt)
    .put("upcoming", JSONArray().apply {
      upcoming.forEach { put(JSONObject().put("due", it.due).put("occurrence", it.occurrence)) }
    })
    .put("ends", ends)

  companion object {
    fun fromJson(json: JSONObject): WidgetTask {
      val upcoming = json.optJSONArray("upcoming") ?: JSONArray()
      return WidgetTask(
        id = json.getString("id"),
        title = json.optString("title"),
        due = if (json.isNull("due")) null else json.optLong("due"),
        repeats = json.optBoolean("repeats"),
        createdAt = json.optLong("createdAt"),
        upcoming = (0 until upcoming.length()).map {
          val item = upcoming.getJSONObject(it)
          UpcomingOccurrence(item.getLong("due"), item.getInt("occurrence"))
        },
        ends = json.optBoolean("ends", true),
      )
    }
  }
}

/**
 * The tasks the widget shows, and the check-offs made on it that the app hasn't applied to its
 * database yet (each with the time it was tapped).
 *
 * Kept natively so the widget can draw and react without starting React Native. Check-offs are
 * queued for the app rather than written to its database: expo-sqlite ships its own copy of
 * SQLite, and opening the same file with Android's copy in the same process can corrupt it.
 */
class TaskStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences("tasks_widget", Context.MODE_PRIVATE)

  @Synchronized
  fun all(): List<WidgetTask> {
    val raw = prefs.getString(KEY_TASKS, null) ?: return emptyList()
    return try {
      val array = JSONArray(raw)
      (0 until array.length()).map { WidgetTask.fromJson(array.getJSONObject(it)) }
    } catch (e: Exception) {
      emptyList()
    }
  }

  /**
   * The app's list. A task checked off here that the app hasn't acknowledged keeps the widget's
   * own state (moved on, or gone): the list may have been read before the tap was applied.
   */
  @Synchronized
  fun replaceAll(tasks: List<WidgetTask>) {
    val pending = pendingCompletions().keys
    val current = all().associateBy { it.id }
    save(tasks.mapNotNull { if (it.id in pending) current[it.id] else it })
  }

  /**
   * Checks a task off at [now], as the app does (task-logic.ts completeTask): a repeating task
   * moves to its first next occurrence that isn't on an earlier day than today; without one, it
   * leaves the widget. Queued for the app either way.
   */
  @Synchronized
  fun complete(id: String, now: Long) {
    val tasks = all()
    val task = tasks.firstOrNull { it.id == id } ?: return
    val today = startOfDay(now)
    val next = if (task.repeats) task.upcoming.indexOfFirst { startOfDay(it.due) >= today } else -1
    val updated = if (next >= 0) {
      val occurrence = task.upcoming[next]
      task.copy(due = occurrence.due, upcoming = task.upcoming.drop(next + 1))
    } else {
      // Done, or a series that goes on past what the widget knows: the app works out where
      null
    }
    save(tasks.mapNotNull { if (it.id == id) updated else it })

    val completions = pendingCompletions().toMutableMap()
    completions[id] = (completions[id] ?: emptyList()) + now
    saveCompletions(completions)
  }

  @Synchronized
  fun pendingCompletions(): Map<String, List<Long>> {
    val raw = prefs.getString(KEY_COMPLETIONS, null) ?: return emptyMap()
    return try {
      val json = JSONObject(raw)
      json.keys().asSequence().associateWith { id ->
        val times = json.getJSONArray(id)
        (0 until times.length()).map { times.getLong(it) }
      }
    } catch (e: Exception) {
      emptyMap()
    }
  }

  @Synchronized
  fun acknowledgeCompletions(ids: Collection<String>) {
    saveCompletions(pendingCompletions() - ids.toSet())
  }

  private fun save(tasks: List<WidgetTask>) {
    val array = JSONArray()
    tasks.forEach { array.put(it.toJson()) }
    // commit, not apply: the widget's list is read right after, possibly in another thread
    prefs.edit().putString(KEY_TASKS, array.toString()).commit()
  }

  private fun saveCompletions(completions: Map<String, List<Long>>) {
    val json = JSONObject()
    completions.forEach { (id, times) -> json.put(id, JSONArray(times)) }
    prefs.edit().putString(KEY_COMPLETIONS, json.toString()).commit()
  }

  companion object {
    private const val KEY_TASKS = "tasks"
    private const val KEY_COMPLETIONS = "completions"

    fun startOfDay(time: Long): Long = Calendar.getInstance().run {
      timeInMillis = time
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      timeInMillis
    }

    fun addDays(day: Long, days: Int): Long = Calendar.getInstance().run {
      timeInMillis = day
      add(Calendar.DAY_OF_MONTH, days)
      timeInMillis
    }
  }
}

/** Lets the widget's check-offs reach the module (and so the app) while it's running. */
object TaskEvents {
  @Volatile
  var onCompleted: (() -> Unit)? = null

  fun notifyCompleted() {
    onCompleted?.invoke()
  }
}
