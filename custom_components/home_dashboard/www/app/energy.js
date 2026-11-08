// The Energy page, drawn here instead of with the cards of Home Assistant, so it takes the look of the
// dashboard like every other page. The numbers come from the energy settings and the statistics of
// Home Assistant, the same as its own Energy dashboard.

import { LitElement, css, html, nothing, svg } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

export const ENERGY_PERIODS = ["day", "week", "month"];
const DEVICES_SHOWN = 8;

const list = (value) => (Array.isArray(value) ? value : []);

// The settings came in two shapes: older ones list the meters of a grid under flow_from and flow_to,
// newer ones give each meter a source of its own.
export function energyPlan(prefs, info = {}) {
  const plan = { grid: [], solar: [], battery: [], gas: [], water: [], devices: [] };
  const cost = (from, own) => own ?? info.cost_sensors?.[from] ?? null;
  for (const source of list(prefs?.energy_sources)) {
    if (source.type === "grid") {
      const from = source.flow_from ?? (source.stat_energy_from ? [source] : []);
      const to = source.flow_to ?? (source.stat_energy_to ? [source] : []);
      from.forEach((meter) => plan.grid.push({ from: meter.stat_energy_from, cost: cost(meter.stat_energy_from, meter.stat_cost) }));
      to.forEach((meter) => plan.grid.push({ to: meter.stat_energy_to }));
    } else if (source.type === "solar" && source.stat_energy_from) {
      plan.solar.push(source.stat_energy_from);
    } else if (source.type === "battery") {
      plan.battery.push({ from: source.stat_energy_from, to: source.stat_energy_to });
    } else if ((source.type === "gas" || source.type === "water") && source.stat_energy_from) {
      plan[source.type].push({ id: source.stat_energy_from, cost: cost(source.stat_energy_from, source.stat_cost) });
    }
  }
  plan.devices = list(prefs?.device_consumption)
    .filter((device) => device.stat_consumption)
    .map((device) => ({ id: device.stat_consumption, name: device.name ?? null }));
  return plan;
}

export function planIds(plan) {
  const ids = [
    ...plan.grid.flatMap((meter) => [meter.from, meter.to, meter.cost]),
    ...plan.solar,
    ...plan.battery.flatMap((meter) => [meter.from, meter.to]),
    ...[...plan.gas, ...plan.water].flatMap((meter) => [meter.id, meter.cost]),
    ...plan.devices.map((device) => device.id),
  ];
  return [...new Set(ids.filter(Boolean))];
}

