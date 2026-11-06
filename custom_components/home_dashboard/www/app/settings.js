// Dashboard settings for admins. Changes go to the dashboard's own strategy block, so there is one
// source of truth and a YAML-free way to curate what the dashboard shows.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { domainOf, effectiveArea, isPrimary, moveInList, normalizeConfig, toggleInList } from "./model.js";
import { tokens } from "./styles.js";

const MAX_RESULTS = 30;
const IDLE_MINUTES = [0, 1, 3, 5, 10];
const PREVIOUS_CONFIG_KEY = "home_dashboard_previous_config";
const MAPPINGS = ["rooms", "cameras", "intercom", "entities", "media", "lights", "security", "idle"];
const LISTS = ["favorites", "layout", "scenes", "shortcuts"];
const START_KEY = "home_dashboard_start";

const isMapping = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function tileProblem(tile, path) {
  if (!isMapping(tile)) return { key: "yaml_not_mapping", path };
  if (tile.kind === "panel" ? !tile.name : !tile.entity) return { key: "yaml_tile_incomplete", path };
  return null;
}

function roomProblem(room, path) {
  if (!isMapping(room)) return { key: "yaml_not_mapping", path };
  if (!room.id || !room.name) return { key: "yaml_room_incomplete", path };
  for (const name of ["areas", "home", "sections", "status"]) {
    if (room[name] !== undefined && !Array.isArray(room[name])) return { key: "yaml_not_list", path: `${path}.${name}` };
  }
  for (const [index, tile] of (room.home ?? []).entries()) {
    const problem = tileProblem(tile, `${path}.home[${index}]`);
    if (problem) return problem;
  }
  for (const [index, section] of (room.sections ?? []).entries()) {
    const sectionPath = `${path}.sections[${index}]`;
    if (!Array.isArray(section?.tiles)) return { key: "yaml_not_list", path: `${sectionPath}.tiles` };
    for (const [position, tile] of section.tiles.entries()) {
      const problem = tileProblem(tile, `${sectionPath}.tiles[${position}]`);
      if (problem) return problem;
    }
  }
  for (const [index, group] of (room.status ?? []).entries()) {
    if (!Array.isArray(group?.entities)) return { key: "yaml_not_list", path: `${path}.status[${index}].entities` };
  }
  return null;
}

// What would stop the dashboard from drawing, so that a typo cannot lock anyone out of the editor.
export function configProblem(config) {
  if (!isMapping(config)) return { key: "yaml_not_mapping", path: "/" };
  for (const name of MAPPINGS) {
    if (config[name] !== undefined && !isMapping(config[name])) return { key: "yaml_not_mapping", path: name };
  }
  for (const name of LISTS) {
    if (config[name] !== undefined && !Array.isArray(config[name])) return { key: "yaml_not_list", path: name };
  }
  for (const [index, room] of (config.layout ?? []).entries()) {
    const problem = roomProblem(room, `layout[${index}]`);
    if (problem) return problem;
  }
  for (const [index, tile] of (config.scenes ?? []).entries()) {
    const problem = tileProblem(tile, `scenes[${index}]`);
    if (problem) return problem;
  }
  for (const [index, item] of (config.shortcuts ?? []).entries()) {
    if (!isMapping(item) || !item.name || !item.kind) return { key: "yaml_shortcut_incomplete", path: `shortcuts[${index}]` };
  }
  return null;
}

// Kept on the device, not in the dashboard: this is the one thing that differs per screen.
function startPath() {
  try {
    return localStorage.getItem(START_KEY);
  } catch {
    return null;
  }
}

export function setStartPath(path) {
  try {
    if (path) localStorage.setItem(START_KEY, path);
    else localStorage.removeItem(START_KEY);
  } catch {
    // Private browsing: there is no start to remember.
  }
}

function previousConfig() {
  try {
    return localStorage.getItem(PREVIOUS_CONFIG_KEY);
  } catch {
    return null;
  }
}

