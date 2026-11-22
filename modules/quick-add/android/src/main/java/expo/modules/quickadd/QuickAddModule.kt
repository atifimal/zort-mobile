package expo.modules.quickadd

import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class QuickAddModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QuickAdd")

    /** Closes the quick-add window (and nothing else: the app's own screen is left alone). */
    AsyncFunction("close") {
      (appContext.currentActivity as? QuickAddActivity)?.finish()
    }.runOnQueue(Queues.MAIN)
  }
}
