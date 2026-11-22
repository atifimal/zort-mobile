package expo.modules.savefile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.FileNotFoundException

/**
 * Saves a text file where the user chooses, through the system's "Save as" screen
 * (ACTION_CREATE_DOCUMENT): Downloads, a memory card, a cloud drive's folder, with the name they
 * like. Unlike picking a folder (ACTION_OPEN_DOCUMENT_TREE), it allows Downloads, which
 * Android 11+ refuses as a folder to pick.
 */
class SaveFileModule : Module() {
  private class Pending(val promise: Promise, val content: String, val name: String)

  private var pending: Pending? = null

  override fun definition() = ModuleDefinition {
    Name("SaveFile")

    /** Resolves with the saved file's name, or null if the user backed out. */
    AsyncFunction("saveAs") { name: String, mimeType: String, content: String, promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      // A second call while the screen is open: the first one is given up
      pending?.promise?.resolve(null)
      pending = Pending(promise, content, name)
      val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
        .addCategory(Intent.CATEGORY_OPENABLE)
        .setType(mimeType)
        .putExtra(Intent.EXTRA_TITLE, name)
      activity.startActivityForResult(intent, REQUEST_CODE)
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val request = pending ?: return@OnActivityResult
      pending = null
      val uri = payload.data?.data
      if (payload.resultCode != Activity.RESULT_OK || uri == null) {
        request.promise.resolve(null)
        return@OnActivityResult
      }
      try {
        write(uri, request.content)
        request.promise.resolve(displayName(uri) ?: request.name)
      } catch (e: Exception) {
        request.promise.reject(SaveFailedException(e))
      }
    }
  }

  private fun write(uri: Uri, content: String) {
    val resolver = appContext.reactContext?.contentResolver ?: throw Exceptions.ReactContextLost()
    // "wt" empties a file the user chose to replace; some providers only know "w"
    val stream = try {
      resolver.openOutputStream(uri, "wt")
    } catch (e: FileNotFoundException) {
      null
    } catch (e: IllegalArgumentException) {
      null
    } ?: resolver.openOutputStream(uri, "w") ?: throw FileNotFoundException(uri.toString())
    stream.use { it.write(content.toByteArray(Charsets.UTF_8)) }
  }

  /** The name the file ended up with: the user may have changed it, or the system added " (1)". */
  private fun displayName(uri: Uri): String? {
    val resolver = appContext.reactContext?.contentResolver ?: return null
    return try {
      resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
      }
    } catch (e: Exception) {
      null
    }
  }

  private class SaveFailedException(cause: Throwable) : CodedException("The file could not be saved", cause)

  private companion object {
    const val REQUEST_CODE = 0x5A7E
  }
}
