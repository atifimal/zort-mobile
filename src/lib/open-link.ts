import { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { getPrivateBrowser, openInPrivateTab, type PrivateBrowser } from '@modules/link-opener';

/** In the default browser (http and https links always go there). */
export function openLink(url: string): Promise<void> {
  return Linking.openURL(url);
}

export function openLinkPrivately(url: string, browser: PrivateBrowser): Promise<void> {
  return openInPrivateTab(url, browser);
}

/**
 * The default browser when it can open private tabs, otherwise null. Checked again when the
 * app comes back to the foreground, as the default browser may have been changed meanwhile.
 */
export function usePrivateBrowser(): PrivateBrowser | null {
  const [browser, setBrowser] = useState<PrivateBrowser | null>(null);

  useEffect(() => {
    let active = true;
    const check = () =>
      getPrivateBrowser().then((result) => {
        if (active) setBrowser(result);
      });
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return browser;
}
