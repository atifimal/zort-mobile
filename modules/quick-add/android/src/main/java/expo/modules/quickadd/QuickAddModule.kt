package expo.modules.quickadd

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
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
  @Field val body: String = ""
  @Field val due: Double? = null
  @Field val reminder: Int? = null
  @Field val repeats: Boolean = false
  @Field val createdAt: Double = 0.0
  @Field val upcoming: List<UpcomingRecord> = emptyList()
  @Field val ends: Boolean = true

  fun toTask() = WidgetTask(
    id = id,
    title = title,
    body = body,
    due = due?.toLong(),
    reminder = reminder,
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

    /** The tasks still to do, for the Tasks widget and their reminders; redraws the widget. */
    AsyncFunction("syncTasks") { tasks: List<WidgetTaskRecord> ->
      val reminders = TaskReminders(context)
      // Reminders already due under the old list go out first; a new task whose reminder time
      // has passed doesn't get one
      reminders.deliverDue()
      TaskStore(context).replaceAll(tasks.map { it.toTask() })
      reminders.update()
      TasksWidgetProvider.refresh(context)
    }

    AsyncFunction("canScheduleExactAlarms") {
      TaskReminders(context).canBeExact()
    }

    AsyncFunction("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.startActivity(
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
    }

    AsyncFunction("getPendingTaskCompletions") {
      TaskStore(context).pendingCompletions().map { (id, times) -> mapOf("id" to id, "at" to times.map { it.toDouble() }) }
    }

    AsyncFunction("acknowledgeTaskCompletions") { ids: List<String> ->
      TaskStore(context).acknowledgeCompletions(ids)
    }
  }
}
