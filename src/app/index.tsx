import { router, type Href } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { backupStatus, toneColor } from '@/components/BackupStatus';
import { Icon, type IconName } from '@/components/Icon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useBackup } from '@/lib/backup';
import { t } from '@/lib/i18n';
import { useLinks } from '@/lib/links-context';
import { useMemos } from '@/lib/memos-context';
import { useNotes } from '@/lib/notes-context';
import { isShown } from '@/lib/pin-status';
import { radius, spacing, useColors } from '@/lib/theme';

type Tool = {
  key: string;
  title: string;
  description: string;
  icon: IconName;
  href: Href;
  status?: string;
  warning?: string;
};

/** Zort's home: the menu of tools. Pin Note is the first; new tools are added to this list. */
export default function HomeScreen() {
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { notes, permission, now } = useNotes();
  const { links } = useLinks();
  const { memos } = useMemos();
  const shownCount = notes.filter((note) => isShown(note, now)).length;

  const tools: Tool[] = [
    {
      key: 'pin-notes',
      title: t('pinNoteTitle'),
      description: t('pinNoteDescription'),
      icon: 'pin',
      href: '/pin-notes',
      status:
        notes.length === 0
          ? t('pinNoteEmpty')
          : shownCount === 0
            ? t('pinNoteNoneShown')
            : shownCount === 1
              ? t('pinNoteCountOne')
              : t('pinNoteCountMany', { n: shownCount }),
      warning: shownCount > 0 && permission !== null && permission !== 'granted' ? t('notificationsOff') : undefined,
    },
    {
      key: 'notes',
      title: t('notesTitle'),
      description: t('notesDescription'),
      icon: 'note',
      href: '/notes',
      status:
        memos.length === 0
          ? t('notesEmpty')
          : memos.length === 1
            ? t('countOne')
            : t('countMany', { n: memos.length }),
    },
    {
      key: 'links',
      title: t('linksTitle'),
      description: t('linksDescription'),
      icon: 'link',
      href: '/links',
      status:
        links.length === 0
          ? t('linksEmpty')
          : links.length === 1
            ? t('linksCountOne')
            : t('linksCountMany', { n: links.length }),
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.header}>
        <Image
          source={dark ? require('../../assets/wordmark-dark.png') : require('../../assets/wordmark-light.png')}
          style={styles.wordmark}
          resizeMode="contain"
          accessible
          accessibilityRole="header"
          accessibilityLabel="Zort"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.themeToggle}>
          <ThemeToggle />
        </View>
      </View>

      <View style={styles.tools}>
        {tools.map((tool) => (
          <ToolCard key={tool.key} tool={tool} />
        ))}
      </View>

      <BackupRow />
    </ScrollView>
  );
}

/** Not a tool: where the data is backed up, and whether it's up to date. */
function BackupRow() {
  const colors = useColors();
  const status = backupStatus(useBackup());
  const color = toneColor(status.tone, colors);

  return (
    <Pressable
      onPress={() => router.push('/backup')}
      accessibilityRole="button"
      accessibilityLabel={`${t('backupRowTitle')}. ${status.text}`}
      style={({ pressed }) => [
        styles.backup,
        { backgroundColor: pressed ? colors.surfacePressed : 'transparent', borderColor: colors.border },
      ]}
    >
      <Icon name={status.icon} size={20} color={color} />
      <View style={styles.cardText}>
        <Text style={[styles.backupTitle, { color: colors.text }]} numberOfLines={1}>
          {t('backupRowTitle')}
        </Text>
        <Text style={[styles.cardStatus, { color }]} numberOfLines={1}>
          {status.text}
        </Text>
      </View>
      <Icon name="chevron" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const colors = useColors();

  return (
    <Pressable
      onPress={() => router.push(tool.href)}
      accessibilityRole="button"
      accessibilityLabel={[tool.title, tool.description, tool.status, tool.warning].filter(Boolean).join('. ')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.cardIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon name={tool.icon} size={20} color={colors.accent} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {tool.title}
        </Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={1}>
          {tool.description}
        </Text>
        <View style={styles.cardMeta}>
          {tool.status ? (
            <Text style={[styles.cardStatus, { color: colors.textTertiary }]}>{tool.status}</Text>
          ) : null}
          {tool.warning ? (
            <View style={[styles.warning, { backgroundColor: colors.warningSurface }]}>
              <Text style={[styles.warningText, { color: colors.warningText }]}>{tool.warning}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Icon name="chevron" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  // The wordmark sits in the middle; the theme switch is pinned to the right without pushing it off-centre
  header: { alignItems: 'center', justifyContent: 'center' },
  // Explicit size (the PNG is 720×362): with only aspectRatio, Android drew it at its pixel size
  wordmark: { width: 168, height: Math.round((168 * 362) / 720) },
  themeToggle: { position: 'absolute', right: 0, top: 0 },
  tools: { gap: spacing.sm + 2 },
  backup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  backupTitle: { fontSize: 15, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardIcon: { width: 40, height: 40, borderRadius: radius.md - 2, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardDescription: { fontSize: 13, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  cardStatus: { fontSize: 13, fontWeight: '500' },
  warning: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  warningText: { fontSize: 12, fontWeight: '600' },
});
