// How the page looks: how much of a background shows, whether the page bounces at its ends, and the
// look of the tiles. An administrator sets it for everyone; each person may change any part of it
// for themselves, and what they leave alone follows the shared choice.

export const DEFAULT_BACKGROUND_STRENGTH = 40;
export const TILE_FILLS = ["tile", "icon"];
export const TILE_RADIUS_RANGE = [0, 36];

// The kinds of tiles a colour can be chosen for. Helpers count as what they look like.
export const TILE_KINDS = [
  "light",
  "switch",
  "cover",
  "climate",
  "media_player",
  "lock",
  "fan",
  "scene",
  "script",
  "automation",
  "binary_sensor",
  "sensor",
];
const KIND_ALIASES = { input_boolean: "switch", alarm_control_panel: "lock", button: "script", input_button: "script", water_heater: "climate" };

// These have no state of their own to be off in, so their colour shows all the time.
const ALWAYS_COLOURED = new Set(["scene", "script", "sensor"]);

// #rrggbb, or #rrggbbaa for a colour the page shows through, as a glass circle under an icon.
const isColour = (value) => typeof value === "string" && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value);
const isIcon = (value) => typeof value === "string" && /^[a-z0-9-]+:[a-z0-9-]+$/i.test(value);

const number = (low, high, fallback) => ({
  fallback,
  clean: (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(high, Math.max(low, Math.round(parsed))) : undefined;
  },
});
const colour = () => ({ fallback: null, clean: (value) => (isColour(value) ? value : undefined) });
// A colour or a gradient, never a picture: a look shared with others must not load anything.
const isPaint = (value) =>
  typeof value === "string" &&
  (isColour(value) || /^(linear|radial|conic)-gradient\([^;{}<>"'\\]*\)$/.test(value)) &&
  !/url\(/i.test(value);
const paint = () => ({ fallback: null, clean: (value) => (isPaint(value) ? value : undefined) });
const flag = (fallback) => ({ fallback, clean: (value) => (typeof value === "boolean" ? value : undefined) });
const choice = (values, fallback) => ({ fallback, clean: (value) => (values.includes(value) ? value : undefined) });
// A list of names, each once, of a length the place can take.
const list = (valid, low, high) => ({
  fallback: null,
  clean: (value) => {
    if (!Array.isArray(value)) return undefined;
    const items = [...new Set(value.filter(valid))];
    return items.length >= low && items.length <= high ? items : undefined;
  },
});

// What the navigation bar can hold: a page, the Scenes page, the menu or one room.
export const NAV_PAGES = ["home", "media", "music", "energy", "map", "scenes", "menu"];
export const NAV_STYLES = ["docked", "floating"];
export const NAV_RANGE = [2, 5];
export const isNavItem = (value) => typeof value === "string" && (NAV_PAGES.includes(value) || /^room:[\w-]+$/.test(value));
// The parts of the status bar of a tablet; the clock is always there.
export const STATUS_PARTS = ["weather", "home", "alerts", "now", "departures", "power"];

// Everything the look can say, with its default. An empty group name is the top level. A colour
// without a value keeps the colour of the light or the dark look.
export const APPEARANCE_FIELDS = {
  "": { background_strength: number(0, 100, DEFAULT_BACKGROUND_STRENGTH), bounce: flag(true) },
  // For every page without a background of its own.
  page: { background_light: paint(), background_dark: paint() },
  tiles: {
    opacity: number(20, 100, 100),
    radius: number(...TILE_RADIUS_RANGE, 20),
    fill: choice(TILE_FILLS, "tile"),
    background: colour(),
    text: colour(),
    icon: colour(),
    icon_background: colour(),
  },
  text: { title: colour(), headings: colour() },
  chips: { background: colour(), text: colour(), opacity: number(20, 100, 100), radius: number(0, 30, 14) },
  buttons: { background: colour(), icon: colour(), opacity: number(20, 100, 100) },
  // `kinds: false` draws every circle of a room's status row in the look's colour, without the colour of its kind.
  badges: { text: colour(), icon: colour(), kinds: flag(true) },
  // The windows that open over the page: controls of a device, the player, the menus.
  sheets: {
    background: colour(),
    text: colour(),
    controls: colour(),
    cards: colour(),
    opacity: number(20, 100, 100),
    blur: number(0, 40, 0),
    scrim: number(0, 80, 45),
  },
  // The map of the Map page: its colours, and how far back the routes go at first.
  map: { theme: choice(["auto", "light", "dark"], "auto"), hours: choice([6, 24, 72, 168], 24) },
  // The small player over the bar, and how long it stays for something paused.
  player: {
    background: colour(),
    text: colour(),
    opacity: number(20, 100, 100),
    blur: number(0, 30, 0),
    radius: number(0, 32, 16),
    paused_minutes: number(0, 120, 10),
  },
  nav: {
    items: list(isNavItem, ...NAV_RANGE),
    style: choice(NAV_STYLES, "docked"),
    background: colour(),
    icon: colour(),
    active: colour(),
    opacity: number(20, 100, 100),
    blur: number(0, 30, 0),
  },
  // The status bar beside the pages on a tablet on its side: whether there is one, its parts in order, its colours.
  status: {
    shown: flag(false),
    widgets: list((value) => STATUS_PARTS.includes(value), 1, STATUS_PARTS.length),
    // Quiet white icons by default; colours bring back the yellow lights, the coloured lines and the like.
    colourful: flag(false),
    background: colour(),
    text: colour(),
    opacity: number(20, 100, 100),
    blur: number(0, 30, 30),
  },
};
// Lists keyed by a kind of tile or by a device.
const MAPS = [
  ["tiles", "colours", isColour],
  ["", "icons", isIcon],
];

const groupOf = (value, group) => (group ? value?.[group] : value);
const isObject = (value) => Boolean(value) && typeof value === "object";

function defaults() {
  const out = {};
  for (const [group, fields] of Object.entries(APPEARANCE_FIELDS)) {
    const target = group ? (out[group] = {}) : out;
    for (const [key, field] of Object.entries(fields)) target[key] = field.fallback;
  }
  for (const [group, key] of MAPS) (group ? out[group] : out)[key] = {};
  return out;
}

export const APPEARANCE_DEFAULTS = Object.freeze(defaults());

export const tileKind = (domain) => {
  const kind = KIND_ALIASES[domain] ?? domain;
  return TILE_KINDS.includes(kind) ? kind : null;
};

// What a person sees: their own choices over the shared ones over the defaults. Only what a layer
// really sets, and sets well, counts.
export function mergeAppearance(...layers) {
  const out = defaults();
  for (const value of layers) {
    if (!isObject(value)) continue;
    for (const [group, fields] of Object.entries(APPEARANCE_FIELDS)) {
      const source = groupOf(value, group);
      if (!isObject(source)) continue;
      const target = group ? out[group] : out;
      for (const [key, field] of Object.entries(fields)) {
        if (source[key] == null) continue;
        const clean = field.clean(source[key]);
        if (clean !== undefined) target[key] = clean;
      }
    }
    for (const [group, key, valid] of MAPS) {
      const source = groupOf(value, group)?.[key];
      if (!isObject(source)) continue;
      const target = (group ? out[group] : out)[key];
      for (const [name, item] of Object.entries(source)) if (valid(item)) target[name] = item;
    }
  }
  return out;
}

// Only what differs from the base is stored: the defaults for everyone, the shared look for one
// person, so what they leave alone keeps following later changes to it.
export function appearanceDiff(draft, base = mergeAppearance()) {
  const out = {};
  const put = (group, key, value) => {
    const target = group ? (out[group] ??= {}) : out;
    target[key] = value;
  };
  for (const [group, fields] of Object.entries(APPEARANCE_FIELDS)) {
    for (const key of Object.keys(fields)) {
      const mine = groupOf(draft, group)?.[key];
      if (mine != null && JSON.stringify(mine) !== JSON.stringify(groupOf(base, group)?.[key])) put(group, key, mine);
    }
  }
  for (const [group, key] of MAPS) {
    const mine = groupOf(draft, group)?.[key] ?? {};
    const theirs = groupOf(base, group)?.[key] ?? {};
    const changed = Object.fromEntries(Object.entries(mine).filter(([name, value]) => theirs[name] !== value));
    if (Object.keys(changed).length) put(group, key, changed);
  }
  return out;
}

// The share of the theme laid over a background picture.
export const backgroundVeil = (appearance) => 1 - (appearance?.background_strength ?? DEFAULT_BACKGROUND_STRENGTH) / 100;

// Dark writing on a light colour, white on a dark one.
export function inkFor(colour) {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(colour.slice(start, start + 2), 16) / 255);
  const linear = (value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
  return luminance > 0.45 ? "#1b1b1f" : "#ffffff";
}

// The colour a person chose for this kind of tile, while the tile is on or always for what has no off.
export function tileColour(tile, appearance) {
  const kind = tile.kind ?? tileKind(tile.domain);
  const colour = kind ? appearance?.tiles?.colours?.[kind] : null;
  if (!colour || tile.available === false || tile.dormant) return null;
  if (tile.tone === "off" && !ALWAYS_COLOURED.has(kind)) return null;
  return colour;
}

export function tileColourStyle(colour) {
  if (!colour) return null;
  return `--tile-background: color-mix(in srgb, ${colour} 26%, var(--hd-surface)); --tile-icon: ${colour}; --tile-ink: ${inkFor(colour)}`;
}

const muted = (value) => `color-mix(in srgb, ${value} 72%, transparent)`;

// The look of the whole page as custom properties. A colour nobody chose is left out, so the
// colour of the light or the dark look stays.
export function tileVariables(appearance) {
  const look = mergeAppearance(appearance);
  const { tiles, text, chips, buttons, badges } = look;
  const variables = {
    "--hd-tile-opacity": `${tiles.opacity}%`,
    "--hd-tile-radius": `${tiles.radius}px`,
    "--hd-chip-opacity": `${chips.opacity}%`,
    "--hd-chip-radius": `${chips.radius}px`,
    "--hd-button-opacity": `${buttons.opacity}%`,
  };
  const chosen = {
    "--hd-look-tile-bg": tiles.background,
    "--hd-look-tile-text": tiles.text,
    "--hd-look-tile-muted": tiles.text && muted(tiles.text),
    "--hd-look-tile-icon": tiles.icon,
    "--hd-look-tile-icon-bg": tiles.icon_background,
    "--hd-look-title": text.title,
    "--hd-look-headings": text.headings,
    "--hd-look-chip-bg": chips.background,
    "--hd-look-chip-border": chips.background && "transparent",
    "--hd-look-chip-text": chips.text,
    "--hd-look-chip-muted": chips.text && muted(chips.text),
    "--hd-look-button-bg": buttons.background,
    "--hd-look-button-border": buttons.background && "transparent",
    "--hd-look-button-icon": buttons.icon,
    "--hd-look-badge-text": badges.text,
    "--hd-look-badge-muted": badges.text && muted(badges.text),
    "--hd-look-badge-icon": badges.icon,
    "--hd-look-badge-ring": badges.icon && `color-mix(in srgb, ${badges.icon} 45%, transparent)`,
    // Without the colours of the kinds: the circles are open, with the look's ring and icon (as in the Home app).
    "--hd-badge-kind-ring": badges.kinds ? null : "var(--hd-look-badge-ring, var(--hd-outline))",
    "--hd-badge-kind-fill": badges.kinds ? null : "transparent",
    "--hd-badge-kind-ink": badges.kinds ? null : "var(--hd-look-badge-icon, var(--hd-off-ink))",
  };
  return Object.entries({ ...variables, ...chosen })
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
}

// A window is outside the page too. Its writing and controls take the chosen colours by replacing the
// colours of the look inside it, so every kind of window follows at once.
export function sheetVariables(appearance) {
  const { sheets } = mergeAppearance(appearance);
  const variables = {
    "--hd-sheet-opacity": `${sheets.opacity}%`,
    "--hd-sheet-blur": `${sheets.blur}px`,
    "--hd-sheet-scrim": sheets.scrim / 100,
    "--hd-sheet-bg": sheets.background,
    "--hd-ov-text": sheets.text,
    "--hd-ov-text-muted": sheets.text && muted(sheets.text),
    "--hd-ov-outline": sheets.text && `color-mix(in srgb, ${sheets.text} 25%, transparent)`,
    "--hd-ov-off": sheets.controls,
    "--hd-ov-surface": sheets.controls,
    "--hd-ov-off-icon": sheets.controls && `color-mix(in srgb, ${sheets.controls} 80%, #ffffff)`,
    "--hd-ov-off-ink": sheets.text,
    "--hd-ov-control": sheets.text,
    // What is chosen or stands out keeps to the glass: a lighter pane, a yellow one for a highlighted row.
    "--hd-ov-pill": sheets.text && `color-mix(in srgb, ${sheets.text} 28%, transparent)`,
    "--hd-ov-highlight": sheets.text && "color-mix(in srgb, #ffd60a 30%, transparent)",
    "--hd-ov-highlight-ink": sheets.text && "#ffd60a",
    // Cards of Home Assistant shown in a window, such as the map of a vacuum.
    "--primary-text-color": sheets.text,
    "--secondary-text-color": sheets.text && muted(sheets.text),
    "--ha-card-background": sheets.cards,
    "--card-background-color": sheets.cards,
  };
  return Object.entries(variables)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
}

// A panel inside the page, as the list over the map, looks like a window. Its colours are set on the
// panel itself, as the page has already worked out its own.
export const panelVariables = (appearance) => sheetVariables(appearance).replaceAll("--hd-ov-", "--hd-");

// The bar is outside the page, so it gets properties of its own.
export function navVariables(appearance) {
  const { nav, player, status } = mergeAppearance(appearance);
  const variables = {
    "--hd-player-opacity": `${player.opacity}%`,
    "--hd-player-blur": `${player.blur}px`,
    "--hd-player-radius": `${player.radius}px`,
    "--hd-player-bg": player.background,
    "--hd-player-text": player.text,
    "--hd-player-muted": player.text && muted(player.text),
    "--hd-nav-opacity": `${nav.opacity}%`,
    "--hd-nav-blur": `${nav.blur}px`,
    "--hd-nav-bg": nav.background,
    "--hd-nav-icon": nav.icon,
    "--hd-nav-active": nav.active,
    "--hd-status-blur": `${status.blur}px`,
    // Without a chosen colour the bar is glass, as the tiles: black let through.
    "--hd-status-paint": status.background && `color-mix(in srgb, ${status.background} ${status.opacity}%, transparent)`,
    "--hd-status-text": status.text,
  };
  return Object.entries(variables)
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
}

// Icons of Home Assistant with their keywords, fetched once, for the search in the sheet.
let iconList;
export function loadIconList(fetcher = (url) => fetch(url)) {
  iconList ??= fetcher("/static/mdi/iconList.json")
    .then((response) => (response.ok ? response.json() : []))
    .catch(() => []);
  return iconList;
}

export function searchIcons(list, query, limit = 30) {
  const words = query.trim().toLowerCase().replace(/^mdi:/, "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const named = [];
  const tagged = [];
  for (const icon of list) {
    const name = icon.name;
    if (words.every((word) => name.includes(word))) named.push(name);
    else if (words.every((word) => name.includes(word) || icon.keywords?.some((key) => key.toLowerCase().includes(word)))) tagged.push(name);
    if (named.length >= limit) break;
  }
  return [...named, ...tagged].slice(0, limit).map((name) => `mdi:${name}`);
}
