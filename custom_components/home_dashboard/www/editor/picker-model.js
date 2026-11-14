// What the editor's picker of tiles knows about the entities of the home: their area, what kind they are, where
// the dashboard already shows them, which may be the same device twice (a blind from two integrations), and what a
// new tile of them would best take. Pure functions, tested on their own.

import { translate } from "../app/i18n.js";

/** The kinds a person filters by, with the domains each one holds; anything else is "other". */
export const KINDS = [
  { key: "lights", domains: ["light"] },
  { key: "switches", domains: ["switch", "input_boolean", "fan"] },
  { key: "covers", domains: ["cover"] },
  { key: "climate", domains: ["climate", "water_heater", "humidifier"] },
  { key: "media", domains: ["media_player", "remote"] },
  { key: "sensors", domains: ["sensor", "binary_sensor"] },
  { key: "automations", domains: ["automation", "script", "scene"] },
  { key: "security", domains: ["lock", "alarm_control_panel", "camera"] },
];
const KNOWN = new Set(KINDS.flatMap((kind) => kind.domains));
// What the same device shown twice looks like: one blind, thermostat or lock of an area from one integration and
// one from another. Lights and speakers of different integrations in one room are usually different devices.
const TWIN_DOMAINS = new Set(["cover", "climate", "lock"]);
// Entities a dashboard is never made of.
const SKIPPED_DOMAINS = new Set(["update", "button", "event", "image", "number", "select", "text", "device_tracker", "person", "zone", "sun", "weather", "tts", "stt", "conversation", "todo", "calendar", "notify", "ai_task", "wake_word", "assist_satellite"]);
const LIST_DOMAINS = new Set(["select", "input_select"]);

export const domainOf = (entity) => String(entity).split(".")[0];

export function kindOf(entity) {
  const domain = domainOf(entity);
  return KINDS.find((kind) => kind.domains.includes(domain))?.key ?? "other";
}

/** The area of an entity: its own, else its device's. */
export function areaOf(hass, entity) {
  const entry = hass.entities?.[entity];
  return entry?.area_id ?? hass.devices?.[entry?.device_id]?.area_id ?? null;
}

// A home has thousands of entities and the picker draws again on every new state: what needs the whole registry
// (the battery of each device, the entities of each area and domain) is worked out once for each set of states.
const indexes = new WeakMap();

export function registryIndex(hass) {
  const cached = indexes.get(hass.states);
  if (cached && cached.entities === hass.entities && cached.devices === hass.devices) return cached;
  const batteries = new Map();
  const byAreaDomain = new Map();
  for (const entity of Object.keys(hass.states)) {
    const device = hass.entities?.[entity]?.device_id;
    if (device && hass.states[entity]?.attributes?.device_class === "battery" && !batteries.has(device)) batteries.set(device, entity);
    const area = areaOf(hass, entity);
    if (!area) continue;
    const group = `${area}|${domainOf(entity)}`;
    if (!byAreaDomain.has(group)) byAreaDomain.set(group, []);
    byAreaDomain.get(group).push(entity);
  }
  const index = { entities: hass.entities, devices: hass.devices, batteries, byAreaDomain };
  indexes.set(hass.states, index);
  return index;
}

/** The battery of the device of an entity, in %, or null. */
export function batteryOf(hass, entity) {
  const device = hass.entities?.[entity]?.device_id;
  if (!device) return null;
  const id = registryIndex(hass).batteries.get(device);
  const value = Number.parseFloat(hass.states[id]?.state);
  return Number.isFinite(value) ? Math.round(value) : null;
}

/**
 * Where the dashboard shows each entity: a map from the entity to the places (room names, Favourites, Scenes).
 * A tile that names a block is counted by its entity too.
 */
export function usage(strategy, language = "en") {
  const t = (key) => translate(language, key);
  const places = new Map();
  const note = (entity, place) => {
    if (!entity) return;
    const list = places.get(entity) ?? [];
    if (!list.includes(place)) list.push(place);
    places.set(entity, list);
  };
  const entityOf = (tile) => (typeof tile === "string" ? tile : tile?.entity);
  for (const entity of strategy.favorites ?? []) note(entity, t("editor_tree_favorites"));
  for (const tile of strategy.scenes ?? []) note(entityOf(tile), t("editor_tree_scenes"));
  for (const room of strategy.layout ?? []) {
    const name = room.name ?? room.id;
    for (const tile of [...(room.home ?? []), ...(room.scenes ?? []), ...(room.sections ?? []).flatMap((section) => section.tiles ?? [])]) {
      note(entityOf(tile), name);
    }
  }
  return places;
}

