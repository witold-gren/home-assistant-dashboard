// Media queries that never fail: WebKit gives `null` from matchMedia in a document whose frame is gone (a preview frame
// of the editor just replaced, a page of the app being closed) while its last render still runs. Such a document then
// matches nothing and hears no changes, instead of throwing.

const NOTHING = Object.freeze({ matches: false, media: "", addEventListener() {}, removeEventListener() {} });

/** The MediaQueryList of a query, or one that matches nothing when the browser gives none. */
export function mediaQuery(query) {
  return globalThis.window?.matchMedia?.(query) ?? NOTHING;
}

/** Whether the screen matches a query now. */
export const mediaMatches = (query) => Boolean(mediaQuery(query).matches);
