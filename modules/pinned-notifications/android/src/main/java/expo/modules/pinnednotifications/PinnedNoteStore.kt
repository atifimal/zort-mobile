package expo.modules.pinnednotifications

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class PinnedNote(
  val id: String,
  val title: String,
  val body: String,
  val url: String?,
  val sortKey: Long,
  /** Shown from this time on (ms since epoch); null: right away. */
  val startsAt: Long? = null,
  /** Shown until this time (ms since epoch); null: until unpinned. */
  val endsAt: Long? = null,
) {
  fun isShownAt(time: Long) = (startsAt == null || time >= startsAt) && (endsAt == null || time < endsAt)

  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("title", title)
    .put("body", body)
    .put("url", url ?: JSONObject.NULL)
    .put("sortKey", sortKey)
    .put("startsAt", startsAt ?: JSONObject.NULL)
    .put("endsAt", endsAt ?: JSONObject.NULL)

  companion object {
    fun fromJson(json: JSONObject) = PinnedNote(
      id = json.getString("id"),
      title = json.optString("title"),
      body = json.optString("body"),
      url = if (json.isNull("url")) null else json.optString("url"),
      sortKey = json.optLong("sortKey"),
      startsAt = if (json.isNull("startsAt")) null else json.optLong("startsAt"),
      endsAt = if (json.isNull("endsAt")) null else json.optLong("endsAt"),
    )
  }
}

/** Unpin or Delete, tapped on a note's notification. */
enum class NoteAction(val value: String) {
  UNPIN("unpin"),
  DELETE("delete");

  companion object {
    fun from(value: String?) = entries.firstOrNull { it.value == value }
  }
}

/**
 * The pinned notes (each shown in the shade while inside its time window), and the actions
 * taken on their notifications that the app hasn't applied to its own data yet.
 *
 * Kept natively (not only in the JS database) so that the receivers can update the shade
 * without starting React Native. Actions are queued for the app instead of written to its
 * database: expo-sqlite ships its own copy of SQLite, and writing the same file through
 * Android's copy in the same process is a documented way to corrupt a WAL database.
 */
class PinnedNoteStore(context: Context) {
  private val prefs = context.applicationContext
    .getSharedPreferences("pinned_notifications", Context.MODE_PRIVATE)

  @Synchronized
  fun all(): List<PinnedNote> {
    val raw = prefs.getString(KEY_NOTES, null) ?: return emptyList()
    return try {
      val array = JSONArray(raw)
      (0 until array.length()).map { PinnedNote.fromJson(array.getJSONObject(it)) }
    } catch (e: Exception) {
      emptyList()
    }
  }

  fun get(id: String): PinnedNote? = all().firstOrNull { it.id == id }

  @Synchronized
  fun replaceAll(notes: List<PinnedNote>) {
    val array = JSONArray()
    notes.forEach { array.put(it.toJson()) }
    // commit, not apply: a receiver may read this right after the process is woken
    prefs.edit().putString(KEY_NOTES, array.toString()).commit()
  }

  @Synchronized
  fun pendingActions(): Map<String, NoteAction> {
    val raw = prefs.getString(KEY_ACTIONS, null) ?: return emptyMap()
    return try {
      val json = JSONObject(raw)
      json.keys().asSequence()
        .mapNotNull { id -> NoteAction.from(json.optString(id))?.let { id to it } }
        .toMap()
    } catch (e: Exception) {
      emptyMap()
    }
  }

  /** Takes the note out of the pinned list and queues [action] for the app. */
  @Synchronized
  fun recordAction(id: String, action: NoteAction) {
    val actions = pendingActions().toMutableMap()
    // Delete wins: a note that was unpinned and then deleted must end up deleted
    if (actions[id] != NoteAction.DELETE) actions[id] = action
    replaceAll(all().filter { it.id != id })
    saveActions(actions)
  }

  @Synchronized
  fun acknowledgeActions(ids: Collection<String>) {
    saveActions(pendingActions() - ids.toSet())
  }

  private fun saveActions(actions: Map<String, NoteAction>) {
    val json = JSONObject()
    actions.forEach { (id, action) -> json.put(id, action.value) }
    prefs.edit().putString(KEY_ACTIONS, json.toString()).commit()
  }

  private companion object {
    const val KEY_NOTES = "notes"
    const val KEY_ACTIONS = "pending_actions"
  }
}
