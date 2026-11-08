import { BUILTIN_THEMES } from "./builtin-themes.js";

// A theme is the shared look of a dashboard in one file, to be given to another home: the look of
// the page and the buttons, own icons and the backgrounds with their pictures inside. Rooms differ
// from home to home, so whoever imports it chooses where each background goes, if anywhere.

export const THEME_FORMAT = 1;
const SLOTS = ["light", "dark", "light_wide", "dark_wide"];
const isPicture = (value) => typeof value === "string" && /^(\/|https?:)/.test(value);

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// `read` fetches a picture of this Home Assistant and gives back a Blob, or null when it cannot.
export async function buildTheme(raw, names, read, name = "Home Dashboard") {
  const backgrounds = {};
  for (const [key, value] of Object.entries(raw?.backgrounds ?? {})) {
    const entry = { name: names[key] ?? key };
    const source = typeof value === "string" ? { light: value, dark: value } : (value ?? {});
    for (const slot of SLOTS) {
      const item = source[slot];
      if (!item) continue;
      if (!isPicture(item)) {
        entry[slot] = item;
        continue;
      }
      const blob = await read(item);
      if (blob) entry[slot] = await blobToDataUrl(blob);
    }
    if (source.position) entry.position = source.position;
    if (SLOTS.some((slot) => slot in entry)) backgrounds[key] = entry;
  }
  return { home_dashboard_theme: THEME_FORMAT, name, appearance: raw?.appearance ?? {}, backgrounds };
}

// Only what a theme may carry is kept: a picture must be an image inside the file, never an address
// that would make this home load something from elsewhere.
export function parseTheme(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || data.home_dashboard_theme !== THEME_FORMAT) return null;
  const backgrounds = {};
  for (const [key, value] of Object.entries(data.backgrounds ?? {})) {
    if (!value || typeof value !== "object") continue;
    const entry = { name: typeof value.name === "string" ? value.name : key };
    for (const slot of SLOTS) {
      const item = value[slot];
      if (typeof item !== "string") continue;
      const picture = /^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i.test(item);
      const colour = !/^(\/|https?:|data:)/.test(item) && !/url\(|[";{}<>]/i.test(item);
      if (picture || colour) entry[slot] = item;
    }
    if (["top", "center", "bottom"].includes(value.position)) entry.position = value.position;
    if (SLOTS.some((slot) => slot in entry)) backgrounds[key] = entry;
  }
  const appearance = data.appearance && typeof data.appearance === "object" ? data.appearance : {};
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 60) : "";
  return { name, appearance, backgrounds };
}

const simple = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").trim();

// Where each background goes at first: the same page when it exists here, else a room of the same
// name, else nowhere until someone chooses.
export function suggestTargets(theme, targets) {
  const byName = new Map(targets.map((target) => [simple(target.name), target.id]));
  const ids = new Set(targets.map((target) => target.id));
  return Object.fromEntries(
    Object.entries(theme.backgrounds).map(([key, entry]) => [key, ids.has(key) ? key : (byName.get(simple(entry.name)) ?? null)]),
  );
}

// Icons belong to devices, so only those of devices this home also has come along.
export function importableIcons(appearance, exists) {
  return Object.fromEntries(Object.entries(appearance?.icons ?? {}).filter(([entityId]) => exists(entityId)));
}

