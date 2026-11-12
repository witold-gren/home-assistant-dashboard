// What the dashboard shows, as plain data: no Lit and no DOM, so it can be tested on its own.

import { mergeAppearance, tileKind } from "./appearance.js";
import { translate } from "./i18n.js";
import { panelEntityIds, panelTile } from "./panel.js";
import { scalePeople, scaleTile } from "./scale.js";

export const SCHEMA_VERSION = 1;
export const DEFAULT_DOMAINS = ["light", "climate", "cover", "lock"];
export const DEFAULT_MEDIA_PATTERNS = ["^(.+)_homepod(_muzyka)?$"];
export const OTHER_ROOM_ID = "__other__";

const DEFAULT_IDLE_SECONDS = 180;
export const FORECAST_DAILY = 1;
export const FORECAST_HOURLY = 2;
const WEATHER_ICONS = {
  "clear-night": "mdi:weather-night",
  cloudy: "mdi:weather-cloudy",
  exceptional: "mdi:alert-circle-outline",
  fog: "mdi:weather-fog",
  hail: "mdi:weather-hail",
  lightning: "mdi:weather-lightning",
  "lightning-rainy": "mdi:weather-lightning-rainy",
  partlycloudy: "mdi:weather-partly-cloudy",
  pouring: "mdi:weather-pouring",
  rainy: "mdi:weather-rainy",
  snowy: "mdi:weather-snowy",
  "snowy-rainy": "mdi:weather-snowy-rainy",
  sunny: "mdi:weather-sunny",
  windy: "mdi:weather-windy",
  "windy-variant": "mdi:weather-windy-variant",
};
// The scenes have a page of their own, opened like a room. Two underscores keep it apart from areas.
export const SCENES_ROOM = "__scenes";
const SNAPSHOT_IMAGE = /_last_(screen|snapshot)$/;
const COLORFUL_SATURATION = 0.35;
const TOGGLE_ON_ICON = new Set(["light", "switch", "input_boolean", "fan", "automation"]);
const RUN_SERVICES = { scene: ["scene", "turn_on"], script: ["script", "turn_on"], button: ["button", "press"] };
export const ALERT_CLASSES = new Set(["moisture", "smoke", "gas", "carbon_monoxide", "safety", "problem"]);
const OPENING_CLASSES = new Set(["window", "door", "opening", "garage_door"]);
const SHEET_DOMAINS = new Set([
  "alarm_control_panel",
  "automation",
  "binary_sensor",
  "climate",
  "cover",
  "input_boolean",
  "input_select",
  "light",
  "lock",
  "media_player",
  "select",
  "switch",
]);
const SECURITY_COVERS = new Set(["garage", "gate", "door"]);
const ROOM_SECTIONS = [
  { key: "climate", title: "chip_climate", domains: ["climate", "fan"] },
  { key: "lights", title: "chip_lights", domains: ["light"] },
  { key: "covers", title: "section_covers", domains: ["cover"] },
  { key: "security", title: "chip_security", domains: ["lock"] },
  { key: "media", title: "chip_media", domains: ["media_player"] },
];
const EARTH_RADIUS_KM = 6371;
const NON_PLAYABLE_SOURCE = /^media-source:\/\/(camera|image|image_upload|ai_task)/;
const MEDIA_FEATURES = {
  seek: 2,
  volume: 4,
  previous: 16,
  next: 32,
  shuffle: 32768,
  repeat: 262144,
};
const INACTIVE_STATES = new Set([
  "off",
  "closed",
  "locked",
  "idle",
  "standby",
  "paused",
  "disarmed",
  "unavailable",
  "unknown",
]);

const DOMAIN_ICONS = {
  light: "mdi:lightbulb",
  climate: "mdi:thermostat",
  switch: "mdi:toggle-switch",
  media_player: "mdi:speaker",
  fan: "mdi:fan",
  vacuum: "mdi:robot-vacuum",
  scene: "mdi:palette",
  script: "mdi:script-text-play",
  button: "mdi:gesture-tap-button",
  automation: "mdi:robot",
  input_boolean: "mdi:toggle-switch",
  select: "mdi:format-list-bulleted",
  alarm_control_panel: "mdi:shield-home",
  sensor: "mdi:eye",
  binary_sensor: "mdi:eye",
};

const CLASS_ICONS = {
  moisture: "mdi:water-alert",
  smoke: "mdi:smoke-detector",
  gas: "mdi:gas-cylinder",
  carbon_monoxide: "mdi:molecule-co",
  motion: "mdi:motion-sensor",
  occupancy: "mdi:account",
  window: "mdi:window-closed-variant",
  door: "mdi:door",
  problem: "mdi:check-circle-outline",
  distance: "mdi:map-marker-distance",
  speed: "mdi:speedometer",
  duration: "mdi:timer-outline",
  volume_storage: "mdi:gas-station",
  temperature: "mdi:thermometer",
  humidity: "mdi:water-percent",
  power: "mdi:flash",
  weight: "mdi:scale-bathroom",
};

const COVER_ICONS = { garage: "mdi:garage", gate: "mdi:gate", door: "mdi:door", window: "mdi:window-open" };

export const domainOf = (entityId) => entityId.split(".")[0];

export function normalizeConfig(config = {}) {
  return {
    schema: config.schema ?? SCHEMA_VERSION,
    rooms: { order: [], hidden: [], ...config.rooms },
    layout: config.layout ?? [],
    favorites: config.favorites ?? [],
    shortcuts: config.shortcuts ?? [],
    scenes: config.scenes ?? [],
    scenes_layout: config.scenes_layout ?? null,
    music: config.music ?? null,
    map: { track: [], ...config.map },
    weather: config.weather === false ? null : { entity: null, forecast: null, ...config.weather },
    background: config.background ?? null,
    backgrounds: config.backgrounds ?? {},
    appearance: config.appearance ?? {},
    access: config.access ?? {},
    visibility: config.visibility ?? {},
    cameras: { hero: null, tiles: [], hide: [], columns: 3, layout: "grid", order: [], private: [], live: {}, controls: {}, ptz: {}, talk_with: {}, quick: {}, settings: {}, talk: "intercom", battery_platforms: [], snapshot_platforms: ["frigate"], guest: null, ...config.cameras },
    intercom: {
      script: null,
      areas: [],
      areas_field: "areas",
      text_field: "text",
      file_field: "file",
      played_field: null,
      // An endpoint that takes the recording and plays it itself (the Intercom integration's `/api/intercom/message`).
      upload: null,
      media_folder: null,
      ...config.intercom,
    },
    entities: { include: {}, exclude: [], overrides: {}, ...config.entities },
    media: { group_patterns: DEFAULT_MEDIA_PATTERNS, sections: [], ...config.media },
    menu: config.menu ?? null,
    lights: { prefer_groups: true, ...config.lights },
    security: { unlock_on_tablet: false, group: null, ...config.security },
    idle: { return_after: DEFAULT_IDLE_SECONDS, ...config.idle },
    // Where the facts of the status bar of a tablet come from; what it shows is part of the look.
    status_panel: { doors: [], now: [], power: [], departures: null, ...config.status_panel },
    // The phases of the grid meter on the Energy page, found by themselves unless listed here.
    energy: { phases: null, voltage_range: null, ...config.energy },
  };
}

// The registry keeps most areas on the device, not on the entity.
export function effectiveArea(hass, entityId, config) {
  const override = config.entities.overrides[entityId]?.area;
  if (override) return override;
  const entry = hass.entities[entityId];
  if (!entry) return null;
  return entry.area_id ?? hass.devices[entry.device_id]?.area_id ?? null;
}

export function isPrimary(entry) {
  return Boolean(entry) && !entry.hidden && !entry.entity_category;
}

function includedByHand(config) {
  const included = new Map();
  for (const [room, ids] of Object.entries(config.entities.include)) {
    for (const id of ids) included.set(id, room);
  }
  return included;
}

function lightGroupMembers(hass, lightIds) {
  const members = new Set();
  for (const id of lightIds) {
    const listed = hass.states[id]?.attributes?.entity_id;
    if (Array.isArray(listed)) listed.forEach((member) => members.add(member));
  }
  return members;
}

// One logical speaker often has several players; the group key is the regex's first capture.
export function mediaGroupKey(entityId, patterns) {
  const objectId = entityId.split(".")[1];
  for (const pattern of patterns) {
    const match = objectId.match(new RegExp(pattern));
    if (match) return match[1] ?? objectId;
  }
  return null;
}

