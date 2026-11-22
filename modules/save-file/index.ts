import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';

declare class SaveFileNativeModule extends NativeModule {
  saveAs(name: string, mimeType: string, content: string): Promise<string | null>;
}

// Android only: iOS saves files through the share sheet ("Save to Files")
const native = requireOptionalNativeModule<SaveFileNativeModule>('SaveFile');

/** Whether "Save as" is available here (Android). */
export const canSaveAs = native !== null;

/**
 * Opens the system's "Save as" screen with `name` filled in, and writes `content` (UTF-8) to
 * the file the user chooses. Resolves with the file's final name, or null if they backed out.
 */
export async function saveFileAs(name: string, mimeType: string, content: string): Promise<string | null> {
  if (!native) throw new Error('Save as is not available on this platform');
  return native.saveAs(name, mimeType, content);
}
