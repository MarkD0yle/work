/* Lightweight in-app navigation.
 *
 * Pages render standalone inside <main> with no props, so a page (like the
 * File Gallery) can't call App's setActiveSlug directly. Instead it fires a
 * window CustomEvent that App listens for. Keeps the page signature clean and
 * avoids threading a router through everything. */

const NAV_EVENT = "app:navigate";

export function navigateToPage(slug: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(NAV_EVENT, { detail: slug }));
}

/** Subscribe to navigation requests. Returns an unsubscribe function. */
export function onNavigate(handler: (slug: string) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(NAV_EVENT, listener);
  return () => window.removeEventListener(NAV_EVENT, listener);
}
