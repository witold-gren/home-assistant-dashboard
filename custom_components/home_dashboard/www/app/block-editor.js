// The editor of blocks and shortcuts: one form drawn from the description of each kind, so a new
// option needs a line here and no new screen. What the form does not know stays in the block untouched.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const NAMELESS_KINDS = ["media", "menu"];
const TONES = ["green", "purple", "teal", "pink"];
const LAYOUTS = ["controls", "summary"];
const BASE = [
  { key: "name", type: "text" },
  { key: "label", type: "text" },
  { key: "icon", type: "text" },
  { key: "tone", type: "select", options: TONES },
];
const ENTRY = [
  { key: "entity", type: "entity" },
  { key: "name", type: "text" },
];
const VALUE = [
  { key: "name", type: "text" },
  { key: "entity", type: "entity" },
  { key: "unit", type: "text" },
  { key: "digits", type: "number" },
];
const ITEM_FIELDS = {
  entities: [
    { key: "entities", type: "list", fields: ENTRY, scalar: "entity" },
    { key: "state", type: "strings" },
  ],
  below: [
    { key: "entities", type: "list", fields: ENTRY, scalar: "entity" },
    { key: "below", type: "number" },
    { key: "attribute", type: "text" },
    { key: "unit", type: "text" },
  ],
  battery: [
    { key: "below", type: "number" },
    { key: "platforms", type: "strings" },
    { key: "device_has", type: "text" },
  ],
  alarm: [{ key: "classes", type: "strings" }],
  list: [
    {
      key: "list",
      type: "object",
      fields: [
        { key: "entity", type: "entity" },
        { key: "attribute", type: "text" },
        { key: "name", type: "text", label: "field_name" },
        { key: "detail", type: "text" },
        { key: "since", type: "text" },
      ],
    },
  ],
  device: [
    { key: "entity", type: "entity" },
    { key: "state", type: "strings" },
    { key: "labels", type: "yaml" },
    { key: "facts", type: "list", fields: VALUE },
  ],
  text: [{ key: "text", type: "text" }],
};
const ITEM_SEEDS = {
  entities: { entities: [] },
  below: { entities: [], below: "" },
  battery: { auto: "battery", below: 11 },
  alarm: { auto: "alarm", classes: ["moisture"], notify: true },
  list: { list: {} },
  device: { entity: "", state: [] },
  text: { text: "" },
};
const ITEM_COMMON = ["name", "icon", "notify", "weekdays", "months"];

