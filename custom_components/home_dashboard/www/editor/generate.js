// Rooms made from the areas of Home Assistant, so a dashboard does not start from nothing: one room for each area,
// its tiles in sections by kind, a few of them on Home. Hidden, disabled and technical entities stay out, and of one
// device seen from two integrations only one tile is made. Pure functions.

import { translate } from "../app/i18n.js";
import { areaOf, domainOf, isCandidate, twinsOf } from "./picker-model.js";

const ALARM_CLASSES = ["moisture", "smoke", "gas", "carbon_monoxide"];

/** The sections a room is made of, in their order, and what goes into each. */
export const SECTIONS = [
  { key: "lights", title: "editor_generate_lights", test: (entity) => domainOf(entity) === "light" },
  { key: "climate", title: "editor_generate_climate", test: (entity) => ["climate", "cover"].includes(domainOf(entity)) },
  { key: "media", title: "editor_generate_media", test: (entity) => domainOf(entity) === "media_player" },
  { key: "devices", title: "editor_generate_devices", test: (entity) => ["switch", "input_boolean", "fan", "vacuum", "humidifier", "water_heater"].includes(domainOf(entity)) },
  {
    key: "security",
    title: "editor_generate_security",
    test: (entity, hass) =>
      ["lock", "alarm_control_panel"].includes(domainOf(entity)) ||
      (domainOf(entity) === "binary_sensor" && ALARM_CLASSES.includes(hass.states[entity]?.attributes?.device_class)),
  },
  { key: "automations", title: "editor_generate_automations", test: (entity) => domainOf(entity) === "automation", extra: { calm: true, tap_toggle: true } },
];
// On Home a room shows what is changed most: its thermostat, its lights, its blind.
const HOME_ORDER = ["climate", "light", "cover"];
export const HOME_TILES = 6;

/** The room of the dashboard that already holds an area, by its id or its areas, or null. */
export function roomOfArea(strategy, area) {
  return (strategy.layout ?? []).find((room) => room.id === area || (room.areas ?? []).includes(area)) ?? null;
}

/** The entities of an area a dashboard is made of, one of each device seen twice, sorted by name. */
export function areaEntities(hass, area) {
  const collator = new Intl.Collator(hass.language);
  const name = (entity) => hass.states[entity]?.attributes?.friendly_name ?? entity;
  const found = Object.keys(hass.states)
    .filter((entity) => areaOf(hass, entity) === area && isCandidate(hass, entity))
    .sort((a, b) => collator.compare(name(a), name(b)));
  const kept = [];
  for (const entity of found) {
    if (twinsOf(hass, entity).some((twin) => kept.includes(twin.entity))) continue;
    kept.push(entity);
  }
  return kept;
}

/** A room for an area: sections of the kinds asked for, a few tiles on Home when asked. */
export function roomForArea(hass, area, { kinds = SECTIONS.map((section) => section.key), home = true } = {}) {
  const t = (key) => translate(hass.language, key);
  const entities = areaEntities(hass, area);
  const sections = SECTIONS.filter((section) => kinds.includes(section.key))
    .map((section) => ({
      title: t(section.title),
      tiles: entities.filter((entity) => section.test(entity, hass)).map((entity) => ({ entity, ...(section.extra ?? {}) })),
    }))
    .filter((section) => section.tiles.length);
  const room = { id: area, name: hass.areas?.[area]?.name ?? area, areas: [area] };
  if (hass.areas?.[area]?.icon) room.icon = hass.areas[area].icon;
  if (home) {
    const chosen = HOME_ORDER.flatMap((domain) => entities.filter((entity) => domainOf(entity) === domain)).slice(0, HOME_TILES);
    if (chosen.length) room.home = chosen.map((entity) => ({ entity }));
  }
  room.sections = sections;
  return room;
}

/** The areas of the home, by floor then name: each with the room that holds it already and the tiles it would get. */
export function generatableAreas(hass, strategy, options = {}) {
  const collator = new Intl.Collator(hass.language);
  const level = (area) => hass.floors?.[hass.areas?.[area]?.floor_id]?.level ?? 0;
  return Object.keys(hass.areas ?? {})
    .sort((a, b) => level(a) - level(b) || collator.compare(hass.areas[a].name ?? a, hass.areas[b].name ?? b))
    .map((area) => {
      const room = roomForArea(hass, area, options);
      const tiles = room.sections.reduce((sum, section) => sum + section.tiles.length, 0);
      const holder = roomOfArea(strategy, area);
      return { area, name: hass.areas[area].name ?? area, tiles, room, covered: holder ? (holder.name ?? holder.id) : null };
    });
}

/** The strategy with rooms added for the areas chosen, after those it has; an area held already is left alone. */
export function withGeneratedRooms(hass, strategy, areas, options = {}) {
  const rooms = areas.filter((area) => !roomOfArea(strategy, area)).map((area) => roomForArea(hass, area, options));
  return { ...strategy, layout: [...(strategy.layout ?? []), ...rooms] };
}
