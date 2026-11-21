import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Note } from '@/lib/db';
import { t } from '@/lib/i18n';
import { formatDateTime, pinStatus, type PinStatus } from '@/lib/pin-status';
import { radius, spacing, useColors } from '@/lib/theme';

import { FavoriteButton } from './FavoriteButton';
import { Icon } from './Icon';

type Props = {
  note: Note;
  now: number;
  onPress: (note: Note) => void;
  onLongPress: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onToggleFavorite: (note: Note) => void;
};

/** What the card says about the note's notification; nothing when it's simply always shown. */
function statusText(note: Note, status: PinStatus): string | null {
  switch (status) {
    case 'off':
      return t('statusOff');
    case 'upcoming':
      return t('statusStarts', { date: formatDateTime(note.window!.start) });
    case 'active':
      return t('statusUntil', { date: formatDateTime(note.window!.end) });
    case 'ended':
      return t('statusEnded', { date: formatDateTime(note.window!.end) });
    case 'always':
      return null;
  }
}

export const NoteCard = memo(function NoteCard({
  note,
  now,
  onPress,
  onLongPress,
  onTogglePin,
  onToggleFavorite,
}: Props) {
  const colors = useColors();
  const status = pinStatus(note, now);
  const shown = status === 'always' || status === 'active';
  const statusLine = statusText(note, status);

  return (
    <Pressable
      onPress={() => onPress(note)}
      onLongPress={() => onLongPress(note)}
      accessibilityRole="button"
      accessibilityLabel={[note.title, note.body, statusLine].filter(Boolean).join('. ')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {note.title}
        </Text>
        {note.body ? (
          <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={3}>
            {note.body}
          </Text>
        ) : null}
        {statusLine ? (
          <View style={styles.status}>
            {status === 'upcoming' || status === 'active' ? (
              <Icon name="clock" size={13} color={status === 'active' ? colors.accent : colors.textTertiary} />
            ) : null}
            <Text
              style={[styles.statusText, { color: status === 'active' ? colors.accent : colors.textTertiary }]}
              numberOfLines={1}
            >
              {statusLine}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.buttons}>
        <FavoriteButton favorite={note.favorite} onPress={() => onToggleFavorite(note)} />
        {/* Its own target: pin or unpin without opening the note */}
        <Pressable
          onPress={() => onTogglePin(note)}
          hitSlop={8}
          accessibilityRole="switch"
          accessibilityLabel={note.pinned ? t('unpin') : t('pin')}
          accessibilityState={{ checked: note.pinned }}
          style={({ pressed }) => [
            styles.pinButton,
            { backgroundColor: note.pinned ? colors.accentSoft : colors.background, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Icon
            name={note.pinned ? 'pin' : 'pinOff'}
            size={20}
            color={shown ? colors.accent : note.pinned ? colors.textSecondary : colors.textTertiary}
          />
        </Pressable>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  texts: { flex: 1, gap: spacing.xs },
  title: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 21 },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  statusText: { flexShrink: 1, fontSize: 13, fontWeight: '500' },
  buttons: { flexDirection: 'row', gap: spacing.xs, marginTop: -spacing.xs, marginRight: -spacing.xs },
  pinButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
