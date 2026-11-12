// The weather screen. The forecast does not live in the entity's state: Home Assistant sends it
// only to those who subscribe, so this element holds the subscriptions for as long as it is open.

import { LitElement, css, html, nothing, svg } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { FORECAST_DAILY, FORECAST_HOURLY, weatherIcon } from "./model.js";
import { tokens } from "./styles.js";

const HOURS_SHOWN = 24;
const DAYS_SHOWN = 7;
const FACTS = [
  { key: "apparent_temperature", label: "weather_feels_like", icon: "mdi:thermometer", unit: "temperature_unit" },
  { key: "humidity", label: "weather_humidity", icon: "mdi:water-percent", fixedUnit: "%" },
  { key: "pressure", label: "weather_pressure", icon: "mdi:gauge", unit: "pressure_unit" },
  { key: "wind_speed", label: "weather_wind", icon: "mdi:weather-windy", unit: "wind_speed_unit" },
  { key: "cloud_coverage", label: "weather_clouds", icon: "mdi:cloud-outline", fixedUnit: "%" },
  { key: "dew_point", label: "weather_dew_point", icon: "mdi:thermometer-water", unit: "temperature_unit" },
  { key: "uv_index", label: "weather_uv", icon: "mdi:sun-wireless-outline" },
  { key: "visibility", label: "weather_visibility", icon: "mdi:eye-outline", unit: "visibility_unit" },
];

const isSameDay = (first, second) => first.toDateString() === second.toDateString();

// A tablet on its side shows the weather on the whole screen: now and its facts on the left, the next day as a chart
// of temperature over the precipitation of each hour, and the next days as columns with a shared scale.
export const WIDE_WEATHER = "(orientation: landscape) and (min-width: 900px) and (min-height: 501px)";
const CHART = { width: 760, height: 320, top: 44, bottom: 168, rainTop: 200, rainBottom: 290 };

/** What falls in a forecast step, by its condition: snow, rain and snow, or rain. */
export function precipitationKind(condition) {
  if (condition === "snowy") return "snow";
  if (condition === "snowy-rainy") return "mix";
  return "rain";
}

// A station often measures only part of this, so the rest comes from the forecast entity.
export function weatherFacts(current, forecast) {
  return FACTS.flatMap((fact) => {
    const source = [current, forecast].find((attributes) => typeof attributes?.[fact.key] === "number");
    if (!source) return [];
    return [{ ...fact, value: source[fact.key], unit: fact.fixedUnit ?? source[fact.unit] ?? "" }];
  });
}

