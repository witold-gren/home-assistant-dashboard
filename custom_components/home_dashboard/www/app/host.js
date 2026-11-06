// The machines of the house: load bars, facts, virtual machines and history. Read-only.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const ONLINE_STATES = new Set(["on", "running", "home", "online", "true"]);
const MISSING_STATES = new Set(["unknown", "unavailable", undefined]);
const NO_VALUE = "–";
const DEFAULT_WARN = 70;
const DEFAULT_ALERT = 90;
const SECONDS_IN_DAY = 86400;

export function isOnline(hass, entityId) {
  const state = hass.states[entityId]?.state;
  return state === undefined ? null : ONLINE_STATES.has(String(state).toLowerCase());
}

export function barLevel(value, bar) {
  const percent = Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, (value / (bar.max ?? 100)) * 100));
  if (percent >= (bar.alert ?? DEFAULT_ALERT)) return { percent, level: "alert" };
  return { percent, level: percent >= (bar.warn ?? DEFAULT_WARN) ? "warn" : "" };
}

export function formatDuration(seconds) {
  if (Number.isNaN(seconds) || seconds < 0) return NO_VALUE;
  const days = Math.floor(seconds / SECONDS_IN_DAY);
  const hours = Math.floor((seconds % SECONDS_IN_DAY) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days} d ${hours} h`;
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function formatNumber(hass, value, digits = 0) {
  return value.toLocaleString(hass.language, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatDay(hass, date, now) {
  const days = Math.floor((now - date) / (SECONDS_IN_DAY * 1000));
  const time = date.toLocaleTimeString(hass.language, { hour: "2-digit", minute: "2-digit" });
  if (days <= 0) return translate(hass.language, "host_today", { time });
  if (days === 1) return translate(hass.language, "host_yesterday", { time });
  return translate(hass.language, "host_days_ago", { days, time });
}

export function infoValue(hass, row, now = Date.now()) {
  const stateObj = hass.states[row.entity];
  if (!stateObj || MISSING_STATES.has(stateObj.state)) return NO_VALUE;
  const { state, attributes } = stateObj;
  if (row.type === "since") return formatDuration((now - Date.parse(state)) / 1000);
  if (row.type === "seconds") return formatDuration(Number.parseFloat(state));
  if (row.type === "date") {
    const date = new Date(state);
    return Number.isNaN(date.getTime()) ? NO_VALUE : formatDay(hass, date, now);
  }
  if (row.type === "update") {
    if (state === "on") return `${attributes.installed_version} → ${attributes.latest_version}`;
    return attributes.installed_version ?? translate(hass.language, "host_current");
  }
  if (row.type === "state") return state;
  const value = Number.parseFloat(state);
  if (Number.isNaN(value)) return state;
  const unit = row.unit ?? attributes.unit_of_measurement ?? "";
  return `${formatNumber(hass, value, row.digits)} ${unit}`.trim();
}

export class HomeDashboardHost extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
  };

  async firstUpdated() {
    const helpers = await window.loadCardHelpers?.();
    if (!helpers) return;
    this._graphs = this.item.columns.flatMap((column, index) => {
      const slot = this.renderRoot.querySelector(`[data-graph="${index}"]`);
      if (!column.graph || !slot) return [];
      const card = helpers.createCardElement(column.graph);
      card.hass = this.hass;
      slot.appendChild(card);
      return [card];
    });
  }

  updated(changed) {
    if (changed.has("hass")) {
      this._graphs?.forEach((card) => {
        card.hass = this.hass;
      });
    }
  }

  _dot(online) {
    return html`<span class="dot ${online === null ? "" : online ? "on" : "off"}"></span>`;
  }

  _renderBar(bar) {
    const stateObj = this.hass.states[bar.entity];
    const value = Number.parseFloat(stateObj?.state);
    const { percent, level } = barLevel(value, bar);
    const unit = bar.unit ?? stateObj?.attributes.unit_of_measurement ?? "";
    return html`
      <div class="bar" data-bar=${bar.entity}>
        <div class="bar-label">
          <span>${bar.name}</span>
          <span class="bar-value">${Number.isNaN(value) ? NO_VALUE : formatNumber(this.hass, value, bar.digits)}<small>${unit}</small></span>
        </div>
        <div class="track"><div class="fill ${level}" style="width: ${percent}%"></div></div>
      </div>
    `;
  }

  _renderMachine(machine) {
    const online = isOnline(this.hass, machine.status);
    const percent = (entity) => {
      const value = Number.parseFloat(this.hass.states[entity]?.state);
      return Number.isNaN(value) ? "" : `${formatNumber(this.hass, value)}%`;
    };
    return html`
      <div class="machine ${online === false ? "stopped" : ""}" data-machine=${machine.name}>
        <span class="machine-name">${this._dot(online)}${machine.name}</span>
        <span>${percent(machine.cpu)}</span>
        <span>${percent(machine.ram)}</span>
      </div>
    `;
  }

  _renderColumn(column, index) {
    const language = this.hass.language;
    const machines = column.machines ?? [];
    return html`
      <div class="column" data-column=${column.title}>
        <section class="card">
          <header>
            <ha-icon .icon=${column.icon ?? "mdi:server"}></ha-icon>
            <div>
              <h3>${column.title} ${column.status ? this._dot(isOnline(this.hass, column.status)) : nothing}</h3>
              ${column.subtitle ? html`<small>${column.subtitle}</small>` : nothing}
            </div>
          </header>
          <div class="bars">${(column.bars ?? []).map((bar) => this._renderBar(bar))}</div>
          ${column.info?.length
            ? html`<div class="info">
                ${column.info.map(
                  (row) => html`<div class="fact" data-fact=${row.entity}>
                    <span>${row.name}</span><span>${infoValue(this.hass, row)}</span>
                  </div>`,
                )}
              </div>`
            : nothing}
          ${machines.length
            ? html`<div class="machines">
                <div class="machine head">
                  <span>${translate(language, "host_machines")}</span><span>CPU</span><span>RAM</span>
                </div>
                ${machines.map((machine) => this._renderMachine(machine))}
              </div>`
            : nothing}
        </section>
        ${column.graph ? html`<div class="graph" data-graph=${index}></div>` : nothing}
      </div>
    `;
  }

  render() {
    if (!this.hass || !this.item) return nothing;
    return html`<div class="columns">${this.item.columns.map((column, index) => this._renderColumn(column, index))}</div>`;
  }

  static styles = [
    tokens,
    css`
      .columns {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        align-items: start;
        gap: 12px;
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 16px 16px;
      }
      .column {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 16px;
        border-radius: var(--hd-radius);
        background: var(--hd-off);
      }
      header {
        display: flex;
        align-items: center;
        gap: 12px;
        --mdc-icon-size: 32px;
      }
      header ha-icon {
        color: var(--hd-text-muted);
      }
      h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
      }
      small {
        font-size: 13px;
        color: var(--hd-text-muted);
      }
      .dot {
        display: inline-block;
        flex: none;
        width: 9px;
        height: 9px;
        margin-left: 2px;
        border-radius: 50%;
        background: var(--hd-text-muted);
        vertical-align: 2px;
      }
      .dot.on {
        background: var(--hd-chip-green);
      }
      .dot.off {
        background: var(--hd-security-ink);
      }
      .bars {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .bar-label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        font-size: 14px;
      }
      .bar-value {
        font-weight: 500;
      }
      .bar-value small {
        margin-left: 2px;
        font-size: 11px;
        font-weight: 400;
      }
      .track {
        height: 6px;
        overflow: hidden;
        border-radius: 3px;
        background: var(--hd-off-icon);
      }
      .fill {
        height: 100%;
        border-radius: 3px;
        background: var(--hd-text-muted);
      }
      .fill.warn {
        background: var(--hd-climate-ink);
      }
      .fill.alert {
        background: var(--hd-security-ink);
      }
      .info,
      .machines {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-top: 12px;
        border-top: 1px solid var(--hd-outline);
        font-size: 14px;
      }
      .fact {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .fact span:first-child {
        color: var(--hd-text-muted);
      }
      .machine {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 44px 44px;
        align-items: center;
        gap: 4px;
        text-align: right;
      }
      .machine.head {
        font-size: 12px;
        color: var(--hd-text-muted);
      }
      .machine > :first-child {
        text-align: left;
      }
      .machine-name {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .machine.stopped {
        color: var(--hd-text-muted);
      }
      .graph {
        --ha-card-background: var(--hd-off);
        --card-background-color: var(--hd-off);
        --ha-card-border-width: 0;
        --ha-card-box-shadow: none;
        --ha-card-border-radius: var(--hd-radius);
        --primary-text-color: var(--hd-text);
        --secondary-text-color: var(--hd-text-muted);
      }
    `,
  ];
}
