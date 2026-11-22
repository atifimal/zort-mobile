import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  acknowledgeTaskCompletions,
  addTaskCompletionListener,
  getPendingTaskCompletions,
  syncTasksWidget,
} from '@modules/quick-add';
import { getPermissionStatus, requestPermission } from '@modules/pinned-notifications';

import { useDataChanges } from './data-events';
import { setFavorite as setRowFavorite } from './db';
import { completeTask, nextTaskChange, scheduleTask, widgetTask, type TaskInput } from './task-logic';
import { deleteCompletedTasks, deleteTask, insertTask, listTasks, updateTask, type Task } from './tasks-db';

export type { TaskInput } from './task-logic';

/** What checking a task off did: it's done, or (repeating) it moved on to `due`. */
export type CompleteResult = { previous: Task; task: Task };

type TasksContextValue = {
  tasks: Task[];
  loaded: boolean;
  /** The current time, updated at midnight and whenever a task's due time passes. */
  now: number;
  createTask(input: TaskInput): Promise<Task>;
  editTask(id: string, input: TaskInput): Promise<void>;
  /** Checks a task off; a repeating one moves to its next occurrence. */
  complete(id: string): Promise<CompleteResult>;
  /** Back to to-do (a done task), or back to how it was (undoing `complete`). */
  restore(task: Task): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  removeTask(id: string): Promise<void>;
  clearCompleted(): Promise<void>;
};

const TasksContext = createContext<TasksContextValue | null>(null);

// setTimeout fires at once beyond ~24.8 days; later changes are picked up by a later tick
const MAX_TIMER = 24 * 60 * 60_000;

/** A reminder needs a due time; null otherwise. */
const reminderOf = (input: TaskInput, due: number | null) => (due === null ? null : input.reminder);

/** The series has no occurrence left: the editor checks first, so this is a bug if it's thrown. */
export class SeriesOverError extends Error {
  constructor() {
    super('The repeat rule has no occurrence left');
    this.name = 'SeriesOverError';
  }
}

/**
 * The tasks, and keeping the Tasks widget in step with them (Android): after every change, and
 * whenever the app comes back. Tasks checked off on the widget are applied here, as soon as the
 * app is told or the next time it runs.
 */
