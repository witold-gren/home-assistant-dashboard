// The status bar of a tablet on its side: the time, the weather and what is going on at home, for a glance from across
// the room. It stands in the place of the narrow bar, which keeps its pages under it; folded, the narrow bar is back as
// it always was. What it shows and in what order is part of the look; where its facts come from is in `status_panel`
// of the dashboard. A part with nothing to say is left out.

import { LitElement, css, html, nothing, svg } from "../vendor/lit-all.min.js";
import { homeAlerts, shownAlerts } from "./alerts.js";
import { STATUS_PARTS } from "./appearance.js";
import { departureLines, lineColours } from "./departures.js";
import { countLabel, translate } from "./i18n.js";
import { blockFor, buildWeather, domainOf, FORECAST_DAILY, FORECAST_HOURLY, weatherIcon } from "./model.js";
import { tokens } from "./styles.js";
import { precipitationKind } from "./weather.js";

export const STATUS_WIDGETS = STATUS_PARTS;
// As wide as the menu, which opens over it.
export const STATUS_WIDTH = 320;
// What a device reports when it is doing nothing: it then stays out of "Now".
const RESTING = new Set(["off", "idle", "docked", "standby", "unavailable", "unknown", "", "—", "-", "none", "nie", "no", "false"]);
const RAIN_HOURS = 12;
const POWER_HOURS = 6;
const POWER_REFRESH_MS = 5 * 60_000;
const POWER_BUCKETS = 72;
const CLOCK_MS = 15_000;
const SPARK = { width: 240, height: 40 };
// Past an hour minutes say little ("299 min"): the hour of the departure says it better.
const MINUTES_SHOWN = 60;
const DOMAIN_ICONS = { vacuum: "mdi:robot-vacuum", sensor: "mdi:information-outline", binary_sensor: "mdi:information-outline" };

const asItem = (item) => (typeof item === "string" ? { entity: item } : (item ?? {}));
const nameOf = (hass, item) => item.name ?? hass.states[item.entity]?.attributes?.friendly_name ?? item.entity;
const shown = (hass, entityId) => {
  const stateObj = hass.states[entityId];
  return stateObj ? (hass.formatEntityState?.(stateObj) ?? stateObj.state) : "";
};

/** The widgets to show, in their order: the chosen ones, or all of them. */
export const statusWidgets = (chosen) => (chosen?.length ? chosen.filter((key) => STATUS_WIDGETS.includes(key)) : STATUS_WIDGETS);

/** What is on and what is open, only what there is: lights, devices and the doors and windows that are watched. */
export function statusHome(hass, selection, config) {
  const ids = selection?.entityIds ?? [];
  const on = (domains) => ids.filter((id) => domains.includes(domainOf(id)) && hass.states[id]?.state === "on").length;
  const language = hass.language;
  const facts = [];
  const lights = on(["light"]);
  if (lights) facts.push({ key: "lights", icon: "mdi:lightbulb-on", tone: "light", count: lights, label: countLabel(language, "lights", lights) });
  const devices = on(["switch", "fan"]);
  if (devices) facts.push({ key: "devices", icon: "mdi:power-plug", tone: "", count: devices, label: countLabel(language, "devices", devices) });
  const open = (config.status_panel?.doors ?? [])
    .map(asItem)
    .filter((item) => ["on", "open"].includes(hass.states[item.entity]?.state));
  if (open.length === 1) {
    facts.push({ key: "open", icon: "mdi:door-open", tone: "open", count: 1, label: `1 ${nameOf(hass, open[0]).toLocaleLowerCase(language)}`, entity: open[0].entity });
  } else if (open.length) {
    facts.push({ key: "open", icon: "mdi:door-open", tone: "open", count: open.length, label: translate(language, "status_open_many", { count: open.length }), names: open.map((item) => nameOf(hass, item)) });
  }
  return facts;
}

/** The things going on now: an item shows while its entity is not resting (off, idle, docked, "—"…). */
export function statusNow(hass, items) {
  return (items ?? []).map(asItem).flatMap((item) => {
    const stateObj = hass.states[item.entity];
    if (!stateObj) return [];
    const resting = item.resting ?? [...RESTING];
    if (resting.map((state) => String(state).toLowerCase()).includes(String(stateObj.state).toLowerCase())) return [];
    const remaining = item.remaining ? shown(hass, item.remaining) : "";
    return [
      {
        entity: item.entity,
        entities: [item.entity, item.detail, item.remaining],
        block: item.block ?? null,
        name: nameOf(hass, item),
        icon: item.icon ?? stateObj.attributes.icon ?? DOMAIN_ICONS[domainOf(item.entity)] ?? "mdi:information-outline",
        // Its own state (a phase, the next hour) and what `detail` adds (a programme), without the empty ones.
        detail: [item.entity, item.detail]
          .filter((id) => id && !RESTING.has(String(hass.states[id]?.state ?? "").toLowerCase()))
          .map((id) => shown(hass, id))
          .join(" · "),
        value: remaining && !RESTING.has(String(hass.states[item.remaining]?.state).toLowerCase()) ? remaining : "",
      },
    ];
  });
}