export function rememberConfig(text) {
  try {
    localStorage.setItem(PREVIOUS_CONFIG_KEY, text);
  } catch {
    // Too large or private browsing: saving matters more than the way back.
  }
}
const OPTIONAL_DOMAINS = new Set(["switch", "scene", "fan", "vacuum", "input_boolean"]);

const dashboardSegment = () => window.location.pathname.split("/").filter(Boolean)[0] ?? "";

export function applyInclude(raw, hass, entityId) {
  const area = effectiveArea(hass, entityId, normalizeConfig(raw));
  const include = { ...raw.entities?.include };
  if (!area) return raw;
  const list = include[area] ?? [];
  include[area] = toggleInList(list, entityId);
  if (!include[area].length) delete include[area];
  return { ...raw, entities: { ...raw.entities, include } };
}

export function roomOrder(hass, raw) {
  const order = raw.rooms?.order ?? [];
  return [...order, ...Object.keys(hass.areas).filter((id) => !order.includes(id))];
}

export class HomeDashboardSettings extends LitElement {
  static properties = {
    hass: { attribute: false },
    raw: { attribute: false },
    _draft: { state: true },
    _query: { state: true },
    _saving: { state: true },
    _editor: { state: true },
  };

  willUpdate(changed) {
    if (changed.has("raw")) this._draft = structuredClone(this.raw ?? {});
  }

  _t(key) {
    return translate(this.hass.language, key);
  }

  _update(change) {
    this._draft = { ...this._draft, ...change };
  }

  _moveRoom(id, delta) {
    const order = moveInList(roomOrder(this.hass, this._draft), id, delta);
    this._update({ rooms: { ...this._draft.rooms, order } });
  }

  _toggleRoom(id) {
    const hidden = toggleInList(this._draft.rooms?.hidden ?? [], id);
    this._update({ rooms: { ...this._draft.rooms, hidden } });
  }

  _matches() {
    const query = (this._query ?? "").trim().toLowerCase();
    if (!query) return [];
    return Object.keys(this.hass.entities)
      .filter((id) => isPrimary(this.hass.entities[id]) && this.hass.states[id])
      .filter((id) => {
        const name = this.hass.states[id].attributes.friendly_name ?? "";
        return id.includes(query) || name.toLowerCase().includes(query);
      })
      .slice(0, MAX_RESULTS);
  }

  _renderEntity(id) {
    const favorite = (this._draft.favorites ?? []).includes(id);
    const area = effectiveArea(this.hass, id, normalizeConfig(this._draft));
    const included = Object.values(this._draft.entities?.include ?? {}).flat().includes(id);
    return html`
      <li data-entity=${id}>
        <span>${this.hass.states[id].attributes.friendly_name ?? id}<small>${this.hass.areas[area]?.name ?? ""}</small></span>
        ${OPTIONAL_DOMAINS.has(domainOf(id)) && area
          ? html`<button
              class=${included ? "active" : ""}
              aria-label=${this._t("rooms")}
              data-include
              @click=${() => {
                this._draft = applyInclude(this._draft, this.hass, id);
              }}
            >
              <ha-icon icon="mdi:view-grid-plus-outline"></ha-icon>
            </button>`
          : nothing}
        <button
          class=${favorite ? "active" : ""}
          aria-label=${this._t("favorites")}
          data-favorite
          @click=${() => this._update({ favorites: toggleInList(this._draft.favorites ?? [], id) })}
        >
          <ha-icon .icon=${favorite ? "mdi:star" : "mdi:star-outline"}></ha-icon>
        </button>
      </li>
    `;
  }

  async _openEditor() {
    this._yaml = await import("../vendor/js-yaml.js");
    const { type, ...config } = this._draft;
    const text = this._yaml.dump(config, { lineWidth: -1, noRefs: true });
    this._editor = { text, original: text, problem: null };
  }

  _problemText({ key, path, ...values }) {
    return `${path ? `${path}: ` : ""}${translate(this.hass.language, key, values)}`;
  }

  _parseEditor(text) {
    try {
      return { config: this._yaml.load(text) };
    } catch (error) {
      const line = (error.mark?.line ?? 0) + 1;
      return { problem: { key: "yaml_invalid", line, reason: error.reason ?? error.message } };
    }
  }