export function TasksProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now);
  const tasksRef = useRef(tasks);
  const askedThisLaunch = useRef(false);

  // Ask for notifications when a reminder is first set, once per launch, with the system dialog
  // only (if that's no longer allowed, the editor says notifications are off)
  const askForNotifications = useCallback(async (task: Task) => {
    if (task.reminder === null || askedThisLaunch.current) return;
    if ((await getPermissionStatus().catch(() => 'granted')) === 'granted') return;
    askedThisLaunch.current = true;
    await requestPermission({ openSettings: false }).catch(() => null);
  }, []);

  const commit = useCallback((next: Task[]) => {
    tasksRef.current = next;
    setTasks(next);
  }, []);

  const reloadRef = useRef<() => void>(() => {});
  const announce = useDataChanges('tasks', () => reloadRef.current());

  /**
   * Applies the widget's check-offs to the database (each at the time it was tapped, so a
   * repeating task lands where the widget showed it), then confirms them. With `reload`, reads
   * the list even if there was nothing to apply.
   */
  const applyWidgetCompletions = useCallback(
    async ({ reload = false } = {}) => {
      const completions = await getPendingTaskCompletions().catch(() => []);
      if (completions.length === 0 && !reload) return;
      if (completions.length > 0) {
        const byId = new Map((await listTasks(db)).map((task) => [task.id, task]));
        for (const { id, at } of completions) {
          let task = byId.get(id);
          if (!task) continue;
          for (const time of [...at].sort((a, b) => a - b)) {
            if (task.completedAt === null) task = completeTask(task, time);
          }
          await updateTask(db, task);
        }
      }
      commit(await listTasks(db));
      if (completions.length > 0) {
        announce();
        await acknowledgeTaskCompletions(completions.map((item) => item.id)).catch(() => {});
      }
    },
    [db, commit, announce],
  );

  useEffect(() => {
    reloadRef.current = () => {
      applyWidgetCompletions({ reload: true }).catch((error) => console.error('Could not reload tasks', error));
    };
  }, [applyWidgetCompletions]);

  useEffect(() => {
    let cancelled = false;
    // Loads from the database: its state updates happen after awaits, not during the effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyWidgetCompletions({ reload: true })
      .catch((error) => console.error('Could not load tasks', error))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [applyWidgetCompletions]);

  // Checked off on the widget while the app is running
  useEffect(() => {
    const subscription = addTaskCompletionListener(() => {
      applyWidgetCompletions().catch((error) => console.error('Could not apply widget completions', error));
    });
    return () => subscription.remove();
  }, [applyWidgetCompletions]);

  // The widget follows every change, one sync after another so an older list can't win
  const syncChain = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!loaded) return;
    const todo = tasks.filter((task) => task.completedAt === null).map(widgetTask);
    syncChain.current = syncChain.current
      .then(() => syncTasksWidget(todo))
      .catch((error) => console.warn('Could not update the tasks widget', error));
  }, [loaded, tasks]);

  // Re-render at midnight and when a due time passes, so groups and "late" marks stay right
  useEffect(() => {
    const next = nextTaskChange(tasks, now);
    const timer = setTimeout(() => setNow(Date.now()), Math.min(next - Date.now() + 100, MAX_TIMER));
    return () => clearTimeout(timer);
  }, [tasks, now]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setNow(Date.now());
      if (loaded) {
        applyWidgetCompletions().catch((error) => console.error('Could not apply widget completions', error));
      }
    });
    return () => subscription.remove();
  }, [loaded, applyWidgetCompletions]);

  const replace = useCallback(
    (task: Task) => commit(tasksRef.current.map((item) => (item.id === task.id ? task : item))),
    [commit],
  );

  const createTask = useCallback(
    async (input: TaskInput) => {
      const time = Date.now();
      const schedule = scheduleTask(input, time);
      if (!schedule) throw new SeriesOverError();
      const task: Task = {
        id: randomUUID(),
        title: input.title.trim(),
        body: input.body.trim(),
        ...schedule,
        completedAt: null,
        reminder: reminderOf(input, schedule.due),
        favorite: false,
        createdAt: time,
        updatedAt: time,
      };
      await insertTask(db, task);
      commit([task, ...tasksRef.current]);
      announce();
      setNow(time);
      askForNotifications(task).catch(() => {});
      return task;
    },
    [db, commit, announce, askForNotifications],
  );

  const editTask = useCallback(
    async (id: string, input: TaskInput) => {
      const existing = tasksRef.current.find((task) => task.id === id);
      if (!existing) throw new Error(`Task ${id} not found`);
      const time = Date.now();
      const schedule = scheduleTask(input, time, existing);
      if (!schedule) throw new SeriesOverError();
      const task: Task = {
        ...existing,
        title: input.title.trim(),
        body: input.body.trim(),
        ...schedule,
        reminder: reminderOf(input, schedule.due),
        updatedAt: time,
      };
      await updateTask(db, task);
      replace(task);
      announce();
      setNow(time);
      askForNotifications(task).catch(() => {});
    },
    [db, replace, announce, askForNotifications],
  );

  const complete = useCallback(
    async (id: string) => {
      const previous = tasksRef.current.find((task) => task.id === id);
      if (!previous) throw new Error(`Task ${id} not found`);
      const time = Date.now();
      const task = completeTask(previous, time);
      await updateTask(db, task);
      replace(task);
      announce();
      setNow(time);
      return { previous, task };
    },
    [db, replace, announce],
  );

  const restore = useCallback(
    async (snapshot: Task) => {
      const current = tasksRef.current.find((task) => task.id === snapshot.id);
      if (!current) return;
      // To do again, on the occurrence it had: a done task unchecked keeps its date, an undo
      // takes a repeating task back from the next occurrence to the one it was on
      const task: Task = {
        ...current,
        due: snapshot.due,
        occurrence: snapshot.occurrence,
        completedAt: null,
        updatedAt: Date.now(),
      };
      await updateTask(db, task);
      replace(task);
      announce();
      setNow(task.updatedAt);
    },
    [db, replace, announce],
  );

  // Not an edit: updatedAt is unchanged
  const setFavorite = useCallback(
    async (id: string, favorite: boolean) => {
      await setRowFavorite(db, 'tasks', id, favorite);
      commit(tasksRef.current.map((task) => (task.id === id ? { ...task, favorite } : task)));
      announce();
    },
    [db, commit, announce],
  );

  const removeTask = useCallback(
    async (id: string) => {
      await deleteTask(db, id);
      commit(tasksRef.current.filter((task) => task.id !== id));
      announce();
    },
    [db, commit, announce],
  );

  const clearCompleted = useCallback(async () => {
    await deleteCompletedTasks(db);
    commit(tasksRef.current.filter((task) => task.completedAt === null));
    announce();
  }, [db, commit, announce]);

  const value = useMemo(
    () => ({ tasks, loaded, now, createTask, editTask, complete, restore, setFavorite, removeTask, clearCompleted }),
    [tasks, loaded, now, createTask, editTask, complete, restore, setFavorite, removeTask, clearCompleted],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const value = useContext(TasksContext);
  if (!value) throw new Error('useTasks must be used inside TasksProvider');
  return value;
}