/**
 * The time for the big clock: hours and minutes, and on a 12-hour clock its AM or PM apart, small beside them, so
 * the time stays on one line.
 */
export function clockParts(at, language) {
  const twelve = new Intl.DateTimeFormat(language, { hour: "numeric" }).resolvedOptions().hour12;
  const parts = new Intl.DateTimeFormat(language, { hour: twelve ? "numeric" : "2-digit", minute: "2-digit" }).formatToParts(at);
  const time = parts.filter((part) => part.type !== "dayPeriod").map((part) => part.value).join("").trim();
  return { time, period: parts.find((part) => part.type === "dayPeriod")?.value ?? "" };
}

/** The departures: from `status_panel.departures`, or the first departures block, each line with its next times. */
export function statusDepartures(hass, config) {
  const own = config.status_panel?.departures;
  const block = (config.shortcuts ?? []).find((shortcut) => shortcut?.kind === "departures");
  const entities = own?.length ? own : block?.entities;
  if (!entities?.length) return null;
  const lines = departureLines(hass, entities);
  if (!lines.length) return null;
  const colours = lineColours(lines, block?.colors ?? {});
  return {
    block: block ?? null,
    title: block?.name ?? translate(hass.language, "status_departures"),
    lines: lines.map(({ key, line, direction, times }) => ({
      key,
      line,
      direction,
      colour: colours.get(line),
      minutes: times[0].minutes,
      times: times.slice(0, 3).map(({ departure }) => departure),
    })),
  };
}

/** The first hour with rain or snow in the coming hours, and how much. */
export function nextPrecipitation(hourly, now = new Date()) {
  const until = now.getTime() + RAIN_HOURS * 3_600_000;
  return (
    (hourly ?? []).find((hour) => {
      const when = new Date(hour.datetime).getTime();
      return when >= now.getTime() - 3_600_000 && when <= until && (hour.precipitation ?? 0) > 0;
    }) ?? null
  );
}

/** A history in even slices of time, each the mean of its numbers: a sensor read every few seconds is a blur. */
export function bucketed(points, count, from, to) {
  const span = (to - from) / count;
  if (!(span > 0)) return [];
  const sums = Array.from({ length: count }, () => ({ total: 0, seen: 0 }));
  for (const { time, value } of points) {
    if (!Number.isFinite(value) || time < from || time > to) continue;
    const slot = sums[Math.min(count - 1, Math.floor((time - from) / span))];
    slot.total += value;
    slot.seen += 1;
  }
  return sums.flatMap((slot, index) => (slot.seen ? [{ time: from + (index + 0.5) * span, value: slot.total / slot.seen }] : []));
}

