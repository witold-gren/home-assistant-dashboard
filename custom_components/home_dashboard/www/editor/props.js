// The properties of what is chosen in the editor's tree, as a form: every key a tile, a section or a room takes,
// with its YAML name beside it. A key the form does not know is kept as it is; a field left empty removes its key,
// so what is saved looks as if written by hand.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "../app/i18n.js";
import { BLOCK_KINDS } from "../app/block-editor.js";
import "../app/icon-picker.js";
import { orderedOptions } from "../app/panel.js";
import "./schema-form.js";

const TAG = "home-dashboard-editor-props";
const LIST_DOMAINS = ["select", "input_select"];

const domainOf = (entity) => String(entity ?? "").split(".")[0];

/** The block a tile names, from the shortcuts of the dashboard. */
const blockOf = (strategy, tile) => (strategy.shortcuts ?? []).find((block) => block.name === tile?.shortcut) ?? null;

/** The fields of a tile, those that apply to it in the order a person thinks of them. */
export function tileFields(tile, strategy) {
  const block = blockOf(strategy, tile);
  const list = LIST_DOMAINS.includes(domainOf(tile.entity));
  return [
    { key: "entity", type: "entity" },
    { key: "shortcut", type: "shortcut" },
    block?.kind === "host" && { key: "column", type: "column" },
    { key: "name", type: "text" },
    { key: "icon", type: "icon" },
    { key: "size", type: "choice", options: ["", "tall"] },
    { key: "calm", type: "toggle" },
    { key: "tap_toggle", type: "toggle" },
    { key: "active_only", type: "toggle" },
    { key: "turn_on_only", type: "toggle" },
    tile.turn_on_only && { key: "off_pin", type: "pin" },
    { key: "action", type: "text", placeholder: "script.example" },
    list && { key: "confirm", type: "toggle" },
    list && { key: "labels", type: "labels" },
  ].filter(Boolean);
}

// A block of several entities: its tile and its window. A card or a page in it stays in YAML.
export function blockFields(block) {
  return [
    { key: "name", type: "text" },
    { key: "icon", type: "icon" },
    { key: "entity", type: "entity" },
    { key: "status", type: "entity" },
    { key: "state_text", type: "text" },
    { key: "labels", type: "mapping", entity: block.status ?? block.entity },
    { key: "active", type: "entity" },
    { key: "active_state", type: "text", placeholder: "on" },
    { key: "details", type: "entity" },
    { key: "compact", type: "toggle" },
    { key: "fullscreen", type: "toggle" },
    block.card && { key: "card_open", type: "toggle" },
    block.card && block.card_open && { key: "card_last", type: "toggle" },
  ].filter(Boolean);
}

export const statFields = (stat) => [
  { key: "name", type: "text" },
  { key: "entity", type: "entity" },
  { key: "attribute", type: "text", placeholder: "media_title" },
  { key: "unit", type: "text" },
  { key: "digits", type: "number" },
  { key: "format", type: "choice", options: ["", "duration", "hours"] },
  { key: "labels", type: "mapping", entity: stat.entity },
];

export const ACTION_FIELDS = [
  { key: "name", type: "text" },
  { key: "icon", type: "icon" },
  { key: "entity", type: "entity" },
  { key: "service", type: "text", placeholder: "button.press" },
  { key: "confirm", type: "text", label: "editor_field_action_confirm" },
];

export const GROUP_FIELDS = [
  { key: "title", type: "text" },
  { key: "layout", type: "choice", options: ["", "controls", "summary"], label: "editor_field_group_layout", optionKey: "group_layout" },
];

const NUMBER_DOMAINS = ["input_number", "number"];

export function rowFields(row, hass) {
  const list = LIST_DOMAINS.includes(domainOf(row.entity));
  const number = NUMBER_DOMAINS.includes(domainOf(row.entity));
  return [
    { key: "entity", type: "entity" },
    { key: "name", type: "text" },
    { key: "icon", type: "icon" },
    number && { key: "control", type: "choice", options: ["", "stepper"] },
    !list && { key: "attribute", type: "text", placeholder: "media_title" },
    !list && { key: "unit", type: "text" },
    !list && { key: "digits", type: "number" },
    !list && { key: "format", type: "choice", options: ["", "duration", "hours"] },
    list ? { key: "options", type: "options" } : { key: "labels", type: "mapping", entity: row.entity },
  ].filter(Boolean);
}

