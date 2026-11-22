import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';
import { BackHandler } from 'react-native';

declare class QuickAddNativeModule extends NativeModule {
  close(): Promise<void>;
}

// Android only: the widget and its quick-add window
const native = requireOptionalNativeModule<QuickAddNativeModule>('QuickAdd');

/** What the widget's buttons add; `type` of the QuickAdd component. */
export type QuickAddType = 'pin-note' | 'link' | 'note';

/** Closes the quick-add window. */
export function closeQuickAdd() {
  if (native) native.close().catch(() => BackHandler.exitApp());
  else BackHandler.exitApp();
}
