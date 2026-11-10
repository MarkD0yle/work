/* Lightweight in-app navigation.
 *
 * Pages render standalone inside <main> with no props, so a page (like the
 * File Gallery) can't call App's setActiveSlug directly. Instead it fires a
 * window CustomEvent that App listens for. Keeps the page signature clean and
 * avoids threading a router through everything. */

const NAV_EVENT = "app:navigate";

/** Optional hand-off for the destination page, e.g. a search query. */
export type NavParams = Record<string, string>;

let pending: { slug: string; params: NavParams } | null = null;

export function navigateToPage(slug: string, params?: NavParams) {
  if (typeof window === "undefined") return;
  pending = params ? { slug, params } : null;
  window.dispatchEvent(new CustomEvent<string>(NAV_EVENT, { detail: slug }));
}

/** Read the params handed to `slug` by the last navigation, if any.
 * Pure, so it is safe in a useState initialiser (StrictMode runs those
 * twice). Call `clearNavParams` from an effect once they are consumed. */
export function peekNavParams(slug: string): NavParams {
  return pending?.slug === slug ? pending.params : {};
}

export function clearNavParams() {
  pending = null;
}

/** Subscribe to navigation requests. Returns an unsubscribe function. */
export function onNavigate(handler: (slug: string) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(NAV_EVENT, listener);
  return () => window.removeEventListener(NAV_EVENT, listener);
}