function mediaGroups(hass, config, excluded) {
  const groups = new Map();
  for (const [id, entry] of Object.entries(hass.entities)) {
    if (domainOf(id) !== "media_player" || !isPrimary(entry) || excluded.has(id) || !hass.states[id]) continue;
    const key = mediaGroupKey(id, config.media.group_patterns);
    if (key === null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  // Longest id first: the Music Assistant player, which is the one that can actually be controlled.
  return [...groups.values()].map((members) => members.sort((a, b) => b.length - a.length));
}

// The expensive pass over the registries. Pages cache it until the registries change.
export function selectEntities(hass, config) {
  const excluded = new Set(config.entities.exclude);
  const included = includedByHand(config);
  const selected = Object.keys(hass.entities).filter(
    (id) =>
      !excluded.has(id) &&
      hass.states[id] &&
      isPrimary(hass.entities[id]) &&
      DEFAULT_DOMAINS.includes(domainOf(id)),
  );
  const members = config.lights.prefer_groups
    ? lightGroupMembers(hass, selected.filter((id) => domainOf(id) === "light"))
    : new Set();
  const entityIds = selected.filter((id) => !members.has(id) || included.has(id));
  for (const id of included.keys()) {
    if (!entityIds.includes(id) && !excluded.has(id) && hass.states[id]) entityIds.push(id);
  }
  return { entityIds, mediaGroups: mediaGroups(hass, config, excluded), included };
}

function activeMediaMember(hass, members) {
  return members.find((id) => hass.states[id]?.state === "playing") ?? members[0];
}

function roomOf(hass, entityId, selection, config) {
  return selection.included.get(entityId) ?? effectiveArea(hass, entityId, config) ?? OTHER_ROOM_ID;
}

function displayName(hass, entityId, roomName, config) {
  const override = config.entities.overrides[entityId]?.name;
  if (override) return override;
  const name = hass.states[entityId]?.attributes?.friendly_name ?? entityId;
  if (roomName && name.toLowerCase().startsWith(`${roomName.toLowerCase()} `)) {
    const short = name.slice(roomName.length + 1);
    return short.charAt(0).toUpperCase() + short.slice(1);
  }
  return name;
}

function saturation([red, green, blue]) {
  const max = Math.max(red, green, blue);
  return max === 0 ? 0 : (max - Math.min(red, green, blue)) / max;
}

// White lights also report an rgb_color, a strongly orange one when they are warm.
function lightTint(stateObj) {
  const { rgb_color: rgb, color_mode: colorMode } = stateObj.attributes ?? {};
  if (stateObj.state !== "on" || colorMode === "color_temp" || !Array.isArray(rgb)) return null;
  return saturation(rgb) >= COLORFUL_SATURATION ? rgb : null;
}

// An icon from a set that is not installed draws nothing at all, which looks like a broken tile.
function isDrawable(icon) {
  const [prefix] = String(icon).split(":");
  return ["mdi", "hass", "hassio"].includes(prefix) || Boolean(window.customIcons?.[prefix] ?? window.customIconsets?.[prefix]);
}

function tileIcon(stateObj, entityId, config) {
  const override = config.entities.overrides[entityId]?.icon ?? stateObj.attributes?.icon;
  if (override && isDrawable(override)) return override;
  const domain = domainOf(entityId);
  if (domain === "lock") return stateObj.state === "locked" ? "mdi:lock" : "mdi:lock-open-variant";
  if (domain === "cover") return COVER_ICONS[stateObj.attributes?.device_class] ?? "mdi:blinds";
  return CLASS_ICONS[stateObj.attributes?.device_class] ?? DOMAIN_ICONS[domain] ?? "mdi:circle-medium";
}

export function entityIcon(hass, entityId, config) {
  return tileIcon(hass.states[entityId], entityId, config);
}

function tileTone(domain, stateObj) {
  const { state } = stateObj;
  if (INACTIVE_STATES.has(state)) return "off";
  if (domain === "sensor" || domain === "select" || domain in RUN_SERVICES) return "off";
  if (domain === "binary_sensor") {
    const deviceClass = stateObj.attributes?.device_class;
    if (ALERT_CLASSES.has(deviceClass)) return "security";
    return OPENING_CLASSES.has(deviceClass) ? "climate" : "appliance";
  }
  if (domain === "alarm_control_panel") return "security";
  if (domain === "climate") return "climate";
  if (domain === "lock") return "security";
  if (domain === "cover") return "cover";
  if (domain === "media_player") return state === "playing" ? "media" : "off";
  if (domain === "light") return "light";
  return "appliance";
}

function tileStateText(hass, domain, stateObj) {
  const { attributes, state } = stateObj;
  const language = hass.language;
  const formatted = hass.formatEntityState?.(stateObj) ?? state;
  if (domain === "light" && state === "on" && attributes.brightness != null) {
    return `${Math.round((attributes.brightness / 255) * 100)}%`;
  }
  if (domain === "cover" && state === "open" && attributes.current_position != null) {
    return translate(language, "open_percent", { value: attributes.current_position });
  }
  if (domain === "climate" && attributes.temperature != null) {
    if (!attributes.hvac_action || attributes.hvac_action === "idle") {
      return translate(language, "climate_set", { value: attributes.temperature });
    }
    const action = hass.formatEntityAttributeValue?.(stateObj, "hvac_action") ?? attributes.hvac_action;
    return translate(language, "climate_to", { action, value: attributes.temperature });
  }
  if (domain === "media_player" && state === "playing" && attributes.media_title) return attributes.media_title;
  if (domain in RUN_SERVICES) return translate(language, "run");
  if (domain === "select" || domain === "input_select") return optionLabel(hass, stateObj, state);
  return formatted;
}

/** The name of an option of a list, as Home Assistant translates it; its raw "none" is said in words. */
export function optionLabel(hass, stateObj, option) {
  const label = hass.formatEntityState?.(stateObj, option) ?? option;
  return label === "none" ? translate(hass.language, "select_none") : label;
}

/** A sensor with a number, drawn as a line in the dashboard's own window. */
export function isNumericSensor(stateObj) {
  const { attributes = {}, state } = stateObj ?? {};
  return (attributes.unit_of_measurement != null || attributes.state_class != null) && Number.isFinite(Number.parseFloat(state));
}

// A code cannot be typed on the slider, and the regular dialog would allow unlocking.
function tapAction(domain, stateObj, layout, config) {
  if (domain in RUN_SERVICES) return stateObj.state === "unavailable" ? "more-info" : "call";
  if (domain === "lock" && stateObj.attributes?.code_format) {
    return canUnlock(layout, config) ? "more-info" : "none";
  }
  // A code cannot be typed in the sheet of an alarm either.
  if (domain === "alarm_control_panel" && stateObj.attributes?.code_format) return "more-info";
  if (domain === "sensor") return isNumericSensor(stateObj) ? "sheet" : "more-info";
  return SHEET_DOMAINS.has(domain) ? "sheet" : "more-info";
}

export function canUnlock(layout, config) {
  return layout !== "tablet" || config.security.unlock_on_tablet;
}

// Some devices come with a card that knows them better than a sheet for their domain does. Their
// icon opens it too: a toggle could mean more than it seems, as a lamp that loses its schedule.
function withOwnCard(tile, card) {
  if (!card) return tile;
  const item = { kind: "panel", name: tile.name, entity: tile.entityId, card, auto_card: true };
  return { ...tile, item, iconAction: "open", tapAction: "panel" };
}

export function buildTile(hass, entityId, roomName, config, layout = "phone") {
  const stateObj = hass.states[entityId];
  if (!stateObj || config.denied?.includes(entityId)) return null;
  const domain = domainOf(entityId);
  const available = stateObj.state !== "unavailable";
  const current = stateObj.attributes?.current_temperature;
  const tile = {
    entityId,
    domain,
    roomName,
    name: displayName(hass, entityId, roomName, config),
    stateText: tileStateText(hass, domain, stateObj),
    tone: available ? tileTone(domain, stateObj) : "off",
    tint: domain === "light" ? lightTint(stateObj) : null,
    kind: tileKind(domain),
    icon: config.appearance?.icons?.[entityId] ?? tileIcon(stateObj, entityId, config),
    badge: domain === "climate" && current != null ? `${Math.round(current)}°` : null,
    available,
    iconAction: available && TOGGLE_ON_ICON.has(domain) ? "toggle" : null,
    tapAction: tapAction(domain, stateObj, layout, config),
    call: domain in RUN_SERVICES ? serviceCall(RUN_SERVICES[domain], entityId) : null,
    deviceClass: stateObj.attributes?.device_class ?? null,
  };
  return withOwnCard(tile, config.entities.overrides[entityId]?.card);
}

function serviceCall([domain, service], entityId) {
  return { domain, service, data: { entity_id: entityId } };
}

export const TILE_SIZES = ["tall"];
// How many cameras stand in a row of the window of all cameras on a tablet.
export const CAMERA_COLUMNS = [2, 3, 4, 5];
// How the window of all cameras lays them out on a tablet: all the same size, or one big and live with the rest small.
export const CAMERA_LAYOUTS = ["grid", "featured"];

// A tile from the imported layout. `turn_on_only` is for what may be switched off elsewhere only,
// such as a guest mode that needs a PIN: the regular dialog would offer the switch, so it stays shut.
/**
 * A tile that names a shortcut (`{shortcut: "Vacuum"}`) stands for its block: the same numbers and the same window,
 * with what the tile sets itself (an entity for its state, a name) over the block's.
 */
export function shortcutBlock(config, item) {
  if (!item?.shortcut) return item;
  const block = (config.shortcuts ?? []).find(({ name }) => name === item.shortcut);
  if (!block) return null;
  const { shortcut: _, ...own } = item;
  return { ...block, ...own };
}

/**
 * The block that shows these entities, for opening its window from elsewhere (the status bar): one named by `name`,
 * or the first block of the shortcuts or the rooms with one of them among its own.
 */
export function blockFor(config, entityIds, name = null) {
  const blocks = [
    ...(config.shortcuts ?? []),
    ...(config.layout ?? []).flatMap((room) => (room.sections ?? []).flatMap((section) => section.tiles ?? [])),
  ]
    .map((item) => shortcutBlock(config, item))
    .filter((item) => item?.kind === "panel" || item?.kind === "scale");
  if (name) return blocks.find((item) => item.name === name) ?? null;
  const wanted = entityIds.filter(Boolean);
  return blocks.find((item) => item.kind === "panel" && panelEntityIds(item).some((id) => wanted.includes(id))) ?? null;
}

// A machine of the window of servers (`{shortcut: Host, column: Proxmox}`): its own column of that window. With an
// entity (the power of its plug) the tile shows its state; without one, the subtitle of the machine.
function hostTile(item, name, icon, shown) {
  const columns = item.column ? (item.columns ?? []).filter(({ title }) => title === item.column) : (item.columns ?? []);
  const base = shown ?? {
    entityId: "",
    domain: "host",
    stateText: columns.length === 1 ? (columns[0].subtitle ?? "") : "",
    tone: "off",
    available: true,
  };
  return { ...base, name, icon, iconAction: null, tapAction: "block", item: { ...item, name, columns } };
}

export function layoutTile(hass, given, roomName, config, layout) {
  const item = shortcutBlock(config, given);
  if (!item || config.denied?.includes(tileKey(item))) return null;
  // A shortcut taken from someone stays taken in a room too.
  if (given?.shortcut && config.denied?.includes(blockKey({ name: given.shortcut }))) return null;
  if (item.kind === "panel") return panelTile(hass, item);
  if (item.kind === "scale") return scaleTile(hass, item);
  if (item.kind === "host" && !item.entity) return hostTile(item, item.name ?? item.column, item.icon ?? "mdi:server", null);
  if (!item.entity) return null;
  const tile = buildTile(hass, item.entity, roomName, config, layout);
  if (!tile || (item.active_only && INACTIVE_STATES.has(hass.states[item.entity].state))) return null;
  // An icon chosen in the look of the page wins over the one of the layout.
  const icon = config.appearance?.icons?.[item.entity] ?? item.icon ?? tile.icon;
  // A tall tile takes two rows of the grid, its icon at the top and its name at the bottom.
  const shown = { ...tile, name: item.name ?? tile.name, icon, size: TILE_SIZES.includes(item.size) ? item.size : null };
  if (tile.item) shown.item = { ...tile.item, name: shown.name };
  // Something that is on nearly all the time must not shine: only being off stands out.
  if (item.calm) {
    Object.assign(shown, { tone: "off", dormant: INACTIVE_STATES.has(hass.states[item.entity].state) });
  }
  if (item.kind === "tv") {
    return { ...shown, item, iconAction: null, tapAction: "tv" };
  }
  // A list: own names of its options (`labels`) and a button to run the one marked (`confirm`).
  if (tile.domain === "select" || tile.domain === "input_select") {
    const state = hass.states[item.entity].state;
    if (item.labels?.[state]) shown.stateText = item.labels[state];
    if (item.labels || item.confirm) shown.sheetOptions = { labels: item.labels ?? null, confirm: Boolean(item.confirm) };
  }
  if (item.kind === "host") return hostTile(item, shown.name, shown.icon, shown);
  if (item.turn_on_only) {
    const off = hass.states[item.entity].state === "off";
    return {
      ...shown,
      iconAction: null,
      tapAction: off ? "call" : item.off_pin ? "pin" : "none",
      offPin: item.off_pin ?? null,
      call: off ? serviceCall(["homeassistant", "turn_on"], item.entity) : null,
    };
  }
  if (item.tap_toggle && tile.available) {
    return { ...shown, tapAction: "call", call: serviceCall(["homeassistant", "toggle"], item.entity), quiet: true };
  }
  if (item.action && tile.available) {
    const [domain, service] = item.action.split(".");
    return { ...shown, iconAction: null, tapAction: "call", call: { domain, service, data: {} } };
  }
  return shown;
}

// In the editor a tile must stay reachable even while the page would leave it out.
export function editableTile(hass, item, roomName, config, layout) {
  return (
    layoutTile(hass, item, roomName, config, layout) ?? {
      name: item.name ?? item.entity,
      stateText: translate(hass.language, "edit_hidden"),
      tone: "off",
      icon: item.icon ?? "mdi:help-circle-outline",
      available: false,
    }
  );
}

// The rooms that have something to speak through.
export function intercomAreas(hass, config) {
  const { areas } = config.intercom;
  const found = new Set(areas);
  if (!areas.length) {
    for (const [id, entry] of Object.entries(hass.entities)) {
      const speaker =
        domainOf(id) === "assist_satellite" ||
        (domainOf(id) === "media_player" && mediaGroupKey(id, config.media.group_patterns) !== null);
      const area = speaker && isPrimary(entry) ? effectiveArea(hass, id, config) : null;
      if (area) found.add(area);
    }
  }
  return [...found]
    .map((id) => ({ id, name: hass.areas[id]?.name ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name, hass.language));
}

function orderedRoomIds(hass, config, present) {
  const floorLevel = (areaId) => hass.floors?.[hass.areas[areaId]?.floor_id]?.level ?? Number.MAX_SAFE_INTEGER;
  const nameOf = (areaId) => hass.areas[areaId]?.name ?? areaId;
  const rest = [...present]
    .filter((id) => !config.rooms.order.includes(id))
    .sort((a, b) => floorLevel(b) - floorLevel(a) || nameOf(a).localeCompare(nameOf(b), hass.language));
  return [...config.rooms.order.filter((id) => present.has(id)), ...rest];
}

function buildRooms(hass, config, selection, layout) {
  const byRoom = new Map();
  const add = (entityId) => {
    const room = roomOf(hass, entityId, selection, config);
    if (room === OTHER_ROOM_ID || config.rooms.hidden.includes(room)) return;
    if (!byRoom.has(room)) byRoom.set(room, []);
    byRoom.get(room).push(entityId);
  };
  selection.entityIds.forEach(add);
  selection.mediaGroups.forEach((members) => add(activeMediaMember(hass, members)));
  return orderedRoomIds(hass, config, new Set(byRoom.keys())).map((id) => {
    const name = hass.areas[id]?.name ?? id;
    const tiles = byRoom
      .get(id)
      .map((entityId) => buildTile(hass, entityId, name, config, layout))
      .filter(Boolean)
      .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name, hass.language));
    return { id, name, tiles };
  });
}

export function layoutEntry(config, roomId) {
  return config.layout.find((room) => room.id === roomId || room.areas?.includes(roomId)) ?? null;
}

function byConfiguredOrder(rooms, order) {
  const rank = (room) => (order.includes(room.id) ? order.indexOf(room.id) : order.length);
  return [...rooms].sort((a, b) => rank(a) - rank(b));
}

// The rooms as the user laid them out, then every area the layout does not cover.
function shownRooms(hass, config, selection, layout) {
  const covered = new Set(config.layout.flatMap((room) => [room.id, ...(room.areas ?? [])]));
  const laidOut = config.layout
    .filter((room) => !config.rooms.hidden.includes(room.id))
    .map((room) => ({
      id: room.id,
      name: room.name,
      tiles: (room.home ?? [])
        .filter((item) => !hiddenInRoom(config, room.id).tiles.includes(tileKey(item)))
        .map((item) => layoutTile(hass, item, room.name, config, layout))
        .filter(Boolean),
    }));
  const rest = buildRooms(hass, config, selection, layout).filter((room) => !covered.has(room.id));
  return byConfiguredOrder([...laidOut, ...rest], config.rooms.order);
}

// Entities that can be picked in the settings but stay out of the rooms until the user assigns them.
export function unassignedEntities(hass, config, selection) {
  return selection.entityIds.filter((id) => roomOf(hass, id, selection, config) === OTHER_ROOM_ID);
}

// Grid sources are stored pictures, or cameras whose picture comes from a server that already has
// the frame. Any other camera renders through its own device, and waking a battery camera drains
// it, so a platform must be listed as safe and a battery platform never counts as safe.
function isSnapshotCamera(hass, entityId, config) {
  const platform = hass.entities[entityId]?.platform;
  return (
    domainOf(entityId) === "camera" &&
    config.cameras.snapshot_platforms.includes(platform) &&
    !isBatteryCamera(hass, entityId, config)
  );
}

export function isGridSafe(hass, entityId, config) {
  return domainOf(entityId) === "image" || isSnapshotCamera(hass, entityId, config);
}

// A wall tablet must not show the inside of the house to visitors. The dashboard has no idea who
// is looking, so this holds on every device, as it does for the regular dashboard.
// A camera switched off for privacy is gone for good, not "unavailable" like one that broke.
function isPrivate(hass, entityId, config) {
  return config.cameras.private.some((rule) => hass.states[rule.entity]?.state === "on" && rule.hide.includes(entityId));
}

function isInDeniedArea(hass, entityId, config) {
  return Boolean(config.deniedAreas?.includes(effectiveArea(hass, entityId, config)));
}

export function guestModeHolds(hass, config) {
  const { guest } = config.cameras;
  if (!guest || hass.states[guest.entity]?.state !== "on") return false;
  return !guest.users || guest.users.includes(hass.user?.id) || guest.users.includes(hass.user?.name);
}

function hiddenFromGuests(hass, entityId, config) {
  return guestModeHolds(hass, config) && config.cameras.guest.hide.includes(entityId);
}

// A camera that stopped working keeps its place, so it is clear that something is wrong with it.
// A restored entity is different: its device is gone for good.
function hasPicture(hass, entityId) {
  const state = hass.states[entityId];
  if (!state || state.attributes?.restored) return false;
  return state.state === "unavailable" || Boolean(state.attributes?.entity_picture);
}

// Cameras first: their picture is current, while a stored one can be hours old.
function cameraCandidates(hass, config) {
  return Object.keys(hass.entities)
    .filter((id) => (domainOf(id) === "image" && SNAPSHOT_IMAGE.test(id)) || isSnapshotCamera(hass, id, config))
    .filter((id) => isPrimary(hass.entities[id]) && effectiveArea(hass, id, config) && !config.cameras.hide.includes(id))
    .filter((id) => !isPrivate(hass, id, config))
    .sort((a, b) => domainOf(a).localeCompare(domainOf(b)) || a.localeCompare(b));
}

function automaticCameraIds(hass, config) {
  return cameraCandidates(hass, config).filter(
    (id) => hasPicture(hass, id) && !hiddenFromGuests(hass, id, config),
  );
}

function cameraEntry(hass, entityId) {
  const { state, attributes } = hass.states[entityId];
  const device = hass.devices[hass.entities[entityId]?.device_id];
  return {
    entityId,
    name: device?.name_by_user ?? device?.name ?? attributes.friendly_name ?? entityId,
    picture: attributes.entity_picture,
    unavailable: state === "unavailable",
    updatedAt: domainOf(entityId) === "image" ? Date.parse(state) || null : null,
  };
}

const inOrder = (ids, order, idOf = (id) => id) => {
  const rank = (id) => (order.includes(idOf(id)) ? order.indexOf(idOf(id)) : order.length);
  return [...ids].sort((a, b) => rank(a) - rank(b));
};

export function buildCameras(hass, config) {
  const { hero, tiles, hide, order } = config.cameras;
  const configured = [hero, ...tiles].filter(Boolean);
  const ids = configured.length ? configured : automaticCameraIds(hass, config);
  return inOrder(ids, order)
    .filter((id) => isGridSafe(hass, id, config) && hasPicture(hass, id) && !hiddenFromGuests(hass, id, config))
    .filter((id) => !hide.includes(id) && !isInDeniedArea(hass, id, config) && !isPrivate(hass, id, config))
    .map((id) => {
      const entry = cameraEntry(hass, id);
      const streams = cameraStreamSensors(hass, id, config);
      return { ...entry, streams, streaming: cameraStreaming(hass, streams) };
    });
}

// Who sees what comes first: what an administrator took away cannot be brought back by the person,
// and their own arrangement only moves and hides what is left.
const ACCESS_ELSEWHERE = new Set(["camera", "image", "scene", "script"]);
const ACCESS_LIGHTS = new Set(["light"]);
const ACCESS_MEDIA = new Set(["media_player", "remote"]);
const ACCESS_SECURITY = new Set(["alarm_control_panel", "lock"]);
const ACCESS_GROUPED = new Set([...ACCESS_LIGHTS, ...ACCESS_MEDIA, ...ACCESS_SECURITY]);
const inMode = (value, mode) => (typeof value === "string" ? value : value?.[mode]);

export const BACKGROUND_POSITIONS = ["top", "center", "bottom"];

// The slot of a look for a shape of screen: a tall one is the plain mode, a wide one has its own.
export const backgroundSlot = (mode, shape) => (shape === "wide" ? `${mode}_wide` : mode);
const shapeSlots = (mode, shape) => [backgroundSlot(mode, shape), backgroundSlot(mode, shape === "wide" ? "tall" : "wide")];

// The background everyone gets, for each mode and shape. A plain value is an older one, used everywhere.
export function sharedBackground(config, key, legacy) {
  const value = config.backgrounds[key] ?? legacy;
  const slots = ["light", "dark", "light_wide", "dark_wide"].map((slot) => [slot, inMode(value, slot) ?? null]);
  const position = typeof value === "string" ? null : (value?.position ?? null);
  return { ...Object.fromEntries(slots), position };
}

// A person's own choice wins, even when it is no background at all. A shape without its own picture
// takes the other shape of the same mode; a mode without a background shows the plain page of that
// mode, as the sheet says. Only an older plain value fills both modes.
export function pickBackground(config, key, legacy, mode, shape = "tall") {
  const [first, second] = shapeSlots(mode, shape);
  const own = config.personalBackgrounds?.[key];
  if (own && (first in own || second in own)) return own[first] ?? own[second] ?? null;
  const shared = sharedBackground(config, key, legacy);
  return shared[first] ?? shared[second] ?? null;
}

// Which part of a picture stays when the screen crops it.
export function pickBackgroundPosition(config, key, legacy) {
  const position = config.personalBackgrounds?.[key]?.position ?? sharedBackground(config, key, legacy).position;
  return BACKGROUND_POSITIONS.includes(position) ? position : "center";
}

function personalScenes(config, prefs) {
  const hidden = prefs.hidden_scenes ?? [];
  return inOrder(config.scenes.filter((item) => !hidden.includes(tileKey(item))), prefs.scenes ?? [], tileKey);
}

// A section is known by its title, so moving it in the editor keeps what someone hid; one without a
// title falls back to its place.
export const sectionId = (section, index) => (section.title ? `title:${section.title}` : `index:${index}`);

// What this person does not want in a room, and what an administrator took away from them.
function hiddenInRoom(config, roomId) {
  const prefix = `${roomId}|`;
  return {
    tiles: config.roomHidden?.tiles?.[roomId] ?? [],
    sections: [
      ...(config.roomHidden?.sections?.[roomId] ?? []),
      ...(config.deniedSections ?? []).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)),
    ],
  };
}

