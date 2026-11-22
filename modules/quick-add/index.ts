import { NativeModule, requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';
import { BackHandler } from 'react-native';

/** A task as the Tasks widget shows it (only tasks still to do are sent). */
export type WidgetTask = {
  id: string;
  title: string;
  /** ms since epoch; null: no date */
  due: number | null;
  repeats: boolean;
  createdAt: number;
  /**
   * A repeating task's next occurrences, in order, so checking it off on the widget can move it
   * to the next one while the app isn't running.
   */
  upcoming: { due: number; occurrence: number }[];
  /** Whether the series ends with `upcoming`. */
  ends: boolean;
};

/** Tasks checked off on the widget, not yet applied by the app: when each tap happened. */
export type TaskCompletion = { id: string; at: number[] };

type Events = { onTaskCompleted(): void };

declare class QuickAddNativeModule extends NativeModule<Events> {
  close(): Promise<void>;
  syncTasks(tasks: WidgetTask[]): Promise<void>;
  getPendingTaskCompletions(): Promise<TaskCompletion[]>;
  acknowledgeTaskCompletions(ids: string[]): Promise<void>;
}

// Android only: the widgets and the quick-add window
const native = requireOptionalNativeModule<QuickAddNativeModule>('QuickAdd');

/** What the widgets' buttons add; `type` of the QuickAdd component. */
export type QuickAddType = 'pin-note' | 'link' | 'note' | 'task';

/** Closes the quick-add window. */
export function closeQuickAdd() {
  if (native) native.close().catch(() => BackHandler.exitApp());
  else BackHandler.exitApp();
}

/**
 * Gives the Tasks widget the tasks still to do, and redraws it. Tasks checked off on the widget
 * that the app hasn't acknowledged yet keep the widget's own state, so a list read before the
 * tap was applied can't bring them back.
 */
export async function syncTasksWidget(tasks: WidgetTask[]): Promise<void> {
  await native?.syncTasks(tasks);
}

export async function getPendingTaskCompletions(): Promise<TaskCompletion[]> {
  return (await native?.getPendingTaskCompletions()) ?? [];
}

export async function acknowledgeTaskCompletions(ids: string[]): Promise<void> {
  if (ids.length > 0) await native?.acknowledgeTaskCompletions(ids);
}

/** A task was checked off on the widget while the app is running. */
export function addTaskCompletionListener(listener: () => void): EventSubscription {
  return native?.addListener('onTaskCompleted', listener) ?? { remove() {} };
}
