import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { QuickAddType } from '@modules/quick-add';

import { BackupProvider } from '@/lib/backup';
import { migrate } from '@/lib/db';
import { LinksProvider } from '@/lib/links-context';
import { MemosProvider } from '@/lib/memos-context';
import { NotesProvider } from '@/lib/notes-context';
import { applySavedTheme } from '@/lib/theme-preference';

import { QuickAddSheet } from './QuickAddSheet';

// Opened straight from the widget, the app's own screens may never have loaded
applySavedTheme();

const TYPES: readonly QuickAddType[] = ['pin-note', 'note', 'link'];

/**
 * The root of the quick-add window (registered as "QuickAdd" in index.ts, shown by the native
 * QuickAddActivity). It has its own copies of the app's providers: the same database, and Pin
 * Note's notifications are synced from here as from the app.
 */
export function QuickAddRoot({ type }: { type?: string | null }) {
  const initialType = TYPES.find((item) => item === type) ?? 'pin-note';

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="zort.db" onInit={migrate}>
        <BackupProvider>
          <NotesProvider>
            <LinksProvider>
              <MemosProvider>
                <QuickAddSheet initialType={initialType} />
              </MemosProvider>
            </LinksProvider>
          </NotesProvider>
        </BackupProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
