// History and the logbook in windows of the dashboard, so that nobody lands in the plain Home Assistant
// screens. Both show what a person may see here, and neither asks for the whole house at once: a
// busy house writes thousands of logbook lines an hour, most of them from sensors nobody reads.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { effectiveArea, entityIcon, selectEntities } from "./model.js";
import { personalPrefs, savePrefs } from "./prefs.js";
import { tokens } from "./styles.js";

const LOGBOOK_HOURS = [1, 6, 24];
const HISTORY_HOURS = [6, 24, 48, 168];
const MAX_ROWS = 300;
const MAX_MATCHES = 20;
const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_ICON = "mdi:format-list-bulleted";
const QUIET_STATES = new Set(["off", "closed", "locked", "idle", "unavailable", "unknown", "not_home"]);
const CAUSES = { automation_triggered: "logbook_by_automation", script_started: "logbook_by_script" };

const nameOf = (hass, entry) =>
  entry.name ?? hass.states[entry.entity_id]?.attributes.friendly_name ?? entry.entity_id ?? "";

const denied = (config, entityId) => config?.denied?.includes(entityId);

// What set the change off, as the logbook of Home Assistant says it.
function logbookCause(hass, entry) {
  const name = entry.context_name ?? hass.states[entry.context_entity_id]?.attributes.friendly_name ?? entry.context_entity_id;
  if (!name) return null;
  const key = CAUSES[entry.context_event_type] ?? (entry.context_state === undefined ? null : "logbook_by_state");
  return key ? { key, name } : null;
}

// Newest first, and only what the person may see and asked for.
export function logbookRows(hass, config, entries, query = "") {
  const wanted = query.trim().toLowerCase();
  return [...(entries ?? [])]
    .filter((entry) => !denied(config, entry.entity_id))
    .map((entry) => {
      const stateObj = hass.states[entry.entity_id];
      const state = entry.state === undefined ? "" : (stateObj && hass.formatEntityState?.(stateObj, entry.state)) ?? entry.state;
      const area = stateObj ? effectiveArea(hass, entry.entity_id, config) : null;
      return {
        key: `${entry.when}|${entry.entity_id}`,
        when: entry.when,
        name: nameOf(hass, entry),
        text: entry.message ?? state,
        changed: entry.state !== undefined,
        active: entry.state !== undefined && !QUIET_STATES.has(entry.state),
        icon: stateObj ? entityIcon(hass, entry.entity_id, config) : DEFAULT_ICON,
        area: hass.areas?.[area]?.name ?? null,
        cause: logbookCause(hass, entry),
      };
    })
    .filter(({ name, text }) => !wanted || `${name} ${text}`.toLowerCase().includes(wanted))
    .sort((first, second) => second.when - first.when)
    .slice(0, MAX_ROWS);
}

export function logbookDays(rows) {
  const days = new Map();
  for (const row of rows) {
    const date = new Date(row.when * 1000);
    const key = date.toDateString();
    if (!days.has(key)) days.set(key, { key, date, rows: [] });
    days.get(key).rows.push(row);
  }
  return [...days.values()];
}

export function historyMatches(hass, config, query, picked) {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return [];
  return Object.values(hass.states)
    .filter(({ entity_id: id }) => !picked.includes(id) && !denied(config, id))
    .map(({ entity_id: id, attributes }) => ({ id, name: attributes.friendly_name ?? id }))
    .filter(({ id, name }) => `${name} ${id}`.toLowerCase().includes(wanted))
    .slice(0, MAX_MATCHES);
}

