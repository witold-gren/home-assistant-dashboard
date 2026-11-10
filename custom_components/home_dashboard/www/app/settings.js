// Dashboard settings for admins. Changes go to the dashboard's own strategy block, so there is one
// source of truth. Rooms and favorites are arranged for everyone in My layout.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import {
  buildCameras,
  cameraLinks,
  cameraMoves,
  controlEntityIds,
  domainOf,
  linkChoices,
  loadTranslationKeys,
  normalizeConfig,
  PTZ_MODES,
} from "./model.js";
import { reloadApp } from "./reload.js";
import { tokens } from "./styles.js";

const IDLE_MINUTES = [0, 1, 3, 5, 10];
const PREVIOUS_CONFIG_KEY = "home_dashboard_previous_config";
const MAPPINGS = ["rooms", "cameras", "intercom", "entities", "media", "menu", "lights", "security", "idle"];
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

// The address of Home of this dashboard, where a person can choose to start.
export function dashboardStart() {
  return `/${dashboardSegment()}/home`;
}

export function setDashboardStart(path) {
  setStartPath(path);
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
const dashboardSegment = () => window.location.pathname.split("/").filter(Boolean)[0] ?? "";

export class HomeDashboardSettings extends LitElement {
  static properties = {
    hass: { attribute: false },
    raw: { attribute: false },
    _draft: { state: true },
    _saving: { state: true },
    _editor: { state: true },
    _reloading: { state: true },
    _newLink: { state: true },
    _cameraOpen: { state: true },
    _keysRead: { state: true },
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

  _link(entityId, other) {
    const cameras = this._draft.cameras ?? {};
    const controls = { ...(cameras.controls ?? {}) };
    if (other) controls[entityId] = other;
    else delete controls[entityId];
    this._update({ cameras: { ...cameras, controls } });
  }

  _addLink() {
    const { camera, other } = this._newLink ?? {};
    if (!camera || !other) return;
    this._link(camera, other);
    this._newLink = null;
  }

  _renderCameraLinks() {
    const { cameras, links } = cameraLinks(this.hass, normalizeConfig(this._draft));
    const camera = this._newLink?.camera ?? "";
    const choices = camera ? linkChoices(this.hass, camera) : [];
    return html`
      <h3>${this._t("camera_links_title")}</h3>
      <p class="hint">${this._t("camera_links_hint")}</p>
      ${links.map(
        (link) => html`
          <div class="link" data-camera-link=${link.entityId}>
            <span><strong>${link.name}</strong> → ${link.otherName}</span>
            <button aria-label=${this._t("camera_links_remove")} data-link-remove @click=${() => this._link(link.entityId, null)}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
        `,
      )}
      <div class="link-new">
        <select
          data-link-camera
          @change=${(event) => (this._newLink = { camera: event.target.value, other: "" })}
        >
          <option value="" ?selected=${!camera}>${this._t("camera_links_pick")}</option>
          ${cameras.map(
            (item) => html`<option value=${item.entityId} ?selected=${item.entityId === camera}>${item.name}</option>`,
          )}
        </select>
        <select
          data-link-other
          ?disabled=${!camera}
          @change=${(event) => (this._newLink = { camera, other: event.target.value })}
        >
          <option value="" ?selected=${!this._newLink?.other}>${this._t("camera_links_pick_other")}</option>
          ${choices.map(
            (item) => html`<option value=${item.entityId} ?selected=${item.entityId === this._newLink?.other}>${item.name}</option>`,
          )}
        </select>
        <button class="restore" data-link-add ?disabled=${!camera || !this._newLink?.other} @click=${this._addLink}>
          <ha-icon icon="mdi:link-variant-plus"></ha-icon>${this._t("camera_links_add")}
        </button>
      </div>
    `;
  }

  // A camera's own way of turning and talking, kept in `cameras.ptz` and `cameras.talk_with`.
  _setCamera(key, entityId, value) {
    const cameras = this._draft.cameras ?? {};
    const map = { ...(cameras[key] ?? {}) };
    if (value === undefined || value === null || value === "auto") delete map[entityId];
    else map[entityId] = value;
    this._update({ cameras: { ...cameras, [key]: map } });
  }

  _setPtz(entityId, change) {
    const current = this._draft.cameras?.ptz?.[entityId] ?? {};
    const next = Object.fromEntries(Object.entries({ ...current, ...change }).filter(([, value]) => value !== "" && value != null));
    this._setCamera("ptz", entityId, Object.keys(next).length && next.mode !== "auto" ? next : null);
  }

  // The translation keys a ready-made way looks for, read once for all cameras when the settings open.
  _readKeys(config) {
    if (this._keysRead) return;
    this._keysRead = true;
    const ids = buildCameras(this.hass, config).flatMap((camera) => controlEntityIds(this.hass, camera.entityId, config));
    loadTranslationKeys(this.hass, ids).then(() => this.requestUpdate());
  }

  _found(controls) {
    const parts = Object.keys(controls.moves).map((direction) => this._t(`ptz_${direction}`));
    if (controls.presets) parts.push(translate(this.hass.language, "ptz_positions", { count: controls.presets.options.length }));
    if (!parts.length) return this._t("ptz_found_nothing");
    const way = controls.mode === "names" ? "" : ` · ${this._t(`ptz_via_${controls.mode}`)}`;
    return `${this._t("ptz_found")}${way}: ${parts.join(", ")}`;
  }

  _entityOptions(ids, chosen) {
    const name = (id) => this.hass.states[id]?.attributes?.friendly_name ?? id;
    return html`
      <option value="" ?selected=${!chosen}>${this._t("ptz_pick")}</option>
      ${ids.map((id) => html`<option value=${id} ?selected=${id === chosen}>${name(id)}</option>`)}
    `;
  }

  _renderManual(entityId, setting, config) {
    const device = controlEntityIds(this.hass, entityId, config);
    const pressable = [
      ...device.filter((id) => ["button", "input_button"].includes(domainOf(id))),
      ...Object.keys(this.hass.states).filter((id) => ["script", "scene"].includes(domainOf(id))),
    ];
    const field = (key, label, ids) => html`
      <label class="field-row">
        <span>${label}</span>
        <select data-ptz-field=${key} @change=${(event) => this._setPtz(entityId, { [key]: event.target.value })}>
          ${this._entityOptions(ids, setting[key])}
        </select>
      </label>
    `;
    return html`
      ${["left", "right", "up", "down"].map((direction) => field(direction, this._t(`ptz_${direction}`), pressable))}
      ${field("select", this._t("ptz_preset_select"), device.filter((id) => domainOf(id) === "select"))}
      ${field("button", this._t("ptz_preset_button"), device.filter((id) => domainOf(id) === "button"))}
    `;
  }

  _renderCameraControl(camera, config) {
    const entityId = camera.entityId;
    const setting = config.cameras.ptz?.[entityId] ?? {};
    const mode = setting.mode ?? "auto";
    const talk = config.cameras.talk_with?.[entityId] ?? "auto";
    const controls = cameraMoves(this.hass, entityId, config);
    const open = this._cameraOpen === entityId;
    return html`
      <div class="camera-control ${open ? "open" : ""}" data-camera-control=${entityId}>
        <button class="camera-row" aria-expanded=${open ? "true" : "false"} @click=${() => (this._cameraOpen = open ? null : entityId)}>
          <span><strong>${camera.name}</strong><small>${this._found(controls)}</small></span>
          <ha-icon icon=${open ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>
        </button>
        ${open
          ? html`<div class="camera-detail">
              <label class="field-row">
                <span>${this._t("ptz_mode")}</span>
                <select data-ptz-mode @change=${(event) => this._setPtz(entityId, { mode: event.target.value })}>
                  ${PTZ_MODES.map((value) => html`<option value=${value} ?selected=${value === mode}>${this._t(`ptz_mode_${value}`)}</option>`)}
                </select>
              </label>
              ${mode === "manual" ? this._renderManual(entityId, setting, config) : nothing}
              ${mode === "onvif" || (mode === "auto" && controls.mode === "onvif")
                ? html`<label class="field-row">
                    <span>${this._t("ptz_onvif_presets")}</span>
                    <input
                      data-ptz-presets
                      .value=${(setting.presets ?? []).join(", ")}
                      @change=${(event) =>
                        this._setPtz(entityId, {
                          mode,
                          presets: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                        })}
                    />
                  </label>`
                : nothing}
              <label class="field-row">
                <span>${this._t("talk_with")}</span>
                <select data-talk-with @change=${(event) => this._setCamera("talk_with", entityId, event.target.value)}>
                  ${["auto", "go2rtc", "intercom", "none"].map(
                    (value) => html`<option value=${value} ?selected=${value === talk}>${this._t(`talk_with_${value}`)}</option>`,
                  )}
                </select>
              </label>
            </div>`
          : nothing}
      </div>
    `;
  }

  _renderCameraControls() {
    const config = normalizeConfig(this._draft);
    const cameras = buildCameras(this.hass, config);
    if (!cameras.length) return nothing;
    this._readKeys(config);
    return html`
      <h3>${this._t("camera_control_title")}</h3>
      <p class="hint">${this._t("camera_control_hint")}</p>
      ${cameras.map((camera) => this._renderCameraControl(camera, config))}
    `;
  }

  _reloadApp = async () => {
    this._reloading = true;
    await reloadApp();
  };

  _save() {
    this._saving = true;
    this.dispatchEvent(new CustomEvent("settings-save", { detail: { dashboard: this._draft } }));
  }

  render() {
    if (!this.hass || !this._draft) return nothing;
    if (this._editor) return this._renderEditor();
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
          <h3>${this._t("talk_title")}</h3>
          <select
            data-talk
            @change=${(event) => this._update({ cameras: { ...(this._draft.cameras ?? {}), talk: event.target.value } })}
          >
            ${["intercom", "camera"].map(
              (mode) => html`<option value=${mode} ?selected=${normalizeConfig(this._draft).cameras.talk === mode}>
                ${this._t(`talk_mode_${mode}`)}
              </option>`,
            )}
          </select>
          ${this._renderCameraLinks()} ${this._renderCameraControls()}
          <button class="restore" data-editor @click=${this._openEditor}>
            <ha-icon icon="mdi:code-braces"></ha-icon>${this._t("yaml_open")}
          </button>
          <button class="restore reload" data-reload-app ?disabled=${this._reloading} @click=${this._reloadApp}>
            <ha-icon icon="mdi:refresh"></ha-icon>
            <span>
              <strong>${this._t(this._reloading ? "reload_app_busy" : "reload_app")}</strong>
              <small>${this._t("reload_app_hint")}</small>
            </span>
          </button>
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
      .link {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        padding: 8px 4px 8px 14px;
        border-radius: 12px;
        font-size: 15px;
        background: var(--hd-surface);
      }
      .link span {
        flex: 1;
        min-width: 0;
      }
      .link button {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
      }
      .camera-control {
        margin-top: 8px;
        border-radius: 12px;
        background: var(--hd-surface);
      }
      .camera-row {
        display: flex;
        align-items: center;
        gap: 8px;
        box-sizing: border-box;
        width: 100%;
        padding: 10px 12px 10px 14px;
      }
      .camera-row span {
        display: grid;
        flex: 1;
        gap: 2px;
        min-width: 0;
      }
      .camera-row small {
        font-size: 13px;
        color: var(--hd-text-muted);
      }
      .camera-detail {
        display: grid;
        gap: 10px;
        padding: 0 12px 12px;
      }
      .field-row {
        display: grid;
        gap: 4px;
        font-size: 14px;
      }
      .link-new {
        display: grid;
        gap: 8px;
        margin-top: 12px;
      }
      .link-new .restore {
        margin-top: 0;
      }
      button[disabled] {
        opacity: 0.4;
        cursor: default;
      }
      .reload span {
        display: grid;
        gap: 2px;
      }
      .reload small {
        font-size: 13px;
        color: var(--hd-text-muted);
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