/**
 * The entities that may be this one again: in its area, the only one of its kind from its integration and the only
 * one from another integration (a blind from Netatmo and from HomeKit). Groups are no devices and do not count.
 */
export function twinsOf(hass, entity) {
  const domain = domainOf(entity);
  const area = areaOf(hass, entity);
  const isGroup = (id) => hass.entities?.[id]?.platform === "group" || Array.isArray(hass.states[id]?.attributes?.entity_id);
  if (!TWIN_DOMAINS.has(domain) || !area || isGroup(entity)) return [];
  const platform = hass.entities?.[entity]?.platform;
  const deviceClass = hass.states[entity]?.attributes?.device_class ?? null;
  const same = (registryIndex(hass).byAreaDomain.get(`${area}|${domain}`) ?? []).filter(
    (other) =>
      hass.entities?.[other]?.platform &&
      !hass.entities[other].hidden &&
      !isGroup(other) &&
      (hass.states[other]?.attributes?.device_class ?? null) === deviceClass,
  );
  const byPlatform = new Map();
  for (const other of same) byPlatform.set(hass.entities[other].platform, [...(byPlatform.get(hass.entities[other].platform) ?? []), other]);
  if (!platform || byPlatform.get(platform)?.length !== 1) return [];
  return [...byPlatform]
    .filter(([other, list]) => other !== platform && list.length === 1)
    .map(([other, [id]]) => ({ entity: id, name: hass.states[id]?.attributes?.friendly_name ?? id, platform: other }));
}

/** What a new tile of this entity takes besides its entity, and why: a list runs only from its button. */
export function suggestion(hass, entity) {
  if (LIST_DOMAINS.has(domainOf(entity))) return { keys: { confirm: true }, reason: "editor_suggest_confirm" };
  if (domainOf(entity) === "automation") return { keys: { calm: true }, reason: "editor_suggest_calm" };
  return null;
}

/** The tile added to a list: a favourite is only its entity; the rest a mapping, with the suggestion when asked. */
export function tileFor(hass, entity, listPath, suggest = true) {
  if (listPath[0] === "favorites") return entity;
  return { entity, ...(suggest ? (suggestion(hass, entity)?.keys ?? {}) : {}) };
}

/** Whether an entity belongs among those a dashboard is made of: not hidden, not technical, not of a skipped domain. */
export function isCandidate(hass, entity, technical = false) {
  const entry = hass.entities?.[entity];
  if (entry?.hidden || entry?.disabled_by) return false;
  if (!technical && (entry?.entity_category || SKIPPED_DOMAINS.has(domainOf(entity)) && !LIST_DOMAINS.has(domainOf(entity)))) return false;
  return true;
}

/**
 * The rows of the picker for a filter: `areas` (ids; empty is every area), `unassigned` (only those without an
 * area), `kinds` (keys; empty is every kind), `hideUsed`, `technical` and a text that matches the name or the id.
 * Sorted: those not used yet first, then by name.
 */
export function pickerRows(hass, strategy, filter = {}) {
  const { areas = [], unassigned = false, kinds = [], hideUsed = false, technical = false, search = "" } = filter;
  const used = usage(strategy, hass.language);
  const wanted = search.trim().toLowerCase();
  const collator = new Intl.Collator(hass.language);
  return Object.keys(hass.states)
    .filter((entity) => isCandidate(hass, entity, technical))
    .map((entity) => {
      const state = hass.states[entity];
      const area = areaOf(hass, entity);
      return {
        entity,
        name: state.attributes?.friendly_name ?? entity,
        area,
        areaName: area ? (hass.areas?.[area]?.name ?? area) : null,
        kind: kindOf(entity),
        used: used.get(entity) ?? [],
        battery: batteryOf(hass, entity),
        twins: twinsOf(hass, entity),
        suggestion: suggestion(hass, entity),
      };
    })
    .filter((row) => (unassigned ? !row.area : !areas.length || areas.includes(row.area)))
    .filter((row) => !kinds.length || kinds.includes(row.kind))
    .filter((row) => !hideUsed || !row.used.length)
    .filter((row) => !wanted || row.name.toLowerCase().includes(wanted) || row.entity.toLowerCase().includes(wanted))
    .sort((a, b) => Number(a.used.length > 0) - Number(b.used.length > 0) || collator.compare(a.name, b.name));
}

/** The areas a room is made of, to open the picker on them; the room's id when it has none. */
export function roomAreas(room) {
  return room?.areas?.length ? room.areas : room?.id ? [room.id] : [];
}

export const isKnownDomain = (domain) => KNOWN.has(domain);
