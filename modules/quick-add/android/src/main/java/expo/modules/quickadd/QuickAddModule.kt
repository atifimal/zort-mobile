package expo.modules.quickadd

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class UpcomingRecord : Record {
  @Field val due: Double = 0.0
  @Field val occurrence: Int = 0
}

class WidgetTaskRecord : Record {
  @Field val id: String = ""
  @Field val title: String = ""
  @Field val due: Double? = null
  @Field val repeats: Boolean = false
  @Field val createdAt: Double = 0.0
  @Field val upcoming: List<UpcomingRecord> = emptyList()
  @Field val ends: Boolean = true

  fun toTask() = WidgetTask(
    id = id,
    title = title,
    due = due?.toLong(),
    repeats = repeats,
    createdAt = createdAt.toLong(),
    upcoming = upcoming.map { UpcomingOccurrence(it.due.toLong(), it.occurrence) },
    ends = ends,
  )
}

class QuickAddModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("QuickAdd")

    Events("onTaskCompleted")

    OnStartObserving("onTaskCompleted") {
      TaskEvents.onCompleted = { sendEvent("onTaskCompleted") }
    }

    OnStopObserving("onTaskCompleted") {
      TaskEvents.onCompleted = null
    }

    OnDestroy {
      TaskEvents.onCompleted = null
    }

    /** Closes the quick-add window (and nothing else: the app's own screen is left alone). */
    AsyncFunction("close") {
      (appContext.currentActivity as? QuickAddActivity)?.finish()
    }.runOnQueue(Queues.MAIN)

    /** The tasks still to do, for the Tasks widget; redraws it. */
    AsyncFunction("syncTasks") { tasks: List<WidgetTaskRecord> ->
      TaskStore(context).replaceAll(tasks.map { it.toTask() })
      TasksWidgetProvider.refresh(context)
    }

    AsyncFunction("getPendingTaskCompletions") {
      TaskStore(context).pendingCompletions().map { (id, times) -> mapOf("id" to id, "at" to times.map { it.toDouble() }) }
    }

    AsyncFunction("acknowledgeTaskCompletions") { ids: List<String> ->
      TaskStore(context).acknowledgeCompletions(ids)
    }
  }
}
