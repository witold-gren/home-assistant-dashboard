// The dashboard as the editor's preview: opened in a frame of the editor with `?hd_preview`, it shows the draft of
// the editor instead of the saved configuration and follows every change of it at once, without saving. A touch
// chooses what it touched in the editor instead of doing it, and the connection of the frame refuses every call of
// a service and every save, so a preview never switches anything in the home. `hd_as` shows it as another person,
// `hd_color` in light or dark.

const SOURCE_KEY = "homeDashboardPreview";
// What a preview may never send: a service call, a script, a save of a configuration or of a person's settings.
const BLOCKED = /^(call_service|execute_script|lovelace\/config\/save|frontend\/set_user_data|config\/.*\/(update|create|delete|remove))/;

const params = () => new URLSearchParams(window.location.search);

/** The editor that opened this page in its frame, or null outside a preview. */
export function previewSource() {
  if (!params().has("hd_preview") || window.parent === window) return null;
  try {
    return window.parent[SOURCE_KEY] ?? null;
  } catch {
    // A frame of another origin: no preview.
    return null;
  }
}

export const previewMode = () => previewSource() !== null;

/** The configuration to show: the editor's draft in a preview, else the one given. */
export function previewStrategy(given) {
  return previewSource()?.strategy ?? given;
}

/** Whose dashboard it is: the person chosen in the editor, else the one signed in. */
export function previewUserId(hass) {
  return (previewMode() && params().get("hd_as")) || hass?.user?.id;
}

/** The settings of the person shown: their own on their own dashboard, none for someone else in a preview. */
export function previewPrefs(prefs) {
  return previewMode() && params().get("hd_as") ? {} : prefs;
}

/** Light or dark chosen in the editor, or null. */
export function previewColorMode() {
  const mode = previewMode() ? params().get("hd_color") : null;
  return ["light", "dark"].includes(mode) ? mode : null;
}

/** Calls `callback(strategy)` on every change of the draft; returns what stops it. */
export function onPreviewChange(callback) {
  const source = previewSource();
  if (!source) return () => {};
  source.listeners.add(callback);
  return () => source.listeners.delete(callback);
}

/** Calls `callback(command)` for what the editor asks of the page (open a block's window); returns what stops it. */
export function onPreviewCommand(callback) {
  const source = previewSource();
  if (!source?.commands) return () => {};
  source.commands.add(callback);
  return () => source.commands.delete(callback);
}

/** What the editor outlines now (see www/editor/highlight.js), for a page that comes in later. */
export const previewHighlight = () => previewSource()?.highlight ?? null;

/** What a touch in the preview chose, for the editor to show in its tree. */
export function previewSelect(target) {
  previewSource()?.select?.(target);
}

/** Refuse what would change the home, on the connection of this frame; once per connection. */
export function guardPreviewConnection(hass) {
  const connection = hass?.connection;
  if (!previewMode() || !connection || connection.homeDashboardGuarded) return;
  for (const name of ["sendMessage", "sendMessagePromise"]) {
    const original = connection[name]?.bind(connection);
    if (!original) continue;
    connection[name] = (message, ...rest) =>
      BLOCKED.test(message?.type ?? "") ? Promise.resolve(null) : original(message, ...rest);
  }
  connection.homeDashboardGuarded = true;
}

/** Whether a message would be refused in a preview (for tests and for the editor to explain). */
export const blockedInPreview = (type) => BLOCKED.test(type ?? "");

/**
 * What a touch landed on, from the path of the event: a tile, a block, a section, a room's link or a status icon,
 * with the room of the page. Null for anything else (the bar, empty space).
 */
export function touchedTarget(path, room) {
  const nodes = path.filter((node) => node instanceof Element);
  const find = (attribute) => nodes.find((node) => node.hasAttribute?.(attribute));
  const tile = find("data-entity") ?? find("data-tile");
  const section = find("data-section")?.getAttribute("data-section") ?? null;
  if (tile) {
    return {
      kind: "tile",
      room,
      section,
      entity: tile.getAttribute("data-entity") || null,
      name: tile.getAttribute("data-tile") || null,
    };
  }
  const shortcut = find("data-shortcut");
  if (shortcut) return { kind: "block", room, name: shortcut.getAttribute("data-shortcut") };
  const roomLink = find("data-room-link") ?? find("data-room");
  if (roomLink) return { kind: "room", room: roomLink.getAttribute("data-room-link") ?? roomLink.getAttribute("data-room") };
  const status = find("data-status");
  if (status) return { kind: "status", room, key: status.getAttribute("data-status") };
  if (section) return { kind: "section", room, section };
  return null;
}
