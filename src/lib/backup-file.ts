import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { canSaveAs, saveFileAs } from '@modules/save-file';

import { exportBackup, markFileExported, readBackupFile, type FoundFile } from './backup';
import { BackupInvalidError, backupFileName as fileNameFor } from './backup-format';
import { language, t } from './i18n';

/**
 * The backup as a file, next to (or instead of) Google Drive: saved to a folder the user picks,
 * shared to another app, and read back. The file is the Drive backup's JSON, so the same rules
 * for older and newer versions apply (backup-format.ts).
 */

const MIME = 'application/json';
// Far more than years of notes and tasks; a bigger file isn't a Zort backup
const MAX_BYTES = 20 * 1024 * 1024;

const backupFileName = (time: number) => fileNameFor(time, language === 'tr' ? 'zort-yedek' : 'zort-backup');

/** The system's file picker reports a cancel as an error; it isn't one. */
function isCancel(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return /cancel/i.test(String(code ?? '')) || /cancel/i.test(String(message ?? ''));
}

/** Whether the backup can be saved with "Save as" (Android); elsewhere, use shareBackup. */
export const canSaveToFile = canSaveAs;

/**
 * Saves the backup where the user picks, in the system's "Save as" screen (Downloads, a memory
 * card, a cloud drive's folder…), with the name they like. Returns the file's name, or null if
 * they backed out.
 */
export async function saveBackupToFile(): Promise<string | null> {
  const { text, exportedAt } = await exportBackup();
  const name = await saveFileAs(backupFileName(exportedAt), MIME, text);
  if (name) markFileExported(exportedAt);
  return name;
}

/** Hands the backup file to another app (mail, a messenger, a cloud drive) via the share sheet. */
export async function shareBackup(): Promise<void> {
  const { text, exportedAt } = await exportBackup();
  // In a folder of its own in the cache, emptied each time: the app it's shared to may still be
  // reading the last one, so it isn't deleted right after
  const folder = new Directory(Paths.cache, 'exports');
  if (folder.exists) folder.delete();
  folder.create({ intermediates: true });
  const file = new File(folder, backupFileName(exportedAt));
  file.create();
  await file.write(text);
  // Not counted as the last file backup: there's no telling whether it was sent anywhere
  await Sharing.shareAsync(file.uri, { mimeType: MIME, dialogTitle: t('fileShareTitle') });
}

export const canShare = () => Sharing.isAvailableAsync().catch(() => false);

/**
 * Lets the user pick a backup file and reads it: null if they backed out. Throws
 * BackupInvalidError if it isn't a Zort backup, BackupTooNewError if a newer Zort made it.
 */
export async function pickBackupFile(): Promise<FoundFile | null> {
  let picked: File;
  try {
    // Some file managers and cloud drives label .json files as plain text or as binary
    const result = await File.pickFileAsync({ mimeTypes: [MIME, 'text/*', 'application/octet-stream'] });
    if (result.canceled) return null;
    picked = result.result;
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
  if (picked.size > MAX_BYTES) throw new BackupInvalidError('too large');
  let text: string;
  try {
    text = await picked.text();
  } catch {
    throw new BackupInvalidError('unreadable');
  }
  return readBackupFile(text);
}
