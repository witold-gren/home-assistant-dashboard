// A bathroom scale with the body of each person on it: the weight on the scale now, and for each person of
// BodyMiScale (`bodymiscale.*`) the last weighing: weight against the ideal, BMI on its bands, what the body is made of,
// and the weight over the last month, three months or year from the statistics of their weight sensor. A tablet shows
// it in two columns, a phone in one.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const DAY_MS = 86_400_000;
export const SCALE_RANGES = [30, 90, 365];
// The bands of BMI as the World Health Organization draws them, shown from 15 to 35.
export const BMI_BANDS = [
  [15, 18.5, "under"],
  [18.5, 25, "normal"],
  [25, 30, "over"],
  [30, 35, "obese"],
];
const BMI_SHOWN = [15, 35];
// What the body is made of, in the order shown: the attribute, its unit and its digits.
export const SCALE_METRICS = [
  ["body_fat", "%", 1],
  ["muscle_mass", "kg", 1],
  ["water", "%", 1],
  ["bone_mass", "kg", 1],
  ["visceral_fat", "", 0],
  ["protein", "%", 1],
  ["lean_body_mass", "kg", 1],
  ["basal_metabolism", "kcal", 0],
  ["metabolic_age", "age", 0],
  ["body_score", "", 0],
];

const objectId = (entityId) => entityId.split(".")[1];

/** The weight sensor of a person: set by hand, or the `sensor.<person>_weight…` of BodyMiScale. */
export function weightSensor(hass, personId, given) {
  if (given) return given;
  const prefix = `sensor.${objectId(personId)}_weight`;
  return Object.keys(hass.states).filter((id) => id.startsWith(prefix)).sort()[0] ?? null;
}

/** The people on the scale: those listed in `people`, or every `bodymiscale.*` entity. */
export function scalePeople(hass, item) {
  const listed = (item.people ?? []).map((person) => (typeof person === "string" ? { entity: person } : person));
  const entries = listed.length
    ? listed
    : Object.keys(hass.states)
        .filter((id) => id.startsWith("bodymiscale."))
        .map((entity) => ({ entity }));
  return entries.flatMap((person) => {
    const stateObj = hass.states[person.entity];
    if (!stateObj) return [];
    const attributes = stateObj.attributes ?? {};
    return [
      {
        entity: person.entity,
        name: person.name ?? attributes.friendly_name ?? objectId(person.entity),
        attributes,
        measured: Date.parse(attributes.last_measurement_time) || null,
        weightSensor: weightSensor(hass, person.entity, person.weight),
      },
    ];
  });
}

/** The person who stood on the scale last. */
export function latestPerson(people) {
  return [...people].sort((first, second) => (second.measured ?? 0) - (first.measured ?? 0))[0] ?? null;
}

/** Where a BMI stands: its band and its place on the bar from 0 to 1. */
export function bmiPlace(bmi) {
  if (!Number.isFinite(bmi)) return null;
  const [low, high] = BMI_SHOWN;
  const band = BMI_BANDS.find(([from, to]) => bmi < to)?.[2] ?? "obese";
  return { band, at: Math.min(1, Math.max(0, (bmi - low) / (high - low))) };
}