export class HomeDashboardWeather extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    _hourly: { state: true },
    _daily: { state: true },
  };

  _wide = window.matchMedia(WIDE_WEATHER);

  _redraw = () => this.requestUpdate();

  connectedCallback() {
    super.connectedCallback();
    this._wide.addEventListener("change", this._redraw);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._wide.removeEventListener("change", this._redraw);
    this._watches?.forEach((watch) => watch.then((unsubscribe) => unsubscribe?.()).catch(() => {}));
    this._watches = null;
  }

  updated() {
    if (this._watches || !this.hass || !this.item) return;
    this._watches = [];
    const features = this.hass.states[this.item.forecast]?.attributes.supported_features ?? 0;
    if (features & FORECAST_HOURLY) this._watch("hourly");
    if (features & FORECAST_DAILY) this._watch("daily");
  }

  _watch(type) {
    const watch = this.hass.connection?.subscribeMessage(
      (event) => {
        this[`_${type}`] = event.forecast ?? [];
      },
      { type: "weather/subscribe_forecast", forecast_type: type, entity_id: this.item.forecast },
    );
    if (watch) this._watches.push(watch);
  }

  _t(key) {
    return translate(this.hass.language, key);
  }

  _number(value, digits = 1) {
    return new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: digits }).format(value);
  }

  _renderNow() {
    const stateObj = this.hass.states[this.item.entity];
    const { temperature } = stateObj.attributes;
    return html`
      <div class="now" data-weather-now>
        <ha-icon .icon=${weatherIcon(stateObj.state)}></ha-icon>
        <div>
          <strong>${typeof temperature === "number" ? `${this._number(temperature)}°` : this._t("no_data")}</strong>
          <span>${this.hass.formatEntityState?.(stateObj) ?? stateObj.state}</span>
        </div>
      </div>
    `;
  }

  _renderFacts() {
    const facts = weatherFacts(
      this.hass.states[this.item.entity].attributes,
      this.hass.states[this.item.forecast]?.attributes,
    );
    if (!facts.length) return nothing;
    return html`
      <div class="facts">
        ${facts.map(
          (fact) => html`
            <div class="fact" data-weather-fact=${fact.key}>
              <ha-icon .icon=${fact.icon}></ha-icon>
              <span>
                <small>${this._t(fact.label)}</small>
                <strong>${this._number(fact.value)} ${fact.unit}</strong>
              </span>
            </div>
          `,
        )}
      </div>
    `;
  }

  _renderHourly() {
    const hours = (this._hourly ?? []).slice(0, HOURS_SHOWN);
    if (!hours.length) return nothing;
    const format = new Intl.DateTimeFormat(this.hass.language, { hour: "2-digit", minute: "2-digit" });
    return html`
      <section>
        <h3>${this._t("weather_hourly")}</h3>
        <div class="hours">
          ${hours.map(
            (hour) => html`
              <div class="hour" data-weather-hour>
                <small>${format.format(new Date(hour.datetime))}</small>
                <ha-icon .icon=${weatherIcon(hour.condition)}></ha-icon>
                <strong>${this._number(hour.temperature, 0)}°</strong>
                <small class="rain">${hour.precipitation ? `${this._number(hour.precipitation)} mm` : ""}</small>
              </div>
            `,
          )}
        </div>
      </section>
    `;
  }

  // The bars share one scale, so a warm day stands out from the whole week at a glance.
  _renderDaily() {
    const days = (this._daily ?? []).slice(0, DAYS_SHOWN);
    if (!days.length) return nothing;
    const lowOf = (day) => day.templow ?? day.temperature;
    const lowest = Math.min(...days.map(lowOf));
    const range = Math.max(...days.map((day) => day.temperature)) - lowest || 1;
    const format = new Intl.DateTimeFormat(this.hass.language, { weekday: "short" });
    const today = new Date();
    return html`
      <section>
        <h3>${this._t("weather_daily")}</h3>
        <div class="days">
          ${days.map((day) => {
            const date = new Date(day.datetime);
            const start = ((lowOf(day) - lowest) / range) * 100;
            const width = ((day.temperature - lowOf(day)) / range) * 100;
            return html`
              <div class="day" data-weather-day>
                <span class="name">${isSameDay(date, today) ? this._t("weather_today") : format.format(date)}</span>
                <ha-icon .icon=${weatherIcon(day.condition)}></ha-icon>
                <small class="rain">${day.precipitation ? `${this._number(day.precipitation)} mm` : ""}</small>
                <span class="low">${this._number(lowOf(day), 0)}°</span>
                <span class="bar"><i style="left: ${start}%; width: ${Math.max(width, 4)}%"></i></span>
                <strong>${this._number(day.temperature, 0)}°</strong>
              </div>
            `;
          })}
        </div>
      </section>
    `;
  }

  // The next day: temperature as a line over a shaded area, every third hour labelled with its icon, and under it
  // the precipitation of each hour as bars coloured by what falls, on a scale that fits the wettest hour.
  _renderChart() {
    const hours = (this._hourly ?? []).slice(0, HOURS_SHOWN);
    if (hours.length < 2) return nothing;
    const { width, height, top, bottom, rainTop, rainBottom } = CHART;
    const temps = hours.map((hour) => hour.temperature);
    const low = Math.min(...temps) - 1;
    const high = Math.max(...temps) + 1;
    const xs = hours.map((_, index) => 20 + (index * (width - 40)) / (hours.length - 1));
    const ys = temps.map((t) => bottom - ((t - low) / (high - low)) * (bottom - top));
    const line = xs.map((x, index) => `${index ? "L" : "M"}${x.toFixed(1)},${ys[index].toFixed(1)}`).join(" ");
    const area = `${line} L${xs.at(-1).toFixed(1)},${bottom + 8} L${xs[0].toFixed(1)},${bottom + 8} Z`;
    const rains = hours.map((hour) => hour.precipitation ?? 0);
    const scale = Math.max(1, ...rains);
    const bar = ((width - 40) / hours.length) * 0.62;
    const clock = new Intl.DateTimeFormat(this.hass.language, { hour: "2-digit", minute: "2-digit" });
    const total = rains.reduce((sum, rain) => sum + rain, 0);
    return html`
      <section class="card chart-card" data-weather-chart>
        <h3>${this._t("weather_next_day")}</h3>
        <svg class="chart" viewBox="0 0 ${width} ${height}">
          <defs>
            <linearGradient id="warm" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="#ffd166" stop-opacity="0.45"></stop>
              <stop offset="1" stop-color="#ffd166" stop-opacity="0"></stop>
            </linearGradient>
          </defs>
          <path d=${area} fill="url(#warm)"></path>
          <path d=${line} class="line"></path>
          <line x1="10" x2=${width - 10} y1=${rainBottom} y2=${rainBottom} class="base"></line>
          <text x="10" y=${rainTop - 8} class="axis">${this._t("weather_precipitation")}</text>
          ${hours.map((hour, index) => {
            const rain = rains[index];
            const tall = rain ? Math.max(4, (rain / scale) * (rainBottom - rainTop)) : 0;
            return svg`
              ${rain
                ? svg`<rect x=${xs[index] - bar / 2} y=${rainBottom - tall} width=${bar} height=${tall} rx="3"
                    class=${precipitationKind(hour.condition)} data-weather-rain=${precipitationKind(hour.condition)}></rect>
                  <text x=${xs[index]} y=${rainBottom - tall - 5} class="amount">${this._number(rain)}</text>`
                : nothing}
              ${index % 3
                ? nothing
                : svg`<text x=${xs[index]} y=${ys[index] - 12} class="temperature">${this._number(hour.temperature, 0)}°</text>
                  <text x=${xs[index]} y=${height - 4} class="hour">${clock.format(new Date(hour.datetime))}</text>`}
            `;
          })}
        </svg>
        <div class="chart-icons">
          ${hours.map((hour, index) =>
            index % 3
              ? nothing
              : html`<ha-icon
                  style="left: ${(xs[index] / width) * 100}%"
                  .icon=${weatherIcon(hour.condition)}
                ></ha-icon>`,
          )}
        </div>
        <div class="legend">
          <span><i class="rain"></i>${this._t("weather_rain")}</span>
          <span><i class="snow"></i>${this._t("weather_snow")}</span>
          <span><i class="mix"></i>${this._t("weather_mix")}</span>
          <b data-weather-total>${translate(this.hass.language, "weather_total", { value: this._number(total) })}</b>
        </div>
      </section>
    `;
  }

  _renderColumns() {
    const days = (this._daily ?? []).slice(0, DAYS_SHOWN - 1);
    if (!days.length) return nothing;
    const lowOf = (day) => day.templow ?? day.temperature;
    const lowest = Math.min(...days.map(lowOf));
    const highest = Math.max(...days.map((day) => day.temperature));
    const range = highest - lowest || 1;
    const name = new Intl.DateTimeFormat(this.hass.language, { weekday: "short" });
    const date = new Intl.DateTimeFormat(this.hass.language, { day: "2-digit", month: "2-digit" });
    const today = new Date();
    return html`
      <section class="card days-card">
        <h3>${this._t("weather_daily")}</h3>
        <div class="columns" style="--days: ${days.length}">
          ${days.map((day) => {
            const at = new Date(day.datetime);
            const isToday = isSameDay(at, today);
            const kind = precipitationKind(day.condition);
            return html`
              <div class="column ${isToday ? "today" : ""}" data-weather-column>
                <strong>${isToday ? this._t("weather_today") : name.format(at)}</strong>
                <small>${date.format(at)}</small>
                <ha-icon .icon=${weatherIcon(day.condition)}></ha-icon>
                <span class="high">${this._number(day.temperature, 0)}°</span>
                <span class="range">
                  <i
                    style="top: ${((highest - day.temperature) / range) * 100}%; height: ${Math.max(
                      ((day.temperature - lowOf(day)) / range) * 100,
                      4,
                    )}%"
                  ></i>
                </span>
                <span class="low">${this._number(lowOf(day), 0)}°</span>
                <small class="amount ${kind}">
                  ${day.precipitation
                    ? html`<ha-icon icon=${kind === "rain" ? "mdi:water" : "mdi:snowflake"}></ha-icon>${this._number(
                          day.precipitation,
                        )} mm`
                    : html`&nbsp;`}
                </small>
              </div>
            `;
          })}
        </div>
      </section>
    `;
  }

  _renderWideNow() {
    const stateObj = this.hass.states[this.item.entity];
    const { temperature } = stateObj.attributes;
    const today = (this._daily ?? []).find((day) => isSameDay(new Date(day.datetime), new Date()));
    const sun = this.hass.states["sun.sun"]?.attributes;
    const clock = new Intl.DateTimeFormat(this.hass.language, { hour: "2-digit", minute: "2-digit" });
    return html`
      <section class="card now-card" data-weather-now>
        <div class="big">
          <ha-icon .icon=${weatherIcon(stateObj.state)}></ha-icon>
          <div>
            <strong>${typeof temperature === "number" ? `${this._number(temperature)}°` : this._t("no_data")}</strong>
            <span>${this.hass.formatEntityState?.(stateObj) ?? stateObj.state}</span>
          </div>
        </div>
        ${today
          ? html`<p class="minmax">
              ${translate(this.hass.language, "weather_today_range", {
                high: this._number(today.temperature, 0),
                low: this._number(today.templow ?? today.temperature, 0),
              })}
            </p>`
          : nothing}
        ${sun?.next_rising && sun?.next_setting
          ? html`<p class="sun">
              <span data-weather-sunrise>
                <ha-icon icon="mdi:weather-sunny"></ha-icon>${translate(this.hass.language, "weather_sunrise", {
                  time: clock.format(new Date(sun.next_rising)),
                })}
              </span>
              <span data-weather-sunset>
                <ha-icon icon="mdi:weather-night"></ha-icon>${translate(this.hass.language, "weather_sunset", {
                  time: clock.format(new Date(sun.next_setting)),
                })}
              </span>
            </p>`
          : nothing}
      </section>
    `;
  }

  render() {
    if (!this.hass || !this.item || !this.hass.states[this.item.entity]) return nothing;
    if (this._wide.matches) {
      return html`
        <div class="wide" data-weather-wide>
          <div class="side">${this._renderWideNow()} ${this._renderFacts()}</div>
          ${this._renderChart()} ${this._renderColumns()}
          ${this.item.forecast ? nothing : html`<p data-weather-empty>${this._t("weather_no_forecast")}</p>`}
        </div>
      `;
    }
    return html`
      <div class="content">
        ${this._renderNow()} ${this._renderFacts()} ${this._renderHourly()} ${this._renderDaily()}
        ${this.item.forecast ? nothing : html`<p data-weather-empty>${this._t("weather_no_forecast")}</p>`}
      </div>
    `;
  }

  static styles = [
    tokens,
    css`
      .content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 0 16px 16px;
        color: var(--hd-text);
      }
      .now {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 8px 0;
      }
      .now ha-icon {
        --mdc-icon-size: 72px;
        color: var(--hd-media-chip);
      }
      .now div {
        display: flex;
        flex-direction: column;
      }
      .now strong {
        font-size: 44px;
        font-weight: 500;
        line-height: 52px;
      }
      .now span {
        color: var(--hd-text-muted);
        font-size: 15px;
      }
      .facts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .fact {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .fact ha-icon {
        flex: none;
        color: var(--hd-text-muted);
      }
      .fact span {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .fact small {
        color: var(--hd-text-muted);
        font-size: 12px;
        line-height: 16px;
      }
      .fact strong {
        font-size: 15px;
        font-weight: 500;
      }
      h3 {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 500;
      }
      .hours {
        display: flex;
        gap: 8px;
        margin: 0 -16px;
        padding: 0 16px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .hour {
        display: flex;
        flex: none;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        min-width: 60px;
        padding: 10px 6px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .hour small {
        color: var(--hd-text-muted);
        font-size: 12px;
        line-height: 16px;
      }
      .hour ha-icon,
      .day ha-icon {
        color: var(--hd-media-chip);
      }
      .hour strong {
        font-size: 15px;
        font-weight: 500;
      }
      .hour .rain {
        min-height: 16px;
      }
      .days {
        display: flex;
        flex-direction: column;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .day {
        display: grid;
        grid-template-columns: 56px 28px 48px 32px 1fr 32px;
        align-items: center;
        gap: 6px;
        padding: 10px 12px;
        font-size: 15px;
      }
      .day .rain,
      .day .low {
        color: var(--hd-text-muted);
      }
      .day .rain {
        font-size: 12px;
      }
      .day .low {
        text-align: right;
      }
      .day strong {
        font-weight: 500;
      }
      .bar {
        position: relative;
        height: 6px;
        border-radius: 3px;
        background: var(--hd-off-icon);
      }
      .bar i {
        position: absolute;
        top: 0;
        bottom: 0;
        border-radius: 3px;
        background: var(--hd-media-chip);
      }
      p {
        margin: 0;
        color: var(--hd-text-muted);
        text-align: center;
      }
      /* A tablet on its side ---------------------------------------------------------------------------------- */
      /* The chart beside now and the readings, ending with them; the days under the chart. */
      .wide {
        display: grid;
        align-items: start;
        grid-template-columns: 340px minmax(0, 1fr);
        grid-template-rows: auto auto;
        gap: 16px;
        padding: 0 20px 20px;
        color: var(--hd-text);
      }
      .side {
        display: flex;
        grid-row: 1;
        grid-column: 1;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
      }
      .chart-card {
        display: flex;
        grid-row: 1;
        grid-column: 2;
        flex-direction: column;
        justify-content: space-between;
        align-self: stretch;
        min-width: 0;
      }
      .days-card {
        padding-top: 12px;
        padding-bottom: 12px;
      }
      .days-card,
      .wide > p {
        grid-row: 2;
        grid-column: 2;
        min-width: 0;
      }
      .card {
        position: relative;
        padding: 16px 18px;
        border-radius: 28px;
        background: var(--hd-off);
      }
      .now-card .big {
        display: flex;
        gap: 14px;
        align-items: center;
      }
      .now-card .big ha-icon {
        --mdc-icon-size: 84px;
        color: var(--hd-media-chip);
      }
      .now-card .big div {
        display: flex;
        flex-direction: column;
      }
      .now-card .big strong {
        font-size: 64px;
        font-weight: 300;
        line-height: 1;
      }
      .now-card .big span {
        margin-top: 6px;
        font-size: 18px;
      }
      .minmax {
        margin: 10px 0 0;
        color: var(--hd-text-muted);
      }
      .sun {
        display: flex;
        justify-content: space-between;
        margin: 14px 0 0;
        padding-top: 12px;
        border-top: 1px solid var(--hd-outline);
      }
      .sun span {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .chart {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
      }
      .chart .line {
        fill: none;
        stroke: #ffb703;
        stroke-width: 3;
        stroke-linejoin: round;
      }
      .chart text {
        fill: currentColor;
        text-anchor: middle;
      }
      .chart .temperature {
        font-size: 13px;
        font-weight: 500;
      }
      .chart .hour,
      .chart .axis {
        font-size: 12px;
        opacity: 0.7;
      }
      .chart .axis {
        text-anchor: start;
      }
      .chart .amount {
        font-size: 11px;
        opacity: 0.85;
      }
      .chart .base {
        stroke: var(--hd-outline);
      }
      .chart rect.rain,
      .legend i.rain {
        fill: #3d9df2;
        background: #3d9df2;
      }
      .chart rect.snow,
      .legend i.snow {
        fill: #e8eefc;
        background: #e8eefc;
        stroke: rgba(128, 128, 128, 0.4);
      }
      .chart rect.mix,
      .legend i.mix {
        fill: #a693f5;
        background: #a693f5;
      }
      .chart-icons {
        position: absolute;
        top: 48px;
        right: 18px;
        left: 18px;
        height: 24px;
        pointer-events: none;
      }
      .chart-icons ha-icon {
        position: absolute;
        transform: translateX(-50%);
        --mdc-icon-size: 22px;
      }
      .legend {
        display: flex;
        gap: 16px;
        align-items: center;
        font-size: 13px;
      }
      .legend i {
        display: inline-block;
        width: 12px;
        height: 12px;
        margin-right: 6px;
        border-radius: 3px;
        vertical-align: -1px;
      }
      .legend b {
        margin-left: auto;
        font-weight: 500;
      }
      .columns {
        display: grid;
        grid-template-columns: repeat(var(--days, 6), minmax(0, 1fr));
        gap: 10px;
      }
      .column {
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: center;
        padding: 8px 6px;
        border-radius: 20px;
        background: var(--hd-surface, rgba(255, 255, 255, 0.08));
      }
      .column.today {
        outline: 2px solid var(--hd-media-chip);
      }
      .column small {
        color: var(--hd-text-muted);
        font-size: 12px;
      }
      .column > ha-icon {
        --mdc-icon-size: 30px;
      }
      .high {
        font-size: 20px;
        font-weight: 500;
      }
      .low {
        color: var(--hd-text-muted);
      }
      .range {
        position: relative;
        width: 8px;
        height: 36px;
        border-radius: 4px;
        background: var(--hd-outline);
      }
      .range i {
        position: absolute;
        right: 0;
        left: 0;
        border-radius: 4px;
        background: linear-gradient(#ffb84d, #5ab0ff);
      }
      .column .amount {
        display: flex;
        gap: 2px;
        align-items: center;
        color: color-mix(in srgb, #3d9df2 55%, var(--hd-text));
        --mdc-icon-size: 14px;
      }
      .column .amount.snow,
      .column .amount.mix {
        color: var(--hd-text);
      }
    `,
  ];
}
