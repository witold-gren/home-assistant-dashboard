// Load the app afresh. The Home Assistant app can wake from the background with yesterday's code still in memory,
// or keep a copy of a file away from home, where nothing asks for it again. This throws away what the app keeps,
// fetches every file of the dashboard past any cache, and opens the page again.

// Every module of the app, the loader and the bundled libraries. A test keeps this list equal to the folder.
export const APP_FILES = [
  "activity.js",
  "app-frame.js",
  "appearance.js",
  "block-editor.js",
  "builtin-themes.js",
  "chrome.js",
  "controls.js",
  "departures.js",
  "energy.js",
  "host.js",
  "i18n.js",
  "intercom.js",
  "main.js",
  "model.js",
  "news.js",
  "notifications.js",
  "overview.js",
  "page.js",
  "panel.js",
  "prefs.js",
  "press.js",
  "recordings.js",
  "reload.js",
  "room-editor.js",
  "school.js",
  "settings.js",
  "sheet.js",
  "sound.js",
  "status.js",
  "styles.js",
  "talk.js",
  "theme.js",
  "weather.js",
];
const OTHER_FILES = ["../loader.js", "../vendor/lit-all.min.js", "../vendor/js-yaml.js"];

export function appFileUrls(base = import.meta.url) {
  return [...APP_FILES, ...OTHER_FILES].map((file) => new URL(file, base).href);
}

export async function reloadApp({ fetcher = fetch, cacheStorage = globalThis.caches, reload = () => location.reload() } = {}) {
  try {
    for (const key of (await cacheStorage?.keys()) ?? []) await cacheStorage.delete(key);
  } catch {
    // A browser without Cache Storage (or one that refuses it) has nothing kept there.
  }
  // Away from home a file may not come; the page is opened again anyway and takes what it can.
  await Promise.allSettled(appFileUrls().map((url) => fetcher(url, { cache: "reload" })));
  reload();
}
