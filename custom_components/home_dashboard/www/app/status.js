// The row of round icons at the top of a room: what the room reports, without opening anything.

import { countLabel, translate } from "./i18n.js";
import { domainOf, effectiveArea, isPrimary } from "./model.js";

// These report on a machine, not on the room: a server in the hallway is not the hallway at 40°.
const SKIPPED_PLATFORMS = new Set([
  "browser_mod",
  "ecoflow_cloud",
  "electrolux_status",
  "eufy_sdk",
  "frigate",
  "glances",
  "hassio",
  "mobile_app",
  "neolink",
  "nut",
  "proxmoxve",
  "synology_dsm",
  "systemmonitor",
]);
const ALARM_CLASSES = ["moisture", "smoke", "gas", "carbon_monoxide", "safety"];
const CO2_EXCELLENT = 800;
const CO2_GOOD = 1000;
const CO2_POOR = 1400;
const LOW_BATTERY = 20;
const NOT_REPORTING = ["unavailable", "unknown"];

function roomEntries(hass, config, areas, fixedIds) {
  return Object.entries(hass.entities)
    .filter(
      ([id, entry]) =>
        isPrimary(entry) && hass.states[id] && !fixedIds.has(id) && areas.includes(effectiveArea(hass, id, config)),
    )
    .map(([id, entry]) => ({ id, platform: entry.platform }));
}