export function personalize(config, userId, prefs = {}) {
  const rule = config.access[userId] ?? {};
  const denied = [...(rule.hide ?? []), ...hiddenByRules(config, userId)];
  const deniedRooms = rule.rooms ?? [];
  const deniedAreas = config.layout
    .filter((room) => deniedRooms.includes(room.id))
    .flatMap((room) => room.areas ?? [])
    .concat(deniedRooms);
  return {
    ...config,
    denied,
    deniedAreas,
    personalBackgrounds: prefs.backgrounds ?? {},
    appearance: mergeAppearance(config.appearance, prefs.appearance),
    scenes: personalScenes(config, prefs),
    favorites: prefs.favorites ?? config.favorites,
    menuHidden: prefs.hidden_menu ?? [],
    roomHidden: { tiles: prefs.hidden_tiles ?? {}, sections: prefs.hidden_sections ?? {} },
    deniedSections: rule.sections ?? [],
    chipLayout: { order: prefs.chips ?? [], hidden: [...denied, ...(prefs.hidden_chips ?? [])] },
    rooms: {
      ...config.rooms,
      order: prefs.rooms?.length ? prefs.rooms : config.rooms.order,
      hidden: [...config.rooms.hidden, ...deniedAreas, ...(prefs.hidden_rooms ?? [])],
    },
    cameras: {
      ...config.cameras,
      order: prefs.cameras?.length ? prefs.cameras : config.cameras.order,
      hide: [...config.cameras.hide, ...denied, ...(prefs.hidden_cameras ?? [])],
    },
  };
}