  _saveEditor() {
    const text = this.renderRoot.querySelector("[data-yaml]").value;
    const { config, problem } = this._parseEditor(text);
    const found = problem ?? configProblem(config);
    if (found) {
      this._editor = { ...this._editor, text, problem: this._problemText(found) };
      return;
    }
    rememberConfig(this._editor.original);
    this._draft = config;
    this._save();
  }

  _restoreEditor() {
    this._editor = { ...this._editor, text: previousConfig(), problem: null };
  }

  _renderEditor() {
    const { text, problem } = this._editor;
    return html`
      <div class="scrim"></div>
      <section class="panel editor">
        <header>
          <button
            aria-label=${this._t("close")}
            data-editor-close
            @click=${() => {
              this._editor = null;
            }}
          >
            <ha-icon icon="mdi:arrow-left"></ha-icon>
          </button>
          <h2>${this._t("yaml_title")}</h2>
          <button class="save" data-yaml-save ?disabled=${this._saving} @click=${this._saveEditor}>${this._t("save")}</button>
        </header>
        <div class="content">
          <p class="hint">${this._t("yaml_hint")}</p>
          ${problem ? html`<p class="problem" data-yaml-problem>${problem}</p>` : nothing}
          <textarea
            data-yaml
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
            wrap="off"
            .value=${text}
          ></textarea>
          ${previousConfig()
            ? html`<button class="restore" data-yaml-restore @click=${this._restoreEditor}>
                <ha-icon icon="mdi:history"></ha-icon>${this._t("yaml_restore")}
              </button>`
            : nothing}
        </div>
      </section>
    `;
  }

  _save() {
    this._saving = true;
    this.dispatchEvent(new CustomEvent("settings-save", { detail: { dashboard: this._draft } }));
  }

