// The calendars of the home and of each person: which ones a person sees, their events from Home Assistant, and the
// shapes they are shown in (today's badges in the status bar, a month on a tablet, a list of days on a phone).
// The home's calendars are set for everyone (`status_panel.calendars`); a person adds their own and can leave the
// home's out (their own settings, `calendars`), so a tablet signed in as its own user sees the home's only.

import { translate } from "./i18n.js";

export const CALENDAR_PALETTE = ["#34c759", "#ff5e8a", "#64d2ff", "#ffd60a", "#ff9f0a", "#bf5af2", "#5e5ce6", "#30d5c8", "#ff453a", "#a2845e"];
export const CALENDAR_LIMIT = 3;
export const LIST_DAYS = 14;
// How long fetched events are kept before asking Home Assistant again.
export const CALENDAR_REFRESH_MS = 5 * 60 * 1000;
// A calendar that could not be read (Home Assistant starting) is tried again this soon.
export const CALENDAR_RETRY_MS = 15 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const domainOf = (entityId) => String(entityId).split(".")[0];

/** The calendars of the home, as the configuration names them, that exist. */
export function homeCalendars(hass, config) {
  return (config?.status_panel?.calendars ?? []).filter((id) => domainOf(id) === "calendar" && hass?.states?.[id]);
}

/** Every calendar of Home Assistant, by name, for a person to choose from. */
export function allCalendars(hass) {
  return Object.keys(hass?.states ?? {})
    .filter((id) => domainOf(id) === "calendar" && hass.states[id].state !== "unavailable")
    .sort((a, b) => calendarName(hass, a).localeCompare(calendarName(hass, b), hass.language));
}

export const calendarName = (hass, id) => (hass?.states?.[id]?.attributes?.friendly_name ?? id).trim();

/** What a person keeps: `{ home: true, own: [] }` unless they changed it. */
export function personCalendars(prefs) {
  const kept = prefs?.calendars ?? {};
  return { home: kept.home !== false, own: Array.isArray(kept.own) ? kept.own : [] };
}

/** The calendars a person sees: the home's (unless left out) and their own, each once. */
export function shownCalendars(hass, config, prefs) {
  const { home, own } = personCalendars(prefs);
  const ids = [...(home ? homeCalendars(hass, config) : []), ...own.filter((id) => hass?.states?.[id])];
  return [...new Set(ids)];
}

/** The colour of a calendar: the one set for it, else a colour of the palette by its place among all calendars. */
export function calendarColour(hass, config, id) {
  const own = config?.status_panel?.calendar_colors?.[id];
  if (own) return own;
  const index = allCalendars(hass).indexOf(id);
  return CALENDAR_PALETTE[(index < 0 ? 0 : index) % CALENDAR_PALETTE.length];
}

// A day as a local date: midnight at the start of it.
export const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
export const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// "2026-11-14" is a day of the calendar, not midnight in London: read as a local date.
function readTime(value) {
  if (!value) return null;
  if (typeof value === "object") return readTime(value.dateTime ?? value.date);
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time;
}

/** An event of Home Assistant's calendar API as the dashboard uses it. */
export function readEvent(raw, calendar) {
  const start = readTime(raw.start);
  const allDay = typeof raw.start === "object" ? Boolean(raw.start?.date && !raw.start?.dateTime) : /^\d{4}-\d{2}-\d{2}$/.test(raw.start ?? "");
  // An all-day event ends the day after its last day; one without an end lasts its day.
  const end = readTime(raw.end) ?? (allDay ? addDays(start, 1) : start);
  return {
    calendar,
    summary: (raw.summary ?? "").trim(),
    description: (raw.description ?? "").trim(),
    location: (raw.location ?? "").trim(),
    start,
    end,
    allDay,
    key: `${calendar}|${raw.uid ?? raw.summary}|${start?.getTime()}`,
  };
}

/**
 * The events of the calendars between two times, all-day ones first and then by their start. A calendar that could
 * not be read (Home Assistant still starting, a connection lost) leaves the list `incomplete`, to be read again.
 */