// Everything a person may arrange, with what they hid themselves still on the list.
export function personalChoices(hass, raw, userId, prefs = {}) {
  const allowed = personalize(normalizeConfig(raw), userId);
  const rooms = buildRoomList(hass, allowed, selectEntities(hass, allowed));
  const hiddenRooms = prefs.hidden_rooms ?? [];
  const hiddenCameras = prefs.hidden_cameras ?? [];
  const cameras = new Map(buildCameras(hass, allowed).map((camera) => [camera.entityId, camera]));
  const hiddenChips = prefs.hidden_chips ?? [];
  const chips = homeChips(hass, allowed).filter(({ id }) => !allowed.denied.includes(id));
  const hiddenScenes = prefs.hidden_scenes ?? [];
  const hiddenMenu = prefs.hidden_menu ?? [];
  const sceneName = (item) => item.name ?? hass.states[item.entity]?.attributes.friendly_name ?? item.entity ?? "";
  const scenes = allowed.scenes.filter((item) => !allowed.denied.includes(tileKey(item)));
  const favorites = (prefs.favorites ?? allowed.favorites).filter((id) => hass.states[id] && !allowed.denied.includes(id));
  const menu = shownMenu(hass, { ...allowed, menuHidden: [] }, MENU_LINKS).flatMap((group) => group.items);
  return {
    scenes: inOrder(scenes, prefs.scenes ?? [], tileKey).map((item) => ({
      id: tileKey(item),
      name: sceneName(item),
      hidden: hiddenScenes.includes(tileKey(item)),
    })),
    favorites: favorites.map((id) => ({ id, name: hass.states[id].attributes.friendly_name ?? id })),
    menu: menu.map((item) => ({ id: menuKey(item), name: item.name, hidden: hiddenMenu.includes(menuKey(item)) })),
    chips: inOrder(chips, prefs.chips ?? [], ({ id }) => id).map((chip) => ({ ...chip, hidden: hiddenChips.includes(chip.id) })),
    cameras: inOrder([...cameras.keys()], prefs.cameras ?? []).map((id) => ({
      id,
      name: cameras.get(id).name,
      hidden: hiddenCameras.includes(id),
    })),
    rooms: byConfiguredOrder(rooms, prefs.rooms ?? []).map((room) => ({ ...room, hidden: hiddenRooms.includes(room.id) })),
  };
}

// The rooms and favorites everyone starts from, as an administrator arranges them. Rooms hidden for
// everyone stay on the list, so they can be shown again.
export function sharedLayoutChoices(hass, raw, draft) {
  const config = normalizeConfig(raw);
  const open = { ...config, rooms: { ...config.rooms, hidden: [] } };
  const rooms = buildRoomList(hass, open, selectEntities(hass, open));
  return {
    rooms: byConfiguredOrder(rooms, draft.order).map((room) => ({ ...room, hidden: draft.hidden.includes(room.id) })),
    favorites: draft.favorites
      .filter((id) => hass.states[id])
      .map((id) => ({ id, name: hass.states[id].attributes.friendly_name ?? id })),
  };
}

// What an administrator can take away from someone.
export function accessChoices(hass, raw) {
  const config = normalizeConfig(raw);
  const named = (id) => ({ id, name: hass.states[id]?.attributes?.friendly_name ?? id });
  const sorted = (items) => items.sort((a, b) => a.name.localeCompare(b.name, hass.language));
  const of = (domain) =>
    Object.keys(hass.states)
      .filter((id) => domainOf(id) === domain)
      .map(named);
  const selection = selectEntities(hass, config);
  const items = config.layout.flatMap((room) => [
    ...(room.home ?? []),
    ...(room.sections ?? []).flatMap((section) => section.tiles),
  ]);
  const names = new Map(items.filter((item) => item.entity && item.name).map((item) => [item.entity, item.name]));
  const listed = [...selection.entityIds, ...items.map((item) => item.entity).filter(Boolean), ...weatherEntities(hass)];
  const entities = [...new Set(listed)]
    .filter((id) => hass.states[id] && !ACCESS_ELSEWHERE.has(domainOf(id)))
    .map((id) => ({ ...named(id), name: names.get(id) ?? named(id).name }));
  const group = (domains) => entities.filter(({ id }) => domains.has(domainOf(id)));
  const blocks = items
    .filter((item) => item.name && !item.entity)
    .map((item) => ({ id: blockKey(item), name: item.name }));
  const unique = [...new Map(blocks.map((block) => [block.id, block])).values()];
  return {
    chips: homeChips(hass, config),
    sections: config.layout.flatMap((room) =>
      (room.sections ?? []).map((section, index) => ({
        id: `${room.id}|${sectionId(section, index)}`,
        name: `${room.name} · ${section.title || `#${index + 1}`}`,
      })),
    ),
    rooms: buildRoomList(hass, config, selection),
    cameras: buildCameras(hass, config).map((camera) => ({ id: camera.entityId, name: camera.name })),
    actions: sorted([...of("scene"), ...of("script")]),
    lights: sorted(group(ACCESS_LIGHTS)),
    media: sorted(group(ACCESS_MEDIA)),
    security: sorted(group(ACCESS_SECURITY)),
    other: sorted([...unique, ...entities.filter(({ id }) => !ACCESS_GROUPED.has(domainOf(id)))]),
  };
}

// The strip alternates one large picture with a column of two smaller ones.
// A camera that does not work goes to the end, into the small pictures: it stays visible without
// taking the large place from one that does, unless nothing works at all.
export function cameraColumns(cameras) {
  const working = cameras.filter((camera) => !camera.unavailable);
  const ordered = working.length ? [...working, ...cameras.filter((camera) => camera.unavailable)] : cameras;
  const columns = [];
  for (let index = 0; index < ordered.length; index += columns.at(-1).length) {
    const small = columns.length % 2 === 1 || (working.length > 0 && ordered[index].unavailable);
    columns.push(ordered.slice(index, index + (small && index + 1 < ordered.length ? 2 : 1)));
  }
  return columns;
}

