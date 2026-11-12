// The overview screen: the time and date, then only what needs a look right now. The rules live in the
// shortcut, so an item that has nothing to say and a section left without items take no room at all.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const CLOCK_TICK_MS = 15000;
const NOTHING_TO_SHOW = new Set(["", "0", "—", "none", "unknown", "unavailable"]);

const asEntry = (entry) => (typeof entry === "string" ? { entity: entry } : entry);
const asList = (value) => (Array.isArray(value) ? value : [value]);

// The same battery levels a person would call batteries: a percentage, never a voltage or a word, and not a
// battery's wear (`…_health`). `platforms` keeps those of some integrations; `device_has: camera` those of a device
// that also has an entity of that domain (a battery camera, not a battery sensor of the same integration).
function batteryEntities(hass, { platforms, device_has: deviceHas } = {}) {
  const entities = hass.entities ?? {};
  const devicesWith = deviceHas
    ? new Set(
        Object.values(entities)
          .filter((entry) => entry.entity_id?.startsWith(`${deviceHas}.`) && entry.device_id)
          .map((entry) => entry.device_id),
      )
    : null;
  return Object.values(hass.states)
    .filter(({ entity_id: id, attributes }) => id.startsWith("sensor.") && attributes.unit_of_measurement === "%")
    .filter(({ entity_id: id, attributes }) => id.includes("battery") || attributes.device_class === "battery")
    .filter(({ entity_id: id }) => !/_health$/.test(id))
    .filter(({ entity_id: id }) => !platforms || asList(platforms).includes(entities[id]?.platform))
    .filter(({ entity_id: id }) => !devicesWith || devicesWith.has(entities[id]?.device_id))
    .map(({ entity_id: entity }) => ({ entity }));
}

function measuredRows(hass, item, entries) {
  const number = new Intl.NumberFormat(hass.language, { maximumFractionDigits: 1 });
  return entries.flatMap(({ entity, name }) => {
    const stateObj = hass.states[entity];
    const raw = item.attribute ? stateObj?.attributes[item.attribute] : stateObj?.state;
    const value = raw === "" || raw === null ? NaN : Number(raw);
    if (!(value < item.below)) return [];
    const unit = item.unit ?? stateObj.attributes.unit_of_measurement ?? "";
    const spaced = /^[°%]/.test(unit) || !unit ? unit : ` ${unit}`;
    return [{ entity, name: name ?? stateObj.attributes.friendly_name ?? entity, value: `${number.format(value)}${spaced}`, level: value }];
  }).sort((first, second) => first.level - second.level);
}

function matchingRows(hass, item, entries) {
  const wanted = asList(item.state ?? "on");
  return entries
    .filter(({ entity }) => wanted.includes(hass.states[entity]?.state))
    .map(({ entity, name }) => ({ entity, name: name ?? hass.states[entity].attributes.friendly_name ?? entity }));
}

function listedRows(hass, { list }) {
  const when = new Intl.DateTimeFormat(hass.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const rows = hass.states[list.entity]?.attributes[list.attribute];
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    name: row[list.name],
    value: list.since && row[list.since] ? when.format(new Date(row[list.since])) : undefined,
    detail: list.detail ? row[list.detail] : undefined,
  }));
}

function shownFacts(hass, facts) {
  return (facts ?? []).flatMap(({ name, entity, unit }) => {
    const value = hass.states[entity]?.state ?? "";
    return NOTHING_TO_SHOW.has(value.trim()) ? [] : [{ name, value: unit ? `${value} ${unit}` : value }];
  });
}

// What one item has to say now, or null when it has nothing.
export function overviewItem(hass, item, now = new Date()) {
  const day = now.getDay() || 7;
  if (item.weekdays && !item.weekdays.includes(day)) return null;
  if (item.months && !item.months.includes(now.getMonth() + 1)) return null;
  const { name, icon } = item;
  if (item.text) return { name, icon, text: item.text };
  if (item.list) {
    const rows = listedRows(hass, item);
    return rows.length ? { name, icon, rows, count: rows.length } : null;
  }
  if (item.entity) {
    const state = hass.states[item.entity]?.state;
    if (!asList(item.state ?? "on").includes(state)) return null;
    return { name, icon, text: item.labels?.[state], facts: shownFacts(hass, item.facts) };
  }
  const entries = item.auto === "battery" ? batteryEntities(hass, item) : (item.entities ?? []).map(asEntry);
  const rows = item.below === undefined ? matchingRows(hass, item, entries) : measuredRows(hass, item, entries);
  return rows.length ? { name, icon, rows, count: rows.length, notify: Boolean(item.notify) } : null;
}

export function overviewSections(hass, sections, now = new Date()) {
  return (sections ?? []).flatMap(({ title, alert, bottom, items }) => {
    const shown = (items ?? []).map((item) => overviewItem(hass, item, now)).filter(Boolean);
    return shown.length ? [{ title, alert: Boolean(alert), bottom: Boolean(bottom), items: shown }] : [];
  });
}

