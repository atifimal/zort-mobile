// Web addresses typed by hand: "example.com/a" is fine, the https:// is added.
// A small parser of its own rather than URL: React Native's URL doesn't implement hostname.

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const WEB = /^(https?):\/\/([^/?#\s@]+@)?([^/?#\s:@]+)(:\d{1,5})?([/?#][^\s]*)?$/i;

/** The address as it will be saved and opened, or null if it isn't a web address. */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const withScheme = SCHEME.test(text) ? text : `https://${text}`;
  const match = WEB.exec(withScheme);
  if (!match) return null;
  const host = match[3]!.toLowerCase();
  // A real host has a dot (example.com) or is a single known name
  if (!host.includes('.') && host !== 'localhost') return null;
  if (host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null;
  return `${match[1]!.toLowerCase()}://${match[2] ?? ''}${host}${match[4] ?? ''}${match[5] ?? ''}`;
}

/** The host, without "www.", for showing a link without a title. */
export function displayHost(url: string): string {
  const host = WEB.exec(url)?.[3] ?? url;
  return host.replace(/^www\./i, '');
}

/** The address without the scheme and a trailing slash, for the line under the title. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/**
 * The name of the site, roughly: "wikipedia" for en.wikipedia.org, "bbc" for bbc.co.uk.
 * Used for the letter on a link's badge.
 */
export function siteName(url: string): string {
  const labels = displayHost(url).split('.');
  if (labels.length < 2) return labels[0] ?? url;
  const second = labels[labels.length - 2]!;
  // co.uk, com.tr, ...: the name is one label further left
  if (labels.length >= 3 && second.length <= 3) return labels[labels.length - 3]!;
  return second;
}