/** The states an entity can be in, to name them: the options of a list, on and off, or none known. */
export function knownStates(hass, entity) {
  const stateObj = hass?.states?.[entity];
  if (!stateObj) return [];
  if (Array.isArray(stateObj.attributes?.options)) return stateObj.attributes.options;
  if (["binary_sensor", "switch", "input_boolean", "light", "fan"].includes(domainOf(entity))) return ["on", "off"];
  return [];
}

/**
 * The options of a list row after a change in the options editor: `order` only when it differs from the device's,
 * the names that are not empty, the hidden ones; empty keys go.
 */
export function withOptions(row, options, change) {
  const order = change.order ?? orderedOptions(options, row.order);
  const labels = change.labels ?? row.labels ?? {};
  const hide = change.hide ?? row.hide ?? [];
  let next = withField(row, "order", order.join("|") === options.join("|") ? null : order);
  next = withField(next, "labels", Object.fromEntries(Object.entries(labels).filter(([, text]) => text)));
  return withField(next, "hide", hide);
}

export const ROOM_FIELDS = [
  { key: "name", type: "text" },
  { key: "id", type: "text" },
  { key: "areas", type: "areas" },
];

export const SECTION_FIELDS = [
  { key: "title", type: "text" },
  { key: "layout", type: "choice", options: ["", "row"] },
];

/** The value with one key set; an empty text, a false switch or an empty list removes the key. */
export function withField(value, key, next) {
  const copy = { ...value };
  const empty = next === "" || next === false || next === null || next === undefined || (Array.isArray(next) && !next.length);
  const emptyMapping = next && typeof next === "object" && !Array.isArray(next) && !Object.keys(next).length;
  if (empty || emptyMapping) delete copy[key];
  else copy[key] = next;
  return copy;
}

/** A room's id from its name: lower case, no Polish letters, words joined by "_". */
export function slugify(text) {
  const plain = String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase();
  return plain.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "room";
}

export class HomeDashboardEditorProps extends LitElement {
  static properties = {
    hass: { attribute: false },
    node: { attribute: false },
    value: { attribute: false },
    strategy: { attribute: false },
    users: { attribute: false },
  };

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  _emit(value) {
    this.dispatchEvent(new CustomEvent("props-change", { detail: { value } }));
  }

  _set(key, next) {
    this._emit(withField(this.value, key, next));
  }

  get _fields() {
    const value = this.value ?? {};
    if ((this.node?.kind === "tile" || this.node?.kind === "block") && value.kind === "panel") return blockFields(value);
    if (this.node?.kind === "stat") return statFields(value);
    if (this.node?.kind === "action") return ACTION_FIELDS;
    if (this.node?.kind === "panel-group") return GROUP_FIELDS;
    if (this.node?.kind === "row") return rowFields(value, this.hass);
    if (this.node?.kind === "tile") return tileFields(value, this.strategy ?? {});
    if (this.node?.kind === "room") return ROOM_FIELDS;
    if (this.node?.kind === "section" && this.node.path.at(-2) === "sections") return SECTION_FIELDS;
    return [];
  }