  render() {
    if (!this.hass || !this._draft) return nothing;
    if (this._editor) return this._renderEditor();
    const hidden = this._draft.rooms?.hidden ?? [];
    const order = roomOrder(this.hass, this._draft);
    const idleSeconds = normalizeConfig(this._draft).idle.return_after;
    return html`
      <div class="scrim" @click=${() => this.dispatchEvent(new CustomEvent("settings-close"))}></div>
      <section class="panel">
        <header>
          <button aria-label=${this._t("close")} @click=${() => this.dispatchEvent(new CustomEvent("settings-close"))}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
          <h2>${this._t("settings")}</h2>
          <button class="save" data-save ?disabled=${this._saving} @click=${this._save}>${this._t("save")}</button>
        </header>
        <div class="content">
          <h3>${this._t("idle_return")}</h3>
          <select
            data-idle
            @change=${(event) => this._update({ idle: { return_after: Number(event.target.value) * 60 } })}
          >
            ${IDLE_MINUTES.map(
              (minutes) => html`
                <option value=${minutes} ?selected=${minutes * 60 === idleSeconds}>
                  ${minutes ? translate(this.hass.language, "idle_minutes", { minutes }) : this._t("idle_never")}
                </option>
              `,
            )}
          </select>
          <label class="start">
            <input
              type="checkbox"
              data-start-here
              .checked=${Boolean(startPath())}
              @change=${(event) => setStartPath(event.target.checked ? `/${dashboardSegment()}/home` : null)}
            />
            <span>${this._t("start_here")}</span>
          </label>
          <button class="restore" data-editor @click=${this._openEditor}>
            <ha-icon icon="mdi:code-braces"></ha-icon>${this._t("yaml_open")}
          </button>
          <h3>${this._t("favorites")}</h3>
          <input
            type="search"
            placeholder=${this._t("search")}
            @input=${(event) => {
              this._query = event.target.value;
            }}
          />
          <ul>${this._matches().map((id) => this._renderEntity(id))}</ul>
          <h3>${this._t("rooms")}</h3>
          <ul>
            ${order.map(
              (id) => html`
                <li data-room=${id}>
                  <span class=${hidden.includes(id) ? "muted" : ""}>${this.hass.areas[id]?.name ?? id}</span>
                  <button aria-label=${this._t("hide_room")} data-hide @click=${() => this._toggleRoom(id)}>
                    <ha-icon .icon=${hidden.includes(id) ? "mdi:eye-off-outline" : "mdi:eye-outline"}></ha-icon>
                  </button>
                  <button aria-label=${this._t("move_up")} data-up @click=${() => this._moveRoom(id, -1)}>
                    <ha-icon icon="mdi:chevron-up"></ha-icon>
                  </button>
                  <button aria-label=${this._t("move_down")} data-down @click=${() => this._moveRoom(id, 1)}>
                    <ha-icon icon="mdi:chevron-down"></ha-icon>
                  </button>
                </li>
              `,
            )}
          </ul>
        </div>
      </section>
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
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 7;
        background: rgba(0, 0, 0, 0.45);
      }
      .panel {
        position: fixed;
        inset: 0;
        z-index: 8;
        display: flex;
        flex-direction: column;
        padding-top: var(--hd-safe-top);
        background: var(--hd-background);
      }
      header {
        display: flex;
        flex: none;
        align-items: center;
        height: 64px;
        padding: 0 8px;
      }
      header button {
        display: grid;
        place-items: center;
        min-width: 48px;
        height: 48px;
      }
      h2 {
        flex: 1;
        margin: 0 8px;
        font-size: 20px;
        font-weight: 400;
      }
      h3 {
        margin: 20px 0 8px;
        font-size: 15px;
        font-weight: 500;
      }
      .save {
        padding: 0 16px;
        font-weight: 500;
        color: var(--hd-link);
      }
      .editor .content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
      }
      .hint {
        margin: 0;
        font-size: 13px;
        color: var(--hd-text-muted);
      }
      .problem {
        margin: 0;
        padding: 10px 12px;
        border-radius: 12px;
        font-size: 14px;
        background: var(--hd-security);
      }
      textarea {
        flex: 1;
        box-sizing: border-box;
        width: 100%;
        min-height: 240px;
        padding: 12px;
        border: 1px solid var(--hd-outline);
        border-radius: 12px;
        font: 16px/1.4 ui-monospace, Menlo, monospace;
        color: inherit;
        background: var(--hd-surface);
        resize: none;
      }
      .restore {
        display: flex;
        flex: none;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        padding: 10px 14px;
        border-radius: 12px;
        background: var(--hd-off);
      }
      .content {
        flex: 1;
        padding: 0 16px calc(var(--hd-safe-bottom) + 24px);
        overflow-y: auto;
      }
      .start {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 16px;
        font-size: 15px;
      }
      .start input {
        flex: none;
        width: 22px;
        height: 22px;
      }
      input,
      select {
        box-sizing: border-box;
        width: 100%;
        padding: 12px 14px;
        border: 1px solid var(--hd-outline);
        border-radius: 12px;
        font: inherit;
        color: inherit;
        background: var(--hd-surface);
      }
      ul {
        margin: 8px 0 0;
        padding: 0;
        list-style: none;
      }
      li {
        display: flex;
        align-items: center;
        min-height: 52px;
        border-bottom: 1px solid var(--hd-outline);
      }
      li span {
        flex: 1;
        min-width: 0;
      }
      li small {
        display: block;
        font-size: 12px;
        color: var(--hd-text-muted);
      }
      li .muted {
        color: var(--hd-text-muted);
        text-decoration: line-through;
      }
      li button {
        display: grid;
        flex: none;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
      }
      li button.active {
        color: var(--hd-star);
      }
      @media (min-width: 900px) {
        .panel.editor {
          width: min(900px, calc(100vw - 48px));
        }
        .panel {
          inset: 50% auto auto 50%;
          width: 560px;
          height: min(720px, calc(100vh - 48px));
          padding-top: 0;
          overflow: hidden;
          border-radius: 28px;
          transform: translate(-50%, -50%);
        }
      }
    `,
  ];
}
