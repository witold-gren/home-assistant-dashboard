// The weather that was: the last seven days and today as the home's own sensors measured them, behind the chart of
// the next 24 hours. The numbers are the hourly statistics of the recorder, so every hour keeps its lowest and its
// highest reading, not only the mean.

import { css, html, nothing, svg } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { WEATHER_CHART } from "./weather-days.js";

export const PAST_DAYS = 7;
// A day is 6:00–18:00 and its night 18:00–6:00 of the next morning: the night that follows the day's work.
export const DAY_START = 6;
export const NIGHT_START = 18;
const HOUR_MS = 3_600_000;
const STALE_MS = 600_000;
const SWIPE_PX = 50;

const atHour = (date, days, hour = 0) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, hour).getTime();

/** The lowest and the highest of the hours, or null without any. */
function extremes(hours) {
  const known = hours.filter((hour) => Number.isFinite(hour.min) && Number.isFinite(hour.max));
  if (!known.length) return null;
  return { min: Math.min(...known.map((hour) => hour.min)), max: Math.max(...known.map((hour) => hour.max)) };
}

const between = (hours, start, end) => hours.filter((hour) => hour.time >= start && hour.time < end);

/**
 * The past days out of the hourly statistics: today first, then the days before it. Each has its hours, the extremes
 * of its day and of the night after it, the rain, the hours under the limit (day and night after it) and the hours
 * that are over but have no reading: a gap is never taken for a warm hour.
 */
export function pastDays(temperatures, rains, { now = new Date(), limit = null, hasRain = true } = {}) {
  const hours = (temperatures ?? [])
    .filter((row) => Number.isFinite(row.mean))
    .map((row) => ({ time: row.start, mean: row.mean, min: row.min ?? row.mean, max: row.max ?? row.mean }));
  const drops = (rains ?? [])
    .filter((row) => Number.isFinite(row.change))
    .map((row) => ({ time: row.start, amount: Math.max(0, row.change) }));
  // The statistics of an hour come a while after its end: the last one is not a gap yet.
  const over = now.getTime() - 1.25 * HOUR_MS;
  return Array.from({ length: PAST_DAYS + 1 }, (_, back) => {
    const start = atHour(now, -back);
    const end = atHour(now, 1 - back);
    const dayStart = atHour(now, -back, DAY_START);
    const nightStart = atHour(now, -back, NIGHT_START);
    const nightEnd = atHour(now, 1 - back, DAY_START);
    const own = between(hours, start, end);
    const round = between(hours, dayStart, nightEnd);
    const rain = between(drops, start, end);
    const expected = Math.max(0, Math.floor((Math.min(end, over) - start) / HOUR_MS));
    return {
      back,
      start,
      end,
      hours: own,
      rain,
      day: extremes(between(hours, dayStart, nightStart)),
      night: extremes(between(hours, nightStart, nightEnd)),
      dayOpen: now.getTime() < nightStart,
      nightOpen: now.getTime() < nightEnd,
      all: extremes(own),
      total: hasRain && rain.length ? rain.reduce((sum, drop) => sum + drop.amount, 0) : null,
      cold: Number.isFinite(limit) ? round.filter((hour) => hour.min < limit).length : null,
      missing: Math.max(0, expected - own.filter((hour) => hour.time + HOUR_MS <= over).length),
    };
  });
}

/** The readings as lines without a bridge over a gap: pieces of hours that follow each other. */
export function unbroken(hours) {
  const pieces = [];
  for (const hour of hours) {
    const last = pieces.at(-1);
    if (last && hour.time - last.at(-1).time <= HOUR_MS) last.push(hour);
    else pieces.push([hour]);
  }
  return pieces;
}

