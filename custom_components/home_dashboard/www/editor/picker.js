// The picker of tiles: every entity of the home with its area, kind and battery, where the dashboard already shows
// it, a warning when it may be a device shown twice, and what a new tile of it would best take. What is ticked shows
// in the preview at once and joins the list only on "Add".

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "../app/i18n.js";
import { KINDS, pickerRows, tileFor } from "./picker-model.js";

const TAG = "home-dashboard-editor-picker";
// More rows than this would make a long scroll: a search narrows them.
export const SHOWN_ROWS = 200;

export class HomeDashboardEditorPicker extends LitElement {
  static properties = {
    hass: { attribute: false },
    strategy: { attribute: false },
    target: { attribute: false },
    _search: { state: true },
    _areas: { state: true },
    _unassigned: { state: true },
    _kinds: { state: true },
    _hideUsed: { state: true },
    _technical: { state: true },
    _suggest: { state: true },
    _chosen: { state: true },
  };

  constructor() {
    super();
    this._search = "";
    this._kinds = [];
    this._hideUsed = false;
    this._technical = false;
    this._unassigned = false;
    this._suggest = true;
    this._chosen = [];
  }

  willUpdate(changed) {
    if (changed.has("target") && this.target) {
      this._areas = this.target.areas ?? [];
      this._chosen = [];
    }
  }

  firstUpdated() {
    this.renderRoot.querySelector("[data-picker-search]")?.focus();
  }

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  get _rows() {
    return pickerRows(this.hass, this.strategy, {
      areas: this._areas,
      unassigned: this._unassigned,
      kinds: this._kinds,
      hideUsed: this._hideUsed,
      technical: this._technical,
      search: this._search,
    });
  }