export function pictureAge(language, updatedAt, now) {
  if (!updatedAt) return translate(language, "age_now");
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (seconds < 60) return translate(language, "age_seconds", { count: seconds });
  if (seconds < 3600) return translate(language, "age_minutes", { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return translate(language, "age_hours", { count: Math.floor(seconds / 3600) });
  return translate(language, "age_days", { count: Math.floor(seconds / 86400) });
}

// The camera that shows the same place as a stored picture: set by hand or found on its device.
// Moving a camera: the buttons its device has for each direction, by the names integrations give them.
const PTZ_NAMES = {
  left: /(pan|ptz|move)_?left$/,
  right: /(pan|ptz|move)_?right$/,
  up: /(tilt|ptz|move)_?up$/,
  down: /(tilt|ptz|move)_?down$/,
};

export function cameraDeviceId(hass, entityId, config) {
  const cameraId = liveCameraFor(hass, entityId, config) ?? entityId;
  return hass.entities[cameraId]?.device_id ?? hass.entities[entityId]?.device_id ?? null;
}

// What says a camera on a battery is connected: eufy's "streaming", Neolink's link to the camera and its recording of a
// live view. Each one on is the camera awake and its battery going.
const STREAM_SENSOR = /_(streaming|camera_link|recording_live_view)$/;

/** The sensors that say a stream of this camera is open: on its device, or on the device it is linked to. */
export function cameraStreamSensors(hass, entityId, config) {
  const devices = new Set([cameraDeviceId(hass, entityId, config), controlDeviceId(hass, entityId, config)].filter(Boolean));
  return Object.keys(hass.entities)
    .filter((id) => id.startsWith("binary_sensor.") && STREAM_SENSOR.test(id) && devices.has(hass.entities[id].device_id))
    .sort();
}

/** Whether a stream of the camera is open now, from Home Assistant or anything else asking the bridge. */
export const cameraStreaming = (hass, sensors) => sensors.some((id) => hass.states[id]?.state === "on");

const deviceEntities = (hass, deviceId) =>
  deviceId ? Object.keys(hass.entities).filter((id) => hass.entities[id].device_id === deviceId && hass.states[id]) : [];

// The directions this camera can move in, and its saved positions if it has them.
// The device whose buttons turn the camera. `cameras.controls` names another camera for it, when the picture comes
// from one system (e.g. Frigate) and turning from another (e.g. the camera's own integration).
function controlDeviceId(hass, entityId, config) {
  const other = config.cameras.controls?.[entityId];
  return (other && hass.entities[other]?.device_id) || cameraDeviceId(hass, entityId, config);
}

// The cameras of the dashboard and the links between them: the picture comes from one camera (e.g. Frigate), the
// speaker and turning from the same camera in another integration (e.g. eufy). Feeds the choice in the settings.
export function cameraLinks(hass, config) {
  const name = (id) => hass.states[id]?.attributes?.friendly_name ?? id;
  const controls = config.cameras.controls ?? {};
  const cameras = buildCameras(hass, config).map((camera) => ({ entityId: camera.entityId, name: camera.name }));
  const links = Object.entries(controls).map(([entityId, other]) => ({
    entityId,
    name: cameras.find((camera) => camera.entityId === entityId)?.name ?? name(entityId),
    other,
    otherName: name(other),
  }));
  return { cameras: cameras.filter((camera) => !controls[camera.entityId]), links };
}

// The cameras another camera can be linked to: those of any other integration.
export function linkChoices(hass, entityId) {
  const platform = hass.entities[entityId]?.platform;
  return Object.keys(hass.entities)
    .filter((id) => domainOf(id) === "camera" && id !== entityId && hass.states[id] && hass.entities[id].platform !== platform)
    .map((id) => ({ entityId: id, name: hass.states[id].attributes?.friendly_name ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Ways to turn a camera, tried in this order unless `cameras.ptz` chooses one: entities chosen by hand, a ready-made
// set of an integration (found by the translation keys of its entities, so names in any language do), ONVIF's
// service, and buttons found by their names. A move is a service call, so a button, a script and ONVIF are alike.
export const PTZ_MODES = ["auto", "eufy", "onvif", "manual", "none"];
export const PTZ_PRESETS = {
  eufy: { platform: "eufy_sdk", left: "pan_left", right: "pan_right", up: "tilt_up", down: "tilt_down", select: "preset", button: "preset_goto" },
};
const DIRECTIONS = ["left", "right", "up", "down"];
const ONVIF_MOVES = { left: { pan: "LEFT" }, right: { pan: "RIGHT" }, up: { tilt: "UP" }, down: { tilt: "DOWN" } };
const ONVIF_STEP = { move_mode: "ContinuousMove", continuous_duration: 0.5, speed: 0.5 };

// Translation keys of entities, read from the entity registry once: the list Home Assistant hands every page
// leaves them out.
const translationKeys = new Map();

export async function loadTranslationKeys(hass, entityIds) {
  const missing = entityIds.filter((id) => !translationKeys.has(id));
  if (!missing.length) return false;
  try {
    const entries = await hass.callWS({ type: "config/entity_registry/get_entries", entity_ids: missing });
    for (const id of missing) translationKeys.set(id, entries?.[id]?.translation_key ?? null);
  } catch {
    for (const id of missing) translationKeys.set(id, null);
  }
  return true;
}

/** The entities of the device that turns this camera, whose translation keys a ready-made set looks for. */
export function controlEntityIds(hass, entityId, config) {
  return deviceEntities(hass, controlDeviceId(hass, entityId, config));
}

/** What a tap on an entity chosen for a move does: a button is pressed, a script or scene is run. */
export function pressCall(entityId) {
  const domain = domainOf(entityId);
  const service = domain === "script" || domain === "scene" ? "turn_on" : "press";
  return { domain, service, data: { entity_id: entityId }, entity: entityId };
}

/** The calls that take a camera to one of its saved positions. */
export function presetCalls(presets, option) {
  if (presets.onvif) {
    return [{ domain: "onvif", service: "ptz", data: { entity_id: presets.onvif, move_mode: "GotoPreset", preset: option } }];
  }
  return [
    { domain: "select", service: "select_option", data: { entity_id: presets.select, option } },
    pressCall(presets.button),
  ];
}

function entityPresets(hass, select, button) {
  if (!select || !button || !hass.states[select]) return null;
  // Positions nobody saved are listed by some cameras as "empty"; they lead nowhere.
  const options = (hass.states[select].attributes.options ?? []).filter((option) => !/empty$/i.test(String(option).trim()));
  return options.length ? { select, button, options, current: hass.states[select].state } : null;
}

function byKeys(hass, ids, preset) {
  const find = (key) => ids.find((id) => translationKeys.get(id) === key && hass.entities[id]?.platform === preset.platform);
  const moves = Object.fromEntries(DIRECTIONS.map((direction) => [direction, find(preset[direction])]).filter(([, id]) => id));
  return { moves: mapMoves(moves), presets: entityPresets(hass, find(preset.select), find(preset.button)) };
}

const mapMoves = (moves) => Object.fromEntries(Object.entries(moves).map(([direction, id]) => [direction, pressCall(id)]));

function byOnvif(hass, ids, setting) {
  const camera = ids.find((id) => domainOf(id) === "camera" && hass.entities[id]?.platform === "onvif");
  if (!camera) return null;
  const moves = Object.fromEntries(
    DIRECTIONS.map((direction) => [direction, { domain: "onvif", service: "ptz", data: { entity_id: camera, ...ONVIF_MOVES[direction], ...ONVIF_STEP } }]),
  );
  const options = (setting.presets ?? []).map(String).filter(Boolean);
  return { moves, presets: options.length ? { onvif: camera, options, current: null } : null };
}

function byNames(hass, ids) {
  const buttons = ids.filter((id) => domainOf(id) === "button");
  const moves = Object.fromEntries(
    Object.entries(PTZ_NAMES)
      .map(([direction, name]) => [direction, buttons.find((id) => name.test(id.split(".")[1]))])
      .filter(([, id]) => id),
  );
  const select = ids.find((id) => domainOf(id) === "select" && /preset/.test(id));
  return { moves: mapMoves(moves), presets: entityPresets(hass, select, buttons.find((id) => /go_?to_?preset/.test(id))) };
}

const found = (controls) => controls && (Object.keys(controls.moves).length || controls.presets) ? controls : null;

/** How this camera turns: `{ mode, moves: { left: call… }, presets }`, the mode being the way that was used. */
export function cameraMoves(hass, entityId, config) {
  const setting = config.cameras.ptz?.[entityId] ?? {};
  const mode = PTZ_MODES.includes(setting.mode) ? setting.mode : "auto";
  const none = { mode: "none", moves: {}, presets: null };
  if (mode === "none") return none;
  if (mode === "manual") {
    const moves = Object.fromEntries(DIRECTIONS.filter((direction) => setting[direction]).map((d) => [d, pressCall(setting[d])]));
    return { mode, moves, presets: entityPresets(hass, setting.select, setting.button) };
  }
  const ids = controlEntityIds(hass, entityId, config).filter((id) => !hass.entities[id].hidden);
  if (mode === "auto" || PTZ_PRESETS[mode]) {
    for (const [name, preset] of Object.entries(PTZ_PRESETS)) {
      if (mode !== "auto" && mode !== name) continue;
      const controls = found(byKeys(hass, ids, preset));
      if (controls) return { mode: name, ...controls };
    }
  }
  if (mode === "auto" || mode === "onvif") {
    const controls = found(byOnvif(hass, ids, setting));
    if (controls) return { mode: "onvif", ...controls };
  }
  if (mode === "auto") {
    const controls = found(byNames(hass, ids));
    if (controls) return { mode: "names", ...controls };
  }
  return { ...none, mode };
}

// Quick buttons of a camera: its siren, its light and its night vision, from the entities of the device that turns
// it (so a Frigate picture borrows them from the same camera in its own integration). Found by what does not depend
// on the language: the siren domain, a light or a switch named for the light, a list named for night vision or
// infrared (Neolink: auto/on/off) or offering infrared.
const LIGHT_SWITCH = /(^|_)(light|spotlight|floodlight|flood_light|lamp)$/;
const NIGHT_VISION = /night_?vision|infrared/;

// What may stand behind each quick button when it is chosen by hand (`cameras.quick`): a siren or anything turned on
// and off, a lamp or a switch, a list.
export const QUICK_DOMAINS = {
  siren: ["siren", "switch", "input_boolean", "script"],
  light: ["light", "switch", "input_boolean"],
  night: ["select", "input_select"],
};

export function cameraQuickControls(hass, entityId, config) {
  const ids = controlEntityIds(hass, entityId, config).filter(
    (id) => !hass.entities[id].hidden && hass.states[id]?.state !== "unavailable",
  );
  // `cameras.quick` chooses by hand: an entity of any device (another camera's, a lamp in the garden), or "none".
  const chosen = config.cameras.quick?.[entityId] ?? {};
  const pick = (key, found) => {
    const value = chosen[key];
    if (value === "none") return null;
    if (value && hass.states[value] && QUICK_DOMAINS[key].includes(domainOf(value))) return value;
    return found();
  };
  const siren = pick("siren", () => ids.find((id) => domainOf(id) === "siren") ?? null);
  const light = pick(
    "light",
    () =>
      ids.find((id) => domainOf(id) === "light") ??
      ids.find((id) => domainOf(id) === "switch" && LIGHT_SWITCH.test(id.split(".")[1])) ??
      null,
  );
  const night = pick(
    "night",
    () =>
      ids.find((id) => domainOf(id) === "select" && NIGHT_VISION.test(id)) ??
      ids.find((id) => domainOf(id) === "select" && (hass.states[id].attributes.options ?? []).some((o) => /infrared/i.test(o))) ??
      null,
  );
  return {
    siren,
    light,
    night: night ? { entity: night, options: hass.states[night].attributes.options ?? [], current: hass.states[night].state } : null,
  };
}

/** The entities a camera's turning uses, which its window of settings leaves out. */
export function cameraMoveEntities(controls) {
  const ids = Object.values(controls.moves).map((call) => call.entity).filter(Boolean);
  if (controls.presets?.select) ids.push(controls.presets.select, controls.presets.button);
  return ids;
}

const READ_ONLY = new Set(["sensor", "binary_sensor"]);
const SETTING_DOMAINS = new Set(["switch", "select", "number", "input_boolean", "input_select", "input_number"]);

// A window with what a device reports and what can be set on it, made from its other entities, in tabs: its
// settings, its state, its buttons and what it did lately. A group shows its members first. Every device gets the
// same window; a list of entities chooses them by hand.
export function deviceSettingsPanel(hass, entityId, title, { deviceId, exclude = [], chosen = null } = {}) {
  const device = hass.devices[deviceId ?? hass.entities[entityId]?.device_id];
  const prefix = (device?.name_by_user ?? device?.name ?? "").trim();
  const name = (id) => {
    const full = hass.states[id]?.attributes.friendly_name ?? id;
    return prefix && full.startsWith(prefix) && full.length > prefix.length ? full.slice(prefix.length).trim() : full;
  };
  const row = (id) => ({ entity: id, name: name(id) });
  const byName = (first, second) => name(first).localeCompare(name(second), hass.language);
  const t = (key) => translate(hass.language, key);
  const members = (hass.states[entityId]?.attributes.entity_id ?? []).filter((id) => hass.states[id]);
  const panel = (groups, related) => ({
    kind: "panel",
    name: title,
    entity: entityId,
    details: entityId,
    tabs: true,
    activity: [entityId, ...related.filter((id) => id !== entityId)],
    groups,
  });
  if (chosen?.length) {
    const rows = chosen.filter((id) => hass.states[id]);
    return panel([{ key: "settings", title: t("camera_settings_config"), rows: rows.map(row) }], rows);
  }
  const ids = device
    ? deviceEntities(hass, device.id).filter(
        (id) =>
          id !== entityId && !exclude.includes(id) && !hass.entities[id].hidden && hass.states[id].state !== "unavailable",
      )
    : [];
  const settings = ids.filter((id) => SETTING_DOMAINS.has(domainOf(id))).sort(byName);
  const state = ids.filter((id) => READ_ONLY.has(domainOf(id))).sort(byName);
  const actions = ids.filter((id) => domainOf(id) === "button").sort(byName);
  return panel(
    [
      { key: "members", title: t("settings_members"), rows: members.map(row) },
      { key: "settings", title: t("camera_settings_config"), rows: settings.map(row) },
      { key: "state", title: t("camera_settings_state"), rows: state.map(row) },
      { key: "actions", title: t("camera_settings_actions"), rows: actions.map(row) },
    ].filter((group) => group.rows.length),
    [...members, ...settings, ...state, ...actions],
  );
}

// A camera's window of settings leaves out its buttons for turning, which have their own place.
export function cameraSettingsPanel(hass, entityId, config, title) {
  const cameraId = liveCameraFor(hass, entityId, config) ?? entityId;
  const panel = deviceSettingsPanel(hass, cameraId, title, {
    deviceId: cameraDeviceId(hass, entityId, config),
    exclude: cameraMoveEntities(cameraMoves(hass, entityId, config)),
    chosen: config.cameras.settings?.[cameraId],
  });
  // A camera that says when it is streaming gets a log of its connections: when and for how long it was awake.
  const sensors = cameraStreamSensors(hass, entityId, config);
  if (!sensors.length) return panel;
  return { ...panel, groups: [...panel.groups, { key: "connections", title: translate(hass.language, "conn_title"), rows: [], connections: sensors }] };
}

export function liveCameraFor(hass, imageId, config) {
  if (domainOf(imageId) === "camera") return imageId;
  const configured = config.cameras.live[imageId];
  if (configured) return configured;
  const deviceId = hass.entities[imageId]?.device_id;
  if (!deviceId) return null;
  return (
    Object.keys(hass.entities).find(
      (id) => domainOf(id) === "camera" && hass.entities[id].device_id === deviceId && isPrimary(hass.entities[id]),
    ) ?? null
  );
}

// A camera is on a battery when its platform is known to be, or when its device reports a battery level.
export function isBatteryCamera(hass, entityId, config) {
  if (config.cameras.battery_platforms.includes(hass.entities[entityId]?.platform)) return true;
  const deviceId = hass.entities[entityId]?.device_id;
  if (!deviceId) return false;
  return Object.values(hass.entities).some(
    (entity) =>
      entity.device_id === deviceId &&
      domainOf(entity.entity_id) === "sensor" &&
      hass.states[entity.entity_id]?.attributes?.device_class === "battery",
  );
}

function climateChip(hass, ids) {
  const temperatures = ids
    .filter((id) => domainOf(id) === "climate")
    .map((id) => hass.states[id].attributes?.current_temperature)
    .filter((value) => typeof value === "number");
  if (!temperatures.length) return translate(hass.language, "no_data");
  const low = Math.min(...temperatures).toFixed(1);
  const high = Math.max(...temperatures).toFixed(1);
  return low === high ? `${low}°` : `${low} - ${high}°`;
}

const FILTERS = {
  climate: (tile) =>
    tile.domain === "climate" || tile.domain === "fan" || (tile.domain === "cover" && !SECURITY_COVERS.has(tile.deviceClass)),
  lights: (tile) => tile.domain === "light",
  security: (tile) =>
    tile.domain === "lock" ||
    tile.domain === "alarm_control_panel" ||
    (tile.domain === "cover" && SECURITY_COVERS.has(tile.deviceClass)),
  media: (tile) => tile.domain === "media_player" || tile.media,
};

// Tiles the user keeps together at the top of the security filter, wherever their rooms are.
function securityGroup(model) {
  const { name, entities = [] } = model.securityGroup ?? {};
  const known = [...model.rooms, ...(model.filterRooms ?? [])].flatMap((room) => room.tiles);
  const tiles = entities.map((id) => known.find((tile) => tile.entityId === id)).filter(Boolean);
  return tiles.length ? [{ id: "__security_group", name, tiles, plain: true }] : [];
}

export function applyFilter(model, key, language) {
  const matches = FILTERS[key];
  if (!matches) return model;
  const rooms = (model.filterRooms ?? model.rooms)
    .map((room) => ({ ...room, tiles: room.tiles.filter(matches) }))
    .filter((room) => room.tiles.length);
  return {
    ...model,
    title: translate(language, `chip_${key}`),
    filter: key,
    favorites: [],
    scenes: [],
    cameras: [],
    cameraList: key === "security" ? model.cameras : [],
    rooms: key === "security" ? [...securityGroup(model), ...rooms] : rooms,
  };
}

export const chipKey = (key) => `chip:${key}`;

// Everything that can stand in the row on Home, in its shared order.
function homeChips(hass, config) {
  const fixed = [...(buildWeather(hass, config) ? ["weather"] : []), "climate", "lights", "security", "media"];
  return [
    ...fixed.map((key) => ({ id: chipKey(key), name: translate(hass.language, `chip_${key}`) })),
    ...config.shortcuts.filter((item) => item.name).map((item) => ({ id: blockKey(item), name: item.name })),
  ];
}

// A chip that filters the page stays until the filter is off, or nothing could turn it off.
export function arrangeChips(entries, config, selected) {
  const { order, hidden } = config.chipLayout;
  return inOrder(entries, order, ({ id }) => id).filter(({ id }) => id === selected || !hidden.includes(id));
}

export function buildChips(hass, selection) {
  const { language } = hass;
  const ids = selection.entityIds;
  const count = (domain, state) =>
    ids.filter((id) => domainOf(id) === domain && hass.states[id].state === state).length;
  const unlocked = ids.filter((id) => domainOf(id) === "lock" && hass.states[id].state === "unlocked").length;
  const triggered = alarmPanels(hass).filter((id) => hass.states[id].state === "triggered").length;
  const playing = selection.mediaGroups.filter((members) =>
    members.some((id) => hass.states[id]?.state === "playing"),
  ).length;
  return [
    { key: "climate", icon: "mdi:thermometer", tone: "climate", label: translate(language, "chip_climate"), value: climateChip(hass, ids) },
    { key: "lights", icon: "mdi:lightbulb", tone: "light", label: translate(language, "chip_lights"), value: translate(language, "lights_on", { count: count("light", "on") }) },
    {
      key: "security",
      icon: triggered ? "mdi:alarm-light" : unlocked ? "mdi:lock-open-variant" : "mdi:lock",
      tone: "security",
      label: translate(language, "chip_security"),
      value: triggered
        ? translate(language, "security_triggered", { count: triggered })
        : unlocked
          ? translate(language, "security_unlocked", { count: unlocked })
          : translate(language, "security_ok"),
    },
    {
      key: "media",
      icon: "mdi:play-box-multiple",
      tone: "media",
      label: translate(language, "chip_media"),
      value: playing ? translate(language, "media_playing", { count: playing }) : translate(language, "media_idle"),
    },
  ];
}

export const weatherIcon = (condition) => WEATHER_ICONS[condition] ?? "mdi:weather-cloudy";

function weatherEntities(hass) {
  return Object.keys(hass.states)
    .filter((id) => domainOf(id) === "weather" && !hass.entities[id]?.hidden && !hass.states[id].attributes?.restored)
    .sort();
}

// A home station measures the present and a weather service knows the future, so the chip and the
// forecast can come from two entities. Nothing configured: the first one, and the first that forecasts.
export function buildWeather(hass, config) {
  if (!config.weather) return null;
  const found = weatherEntities(hass);
  const entity = config.weather.entity ?? found[0];
  const stateObj = hass.states[entity];
  if (!stateObj || config.denied?.includes(entity)) return null;
  const forecasts = (id) => (hass.states[id]?.attributes?.supported_features ?? 0) & (FORECAST_DAILY | FORECAST_HOURLY);
  const { temperature } = stateObj.attributes;
  return {
    entity,
    forecast: config.weather.forecast ?? [entity, ...found].find(forecasts) ?? null,
    icon: weatherIcon(stateObj.state),
    tone: stateObj.state === "sunny" ? "light" : "media",
    label: translate(hass.language, "chip_weather"),
    value: typeof temperature === "number" ? `${temperature.toFixed(1)}°` : translate(hass.language, "no_data"),
  };
}

export function greeting(hass, now = new Date()) {
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = hass.user?.name?.split(" ")[0];
  const text = translate(hass.language, `greeting_${part}`);
  return firstName ? `${text} ${firstName}` : text;
}

// A restored entity is only a memory of a device that the integration no longer has.
function alarmPanels(hass) {
  return Object.keys(hass.states).filter(
    (id) => domainOf(id) === "alarm_control_panel" && !hass.states[id].attributes?.restored,
  );
}

// Integrations name a panel after its function, the same on every device, so the device says more.
function alarmName(hass, tile) {
  if (tile.domain !== "alarm_control_panel") return tile.name;
  const device = hass.devices[hass.entities[tile.entityId]?.device_id];
  return device?.name_by_user ?? device?.name ?? tile.name;
}

// Televisions, soundbars and the like live in the layout of their rooms, with what they need to work.
function withMediaTiles(hass, config, rooms, layout) {
  const listed = new Set(config.media.sections.flatMap((section) => section.tiles ?? []).map((item) => item.entity));
  const result = [...rooms];
  for (const room of config.layout.filter((entry) => entry.areas?.length)) {
    const items = (room.sections ?? [])
      .flatMap((section) => section.tiles)
      .filter((item) => listed.has(item.entity) && mediaGroupKey(item.entity, config.media.group_patterns) === null);
    const tiles = items
      .map((item) => layoutTile(hass, { ...item, active_only: false }, room.name, config, layout))
      .filter(Boolean)
      .map((tile) => ({ ...tile, media: true }));
    if (!tiles.length) continue;
    const index = result.findIndex((entry) => entry.id === room.id);
    if (index < 0) result.push({ id: room.id, name: room.name, tiles });
    else result[index] = { ...result[index], tiles: [...result[index].tiles, ...tiles] };
  }
  return result;
}

// Alarm panels are not tiles by default, but the security filter must not leave them out. Names
// given in the layout win over the long ones from the integrations.
function filterRooms(hass, config, selection, layout) {
  const alarms = alarmPanels(hass).filter((id) => isPrimary(hass.entities[id]));
  const names = new Map(
    config.layout
      .flatMap((room) => [...(room.home ?? []), ...(room.sections ?? []).flatMap((section) => section.tiles)])
      .filter((item) => item.entity && item.name)
      .map((item) => [item.entity, item.name]),
  );
  const wider = { ...selection, entityIds: [...new Set([...selection.entityIds, ...alarms])] };
  const rooms = buildRooms(hass, config, wider, layout).map((room) => ({
    ...room,
    tiles: room.tiles.map((tile) => ({ ...tile, name: names.get(tile.entityId) ?? alarmName(hass, tile) })),
  }));
  return withMediaTiles(hass, config, rooms, layout);
}

export function buildHomeModel(hass, config, selection, layout = "phone", now = new Date()) {
  return {
    title: greeting(hass, now),
    chips: buildChips(hass, selection),
    weather: buildWeather(hass, config),
    cameras: buildCameras(hass, config),
    favorites: config.favorites
      .map((id) => {
        const area = effectiveArea(hass, id, config);
        return buildTile(hass, id, hass.areas[area]?.name ?? null, config, layout);
      })
      .filter(Boolean),
    scenes: config.scenes.map((item) => layoutTile(hass, item, null, config, layout)).filter(Boolean),
    rooms: shownRooms(hass, config, selection, layout).filter((room) => room.tiles.length),
    // A layout lists what the user wants at a glance; a filter answers for the whole house.
    filterRooms: filterRooms(hass, config, selection, layout),
    securityGroup: config.security.group,
    intercom: config.intercom.script ? intercomAreas(hass, config) : [],
  };
}

// A speaker can say it plays long after a stream ended, with nothing to show: that is not playing.
export const hasMedia = (stateObj) => Boolean(stateObj?.attributes?.media_title || stateObj?.attributes?.media_content_id);

// What the small player shows: something playing, else something paused for less than `pausedMinutes`
// (0: nothing paused at all). A player someone closed stays away until it plays something again.
export function nowPlaying(hass, selection, { pausedMinutes = 10, now = Date.now(), dismissed = null } = {}) {
  const ids = selection.mediaGroups.flat();
  const shown = (id) => hasMedia(hass.states[id]) && mediaKey(hass.states[id]) !== dismissed;
  const playing = ids.find((id) => hass.states[id]?.state === "playing" && shown(id));
  if (playing) return playing;
  if (!pausedMinutes) return null;
  const recent = (id) => now - new Date(hass.states[id].last_changed ?? 0).getTime() < pausedMinutes * 60000;
  return ids.find((id) => hass.states[id]?.state === "paused" && shown(id) && recent(id)) ?? null;
}

// What a closed player was showing, so that it comes back for anything new.
export const mediaKey = (stateObj) =>
  stateObj ? [stateObj.entity_id, stateObj.state, stateObj.attributes?.media_title ?? stateObj.attributes?.media_content_id].join("|") : null;

export function buildPlayer(hass, entityId, config, now = Date.now()) {
  const stateObj = hass.states[entityId];
  if (!stateObj) return null;
  const { attributes, state } = stateObj;
  const features = attributes.supported_features ?? 0;
  const room = hass.areas[effectiveArea(hass, entityId, config)]?.name;
  const updated = attributes.media_position_updated_at;
  const elapsed = state === "playing" && updated ? (now - new Date(updated).getTime()) / 1000 : 0;
  return {
    entityId,
    state,
    playing: state === "playing",
    room: room ?? attributes.friendly_name ?? entityId,
    title: attributes.media_title ?? attributes.friendly_name ?? entityId,
    artist: attributes.media_artist ?? attributes.media_album_name ?? "",
    picture: attributes.entity_picture ?? null,
    duration: attributes.media_duration ?? 0,
    position: Math.min((attributes.media_position ?? 0) + elapsed, attributes.media_duration ?? Infinity),
    volume: attributes.volume_level ?? null,
    shuffle: attributes.shuffle ?? false,
    repeat: attributes.repeat ?? "off",
    can: Object.fromEntries(Object.entries(MEDIA_FEATURES).map(([name, bit]) => [name, Boolean(features & bit)])),
  };
}

// Pictures and cameras are media sources too, but this page is for things to listen to and watch.
export function playableSources(children = []) {
  return children
    .filter((source) => !NON_PLAYABLE_SOURCE.test(source.media_content_id ?? ""))
    .map((source) => ({
      title: source.title,
      // Brand images need a token that plain <img> requests do not have.
      thumbnail: source.thumbnail?.startsWith("/api/brands") ? null : (source.thumbnail ?? null),
    }));
}

export function nextRepeat(repeat) {
  return { off: "all", all: "one", one: "off" }[repeat] ?? "off";
}

// The media page in the user's own groups; without them it lists the speakers.
export function buildMediaSections(hass, config, layout = "phone") {
  return config.media.sections
    .map(({ title, tiles }) => ({
      title,
      tiles: (tiles ?? []).map((item) => layoutTile(hass, item, null, config, layout)).filter(Boolean),
    }))
    .filter(({ tiles }) => tiles.length);
}

export function buildSpeakers(hass, config, selection, layout = "phone") {
  return selection.mediaGroups
    .map((members) => {
      const entityId = activeMediaMember(hass, members);
      const area = effectiveArea(hass, entityId, config);
      return buildTile(hass, entityId, hass.areas[area]?.name ?? null, config, layout);
    })
    .filter(Boolean)
    .map((tile) => ({ ...tile, name: tile.roomName ?? tile.name }));
}

export function distanceKm(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitude = radians(to.latitude - from.latitude);
  const longitude = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function distanceText(language, kilometres) {
  if (kilometres < 1) return translate(language, "distance_m", { value: Math.round(kilometres * 1000) });
  return translate(language, "distance_km", { value: Math.round(kilometres) });
}

// People with a known position first, nearest to home at the top.
export function buildPeople(hass) {
  const home = hass.states["zone.home"]?.attributes;
  const people = Object.values(hass.states)
    .filter((stateObj) => domainOf(stateObj.entity_id) === "person")
    .map((stateObj) => {
      const { latitude, longitude, friendly_name: name, entity_picture: picture } = stateObj.attributes;
      const located = latitude != null && longitude != null && home?.latitude != null;
      const kilometres = located ? distanceKm(home, { latitude, longitude }) : null;
      return {
        entityId: stateObj.entity_id,
        name: name ?? stateObj.entity_id,
        picture: picture ?? null,
        state: hass.formatEntityState?.(stateObj) ?? stateObj.state,
        known: !["unknown", "unavailable"].includes(stateObj.state),
        changed: stateObj.last_changed ?? null,
        position: located ? [latitude, longitude] : null,
        kilometres,
        distance: kilometres === null || stateObj.state === "home" ? "" : distanceText(hass.language, kilometres),
      };
    });
  return people.sort((a, b) => (a.kilometres ?? Infinity) - (b.kilometres ?? Infinity) || a.name.localeCompare(b.name));
}

// What else the map can show: anything that reports where it is, and the zones.
export function buildTrackers(hass, config) {
  return Object.values(hass.states)
    .filter(({ entity_id: id, attributes }) => domainOf(id) === "device_tracker" && attributes.latitude != null)
    .filter(({ entity_id: id }) => !config.denied?.includes(id))
    .map((stateObj) => ({
      entityId: stateObj.entity_id,
      name: stateObj.attributes.friendly_name ?? stateObj.entity_id,
      icon: stateObj.attributes.icon ?? "mdi:cellphone",
      state: hass.formatEntityState?.(stateObj) ?? stateObj.state,
      changed: stateObj.last_changed ?? null,
      position: [stateObj.attributes.latitude, stateObj.attributes.longitude],
    }))
    .sort((first, second) => first.name.localeCompare(second.name, hass.language));
}

export const MAP_HOURS = [6, 24, 72, 168];

// The map of the Map page: where the people and the chosen devices went in the last hours, with the
// zones. Home Assistant draws a route only for what is listed, so everything is listed.
export function mapCardConfig({ people, devices, zones }, { track = [], who = "all", hours = 24, dark = false } = {}) {
  const subjects = [...people.map(({ entityId }) => entityId), ...devices.filter(({ entityId }) => track.includes(entityId)).map(({ entityId }) => entityId)];
  const chosen = who !== "all" && subjects.includes(who) ? [who] : subjects;
  return {
    type: "map",
    theme_mode: dark ? "dark" : "light",
    auto_fit: true,
    fit_zones: false,
    hours_to_show: hours,
    entities: [...chosen.map((entity) => ({ entity })), ...zones.map(({ entityId }) => entityId)],
  };
}

export function buildZones(hass) {
  return Object.values(hass.states)
    .filter(({ entity_id: id, attributes }) => domainOf(id) === "zone" && attributes.latitude != null)
    .map(({ entity_id: entityId, state, attributes }) => ({
      entityId,
      name: attributes.friendly_name ?? entityId,
      icon: attributes.icon ?? "mdi:map-marker",
      people: Number(state) || 0,
      position: [attributes.latitude, attributes.longitude],
    }))
    .sort((first, second) => second.people - first.people || first.name.localeCompare(second.name, hass.language));
}

export function toggleInList(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function moveInList(list, id, delta) {
  const from = list.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return list;
  const moved = [...list];
  moved.splice(from, 1);
  moved.splice(to, 0, id);
  return moved;
}

// A block has no entity of its own to be hidden by.
export const blockKey = (item) => `block:${item.name}`;

// Rules refer to a block by its name, so a new name has to reach them.
export function renameBlockRules(raw, from, to) {
  if (from === to) return raw;
  const [before, after] = [blockKey({ name: from }), blockKey({ name: to })];
  const access = Object.entries(raw.access ?? {}).map(([user, rule]) => [
    user,
    rule.hide ? { ...rule, hide: rule.hide.map((id) => (id === before ? after : id)) } : rule,
  ]);
  const visibility = Object.entries(raw.visibility ?? {}).map(([key, rule]) => [key === before ? after : key, rule]);
  return {
    ...raw,
    ...(raw.access ? { access: Object.fromEntries(access) } : {}),
    ...(raw.visibility ? { visibility: Object.fromEntries(visibility) } : {}),
  };
}

export const tileKey = (item) => item.entity ?? (item.shortcut ? `shortcut:${item.shortcut}` : blockKey(item));

// A rule belongs to what is shown, not to one tile of it: `only` names the people who see it, and
// without them `except` names those who do not.
function hiddenByRules(config, userId) {
  return Object.entries(config.visibility)
    .filter(([, rule]) => (rule.only?.length ? !rule.only.includes(userId) : rule.except?.includes(userId)))
    .map(([key]) => key);
}

// Green for what only some people see, red for what some people do not.
export function visibilityMark(config, key) {
  const rule = config.visibility[key];
  if (rule?.only?.length) return "only";
  if (rule?.except?.length) return "except";
  return Object.values(config.access).some((access) => access.hide?.includes(key)) ? "except" : null;
}

// The rule as the editor shows it: what was hidden in user access counts as `except` too.
export function visibilityRule(config, key) {
  const rule = config.visibility[key] ?? {};
  const hidden = Object.entries(config.access)
    .filter(([, access]) => access.hide?.includes(key))
    .map(([id]) => id);
  return { only: rule.only ?? [], except: [...new Set([...(rule.except ?? []), ...hidden])] };
}

// One place for a rule: it leaves user access, so that clearing it really shows the tile again.
export function withVisibility({ visibility, access }, key, rule) {
  const cleaned = Object.fromEntries(
    Object.entries(access).map(([id, entry]) => [id, { ...entry, hide: (entry.hide ?? []).filter((item) => item !== key) }]),
  );
  const { [key]: previous, ...others } = visibility;
  return { access: cleaned, visibility: rule.only.length || rule.except.length ? { ...others, [key]: rule } : others };
}

// What the side menu shows between the pages and the areas. Without `menu` it is the shortcuts and links.
export function menuGroups(config, links, language) {
  if (config.menu?.groups) return config.menu.groups;
  return [
    { items: config.shortcuts.filter((item) => item.name).map((item) => ({ shortcut: item.name })) },
    { items: links.map(({ key, icon, path, admin }) => ({ name: translate(language, key), icon, path, ...(admin ? { admin } : {}) })) },
  ];
}

export const MENU_LINKS = [
  { key: "history", icon: "mdi:chart-box-outline", path: "/history" },
  { key: "logbook", icon: "mdi:format-list-bulleted", path: "/logbook" },
  { key: "devices", icon: "mdi:devices", path: "/config/devices/dashboard", admin: true },
  { key: "automations", icon: "mdi:robot-outline", path: "/config/automation/dashboard", admin: true },
  { key: "home_assistant", icon: "mdi:view-dashboard-outline", path: "/lovelace" },
];

export function menuKey(item) {
  if (item.shortcut) return `shortcut:${item.shortcut}`;
  if (item.addon) return `app:${item.addon}`;
  if (item.action) return `action:${item.action}`;
  return `path:${item.path ?? item.name}`;
}

export function shownMenu(hass, config, links) {
  const shortcuts = shownShortcuts(hass, config);
  const guest = guestModeHolds(hass, config);
  const forThisPerson = (item) => !item.users?.length || item.users.includes(hass.user?.id);
  const mine = (item) => !config.menuHidden?.includes(menuKey(item));
  const shown = (item) =>
    (!item.admin || hass.user?.is_admin) && !(item.hide_for_guests && guest) && forThisPerson(item) && mine(item);
  const resolved = (item) => {
    if (!item.shortcut) return [item];
    const block = shortcuts.find(({ name }) => name === item.shortcut);
    return block ? [{ ...item, name: item.name ?? block.name, icon: item.icon ?? block.icon, block }] : [];
  };
  return menuGroups(config, links, hass.language)
    .map((group) => ({ ...group, items: (group.items ?? []).filter(shown).flatMap(resolved) }))
    .filter(({ items }) => items.length);
}

export function shownShortcuts(hass, config) {
  return config.shortcuts
    .filter((item) => !config.denied?.includes(blockKey(item)))
    .filter((item) => !item.hidden_when || hass.states[item.hidden_when]?.state !== "on");
}

export function buildRoomList(hass, config, selection) {
  return shownRooms(hass, config, selection, "phone").map(({ id, name }) => ({ id, name }));
}

// A room is where a guest's blocked camera stays visible, so nobody wonders where it went.
function roomCameras(hass, config, areas) {
  return cameraCandidates(hass, config)
    .filter((id) => hasPicture(hass, id) && areas.includes(effectiveArea(hass, id, config)))
    .map((id) => ({ ...cameraEntry(hass, id), guest: hiddenFromGuests(hass, id, config) }));
}

function laidOutRoomModel(hass, config, entry, layout) {
  const areas = entry.areas ?? [];
  const hidden = hiddenInRoom(config, entry.id);
  const sections = (entry.sections ?? [])
    .map((section, index) => ({
      key: `section-${index}`,
      id: sectionId(section, index),
      title: section.title,
      layout: section.layout ?? null,
      tiles: section.tiles
        .filter((item) => !hidden.tiles.includes(tileKey(item)))
        .map((item) => {
          const tile = layoutTile(hass, item, entry.name, config, layout);
          return tile && { ...tile, key: tileKey(item) };
        })
        .filter(Boolean),
    }))
    .filter((section) => !hidden.sections.includes(section.id));
  return {
    id: entry.id,
    title: entry.name,
    areas,
    fixedStatus: entry.status ?? [],
    background: entry.background ?? null,
    cameras: roomCameras(hass, config, areas),
    sections: sections.filter((section) => section.tiles.length),
  };
}

function scenesModel(hass, config, layout) {
  const tiles = config.scenes.map((item) => layoutTile(hass, item, null, config, layout)).filter(Boolean);
  return {
    id: SCENES_ROOM,
    title: translate(hass.language, "section_scenes"),
    areas: [],
    fixedStatus: [],
    cameras: [],
    sections: tiles.length ? [{ key: "scenes", tiles }] : [],
  };
}

export function buildRoomModel(hass, config, selection, roomId, layout = "phone") {
  if (roomId === SCENES_ROOM) return scenesModel(hass, config, layout);
  const entry = layoutEntry(config, roomId);
  if (entry) return laidOutRoomModel(hass, config, entry, layout);
  const room = buildRooms(hass, config, selection, layout).find((item) => item.id === roomId);
  const tiles = room?.tiles ?? [];
  const known = new Set(ROOM_SECTIONS.flatMap((section) => section.domains));
  const hidden = hiddenInRoom(config, roomId);
  const kept = tiles.filter((tile) => !hidden.tiles.includes(tile.entityId)).map((tile) => ({ ...tile, key: tile.entityId }));
  const sections = ROOM_SECTIONS.map((section) => ({
    key: section.key,
    id: section.key,
    title: translate(hass.language, section.title),
    tiles: kept.filter((tile) => section.domains.includes(tile.domain)),
  }));
  sections.push({
    key: "other",
    id: "other",
    title: translate(hass.language, "section_other"),
    tiles: kept.filter((tile) => !known.has(tile.domain)),
  });
  return {
    id: roomId,
    title: room?.name ?? hass.areas[roomId]?.name ?? translate(hass.language, "nav_room"),
    areas: [roomId],
    fixedStatus: [],
    cameras: roomCameras(hass, config, [roomId]),
    sections: sections.filter((section) => section.tiles.length && !hidden.sections.includes(section.id)),
  };
}

// Everything a room shows before someone hides anything, marked with what this person hid.
export function roomViewChoices(hass, raw, userId, prefs, roomId, actionsOf) {
  const config = personalize(normalizeConfig(raw), userId, { ...prefs, hidden_tiles: {}, hidden_sections: {} });
  const model = buildRoomModel(hass, config, selectEntities(hass, config), roomId);
  const hiddenTiles = prefs.hidden_tiles?.[roomId] ?? [];
  const hiddenSections = prefs.hidden_sections?.[roomId] ?? [];
  const tiles = (list) => list.map((tile) => ({ key: tile.key ?? tile.entityId, name: tile.name, hidden: hiddenTiles.includes(tile.key ?? tile.entityId) }));
  const actions = actionsOf(config, model);
  return [
    ...(actions.length ? [{ id: ROOM_SCENES_ID, title: translate(hass.language, "section_scenes"), tiles: tiles(actions), whole: false }] : []),
    ...model.sections.map((section) => ({
      id: section.id,
      title: section.title || translate(hass.language, "room_view_untitled"),
      tiles: tiles(section.tiles),
      whole: true,
      hidden: hiddenSections.includes(section.id),
    })),
  ];
}

export const ROOM_SCENES_ID = "__scenes";

// What someone may add to their favorites: the devices of the dashboard they are allowed to see.
export function favoriteCandidates(hass, raw, userId, chosen, query) {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return [];
  const config = personalize(normalizeConfig(raw), userId);
  const usable = (id) => !hass.entities[id] || isPrimary(hass.entities[id]);
  return Object.keys(hass.states)
    .filter((id) => usable(id) && !chosen.includes(id) && !config.denied.includes(id))
    .map((id) => ({ id, name: hass.states[id]?.attributes.friendly_name ?? id }))
    .filter(({ id, name }) => `${name} ${id}`.toLowerCase().includes(wanted))
    .slice(0, MAX_FAVORITE_MATCHES);
}

const MAX_FAVORITE_MATCHES = 20;

// The states this page depends on; a change anywhere else must not re-render it.
export function watchedEntityIds(hass, config, selection, areas = []) {
  const { hero, tiles, guest } = config.cameras;
  const privacy = config.cameras.private.map((rule) => rule.entity);
  const cameras = [...cameraCandidates(hass, config), hero, ...tiles, guest?.entity, ...privacy].filter(Boolean);
  const laidOut = [
    ...config.scenes,
    ...config.media.sections.flatMap((section) => section.tiles ?? []),
    ...config.layout.flatMap((room) => [
      ...(room.home ?? []),
      ...(room.scenes ?? []),
      ...(room.sections ?? []).flatMap((section) => section.tiles),
    ]),
  ];
  const inRoom = Object.keys(hass.entities).filter((id) => areas.includes(effectiveArea(hass, id, config)));
  const fixed = config.layout.flatMap((room) => room.status ?? []).flatMap((group) => group.entities);
  return new Set([
    ...selection.entityIds,
    ...weatherEntities(hass),
    config.weather?.entity,
    ...config.favorites,
    ...selection.mediaGroups.flat(),
    ...cameras,
    ...laidOut.map((item) => item.entity).filter(Boolean),
    ...laidOut.map((item) => shortcutBlock(config, item)).filter((item) => item?.kind === "panel").flatMap(panelEntityIds),
    ...laidOut
      .map((item) => shortcutBlock(config, item))
      .filter((item) => item?.kind === "scale")
      .flatMap((item) => [item.entity, ...scalePeople(hass, item).map((person) => person.entity)]),
    ...inRoom,
    ...fixed,
    ...(config.energy?.storage ?? []).flatMap((store) => [store.battery, store.state, store.input, store.output, store.remaining]),
  ]);
}