export const BLOCK_KINDS = {
  overview: [
    ...BASE,
    {
      key: "sections",
      type: "list",
      fields: [
        { key: "title", type: "text", label: "title_field" },
        { key: "alert", type: "boolean" },
        { key: "bottom", type: "boolean" },
        { key: "items", type: "list", item: true },
      ],
    },
  ],
  departures: [...BASE, { key: "entities", type: "entities" }, { key: "news", type: "entity" }],
  news: [
    ...BASE,
    {
      key: "sections",
      type: "list",
      fields: [
        { key: "title", type: "text", label: "title_field" },
        { key: "entity", type: "entity" },
      ],
    },
  ],
  app: [...BASE, { key: "addon", type: "text", list: "addons" }, { key: "frame", type: "text" }],
  host: [
    ...BASE,
    {
      key: "columns",
      type: "list",
      fields: [
        { key: "title", type: "text", label: "title_field" },
        { key: "icon", type: "text" },
        { key: "subtitle", type: "text" },
        { key: "status", type: "entity" },
        { key: "bars", type: "list", fields: ENTRY },
        { key: "info", type: "list", fields: [...VALUE, { key: "type", type: "text" }] },
        { key: "machines", type: "yaml" },
        { key: "graph", type: "yaml" },
      ],
    },
  ],
  panel: [
    ...BASE,
    { key: "entity", type: "entity" },
    { key: "fullscreen", type: "boolean" },
    { key: "stats", type: "list", fields: VALUE },
    {
      key: "actions",
      type: "list",
      fields: [
        { key: "name", type: "text" },
        { key: "icon", type: "text" },
        { key: "entity", type: "entity" },
        { key: "service", type: "text" },
        { key: "confirm", type: "text" },
      ],
    },
    {
      key: "groups",
      type: "list",
      fields: [
        { key: "title", type: "text", label: "title_field" },
        { key: "layout", type: "select", options: LAYOUTS },
        { key: "rows", type: "list", fields: [...ENTRY, { key: "icon", type: "text" }] },
      ],
    },
    { key: "card", type: "yaml" },
    { key: "card_open", type: "boolean" },
    { key: "auto_card", type: "boolean" },
    { key: "frame", type: "text" },
  ],
  media: [
    {
      key: "sections",
      type: "list",
      fields: [
        { key: "title", type: "text", label: "title_field" },
        {
          key: "tiles",
          type: "list",
          fields: [
            { key: "name", type: "text" },
            { key: "entity", type: "entity" },
            { key: "icon", type: "text" },
            { key: "kind", type: "select", options: ["tv", "panel"] },
            { key: "on", type: "yaml" },
            { key: "off", type: "yaml" },
          ],
        },
      ],
    },
  ],
  menu: [
    {
      key: "groups",
      type: "list",
      fields: [
        { key: "title", type: "text", label: "title_field" },
        {
          key: "items",
          type: "list",
          fields: [
            { key: "name", type: "text" },
            { key: "icon", type: "text" },
            { key: "addon", type: "text", list: "addons" },
            { key: "path", type: "text", list: "panels" },
            { key: "shortcut", type: "text", list: "shortcuts" },
            { key: "action", type: "select", options: ["notifications"] },
            { key: "admin", type: "boolean" },
            { key: "users", type: "users" },
            { key: "hide_for_guests", type: "boolean" },
          ],
        },
      ],
    },
  ],
  page: [...BASE, { key: "page", type: "select", options: ["media", "energy", "map", "music"] }],
  school: [...BASE, { key: "children", type: "strings" }, { key: "sources", type: "yaml" }],
};
export const NEW_BLOCK_ICONS = {
  overview: "mdi:clipboard-pulse-outline",
  departures: "mdi:tram",
  app: "mdi:application-outline",
  news: "mdi:newspaper-variant-outline",
  host: "mdi:server",
  panel: "mdi:view-dashboard-outline",
  page: "mdi:play-box-multiple-outline",
};

export const itemKind = (item) => {
  if (item.text !== undefined) return "text";
  if (item.list) return "list";
  if (item.auto === "alarm") return "alarm";
  if (item.auto) return "battery";
  if (item.entity !== undefined) return "device";
  return item.below !== undefined ? "below" : "entities";
};

export function withItemKind(item, kind) {
  const kept = Object.fromEntries(ITEM_COMMON.filter((key) => key in item).map((key) => [key, item[key]]));
  return { ...kept, ...ITEM_SEEDS[kind] };
}

// An option left empty is no option, so the saved block looks as if written by hand.
export function cleanBlock(value) {
  if (Array.isArray(value)) return value.map(cleanBlock);
  if (typeof value !== "object" || value === null) return value;
  const kept = Object.entries(value).filter(([, entry]) => entry !== "" && entry !== undefined);
  return Object.fromEntries(kept.map(([key, entry]) => [key, cleanBlock(entry)]));
}

const asList = (value) => (Array.isArray(value) ? value : value === undefined || value === "" ? [] : [value]);
const words = (text, parse = (word) => word) =>
  text.split(",").map((word) => word.trim()).filter(Boolean).map(parse);

