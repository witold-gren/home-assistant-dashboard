// A chart in a window of the dashboard, in its look, for what the Energy page shows: the power of the phases as lines,
// a voltage with the range the grid promises, and the energy of a device or of the whole home as bars. A finger on the
// chart shows the value at that moment. It stands in for the details window of Home Assistant there.

import { LitElement, css, html, nothing, svg } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { bucketed } from "./status-panel.js";
import { tokens } from "./styles.js";

const HOUR_MS = 3_600_000;
// Lines: hours back and how many points. Bars: hours back and the length of a bar.
export const LINE_RANGES = [
  { key: "6h", hours: 6, points: 72 },
  { key: "24h", hours: 24, points: 96 },
  { key: "7d", hours: 168, points: 112 },
];
export const BAR_RANGES = [
  { key: "24h", hours: 24, period: "hour" },
  { key: "7d", hours: 168, period: "day" },
  { key: "30d", hours: 720, period: "day" },
];
export const LINE_COLOURS = ["#5aa9ff", "#7ee2a8", "#ffb86b"];
const VIEW = { width: 600, height: 200 };

/** The lowest, the mean and the highest of numbers, or null without any. */
export function spread(values) {
  const numbers = values.filter(Number.isFinite);
  if (!numbers.length) return null;
  return {
    min: Math.min(...numbers),
    mean: numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
    max: Math.max(...numbers),
  };
}

/** The bounds of a value axis that leave room above and below, and take in a band (a voltage range) when given. */
export function axisBounds(values, band = null) {
  const numbers = [...values.filter(Number.isFinite), ...(band ?? [])];
  if (!numbers.length) return [0, 1];
  let low = Math.min(...numbers);
  let high = Math.max(...numbers);
  if (high === low) {
    high += 1;
    low -= 1;
  }
  const room = (high - low) * 0.08;
  return [band || low < 0 ? low - room : Math.max(0, low - room), high + room];
}

/** The index of the slot under a point `x` of a chart `width` wide with `count` slots. */
export const slotAt = (x, width, count) => Math.min(count - 1, Math.max(0, Math.floor((x / width) * count)));

export class HomeDashboardHistoryChart extends LitElement {
  static properties = {
    hass: { attribute: false },
    chart: { attribute: false },
    _range: { state: true },
    _data: { state: true },
    _hover: { state: true },
  };

  get _bars() {
    return this.chart?.mode === "bars";
  }

  get _ranges() {
    return this._bars ? BAR_RANGES : LINE_RANGES;
  }

  // The lines to draw: the power of each phase, one power and its voltage (a phase), or a line of its own.
  get _lines() {
    const chart = this.chart ?? {};
    if (chart.mode === "phase") return [{ id: chart.power, unit: "W" }, { id: chart.voltage, unit: "V", band: chart.band }].filter((line) => line.id);
    return (chart.lines ?? []).map((line) => (typeof line === "string" ? { id: line } : line));
  }

  willUpdate(changed) {
    if (changed.has("chart")) {
      // The last day: by the hour for the energy of a device, a line of 24 hours for a power.
      this._range = (this._bars ? this._ranges[0] : this._ranges[1]).key;
      this._data = null;
      this._hover = null;
    }
    if ((changed.has("chart") || changed.has("_range")) && this.hass && this.chart) this._load();
  }