export const WeatherHistory = (Base) =>
  class extends Base {
    static properties = {
      _back: { state: true },
      _past: { state: true },
      _pastError: { state: true },
    };

    // 0 is the forecast, 1 today as measured, 2 yesterday and so on.
    get _farthest() {
      return this._hasHistory ? PAST_DAYS + 1 : 0;
    }

    // Days of the forecast are under zero: -1 tomorrow.
    get _latest() {
      return this._nearest ? this._nearest : -(this._choices.at(-1) ?? 0);
    }

    get _position() {
      const back = this._back ?? this._nearest;
      return back > 0 ? back : -(this._ahead ?? 0) || 0;
    }

    get _hasPages() {
      return this._hasHistory || this._latest < 0;
    }

    _goTo(position) {
      const to = Math.min(this._farthest, Math.max(this._latest, position));
      if (to >= this._nearest) {
        if (!this._nearest) this._ahead = null;
        if (this._hasHistory) this._goBack(to);
        return;
      }
      this._back = 0;
      this._ahead = -to;
    }

    get _hasHistory() {
      return Boolean(this.item?.history?.temperature);
    }

    // The chart of the forecast is on a tablet on its side only; elsewhere, and without a forecast, the measured days
    // start with today.
    get _nearest() {
      return this._wide.matches && this.item?.forecast ? 0 : 1;
    }

    updated(changed) {
      super.updated?.(changed);
      if (this.hass && this._hasHistory && !((this._back ?? 0) >= this._nearest)) this._goBack(this._nearest);
    }

    _goBack(back) {
      this._back = Math.min(this._farthest, Math.max(this._nearest, back));
      if (this._back > 0) this._loadPast();
    }

    async _loadPast() {
      if (this._pastAt && Date.now() - this._pastAt < STALE_MS) return;
      const { temperature, rain } = this.item.history;
      this._pastAt = Date.now();
      const ask = (id, types) =>
        this.hass.callWS({
          type: "recorder/statistics_during_period",
          start_time: new Date(atHour(new Date(), -PAST_DAYS)).toISOString(),
          statistic_ids: [id],
          period: "hour",
          types,
        });
      try {
        const [temperatures, rains] = await Promise.all([
          ask(temperature, ["min", "mean", "max"]),
          rain ? ask(rain, ["change"]) : {},
        ]);
        this._past = { temperatures: temperatures?.[temperature] ?? [], rains: rain ? (rains?.[rain] ?? []) : [] };
        this._pastError = false;
      } catch {
        this._pastAt = null;
        this._pastError = true;
      }
    }

    get _days() {
      if (!this._past) return null;
      const { limit, rain } = this.item.history;
      return pastDays(this._past.temperatures, this._past.rains, { limit, hasRain: Boolean(rain) });
    }

    _pastName(day, long = true) {
      if (day.back === 0) return this._t("weather_today");
      if (day.back === 1 && long) return this._t("weather_yesterday");
      const options = long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short" };
      return new Intl.DateTimeFormat(this.hass.language, options).format(new Date(day.start));
    }

    // The arrows over the chart: back in time to the left, towards the forecast to the right.
    _renderPager(label) {
      if (!this._hasPages) return html`<h3>${label}</h3>`;
      const nearest = this._nearest;
      const at = this._position;
      const arrow = (to, key, icon) => html`
        <button
          data-weather-go=${key}
          aria-label=${this._t(`weather_${key}`)}
          ?disabled=${to < this._latest || to > this._farthest}
          @click=${() => this._goTo(to)}
        >
          <ha-icon .icon=${icon}></ha-icon>
        </button>
      `;
      return html`
        <div class="pager">
          ${arrow(at + 1, "earlier", "mdi:chevron-left")}
          <h3 data-weather-shown>${label}</h3>
          ${at !== 0 && nearest === 0
            ? html`<button class="forecast" data-weather-go="forecast" @click=${() => this._goTo(0)}>
                ${this._t(at > 0 ? "weather_forecast" : "weather_next_day")}
              </button>`
            : nothing}
          ${arrow(at - 1, "later", "mdi:chevron-right")}
        </div>
      `;
    }

    // Dragging the chart to the right moves back in time, to the left forward.
    _swipeStart = (event) => {
      this._swipeX = event.clientX;
    };

    _swipeEnd = (event) => {
      const moved = event.clientX - (this._swipeX ?? event.clientX);
      this._swipeX = null;
      if (!this._hasPages || Math.abs(moved) < SWIPE_PX) return;
      this._goTo(this._position + (moved > 0 ? 1 : -1));
    };

    _degrees(value) {
      return `${this._number(value)}°`;
    }

    _isCold(value) {
      return Number.isFinite(this.item.history.limit) && value < this.item.history.limit;
    }

    _renderPart(key, part, open) {
      return html`
        <span data-weather-part=${key}>
          <ha-icon icon=${key === "day" ? "mdi:weather-sunny" : "mdi:weather-night"}></ha-icon>
          <small>${this._t(`weather_part_${key}`)}${part && open ? ` · ${this._t("weather_so_far")}` : ""}</small>
          <b class=${part && this._isCold(part.min) ? "cold" : ""}>
            ${part ? `${this._degrees(part.min)} – ${this._degrees(part.max)}` : "–"}
          </b>
        </span>
      `;
    }

    _renderPastChart() {
      const days = this._days;
      const day = days?.[(this._back ?? 1) - 1];
      return html`
        <section
          class="card chart-card past"
          data-weather-past
          @pointerdown=${this._swipeStart}
          @pointerup=${this._swipeEnd}
        >
          ${this._renderPager(day ? this._pastName(day) : this._t("weather_past"))}
          ${!day
            ? html`<p>${this._t(this._pastError ? "weather_past_error" : "weather_past_loading")}</p>`
            : day.hours.length
              ? this._renderPastDay(day)
              : html`<p data-weather-no-readings>${this._t("weather_no_readings")}</p>`}
        </section>
      `;
    }

    _renderPastDay(day) {
      const { limit } = this.item.history;
      const { width, height, top, bottom, rainTop, rainBottom } = WEATHER_CHART;
      const { hours } = day;
      const bounds = [day.all.min, day.all.max, ...(Number.isFinite(limit) ? [limit] : [])];
      const low = Math.min(...bounds) - 1;
      const high = Math.max(...bounds) + 1;
      const x = (time) => 20 + ((time - day.start) / (day.end - day.start)) * (width - 40);
      const y = (value) => bottom - ((value - low) / (high - low)) * (bottom - top);
      const middle = (hour) => x(hour.time + HOUR_MS / 2);
      const path = (piece, key) =>
        piece.map((hour, index) => `${index ? "L" : "M"}${middle(hour).toFixed(1)},${y(hour[key]).toFixed(1)}`).join(" ");
      const band = (piece) =>
        `${path(piece, "max")} ${path([...piece].reverse(), "min").replace("M", "L")} Z`;
      const pieces = unbroken(hours);
      const scale = Math.max(1, ...day.rain.map((drop) => drop.amount));
      const bar = ((width - 40) / 24) * 0.62;
      const clock = new Intl.DateTimeFormat(this.hass.language, { hour: "2-digit", minute: "2-digit" });
      const lowest = hours.reduce((found, hour) => (hour.min < found.min ? hour : found));
      // Under its point, or over it where the line of the limit would run through the number.
      const underLimit = Number.isFinite(limit) && y(limit) > y(lowest.min) && y(limit) < y(lowest.min) + 26;
      const lowestY = y(lowest.min) + (underLimit ? -10 : 18);
      return html`
        <svg class="chart" viewBox="0 0 ${width} ${height}">
          ${pieces.map((piece) => svg`
            <path d=${band(piece)} class="band"></path>
            <path d=${path(piece, "mean")} class="line"></path>
            ${piece.length === 1 ? svg`<circle cx=${middle(piece[0])} cy=${y(piece[0].mean)} r="3" class="dot"></circle>` : nothing}
          `)}
          ${Number.isFinite(limit)
            ? svg`<line x1="10" x2=${width - 10} y1=${y(limit)} y2=${y(limit)} class="limit" data-weather-limit></line>
                <text x="10" y=${y(limit) + 14} class="limit-label">${this._degrees(limit)}</text>`
            : nothing}
          ${hours.map((hour) =>
            new Date(hour.time).getHours() % 3 || Math.abs(hour.time - lowest.time) <= HOUR_MS
              ? nothing
              : svg`<text x=${middle(hour)} y=${y(hour.max) - 8} class="temperature">${this._degrees(hour.mean)}</text>`,
          )}
          <circle cx=${middle(lowest)} cy=${y(lowest.min)} r="4" class="lowest"></circle>
          <text x=${Math.min(width - 24, Math.max(24, middle(lowest)))} y=${lowestY} class="temperature" data-weather-lowest>${this._degrees(lowest.min)}</text>
          ${Array.from({ length: 9 }, (_, index) => {
            const time = day.start + ((day.end - day.start) * index) / 8;
            return svg`<text x=${x(time)} y=${height - 4} class="hour">${index === 8 ? "24:00" : clock.format(new Date(atHour(new Date(day.start), 0, index * 3)))}</text>`;
          })}
          ${this.item.history.rain
            ? svg`<line x1="10" x2=${width - 10} y1=${rainBottom} y2=${rainBottom} class="base"></line>
                <text x="10" y=${rainTop - 8} class="axis">${this._t("weather_precipitation")}</text>
                ${day.rain.filter((drop) => drop.amount >= 0.05).map((drop) => {
                  const tall = Math.max(4, (drop.amount / scale) * (rainBottom - rainTop));
                  return svg`<rect x=${middle(drop) - bar / 2} y=${rainBottom - tall} width=${bar} height=${tall} rx="3"
                      class="rain" data-weather-measured-rain></rect>
                    <text x=${middle(drop)} y=${rainBottom - tall - 5} class="amount">${this._number(drop.amount)}</text>`;
                })}`
            : nothing}
        </svg>
        <div class="parts">
          ${this._renderPart("day", day.day, day.dayOpen)} ${this._renderPart("night", day.night, day.nightOpen)}
          ${day.cold === null
            ? nothing
            : html`<span data-weather-cold>
                <ha-icon icon="mdi:snowflake-thermometer"></ha-icon>
                <small>${translate(this.hass.language, "weather_below", { value: this._number(this.item.history.limit) })}</small>
                <b class=${day.cold ? "cold" : ""}>${day.cold} h</b>
              </span>`}
          ${day.total === null
            ? nothing
            : html`<span data-weather-past-total>
                <ha-icon icon="mdi:water"></ha-icon><small>${this._t("weather_rain")}</small><b>${this._number(day.total)} mm</b>
              </span>`}
        </div>
        ${day.missing
          ? html`<p class="missing" data-weather-missing>
              ${translate(this.hass.language, "weather_missing", { count: day.missing })}
            </p>`
          : nothing}
      `;
    }

    // The week as columns, the oldest first: the day's range, the night's and the rain. A column opens its day.
    _renderPastWeek() {
      const days = this._days;
      if (!days) return nothing;
      const range = (key, part) => html`
        <span class="part" data-weather-week=${key}>
          <ha-icon icon=${key === "day" ? "mdi:weather-sunny" : "mdi:weather-night"}></ha-icon>
          ${part
            ? html`<b>${this._degrees(part.max)}</b><b class=${this._isCold(part.min) ? "cold" : "low"}>${this._degrees(part.min)}</b>`
            : html`<b>–</b>`}
        </span>
      `;
      return html`
        <section class="card days-card" data-weather-past-week>
          <h3>${this._t("weather_past_week")}</h3>
          <div class="columns past-columns">
            ${[...days].reverse().map(
              (day) => html`
                <button
                  class="column ${day.back + 1 === (this._back ?? 1) ? "today" : ""}"
                  data-weather-past-day=${day.back}
                  @click=${() => this._goBack(day.back + 1)}
                >
                  <strong>${this._pastName(day, false)}</strong>
                  <small>${new Intl.DateTimeFormat(this.hass.language, { day: "2-digit", month: "2-digit" }).format(new Date(day.start))}</small>
                  ${range("day", day.day)} ${range("night", day.night)}
                  <small class="amount rain">
                    ${day.total ? html`<ha-icon icon="mdi:water"></ha-icon>${this._number(day.total)} mm` : html`&nbsp;`}
                  </small>
                </button>
              `,
            )}
          </div>
        </section>
      `;
    }

    // A phone and an upright tablet: the measured days under the forecast.
    _renderPastList() {
      if (!this._hasHistory) return nothing;
      return html`<div class="past-list">${this._renderPastChart()} ${this._renderPastWeek()}</div>`;
    }
  };

