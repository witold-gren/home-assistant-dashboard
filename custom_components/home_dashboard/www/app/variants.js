// Variants of a page (variants.py on the server): another version of Home or of a room, shown to one device or
// person instead of the published page. A variant holds only its page's slice of the configuration; the rest
// always comes from the published one. The slices here must match the server's: tests/fixtures/variant_slices.json.

export const HOME_PAGE = "home";
export const ROOM_PREFIX = "room:";
const SCENES_ROOM = "__scenes";
const PAGE_LAYOUTS = ["classic", "sections"];
const HOME_CAMERA_KEYS = ["hero", "tiles", "columns", "layout", "order"];
const HOME_KEYS = ["favorites", "scenes", "scenes_layout", "weather"];
// A look at a variant for this visit only ("Just look"): page key → variant id, gone when the app closes.
export const PEEK_KEY = "home-dashboard-variant-peek";

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const layoutChoice = (value) => (PAGE_LAYOUTS.includes(value) ? value : null);
const orNull = (value) => (value === undefined ? null : value);

/** The key of the page a variant belongs to: Home, a room (not the scenes), or none. */
export function pageKey(page, room) {
  if (page === "home") return HOME_PAGE;
  if (page === "room" && room && room !== SCENES_ROOM) return `${ROOM_PREFIX}${room}`;
  return null;
}

export const roomOfKey = (key) => (key?.startsWith(ROOM_PREFIX) ? key.slice(ROOM_PREFIX.length) : null);

function put(target, key, value) {
  if (value === null || value === undefined) delete target[key];
  else target[key] = clone(value);
}

/** The part of a configuration that belongs to a page; null for a room the configuration lacks. */
export function sliceOf(strategy, key) {
  const pageLayout = strategy.page_layout ?? {};
  const style = layoutChoice(pageLayout.style) ?? "classic";
  const backgrounds = strategy.backgrounds ?? {};
  if (key === HOME_PAGE) {
    const cameras = strategy.cameras ?? {};
    const rooms = strategy.rooms ?? {};
    return clone({
      ...Object.fromEntries(HOME_KEYS.map((name) => [name, orNull(strategy[name])])),
      cameras: Object.fromEntries(HOME_CAMERA_KEYS.map((name) => [name, orNull(cameras[name])])),
      rooms: { order: orNull(rooms.order), hidden: orNull(rooms.hidden) },
      page_layout: { home: layoutChoice(pageLayout.home) ?? style, rows: orNull(pageLayout.rows) },
      room_home: Object.fromEntries((strategy.layout ?? []).map((room) => [room.id, orNull(room.home)])),
      background: orNull(backgrounds[HOME_PAGE]),
    });
  }
  const room = roomOfKey(key);
  const entry = (strategy.layout ?? []).find((item) => item.id === room);
  if (!entry) return null;
  const { home, ...card } = entry;
  card.page_layout = layoutChoice(entry.page_layout) ?? style;
  return clone({ room: card, background: orNull(backgrounds[room]) });
}

/** A copy of the configuration with the page's part taken from a slice; a room that is gone stays gone. */
export function withSlice(strategy, key, part) {
  const result = clone(strategy);
  if (!part) return result;
  result.backgrounds ??= {};
  const backgrounds = result.backgrounds;
  if (key === HOME_PAGE) {
    for (const name of HOME_KEYS) put(result, name, part[name]);
    result.cameras ??= {};
    for (const name of HOME_CAMERA_KEYS) put(result.cameras, name, part.cameras?.[name]);
    result.rooms ??= {};
    for (const name of ["order", "hidden"]) put(result.rooms, name, part.rooms?.[name]);
    if (!Object.keys(result.rooms).length) delete result.rooms;
    result.page_layout ??= {};
    put(result.page_layout, "home", part.page_layout?.home);
    put(result.page_layout, "rows", part.page_layout?.rows);
    const roomHome = part.room_home ?? {};
    for (const room of result.layout ?? []) {
      if (room.id in roomHome) put(room, "home", roomHome[room.id]);
    }
    put(backgrounds, HOME_PAGE, part.background);
  } else {
    const room = roomOfKey(key);
    const layout = result.layout ?? [];
    const index = layout.findIndex((item) => item.id === room);
    if (index < 0) return clone(strategy);
    const { home, ...card } = part.room ?? {};
    card.id = room;
    if ("home" in layout[index]) card.home = layout[index].home;
    layout[index] = clone(card);
    put(backgrounds, room, part.background);
  }
  if (!Object.keys(backgrounds).length) delete result.backgrounds;
  return result;
}

export function readPeeks(storage = globalThis.sessionStorage) {
  try {
    return JSON.parse(storage?.getItem(PEEK_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function writePeek(key, variantId, storage = globalThis.sessionStorage) {
  const peeks = readPeeks(storage);
  if (variantId) peeks[key] = variantId;
  else delete peeks[key];
  try {
    storage?.setItem(PEEK_KEY, JSON.stringify(peeks));
  } catch {
    // Private browsing: the look lasts until the page reloads.
  }
}

/**
 * The variant a page shows, from what the server said of this device (`raw._variants`): one looked at for this
 * visit, else the one chosen for the device or the person; null for the published page. A look names the variant
 * by id, or "live" for the published page while the device has a variant of its own.
 */
export function shownVariant(raw, key, peeks = readPeeks()) {
  if (!key) return null;
  const variants = raw?._variants;
  const peek = peeks[key];
  if (peek === "live") return null;
  if (peek) {
    const item = variants?.choices?.[key]?.items?.find((choice) => choice.id === peek);
    if (item) return { id: item.id, name: item.name, slice: item.slice, peek: true };
  }
  const own = variants?.pages?.[key];
  return own ? { ...own, peek: false } : null;
}

/** The configuration a page is drawn from: the published one, or with its part from the variant it shows. */
export function pageStrategy(raw, page, room, peeks = readPeeks()) {
  const key = pageKey(page, room);
  const variant = shownVariant(raw, key, peeks);
  if (!variant?.slice) return raw;
  return { ...withSlice(raw, key, variant.slice), _variant: { key, id: variant.id, name: variant.name, peek: variant.peek } };
}

/**
 * A configuration changed on a page that shows a variant, split in two: the page's part goes to the variant,
 * everything else to the published configuration, whose own part of that page stays as it was.
 */
export function splitSave(changed, published, key) {
  const part = sliceOf(changed, key);
  const live = withSlice(changed, key, sliceOf(published, key));
  return { live, part };
}

/** The variants of a page there are to choose from: all for an administrator, the shared ones for everyone else. */
export function pageChoices(raw, key) {
  const page = raw?._variants?.choices?.[key];
  if (!page?.items?.length) return null;
  return { liveName: page.live_name || null, items: page.items, own: page.own ?? null };
}