  async _load() {
    const range = this._ranges.find((candidate) => candidate.key === this._range) ?? this._ranges[1];
    const asked = `${this._range}|${JSON.stringify(this.chart)}`;
    this._asked = asked;
    const end = Date.now();
    const start = end - range.hours * HOUR_MS;
    let data;
    if (this._bars) {
      const stats = await this.hass
        .callWS({
          type: "recorder/statistics_during_period",
          start_time: new Date(start).toISOString(),
          end_time: new Date(end).toISOString(),
          statistic_ids: [this.chart.energy],
          period: range.period,
          types: ["change"],
        })
        .catch(() => ({}));
      data = { bars: (stats?.[this.chart.energy] ?? []).map((row) => ({ time: row.start, value: row.change ?? 0 })), period: range.period };
    } else {
      const ids = this._lines.map((line) => line.id);
      const history = await this.hass
        .callWS({
          type: "history/history_during_period",
          start_time: new Date(start).toISOString(),
          end_time: new Date(end).toISOString(),
          entity_ids: ids,
          minimal_response: true,
          no_attributes: true,
        })
        .catch(() => ({}));
      const step = (end - start) / range.points;
      data = {
        start,
        step,
        series: ids.map((id) => {
          const points = (history?.[id] ?? []).map((row) => ({ time: (row.lu ?? row.lc ?? 0) * 1000, value: Number(row.s) }));
          const slices = bucketed(points, range.points, start, end);
          // Every slot gets a value: a slice without a reading keeps the last one known.
          const values = new Array(range.points).fill(null);
          for (const slice of slices) values[Math.min(range.points - 1, Math.floor((slice.time - start) / step))] = slice.value;
          let last = points.find((point) => Number.isFinite(point.value))?.value ?? null;
          return values.map((value) => (value === null ? last : (last = value)));
        }),
      };
    }
    if (this._asked === asked) this._data = data;
  }

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  _number(value, digits) {
    return new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  }

  _value(value, unit) {
    if (!Number.isFinite(value)) return "–";
    // Energy as the Energy page writes it, without trailing zeros; the rest with a fixed number of digits.
    if (unit === "kWh") {
      const digits = value < 10 ? 2 : 1;
      return `${new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: digits }).format(value)} kWh`;
    }
    return `${this._number(value, unit === "A" ? 2 : 0)} ${unit ?? ""}`.trim();
  }

  _unitOf(id) {
    return this.hass.states[id]?.attributes.unit_of_measurement ?? "";
  }

  _nameOf(line, index) {
    return line.name ?? (this.chart.mode === "phase" ? this._t(index ? "energy_voltage" : "chart_power") : this.hass.states[line.id]?.attributes.friendly_name ?? line.id);
  }