// The hours of a day, the days of a week (from Monday) or of a month, `offset` periods back.
export function periodRange(kind, offset = 0, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let end;
  if (kind === "day") {
    start.setDate(start.getDate() + offset);
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else if (kind === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else {
    start.setDate(1);
    start.setMonth(start.getMonth() + offset);
    end = new Date(start);
    end.setMonth(end.getMonth() + 1);
  }
  const slots = [];
  for (const slot = new Date(start); slot < end; kind === "day" ? slot.setHours(slot.getHours() + 1) : slot.setDate(slot.getDate() + 1)) {
    slots.push(slot.getTime());
  }
  return { start, end, period: kind === "day" ? "hour" : "day", slots };
}

const change = (rows) => list(rows).reduce((sum, row) => sum + (row.change ?? 0), 0);

// Per slot of the range, the change of the listed statistics added up.
export function bySlot(stats, ids, slots) {
  const values = slots.map(() => 0);
  for (const id of ids) {
    for (const row of list(stats?.[id])) {
      const index = slots.findIndex((slot, position) => row.start >= slot && (position === slots.length - 1 || row.start < slots[position + 1]));
      if (index >= 0) values[index] += row.change ?? 0;
    }
  }
  return values;
}

// Everything the page shows for one range.
export function energySummary(plan, stats, slots) {
  const total = (ids) => ids.filter(Boolean).reduce((sum, id) => sum + change(stats?.[id]), 0);
  const fromGrid = plan.grid.map((meter) => meter.from).filter(Boolean);
  const toGrid = plan.grid.map((meter) => meter.to).filter(Boolean);
  const batteryOut = plan.battery.map((meter) => meter.from);
  const batteryIn = plan.battery.map((meter) => meter.to);
  const solarSlots = bySlot(stats, plan.solar, slots);
  const exportSlots = bySlot(stats, toGrid, slots);
  const summary = {
    grid: total(fromGrid),
    exported: total(toGrid),
    solar: total(plan.solar),
    battery: total(batteryOut) - total(batteryIn),
    cost: total([...plan.grid.map((meter) => meter.cost), ...plan.gas.map((meter) => meter.cost), ...plan.water.map((meter) => meter.cost)]),
    hasCost: [...plan.grid, ...plan.gas, ...plan.water].some((meter) => meter.cost),
    gas: plan.gas.length ? total(plan.gas.map((meter) => meter.id)) : null,
    water: plan.water.length ? total(plan.water.map((meter) => meter.id)) : null,
    bars: {
      grid: bySlot(stats, fromGrid, slots),
      // What the sun gave the house itself, as the rest went to the grid.
      solar: solarSlots.map((value, index) => Math.max(0, value - exportSlots[index])),
    },
  };
  summary.used = summary.grid + Math.max(0, summary.solar - summary.exported) + summary.battery;
  summary.devices = plan.devices
    .map((device) => ({ ...device, used: change(stats?.[device.id]) }))
    .filter((device) => device.used > 0)
    .sort((first, second) => second.used - first.used);
  return summary;
}

export class HomeDashboardEnergy extends LitElement {
  static properties = {
    hass: { attribute: false },
    prefs: { attribute: false },
    info: { attribute: false },
    _period: { state: true },
    _offset: { state: true },
    _stats: { state: true },
    _allDevices: { state: true },
  };

  constructor() {
    super();
    this._period = "day";
    this._offset = 0;
    this._stats = null;
    this._allDevices = false;
  }

  get _plan() {
    return energyPlan(this.prefs, this.info);
  }

  get _range() {
    return periodRange(this._period, this._offset);
  }

  willUpdate(changed) {
    if (changed.has("prefs") || changed.has("_period") || changed.has("_offset")) this._load();
  }

  async _load() {
    const ids = planIds(this._plan);
    if (!this.hass || !ids.length) return;
    const { start, end, period } = this._range;
    const asked = `${this._period}|${this._offset}`;
    this._asked = asked;
    try {
      const stats = await this.hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        statistic_ids: ids,
        period,
        types: ["change"],
      });
      if (this._asked === asked) this._stats = stats;
    } catch {
      if (this._asked === asked) this._stats = {};
    }
  }

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  _kwh(value) {
    const digits = value < 10 ? 2 : value < 100 ? 1 : 0;
    return `${new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: digits }).format(value)} kWh`;
  }

  _money(value) {
    const currency = this.hass.config?.currency;
    const format = currency
      ? new Intl.NumberFormat(this.hass.language, { style: "currency", currency })
      : new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: 2 });
    return format.format(value);
  }

  _label() {
    const { start, end } = this._range;
    const language = this.hass.language;
    if (this._period === "day") return new Intl.DateTimeFormat(language, { weekday: "long", day: "numeric", month: "long" }).format(start);
    if (this._period === "month") return new Intl.DateTimeFormat(language, { month: "long", year: "numeric" }).format(start);
    const last = new Date(end.getTime() - 1);
    const format = new Intl.DateTimeFormat(language, { day: "numeric", month: "short" });
    return `${format.format(start)} – ${format.format(last)}`;
  }

  _renderChart(summary, slots) {
    const { grid, solar } = summary.bars;
    const totals = grid.map((value, index) => value + solar[index]);
    const top = Math.max(...totals, 0.001);
    const width = 100 / slots.length;
    const tick = this._period === "day" ? 6 : this._period === "week" ? 1 : 7;
    const language = this.hass.language;
    const label = (time) =>
      this._period === "day"
        ? new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }).format(time)
        : this._period === "week"
          ? new Intl.DateTimeFormat(language, { weekday: "short" }).format(time)
          : String(new Date(time).getDate());
    return html`
      <div class="card chart" data-energy-chart>
        <div class="chart-head">
          <small>${this._t("energy_peak", { value: this._kwh(top === 0.001 ? 0 : top) })}</small>
          ${summary.solar > 0
            ? html`<span class="legend"><i class="grid"></i>${this._t("energy_from_grid")}<i class="solar"></i>${this._t("energy_from_sun")}</span>`
            : nothing}
        </div>
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
          ${totals.map((total, index) => {
            const gridHeight = (grid[index] / top) * 56;
            const solarHeight = (solar[index] / top) * 56;
            const x = index * width + width * 0.15;
            const barWidth = width * 0.7;
            return svg`
              <rect class="bar grid" x=${x} y=${60 - gridHeight} width=${barWidth} height=${gridHeight} rx="0.6"></rect>
              ${solarHeight ? svg`<rect class="bar solar" x=${x} y=${60 - gridHeight - solarHeight} width=${barWidth} height=${solarHeight} rx="0.6"></rect>` : nothing}
            `;
          })}
        </svg>
        <div class="ticks">
          ${slots.map((slot, index) => html`<span style="width: ${width}%">${index % tick === 0 ? label(slot) : ""}</span>`)}
        </div>
      </div>
    `;
  }

  _renderDevices(summary) {
    if (!summary.devices.length) return nothing;
    const shown = this._allDevices ? summary.devices : summary.devices.slice(0, DEVICES_SHOWN);
    const top = summary.devices[0].used;
    const name = (device) => device.name ?? this.hass.states[device.id]?.attributes.friendly_name ?? device.id;
    return html`
      <h2>${this._t("energy_devices")}</h2>
      <div class="card devices">
        ${shown.map(
          (device) => html`
            <div class="device" data-energy-device=${device.id}>
              <span class="device-name">${name(device)}</span>
              <span class="device-value">${this._kwh(device.used)}</span>
              <span class="device-bar"><i style="width: ${(device.used / top) * 100}%"></i></span>
            </div>
          `,
        )}
        ${summary.devices.length > DEVICES_SHOWN
          ? html`<button class="more" data-energy-more @click=${() => (this._allDevices = !this._allDevices)}>
              ${this._t(this._allDevices ? "energy_fewer" : "energy_all", { count: summary.devices.length })}
            </button>`
          : nothing}
      </div>
    `;
  }

  render() {
    if (!this.hass || !this.prefs) return nothing;
    const { slots } = this._range;
    const summary = energySummary(this._plan, this._stats ?? {}, slots);
    const tiles = [
      ["mdi:home-lightning-bolt-outline", "energy_used", this._kwh(summary.used)],
      summary.hasCost ? ["mdi:cash", "energy_cost", this._money(summary.cost)] : null,
      summary.solar > 0 ? ["mdi:solar-power-variant-outline", "energy_from_sun", this._kwh(summary.solar)] : null,
      summary.exported > 0 ? ["mdi:transmission-tower-export", "energy_to_grid", this._kwh(summary.exported)] : null,
      summary.gas !== null ? ["mdi:fire", "energy_gas", new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: 2 }).format(summary.gas)] : null,
      summary.water !== null ? ["mdi:water", "energy_water", new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: 0 }).format(summary.water)] : null,
    ].filter(Boolean);
    return html`
      <div class="periods" data-energy-periods>
        ${ENERGY_PERIODS.map(
          (period) => html`
            <button class=${period === this._period ? "on" : ""} data-energy-period=${period} @click=${() => {
              this._period = period;
              this._offset = 0;
            }}>${this._t(`energy_${period}`)}</button>
          `,
        )}
      </div>
      <div class="card range">
        <button aria-label=${this._t("energy_earlier")} data-energy-earlier @click=${() => (this._offset -= 1)}>
          <ha-icon icon="mdi:chevron-left"></ha-icon>
        </button>
        <strong data-energy-label>${this._label()}</strong>
        <button aria-label=${this._t("energy_later")} data-energy-later ?disabled=${this._offset >= 0} @click=${() => (this._offset += 1)}>
          <ha-icon icon="mdi:chevron-right"></ha-icon>
        </button>
      </div>
      <div class="tiles">
        ${tiles.map(
          ([icon, key, value]) => html`
            <div class="card tile" data-energy-tile=${key}>
              <span class="icon"><ha-icon .icon=${icon}></ha-icon></span>
              <span class="text"><small>${this._t(key)}</small><strong>${value}</strong></span>
            </div>
          `,
        )}
      </div>
      ${this._renderChart(summary, slots)} ${this._renderDevices(summary)}
    `;
  }

  // The cards take the look of the tiles of the page: their colours, opacity and corners.
  static styles = [
    tokens,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: var(--hd-look-tile-text, var(--hd-text));
      }
      button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
      }
      .card {
        border-radius: var(--hd-tile-radius, var(--hd-radius));
        background: color-mix(in srgb, var(--hd-look-tile-bg, var(--hd-surface)) var(--hd-tile-opacity, 100%), transparent);
      }
      small {
        color: var(--hd-look-tile-muted, var(--hd-text-muted));
      }
      h2 {
        margin: 12px 0 0;
        font-size: 17px;
        font-weight: 500;
        color: var(--hd-look-headings, var(--hd-text));
      }
      .periods {
        display: flex;
        gap: 6px;
        padding: 4px;
        border-radius: 16px;
        background: color-mix(in srgb, var(--hd-look-tile-bg, var(--hd-off)) var(--hd-tile-opacity, 100%), transparent);
      }
      .periods button {
        flex: 1;
        padding: 8px 0;
        border-radius: 12px;
        font-size: 14px;
        text-align: center;
      }
      .periods button.on {
        font-weight: 500;
        background: var(--hd-look-tile-icon-bg, var(--hd-surface));
      }
      .range {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px;
      }
      .range strong {
        flex: 1;
        font-weight: 500;
        text-align: center;
      }
      /* Only the first letter: the name of a month stays as the language writes it. */
      .range strong::first-letter {
        text-transform: uppercase;
      }
      .range button {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
      }
      .range button[disabled] {
        opacity: 0.3;
        pointer-events: none;
      }
      .tiles {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .tile {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
      }
      .icon {
        display: grid;
        flex: none;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        color: var(--hd-look-tile-icon, var(--hd-media-ink));
        background: var(--hd-look-tile-icon-bg, var(--hd-media-icon));
      }
      .text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .text strong {
        font-size: 17px;
        font-weight: 500;
        white-space: nowrap;
      }
      .chart {
        padding: 14px 14px 10px;
      }
      .chart-head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      .legend {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
      }
      .legend i {
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }
      .chart svg {
        display: block;
        width: 100%;
        height: 180px;
      }
      .bar.grid,
      .legend .grid {
        fill: var(--hd-media-chip);
        background: var(--hd-media-chip);
      }
      .bar.solar,
      .legend .solar {
        fill: var(--hd-light-chip);
        background: var(--hd-light-chip);
      }
      .ticks {
        display: flex;
        margin-top: 6px;
        font-size: 11px;
        color: var(--hd-look-tile-muted, var(--hd-text-muted));
        white-space: nowrap;
      }
      .ticks span {
        overflow: visible;
      }
      .devices {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
      }
      .device {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px 12px;
        font-size: 15px;
      }
      .device-name {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .device-value {
        font-weight: 500;
      }
      .device-bar {
        grid-column: 1 / -1;
        height: 6px;
        border-radius: 3px;
        background: var(--hd-look-tile-icon-bg, var(--hd-off-icon));
      }
      .device-bar i {
        display: block;
        height: 100%;
        border-radius: 3px;
        background: var(--hd-media-chip);
      }
      .more {
        padding: 8px 0 2px;
        font-size: 14px;
        text-align: center;
        color: var(--hd-look-tile-muted, var(--hd-link));
      }
    `,
  ];
}
