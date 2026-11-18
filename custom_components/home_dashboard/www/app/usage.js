// How the household uses the dashboard: each page and window opened is told to Home Assistant
// (home_dashboard/activity/seen), which keeps it for 30 days for the owner's panel "Household activity".
// Home Assistant itself keeps no record of what anybody looks at. Nothing is told from the editor's preview.

import { browserModId } from "./camera-window.js";

const SAME_WITHIN_MS = 5000;

const DEVICE_ID_KEY = "home-dashboard-device-id";

/**
 * The dashboard's own id of this device, kept in its browser: a new sign-in to Home Assistant keeps it the same device
 * (its name, its variants). Null where the browser keeps nothing (private browsing); then the sign-in tells.
 */
export function dashboardDeviceId(storage = globalThis.localStorage) {
  try {
    let id = storage?.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`;
      storage.setItem(DEVICE_ID_KEY, id);
    }
    return storage.getItem(DEVICE_ID_KEY) === id ? id : null;
  } catch {
    return null;
  }
}

/** The name Browser Mod has for this device, when someone gave it one (not the id it made up by itself). */
export function browserModName() {
  const named = browserModId();
  return named && !/^browser_mod_[0-9a-f_]+$/i.test(named) ? named : null;
}

/** What device this is, in a few words: the Browser Mod id, or the kind of device and app or browser. */
export function deviceLabel(agent = globalThis.navigator?.userAgent ?? "", touch = globalThis.navigator?.maxTouchPoints ?? 0) {
  const named = browserModId();
  // An id Browser Mod made up by itself (browser_mod_1a2b…) says nothing: the kind of device instead.
  if (named && !/^browser_mod_[0-9a-f_]+$/i.test(named)) return named;
  let kind = "Computer";
  if (/iPad/.test(agent) || (/Macintosh/.test(agent) && touch > 1)) kind = "iPad";
  else if (/iPhone/.test(agent)) kind = "iPhone";
  else if (/Android/.test(agent)) kind = "Android";
  else if (/Macintosh/.test(agent)) kind = "Mac";
  else if (/Windows/.test(agent)) kind = "Windows";
  else if (/Linux/.test(agent)) kind = "Linux";
  return `${kind} (${/Home ?Assistant\//.test(agent) ? "app" : "browser"})`;
}

/** The name of a window of the dashboard: its kind and what it shows ("camera: Iwiny Słup"). */
export function windowName(overlay, hass) {
  if (!overlay) return null;
  if (overlay.type === "drawer") return "menu";
  if (overlay.type === "settings") return "settings";
  const sheet = overlay.sheet ?? {};
  const entity = sheet.entityId ? hass?.states?.[sheet.entityId] : null;
  const title = sheet.title ?? sheet.name ?? sheet.item?.name ?? entity?.attributes?.friendly_name ?? sheet.entityId ?? "";
  return title ? `${sheet.kind}: ${title}` : String(sheet.kind ?? "window");
}

/** Tells Home Assistant once per page or window; the same one again within a few seconds is not told twice. */
export function createUsageReporter(getHass) {
  let last = null;
  let lastAt = 0;
  return (kind, name, extra = {}) => {
    const hass = getHass();
    if (!hass?.callWS || !name) return false;
    const key = `${kind}|${name}|${extra.entity_id ?? ""}`;
    const now = Date.now();
    if (key === last && now - lastAt < SAME_WITHIN_MS) return false;
    last = key;
    lastAt = now;
    const message = { type: "home_dashboard/activity/seen", kind, name: String(name).slice(0, 160), device: deviceLabel() };
    if (extra.page) message.page = String(extra.page).slice(0, 160);
    if (extra.entity_id) message.entity_id = String(extra.entity_id).slice(0, 160);
    // An older integration does not know the command: nothing to tell, nothing to show.
    Promise.resolve(hass.callWS(message)).catch(() => null);
    return true;
  };
}
