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
) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("title", title)
    .put("body", body)
    .put("url", url ?: JSONObject.NULL)
    .put("sortKey", sortKey)

  companion object {
    fun fromJson(json: JSONObject) = PinnedNote(
      id = json.getString("id"),
      title = json.optString("title"),
      body = json.optString("body"),
      url = if (json.isNull("url")) null else json.optString("url"),
      sortKey = json.optLong("sortKey"),
    )
  }
}

/**
 * The notes that should currently be in the notification shade.
 *
 * Kept natively (not only in the JS database) so that the dismiss and boot receivers can
 * put notifications back without starting React Native.
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

  private companion object {
    const val KEY_NOTES = "notes"
  }
}
