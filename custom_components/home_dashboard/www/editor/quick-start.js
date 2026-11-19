// The quick start: a dashboard made from what is in Home Assistant, after a few questions. What it finds (areas,
// lights, leak and smoke sensors, batteries, hubs, scenes, cameras…) gives the answers it starts with; the answers
// make one change of the draft. Run again, it only adds what is missing: rooms of areas without one, favourites and
// scenes not there yet, warnings not on the Status screen yet, a look only where none was chosen. Pure functions.

import { translate } from "../app/i18n.js";
import { BUILTIN_THEMES } from "../app/builtin-themes.js";
import { generatableAreas, withGeneratedRooms, SECTIONS } from "./generate.js";
import { isCandidate } from "./picker-model.js";

export const QUICK_STEPS = ["devices", "rooms", "home", "safety", "look", "summary"];
export const LEVELS = ["alarm", "warning", "off"];
export const BATTERY_BELOW = 20;
const FAVOURITES = 6;
const SCENES = 8;
// A device that others hang on: when it does not answer, everything behind it is gone too.
const HUB = /gateway|bridge|coordinator|\bhub\b|bramk|mostek|zbt|slzb|skyconnect|conbee/i;
const LEAK = ["moisture"];
const SMOKE = ["smoke", "gas", "carbon_monoxide"];

const domainOf = (entity) => entity.split(".")[0];
const deviceClass = (hass, entity) => hass.states[entity]?.attributes?.device_class;
const nameOf = (hass, entity) => hass.states[entity]?.attributes?.friendly_name ?? entity;

/** What there is in Home Assistant for a dashboard: the lists the questions offer and count. */
export function quickStartFindings(hass) {
  const states = Object.keys(hass.states ?? {});
  const visible = states.filter((entity) => isCandidate(hass, entity));
  const of = (domain) => visible.filter((entity) => domainOf(entity) === domain);
  const sensors = (classes) =>
    states.filter((entity) => domainOf(entity) === "binary_sensor" && classes.includes(deviceClass(hass, entity)));
  const batteries = states.filter(
    (entity) =>
      domainOf(entity) === "sensor" &&
      deviceClass(hass, entity) === "battery" &&
      hass.states[entity]?.attributes?.unit_of_measurement === "%",
  );
  return {
    areas: Object.keys(hass.areas ?? {}),
    lights: of("light"),
    covers: of("cover"),
    climates: of("climate"),
    locks: of("lock"),
    alarms: of("alarm_control_panel"),
    cameras: of("camera"),
    media: of("media_player"),
    scenes: of("scene"),
    leaks: sensors(LEAK),
    smoke: sensors(SMOKE),
    doors: sensors(["door", "garage_door"]),
    windows: sensors(["window"]),
    batteries,
    hubs: hubsOf(hass),
  };
}

/** The gateways, bridges and coordinators of the home, each with one entity that goes unavailable with it. */
export function hubsOf(hass) {
  const entities = Object.values(hass.entities ?? {});
  return Object.entries(hass.devices ?? {})
    .filter(([, device]) => HUB.test(`${device.model ?? ""} ${device.name ?? ""} ${device.name_by_user ?? ""}`))
    .map(([id, device]) => {
      const entity = entities
        .filter((entry) => entry.device_id === id && hass.states[entry.entity_id])
        .map((entry) => entry.entity_id)
        .sort()[0];
      return entity ? { device: id, name: device.name_by_user || device.name || entity, entity } : null;
    })
    .filter(Boolean);
}

/** Favourites to start with: what a home reaches for first, the locks, the alarm and the thermostats. */
export function suggestedFavourites(found) {
  return [...found.locks, ...found.alarms, ...found.climates].slice(0, FAVOURITES);
}

/** The answers the questions start with, from what was found and what the dashboard has already. */
export function defaultAnswers(hass, strategy, found = quickStartFindings(hass)) {
  const areas = generatableAreas(hass, strategy)
    .filter((item) => !item.covered && item.tiles)
    .map((item) => item.area);
  return {
    tablet: true,
    idle: true,
    areas,
    home: true,
    favourites: suggestedFavourites(found).filter((entity) => !(strategy.favorites ?? []).includes(entity)),
    scenes: found.scenes.slice(0, SCENES),
    safety: {
      leak: found.leaks.length ? "alarm" : "off",
      smoke: found.smoke.length ? "alarm" : "off",
      battery: found.batteries.length ? "warning" : "off",
      battery_below: BATTERY_BELOW,
      hubs: found.hubs.length ? "alarm" : "off",
      alarm: found.alarms.length ? "alarm" : "off",
      doors: Boolean(found.doors.length || found.windows.length),
    },
    theme: "home_dashboard",
  };
}

/** The items of the Status screen the answers ask for, named in the language of the editor. */
export function safetyItems(hass, answers, found) {
  const t = (key) => translate(hass.language, key);
  const level = (choice) => (choice === "alarm" ? { alarm: true, notify: true } : { alarm: false, notify: true });
  const items = [];
  const { safety } = answers;
  if (safety.leak !== "off" && found.leaks.length)
    items.push({ name: t("quick_item_leak"), icon: "mdi:water-alert", auto: "alarm", classes: LEAK, ...level(safety.leak) });
  if (safety.smoke !== "off" && found.smoke.length)
    items.push({ name: t("quick_item_smoke"), icon: "mdi:smoke-detector-alert", auto: "alarm", classes: SMOKE, ...level(safety.smoke) });
  if (safety.battery !== "off" && found.batteries.length)
    items.push({
      name: t("quick_item_battery"),
      icon: "mdi:battery-alert",
      auto: "battery",
      below: Number(safety.battery_below) || BATTERY_BELOW,
      ...level(safety.battery),
    });
  if (safety.hubs !== "off" && found.hubs.length)
    items.push({
      name: t("quick_item_hubs"),
      icon: "mdi:router-wireless-off",
      entities: found.hubs.map((hub) => ({ entity: hub.entity, name: hub.name })),
      state: "unavailable",
      ...level(safety.hubs),
    });
  if (safety.alarm !== "off" && found.alarms.length)
    items.push({
      name: t("quick_item_alarm"),
      icon: "mdi:shield-alert",
      entities: found.alarms,
      state: "triggered",
      ...level(safety.alarm),
    });
  return items;
}

