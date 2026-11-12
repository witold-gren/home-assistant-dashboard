// Warnings on Home: the items of the Status screen marked `notify: true`, while they have something to say, each as
// a card over the page. A card closed today stays closed until tomorrow, unless something new joins it (another
// device below its level); the same warnings stay readable on the Status screen. Everything can be muted for a week
// from the dashboard settings, for a person who is away: after the week they come back.

import { overviewItem } from "./overview.js";
import { personalPrefs } from "./prefs.js";

const DISMISSED_KEY = "home-dashboard-alerts-dismissed";
export const MUTE_WEEK_MS = 7 * 86_400_000;

const pad = (n) => String(n).padStart(2, "0");
const dayOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const rowKey = (row) => row.entity ?? row.name;

/** The items of every Status screen that notify and have something to say now. */
export function homeAlerts(hass, config, now = new Date()) {
  const screens = (config.shortcuts ?? []).filter((shortcut) => shortcut?.kind === "overview");
  return screens.flatMap((screen) =>
    (screen.sections ?? []).flatMap((section) =>
      (section.items ?? [])
        .filter((item) => item.notify)
        .map((item) => overviewItem(hass, item, now))
        .filter((shown) => shown?.rows?.length)
        .map((shown) => ({ ...shown, alarm: Boolean(shown.alarm), key: `${screen.name ?? ""}/${shown.name}` })),
    ),
  );
}

function dismissed(now) {
  try {
    const saved = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "{}");
    return saved.day === dayOf(now) ? (saved.seen ?? {}) : {};
  } catch {
    return {};
  }
}

/** Whether warnings are muted now, and until when (ms), from the person's own settings. */
export function mutedUntil(now = new Date()) {
  const until = Number(personalPrefs().alerts_muted_until) || 0;
  return until > now.getTime() ? until : 0;
}

/**
 * The warnings to show: not muted, and not closed today unless a device joined since. An alarm (water, smoke) is
 * never muted nor closed: it stays while it lasts, first of all.
 */
export function shownAlerts(alerts, now = new Date()) {
  const alarms = alerts.filter((alert) => alert.alarm);
  if (mutedUntil(now)) return alarms;
  const seen = dismissed(now);
  return [...alarms, ...alerts.filter((alert) => !alert.alarm).filter((alert) => {
    const closed = seen[alert.key];
    return !closed || alert.rows.some((row) => !closed.includes(rowKey(row)));
  })];
}

/** Close a warning for today, with the devices it named now. */
export function dismissAlert(alert, now = new Date()) {
  const seen = dismissed(now);
  seen[alert.key] = alert.rows.map(rowKey);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify({ day: dayOf(now), seen }));
}
