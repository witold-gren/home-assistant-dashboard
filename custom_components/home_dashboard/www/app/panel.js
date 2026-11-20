// Blocks of an imported layout that are more than one entity: an appliance, a robot, a car, a
// remote. A block is plain data in the strategy, so a new one needs no code here.

import { translate } from "./i18n.js";

const MISSING_STATES = new Set(["unavailable", "unknown", ""]);
const TV_OFF_STATES = new Set(["off", "unavailable", "unknown", "standby"]);
const PRESS_SERVICES = {
  button: ["button", "press"],
  input_button: ["input_button", "press"],
  scene: ["scene", "turn_on"],
  script: ["script", "turn_on"],
};
const ROW_CONTROLS = {
  button: "press",
  fan: "toggle",
  input_boolean: "toggle",
  input_button: "press",
  input_number: "range",
  input_select: "select",
  light: "toggle",
  number: "range",
  script: "press",
  select: "select",
  switch: "toggle",
};
const NO_VALUE = "–";
const SOURCES_KEY = "home_dashboard_sources_";
const TV_POLL_MS = 2000;
const TV_SETTLE_MS = 4000;
const TV_START_LIMIT_MS = 90000;

const domainOf = (entityId) => entityId.split(".")[0];

function formatDuration(seconds) {
  const total = Math.round(Number(seconds));
  if (!total) return NO_VALUE;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Seconds as hours and minutes ("1 h 14 min"), as a battery's time left reads best. */
export function formatHours(seconds) {
  const total = Math.round(Number(seconds));
  if (!Number.isFinite(total) || total <= 0) return NO_VALUE;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function formatNumber(hass, value, digits) {
  return Number(value).toLocaleString(hass.language, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// A time in seconds from a state in its own unit (history_stats counts hours).
const SECONDS_IN = { s: 1, min: 60, h: 3600, d: 86400 };
const asSeconds = (value, unit) => Number(value) * (SECONDS_IN[unit] ?? 1);

// `given` is a state to show instead of the entity's own (a value being chosen, not sent yet).
export function panelValue(hass, row, given = undefined) {
  const stateObj = given ?? hass.states[row.entity];
  if (!stateObj || MISSING_STATES.has(stateObj.state)) return NO_VALUE;
  // An attribute instead of the state: the game a console plays.
  if (row.attribute) {
    const value = stateObj.attributes?.[row.attribute];
    return value === undefined || value === null || value === "" ? NO_VALUE : String(value);
  }
  const { state } = stateObj;
  if (row.labels?.[state]) return row.labels[state];
  if (row.format === "duration") return formatDuration(state);
  if (row.format === "hours") {
    const seconds = asSeconds(state, stateObj.attributes?.unit_of_measurement);
    // Time left below zero: a limit already passed, by how much.
    if (seconds <= -60) return translate(hass.language, "panel_over_by", { time: formatHours(-seconds) });
    return formatHours(seconds);
  }
  const numeric = row.digits !== undefined && !Number.isNaN(Number(state));
  const value = numeric ? formatNumber(hass, state, row.digits) : null;
  if (row.unit) return `${value ?? state} ${row.unit}`;
  return value ?? hass.formatEntityState?.(stateObj) ?? state;
}

function isActive(hass, item) {
  const entity = item.active ?? item.entity;
  return Boolean(entity) && hass.states[entity]?.state === (item.active_state ?? "on");
}

export function panelTile(hass, item) {
  if (item.hidden_when && hass.states[item.hidden_when]?.state === "on") return null;
  const stateObj = item.entity ? hass.states[item.entity] : null;
  // An entity Home Assistant knows but has no state for yet (its integration waits for its add-on or the device) keeps
  // the tile, greyed out like any unavailable one; only an entity gone from Home Assistant hides it.
  const waiting = Boolean(item.entity && !stateObj && hass.entities?.[item.entity]);
  if (item.entity && !stateObj && !waiting) return null;
  const status = panelValue(hass, { entity: item.status ?? item.entity, labels: item.labels });
  const fallback = waiting
    ? translate(hass.language, "tv_unavailable")
    : status === NO_VALUE && item.entity
      ? panelValue(hass, { entity: item.entity })
      : status;
  return {
    kind: "panel",
    entityId: item.entity ?? "",
    domain: "panel",
    item,
    name: item.name,
    stateText: item.state_text ?? fallback,
    tone: isActive(hass, item) ? "appliance" : "off",
    icon: item.icon ?? "mdi:widgets-outline",
    available: !waiting && stateObj?.state !== "unavailable",
    iconAction: null,
    tapAction: "panel",
    // A button on the tile while its device is on (a console: Turn off), asked first in the block's window.
    // With `active`, that entity says so (a console whose cloud state is stuck on "on").
    quick: item.quick && stateObj && (item.active ? isActive(hass, item) : !["off", "unavailable", "unknown"].includes(stateObj.state)) ? item.quick : null,
    stats: item.compact ? [] : panelStats(hass, item),
  };
}

export function panelStats(hass, item) {
  return (item.stats ?? []).map((stat) => ({ name: stat.name, value: panelValue(hass, stat) }));
}

export function panelEntityIds(item) {
  const rows = (item.groups ?? []).flatMap((group) => group.rows);
  return [
    item.entity,
    item.status,
    item.active,
    item.hidden_when,
    ...(item.stats ?? []).map((stat) => stat.entity),
    ...rows.map((row) => row.entity),
  ].filter(Boolean);
}

/**
 * The options of a list in the order the row gives (`order`), the rest after them as the entity sends them: a device
 * may send them in no useful order (1400 before 400).
 */
export function orderedOptions(options, order) {
  const all = options ?? [];
  if (!order?.length) return all;
  return [...order.filter((option) => all.includes(option)), ...all.filter((option) => !order.includes(option))];
}

/** The options of a list a row shows: in its `order`, without those it `hide`s unless one is what is set now. */
export function shownOptions(stateObj, row) {
  return orderedOptions(stateObj.attributes.options, row.order).filter(
    (option) => !row.hide?.includes(option) || option === stateObj.state,
  );
}

// Inside the block of a car, "Car Front door" says the car twice.
export function blockRowName(name, blockName) {
  return name.startsWith(`${blockName} `) ? name.slice(blockName.length + 1) : name;
}

export function rowControl(entityId) {
  return ROW_CONTROLS[domainOf(entityId)] ?? "read";
}

export function pressCall(entityId) {
  const [domain, service] = PRESS_SERVICES[domainOf(entityId)] ?? ["homeassistant", "turn_on"];
  return { domain, service, data: { entity_id: entityId } };
}

// Remote ------------------------------------------------------------------------------------------

export function isTvOn(stateObj) {
  return Boolean(stateObj) && !TV_OFF_STATES.has(stateObj.state);
}

export function tvStatus(language, stateObj) {
  if (!stateObj) return "";
  if (stateObj.state === "unavailable") return translate(language, "tv_unavailable");
  if (!isTvOn(stateObj)) return translate(language, "tv_off");
  const { source, app_name: app, media_title: title } = stateObj.attributes;
  const current = source || app || translate(language, "tv_on");
  return title ? `${current} · ${title}` : current;
}

// A TV reports its sources only while it is on, and that is exactly when nobody needs them.
export function rememberedSources(entityId, sources) {
  try {
    if (sources?.length) localStorage.setItem(SOURCES_KEY + entityId, JSON.stringify(sources));
    return sources?.length ? sources : JSON.parse(localStorage.getItem(SOURCES_KEY + entityId) ?? "[]");
  } catch {
    return sources ?? [];
  }
}

export function matchSource(sources, name) {
  const wanted = name.toLowerCase();
  return (
    sources.find((source) => source.toLowerCase() === wanted) ??
    sources.find((source) => source.toLowerCase().includes(wanted)) ??
    name
  );
}

export function runAction(hass, action) {
  if (!action?.service) return;
  const [domain, service] = action.service.split(".");
  // A script called by its own name takes only its fields (`data`, e.g. minutes); anything else its entity too.
  const target = action.target && !(domain === "script" && service !== "turn_on") ? { entity_id: action.target } : {};
  hass.callService(domain, service, { ...target, ...(action.data ?? {}) });
}

// The sheet may be closed long before the TV has started, so the current hass comes from outside.
export function selectSourceAfterStart(getHass, entityId, source, timing = {}) {
  const { poll = TV_POLL_MS, settle = TV_SETTLE_MS, limit = TV_START_LIMIT_MS } = timing;
  const started = Date.now();
  const timer = setInterval(() => {
    const hass = getHass();
    if (isTvOn(hass?.states[entityId])) {
      clearInterval(timer);
      setTimeout(() => {
        getHass()?.callService("media_player", "select_source", { entity_id: entityId, source });
      }, settle);
    } else if (Date.now() - started > limit) {
      clearInterval(timer);
    }
  }, poll);
}