  render() {
    if (!this.hass || !this.node || typeof this.value !== "object" || this.value === null) return nothing;
    // A block of another kind than a panel: the fields its kind has on the tablet too (www/app/block-editor.js).
    if (this.node.kind === "block" && this.value.kind !== "panel" && BLOCK_KINDS[this.value.kind]) {
      return html`<home-dashboard-editor-schema
        data-form="block-${this.value.kind}"
        .hass=${this.hass}
        .value=${this.value}
        .path=${this.node.path}
        .fields=${BLOCK_KINDS[this.value.kind]}
        .users=${this.users}
        .shortcuts=${(this.strategy?.shortcuts ?? []).map((block) => block.name).filter(Boolean)}
        @schema-change=${(event) => this._emit({ ...event.detail.value, kind: this.value.kind })}
      ></home-dashboard-editor-schema>`;
    }
    const fields = this._fields;
    // A list (a room's Home, the favourites, the parts of a block): its rows come from the editor, under this.
    const list = this.node.tilesPath || this.node.kind === "block-list" || this.node.key === "favorites";
    if (!fields.length) return list ? nothing : html`<p class="hint" data-no-form>${this._t("editor_no_form")}</p>`;
    return html`<div class="form" data-form=${this.node.kind}>
      ${fields.map((field) => this._renderField(field))}
      ${fields.some((field) => field.type === "entity")
        ? html`<datalist id="hd-entities">
            ${Object.keys(this.hass.states)
              .sort()
              .map((id) => html`<option value=${id}>${this.hass.states[id].attributes?.friendly_name ?? id}</option>`)}
          </datalist>`
        : nothing}
    </div>`;
  }

  _label(field) {
    return html`<span class="label"><span>${this._t(field.label ?? `editor_field_${field.key}`)}</span><code>${field.key}</code></span>`;
  }

  _help(field) {
    const help = translate(this.hass.language, `editor_help_${field.key}`);
    return help === `editor_help_${field.key}` ? nothing : html`<small class="help">${help}</small>`;
  }

  _renderField(field) {
    const value = this.value[field.key];
    const renderers = {
      text: () => this._text(field, value),
      entity: () => this._entity(field, value),
      icon: () => this._icon(field, value),
      toggle: () => this._toggle(field, value),
      choice: () => this._choice(field, value),
      shortcut: () => this._shortcut(field, value),
      column: () => this._column(field, value),
      areas: () => this._areas(field, value),
      labels: () => this._labels(field, value),
      pin: () => this._pin(field, value),
      number: () => this._number(field, value),
      mapping: () => this._mapping(field, value),
      options: () => this._options(field),
    };
    return renderers[field.type]();
  }

  _text(field, value) {
    return html`<label class="field" data-field=${field.key}>
      ${this._label(field)}
      <input
        .value=${value ?? ""}
        placeholder=${field.placeholder ?? ""}
        @change=${(event) => this._set(field.key, event.target.value.trim())}
      />
      ${this._help(field)}
    </label>`;
  }

  _entity(field, value) {
    const known = value && this.hass.states[value];
    return html`<label class="field" data-field=${field.key}>
      ${this._label(field)}
      <input
        list="hd-entities"
        .value=${value ?? ""}
        placeholder="light.living_room"
        @change=${(event) => this._set(field.key, event.target.value.trim())}
      />
      ${value && !known
        ? html`<small class="problem" data-entity-missing>${this._t("editor_problem_no_entity")}</small>`
        : known
          ? html`<small class="help">${known.attributes?.friendly_name ?? value} · ${known.state}</small>`
          : nothing}
    </label>`;
  }

  _icon(field, value) {
    return html`<div class="field" data-field=${field.key}>
      ${this._label(field)}
      <home-dashboard-icon-picker .value=${value ?? ""} placeholder="mdi:lightbulb"
        @icon-change=${(event) => this._set(field.key, event.detail.value)}></home-dashboard-icon-picker>
    </div>`;
  }

  _toggle(field, value) {
    return html`<div class="toggle" data-field=${field.key}>
      <div>${this._label(field)} ${this._help(field)}</div>
      <button
        class="switch ${value ? "on" : ""}"
        role="switch"
        aria-checked=${Boolean(value)}
        @click=${() => this._set(field.key, !value)}
      ></button>
    </div>`;
  }

  _choice(field, value) {
    return html`<div class="field" data-field=${field.key}>
      ${this._label(field)}
      <div class="seg">
        ${field.options.map(
          (option) => html`<button
            class=${(value ?? "") === option ? "on" : ""}
            data-option=${option || "default"}
            @click=${() => this._set(field.key, option)}
          >
            ${this._t(`editor_option_${field.optionKey ?? field.key}_${option || "default"}`)}
          </button>`,
        )}
      </div>
    </div>`;
  }

