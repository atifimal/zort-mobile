import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

// Android 13+ shows its own confirmation when an app copies to the clipboard
const systemConfirmsCopy = Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 33;

/** Copies `text`; `confirm` shows the app's own message, unless the system already shows one. */
export async function copyText(text: string, confirm: () => void): Promise<void> {
  await Clipboard.setStringAsync(text);
  if (!systemConfirmsCopy) confirm();
}