export async function fetchEvents(hass, calendars, from, to) {
  if (!hass?.callApi || !calendars.length) return [];
  const range = `start=${encodeURIComponent(from.toISOString())}&end=${encodeURIComponent(to.toISOString())}`;
  let incomplete = false;
  const lists = await Promise.all(
    calendars.map((id) =>
      hass
        .callApi("GET", `calendars/${id}?${range}`)
        .then((events) => (Array.isArray(events) ? events.map((raw) => readEvent(raw, id)).filter((event) => event.start) : []))
        .catch(() => {
          incomplete = true;
          return [];
        }),
    ),
  );
  const events = sortEvents(lists.flat());
  if (incomplete) events.incomplete = true;
  return events;
}

export const sortEvents = (events) =>
  [...events].sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start || a.summary.localeCompare(b.summary));

/** The events on a day: those that touch it, all-day ones first. */
export function eventsOn(events, day) {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  return sortEvents(events.filter((event) => event.start < to && (event.end > from || (event.end - event.start === 0 && event.start >= from))));
}

/**
 * Today's events of the status bar: all-day ones and those still to come. One with an hour goes once it is over
 * (`hide: "end"`, it says "now" meanwhile) or once it began (`hide: "start"`).
 */
export function todayEvents(events, now, hide = "end") {
  return eventsOn(events, now).filter((event) => event.allDay || (hide === "start" ? event.start > now : event.end > now || event.start > now));
}

export const isNow = (event, now) => !event.allDay && event.start <= now && event.end > now;

/** How far into an event now is, 0–1. */
export const progressOf = (event, now) => Math.min(1, Math.max(0, (now - event.start) / Math.max(1, event.end - event.start)));

/** "za 48 min", "za 3 h", or the hour of the end while it lasts. */
export function untilText(event, now, language) {
  const minutes = Math.round((event.start - now) / 60000);
  if (minutes <= 0) return translate(language, "calendar_now");
  if (minutes < 60) return translate(language, "calendar_in_minutes", { count: minutes });
  return translate(language, "calendar_in_hours", { count: Math.round(minutes / 60) });
}

export const timeText = (date, language) => date.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });

/** The weeks of a month, Monday first: six rows of seven days, those of the months around marked `out`. */
export function monthWeeks(year, month) {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7;
  const start = addDays(first, -shift);
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = addDays(start, week * 7 + day);
      return { date, out: date.getMonth() !== month };
    }),
  );
}

/** The days from one on, each with its events, empty days left out except the first. */
export function agendaDays(events, from, days = LIST_DAYS) {
  const start = startOfDay(from);
  return Array.from({ length: days }, (_, index) => addDays(start, index))
    .map((day) => ({ day, events: eventsOn(events, day) }))
    .filter((entry, index) => index === 0 || entry.events.length);
}

/** The name of a day in a list: today, tomorrow, else its weekday and date. */
export function dayTitle(day, now, language) {
  const date = day.toLocaleDateString(language, { weekday: "long", day: "numeric", month: "short" });
  if (sameDay(day, now)) return translate(language, "calendar_today_day", { date });
  if (sameDay(day, addDays(now, 1))) return translate(language, "calendar_tomorrow_day", { date });
  return date.charAt(0).toLocaleUpperCase(language) + date.slice(1);
}

// One cache for the whole page: the status bar, the window and the list ask for the same calendars.
const cache = new Map();

/** The events of calendars over days, from the cache while it is fresh. */
export function cachedEvents(hass, calendars, from, to, now = Date.now()) {
  const key = `${calendars.join(",")}|${from.getTime()}|${to.getTime()}`;
  const kept = cache.get(key);
  if (kept && now - kept.at < CALENDAR_REFRESH_MS) return kept.events;
  const events = fetchEvents(hass, calendars, from, to);
  cache.set(key, { at: now, events });
  // A list that could not be read whole is not kept: the next look reads it again.
  events.then((list) => {
    if (list.incomplete && cache.get(key)?.events === events) cache.delete(key);
  });
  return events;
}

export const clearCalendarCache = () => cache.clear();

export { DAY_MS };