  _shortcut(field, value) {
    const blocks = this.strategy?.shortcuts ?? [];
    return html`<label class="field" data-field=${field.key}>
      ${this._label(field)}
      <select @change=${(event) => this._set(field.key, event.target.value)}>
        <option value="" ?selected=${!value}>${this._t("editor_option_none")}</option>
        ${blocks.map((block) => html`<option value=${block.name} ?selected=${block.name === value}>${block.name}</option>`)}
      </select>
      ${this._help(field)}
    </label>`;
  }

  _column(field, value) {
    const columns = blockOf(this.strategy ?? {}, this.value)?.columns ?? [];
    return html`<label class="field" data-field=${field.key}>
      ${this._label(field)}
      <select @change=${(event) => this._set(field.key, event.target.value)}>
        <option value="" ?selected=${!value}>${this._t("editor_option_all_machines")}</option>
        ${columns.map((column) => html`<option value=${column.title} ?selected=${column.title === value}>${column.title}</option>`)}
      </select>
    </label>`;
  }

  _areas(field, value) {
    const chosen = new Set(value ?? []);
    const areas = Object.values(this.hass.areas ?? {}).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", this.hass.language));
    return html`<div class="field" data-field=${field.key}>
      ${this._label(field)}
      <div class="chips">
        ${areas.map(
          (area) => html`<button
            class=${chosen.has(area.area_id) ? "on" : ""}
            data-area=${area.area_id}
            @click=${() => {
              const next = new Set(chosen);
              if (next.has(area.area_id)) next.delete(area.area_id);
              else next.add(area.area_id);
              this._set(field.key, [...next]);
            }}
          >
            ${area.name}
          </button>`,
        )}
      </div>
      ${this._help(field)}
    </div>`;
  }

  _labels(field, value) {
    const options = this.hass.states[this.value.entity]?.attributes?.options ?? Object.keys(value ?? {});
    const set = (option, text) => this._set(field.key, withField(value ?? {}, option, text.trim()));
    return html`<div class="field" data-field=${field.key}>
      ${this._label(field)}
      <div class="labels">
        ${options.map(
          (option) => html`<span class="option">${option}</span>
            <input data-label=${option} .value=${value?.[option] ?? ""} placeholder=${option}
              @change=${(event) => set(option, event.target.value)} />`,
        )}
      </div>
      ${this._help(field)}
    </div>`;
  }

  _number(field, value) {
    return html`<label class="field" data-field=${field.key}>
      ${this._label(field)}
      <input
        type="number"
        min="0"
        max="6"
        .value=${value ?? ""}
        @change=${(event) => this._set(field.key, event.target.value === "" ? "" : Number(event.target.value))}
      />
    </label>`;
  }

  /** Own words for states: the states an entity knows, those already named, and one more to type. */
  _mapping(field, value) {
    const known = knownStates(this.hass, field.entity);
    const keys = [...new Set([...known, ...Object.keys(value ?? {})])];
    const set = (state, text) => this._set(field.key, withField(value ?? {}, state, text.trim()));
    return html`<div class="field" data-field=${field.key}>
      ${this._label(field)}
      <div class="labels">
        ${keys.map(
          (state) => html`<span class="option">${state}</span>
            <input data-label=${state} .value=${value?.[state] ?? ""} placeholder=${state}
              @change=${(event) => set(state, event.target.value)} />`,
        )}
        <input data-new-state placeholder=${this._t("editor_new_state")} @change=${(event) => {
          const state = event.target.value.trim();
          event.target.value = "";
          if (state && !keys.includes(state)) set(state, state);
        }} />
      </div>
      ${this._help(field)}
    </div>`;
  }

