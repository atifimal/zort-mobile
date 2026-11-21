import { getLocales } from 'expo-localization';

const en = {
  pinNoteTitle: 'Pin Note',
  homeSubtitle: 'Your tools',
  pinNoteDescription: 'Pin notes to your notifications. They stay there until you delete them.',
  pinNoteEmpty: 'No notes pinned yet',
  pinNoteCountOne: '1 note pinned',
  pinNoteCountMany: '{n} notes pinned',
  notificationsOff: 'Notifications are off',
  newNote: 'New note',
  editNote: 'Edit note',
  titlePlaceholder: 'Title',
  bodyPlaceholder: 'Description (optional)',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  deleteNote: 'Delete note',
  deleteConfirmTitle: 'Delete this note?',
  deleteConfirmMessage: 'Its notification will be removed too.',
  discardTitle: 'Discard changes?',
  discardMessage: 'Your changes to this note will be lost.',
  discard: 'Discard',
  keepEditing: 'Keep editing',
  titleRequired: 'Give the note a title.',
  emptyTitle: 'No notes yet',
  emptyMessage: 'Each note you add stays in your notifications until you delete it here.',
  addFirstNote: 'Add a note',
  permissionTitle: 'Notifications are off',
  permissionMessage: 'Your notes are saved, but they can’t appear in notifications until you allow them.',
  permissionAction: 'Turn on',
  noteNotFound: 'This note no longer exists.',
  saveFailed: 'The note could not be saved.',
  deleteFailed: 'The note could not be deleted.',
  pinnedHint: 'Shown in notifications',
  countOne: '1 note',
  countMany: '{n} notes',
  addNote: 'Add note',
} as const;

type Strings = { [K in keyof typeof en]: string };

const tr: Strings = {
  pinNoteTitle: 'Pin Note',
  homeSubtitle: 'Araçların',
  pinNoteDescription: 'Notlarını bildirimlere iğnele. Sen silene kadar orada kalırlar.',
  pinNoteEmpty: 'Henüz iğnelenmiş not yok',
  pinNoteCountOne: '1 not iğnelendi',
  pinNoteCountMany: '{n} not iğnelendi',
  notificationsOff: 'Bildirimler kapalı',
  newNote: 'Yeni not',
  editNote: 'Notu düzenle',
  titlePlaceholder: 'Başlık',
  bodyPlaceholder: 'Açıklama (isteğe bağlı)',
  save: 'Kaydet',
  cancel: 'Vazgeç',
  delete: 'Sil',
  deleteNote: 'Notu sil',
  deleteConfirmTitle: 'Bu not silinsin mi?',
  deleteConfirmMessage: 'Bildirimi de kaldırılacak.',
  discardTitle: 'Değişiklikler silinsin mi?',
  discardMessage: 'Bu notta yaptığın değişiklikler kaybolacak.',
  discard: 'Sil',
  keepEditing: 'Düzenlemeye devam et',
  titleRequired: 'Nota bir başlık ver.',
  emptyTitle: 'Henüz not yok',
  emptyMessage: 'Eklediğin her not, buradan silene kadar bildirimlerinde kalır.',
  addFirstNote: 'Not ekle',
  permissionTitle: 'Bildirimler kapalı',
  permissionMessage: 'Notların kaydediliyor ama izin verene kadar bildirimlerde görünemez.',
  permissionAction: 'Aç',
  noteNotFound: 'Bu not artık yok.',
  saveFailed: 'Not kaydedilemedi.',
  deleteFailed: 'Not silinemedi.',
  pinnedHint: 'Bildirimlerde gösteriliyor',
  countOne: '1 not',
  countMany: '{n} not',
  addNote: 'Not ekle',
};

const dictionaries: Record<string, Strings> = { en, tr };

const language = getLocales()[0]?.languageCode ?? 'en';
const strings: Strings = dictionaries[language] ?? en;

export function t(key: keyof Strings, params?: Record<string, string | number>): string {
  let text = strings[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  }
  return text;
}
