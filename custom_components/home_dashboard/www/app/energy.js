// The Energy page, drawn here instead of with the cards of Home Assistant, so it takes the look of the
// dashboard like every other page. The numbers come from the energy settings and the statistics of
// Home Assistant, the same as its own Energy dashboard.

import { LitElement, css, html, nothing, svg } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

export const ENERGY_PERIODS = ["day", "week", "month"];
const DEVICES_SHOWN = 8;
// A tablet on its side: the numbers in a row, the chart beside the phases, the devices as tiles.
export const WIDE_ENERGY = "(orientation: landscape) and (min-width: 900px) and (min-height: 501px)";
const DEVICES_SHOWN_WIDE = 11;
// 230 V ±10 %, what the grid promises; near its ends a sensitive device may switch off or run hot.
export const VOLTAGE_RANGE = [207, 253];
const VOLTAGE_EDGE = 0.1;
// The rest of what the house used, shown when it is more than this share of it.
const UNTRACKED_SHOWN = 0.01;
const PHASE = /(?:faza|phase|_l)_?([1-3])(?=_|$)/;

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

/**
 * The phases of the meter: for each, its power, voltage, current and power factor, and the frequency of the grid.
 * Chosen in `energy.phases`, or found on the device of the first grid meter, by the number of the phase in the names
 * of its sensors (faza_1, phase_2, _l3) and what they measure.
 */
export function meterPhases(hass, meterId, chosen = null) {
  if (chosen?.length) return { phases: chosen.map((phase, index) => ({ phase: index + 1, ...phase })), frequency: null };
  const deviceId = meterId && hass.entities?.[meterId]?.device_id;
  if (!deviceId) return { phases: [], frequency: null };
  const found = new Map();
  let frequency = null;
  for (const [entityId, entry] of Object.entries(hass.entities)) {
    if (entry.device_id !== deviceId || !entityId.startsWith("sensor.")) continue;
    const attributes = hass.states[entityId]?.attributes ?? {};
    const kind =
      attributes.device_class === "power" ? "power"
      : attributes.device_class === "voltage" ? "voltage"
      : attributes.device_class === "current" ? "current"
      : attributes.device_class === "power_factor" ? "factor"
      : attributes.unit_of_measurement === "Hz" ? "frequency"
      : null;
    if (!kind) continue;
    if (kind === "frequency") {
      frequency ??= entityId;
      continue;
    }
    const number = Number(PHASE.exec(entityId)?.[1]);
    if (!number) continue;
    const phase = found.get(number) ?? { phase: number };
    phase[kind] ??= entityId;
    found.set(number, phase);
  }
  const phases = [...found.values()].filter((phase) => phase.power || phase.voltage).sort((a, b) => a.phase - b.phase);
  return { phases, frequency };
}

/** Where a voltage stands: within the range, near one of its ends, or out of it. */
export function voltageState(volts, [low, high] = VOLTAGE_RANGE) {
  if (!Number.isFinite(volts)) return null;
  if (volts < low || volts > high) return "out";
  const edge = (high - low) * VOLTAGE_EDGE;
  return volts < low + edge || volts > high - edge ? "edge" : "ok";
}

/**
 * The change against the period before: the whole of it, or for the current period up to the same slot, so a
 * morning is weighed against a morning. Null without anything to weigh against.
 */
export function comparedWith(now, before, upTo = null) {
  const sum = (values) => values.slice(0, upTo === null ? values.length : upTo + 1).reduce((total, value) => total + value, 0);
  const earlier = sum(before);
  if (!(earlier > 0)) return null;
  return (sum(now) - earlier) / earlier;
}

export class HomeDashboardEnergy extends LitElement {
  static properties = {
    hass: { attribute: false },
    prefs: { attribute: false },
    info: { attribute: false },
    config: { attribute: false },
    _before: { state: true },
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
    this._before = null;
    this._allDevices = false;
  }

  _wide = window.matchMedia(WIDE_ENERGY);

  _redraw = () => this.requestUpdate();

