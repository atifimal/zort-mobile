import { router, type Href } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { t } from '@/lib/i18n';
import { useNotes } from '@/lib/notes-context';
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
  const insets = useSafeAreaInsets();
  const { notes, permission } = useNotes();

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
          : notes.length === 1
            ? t('pinNoteCountOne')
            : t('pinNoteCountMany', { n: notes.length }),
      warning: notes.length > 0 && permission !== null && permission !== 'granted' ? t('notificationsOff') : undefined,
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
        <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityIgnoresInvertColors />
        <View>
          <Text style={[styles.brand, { color: colors.text }]} accessibilityRole="header">
            Zort
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('homeSubtitle')}</Text>
        </View>
      </View>

      <View style={styles.tools}>
        {tools.map((tool) => (
          <ToolCard key={tool.key} tool={tool} />
        ))}
      </View>
    </ScrollView>
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
        <Icon name={tool.icon} size={24} color={colors.accent} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{tool.title}</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{tool.description}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xs },
  logo: { width: 56, height: 56 },
  brand: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: -2 },
  tools: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardDescription: { fontSize: 14, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  cardStatus: { fontSize: 13, fontWeight: '500' },
  warning: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  warningText: { fontSize: 12, fontWeight: '600' },
});