const number = (language, value, digits) =>
  Number(value).toLocaleString(language, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** A value of a person for showing, with its unit, or a dash. */
export function metricText(language, value, unit, digits) {
  if (value === undefined || value === null || value === "" || !Number.isFinite(Number(value))) return "–";
  const shown = number(language, value, digits);
  if (unit === "age") return translate(language, "scale_years", { value: shown });
  return unit ? `${shown} ${unit}` : shown;
}

const label = (language, prefix, value) => {
  const text = translate(language, `${prefix}_${value}`);
  return text === `${prefix}_${value}` ? value : text;
};

/**
 * The tile of the scale in a room: who weighed last and when, and their weight, BMI, fat and muscle; a tap opens the
 * window.
 */
export function scaleTile(hass, item) {
  const language = hass.language;
  const person = latestPerson(scalePeople(hass, item));
  const when = person?.measured
    ? new Intl.DateTimeFormat(language, { day: "numeric", month: "long" }).format(person.measured)
    : null;
  const { weight, bmi, body_fat: fat, muscle_mass: muscle } = person?.attributes ?? {};
  return {
    kind: "panel",
    entityId: item.entity ?? "",
    domain: "panel",
    item,
    name: item.name,
    stateText: person ? [person.name, when].filter(Boolean).join(" · ") : translate(language, "scale_none"),
    tone: "off",
    icon: item.icon ?? "mdi:scale-bathroom",
    available: true,
    iconAction: null,
    tapAction: "block",
    stats: person
      ? [
          { name: translate(language, "scale_weight"), value: metricText(language, weight, "kg", 1) },
          { name: "BMI", value: metricText(language, bmi, "", 1) },
          { name: translate(language, "scale_m_body_fat"), value: metricText(language, fat, "%", 1) },
          { name: translate(language, "scale_m_muscle_mass"), value: metricText(language, muscle, "kg", 1) },
        ]
      : [],
  };
}

/** Daily means of a weight sensor for a line: `[{at, value}]`, oldest first. */
export function weightPoints(rows) {
  return (rows ?? [])
    .map((row) => ({ at: typeof row.start === "number" ? row.start : Date.parse(row.start), value: Number(row.mean ?? row.state) }))
    .filter((point) => Number.isFinite(point.at) && Number.isFinite(point.value))
    .sort((first, second) => first.at - second.at);
}

/** Whether the weight changed in these points: the same value every day means nobody stood on the scale. */
export const weightChanged = (points) => new Set((points ?? []).map((point) => point.value.toFixed(1))).size > 1;

export class HomeDashboardScale extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    _person: { state: true },
    _days: { state: true },
    _points: { state: true },
  };

  constructor() {
    super();
    this._days = SCALE_RANGES[0];
    this._points = null;
  }

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  get _people() {
    return scalePeople(this.hass, this.item);
  }

  get _chosen() {
    const people = this._people;
    return people.find((person) => person.entity === this._person) ?? latestPerson(people);
  }

  willUpdate() {
    if (!this.hass || !this.item) return;
    const sensor = this._chosen?.weightSensor;
    const asked = `${sensor}|${this._days}`;
    if (this._asked !== asked) this._load(sensor, asked);
  }

  async _load(sensor, asked) {
    this._asked = asked;
    this._points = null;
    if (!sensor || !this.hass.callWS) {
      this._points = [];
      return;
    }
    const end = Date.now();
    const result = await this.hass
      .callWS({
        type: "recorder/statistics_during_period",
        start_time: new Date(end - this._days * DAY_MS).toISOString(),
        end_time: new Date(end).toISOString(),
        statistic_ids: [sensor],
        period: "day",
        types: ["mean"],
      })
      .catch(() => ({}));
    if (this._asked === asked) this._points = weightPoints(result?.[sensor]);
  }

  render() {
    if (!this.hass || !this.item) return nothing;
    const people = this._people;
    const person = this._chosen;
    const onScale = this.item.entity && this.hass.states[this.item.entity];
    return html`
      <div class="content">
        <div class="people" data-scale-people>
          ${people.map(
            (entry) => html`<button class=${entry.entity === person?.entity ? "selected" : ""} data-scale-person=${entry.entity}
              @click=${() => (this._person = entry.entity)}>
              <strong>${entry.name}</strong>
              <small>${metricText(this.hass.language, entry.attributes.weight, "kg", 1)}</small>
            </button>`,
          )}
        </div>
        ${onScale && !["unavailable", "unknown"].includes(onScale.state)
          ? html`<p class="hint" data-scale-now>${this._t("scale_on_scale", { value: metricText(this.hass.language, onScale.state, "kg", 1) })}</p>`
          : nothing}
        ${person ? this._renderPerson(person) : html`<p class="hint" data-scale-empty>${this._t("scale_none")}</p>`}
      </div>
    `;
  }

  _renderPerson(person) {
    const language = this.hass.language;
    const { attributes } = person;
    const bmi = Number(attributes.bmi);
    const place = bmiPlace(bmi);
    const when = person.measured
      ? new Intl.DateTimeFormat(language, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(person.measured)
      : null;
    const difference = Number(attributes.weight) - Number(attributes.ideal);
    return html`
      <div class="columns">
        <div class="column">
          <section class="card hero" data-scale-hero>
            <div class="weight">
              <strong>${metricText(language, attributes.weight, "", 1)}</strong><span>kg</span>
            </div>
            <p class="facts">
              ${Number.isFinite(difference) && Math.abs(difference) >= 0.05
                ? html`<span>${this._t("scale_ideal", { value: metricText(language, attributes.ideal, "kg", 1) })}</span>
                    <span class=${difference > 0 ? "above" : "below"} data-scale-difference>
                      ${difference > 0 ? "+" : "−"}${metricText(language, Math.abs(difference), "kg", 1)}</span>`
                : nothing}
              ${Number(attributes.fat_mass_to_lose) > 0
                ? html`<span>${this._t("scale_to_lose", { value: metricText(language, attributes.fat_mass_to_lose, "kg", 1) })}</span>`
                : nothing}
            </p>
            ${when ? html`<p class="hint">${this._t("scale_measured", { when })}</p>` : nothing}
          </section>
          ${place
            ? html`<section class="card bmi" data-scale-bmi>
                <div class="bmi-head">
                  <span>BMI <strong>${metricText(language, bmi, "", 1)}</strong></span>
                  <span class="band ${place.band}">${label(language, "scale_bmi", attributes.bmi_label ?? place.band)}</span>
                </div>
                <div class="bar">
                  ${BMI_BANDS.map(([from, to, band]) => html`<span class=${band} style="flex: ${to - from}"></span>`)}
                  <i class="marker" style="left: ${(place.at * 100).toFixed(1)}%"></i>
                </div>
                <div class="scale-ticks">${[18.5, 25, 30].map((value) => html`<span>${metricText(language, value, "", value % 1 ? 1 : 0)}</span>`)}</div>
              </section>`
            : nothing}
          ${this._renderChart(person)}
        </div>
        <div class="column">
          <div class="metrics" data-scale-metrics>
            ${SCALE_METRICS.map(
              ([key, unit, digits]) => html`<div class="metric" data-scale-metric=${key}>
                <small>${this._t(`scale_m_${key}`)}</small>
                <strong>${metricText(language, attributes[key], unit, digits)}</strong>
              </div>`,
            )}
            ${attributes.body_type
              ? html`<div class="metric wide" data-scale-metric="body_type">
                  <small>${this._t("scale_m_body_type")}</small>
                  <strong>${label(language, "scale_type", attributes.body_type)}</strong>
                </div>`
              : nothing}
          </div>
        </div>
      </div>
    `;
  }

  _renderChart(person) {
    const language = this.hass.language;
    const points = this._points;
    const ideal = Number(person.attributes.ideal);
    let plot = nothing;
    if (points === null) plot = html`<p class="hint">${this._t("chart_loading")}</p>`;
    else if (!weightChanged(points)) plot = html`<p class="hint" data-scale-no-history>${this._t("scale_no_history")}</p>`;
    else {
      const values = points.map((point) => point.value);
      const low = Math.floor(Math.min(...values, Number.isFinite(ideal) ? ideal : Infinity) - 1);
      const high = Math.ceil(Math.max(...values) + 1);
      const from = points[0].at;
      const to = points.at(-1).at;
      const x = (at) => ((at - from) / Math.max(1, to - from)) * 300;
      const y = (value) => 100 - ((value - low) / Math.max(1, high - low)) * 100;
      const line = points.map((point) => `${x(point.at).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
      const date = (at) => new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }).format(at);
      plot = html`
        <svg viewBox="0 0 300 100" preserveAspectRatio="none" data-scale-chart>
          ${Number.isFinite(ideal) && ideal >= low && ideal <= high
            ? html`<line class="ideal" x1="0" x2="300" y1=${y(ideal)} y2=${y(ideal)}></line>`
            : nothing}
          <polyline points=${line}></polyline>
        </svg>
        <div class="axis"><span>${date(from)}</span><span>${metricText(language, low, "kg", 0)} – ${metricText(language, high, "kg", 0)}</span><span>${date(to)}</span></div>
      `;
    }
    return html`
      <section class="card chart" data-scale-history>
        <div class="chart-head">
          <strong>${this._t("scale_weight")}</strong>
          <div class="ranges">
            ${SCALE_RANGES.map(
              (days) => html`<button class=${days === this._days ? "on" : ""} data-scale-days=${days} @click=${() => (this._days = days)}>
                ${this._t(`scale_range_${days}`)}
              </button>`,
            )}
          </div>
        </div>
        ${plot}
      </section>
    `;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
      }
      .content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 1100px;
        margin: 0 auto;
        padding: 0 16px 16px;
      }
      .people {
        display: flex;
        flex: none;
        gap: 8px;
        padding-bottom: 4px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .people button {
        display: flex;
        flex: none;
        flex-direction: column;
        padding: 8px 14px;
        border: 1px solid var(--hd-outline);
        border-radius: 14px;
      }
      .people button.selected {
        background: var(--hd-pill);
      }
      .people small,
      .hint,
      .metric small,
      .axis,
      .scale-ticks {
        color: var(--hd-text-muted);
      }
      .hint {
        margin: 0;
        font-size: 13px;
      }
      .columns,
      .column {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px;
        border-radius: 20px;
        background: var(--hd-off);
      }
      .weight {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .weight strong {
        font-size: 56px;
        font-weight: 300;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .weight span {
        font-size: 20px;
      }
      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 14px;
        margin: 0;
        font-size: 14px;
      }
      .facts .above {
        color: #ff9f0a;
      }
      .facts .below {
        color: #30d158;
      }
      .bmi-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
      }
      .bmi-head strong {
        font-size: 20px;
        font-weight: 500;
      }
      .band {
        padding: 2px 10px;
        border-radius: 10px;
        font-size: 13px;
        color: #ffffff;
      }
      .bar {
        position: relative;
        display: flex;
        gap: 2px;
        height: 10px;
      }
      .bar span {
        border-radius: 5px;
      }
      .under {
        background: #64d2ff;
      }
      .normal {
        background: #30d158;
      }
      .over {
        background: #ff9f0a;
      }
      .obese {
        background: #ff453a;
      }
      .marker {
        position: absolute;
        top: -4px;
        width: 4px;
        height: 18px;
        border-radius: 2px;
        background: var(--hd-text);
        transform: translateX(-50%);
      }
      /* Under the bar, at the borders of the bands between 15 and 35. */
      .scale-ticks {
        position: relative;
        height: 14px;
        font-size: 11px;
      }
      .scale-ticks span {
        position: absolute;
        transform: translateX(-50%);
      }
      .scale-ticks span:nth-child(1) {
        left: 17.5%;
      }
      .scale-ticks span:nth-child(2) {
        left: 50%;
      }
      .scale-ticks span:nth-child(3) {
        left: 75%;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .metric {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 12px 14px;
        border-radius: 16px;
        background: var(--hd-off);
      }
      .metric.wide {
        grid-column: 1 / -1;
      }
      .metric strong {
        font-size: 19px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }
      .chart-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .ranges {
        display: flex;
        gap: 4px;
        padding: 3px;
        border-radius: 12px;
        background: var(--hd-surface);
      }
      .ranges button {
        padding: 5px 10px;
        border-radius: 9px;
        font-size: 13px;
      }
      .ranges button.on {
        background: var(--hd-pill);
      }
      svg {
        display: block;
        width: 100%;
        height: 140px;
        overflow: visible;
      }
      polyline {
        fill: none;
        stroke: var(--hd-climate-icon, #ff9f0a);
        stroke-width: 2.5px;
        vector-effect: non-scaling-stroke;
        stroke-linejoin: round;
      }
      .ideal {
        stroke: #30d158;
        stroke-width: 1.5px;
        stroke-dasharray: 5 5;
        vector-effect: non-scaling-stroke;
      }
      .axis {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
      }
      /* A window wide enough (a tablet): the weight, BMI and the line on the left, what the body is made of on the
         right. */
      @container (min-width: 700px) {
        .columns {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
          align-items: start;
          gap: 16px;
        }
        .metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .weight strong {
          font-size: 64px;
        }
      }
    `,
  ];
}