  connectedCallback() {
    super.connectedCallback();
    this._wide.addEventListener("change", this._redraw);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._wide.removeEventListener("change", this._redraw);
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
    const ask = (from, to, statistic_ids) =>
      this.hass
        .callWS({
          type: "recorder/statistics_during_period",
          start_time: from.toISOString(),
          end_time: to.toISOString(),
          statistic_ids,
          period,
          types: ["change"],
        })
        .catch(() => ({}));
    // The period before, for the meters of the grid only: the chart shows it behind, the tile weighs against it.
    const earlier = periodRange(this._period, this._offset - 1);
    const meters = this._plan.grid.map((meter) => meter.from).filter(Boolean);
    const [stats, before] = await Promise.all([
      ask(start, end, ids),
      meters.length ? ask(earlier.start, earlier.end, meters) : Promise.resolve({}),
    ]);
    if (this._asked !== asked) return;
    this._stats = stats ?? {};
    this._before = { stats: before ?? {}, slots: earlier.slots };
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

  // The period before as faint bars behind, slot for slot: the same hour yesterday, the same day of last week.
  _renderChart(summary, slots, before) {
    const { grid, solar } = summary.bars;
    const totals = grid.map((value, index) => value + solar[index]);
    const earlier = slots.map((_, index) => before?.[index] ?? 0);
    const top = Math.max(...totals, ...earlier, 0.001);
    const width = 100 / slots.length;
    const tick = this._period === "day" ? 6 : this._period === "week" ? 1 : 7;
    const language = this.hass.language;
    const label = (time) =>
      this._period === "day"
        ? new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }).format(time)
        : this._period === "week"
          ? new Intl.DateTimeFormat(language, { weekday: "short" }).format(time)
          : String(new Date(time).getDate());
    const shown = before?.some((value) => value > 0);
    return html`
      <div class="card chart" data-energy-chart>
        <div class="chart-head">
          <small>${this._t("energy_peak", { value: this._kwh(Math.max(...totals, 0)) })}</small>
          <span class="legend">
            ${shown ? html`<i class="grid"></i>${this._t(`energy_this_${this._period}`)}<i class="before"></i>${this._t(`energy_before_${this._period}`)}` : nothing}
            ${summary.solar > 0 ? html`<i class="solar"></i>${this._t("energy_from_sun")}` : nothing}
          </span>
        </div>
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
          ${totals.map((total, index) => {
            const gridHeight = (grid[index] / top) * 56;
            const solarHeight = (solar[index] / top) * 56;
            const beforeHeight = (earlier[index] / top) * 56;
            const x = index * width + width * 0.15;
            const barWidth = width * 0.7;
            return svg`
              ${beforeHeight ? svg`<rect class="bar before" data-energy-before x=${x} y=${60 - beforeHeight} width=${barWidth} height=${beforeHeight} rx="0.6"></rect>` : nothing}
              <rect class="bar grid" x=${x + barWidth * 0.15} y=${60 - gridHeight} width=${barWidth * 0.7} height=${gridHeight} rx="0.6"></rect>
              ${solarHeight ? svg`<rect class="bar solar" x=${x + barWidth * 0.15} y=${60 - gridHeight - solarHeight} width=${barWidth * 0.7} height=${solarHeight} rx="0.6"></rect>` : nothing}
            `;
          })}
        </svg>
        <div class="ticks">
          ${slots.map((slot, index) => html`<span style="width: ${width}%">${index % tick === 0 ? label(slot) : ""}</span>`)}
        </div>
      </div>
    `;
  }

  // A tap opens a chart of the dashboard's own: the page around it opens it in a window.
  _chart(chart) {
    if (!chart) return;
    this.dispatchEvent(new CustomEvent("energy-chart", { bubbles: true, composed: true, detail: chart }));
  }

  get _meterId() {
    return this._plan.grid.find((meter) => meter.from)?.from ?? null;
  }

  _number(entityId) {
    const value = Number(this.hass.states[entityId]?.state);
    return Number.isFinite(value) ? value : null;
  }

  _format(value, digits) {
    return new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  }

  get _meter() {
    return meterPhases(this.hass, this._plan.grid.find((meter) => meter.from)?.from, this.config?.energy?.phases);
  }

  // Each phase: its power, current and power factor, and beside them its voltage on the scale of what the grid
  // promises. The bar shows which phase carries the most.
  _renderPhases(phases) {
    if (!phases.length) return nothing;
    const range = this.config?.energy?.voltage_range ?? VOLTAGE_RANGE;
    const currents = phases.map((phase) => this._number(phase.current) ?? 0);
    const most = Math.max(...currents, 0.001);
    return html`
      <div class="phases" data-energy-phases>
        ${phases.map((phase, index) => {
          const power = this._number(phase.power);
          const volts = this._number(phase.voltage);
          const factor = this._number(phase.factor);
          const ratio = factor === null ? null : this.hass.states[phase.factor]?.attributes.unit_of_measurement === "%" ? factor / 100 : factor;
          const state = voltageState(volts, range);
          const at = volts === null ? 0 : Math.min(100, Math.max(0, ((volts - range[0]) / (range[1] - range[0])) * 100));
          return html`
            <button class="card phase" data-energy-phase=${phase.phase}
              @click=${() => this._chart({ title: this._t("energy_phase", { number: phase.phase }), mode: "phase", power: phase.power, voltage: phase.voltage, band: range })}>
              <span class="phase-power">
                <small>${this._t("energy_phase", { number: phase.phase })}</small>
                <strong>${power === null ? "–" : `${this._format(power, 0)} W`}</strong>
                <span class="phase-facts">
                  ${phase.current ? html`<span>${this._format(currents[index], 2)} A</span>` : nothing}
                  ${ratio === null ? nothing : html`<span>cos φ ${this._format(ratio, 2)}</span>`}
                </span>
                <span class="load"><i style="width: ${(currents[index] / most) * 100}%"></i></span>
              </span>
              ${volts === null
                ? nothing
                : html`<span class="phase-volts ${state}" data-energy-voltage=${state}>
                    <small>${this._t("energy_voltage")}</small>
                    <strong>${this._format(volts, 0)} V</strong>
                    <span class="scale"><i style="left: ${at}%"></i></span>
                    <span class="ends"><span>${range[0]}</span><span>${Math.round((range[0] + range[1]) / 2)}</span><span>${range[1]}</span></span>
                  </span>`}
            </button>
          `;
        })}
      </div>
    `;
  }

  _deviceName(device) {
    return device.name ?? this.hass.states[device.id]?.attributes.friendly_name ?? device.id;
  }

  // What the meter counted and no device did: the lights, the stove, everything without a meter of its own.
  _untracked(summary) {
    const tracked = summary.devices.reduce((sum, device) => sum + device.used, 0);
    const rest = summary.grid > 0 ? summary.used - tracked : 0;
    return { tracked, rest: rest > summary.used * UNTRACKED_SHOWN ? rest : 0 };
  }

  // A device: its energy as bars. The rest has no meter of its own: the whole home's stands for it.
  _deviceChart(device) {
    if (device.untracked) return this._meterId ? { title: this._t("energy_whole_home"), mode: "bars", energy: this._meterId } : null;
    return { title: this._deviceName(device), mode: "bars", energy: device.id };
  }

  _renderDevices(summary, wide) {
    if (!summary.devices.length) return nothing;
    const { rest } = this._untracked(summary);
    const all = [...summary.devices, ...(rest ? [{ id: null, untracked: true, used: rest }] : [])].sort((a, b) => b.used - a.used);
    const limit = wide ? DEVICES_SHOWN_WIDE : DEVICES_SHOWN;
    const shown = this._allDevices ? all : all.slice(0, limit);
    const top = all[0].used;
    const share = (device) => (summary.used > 0 ? `${this._format((device.used / summary.used) * 100, 0)}%` : "");
    const name = (device) => (device.untracked ? this._t("energy_untracked") : this._deviceName(device));
    const more =
      all.length > limit
        ? html`<button class="more" data-energy-more @click=${() => (this._allDevices = !this._allDevices)}>
            ${this._t(this._allDevices ? "energy_fewer" : "energy_all", { count: all.length })}
          </button>`
        : nothing;
    if (wide) {
      return html`
        <h2>${this._t("energy_devices")}</h2>
        <div class="device-tiles">
          ${shown.map(
            (device) => html`
              <button class="card device-tile ${device.untracked ? "untracked" : ""}" data-energy-device=${device.id ?? "untracked"}
                @click=${() => this._chart(this._deviceChart(device))}>
                <small>${name(device)}</small>
                <span><strong>${this._kwh(device.used)}</strong> <em>${share(device)}</em></span>
                <span class="device-bar"><i style="width: ${(device.used / top) * 100}%"></i></span>
              </button>
            `,
          )}
        </div>
        ${more}
      `;
    }
    return html`
      <h2>${this._t("energy_devices")}</h2>
      <div class="card devices">
        ${shown.map(
          (device) => html`
            <button class="device ${device.untracked ? "untracked" : ""}" data-energy-device=${device.id ?? "untracked"}
              @click=${() => this._chart(this._deviceChart(device))}>
              <span class="device-name">${name(device)}</span>
              <span class="device-value">${this._kwh(device.used)}</span>
              <span class="device-bar"><i style="width: ${(device.used / top) * 100}%"></i></span>
            </button>
          `,
        )}
        ${more}
      </div>
    `;
  }

  _trend(summary, before, slots) {
    if (!before) return "";
    const current = this._offset === 0;
    const now = Date.now();
    const upTo = current ? slots.findLastIndex((slot) => slot <= now) : null;
    const change = comparedWith(summary.bars.grid, before, upTo);
    if (change === null) return "";
    const than = this._t(`energy_than_${this._period}${current ? "_sofar" : ""}`);
    return this._t(change >= 0 ? "energy_more_than" : "energy_less_than", { share: this._format(Math.abs(change) * 100, 0), than });
  }

  render() {
    if (!this.hass || !this.prefs) return nothing;
    const { slots } = this._range;
    const wide = this._wide.matches;
    const summary = energySummary(this._plan, this._stats ?? {}, slots);
    const before = this._before ? bySlot(this._before.stats, this._plan.grid.map((meter) => meter.from).filter(Boolean), this._before.slots) : null;
    const { phases, frequency } = this._meter;
    const powers = phases.map((phase) => this._number(phase.power)).filter((value) => value !== null);
    const hertz = frequency ? this._number(frequency) : null;
    const { tracked } = this._untracked(summary);
    const measured = summary.devices.length && summary.grid > 0 && summary.used > 0 ? Math.min(1, tracked / summary.used) : null;
    const tiles = [
      powers.length
        ? ["mdi:flash", "energy_now", `${this._format(powers.reduce((sum, value) => sum + value, 0), 0)} W`,
           [powers.length === 1 ? this._t("energy_phase_one") : this._t("energy_phases", { count: powers.length }), hertz === null ? null : `${this._format(hertz, 2)} Hz`].filter(Boolean).join(" · ")]
        : null,
      ["mdi:home-lightning-bolt-outline", "energy_used", this._kwh(summary.used), this._trend(summary, before, slots)],
      summary.hasCost
        ? ["mdi:cash", "energy_cost", this._money(summary.cost), summary.used > 0 ? this._t("energy_per_unit", { price: this._money(summary.cost / summary.used) }) : ""]
        : null,
      measured === null
        ? null
        : ["mdi:chart-donut", "energy_measured", `${this._format(measured * 100, 0)}% / ${this._format((1 - measured) * 100, 0)}%`, null, measured],
      summary.solar > 0 ? ["mdi:solar-power-variant-outline", "energy_from_sun", this._kwh(summary.solar)] : null,
      summary.exported > 0 ? ["mdi:transmission-tower-export", "energy_to_grid", this._kwh(summary.exported)] : null,
      summary.gas !== null ? ["mdi:fire", "energy_gas", new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: 2 }).format(summary.gas)] : null,
      summary.water !== null ? ["mdi:water", "energy_water", new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: 0 }).format(summary.water)] : null,
    ].filter(Boolean);
    // The power now as a line per phase; what the home used as bars from the meter.
    const charts = {
      energy_now: phases.length
        ? { title: this._t("energy_now"), mode: "lines", lines: phases.map((phase) => ({ id: phase.power, name: this._t("energy_phase", { number: phase.phase }), unit: "W" })) }
        : null,
      energy_used: this._meterId ? { title: this._t("energy_whole_home"), mode: "bars", energy: this._meterId } : null,
    };
    const periods = html`
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
    `;
    const range = html`
      <div class="card range">
        <button aria-label=${this._t("energy_earlier")} data-energy-earlier @click=${() => (this._offset -= 1)}>
          <ha-icon icon="mdi:chevron-left"></ha-icon>
        </button>
        <strong data-energy-label>${this._label()}</strong>
        <button aria-label=${this._t("energy_later")} data-energy-later ?disabled=${this._offset >= 0} @click=${() => (this._offset += 1)}>
          <ha-icon icon="mdi:chevron-right"></ha-icon>
        </button>
      </div>
    `;
    return html`
      <div class="layout ${wide ? "wide" : ""}" data-energy-layout=${wide ? "wide" : "narrow"}>
        <div class="head">${periods} ${range}</div>
        <div class="tiles">
          ${tiles.map(
            ([icon, key, value, extra, split]) => html`
              <button class="card tile" data-energy-tile=${key} @click=${() => this._chart(charts[key])}>
                <span class="icon"><ha-icon .icon=${icon}></ha-icon></span>
                <span class="text">
                  <small>${this._t(key)}</small><strong>${value}</strong>
                  ${extra ? html`<small class="extra">${extra}</small>` : nothing}
                  ${split === undefined ? nothing : html`<span class="split"><i style="width: ${split * 100}%"></i></span>`}
                </span>
              </button>
            `,
          )}
        </div>
        <div class="middle">${this._renderChart(summary, slots, before)} ${this._renderPhases(phases)}</div>
        ${this._renderDevices(summary, wide)}
      </div>
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
        text-align: left;
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
      .layout,
      .head,
      .middle,
      .phases {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .phases {
        gap: 10px;
      }
      .extra {
        display: block;
        font-size: 12px;
      }
      .split,
      .load {
        display: block;
        height: 6px;
        margin-top: 6px;
        overflow: hidden;
        border-radius: 3px;
        background: var(--hd-look-tile-icon-bg, var(--hd-off-icon));
      }
      .split i,
      .load i {
        display: block;
        height: 100%;
        border-radius: 3px;
        background: var(--hd-media-chip);
      }
      .bar.before,
      .legend .before {
        fill: color-mix(in srgb, currentColor 18%, transparent);
        background: color-mix(in srgb, currentColor 30%, transparent);
      }
      .phase {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: start;
        gap: 14px;
        padding: 12px 14px;
        text-align: left;
      }
      .phase-power,
      .phase-volts {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .phase strong {
        font-size: 20px;
        font-weight: 500;
      }
      .phase-facts {
        display: flex;
        gap: 14px;
        margin-top: 2px;
        font-size: 12px;
        color: var(--hd-look-tile-muted, var(--hd-text-muted));
      }
      .phase-volts {
        width: 104px;
        padding-left: 12px;
        border-left: 1px solid color-mix(in srgb, currentColor 14%, transparent);
        text-align: right;
      }
      .phase-volts.ok strong {
        color: #7ee2a8;
      }
      .phase-volts.edge strong {
        color: #ffb86b;
      }
      .phase-volts.out strong {
        color: #ff6961;
      }
      /* The range the grid promises, its last tenths marked at both ends; the dot is the voltage now. */
      .scale {
        position: relative;
        display: block;
        height: 4px;
        margin-top: 10px;
        border-radius: 2px;
        background: linear-gradient(
          90deg,
          #ffb86b 0 10%,
          color-mix(in srgb, currentColor 25%, transparent) 10% 90%,
          #ffb86b 90%
        );
      }
      .scale i {
        position: absolute;
        top: -3px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: currentColor;
        transform: translateX(-50%);
      }
      .ok .scale i {
        background: #7ee2a8;
      }
      .edge .scale i {
        background: #ffb86b;
      }
      .out .scale i {
        background: #ff6961;
      }
      .ends {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        font-size: 10px;
        color: var(--hd-look-tile-muted, var(--hd-text-muted));
      }
      .device {
        width: 100%;
        text-align: left;
      }
      .device-tiles {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }
      .device-tile {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        padding: 12px 14px;
        text-align: left;
      }
      .device-tile small {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .device-tile strong {
        font-size: 18px;
        font-weight: 500;
      }
      .device-tile em {
        font-style: normal;
        font-size: 12px;
        color: var(--hd-look-tile-muted, var(--hd-text-muted));
      }
      .device-tile .device-bar {
        display: block;
        margin-top: 8px;
      }
      .untracked {
        border: 1px dashed color-mix(in srgb, currentColor 30%, transparent);
      }
      .device-tile.untracked {
        background: color-mix(in srgb, currentColor 6%, transparent);
      }
      /* A tablet on its side: the periods beside the dates, four numbers in a row, the chart beside the phases. */
      .wide .head {
        flex-direction: row;
        align-items: center;
      }
      .wide .periods {
        flex: none;
        width: 340px;
      }
      .wide .range {
        flex: 1;
      }
      .wide .tiles {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .wide .middle {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        align-items: stretch;
      }
      /* No height of its own (a chart's would follow its width): it takes the height of the phases beside it. */
      .wide .chart {
        display: flex;
        flex-direction: column;
        min-height: 240px;
        contain: size;
      }
      /* As tall as the phases beside it, not as its own width would make it. */
      .wide .chart svg {
        flex: 1;
        min-height: 160px;
        height: 0;
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