export class HomeDashboardBlockEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    removable: { type: Boolean },
    shortcuts: { attribute: false },
    users: { attribute: false },
    _draft: { state: true },
    _yaml: { state: true },
    _broken: { state: true },
    _removing: { state: true },
  };

  async firstUpdated() {
    this._yaml = await import("../vendor/js-yaml.js");
  }

  willUpdate(changed) {
    if (changed.has("item")) {
      this._draft = this.item;
      this._texts = {};
      this._opened = new Set();
      this._broken = [];
    }
  }

  _t(key) {
    return translate(this.hass.language, `block_${key}`);
  }

  _label(field) {
    return this._t(field.label ?? field.key);
  }

  _wrap(field, control) {
    return html`<label class="field" data-block-field=${field.key}><span>${this._label(field)}</span>${control}</label>`;
  }

  _input(field, value, set, type = "text", list = nothing) {
    return this._wrap(
      field,
      html`<input
        type=${type}
        list=${list}
        .value=${value ?? ""}
        @input=${(event) => set(type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)}
      />`,
    );
  }

  _renderYaml(field, value, set, path) {
    const text = this._texts[path] ?? (value === undefined ? "" : this._yaml?.dump(value, { lineWidth: -1, noRefs: true }));
    const change = (event) => {
      this._texts[path] = event.target.value;
      const others = this._broken.filter((item) => item !== path);
      try {
        set(event.target.value.trim() ? this._yaml.load(event.target.value) : "");
        this._broken = others;
      } catch {
        this._broken = [...others, path];
      }
    };
    return html`
      <label class="yaml ${this._broken.includes(path) ? "broken" : ""}" data-block-field=${field.key}>
        <span>${this._label(field)}</span>
        <textarea rows="5" spellcheck="false" .value=${text ?? ""} @input=${change}></textarea>
      </label>
    `;
  }

  _move(list, index, delta, set) {
    const next = [...list];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    set(next);
  }

  _tools(list, index, set) {
    const tool = (icon, key, disabled, run) => html`
      <button aria-label=${this._t(key)} data-block-tool=${key} ?disabled=${disabled} @click=${(event) => {
        event.preventDefault();
        run();
      }}>
        <ha-icon .icon=${icon}></ha-icon>
      </button>
    `;
    return html`
      ${tool("mdi:arrow-up", "up", index === 0, () => this._move(list, index, -1, set))}
      ${tool("mdi:arrow-down", "down", index === list.length - 1, () => this._move(list, index, 1, set))}
      ${tool("mdi:delete-outline", "remove", false, () => set(list.filter((_, position) => position !== index)))}
    `;
  }

  // Nobody ticked means everyone, so an entry does not vanish by itself when a new person arrives.
  _renderUsers(field, value, set) {
    const chosen = asList(value);
    const change = (id, on) => set(on ? [...chosen, id] : chosen.filter((item) => item !== id));
    return html`
      <section class="group" data-block-field=${field.key}>
        <h4>${this._label(field)}</h4>
        <small>${this._t(chosen.length ? "users_some" : "users_all")}</small>
        ${(this.users ?? []).map(
          ({ id, name }) => html`
            <label class="field" data-block-user=${id}>
              <span>${name}</span>
              <input type="checkbox" .checked=${chosen.includes(id)} @change=${(event) => change(id, event.target.checked)} />
            </label>
          `,
        )}
      </section>
    `;
  }

  _renderEntities(field, value, set) {
    const list = asList(value);
    const change = (index, entity) => set(list.map((item, position) => (position === index ? entity : item)));
    return html`
      <section class="group" data-block-field=${field.key}>
        <h4>${this._label(field)}</h4>
        ${list.map(
          (entity, index) => html`
            <div class="entity">
              <input list="entities" .value=${entity} @input=${(event) => change(index, event.target.value)} />
              ${this._tools(list, index, set)}
            </div>
          `,
        )}
        <button class="add" data-block-add=${field.key} @click=${() => set([...list, ""])}>${this._t("add")}</button>
      </section>
    `;
  }

  _remember(path, event) {
    event.stopPropagation();
    if (event.target.open) this._opened.add(path);
    else this._opened.delete(path);
  }

  _title(item, index) {
    const inside = (item.items ?? []).slice(0, 3).map((entry) => entry.name ?? entry.shortcut).filter(Boolean);
    return item.name || item.title || item.entity || item.shortcut || inside.join(", ") || `${index + 1}`;
  }

  _renderList(field, value, set, path) {
    const list = asList(value).map((item) => (typeof item === "string" ? { [field.scalar]: item } : item));
    const change = (index, item) => set(list.map((entry, position) => (position === index ? item : entry)));
    const seed = field.item ? ITEM_SEEDS.entities : {};
    return html`
      <section class="group" data-block-field=${field.key}>
        <h4>${this._label(field)}</h4>
        ${list.map(
          (item, index) => html`
            <details
              ?open=${this._opened.has(`${path}.${index}`)}
              data-block-entry
              @toggle=${(event) => this._remember(`${path}.${index}`, event)}
            >
              <summary>
                <strong>${this._title(item, index)}</strong>
                ${this._tools(list, index, set)}
              </summary>
              <div class="fields">
                ${field.item
                  ? this._renderItem(item, (next) => change(index, next), `${path}.${index}`)
                  : this._fields(field.fields, item, (next) => change(index, next), `${path}.${index}`)}
              </div>
            </details>
          `,
        )}
        <button
          class="add"
          data-block-add=${field.key}
          @click=${() => {
            this._opened.add(`${path}.${list.length}`);
            set([...list, { ...seed }]);
          }}
        >
          ${this._t("add")}
        </button>
      </section>
    `;
  }

  _renderItem(item, set, path) {
    const kind = itemKind(item);
    const fields = [
      { key: "name", type: "text" },
      { key: "icon", type: "text" },
      { key: "notify", type: "boolean" },
      ...ITEM_FIELDS[kind],
      { key: "weekdays", type: "numbers" },
      { key: "months", type: "numbers" },
    ];
    return html`
      <label class="field" data-block-field="kind">
        <span>${this._t("item_kind")}</span>
        <select @change=${(event) => set(withItemKind(item, event.target.value))}>
          ${Object.keys(ITEM_SEEDS).map(
            (key) => html`<option value=${key} ?selected=${key === kind}>${this._t(`item_${key}`)}</option>`,
          )}
        </select>
      </label>
      ${this._fields(fields, item, set, path)}
    `;
  }

  _field(field, value, set, path) {
    if (field.type === "number") return this._input(field, value, set, "number");
    if (field.type === "entity") return this._input(field, value, set, "text", "entities");
    if (field.type === "strings") {
      return this._input(field, asList(value).join(", "), (text) => set(words(text)));
    }
    if (field.type === "numbers") {
      return this._input(field, asList(value).join(", "), (text) => set(words(text, Number).filter(Number.isFinite)));
    }
    if (field.type === "boolean") {
      return this._wrap(
        field,
        html`<input type="checkbox" .checked=${Boolean(value)} @change=${(event) => set(event.target.checked || "")} />`,
      );
    }
    if (field.type === "select") {
      return this._wrap(
        field,
        html`<select @change=${(event) => set(event.target.value)}>
          <option value="" ?selected=${!value}></option>
          ${field.options.map((option) => html`<option value=${option} ?selected=${option === value}>${option}</option>`)}
        </select>`,
      );
    }
    if (field.type === "yaml") return this._renderYaml(field, value, set, path);
    if (field.type === "entities") return this._renderEntities(field, value, set);
    if (field.type === "users") return this._renderUsers(field, value, set);
    if (field.type === "list") return this._renderList(field, value, set, path);
    if (field.type === "object") return html`<div class="fields">${this._fields(field.fields, value ?? {}, set, path)}</div>`;
    return this._input(field, value, set, "text", field.list ?? nothing);
  }

  _fields(fields, values, set, path) {
    return fields.map((field) =>
      this._field(field, values[field.key], (value) => set({ ...values, [field.key]: value }), `${path}.${field.key}`),
    );
  }

  _save() {
    this.dispatchEvent(new CustomEvent("block-save", { detail: { item: cleanBlock(this._draft) } }));
  }

  render() {
    if (!this.hass || !this._draft || !this._yaml) return nothing;
    const fields = BLOCK_KINDS[this._draft.kind] ?? BASE;
    return html`
      <datalist id="entities">${Object.keys(this.hass.states).map((id) => html`<option value=${id}></option>`)}</datalist>
      <datalist id="panels">
        ${Object.values(this.hass.panels ?? {}).map(({ url_path: path }) => html`<option value=${`/${path}`}></option>`)}
      </datalist>
      <datalist id="addons">
        ${Object.values(this.hass.panels ?? {})
          .filter(({ config }) => config?.addon)
          .map(({ config }) => html`<option value=${config.addon}></option>`)}
      </datalist>
      <datalist id="shortcuts">${(this.shortcuts ?? []).map((name) => html`<option value=${name}></option>`)}</datalist>
      <div class="fields top">
        ${this._fields(fields, this._draft, (next) => (this._draft = next), "block")}
        <button
          class="save"
          data-block-save
          ?disabled=${(!NAMELESS_KINDS.includes(this._draft.kind) && !this._draft.name?.trim()) || this._broken.length > 0}
          @click=${this._save}
        >
          ${translate(this.hass.language, "save")}
        </button>
        ${this.removable
          ? html`<button
              class="remove"
              data-block-remove
              @click=${() => {
                if (this._removing) this.dispatchEvent(new CustomEvent("block-remove"));
                this._removing = true;
              }}
            >
              ${this._t(this._removing ? "remove_sure" : "remove_block")}
            </button>`
          : nothing}
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
      button[disabled] {
        opacity: 0.3;
        pointer-events: none;
      }
      .fields {
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: var(--hd-text);
      }
      .top {
        max-width: 720px;
        margin: 0 auto;
        padding: 0 16px 16px;
      }
      .field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 48px;
        padding: 4px 12px;
        border-radius: 12px;
        background: var(--hd-off);
        font-size: 14px;
      }
      .field > span {
        flex: none;
        max-width: 45%;
      }
      input:not([type="checkbox"]),
      select,
      textarea {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        padding: 8px 10px;
        border: 1px solid var(--hd-outline);
        border-radius: 10px;
        color: var(--hd-text);
        background: var(--hd-surface);
        font: inherit;
      }
      .field input:not([type="checkbox"]),
      .field select {
        flex: 1;
      }
      .yaml {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 12px;
        border-radius: 12px;
        background: var(--hd-off);
        font-size: 14px;
      }
      textarea {
        resize: vertical;
        font-family: monospace;
        font-size: 13px;
      }
      .yaml.broken textarea {
        border-color: var(--hd-security-ink);
      }
      .group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      small {
        color: var(--hd-text-muted);
        font-size: 13px;
      }
      h4 {
        margin: 8px 0 0;
        font-size: 15px;
        font-weight: 500;
      }
      details {
        padding: 4px 8px;
        border: 1px solid var(--hd-outline);
        border-radius: 14px;
      }
      details > .fields {
        padding: 4px 0 8px;
      }
      summary {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 44px;
        list-style: none;
        cursor: pointer;
      }
      summary::-webkit-details-marker {
        display: none;
      }
      summary strong {
        flex: 1;
        min-width: 0;
        font-size: 14px;
        font-weight: 500;
        overflow-wrap: anywhere;
      }
      [data-block-tool] {
        display: grid;
        flex: none;
        place-items: center;
        width: 36px;
        height: 36px;
        --mdc-icon-size: 20px;
      }
      .entity {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .add,
      .save,
      .remove {
        padding: 12px;
        border-radius: 12px;
        font-size: 14px;
        text-align: center;
        background: var(--hd-off);
      }
      .save {
        margin-top: 8px;
        color: #ffffff;
        background: var(--hd-appliance-icon);
      }
      .remove {
        color: var(--hd-security-ink);
        background: var(--hd-security);
      }
    `,
  ];
}