export function buildRoomStatus(hass, config, areas, fixed = []) {
  const { language } = hass;
  const t = (key, values) => translate(language, key, values);
  const fixedIds = new Set(fixed.flatMap((group) => group.entities));
  const entries = roomEntries(hass, config, areas, fixedIds);
  const everything = entries.map((entry) => entry.id);
  const sensors = entries.filter((entry) => !SKIPPED_PLATFORMS.has(entry.platform)).map((entry) => entry.id);

  const state = (id) => hass.states[id].state;
  const isOn = (id) => state(id) === "on";
  const number = (id) => parseFloat(state(id));
  const deviceClass = (id) => hass.states[id].attributes?.device_class;
  const ofClass = (ids, domain, classes) =>
    ids.filter((id) => domainOf(id) === domain && classes.includes(deviceClass(id)));
  const decimal = (value, digits) =>
    value.toLocaleString(language, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const range = (ids, digits, unit) => {
    const values = ids.map(number).filter((value) => !Number.isNaN(value));
    if (!values.length) return null;
    const low = Math.min(...values);
    const high = Math.max(...values);
    return Math.abs(low - high) < 0.05
      ? `${decimal(low, digits)}${unit}`
      : `${decimal(low, digits)}–${decimal(high, digits)}${unit}`;
  };

  // A single one reads like a noun, and in Polish the state has to agree with it.
  const counted = (key, count) => (count === 1 ? t(`status_one_${key}`) : countLabel(language, key, count));
  const stateOf = (key, count, many) => (count === 1 ? t(`status_state_${key}`) : t(many));

  const pills = [];
  const add = (key, icon, title, value, ids, tone = "off", extra = {}) =>
    pills.push({ key, icon, title, value, ids, tone, ...extra });
  const addRange = (key, icon, classes, digits, unit) => {
    const ids = ofClass(sensors, "sensor", classes);
    const value = range(ids, digits, unit);
    if (value) add(key, icon, t(`status_${key}`), value, ids);
  };

  const lowBattery = [
    ...ofClass(everything, "sensor", ["battery"]).filter((id) => number(id) < LOW_BATTERY),
    ...ofClass(everything, "binary_sensor", ["battery"]).filter(isOn),
  ];
  if (lowBattery.length) {
    add("battery", "mdi:battery-alert-variant-outline", t("status_battery"), countLabel(language, "devices", lowBattery.length), lowBattery, "security");
  }

  const alarms = ofClass(everything, "binary_sensor", ALARM_CLASSES).filter(isOn);
  if (alarms.length) {
    add("alarm", "mdi:alert", t(`status_alarm_${deviceClass(alarms[0])}`), t("status_detected"), alarms, "security");
  }

  const leaks = ofClass(everything, "binary_sensor", ["moisture"]);
  if (leaks.length && !leaks.some(isOn)) {
    const silent = leaks.filter((id) => NOT_REPORTING.includes(state(id)));
    const value = silent.length ? t("status_none_silent", { count: silent.length }) : t("status_none");
    add("leak", "mdi:water-check-outline", t("status_alarm_moisture"), value, leaks, silent.length ? "climate" : "off");
  }

  addRange("temperature", "mdi:thermometer", ["temperature"], 1, "°");
  addRange("humidity", "mdi:water-percent", ["humidity"], 0, "%");

  const co2 = ofClass(sensors, "sensor", ["carbon_dioxide"]);
  const co2Values = co2.map(number).filter((value) => !Number.isNaN(value));
  if (co2Values.length) {
    const worst = Math.max(...co2Values);
    const grade = worst < CO2_EXCELLENT ? "excellent" : worst < CO2_GOOD ? "good" : worst < CO2_POOR ? "fair" : "poor";
    add("air", "mdi:blur", t("status_air"), `${t(`status_air_${grade}`)} · ${Math.round(worst)} ppm`, co2, worst >= CO2_POOR ? "climate" : "off");
  }

  addRange("illuminance", "mdi:brightness-5", ["illuminance"], 0, " lx");
  addRange("noise", "mdi:volume-high", ["sound_pressure"], 0, " dB");
  addRange("pressure", "mdi:gauge", ["atmospheric_pressure", "pressure"], 0, " hPa");

  const thermostats = everything.filter((id) => domainOf(id) === "climate");
  if (thermostats.length) {
    const stateObj = hass.states[thermostats[0]];
    const formatted = hass.formatEntityState?.(stateObj) ?? stateObj.state;
    const mode = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    const target = stateObj.attributes?.temperature;
    const value = target != null && stateObj.state !== "off" ? `${mode} · ${decimal(target, 1)}°` : mode;
    const title = thermostats.length > 1 ? countLabel(language, "thermostats", thermostats.length) : t("chip_climate");
    add("climate", "mdi:thermostat", title, value, thermostats, stateObj.state === "off" ? "off" : "climate");
  }

  const lights = everything.filter((id) => domainOf(id) === "light" && !hass.states[id].attributes?.entity_id);
  const lightsOn = lights.filter(isOn);
  if (lightsOn.length) {
    add("lights", "mdi:lightbulb-on-outline", counted("lights", lightsOn.length), stateOf("lights", lightsOn.length, "status_on"), lights, "light");
  }

  const switches = sensors.filter((id) => domainOf(id) === "switch");
  const switchesOn = switches.filter(isOn);
  if (switchesOn.length) {
    add("switches", "mdi:toggle-switch-variant", counted("switches", switchesOn.length), stateOf("switches", switchesOn.length, "status_on"), switches, "appliance");
  }

  const covers = everything.filter((id) => domainOf(id) === "cover");
  const open = covers.filter((id) => state(id) === "open" || hass.states[id].attributes?.current_position > 0);
  if (open.length) {
    add("covers", "mdi:window-shutter-open", counted("covers", open.length), stateOf("covers", open.length, "status_open"), covers, "cover");
  }

  const contacts = ofClass(sensors, "binary_sensor", ["window", "door", "garage_door", "opening"]);
  for (const [key, icon, classes] of [
    ["windows", "mdi:window-open-variant", ["window"]],
    ["doors", "mdi:door-open", ["door", "garage_door"]],
    ["contacts", "mdi:electric-switch-closed", ["opening"]],
  ]) {
    const ids = contacts.filter((id) => classes.includes(deviceClass(id)));
    const count = ids.filter(isOn).length;
    if (count) add(key, icon, counted(key, count), stateOf(key, count, "status_open"), ids, "climate");
  }

  const motion = ofClass(sensors, "binary_sensor", ["motion"]);
  if (motion.length) {
    const moving = motion.some(isOn);
    add("motion", moving ? "mdi:motion-sensor" : "mdi:motion-sensor-off", t("status_motion"), t(moving ? "status_detected" : "status_not_detected"), motion, moving ? "appliance" : "off");
  }
  const presence = ofClass(sensors, "binary_sensor", ["occupancy", "presence"]);
  if (presence.length) {
    const present = presence.some(isOn);
    add("presence", present ? "mdi:account" : "mdi:account-outline", t("status_presence"), t(present ? "status_detected" : "status_none"), presence, present ? "appliance" : "off");
  }

  fixed.forEach((group, index) => {
    const ids = group.entities.filter((id) => hass.states[id]);
    if (!ids.length) return;
    const count = ids.filter(isOn).length;
    const key = `fixed-${index}`;
    if (group.type === "motion") {
      add(key, group.icon ?? (count ? "mdi:motion-sensor" : "mdi:motion-sensor-off"), group.name, t(count ? "status_detected" : "status_not_detected"), ids, count ? "appliance" : "off");
    } else if (group.type === "switch") {
      const value = count === 0 ? t("status_off") : count === ids.length ? t("status_on") : t("status_some_on", { count, total: ids.length });
      add(key, group.icon ?? "mdi:toggle-switch-outline", group.name, value, ids, count ? "appliance" : "off");
    } else {
      add(key, group.icon ?? "mdi:door", group.name, count ? t("status_open_count", { count }) : t("status_closed"), ids, count ? "climate" : "off");
    }
  });

  const scenes = sceneIds(hass, config, areas);
  if (scenes.length) add("scenes", "mdi:palette-outline", t("status_scenes"), countLabel(language, "scenes", scenes.length), scenes, "media");
  const scripts = scriptIds(hass, config, areas);
  if (scripts.length) add("scripts", "mdi:script-text-play-outline", t("status_scripts"), countLabel(language, "scripts", scripts.length), scripts, "media");
  return pills;
}

function sceneIds(hass, config, areas) {
  const inRoom = (id) => areas.includes(effectiveArea(hass, id, config));
  return Object.keys(hass.states).filter((id) => {
    if (domainOf(id) !== "scene" || hass.entities[id]?.hidden) return false;
    if (effectiveArea(hass, id, config)) return inRoom(id);
    const members = hass.states[id].attributes?.entity_id ?? [];
    return members.length > 0 && members.every(inRoom);
  });
}

// A script that needs an answer cannot be run from a tile.
function scriptIds(hass, config, areas) {
  return Object.keys(hass.states).filter((id) => {
    if (domainOf(id) !== "script" || hass.entities[id]?.hidden) return false;
    if (!areas.includes(effectiveArea(hass, id, config))) return false;
    const fields = hass.services?.script?.[id.split(".")[1]]?.fields ?? {};
    return !Object.values(fields).some((field) => field?.required);
  });
}