export const historyStyles = css`
  .pager {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .pager h3 {
    flex: 1;
    margin: 0;
  }
  .pager h3::first-letter {
    text-transform: uppercase;
  }
  .pager button {
    display: grid;
    flex: none;
    place-items: center;
    min-width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 22px;
    background: var(--hd-surface);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .pager button.forecast {
    padding: 0 16px;
  }
  .pager button[disabled] {
    opacity: 0.35;
    cursor: default;
  }
  .chart-card {
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
  }
  .chart .band {
    fill: #ffb703;
    opacity: 0.22;
  }
  .chart .dot {
    fill: #ffb703;
  }
  .chart .limit {
    stroke: #3d9df2;
    stroke-dasharray: 6 5;
    stroke-width: 1.5;
  }
  .chart text.limit-label {
    text-anchor: start;
    font-size: 12px;
  }
  .chart .lowest {
    fill: #3d9df2;
  }
  .parts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 22px;
    margin-top: 8px;
    font-size: 14px;
  }
  .parts span {
    display: flex;
    gap: 6px;
    align-items: center;
    --mdc-icon-size: 18px;
  }
  .parts small,
  .missing {
    color: var(--hd-text-muted);
  }
  .missing {
    margin: 8px 0 0;
    font-size: 13px;
    text-align: start;
  }
  b.cold {
    color: color-mix(in srgb, #3d9df2 65%, var(--hd-text));
  }
  .parts b,
  .past-columns b {
    font-weight: 500;
  }
  .columns.past-columns {
    gap: 6px;
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
  .past-columns button.column {
    padding: 8px 2px;
    border: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .past-columns .part {
    display: flex;
    gap: 3px;
    align-items: center;
    justify-content: center;
    font-size: 12.5px;
    white-space: nowrap;
    --mdc-icon-size: 13px;
  }
  .past-columns .part .low {
    color: var(--hd-text-muted);
  }
  .past-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .past-list .past-columns {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .past-list .card {
    padding: 14px 12px;
    border-radius: 14px;
  }
  .past-list .chart text {
    font-size: 22px;
  }
  .past-list .chart text.amount {
    font-size: 15px;
  }
`;
