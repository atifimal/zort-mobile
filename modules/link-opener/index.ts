import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';

export type PrivateBrowser = { packageName: string; label: string };

declare class LinkOpenerNativeModule extends NativeModule {
  getPrivateBrowser(): Promise<PrivateBrowser | null>;
  openPrivate(url: string, packageName: string): Promise<void>;
}

// Android only: iOS has no way to open a link in a private tab of Safari or another browser
const native = requireOptionalNativeModule<LinkOpenerNativeModule>('LinkOpener');

/**
 * The default browser, when it can open a link in a private tab (an Ephemeral Custom Tab:
 * history, cookies and cache are wiped when it's closed). Null when it can't, or on iOS.
 */
export async function getPrivateBrowser(): Promise<PrivateBrowser | null> {
  if (!native) return null;
  return native.getPrivateBrowser().catch(() => null);
}

export function openInPrivateTab(url: string, browser: PrivateBrowser): Promise<void> {
  if (!native) return Promise.reject(new Error('Private tabs are not available on this platform'));
  return native.openPrivate(url, browser.packageName);
}