  _time(time, withDay) {
    const options = withDay ? { weekday: "short", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit" };
    return new Intl.DateTimeFormat(this.hass.language, options).format(time);
  }

  _point(event, count) {
    const box = event.currentTarget.getBoundingClientRect();
    this._hover = slotAt(event.clientX - box.left, box.width, count);
  }

  _renderRanges() {
    return html`
      <div class="ranges" data-chart-ranges>
        ${this._ranges.map(
          (range) => html`<button class=${range.key === this._range ? "on" : ""} data-chart-range=${range.key}
            @click=${() => (this._range = range.key)}>${this._t(`chart_range_${range.key}`)}</button>`,
        )}
      </div>
    `;
  }

  // One plot of lines that share a unit: the power of the phases, or a voltage with its band.
  _renderLines(lines, indexes) {
    const { series, start, step } = this._data;
    const values = indexes.flatMap((index) => series[index]);
    const band = lines[0].band ?? null;
    const [low, high] = axisBounds(values, band);
    const y = (value) => VIEW.height - ((value - low) / (high - low)) * VIEW.height;
    const count = series[indexes[0]].length;
    const x = (index) => (index / (count - 1)) * VIEW.width;
    const unit = lines[0].unit ?? this._unitOf(lines[0].id);
    const hover = this._hover;
    const longRange = this._range === "7d";
    return html`
      <div class="plot" data-chart-plot=${unit}>
        <span class="axis top">${this._value(high, unit)}</span>
        <span class="axis bottom">${this._value(low, unit)}</span>
        <svg viewBox="0 0 ${VIEW.width} ${VIEW.height}" preserveAspectRatio="none"
          @pointerdown=${(event) => this._point(event, count)} @pointermove=${(event) => this._point(event, count)}
          @pointerleave=${() => (this._hover = null)}>
          ${band ? svg`<rect class="band" x="0" width=${VIEW.width} y=${y(band[1])} height=${y(band[0]) - y(band[1])}></rect>` : nothing}
          ${indexes.map((index, position) => {
            const path = series[index]
              .map((value, slot) => (Number.isFinite(value) ? `${x(slot).toFixed(1)},${y(value).toFixed(1)}` : null))
              .filter(Boolean)
              .join(" ");
            return svg`<polyline class="line" style="stroke: ${lines[position].colour ?? LINE_COLOURS[index]}" points=${path}></polyline>`;
          })}
          ${hover === null ? nothing : svg`<line class="cursor" x1=${x(hover)} x2=${x(hover)} y1="0" y2=${VIEW.height}></line>`}
        </svg>
        ${hover === null
          ? nothing
          : html`<div class="tip" data-chart-tip style="left: calc(52px + (100% - 52px) * ${hover / (count - 1)})">
              <small>${this._time(start + hover * step, longRange)}</small>
              ${indexes.map(
                (index, position) => html`<span><i style="background: ${lines[position].colour ?? LINE_COLOURS[index]}"></i>${this._value(series[index][hover], unit)}</span>`,
              )}
            </div>`}
      </div>
      <div class="ticks">
        ${[0, 1, 2, 3].map((tick) => html`<span>${this._time(start + (tick / 3) * (count - 1) * step, longRange)}</span>`)}
      </div>
    `;
  }

  _renderFacts(values, unit) {
    const facts = spread(values);
    if (!facts) return nothing;
    return html`
      <div class="facts" data-chart-facts>
        ${["min", "mean", "max"].map((key) => html`<span><small>${this._t(`chart_${key}`)}</small><strong>${this._value(facts[key], unit)}</strong></span>`)}
      </div>
    `;
  }

  _renderBars() {
    const { bars, period } = this._data;
    if (!bars.length) return html`<p class="empty">${this._t("no_data")}</p>`;
    const top = Math.max(...bars.map((bar) => bar.value), 0.001);
    const width = VIEW.width / bars.length;
    const hover = this._hover;
    const label = (time) =>
      period === "hour" ? this._time(time, false) : new Intl.DateTimeFormat(this.hass.language, { weekday: "short", day: "numeric" }).format(time);
    const total = bars.reduce((sum, bar) => sum + bar.value, 0);
    return html`
      <div class="plot" data-chart-plot="kWh">
        <span class="axis top">${this._value(top, "kWh")}</span>
        <svg viewBox="0 0 ${VIEW.width} ${VIEW.height}" preserveAspectRatio="none"
          @pointerdown=${(event) => this._point(event, bars.length)} @pointermove=${(event) => this._point(event, bars.length)}
          @pointerleave=${() => (this._hover = null)}>
          ${bars.map((bar, index) => {
            const height = (bar.value / top) * VIEW.height;
            return svg`<rect class="bar ${index === hover ? "on" : ""}" data-chart-bar x=${index * width + width * 0.15} y=${VIEW.height - height}
              width=${width * 0.7} height=${height} rx="2"></rect>`;
          })}
        </svg>
        ${hover === null
          ? nothing
          : html`<div class="tip" data-chart-tip style="left: calc(52px + (100% - 52px) * ${(hover + 0.5) / bars.length})">
              <small>${label(bars[hover].time)}</small><span>${this._value(bars[hover].value, "kWh")}</span>
            </div>`}
      </div>
      <div class="ticks">
        ${[0, Math.floor(bars.length / 3), Math.floor((bars.length * 2) / 3), bars.length - 1].map((index) => html`<span>${label(bars[index].time)}</span>`)}
      </div>
      <div class="facts" data-chart-facts>
        <span><small>${this._t("chart_total")}</small><strong>${this._value(total, "kWh")}</strong></span>
        <span><small>${this._t(period === "hour" ? "chart_per_hour" : "chart_per_day")}</small><strong>${this._value(total / bars.length, "kWh")}</strong></span>
        <span><small>${this._t("chart_max")}</small><strong>${this._value(top, "kWh")}</strong></span>
      </div>
    `;
  }

  _renderNow() {
    if (this._bars) return nothing;
    const lines = this._lines;
    return html`
      <div class="now" data-chart-now>
        ${lines.map((line, index) => {
          const value = Number(this.hass.states[line.id]?.state);
          return html`<span>
            <small><i style="background: ${line.colour ?? LINE_COLOURS[index]}"></i>${this._nameOf(line, index)}</small>
            <strong>${this._value(value, line.unit ?? this._unitOf(line.id))}</strong>
          </span>`;
        })}
      </div>
    `;
  }

  render() {
    if (!this.hass || !this.chart) return nothing;
    const lines = this._lines;
    let body = html`<p class="empty">${this._t("chart_loading")}</p>`;
    if (this._data && this._bars) body = this._renderBars();
    else if (this._data) {
      // A phase: its power, and under it its voltage on its own scale. Lines of one unit share one plot.
      const groups = this.chart.mode === "phase" ? lines.map((_, index) => [index]) : [lines.map((_, index) => index)];
      body = groups.map(
        (indexes) => html`${this._renderLines(indexes.map((index) => lines[index]), indexes)}
          ${indexes.length === 1 ? this._renderFacts(this._data.series[indexes[0]], lines[indexes[0]].unit ?? this._unitOf(lines[indexes[0]].id)) : nothing}`,
      );
    }
    return html`${this._renderNow()} ${this._renderRanges()} ${body}`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 0 20px 8px;
      }
      button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
      }
      small {
        color: var(--hd-text-muted);
      }
      .now {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 26px;
      }
      .now span {
        display: flex;
        flex-direction: column;
      }
      .now strong {
        font-size: 28px;
        font-weight: 400;
      }
      i {
        display: inline-block;
        width: 9px;
        height: 9px;
        margin-right: 6px;
        border-radius: 3px;
      }
      .ranges {
        display: flex;
        gap: 4px;
        padding: 4px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .ranges button {
        flex: 1;
        padding: 7px 0;
        border-radius: 10px;
        font-size: 14px;
        text-align: center;
      }
      .ranges button.on {
        font-weight: 500;
        background: var(--hd-pill);
      }
      .plot {
        position: relative;
        height: 190px;
        padding-left: 52px;
      }
      .plot svg {
        display: block;
        width: 100%;
        height: 100%;
        overflow: visible;
        touch-action: pan-y;
      }
      .axis {
        position: absolute;
        left: 0;
        font-size: 11px;
        color: var(--hd-text-muted);
      }
      .axis.top {
        top: 0;
      }
      .axis.bottom {
        bottom: 0;
      }
      .line {
        fill: none;
        stroke-width: 2;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
      }
      .band {
        fill: color-mix(in srgb, #7ee2a8 14%, transparent);
      }
      .bar {
        fill: var(--hd-media-chip);
      }
      .bar.on {
        fill: #8ac6ff;
      }
      .cursor {
        stroke: var(--hd-text-muted);
        stroke-width: 1;
        stroke-dasharray: 3 3;
        vector-effect: non-scaling-stroke;
      }
      .tip {
        position: absolute;
        top: -6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px 9px;
        border-radius: 10px;
        font-size: 13px;
        white-space: nowrap;
        pointer-events: none;
        background: var(--hd-surface);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
        transform: translateX(-50%);
      }
      .ticks {
        display: flex;
        justify-content: space-between;
        margin-top: -6px;
        padding-left: 52px;
        font-size: 11px;
        color: var(--hd-text-muted);
      }
      .facts {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .facts span {
        display: flex;
        flex-direction: column;
        padding: 10px 12px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .facts strong {
        font-size: 17px;
        font-weight: 500;
      }
      .empty {
        margin: 24px 0;
        text-align: center;
        color: var(--hd-text-muted);
      }
    `,
  ];
}
