import type { BackupState } from '@/lib/backup';
import { t } from '@/lib/i18n';
import { formatDateTime } from '@/lib/pin-status';
import type { Colors } from '@/lib/theme';

import type { IconName } from './Icon';

export type BackupStatus = { icon: IconName; text: string; tone: 'muted' | 'good' | 'busy' | 'bad' };

/** One line on the backup: shown on the home screen and on the Backup screen. */
export function backupStatus(backup: BackupState): BackupStatus {
  if (!backup.account) return { icon: 'cloudOff', text: t('backupOff'), tone: 'muted' };
  if (backup.syncing) return { icon: 'cloudSync', text: t('backupSyncing'), tone: 'busy' };
  if (backup.error) return { icon: 'cloudAlert', text: t('backupErrorShort'), tone: 'bad' };
  if (backup.pending || !backup.lastBackupAt) return { icon: 'cloudSync', text: t('backupPending'), tone: 'busy' };
  return { icon: 'cloudDone', text: t('backupLast', { date: formatDateTime(backup.lastBackupAt) }), tone: 'good' };
}

export function toneColor(tone: BackupStatus['tone'], colors: Colors): string {
  switch (tone) {
    case 'good':
      return colors.accent;
    case 'bad':
      return colors.danger;
    case 'busy':
      return colors.textSecondary;
    case 'muted':
      return colors.textTertiary;
  }
}
