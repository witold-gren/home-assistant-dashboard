// The weather screen. The forecast does not live in the entity's state: Home Assistant sends it
// only to those who subscribe, so this element holds the subscriptions for as long as it is open.

import { LitElement, css, html, nothing, svg } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { FORECAST_DAILY, FORECAST_HOURLY, weatherIcon } from "./model.js";
import { tokens } from "./styles.js";
import { mediaQuery } from "./media.js";
import { WeatherDays, daysAhead, daysStyles, lowOf, precipitationKind } from "./weather-days.js";
import { WeatherHistory, historyStyles } from "./weather-history.js";

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

// A station often measures only part of this, so the rest comes from the forecast entity.
export function weatherFacts(current, forecast) {
  return FACTS.flatMap((fact) => {
    const source = [current, forecast].find((attributes) => typeof attributes?.[fact.key] === "number");
    if (!source) return [];
    return [{ ...fact, value: source[fact.key], unit: fact.fixedUnit ?? source[fact.unit] ?? "" }];
  });
}

export { precipitationKind };

export class HomeDashboardWeather extends WeatherDays(WeatherHistory(LitElement)) {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    _hourly: { state: true },
    _daily: { state: true },
    _size: { state: true },
  };

  _wide = mediaQuery(WIDE_WEATHER);

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
    this._sizer?.disconnect();
    this._plot = null;
  }

  updated(changed) {
    super.updated(changed);
    this._measure();
    this._placeStrip();
    if (this._watches || !this.hass || !this.item) return;
    this._watches = [];
    const features = this.hass.states[this.item.forecast]?.attributes.supported_features ?? 0;
    if (features & FORECAST_HOURLY) this._watch("hourly");
    if (features & FORECAST_DAILY) this._watch("daily");
  }

  // The chart is drawn in the pixels of its box, so the box keeps its size whatever it shows and only the drawing
  // inside it changes.
  _measure() {
    const plot = this.renderRoot.querySelector(".plot");
    if (plot === this._plot) return;
    this._plot = plot;
    this._sizer ??= new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width > 0 && height > 0 && (width !== this._size?.width || height !== this._size?.height)) {
        this._size = { width, height };
      }
    });
    this._sizer.disconnect();
    if (plot) this._sizer.observe(plot);
  }

  /** Where things go in the chart: the temperature over the precipitation, the hours at the bottom. */
  get _dims() {
    const { width = 760, height = 300 } = this._size ?? {};
    return {
      width,
      height,
      top: 28,
      bottom: Math.round(height * 0.56),
      rainTop: Math.round(height * 0.68),
      rainBottom: height - 26,
    };
  }

  /**
   * The one frame of every chart: the header with its arrows, a row of icons, the chart in a box of its own size, the
   * legend, a row of numbers and a note. Each row is there even when empty, so no view is taller than another.
   */
  _renderFrame({ kind, label, icons = [], plot, legend = nothing, facts = nothing, note = nothing }) {
    const { width } = this._dims;
    return html`
      <section
        class="card chart-card ${this._hasPages ? "paged" : ""}"
        data-weather-chart=${kind === "chart" ? "" : nothing}
        data-weather-past=${kind === "past" ? "" : nothing}
        data-weather-days-chart=${kind === "days" ? "" : nothing}
        @pointerdown=${this._swipeStart}
        @pointerup=${this._swipeEnd}
      >
        ${this._renderPager(label)}
        <div class="chart-icons">
          ${icons.map(
            (icon) => html`<ha-icon style="left: ${(icon.x / width) * 100}%" .icon=${weatherIcon(icon.condition)}></ha-icon>`,
          )}
        </div>
        <div class="plot">${plot}</div>
        <div class="foot">
          <div class="legend">${legend}</div>
          <div class="facts-row">${facts}</div>
          <div class="note">${note}</div>
        </div>
      </section>
    `;
  }

  _forecastLegend() {
    return html`<span><i class="rain"></i>${this._t("weather_rain")}</span>
      <span><i class="snow"></i>${this._t("weather_snow")}</span>
      <span><i class="mix"></i>${this._t("weather_mix")}</span>`;
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
    // "|| 0": a small number under zero rounds to -0, which is written as 0.
    return new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: digits }).format(
      Number(Number(value).toFixed(digits)) || 0,
    );
  }

  // The days the window shows: a tablet on its side has one column less.
  get _shownDays() {
    return (this._daily ?? []).slice(0, DAYS_SHOWN);
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
    return html`<section>
      <h3>${this._t("weather_hourly")}</h3>
      ${this._renderHourStrip(hours)}
    </section>`;
  }

  _renderHourStrip(hours) {
    const format = new Intl.DateTimeFormat(this.hass.language, { hour: "2-digit", minute: "2-digit" });
    return html`
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
    `;
  }

  // The bars share one scale, so a warm day stands out from the whole week at a glance.
  _renderDaily() {
    const days = this._shownDays;
    if (!days.length) return nothing;
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
            const ahead = daysAhead(day.datetime);
            const open = ahead === this._ahead;
            const start = ((lowOf(day) - lowest) / range) * 100;
            const width = ((day.temperature - lowOf(day)) / range) * 100;
            return html`
              <button
                class="day"
                data-weather-day
                aria-expanded=${open}
                ?disabled=${ahead < 0}
                @click=${() => (this._ahead = open ? null : ahead)}
              >
                <span class="name">${isSameDay(date, today) ? this._t("weather_today") : format.format(date)}</span>
                <ha-icon .icon=${weatherIcon(day.condition)}></ha-icon>
                <small class="rain">${day.precipitation ? `${this._number(day.precipitation)} mm` : ""}</small>
                <span class="low">${this._number(lowOf(day), 0)}°</span>
                <span class="bar"><i style="left: ${start}%; width: ${Math.max(width, 4)}%"></i></span>
                <strong>${this._number(day.temperature, 0)}°</strong>
              </button>
              ${open ? this._renderDayDetails(ahead) : nothing}
            `;
          })}
        </div>
      </section>
    `;
  }

  // The next day: temperature as a line over a shaded area, every third hour labelled with its icon, and under it
  // the precipitation of each hour as bars coloured by what falls, on a scale that fits the wettest hour.
  _renderChart() {
    if (this._back > 0) return this._renderPastChart();
    if (this._ahead > 0 && this._chosen(this._ahead)) return this._renderChosenDay(this._ahead);
    const hours = (this._hourly ?? []).slice(0, HOURS_SHOWN);
    if (hours.length < 2) return nothing;
    return this._renderHoursChart(hours, { label: this._t("weather_next_day") });
  }

  // The hours of the next 24 hours or of a chosen day (`day`: with the limit, its own numbers and note).
  _renderHoursChart(hours, { label, day = false, facts, note = nothing }) {
    const { width, height, top, bottom, rainTop, rainBottom } = this._dims;
    const temps = hours.map((hour) => hour.temperature);
    const limit = this.item.history?.limit;
    const bounds = Number.isFinite(limit) ? [...temps, limit] : temps;
    const low = Math.min(...bounds) - 1;
    const high = Math.max(...bounds) + 1;
    const y = (value) => bottom - ((value - low) / (high - low)) * (bottom - top);
    const xs = hours.map((_, index) => 24 + (index * (width - 48)) / (hours.length - 1));
    const ys = temps.map(y);
    const line = xs.map((x, index) => `${index ? "L" : "M"}${x.toFixed(1)},${ys[index].toFixed(1)}`).join(" ");
    const area = `${line} L${xs.at(-1).toFixed(1)},${bottom + 8} L${xs[0].toFixed(1)},${bottom + 8} Z`;
    const rains = hours.map((hour) => hour.precipitation ?? 0);
    const scale = Math.max(1, ...rains);
    const bar = Math.min(28, ((width - 48) / hours.length) * 0.62);
    const clock = new Intl.DateTimeFormat(this.hass.language, { hour: "2-digit", minute: "2-digit" });
    const total = rains.reduce((sum, rain) => sum + rain, 0);
    const every = width < 520 ? 6 : 3;
    const plot = html`<svg class="chart" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="warm" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#ffd166" stop-opacity="0.45"></stop>
          <stop offset="1" stop-color="#ffd166" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <path d=${area} fill="url(#warm)"></path>
      ${this._renderLimit(limit, y)}
      <path d=${line} class="line"></path>
      <line x1="10" x2=${width - 10} y1=${rainBottom} y2=${rainBottom} class="base"></line>
      <text x="10" y=${rainTop - 8} class="axis">${this._t("weather_precipitation")}</text>
      ${hours.map((hour, index) => {
        const rain = rains[index];
        const tall = rain ? Math.max(4, (rain / scale) * (rainBottom - rainTop - 16)) : 0;
        return svg`
          ${rain
            ? svg`<rect x=${xs[index] - bar / 2} y=${rainBottom - tall} width=${bar} height=${tall} rx="3"
                class=${precipitationKind(hour.condition)} data-weather-rain=${precipitationKind(hour.condition)}></rect>
              <text x=${xs[index]} y=${rainBottom - tall - 5} class="amount">${this._number(rain)}</text>`
            : nothing}
          ${index % every
            ? nothing
            : svg`<text x=${xs[index]} y=${ys[index] - 10} class="temperature">${this._number(hour.temperature, 0)}°</text>
              <text x=${xs[index]} y=${height - 6} class="hour">${clock.format(new Date(hour.datetime))}</text>`}
        `;
      })}
    </svg>`;
    const cold = Number.isFinite(limit) ? temps.filter((value) => value < limit).length : null;
    return this._renderFrame({
      kind: "chart",
      label,
      icons: hours.flatMap((hour, index) => (index % every ? [] : [{ x: xs[index], condition: hour.condition }])),
      plot,
      legend: this._forecastLegend(),
      facts:
        facts ??
        html`<div class="parts">
          <span data-weather-next-range>
            <ha-icon icon="mdi:thermometer"></ha-icon><small>${this._t("weather_low_high")}</small>
            <b>${this._degrees(Math.min(...temps))} – ${this._degrees(Math.max(...temps))}</b>
          </span>
          <span data-weather-total>
            <ha-icon icon="mdi:water"></ha-icon><small>${this._t("weather_total_24")}</small><b>${this._number(total)} mm</b>
          </span>
          ${cold === null
            ? nothing
            : html`<span data-weather-next-cold>
                <ha-icon icon="mdi:snowflake-thermometer"></ha-icon>
                <small>${translate(this.hass.language, "weather_forecast_below", { value: this._number(limit) })}</small>
                <b class=${cold ? "cold" : ""}>${cold} h</b>
              </span>`}
        </div>`,
      note,
    });
  }

  // One strip of days under the chart: the measured days (scrolled away to the left), a line, and the next days. It
  // scrolls by the finger without touching the chart; a tap on a day shows it in the chart.
  _renderColumns() {
    const days = this._daily ?? [];
    const past = this._hasHistory ? this._pastScale : null;
    if (!days.length && !this._hasHistory) return nothing;
    const lows = [...days.map(lowOf), ...(past ? [past.lowest] : [])];
    const highs = [...days.map((day) => day.temperature), ...(past ? [past.highest] : [])];
    const scale = { lowest: Math.min(...lows), highest: Math.max(...highs) };
    const name = new Intl.DateTimeFormat(this.hass.language, { weekday: "short" });
    const date = new Intl.DateTimeFormat(this.hass.language, { day: "2-digit", month: "2-digit" });
    const position = this._position;
    return html`
      <section class="card days-card" data-weather-days>
        <div class="days-head">
          <h3>${this._t(this._hasHistory ? "weather_days_both" : "weather_daily")}</h3>
          ${this._hasHistory
            ? html`<small class="days-legend"><i class="past"></i>${this._t("weather_past")}<i></i>${this._t("weather_forecast")}</small>`
            : nothing}
        </div>
        <div class="strip" data-weather-strip>
          ${this._hasHistory ? this._renderPastColumns(scale) : nothing}
          ${days.map((day, index) => {
            const at = new Date(day.datetime);
            const ahead = daysAhead(day.datetime);
            const shown = position <= 0 && ahead === -position;
            const kind = precipitationKind(day.condition);
            return html`
              <button
                class="column ${shown ? "today" : ""} ${ahead === 0 ? "current" : ""} ${index === 0 ? "first-forecast" : ""}"
                data-weather-column=${ahead}
                aria-pressed=${shown}
                ?disabled=${ahead < 0}
                @click=${() => this._goTo(-ahead)}
              >
                <strong>${ahead === 0 ? this._t("weather_today") : name.format(at)}</strong>
                <small>${date.format(at)}</small>
                <ha-icon .icon=${weatherIcon(day.condition)}></ha-icon>
                <span class="high">${this._number(day.temperature, 0)}°</span>
                ${this._renderBar(day.temperature, lowOf(day), scale)}
                <span class="low">${this._number(lowOf(day), 0)}°</span>
                <small class="amount ${kind}">
                  ${day.precipitation
                    ? html`<ha-icon icon=${kind === "rain" ? "mdi:water" : "mdi:snowflake"}></ha-icon>${this._number(
                          day.precipitation,
                        )} mm`
                    : html`&nbsp;`}
                </small>
              </button>
            `;
          })}
        </div>
      </section>
    `;
  }

  // The strip starts at the next days; later it only follows the chosen day when it is out of sight.
  _placeStrip() {
    const strip = this.renderRoot.querySelector(".strip");
    if (!strip) return;
    const columns = strip.querySelectorAll(".column").length;
    const chosen = strip.querySelector('.column[aria-pressed="true"]');
    if (strip !== this._strip || columns !== this._stripColumns) {
      this._strip = strip;
      this._stripColumns = columns;
      const start = this._position > 0 ? chosen : strip.querySelector(".first-forecast");
      // Without the next days (a phone, no forecast) it starts at today, the last column.
      strip.scrollLeft = start ? start.offsetLeft - parseFloat(getComputedStyle(strip).paddingLeft) : strip.scrollWidth;
      this._stripAt = this._position;
      return;
    }
    if (this._stripAt === this._position || !chosen) return;
    this._stripAt = this._position;
    const left = chosen.offsetLeft - parseFloat(getComputedStyle(strip).paddingLeft);
    if (left < strip.scrollLeft || left + chosen.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: left < strip.scrollLeft ? left : left + chosen.offsetWidth - strip.clientWidth, behavior: "smooth" });
    }
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
        ${this._renderNow()} ${this._renderFacts()} ${this._renderHourly()} ${this._renderDaily()} ${this._renderPastList()}
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
        flex: 1 1 auto;
        box-sizing: border-box;
        min-height: 0;
        align-items: start;
        grid-template-columns: 340px minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) auto;
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
      :host {
        display: flex;
        flex-direction: column;
      }
      .chart-card {
        display: flex;
        grid-row: 1;
        grid-column: 2;
        flex-direction: column;
        gap: 4px;
        align-self: stretch;
        min-width: 0;
        min-height: 0;
      }
      /* The same margin under the columns as at their sides (over the padding of .card). */
      .card.days-card {
        padding-top: 12px;
        padding-bottom: 18px;
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
        font-size: 16px;
        font-weight: 500;
      }
      .chart .hour,
      .chart .axis {
        font-size: 14px;
        opacity: 0.75;
      }
      .chart .axis {
        text-anchor: start;
      }
      .chart .amount {
        font-size: 12px;
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
      /* The rows of the frame: the icons and the foot keep their height when empty, the chart takes the rest. */
      .chart-icons {
        position: relative;
        flex: none;
        height: 26px;
        pointer-events: none;
      }
      .chart-icons ha-icon {
        position: absolute;
        transform: translateX(-50%);
        --mdc-icon-size: 22px;
      }
      .plot {
        position: relative;
        flex: 1 1 auto;
        min-height: 180px;
      }
      .plot > .chart {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .plot > p {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
      }
      .foot {
        display: flex;
        flex: none;
        flex-direction: column;
        gap: 6px;
        min-height: 82px;
      }
      .facts-row {
        min-height: 24px;
      }
      .note {
        min-height: 18px;
        color: var(--hd-text-muted);
        font-size: 13px;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
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
      /* The strip of days: six columns in sight, the rest a swipe away, each stopping at a column. */
      /* The columns are measured on the card (cqw), so six fill its width whatever the strip holds. */
      .days-card {
        container-type: inline-size;
        overflow: hidden;
      }
      .strip {
        position: relative;
        display: grid;
        grid-auto-columns: calc((100cqw - 5 * 10px) / 6);
        grid-auto-flow: column;
        grid-template-rows: minmax(224px, auto);
        gap: 10px;
        margin: 0 -18px;
        /* On the right also the room of the line between the two kinds of days, so the next days fit in one view. */
        padding: 0 30px 0 18px;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scroll-padding: 0 18px;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
      }
      .strip::-webkit-scrollbar {
        display: none;
      }
      .strip > .column {
        scroll-snap-align: start;
      }
      .past-list .strip {
        grid-auto-columns: calc((100cqw - 3 * 10px) / 4);
        grid-template-rows: auto;
        margin: 0 -12px;
        padding: 0 12px;
        scroll-padding: 0 12px;
      }
      /* A line between the days that were and the next ones. */
      .strip > .first-forecast {
        position: relative;
        margin-left: 12px;
      }
      .strip > .column.past + .first-forecast::before {
        content: "";
        position: absolute;
        top: 8px;
        bottom: 8px;
        left: -12px;
        width: 2px;
        border-radius: 1px;
        background: var(--hd-outline);
      }
      /* Today, measured and forecast, a shade lighter than the other days: darker would sink into the card. */
      .strip > .column.current {
        background-image: linear-gradient(rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.16));
      }
      .column.past {
        background: color-mix(in srgb, var(--hd-surface, rgba(255, 255, 255, 0.08)) 70%, transparent);
      }
      .days-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }
      .days-legend {
        display: flex;
        gap: 6px;
        align-items: center;
        color: var(--hd-text-muted);
        font-size: 13px;
      }
      .days-legend i {
        display: inline-block;
        width: 12px;
        height: 12px;
        margin-left: 8px;
        border-radius: 3px;
        background: var(--hd-surface, rgba(255, 255, 255, 0.08));
      }
      .days-legend i.past {
        background: color-mix(in srgb, var(--hd-surface, rgba(255, 255, 255, 0.08)) 70%, transparent);
        outline: 1px dashed var(--hd-outline);
      }
      .columns {
        display: grid;
        grid-template-columns: repeat(var(--days, 6), minmax(0, 1fr));
        gap: 10px;
      }
      .column {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
        align-items: center;
        padding: 8px 6px;
        border-radius: 20px;
        background: var(--hd-surface, rgba(255, 255, 255, 0.08));
      }
      /* Inside the column, so the frame of the chosen day does not reach past it. */
      .column.today {
        outline: 2px solid var(--hd-media-chip);
        outline-offset: -2px;
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
    historyStyles,
    daysStyles,
  ];
}
