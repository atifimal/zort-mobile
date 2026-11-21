package expo.modules.pinnednotifications

/**
 * Lets the receivers, which run outside React Native, tell the module (and so the app, when
 * it's running) that a notification's Unpin or Delete was tapped.
 */
object PinnedNotificationEvents {
  @Volatile
  var onAction: (() -> Unit)? = null

  fun notifyAction() {
    onAction?.invoke()
  }
}