/** A line through the numbers of a history, spread over its time. */
export function sparkPath(points, { width, height } = SPARK) {
  const values = points.filter((point) => Number.isFinite(point.value));
  if (values.length < 2) return "";
  const first = values[0].time;
  const span = values.at(-1).time - first || 1;
  const low = Math.min(...values.map((point) => point.value));
  const high = Math.max(...values.map((point) => point.value));
  const range = high - low || 1;
  return values
    .map((point, index) => {
      const x = ((point.time - first) / span) * width;
      const y = height - 2 - ((point.value - low) / range) * (height - 4);
      return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export class HomeDashboardStatusPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false },
    selection: { attribute: false },
    widgets: { attribute: false },
    colourful: { type: Boolean, reflect: true },
    _now: { state: true },
    _daily: { state: true },
    _hourly: { state: true },
    _history: { state: true },
  };

  connectedCallback() {
    super.connectedCallback();
    this._now = new Date();
    this._clock = setInterval(() => (this._now = new Date()), CLOCK_MS);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._clock);
    clearInterval(this._powerTimer);
    this._powerTimer = null;
    this._forecastWatches?.forEach((watch) => watch.then((unsubscribe) => unsubscribe?.()).catch(() => {}));
    this._forecastWatches = null;
    this._forecastFor = null;
  }

  updated() {
    if (!this.hass || !this.config) return;
    this._watchForecast();
    this._watchPower();
  }

  _watchForecast() {
    const weather = buildWeather(this.hass, this.config);
    const entity = weather?.forecast;
    if (!entity || this._forecastFor === entity || !this.hass.connection?.subscribeMessage) return;
    this._forecastFor = entity;
    this._forecastWatches = [];
    const features = this.hass.states[entity]?.attributes.supported_features ?? 0;
    const watch = (type) =>
      this._forecastWatches.push(
        this.hass.connection
          .subscribeMessage((event) => (this[`_${type}`] = event.forecast ?? []), {
            type: "weather/subscribe_forecast",
            forecast_type: type,
            entity_id: entity,
          })
          .catch(() => null),
      );
    if (features & FORECAST_DAILY) watch("daily");
    if (features & FORECAST_HOURLY) watch("hourly");
  }

  get _powerEntities() {
    return (this.config.status_panel?.power ?? []).map(asItem).filter((item) => this.hass.states[item.entity]);
  }

  _watchPower() {
    const key = this._powerEntities.map((item) => item.entity).join(",");
    if (!key || this._powerKey === key || !this.hass.callWS) return;
    this._powerKey = key;
    clearInterval(this._powerTimer);
    this._loadPower();
    this._powerTimer = setInterval(() => this._loadPower(), POWER_REFRESH_MS);
  }

  async _loadPower() {
    const ids = this._powerEntities.map((item) => item.entity);
    const now = Date.now();
    const from = now - POWER_HOURS * 3_600_000;
    const history = await this.hass
      .callWS({
        type: "history/history_during_period",
        start_time: new Date(from).toISOString(),
        end_time: new Date(now).toISOString(),
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
      })
      .catch(() => ({}));
    this._history = Object.fromEntries(
      ids.map((id) => [
        id,
        bucketed(
          (history?.[id] ?? []).map((row) => ({ time: (row.lu ?? row.lc ?? 0) * 1000, value: Number(row.s) })),
          POWER_BUCKETS,
          from,
          now,
        ),
      ]),
    );
  }

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  _number(value, digits = 1) {
    return new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: digits }).format(value);
  }

  _renderClock() {
    const language = this.hass.language;
    const { time, period } = clockParts(this._now, language);
    const date = new Intl.DateTimeFormat(language, { weekday: "long", day: "numeric", month: "long" }).format(this._now);
    return html`
      <header class="top">
        <div>
          <div class="clock" data-status-clock>${time}${period ? html`<small data-status-period>${period}</small>` : nothing}</div>
          <div class="date">${date.charAt(0).toLocaleUpperCase(language) + date.slice(1)}</div>
        </div>
        <slot name="actions"></slot>
      </header>
    `;
  }

  _renderWeather() {
    const weather = buildWeather(this.hass, this.config);
    const stateObj = weather && this.hass.states[weather.entity];
    if (!stateObj) return nothing;
    const { temperature, humidity } = stateObj.attributes;
    const today = this._daily?.[0];
    const sub = [
      this.hass.formatEntityState?.(stateObj) ?? stateObj.state,
      today && Number.isFinite(today.templow) && Number.isFinite(today.temperature)
        ? this._t("status_today", { low: this._number(today.templow, 0), high: this._number(today.temperature, 0) })
        : Number.isFinite(humidity)
          ? this._t("status_humidity_short", { value: this._number(humidity, 0) })
          : "",
    ].filter(Boolean);
    const rain = nextPrecipitation(this._hourly, this._now);
    const kind = rain ? precipitationKind(rain.condition) : null;
    return html`
      <button class="weather" data-status-widget="weather" @click=${() => this._open({ kind: "weather", weather })}>
        <ha-icon .icon=${weatherIcon(stateObj.state)}></ha-icon>
        <div>
          <strong>${typeof temperature === "number" ? `${this._number(temperature)}°` : this._t("no_data")}</strong>
          <small>${sub.join(" · ")}</small>
        </div>
      </button>
      ${rain
        ? html`<button class="rain" data-status-rain @click=${() => this._open({ kind: "weather", weather })}>
            <ha-icon .icon=${kind === "snow" ? "mdi:weather-snowy" : "mdi:weather-rainy"}></ha-icon>
            ${this._t(kind === "snow" ? "status_snow" : "status_rain", {
              time: new Intl.DateTimeFormat(this.hass.language, { hour: "2-digit", minute: "2-digit" }).format(new Date(rain.datetime)),
              amount: this._number(rain.precipitation),
            })}
          </button>`
        : nothing}
    `;
  }

  _section(key, title, body) {
    return html`<section data-status-widget=${key}><h4>${title}</h4>${body}</section>`;
  }

  // A part opens its own window: the chrome knows how (the weather, the Status screen, the timetable, Energy).
  _open(target) {
    this.dispatchEvent(new CustomEvent("status-open", { bubbles: true, composed: true, detail: target }));
  }

  // A washer or a dryer opens the window of its block (found by its entities, or `block` by name); else its details.
  _openNow(item) {
    const block = blockFor(this.config, item.entities, item.block);
    if (block) this._open({ kind: "block", block });
    else this._more(item.entity);
  }

  _more(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
  }

  _renderHome() {
    const facts = statusHome(this.hass, this.selection, this.config);
    if (!facts.length) return nothing;
    return this._section(
      "home",
      this._t("status_home"),
      html`<div class="facts">
        ${facts.map(
          (fact) => html`
            <button class="fact ${fact.tone}" data-status-fact=${fact.key} title=${fact.names?.join(", ") ?? ""}
              @click=${() => this._open({ kind: "status", entity: fact.entity })}>
              <ha-icon .icon=${fact.icon}></ha-icon><span>${fact.label}</span>
            </button>
          `,
        )}
      </div>`,
    );
  }

  _renderAlerts() {
    const alerts = shownAlerts(homeAlerts(this.hass, this.config, this._now), this._now);
    if (!alerts.length) return nothing;
    return this._section(
      "alerts",
      this._t("status_alerts"),
      alerts.map(
        (alert) => html`
          <button class="alert" data-status-alert=${alert.key}
            @click=${() => this._more(alert.rows.length === 1 ? alert.rows[0].entity : null)}>
            <ha-icon .icon=${alert.icon ?? "mdi:alert-circle-outline"}></ha-icon>
            <span>${alert.rows.map((row) => (row.value ? `${row.name} ${row.value}` : row.name)).join(", ")}</span>
          </button>
        `,
      ),
    );
  }

  _renderNow() {
    const items = statusNow(this.hass, this.config.status_panel?.now);
    if (!items.length) return nothing;
    return this._section(
      "now",
      this._t("status_now"),
      items.map(
        (item) => html`
          <button class="row" data-status-now=${item.entity} @click=${() => this._openNow(item)}>
            <ha-icon .icon=${item.icon}></ha-icon>
            <span class="row-text"><strong>${item.name}</strong><small>${item.detail}</small></span>
            ${item.value ? html`<em>${item.value}</em>` : nothing}
          </button>
        `,
      ),
    );
  }

  _renderDepartures() {
    const departures = statusDepartures(this.hass, this.config);
    if (!departures) return nothing;
    return this._section(
      "departures",
      departures.title,
      departures.lines.map(
        (line) => html`
          <button class="line" data-status-line=${line.key} @click=${() => this._open({ kind: "departures", block: departures.block })}>
            <span class="badge" style="--line: ${line.colour}">${line.line}</span>
            <span class="direction">${line.direction}</span>
            <strong>
              ${line.minutes <= 0
                ? this._t("status_leaving")
                : line.minutes < MINUTES_SHOWN
                  ? this._t("status_minutes", { count: line.minutes })
                  : line.times[0]}
            </strong>
            <small>${line.times.join(" · ")}</small>
          </button>
        `,
      ),
    );
  }

  _renderPower() {
    const items = this._powerEntities;
    if (!items.length) return nothing;
    return this._section(
      "power",
      this._t("status_power"),
      items.map((item) => {
        const stateObj = this.hass.states[item.entity];
        const value = Number(stateObj.state);
        const unit = stateObj.attributes.unit_of_measurement ?? "";
        const path = sparkPath(this._history?.[item.entity] ?? []);
        return html`
          <button class="power" data-status-power=${item.entity} @click=${() => this._open({ kind: "energy", entity: item.entity })}>
            <span><small>${nameOf(this.hass, item)}</small><strong>${Number.isFinite(value) ? `${this._number(value, 0)} ${unit}` : stateObj.state}</strong></span>
            <svg viewBox="0 0 ${SPARK.width} ${SPARK.height}" preserveAspectRatio="none" aria-hidden="true">
              ${path ? svg`<path d=${path} style=${item.color ? `--spark: ${item.color}` : ""}></path>` : nothing}
            </svg>
          </button>
        `;
      }),
    );
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const parts = {
      weather: this._renderWeather,
      home: this._renderHome,
      alerts: this._renderAlerts,
      now: this._renderNow,
      departures: this._renderDepartures,
      power: this._renderPower,
    };
    return html`
      ${this._renderClock()}
      <div class="scroll" data-status-scroll>
        ${statusWidgets(this.widgets).map((key) => parts[key].call(this))}
      </div>
    `;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        color: inherit;
      }
      button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
      }
      /* The fold button and the assistant stand in the middle of the height of the clock and the date. */
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: calc(var(--hd-safe-top) + 14px) 12px 10px 16px;
      }
      .clock {
        font-size: 80px;
        font-weight: 300;
        line-height: 1;
        letter-spacing: -1px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .clock small {
        margin-left: 6px;
        font-size: 24px;
        font-weight: 400;
        letter-spacing: 0;
      }
      .date {
        margin-top: 6px;
        font-size: 21px;
        opacity: 0.72;
      }
      .scroll {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 6px 16px 24px;
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-mask-image: linear-gradient(#000 calc(100% - 24px), transparent);
        mask-image: linear-gradient(#000 calc(100% - 24px), transparent);
      }
      .weather,
      .rain,
      .line {
        width: 100%;
      }
      .weather {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .weather ha-icon {
        --mdc-icon-size: 52px;
        opacity: 0.9;
      }
      :host([colourful]) .weather ha-icon {
        color: #7fbfff;
        opacity: 1;
      }
      .weather strong {
        display: block;
        font-size: 40px;
        font-weight: 300;
      }
      .weather small {
        display: block;
        font-size: 15px;
        opacity: 0.72;
      }
      .rain {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 15px;
        opacity: 0.78;
        --mdc-icon-size: 18px;
      }
      :host([colourful]) .rain {
        color: #9fd3ff;
        opacity: 1;
      }
      section {
        padding-top: 11px;
        border-top: 1px solid color-mix(in srgb, currentColor 9%, transparent);
      }
      h4 {
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.6;
      }
      .facts {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .fact {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
        padding: 7px 8px;
        border-radius: 14px;
        font-size: 15px;
        background: color-mix(in srgb, currentColor 9%, transparent);
        --mdc-icon-size: 20px;
      }
      .fact span {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .fact.open {
        font-weight: 600;
      }
      :host([colourful]) .fact.light {
        color: #ffd60a;
      }
      :host([colourful]) .fact.open {
        color: #ff9f0a;
        background: color-mix(in srgb, #ff9f0a 16%, transparent);
      }
      .alert {
        display: flex;
        align-items: center;
        gap: 9px;
        width: 100%;
        margin-bottom: 6px;
        padding: 9px 10px;
        border-radius: 14px;
        font-size: 13px;
        background: color-mix(in srgb, currentColor 8%, transparent);
        --mdc-icon-size: 18px;
      }
      /* The one colour of a quiet bar: something needs a look. */
      .alert ha-icon {
        color: #ff8a80;
      }
      :host([colourful]) .alert {
        background: color-mix(in srgb, #ff453a 18%, transparent);
      }
      .row {
        display: grid;
        grid-template-columns: 26px 1fr auto;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 6px 0;
        --mdc-icon-size: 20px;
      }
      .row-text {
        min-width: 0;
      }
      .row strong {
        display: block;
        font-size: 14px;
        font-weight: 500;
      }
      .row small {
        display: block;
        font-size: 12px;
        opacity: 0.62;
      }
      .row em {
        font-style: normal;
        font-size: 13px;
        font-weight: 600;
      }
      :host([colourful]) .row em {
        color: #5ab0ff;
      }
      .line {
        display: grid;
        grid-template-columns: 34px 1fr auto;
        align-items: center;
        column-gap: 10px;
        padding: 4px 0;
      }
      .line small {
        grid-column: 2 / 4;
        font-size: 14px;
        opacity: 0.62;
      }
      .badge {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        box-sizing: border-box;
        border: 1.5px solid color-mix(in srgb, currentColor 55%, transparent);
        border-radius: 50%;
        font-size: 14px;
        font-weight: 700;
      }
      :host([colourful]) .badge {
        border: 0;
        color: #ffffff;
        background: var(--line);
      }
      .direction {
        overflow: hidden;
        text-transform: capitalize;
        font-size: 17px;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .line strong {
        font-size: 18px;
      }
      .power {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        margin-bottom: 6px;
      }
      .power > span {
        flex: none;
        width: 64px;
      }
      .power small {
        display: block;
        overflow: hidden;
        font-size: 12px;
        white-space: nowrap;
        text-overflow: ellipsis;
        opacity: 0.62;
      }
      .power strong {
        font-weight: 500;
      }
      .power svg {
        flex: 1;
        height: 34px;
      }
      .power path {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        opacity: 0.7;
        vector-effect: non-scaling-stroke;
      }
      :host([colourful]) .power path {
        stroke: var(--spark, #5ab0ff);
        opacity: 1;
      }
    `,
  ];
}