// An item of the Status screen is there already when one of the same kind is: the same `auto` and classes, or the
// same entities and state.
const itemKey = (item) =>
  JSON.stringify([
    item.auto ?? null,
    [...(item.classes ?? [])].sort(),
    (item.entities ?? []).map((entry) => (typeof entry === "string" ? entry : entry.entity)).sort(),
    item.auto ? null : (item.state ?? null),
  ]);

function withStatusItems(hass, strategy, items) {
  if (!items.length) return strategy;
  const t = (key) => translate(hass.language, key);
  const shortcuts = [...(strategy.shortcuts ?? [])];
  const at = shortcuts.findIndex((shortcut) => shortcut?.kind === "overview");
  if (at < 0) {
    shortcuts.push({
      kind: "overview",
      name: t("quick_status_name"),
      icon: "mdi:clipboard-pulse-outline",
      sections: [{ title: t("quick_status_section"), alert: true, items }],
    });
    return { ...strategy, shortcuts };
  }
  const overview = shortcuts[at];
  const sections = [...(overview.sections ?? [])];
  const there = new Set(sections.flatMap((section) => section.items ?? []).map(itemKey));
  const fresh = items.filter((item) => !there.has(itemKey(item)));
  if (!fresh.length) return strategy;
  const alert = sections.findIndex((section) => section.alert);
  if (alert < 0) sections.unshift({ title: t("quick_status_section"), alert: true, items: fresh });
  else sections[alert] = { ...sections[alert], items: [...(sections[alert].items ?? []), ...fresh] };
  shortcuts[at] = { ...overview, sections };
  return { ...strategy, shortcuts };
}

// What the person chose wins over the theme: a key of the look already set is kept.
function under(theme, own) {
  if (!own || typeof own !== "object" || Array.isArray(own)) return own ?? theme;
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) return own;
  const merged = { ...theme };
  for (const [key, value] of Object.entries(own)) merged[key] = under(theme[key], value);
  return merged;
}

/** The dashboard after the quick start: the strategy with what the answers ask for added, nothing taken away. */
export function withQuickStart(hass, strategy, answers, found = quickStartFindings(hass)) {
  const kinds = SECTIONS.filter((section) => section.key !== "automations").map((section) => section.key);
  let next = withGeneratedRooms(hass, strategy, answers.areas ?? [], { kinds, home: answers.home });
  const favourites = next.favorites ?? [];
  const addFavourites = (answers.favourites ?? []).filter((entity) => !favourites.includes(entity));
  if (addFavourites.length) next = { ...next, favorites: [...favourites, ...addFavourites] };
  const scenes = next.scenes ?? [];
  const sceneIds = scenes.map((scene) => (typeof scene === "string" ? scene : scene.entity));
  const addScenes = (answers.scenes ?? []).filter((entity) => !sceneIds.includes(entity));
  if (addScenes.length) next = { ...next, scenes: [...scenes, ...addScenes.map((entity) => ({ entity }))] };
  next = withStatusItems(hass, next, safetyItems(hass, answers, found));
  if (answers.tablet) {
    const appearance = next.appearance ?? {};
    if (appearance.status?.shown === undefined) next = { ...next, appearance: { ...appearance, status: { ...appearance.status, shown: true } } };
    const panel = next.status_panel ?? {};
    if (answers.safety?.doors && !panel.doors?.length && !panel.windows?.length && (found.doors.length || found.windows.length)) {
      next = { ...next, status_panel: { ...panel, doors: found.doors, windows: found.windows } };
    }
  }
  if (answers.idle === false && next.idle?.return_after === undefined) next = { ...next, idle: { ...next.idle, return_after: 0 } };
  const theme = BUILTIN_THEMES.find((item) => item.id === answers.theme);
  if (theme && theme.id !== "home_dashboard") {
    next = { ...next, appearance: under(theme.appearance, next.appearance) };
    if (Object.keys(theme.backgrounds ?? {}).length) next = { ...next, backgrounds: under(theme.backgrounds, next.backgrounds) };
  }
  return next;
}

/** What the quick start adds, counted for its last step. */
export function quickStartSummary(before, after) {
  const count = (list) => (list ?? []).length;
  const items = (strategy) =>
    (strategy.shortcuts ?? [])
      .filter((shortcut) => shortcut?.kind === "overview")
      .flatMap((shortcut) => shortcut.sections ?? [])
      .reduce((sum, section) => sum + count(section.items), 0);
  const homeTiles = (strategy) => (strategy.layout ?? []).reduce((sum, room) => sum + count(room.home), 0);
  return {
    rooms: count(after.layout) - count(before.layout),
    home: homeTiles(after) - homeTiles(before) + count(after.favorites) - count(before.favorites),
    scenes: count(after.scenes) - count(before.scenes),
    warnings: items(after) - items(before),
    status: Boolean(after.appearance?.status?.shown && !before.appearance?.status?.shown),
  };
}

/** A short line naming a few entities of a list, for the rows of the questions. */
export function namesOf(hass, entities, limit = 3) {
  const names = entities.slice(0, limit).map((entity) => nameOf(hass, entity));
  return entities.length > limit ? `${names.join(", ")} …` : names.join(", ");
}