  /** The tiles the ticked entities would make, in the order they were ticked. */
  get tiles() {
    return this._chosen.map((entity) => tileFor(this.hass, entity, this.target.listPath, this._suggest));
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  _tick(entity) {
    this._chosen = this._chosen.includes(entity) ? this._chosen.filter((item) => item !== entity) : [...this._chosen, entity];
    this.updateComplete.then(() => this._emit("picker-preview", { tiles: this.tiles }));
  }

  _toggleKind(key) {
    this._kinds = this._kinds.includes(key) ? this._kinds.filter((item) => item !== key) : [...this._kinds, key];
  }

  render() {
    if (!this.hass || !this.target) return nothing;
    const rows = this._rows;
    const shown = rows.slice(0, SHOWN_ROWS);
    const chip = (on, label, action, data) => html`<button class="chip ${on ? "on" : ""}" data-filter=${data} @click=${action}>${label}</button>`;
    const roomAreas = this.target.areas ?? [];
    return html`
      <div class="scrim" @click=${() => this._emit("picker-close")}></div>
      <section class="picker" role="dialog" aria-label=${this._t("editor_picker_title", { place: this.target.title })} data-picker>
        <header>
          <ha-icon icon="mdi:plus-box-multiple-outline"></ha-icon>
          <b>${this._t("editor_picker_title", { place: this.target.title })}</b>
          <span class="grow"></span>
          <button class="ghost" data-picker-close aria-label=${this._t("close")} @click=${() => this._emit("picker-close")}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        <label class="search">
          <ha-icon icon="mdi:magnify"></ha-icon>
          <input
            data-picker-search
            .value=${this._search}
            placeholder=${this._t("editor_picker_search")}
            @input=${(event) => (this._search = event.target.value)}
          />
        </label>
        <div class="filters">
          ${roomAreas.length
            ? chip(
                !this._unassigned && this._areas.length > 0,
                this._t("editor_picker_this_room"),
                () => ((this._areas = roomAreas), (this._unassigned = false)),
                "room",
              )
            : nothing}
          ${chip(!this._unassigned && !this._areas.length, this._t("editor_picker_all_areas"), () => ((this._areas = []), (this._unassigned = false)), "all")}
          ${chip(this._unassigned, this._t("editor_picker_no_area"), () => ((this._unassigned = true), (this._areas = [])), "unassigned")}
          <span class="divider"></span>
          ${KINDS.map((kind) => chip(this._kinds.includes(kind.key), this._t(`editor_kind_${kind.key}`), () => this._toggleKind(kind.key), `kind-${kind.key}`))}
          <span class="divider"></span>
          ${chip(this._hideUsed, this._t("editor_picker_hide_used"), () => (this._hideUsed = !this._hideUsed), "hide-used")}
          ${chip(this._technical, this._t("editor_picker_technical"), () => (this._technical = !this._technical), "technical")}
        </div>
        <div class="list" data-picker-list>
          ${shown.length
            ? shown.map((row) => this._renderRow(row))
            : html`<p class="hint" data-picker-empty>${this._t("editor_picker_none")}</p>`}
          ${rows.length > shown.length
            ? html`<p class="hint" data-picker-more>${this._t("editor_picker_more", { count: rows.length - shown.length })}</p>`
            : nothing}
        </div>
        <footer>
          <label class="suggest">
            <input type="checkbox" data-picker-suggest .checked=${this._suggest} @change=${(event) => {
              this._suggest = event.target.checked;
              this._emit("picker-preview", { tiles: this.tiles });
            }} />
            ${this._t("editor_picker_suggest")}
          </label>
          <span class="grow"></span>
          <span class="hint" data-picker-count>${this._t("editor_picker_count", { count: this._chosen.length })}</span>
          <button class="ghost" @click=${() => this._emit("picker-close")}>${this._t("editor_picker_cancel")}</button>
          <button
            class="primary"
            data-picker-add
            ?disabled=${!this._chosen.length}
            @click=${() => this._emit("picker-add", { tiles: this.tiles })}
          >
            ${this._t("editor_picker_add", { count: this._chosen.length })}
          </button>
        </footer>
      </section>
    `;
  }

  _renderRow(row) {
    const chosen = this._chosen.includes(row.entity);
    const facts = [row.entity, row.areaName, row.battery !== null ? this._t("state_battery", { value: row.battery }) : null].filter(Boolean);
    return html`
      <div class="row ${chosen ? "chosen" : ""} ${row.twins.length ? "twin" : ""}" data-picker-row=${row.entity} @click=${() => this._tick(row.entity)}>
        <span class="check ${chosen ? "on" : ""}" role="checkbox" aria-checked=${chosen}></span>
        <span class="text">
          <b>${row.name}</b>
          <small>${facts.join(" · ")}</small>
          ${row.twins.length
            ? html`<small class="warn" data-picker-twin>
                ${this._t("editor_picker_twin", { names: row.twins.map((twin) => `${twin.name} (${twin.platform})`).join(", ") })}
              </small>`
            : nothing}
          ${row.suggestion ? html`<small class="tip" data-picker-tip>${this._t(row.suggestion.reason)}</small>` : nothing}
        </span>
        <span class="used" data-picker-used>${row.used.length ? this._t("editor_picker_used", { places: row.used.join(", ") }) : "–"}</span>
      </div>
    `;
  }

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 20;
      --mdc-icon-size: 18px;
      color: var(--text, #e8eaed);
      font: 14px/1.4 -apple-system, "SF Pro Text", Roboto, system-ui, sans-serif;
    }
    .scrim {
      position: absolute;
      inset: 0;
      background: var(--scrim);
    }
    .picker {
      position: absolute;
      top: 6vh;
      left: 50%;
      display: flex;
      flex-direction: column;
      width: min(880px, calc(100vw - 48px));
      max-height: 86vh;
      transform: translateX(-50%);
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--panel);
      box-shadow: 0 30px 80px var(--shadow);
    }
    header,
    footer {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
    }
    header {
      border-bottom: 1px solid var(--line);
    }
    footer {
      border-top: 1px solid var(--line);
    }
    .grow {
      flex: 1;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border: 0;
      border-radius: 9px;
      font: inherit;
      color: inherit;
      cursor: pointer;
      background: var(--panel2);
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    button.ghost {
      background: transparent;
      color: var(--muted);
    }
    button.primary {
      color: #fff;
      font-weight: 600;
      background: var(--accent);
    }
    .search {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 12px 16px 0;
      padding: 7px 10px;
      border-radius: 9px;
      color: var(--muted);
      background: var(--panel2);
    }
    .search input {
      flex: 1;
      border: 0;
      outline: none;
      font: inherit;
      color: var(--text);
      background: transparent;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      padding: 10px 16px;
      border-bottom: 1px solid var(--line);
    }
    .chip {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      color: var(--muted);
    }
    .chip.on {
      color: var(--accent-text);
      background: rgba(79, 140, 255, 0.25);
    }
    .divider {
      width: 1px;
      height: 18px;
      background: var(--line);
    }
    .list {
      flex: 1;
      overflow: auto;
      min-height: 120px;
    }
    .row {
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 9px 16px;
      border-bottom: 1px solid var(--line);
      cursor: pointer;
    }
    .row:hover {
      background: var(--hover);
    }
    .row.chosen {
      background: rgba(79, 140, 255, 0.1);
    }
    .check {
      width: 18px;
      height: 18px;
      border: 2px solid var(--faint);
      border-radius: 5px;
      box-sizing: border-box;
    }
    .check.on {
      border-color: var(--accent);
      background: var(--accent);
    }
    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    small {
      overflow: hidden;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--muted);
    }
    small.warn {
      color: var(--amber);
      white-space: normal;
    }
    small.tip {
      color: var(--link);
    }
    .used {
      max-width: 220px;
      overflow: hidden;
      font-size: 11px;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--muted);
    }
    .suggest {
      display: flex;
      gap: 6px;
      align-items: center;
      font-size: 12px;
      color: var(--muted);
    }
    .hint {
      padding: 0 16px;
      font-size: 12px;
      color: var(--muted);
    }
  `;
}

if (!customElements.get(TAG)) customElements.define(TAG, HomeDashboardEditorPicker);
