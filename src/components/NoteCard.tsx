import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { Note } from '@/lib/db';
import { radius, spacing, useColors } from '@/lib/theme';

type Props = {
  note: Note;
  onPress: (note: Note) => void;
  onLongPress: (note: Note) => void;
};

export const NoteCard = memo(function NoteCard({ note, onPress, onLongPress }: Props) {
  const colors = useColors();

  return (
    <Pressable
      onPress={() => onPress(note)}
      onLongPress={() => onLongPress(note)}
      accessibilityRole="button"
      accessibilityLabel={note.body ? `${note.title}. ${note.body}` : note.title}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {note.title}
      </Text>
      {note.body ? (
        <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={3}>
          {note.body}
        </Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  title: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 21 },
});
