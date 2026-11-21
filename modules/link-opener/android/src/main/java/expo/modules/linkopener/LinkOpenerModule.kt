package expo.modules.linkopener

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsIntent
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Opens links in a private tab of the default browser, where the browser allows it.
 *
 * Android has no general "open in incognito" intent, and Chrome only honours its own Incognito
 * extra for Google's apps. What third-party apps can use is an Ephemeral Custom Tab (Chrome 136+):
 * a tab of the default browser whose history, cookies, cache and logins are wiped when it's
 * closed. It's offered only when the default browser reports support for it.
 */
class LinkOpenerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LinkOpener")

    /** The default browser, if it can open private tabs: { packageName, label }; otherwise null. */
    AsyncFunction("getPrivateBrowser") {
      val packageName = defaultBrowser() ?: return@AsyncFunction null
      val supported = try {
        CustomTabsClient.isEphemeralBrowsingSupported(context, packageName)
      } catch (e: Exception) {
        false
      }
      if (!supported) return@AsyncFunction null
      mapOf("packageName" to packageName, "label" to label(packageName))
    }

    AsyncFunction("openPrivate") { url: String, packageName: String ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val tab = CustomTabsIntent.Builder()
        .setEphemeralBrowsingEnabled(true)
        .setShowTitle(true)
        .build()
      tab.intent.setPackage(packageName)
      try {
        tab.launchUrl(activity, Uri.parse(url))
      } catch (e: Exception) {
        throw CodedException("ERR_OPEN_PRIVATE", "Could not open a private tab: ${e.message}", e)
      }
    }.runOnQueue(Queues.MAIN)
  }

  /** The browser that opens web links, or null when the user hasn't picked one (the chooser would show). */
  private fun defaultBrowser(): String? {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com"))
    val resolved = context.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    val packageName = resolved?.activityInfo?.packageName ?: return null
    return if (packageName == "android") null else packageName
  }

  private fun label(packageName: String): String = try {
    val info = context.packageManager.getApplicationInfo(packageName, 0)
    context.packageManager.getApplicationLabel(info).toString()
  } catch (e: PackageManager.NameNotFoundException) {
    packageName
  }
}