class ActivityWindow extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false },
    _hours: { state: true },
    _query: { state: true },
  };

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  _renderHours(choices, selected) {
    return html`
      <div class="tabs">
        ${choices.map(
          (hours) => html`
            <button class=${hours === selected ? "selected" : ""} data-hours=${hours} @click=${() => (this._hours = hours)}>
              ${this._t("activity_hours", { hours })}
            </button>
          `,
        )}
      </div>
    `;
  }

  _renderSearch(placeholder) {
    return html`<input
      type="search"
      data-activity-search
      placeholder=${placeholder}
      .value=${this._query ?? ""}
      @input=${(event) => (this._query = event.target.value)}
    />`;
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
        gap: 8px;
        max-width: 900px;
        margin: 0 auto;
        padding: 0 16px 16px;
        color: var(--hd-text);
      }
      .tabs {
        display: flex;
        flex: none;
        gap: 8px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .tabs button {
        flex: none;
        padding: 8px 14px;
        border: 1px solid var(--hd-outline);
        border-radius: 12px;
        font-size: 14px;
      }
      .tabs .selected {
        background: var(--hd-pill);
      }
      input {
        box-sizing: border-box;
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--hd-outline);
        border-radius: 12px;
        color: var(--hd-text);
        background: var(--hd-surface);
        font: inherit;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      section h3 {
        margin: 0 -16px 8px;
        padding: 10px 16px;
        background: var(--hd-off);
        font-size: 15px;
        font-weight: 500;
      }
      .entry {
        display: flex;
        align-items: stretch;
        gap: 10px;
      }
      .entry time {
        flex: none;
        width: 60px;
        padding-top: 22px;
        color: var(--hd-text-muted);
        font-size: 13px;
        line-height: 16px;
        font-variant-numeric: tabular-nums;
      }
      .dot {
        position: relative;
        display: flex;
        flex: none;
        justify-content: center;
        width: 40px;
        padding-top: 10px;
        color: var(--hd-off-ink);
        --mdc-icon-size: 22px;
      }
      .dot::before {
        content: "";
        position: absolute;
        top: 10px;
        left: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--hd-off-icon);
      }
      .dot::after {
        content: "";
        position: absolute;
        top: 50px;
        bottom: -10px;
        left: 19px;
        width: 2px;
        background: var(--hd-off-icon);
      }
      .entry:last-child .dot::after {
        display: none;
      }
      .dot ha-icon {
        position: relative;
        top: 9px;
        height: 22px;
      }
      .dot.active {
        color: var(--hd-light-accent);
      }
      .dot.active::before {
        background: var(--hd-light);
      }
      .what {
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: center;
        gap: 2px;
        min-width: 0;
        min-height: 40px;
        padding: 10px 0;
        border-bottom: 1px solid var(--hd-outline);
      }
      .what p {
        margin: 0;
        font-size: 15px;
        line-height: 22px;
        overflow-wrap: anywhere;
      }
      .what strong {
        font-weight: 500;
      }
      .what i {
        margin: 0 5px;
        color: var(--hd-text-muted);
        font-style: normal;
      }
      .what b {
        color: var(--hd-text);
        font-weight: 500;
      }
      .row span {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .row strong {
        font-size: 15px;
        font-weight: 500;
        overflow-wrap: anywhere;
      }
      small {
        color: var(--hd-text-muted);
        font-size: 13px;
      }
      .picked {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .picked button {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        border-radius: 12px;
        background: var(--hd-pill);
        font-size: 13px;
        --mdc-icon-size: 16px;
      }
      .match {
        width: 100%;
      }
      .graph {
        min-height: 200px;
      }
      .empty {
        margin: 24px 0;
        color: var(--hd-text-muted);
        text-align: center;
      }
    `,
  ];
}

export class HomeDashboardLogbook extends ActivityWindow {
  static properties = {
    ...ActivityWindow.properties,
    // The entities of one device, for its window; otherwise everything the dashboard shows.
    entityIds: { attribute: false },
    _entries: { state: true },
  };

  updated() {
    const hours = this._hours ?? LOGBOOK_HOURS[0];
    const key = `${hours}|${(this.entityIds ?? []).join(",")}`;
    if (!this.hass || !this.config || this._loaded === key) return;
    this._loaded = key;
    this._load(hours, key);
  }

  async _load(hours, key) {
    this._entries = null;
    const now = Date.now();
    const entries = await this.hass
      .callWS({
        type: "logbook/get_events",
        start_time: new Date(now - hours * HOUR_MS).toISOString(),
        end_time: new Date(now).toISOString(),
        entity_ids: this.entityIds ?? selectEntities(this.hass, this.config).entityIds,
      })
      .catch(() => []);
    if (this._loaded === key) this._entries = Array.isArray(entries) ? entries : [];
  }

  _dayTitle(date) {
    const full = new Intl.DateTimeFormat(this.hass.language, { day: "numeric", month: "long", year: "numeric" }).format(date);
    const ago = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / DAY_MS);
    return ago < 2 ? `${this._t(ago ? "logbook_yesterday" : "logbook_today")} · ${full}` : full;
  }

  _renderRow({ key, when, name, text, changed, active, icon, area, cause }, format) {
    return html`
      <div class="entry" data-logbook-row=${key}>
        <time>${format.format(new Date(when * 1000))}</time>
        <span class="dot ${active ? "active" : ""}"><ha-icon .icon=${icon}></ha-icon></span>
        <div class="what">
          <p><strong>${name}</strong>${changed ? html`<i>→</i>` : " "}${text}</p>
          ${area ? html`<small>${area}</small>` : nothing}
          ${cause ? html`<small>${this._t(cause.key)}: <b>${cause.name}</b></small>` : nothing}
        </div>
      </div>
    `;
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const format = new Intl.DateTimeFormat(this.hass.language, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const rows = this._entries ? logbookRows(this.hass, this.config, this._entries, this._query) : [];
    return html`
      <div class="content">
        ${this._renderHours(LOGBOOK_HOURS, this._hours ?? LOGBOOK_HOURS[0])} ${this._renderSearch(this._t("activity_search"))}
        ${this._entries && !rows.length ? html`<p class="empty" data-activity-empty>${this._t("logbook_none")}</p>` : nothing}
        ${this._entries ? nothing : html`<p class="empty">${this._t("app_loading")}</p>`}
        ${logbookDays(rows).map(
          ({ key, date, rows: entries }) => html`
            <section data-logbook-day=${key}>
              <h3>${this._dayTitle(date)}</h3>
              ${entries.map((row) => this._renderRow(row, format))}
            </section>
          `,
        )}
      </div>
    `;
  }
}

export class HomeDashboardHistory extends ActivityWindow {
  static properties = {
    ...ActivityWindow.properties,
    _picked: { state: true },
  };

  get _chosen() {
    return this._picked ?? personalPrefs().history ?? [];
  }

  _pick(next) {
    this._picked = next;
    this._query = "";
    savePrefs(this.hass, { ...personalPrefs(), history: next });
  }

  async updated() {
    const hours = this._hours ?? 24;
    const key = `${hours}|${this._chosen.join()}`;
    if (this._card) this._card.hass = this.hass;
    if (!this.hass || this._shown === key) return;
    this._shown = key;
    this._card?.remove();
    this._card = null;
    if (!this._chosen.length) return;
    const helpers = await window.loadCardHelpers?.();
    const card = helpers?.createCardElement({ type: "history-graph", entities: this._chosen, hours_to_show: hours });
    if (!card || this._shown !== key) return;
    card.hass = this.hass;
    this._card = card;
    this.renderRoot.querySelector("[data-history-graph]")?.appendChild(card);
  }

  render() {
    if (!this.hass) return nothing;
    const chosen = this._chosen;
    const name = (id) => this.hass.states[id]?.attributes.friendly_name ?? id;
    return html`
      <div class="content">
        ${this._renderHours(HISTORY_HOURS, this._hours ?? 24)} ${this._renderSearch(this._t("history_add"))}
        ${historyMatches(this.hass, this.config, this._query ?? "", chosen).map(
          ({ id, name: label }) => html`
            <button class="row match" data-history-match=${id} @click=${() => this._pick([...chosen, id])}>
              <span><strong>${label}</strong><small>${id}</small></span>
            </button>
          `,
        )}
        ${chosen.length
          ? html`<div class="picked">
              ${chosen.map(
                (id) => html`
                  <button data-history-picked=${id} @click=${() => this._pick(chosen.filter((item) => item !== id))}>
                    ${name(id)}<ha-icon icon="mdi:close"></ha-icon>
                  </button>
                `,
              )}
            </div>`
          : html`<p class="empty" data-activity-empty>${this._t("history_pick")}</p>`}
        <div class="graph" data-history-graph></div>
      </div>
    `;
  }
}