export function dataUrlToBlob(dataUrl) {
  const [head, body] = dataUrl.split(",");
  const type = head.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bytes = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

// A theme from a file, made a theme of this home: its pictures uploaded, its backgrounds on the
// pages chosen for them and its icons only for devices that are here. `upload` stores a picture and
// gives back its address.
export async function materializeTheme(theme, name, choices, upload, exists) {
  const icons = importableIcons(theme.appearance, exists);
  const { icons: dropped, ...look } = theme.appearance;
  const appearance = Object.keys(icons).length ? { ...look, icons } : look;
  const backgrounds = {};
  for (const [key, target] of Object.entries(choices)) {
    const entry = theme.backgrounds[key];
    if (!target || !entry) continue;
    const value = {};
    for (const slot of SLOTS) {
      const item = entry[slot];
      if (!item) continue;
      value[slot] = item.startsWith("data:") ? await upload(dataUrlToBlob(item), `${target}_${slot}`) : item;
    }
    if (entry.position) value.position = entry.position;
    backgrounds[target] = value;
  }
  return { id: themeId(name), name, appearance, backgrounds };
}

export const themeId = (name) =>
  `${simple(name).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "theme"}_${Date.now().toString(36)}`;

// The library: the themes that come with Home Dashboard, each as this home last saved it, and the
// themes of this home.
export function themeLibrary(raw) {
  const stored = Array.isArray(raw?.themes) ? raw.themes.filter((theme) => theme?.id) : [];
  const builtin = BUILTIN_THEMES.map((theme) => {
    const own = stored.find((item) => item.id === theme.id);
    return { ...theme, ...own, name: own?.name ?? theme.name, builtin: true, own: Boolean(own) };
  });
  const ids = new Set(BUILTIN_THEMES.map((theme) => theme.id));
  return [...builtin, ...stored.filter((theme) => !ids.has(theme.id))];
}

export const activeTheme = (raw) => themeLibrary(raw).find((theme) => theme.id === raw?.theme) ?? null;

// The shared look as it is now, as a theme.
export const currentAsTheme = (raw, name, id = themeId(name)) => ({
  id,
  name,
  appearance: raw?.appearance ?? {},
  backgrounds: raw?.backgrounds ?? {},
});

const same = (first, second) => JSON.stringify(first ?? {}) === JSON.stringify(second ?? {});

// A theme sets the backgrounds of the pages it has; the others stay as they are.
const hasBackgroundsOf = (raw, theme) =>
  Object.entries(theme.backgrounds ?? {}).every(([key, value]) => same(raw?.backgrounds?.[key], value));

// Changed since it was chosen: what "Back to the theme" would undo.
export function themeChanged(raw) {
  const theme = activeTheme(raw);
  return Boolean(theme) && !(same(theme.appearance, raw.appearance) && hasBackgroundsOf(raw, theme));
}

// A look that is in no theme yet would be lost by switching, so it is kept in the library first.
function keepUnsaved(raw, name) {
  const stored = Array.isArray(raw?.themes) ? raw.themes : [];
  if (same(raw?.appearance, {})) return stored;
  const saved = themeLibrary(raw).some((theme) => same(theme.appearance, raw?.appearance));
  return saved ? stored : [...stored, currentAsTheme(raw, name)];
}

// The theme becomes the shared look: its look as a whole and the backgrounds of its pages. Without
// one, the plain look of the dashboard; the backgrounds of the pages stay either way.
export function useTheme(raw, theme, unsavedName) {
  const { appearance: oldLook, theme: oldTheme, ...rest } = raw ?? {};
  const next = { ...rest, themes: keepUnsaved(raw, unsavedName) };
  if (!theme) return next;
  if (Object.keys(theme.appearance ?? {}).length) next.appearance = theme.appearance;
  if (Object.keys(theme.backgrounds ?? {}).length) next.backgrounds = { ...raw?.backgrounds, ...theme.backgrounds };
  return { ...next, theme: theme.id };
}

export function addTheme(raw, theme) {
  const stored = Array.isArray(raw?.themes) ? raw.themes : [];
  return { ...raw, themes: [...stored.filter((item) => item.id !== theme.id), theme] };
}

// The current look becomes the theme in use, so going back to it later brings these changes. A
// theme that comes with Home Dashboard keeps its own version in this home.
export function saveIntoTheme(raw, theme) {
  return { ...addTheme(raw, currentAsTheme(raw, theme.name, theme.id)), theme: theme.id };
}

// A theme of this home goes; one that comes with Home Dashboard goes back to how it came. The look
// in use stays as it is.
export function removeTheme(raw, id) {
  const { theme, themes, ...rest } = raw ?? {};
  const builtin = BUILTIN_THEMES.some((item) => item.id === id);
  const kept = (Array.isArray(themes) ? themes : []).filter((item) => item.id !== id);
  return { ...rest, themes: kept, ...(theme && (theme !== id || builtin) ? { theme } : {}) };
}