  /** The options of a list row: their order, own names and which are hidden. */
  _options(field) {
    const options = this.hass.states[this.value.entity]?.attributes?.options ?? [];
    const order = orderedOptions(options, this.value.order);
    const hidden = new Set(this.value.hide ?? []);
    const change = (next) => this._emit(withOptions(this.value, options, next));
    const move = (index, delta) => {
      const next = [...order];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      change({ order: next });
    };
    return html`<div class="field" data-field=${field.key}>
      <span class="label"><span>${this._t("editor_field_options")}</span><code>order · labels · hide</code></span>
      <div class="options">
        ${order.map(
          (option, index) => html`<div class="opt ${hidden.has(option) ? "hidden" : ""}" data-option-row=${option}>
            <button class="mini" data-option-up ?disabled=${index === 0} @click=${() => move(index, -1)}>↑</button>
            <button class="mini" data-option-down ?disabled=${index === order.length - 1} @click=${() => move(index, 1)}>↓</button>
            <span class="option">${option}</span>
            <input data-option-label .value=${this.value.labels?.[option] ?? ""} placeholder=${option}
              @change=${(event) => change({ labels: { ...this.value.labels, [option]: event.target.value.trim() } })} />
            <button class="mini" data-option-hide aria-pressed=${hidden.has(option)}
              @click=${() => change({ hide: hidden.has(option) ? [...hidden].filter((item) => item !== option) : [...hidden, option] })}>
              <ha-icon .icon=${hidden.has(option) ? "mdi:eye-off-outline" : "mdi:eye-outline"}></ha-icon>
            </button>
          </div>`,
        )}
      </div>
      <small class="help">${this._t("editor_help_options")}</small>
    </div>`;
  }

  _pin(field, value) {
    const set = (key, text) => this._set(field.key, withField(value ?? {}, key, text.trim()));
    return html`<div class="field" data-field=${field.key}>
      ${this._label(field)}
      <div class="pair">
        <input data-pin="service" .value=${value?.service ?? ""} placeholder="script.guest_off" @change=${(event) => set("service", event.target.value)} />
        <input data-pin="field" .value=${value?.field ?? ""} placeholder="pin" @change=${(event) => set("field", event.target.value)} />
      </div>
      ${this._help(field)}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
      --mdc-icon-size: 18px;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .label {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      color: var(--muted, #9aa0a6);
    }
    code {
      font-size: 11px;
      color: var(--faint);
    }
    input,
    select {
      box-sizing: border-box;
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--line, #2f343c);
      border-radius: 9px;
      font: inherit;
      color: var(--text, #e8eaed);
      background: var(--panel2, #23272e);
    }
    .with-icon {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .toggle {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--line, #2f343c);
    }
    .switch {
      flex: none;
      position: relative;
      width: 38px;
      height: 22px;
      padding: 0;
      border: 0;
      border-radius: 11px;
      cursor: pointer;
      background: var(--on);
    }
    .switch::after {
      content: "";
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      transition: left 120ms;
    }
    .switch.on {
      background: #34c759;
    }
    .switch.on::after {
      left: 19px;
    }
    .seg,
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .seg button,
    .chips button {
      padding: 5px 10px;
      border: 0;
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      color: var(--muted, #9aa0a6);
      background: var(--panel2, #23272e);
    }
    .seg button.on,
    .chips button.on {
      color: #fff;
      background: rgba(79, 140, 255, 0.45);
    }
    .labels {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
      gap: 6px;
      align-items: center;
    }
    .option {
      overflow: hidden;
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--muted, #9aa0a6);
    }
    .options {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .opt {
      display: grid;
      grid-template-columns: 26px 26px minmax(0, 1fr) minmax(0, 1.3fr) 30px;
      gap: 4px;
      align-items: center;
    }
    .opt.hidden .option,
    .opt.hidden input {
      opacity: 0.4;
    }
    .mini {
      display: grid;
      place-items: center;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 7px;
      font: inherit;
      cursor: pointer;
      color: var(--muted, #9aa0a6);
      background: var(--panel2, #23272e);
    }
    .mini:disabled {
      opacity: 0.3;
      cursor: default;
    }
    .pair {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 6px;
    }
    .help,
    .hint {
      font-size: 12px;
      color: var(--muted, #9aa0a6);
    }
    .problem {
      font-size: 12px;
      color: var(--warn-text);
    }
  `;
}

if (!customElements.get(TAG)) customElements.define(TAG, HomeDashboardEditorProps);