export class HomeDashboardOverview extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
  };

  connectedCallback() {
    super.connectedCallback();
    this._clock = setInterval(() => this.requestUpdate(), CLOCK_TICK_MS);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._clock);
  }

  _details(entityId) {
    this.dispatchEvent(new CustomEvent("sheet-details", { bubbles: true, composed: true, detail: { entityId } }));
  }

  _renderNow(sections, now) {
    const { language } = this.hass;
    const time = new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }).format(now);
    const date = new Intl.DateTimeFormat(language, { weekday: "long", day: "numeric", month: "long" }).format(now);
    const count = sections.filter(({ alert }) => alert).reduce((sum, { items }) => sum + items.length, 0);
    return html`
      <div class="now" data-status-now>
        <ha-icon .icon=${this.item.icon}></ha-icon>
        <div>
          <strong>${time}</strong>
          <span class="date">${date}</span>
          <span class="${count ? "alert" : ""}" data-status-summary>
            ${count ? translate(language, "status_attention", { count }) : translate(language, "status_ok")}
          </span>
        </div>
      </div>
    `;
  }

  _renderTile({ entity, icon, label, value, alert, item }) {
    const body = html`
      <ha-icon .icon=${icon}></ha-icon>
      <span>${label ? html`<small>${label}</small>` : nothing}<b>${value}</b></span>
    `;
    return entity
      ? html`<button
          class="fact ${alert ? "alert" : ""}"
          data-status-item=${item ?? nothing}
          data-status-row=${entity}
          @click=${() => this._details(entity)}
        >
          ${body}
        </button>`
      : html`<div class="fact ${alert ? "alert" : ""}" data-status-item=${item ?? nothing} data-status-row>${body}</div>`;
  }

  // Like the groups of a block: the name and how many, and under them a tile for each.
  _renderGroup({ name, icon, text, rows, facts, count }, alert) {
    const tiles = rows
      ? rows.map(({ entity, name: value, value: when, detail }) =>
          this._renderTile({ entity, icon, value, label: [detail, when].filter(Boolean).join(" · ") }),
        )
      : facts.map(({ name: label, value }) => this._renderTile({ icon, label, value }));
    return html`
      <details class="summary" open data-status-item=${name}>
        <summary>
          <strong>${name}</strong>
          <small class=${alert ? "alert" : ""}>${count ?? text}</small>
          <ha-icon icon="mdi:chevron-down"></ha-icon>
        </summary>
        ${tiles.length ? html`<div class="facts">${tiles}</div>` : nothing}
      </details>
    `;
  }

  _renderItem(item, alert) {
    const { name, icon, text, rows, facts } = item;
    if (rows?.some(({ detail }) => detail) || rows?.every(({ value }) => !value) || facts?.length) {
      return this._renderGroup(item, alert);
    }
    if (rows) {
      return rows.map(({ entity, name: place, value }) =>
        this._renderTile({ entity, icon, alert, item: name, label: name, value: `${place} ${value}` }),
      );
    }
    return this._renderTile({ icon, alert, item: name, label: name, value: text });
  }

  _renderSection({ title, alert, items }) {
    return html`
      <section data-status-section=${title ?? ""}>
        ${title ? html`<h3>${title}</h3>` : nothing}
        <div class="items">${items.map((item) => this._renderItem(item, alert))}</div>
      </section>
    `;
  }

  render() {
    if (!this.hass || !this.item) return nothing;
    const now = new Date();
    const sections = overviewSections(this.hass, this.item.sections, now);
    return html`
      <div class="content">
        ${this._renderNow(sections, now)}
        ${sections.filter(({ bottom }) => !bottom).map((section) => this._renderSection(section))}
        ${sections.filter(({ bottom }) => bottom).map((section) => this._renderSection(section))}
      </div>
    `;
  }

  static styles = [
    tokens,
    css`
      button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
      }
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
        flex: none;
        --mdc-icon-size: 72px;
        color: var(--hd-media-chip);
      }
      .now div {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .now strong {
        font-size: 44px;
        font-weight: 500;
        line-height: 52px;
        font-variant-numeric: tabular-nums;
      }
      .now span {
        color: var(--hd-text-muted);
        font-size: 15px;
      }
      .now .alert {
        color: var(--hd-security-ink);
      }
      .date::first-letter {
        text-transform: uppercase;
      }
      h3 {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 500;
      }
      .items,
      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .fact {
        display: flex;
        flex: 1 1 calc(50% - 4px);
        align-items: center;
        gap: 10px;
        box-sizing: border-box;
        min-width: 0;
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
        font-size: 12px;
        line-height: 16px;
        color: var(--hd-text-muted);
      }
      .fact b {
        font-size: 14px;
        font-weight: 500;
        overflow-wrap: anywhere;
      }
      .fact.alert {
        color: var(--hd-security-ink);
        background: var(--hd-security);
      }
      .fact.alert ha-icon,
      .fact.alert small {
        color: inherit;
      }
      .summary {
        flex: 1 1 100%;
        min-width: 0;
        border-radius: var(--hd-radius);
        background: var(--hd-off);
      }
      .summary summary {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 56px;
        padding: 0 16px;
        list-style: none;
        cursor: pointer;
      }
      .summary summary::-webkit-details-marker {
        display: none;
      }
      .summary strong {
        flex: 1;
        min-width: 0;
        font-size: 15px;
        font-weight: 500;
      }
      .summary summary small {
        font-size: 13px;
        color: var(--hd-text-muted);
      }
      .summary summary small.alert {
        font-weight: 500;
        color: var(--hd-security-ink);
      }
      .summary summary ha-icon {
        flex: none;
        transition: transform 200ms ease;
      }
      .summary[open] summary ha-icon {
        transform: rotate(180deg);
      }
      .summary .facts {
        padding: 0 8px 8px;
      }
      .summary .fact {
        background: var(--hd-surface);
      }
      /* A tablet: on the whole screen what is listed stands side by side, as many in a row as fit, also inside a
         group across its whole width. */
      @media (min-width: 900px) {
        .fact {
          flex: 1 1 260px;
          max-width: calc(50% - 4px);
        }
        .facts {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        }
        .facts .fact {
          max-width: none;
        }
      }
    `,
  ];
}
