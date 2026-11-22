import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { backupStatus, toneColor } from '@/components/BackupStatus';
import { Icon, type IconName } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import {
  backupErrorMessage,
  backUp,
  checkBackup,
  deleteBackupAndSignOut,
  resolveSignIn,
  restoreBackup,
  signInToBackup,
  signOutOfBackup,
  useBackup,
} from '@/lib/backup';
import type { Counts } from '@/lib/backup-data';
import { t } from '@/lib/i18n';
import { formatDateTime } from '@/lib/pin-status';
import { radius, spacing, useColors } from '@/lib/theme';

type Busy = 'signIn' | 'backUp' | 'restore' | 'signOut' | 'delete' | null;

const countsText = (counts: Counts) =>
  t('backupCounts', { pins: counts.notes, notes: counts.memos, links: counts.links, tasks: counts.tasks });

const failure = (kind: Exclude<Busy, null>, error: unknown) => {
  const message = backupErrorMessage(error);
  if (message) Alert.alert(kind === 'signIn' ? t('backupSignInFailed') : t('backupFailed'), message);
};

/** Google Drive backup: sign in, see when it last ran, back up or restore by hand. */
export default function BackupScreen() {
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const backup = useBackup();
  const { toast, show } = useToast();
  const [busy, setBusy] = useState<Busy>(null);
  const status = backupStatus(backup);

  const run = async (kind: Exclude<Busy, null>, task: () => Promise<void>) => {
    setBusy(kind);
    try {
      await task();
    } catch (error) {
      console.warn(error);
      failure(kind, error);
    } finally {
      setBusy(null);
    }
  };

  const restored = (counts: Counts) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(t('backupRestoredTitle'), countsText(counts));
  };

  const signIn = () =>
    run('signIn', async () => {
      const result = await signInToBackup();
      switch (result.kind) {
        case 'cancelled':
          return;
        case 'backedUp':
          show(t('backupFirstDone'));
          return;
        case 'restored':
          restored(result.counts);
          return;
        case 'choose': {
          const { found } = result;
          // Both have data: nothing is overwritten until the user picks
          const choice = await new Promise<'restore' | 'keepDevice' | 'cancel'>((resolve) =>
            Alert.alert(
              t('backupChooseTitle'),
              t('backupChooseMessage', {
                date: formatDateTime(Date.parse(found.remote.modifiedTime)),
                remote: countsText(found.counts),
                local: countsText(found.local),
              }),
              [
                { text: t('cancel'), style: 'cancel', onPress: () => resolve('cancel') },
                { text: t('backupKeepDevice'), onPress: () => resolve('keepDevice') },
                { text: t('backupKeepDrive'), onPress: () => resolve('restore') },
              ],
              { cancelable: true, onDismiss: () => resolve('cancel') },
            ),
          );
          await resolveSignIn(choice);
          if (choice === 'restore') restored(found.counts);
          else if (choice === 'keepDevice') show(t('backupFirstDone'));
        }
      }
    });

  const backUpNow = () =>
    run('backUp', async () => {
      await backUp();
      // backUp() keeps the error for the status line instead of throwing
    });

  const restore = () =>
    run('restore', async () => {
      const found = await checkBackup();
      if (!found) {
        Alert.alert(t('backupNothing'));
        return;
      }
      const confirmed = await new Promise<boolean>((resolve) =>
        Alert.alert(
          t('backupRestoreTitle'),
          t('backupRestoreMessage', {
            date: formatDateTime(Date.parse(found.remote.modifiedTime)),
            remote: countsText(found.counts),
            local: countsText(found.local),
          }),
          [
            { text: t('cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('backupRestoreAction'), style: 'destructive', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        ),
      );
      if (!confirmed) return;
      await restoreBackup(found);
      restored(found.counts);
    });

  const signOut = () => run('signOut', signOutOfBackup);

  const deleteRemote = () =>
    Alert.alert(t('backupDeleteTitle'), t('backupDeleteMessage'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => run('delete', deleteBackupAndSignOut) },
    ]);

  const account = backup.account;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={[styles.card, styles.intro, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}>
            <Icon name="cloud" size={28} color={colors.accent} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>{t('backupRowTitle')}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{t('backupIntro')}</Text>
        </View>

        {!backup.ready ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : !account ? (
          <View style={styles.signIn}>
            <GoogleSigninButton
              size={GoogleSigninButton.Size.Wide}
              color={dark ? 'dark' : 'light'}
              onPress={signIn}
              disabled={busy !== null}
              accessibilityLabel={t('backupSignIn')}
            />
            {busy === 'signIn' ? <ActivityIndicator color={colors.accent} /> : null}
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.account}>
                {account.photo ? (
                  <Image source={{ uri: account.photo }} style={styles.avatar} accessibilityIgnoresInvertColors />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
                    <Text style={[styles.avatarText, { color: colors.accent }]}>
                      {(account.name ?? account.email).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.accountTexts}>
                  {account.name ? (
                    <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>
                      {account.name}
                    </Text>
                  ) : null}
                  <Text style={[styles.accountEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                    {account.email}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.status} accessibilityLiveRegion="polite">
                {backup.syncing ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <Icon name={status.icon} size={20} color={toneColor(status.tone, colors)} />
                )}
                <View style={styles.statusTexts}>
                  <Text style={[styles.statusText, { color: toneColor(status.tone, colors) }]}>{status.text}</Text>
                  <Text style={[styles.hint, { color: colors.textTertiary }]}>{backup.error ?? t('backupAuto')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <Action
                icon="cloudUpload"
                label={t('backupNow')}
                onPress={backUpNow}
                disabled={busy !== null || backup.syncing}
                busy={busy === 'backUp'}
                primary
              />
              <Action
                icon="cloudDownload"
                label={t('backupRestore')}
                onPress={restore}
                disabled={busy !== null || backup.syncing}
                busy={busy === 'restore'}
              />
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row
                icon="logout"
                label={t('backupSignOut')}
                hint={t('backupSignOutHint')}
                onPress={signOut}
                disabled={busy !== null}
                busy={busy === 'signOut'}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Row
                icon="delete"
                label={t('backupDelete')}
                onPress={deleteRemote}
                disabled={busy !== null}
                busy={busy === 'delete'}
                destructive
              />
            </View>
          </>
        )}
      </ScrollView>
      {toast}
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  disabled,
  busy,
  primary,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled: boolean;
  busy: boolean;
  primary?: boolean;
}) {
  const colors = useColors();
  const foreground = primary ? colors.onAccent : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [
        styles.action,
        primary
          ? { backgroundColor: pressed ? colors.accentPressed : colors.accent }
          : { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border, borderWidth: 1 },
        { opacity: disabled && !busy ? 0.5 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Icon name={icon} size={20} color={primary ? colors.onAccent : colors.accent} />
      )}
      <Text style={[styles.actionText, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Row({
  icon,
  label,
  hint,
  onPress,
  disabled,
  busy,
  destructive,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  disabled: boolean;
  busy: boolean;
  destructive?: boolean;
}) {
  const colors = useColors();
  const color = destructive ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={hint}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Icon name={icon} size={20} color={destructive ? colors.danger : colors.textSecondary} />
      )}
      <View style={styles.rowTexts}>
        <Text style={[styles.rowLabel, { color }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: colors.textTertiary }]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  intro: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  heroIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 18, fontWeight: '700', marginTop: spacing.xs },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  signIn: { alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  accountTexts: { flex: 1, gap: 2 },
  accountName: { fontSize: 16, fontWeight: '600' },
  accountEmail: { fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg },
  statusTexts: { flex: 1, gap: 2 },
  statusText: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md + 2,
  },
  actionText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2, minHeight: 56 },
  rowTexts: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16 },
});
