import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BackupProvider } from '@/lib/backup';
import { migrate } from '@/lib/db';
import { LinksProvider } from '@/lib/links-context';
import { MemosProvider } from '@/lib/memos-context';
import { NotesProvider } from '@/lib/notes-context';
import { TasksProvider } from '@/lib/tasks-context';
import { applySavedTheme } from '@/lib/theme-preference';

import { QuickAddSheet, type QuickAddItemType } from './QuickAddSheet';
import { TaskQuickAddSheet } from './TaskQuickAddSheet';

// Opened straight from a widget, the app's own screens may never have loaded
applySavedTheme();

const TYPES: readonly QuickAddItemType[] = ['pin-note', 'note', 'link'];

/**
 * The root of the quick-add window (registered as "QuickAdd" in index.ts, shown by the native
 * QuickAddActivity): the Quick add widget's sheet, or with `type` "task", the Tasks widget's.
 * It has its own copies of the app's providers: the same database, and Pin Note's notifications
 * and the Tasks widget are synced from here as from the app.
 */
export function QuickAddRoot({ type }: { type?: string | null }) {
  const itemType = TYPES.find((item) => item === type) ?? 'pin-note';

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="zort.db" onInit={migrate}>
        <BackupProvider>
          <NotesProvider>
            <LinksProvider>
              <MemosProvider>
                <TasksProvider>
                  {type === 'task' ? <TaskQuickAddSheet /> : <QuickAddSheet initialType={itemType} />}
                </TasksProvider>
              </MemosProvider>
            </LinksProvider>
          </NotesProvider>
        </BackupProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
