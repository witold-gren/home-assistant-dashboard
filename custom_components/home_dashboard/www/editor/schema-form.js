// A form drawn from a schema of fields, the same schema the tablet's block form uses (www/app/block-editor.js), so a
// block has the same fields on the tablet and in the editor: plain fields, lists of entries with fields of their own,
// the entries of a Status screen with their kind, and YAML for what has no form. Every change goes to the draft at
// once (`schema-change`); a field left empty removes its key, and keys the schema does not know are kept.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { ITEM_SEEDS, cleanBlock, emptied, itemFields as tabletItemFields, itemKind, withItemKind } from "../app/block-editor.js";
import "../app/background-maker.js";
import { isPicture } from "../app/background-field.js";
import "../app/icon-picker.js";
import { translate } from "../app/i18n.js";

const TAG = "home-dashboard-editor-schema";

const asList = (value) => (Array.isArray(value) ? value : value === undefined || value === "" || value === null ? [] : [value]);
const moved = (list, index, delta) => {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item);
  return next;
};
const words = (text, parse = (word) => word) =>
  String(text)
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean)
    .map(parse);

/** The fields of an entry of a Status screen: its kind decides them (www/app/block-editor.js). */
export function itemFields(item) {
  return tabletItemFields(item).map((field) => (field.key === "icon" ? { ...field, type: "icon" } : field));
}

/** What a collapsed entry of a list is called: its name, title, entity, or what is in it. */
export function entryTitle(item, index) {
  if (typeof item !== "object" || item === null) return String(item ?? index + 1);
  const inside = asList(item.items)
    .slice(0, 3)
    .map((entry) => entry?.name ?? entry?.shortcut)
    .filter(Boolean);
  return item.name || item.title || item.entity || item.shortcut || inside.join(", ") || `${index + 1}`;
}

export class HomeDashboardEditorSchema extends LitElement {
  static properties = {
    hass: { attribute: false },
    // The value the form shows, and the path it lives at (opened entries are kept per path).
    value: { attribute: false },
    path: { attribute: false },
    fields: { attribute: false },
    users: { attribute: false },
    shortcuts: { attribute: false },
    _texts: { state: true },
    _broken: { state: true },
    _yaml: { state: true },
    _makerAt: { state: true },
  };

  constructor() {
    super();
    this._texts = {};
    this._broken = [];
    this._opened = new Set();
  }

  async firstUpdated() {
    this._yaml = await import("../vendor/js-yaml.js");
  }

  willUpdate(changed) {
    if (changed.has("path") && String(changed.get("path")) !== String(this.path)) {
      this._texts = {};
      this._broken = [];
      this._opened = new Set();
    }
  }

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  // Settings name their fields with keys of their own (`labelKey`, `helpKey`); blocks with those of the tablet's form.
  _name(field) {
    return field.labelKey ? this._t(field.labelKey) : this._t(`block_${field.label ?? field.key}`);
  }

  _help(field) {
    return field.helpKey ? html`<small class="help">${this._t(field.helpKey)}</small>` : nothing;
  }

  _emit(value) {
    this.dispatchEvent(new CustomEvent("schema-change", { detail: { value: cleanBlock(value) } }));
  }

  _label(field) {
    return html`<span class="label"><span>${this._name(field)}</span><code>${field.key}</code></span>${this._help(field)}`;
  }

  _field(field, value, set, path) {
    const renderers = {
      number: () => this._input(field, value, set, path, "number"),
      colour: () => this._colour(field, value, set, path),
      background: () => this._background(field, value, set, path),
      map: () => this._map(field, value, set, path),
      keyed: () => this._keyed(field, value, set, path),
      areas: () => this._areas(field, value, set, path),
      choices: () => this._choices(field, value, set, path),
      order: () => this._order(field, value, set, path),
      entity: () => this._input(field, value, set, path, "text", "entities"),
      icon: () => this._icon(field, value, set, path),
      strings: () => this._input(field, asList(value).join(", "), (text) => set(words(text)), path),
      numbers: () => this._input(field, asList(value).join(", "), (text) => set(words(text, Number).filter(Number.isFinite)), path),
      boolean: () => this._toggle(field, value, set, path),
      select: () => this._select(field, value, set, path),
      yaml: () => this._yamlField(field, value, set, path),
      lines: () => this._lines(field, value, set, path),
      entities: () => this._entities(field, value, set, path),
      users: () => this._users(field, value, set, path),
      list: () => this._list(field, value, set, path),
      object: () => {
        // A plain text stands for both looks of a background; a field changed writes them apart.
        const values = field.bothFromText && typeof value === "string" ? { light: value, dark: value } : value ?? {};
        return html`<div class="object" data-schema-field=${path}>
          ${this._label(field)}
          <div class="fields">${this._fields(field.title ? field.fields.map((inner) => ({ ...inner, title: field.title })) : field.fields, values, (next) => set(emptied(field, next)), path)}</div>
          ${field.maker ? this._maker(field, values, set, path) : nothing}
        </div>`;
      },
    };
    return (renderers[field.type] ?? (() => this._input(field, value, set, path, "text", field.list)))();
  }

  _fields(fields, values, set, path) {
    return fields.map((field) =>
      this._field(field, values?.[field.key], (next) => set({ ...values, [field.key]: next }), `${path}.${field.key}`),
    );
  }

  _input(field, value, set, path, type = "text", list = null) {
    // A text holding a picture's address gets a magnifier that opens it big.
    const peek = type === "text" && isPicture(value);
    return html`<label class="field ${peek ? "with-peek" : ""}" data-schema-field=${path}>
      ${this._label(field)}
      <input
        type=${type}
        list=${list ?? nothing}
        min=${field.min ?? nothing}
        max=${field.max ?? nothing}
        placeholder=${field.placeholder ?? nothing}
        .value=${value ?? ""}
        @change=${(event) => {
          const text = event.target.value;
          set(type === "number" && text !== "" ? Number(text) : text.trim());
        }}
      />
      ${peek ? html`<home-dashboard-picture-peek .hass=${this.hass} .src=${value}></home-dashboard-picture-peek>` : nothing}
    </label>`;
  }

  // A background made from a pattern, a gradient and a photo: a button, then the maker over the whole editor.
  _maker(field, values, set, path) {
    return html`<button class="add" data-schema-maker=${path} @click=${() => (this._makerAt = path)}>
        <ha-icon icon="mdi:auto-fix"></ha-icon>${this._t("maker_open")}
      </button>
      ${this._makerAt === path
        ? html`<div class="maker-dialog" data-schema-maker-dialog @click=${(event) => event.target === event.currentTarget && (this._makerAt = null)}>
            <div class="maker-box">
              <h3><ha-icon icon="mdi:auto-fix"></ha-icon>${this._t("maker_title")}${field.title ? html`<span> · ${field.title}</span>` : nothing}</h3>
              <home-dashboard-background-maker
                layout="wide"
                .hass=${this.hass}
                heading=${field.title ?? ""}
                look="light"
                @maker-done=${(event) => {
                  this._makerAt = null;
                  set(emptied(field, { ...values, ...event.detail.slots }));
                }}
                @maker-cancel=${() => (this._makerAt = null)}
              ></home-dashboard-background-maker>
            </div>
          </div>`
        : nothing}`;
  }

  // Texts a line each (patterns may hold commas): empty lines go, and no line at all is no option.
  _lines(field, value, set, path) {
    const text = asList(value).join("\n");
    return html`<label class="field" data-schema-field=${path}>
      ${this._label(field)}
      <textarea rows="3" spellcheck="false" placeholder=${field.placeholder ?? nothing} .value=${text}
        @change=${(event) => {
          const lines = event.target.value.split("\n").map((line) => line.trim()).filter(Boolean);
          set(lines.length ? lines : "");
        }}></textarea>
    </label>`;
  }

  // A background: a picture, a colour or a gradient, chosen in a window or written by hand.
  _background(field, value, set, path) {
    return html`<div class="field" data-schema-field=${path}>
      ${this._label(field)}
      <home-dashboard-background-field .hass=${this.hass} .value=${value ?? ""} placeholder=${field.placeholder ?? ""}
        heading=${[field.title, this._name(field)].filter(Boolean).join(" · ")}
        @background-change=${(event) => set(event.detail.value)}></home-dashboard-background-field>
    </div>`;
  }

  // A colour, or none: then the look's own colour applies.
  _colour(field, value, set, path) {
    return html`<div class="field" data-schema-field=${path}>
      ${this._label(field)}
      <span class="row">
        <input type="color" class="swatch ${value ? "" : "unset"}" .value=${/^#[0-9a-f]{6}/i.test(value ?? "") ? value.slice(0, 7) : "#000000"}
          @change=${(event) => set(event.target.value)} />
        <input .value=${value ?? ""} placeholder=${this._t("editor_schema_colour_none")} @change=${(event) => set(event.target.value.trim())} />
        <button class="mini" data-schema-clear ?disabled=${!value} @click=${() => set("")}>×</button>
      </span>
    </div>`;
  }

  // A mapping of an entity to a value (an icon for a device): a row each, and one more to add.
  _map(field, value, set, path) {
    const entries = Object.entries(value && typeof value === "object" ? value : {});
    const keyList = field.keyList ?? "entities";
    const write = (next) => set(emptied(field, Object.fromEntries(next.filter(([key, entry]) => key && entry))));
    // A new row is added once its key and its value are there (a value to start with stands in for the latter).
    const add = (event) => {
      const row = event.target.closest(".row");
      const [keyInput, valueInput] = row.querySelectorAll("input");
      const key = keyInput.value.trim();
      const entry = valueInput.value.trim() || field.seed || "";
      if (!key || !entry || entries.some(([old]) => old === key)) return;
      keyInput.value = "";
      valueInput.value = "";
      set({ ...Object.fromEntries(entries), [key]: entry });
    };
    return html`<div class="group" data-schema-field=${path}>
      ${this._label(field)}
      ${entries.map(
        ([key, entry], index) => html`<div class="row" data-schema-map=${key}>
          <input list=${keyList || nothing} .value=${key}
            @change=${(event) => write(entries.map((pair, at) => (at === index ? [event.target.value.trim(), pair[1]] : pair)))} />
          ${field.valueIcon
            ? html`<home-dashboard-icon-picker .value=${String(entry)} placeholder=${field.placeholder ?? ""}
                @icon-change=${(event) => write(entries.map((pair, at) => (at === index ? [pair[0], event.detail.value] : pair)))}></home-dashboard-icon-picker>`
            : html`<input list=${field.valueList ?? nothing} .value=${String(entry)} placeholder=${field.placeholder ?? ""}
                @change=${(event) => write(entries.map((pair, at) => (at === index ? [pair[0], event.target.value.trim()] : pair)))} />`}
          <button class="mini" data-schema-remove @click=${() => write(entries.filter((_, at) => at !== index))}>×</button>
        </div>`,
      )}
      <div class="row" data-schema-new=${path}>
        <input list=${keyList || nothing} data-schema-add=${path} placeholder=${this._t(field.keyPlaceholder ? `block_${field.keyPlaceholder}` : "editor_schema_add_entity")} @change=${add} />
        <input list=${field.valueList ?? nothing} data-schema-add-value placeholder=${field.placeholder ?? ""} @change=${add} />
      </div>
    </div>`;
  }

  // Settings of single entities (a camera and its buttons): an entry each, unfolded to its fields, and one to add.
  _keyed(field, value, set, path) {
    const entries = Object.entries(value && typeof value === "object" ? value : {});
    const write = (next) => set(Object.fromEntries(next));
    return html`<div class="group" data-schema-field=${path}>
      ${this._label(field)}
      ${entries.map(([key, entry], index) => {
        const at = `${path}.${key}`;
        return html`<details
          ?open=${this._opened.has(at)}
          data-schema-entry=${at}
          @toggle=${(event) => {
            event.stopPropagation();
            if (event.target.open) this._opened.add(at);
            else this._opened.delete(at);
          }}
        >
          <summary>
            <strong>${field.keyLabels?.[key] ?? this.hass.states[key]?.attributes?.friendly_name ?? key}</strong>
            <span class="tools">
              <button class="mini" data-schema-remove @click=${(event) => (event.preventDefault(), write(entries.filter((_, at2) => at2 !== index)))}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>
              </button>
            </span>
          </summary>
          <div class="fields">
            ${this._field(
              { ...field.valueField, title: field.keyLabels?.[key] ?? this.hass.states[key]?.attributes?.friendly_name ?? key },
              entry,
              (next) => write(entries.map((pair, at2) => (at2 === index ? [key, next] : pair))),
              at,
            )}
          </div>
        </details>`;
      })}
      ${field.keyOptions
        ? html`<datalist id=${`keys${path}`}>${field.keyOptions.map((option) => html`<option value=${option}></option>`)}</datalist>`
        : nothing}
      <input
        list=${field.keyOptions ? `keys${path}` : "entities"}
        data-schema-add=${path}
        placeholder=${this._t(field.addKey ?? "editor_schema_add_entity")}
        @change=${(event) => {
          const key = event.target.value.trim();
          event.target.value = "";
          if (!key || entries.some(([old]) => old === key)) return;
          this._opened.add(`${path}.${key}`);
          write([...entries, [key, structuredClone(field.seed ?? {})]]);
        }}
      />
    </div>`;
  }

  // Some of a list of options to tick (rooms to hide), by their names.
  _choices(field, value, set, path) {
    const chosen = asList(value);
    return html`<div class="group" data-schema-field=${path}>
      ${this._label(field)}
      <div class="chips">
        ${field.options.map(
          (option) => html`<button
            class=${chosen.includes(option) ? "on" : ""}
            data-schema-choice=${option}
            @click=${() => set(chosen.includes(option) ? chosen.filter((item) => item !== option) : [...chosen, option])}
          >
            ${field.labels?.[option] ?? option}
          </button>`,
        )}
      </div>
    </div>`;
  }

  // Areas of Home Assistant to tick, by their names; their ids are written.
  _areas(field, value, set, path) {
    const chosen = asList(value);
    const areas = Object.values(this.hass.areas ?? {}).sort((a, b) => String(a.name).localeCompare(String(b.name), this.hass.language));
    return html`<div class="group" data-schema-field=${path}>
      ${this._label(field)}
      <div class="chips">
        ${areas.map(
          (area) => html`<button
            class=${chosen.includes(area.area_id) ? "on" : ""}
            data-schema-area=${area.area_id}
            @click=${() => set(chosen.includes(area.area_id) ? chosen.filter((id) => id !== area.area_id) : [...chosen, area.area_id])}
          >
            ${area.name}
          </button>`,
        )}
      </div>
    </div>`;
  }

  // Some of the options, in an order: the chosen ones first, in theirs, each moved by arrows; the others to add.
  _order(field, value, set, path) {
    const chosen = asList(value).filter((option) => field.options.includes(option));
    const fallback = field.defaults ?? (field.allByDefault ? field.options : []);
    const shown = chosen.length ? chosen : [...fallback];
    const full = field.max !== undefined && shown.length >= field.max;
    const rest = full ? [] : field.options.filter((option) => !shown.includes(option));
    const name = (option) => field.labels?.[option] ?? this._t(`${field.optionKey}_${option}`);
    // Fewer than the least it takes: nothing can be taken away.
    const tools = (index) =>
      field.min !== undefined && shown.length <= field.min
        ? html`<span class="tools">
            <button class="mini" data-schema-up ?disabled=${index === 0} @click=${() => set(moved(shown, index, -1))}>↑</button>
            <button class="mini" data-schema-down ?disabled=${index === shown.length - 1} @click=${() => set(moved(shown, index, 1))}>↓</button>
          </span>`
        : this._tools(shown, index, set);
    return html`<div class="group" data-schema-field=${path}>
      ${this._label(field)}
      ${shown.map(
        (option, index) => html`<div class="row order" data-schema-option=${option}>
          <span class="grow">${name(option)}</span>
          ${tools(index)}
        </div>`,
      )}
      ${rest.length
        ? html`<div class="chips">
            ${rest.map((option) => html`<button data-schema-option-add=${option} @click=${() => set([...shown, option])}>+ ${name(option)}</button>`)}
          </div>`
        : nothing}
    </div>`;
  }

  _icon(field, value, set, path) {
    return html`<div class="field" data-schema-field=${path}>
      ${this._label(field)}
      <home-dashboard-icon-picker .value=${value ?? ""} placeholder=${field.placeholder ?? "mdi:lightbulb"}
        @icon-change=${(event) => set(event.detail.value)}></home-dashboard-icon-picker>
    </div>`;
  }

  // A switch shows its default while unset; going back to the default takes the key out.
  _toggle(field, value, set, path) {
    const fallback = field.default ?? false;
    const on = Boolean(value ?? fallback);
    return html`<div class="toggle" data-schema-field=${path}>
      <div>${this._label(field)}</div>
      <button class="switch ${on ? "on" : ""}" role="switch" aria-checked=${on} @click=${() => set(!on === fallback ? "" : !on)}></button>
    </div>`;
  }

  _select(field, value, set, path) {
    return html`<label class="field" data-schema-field=${path}>
      ${this._label(field)}
      <select @change=${(event) => set(field.numeric && event.target.value !== "" ? Number(event.target.value) : event.target.value)}>
        <option value="" ?selected=${value === undefined || value === null || value === ""}>${field.emptyKey ? this._t(field.emptyKey) : ""}</option>
        ${field.options.map(
          (option) => html`<option value=${option} ?selected=${option === String(value)}>${field.optionKey ? this._t(`${field.optionKey}_${option}`) : option}</option>`,
        )}
      </select>
    </label>`;
  }

  _yamlField(field, value, set, path) {
    const text = this._texts[path] ?? (value === undefined ? "" : this._yaml?.dump(value, { lineWidth: -1, noRefs: true }));
    return html`<label class="field ${this._broken.includes(path) ? "broken" : ""}" data-schema-field=${path}>
      ${this._label(field)}
      <textarea
        rows="4"
        spellcheck="false"
        .value=${text ?? ""}
        @input=${(event) => {
          this._texts = { ...this._texts, [path]: event.target.value };
          const others = this._broken.filter((item) => item !== path);
          try {
            const parsed = event.target.value.trim() ? this._yaml.load(event.target.value) : "";
            this._broken = others;
            set(parsed);
          } catch {
            this._broken = [...others, path];
          }
        }}
      ></textarea>
      ${this._broken.includes(path) ? html`<small class="problem">${this._t("editor_yaml_broken")}</small>` : nothing}
    </label>`;
  }

  _tools(list, index, set) {
    const move = (delta) => {
      const next = [...list];
      const [moved] = next.splice(index, 1);
      next.splice(index + delta, 0, moved);
      set(next);
    };
    return html`<span class="tools">
      <button class="mini" data-schema-up ?disabled=${index === 0} @click=${(event) => (event.preventDefault(), move(-1))}>↑</button>
      <button class="mini" data-schema-down ?disabled=${index === list.length - 1} @click=${(event) => (event.preventDefault(), move(1))}>↓</button>
      <button class="mini" data-schema-remove @click=${(event) => (event.preventDefault(), set(list.filter((_, at) => at !== index)))}>
        <ha-icon icon="mdi:delete-outline"></ha-icon>
      </button>
    </span>`;
  }

  _entities(field, value, set, path) {
    const list = asList(value);
    // `domain` keeps the suggestions to one kind (the calendars).
    const suggestions = field.domain ? `entities-${field.domain}` : "entities";
    return html`<div class="group" data-schema-field=${path}>
      ${this._label(field)}
      ${field.domain
        ? html`<datalist id=${suggestions}>
            ${Object.keys(this.hass.states)
              .filter((id) => id.startsWith(`${field.domain}.`))
              .sort()
              .map((id) => html`<option value=${id}>${this.hass.states[id].attributes?.friendly_name ?? id}</option>`)}
          </datalist>`
        : nothing}
      ${list.map(
        (entity, index) => html`<div class="row">
          <input
            list=${suggestions}
            .value=${entity}
            @change=${(event) => set(list.map((item, at) => (at === index ? event.target.value.trim() : item)))}
          />
          ${this._tools(list, index, set)}
        </div>`,
      )}
      <input
        list=${suggestions}
        data-schema-add=${path}
        placeholder=${this._t("editor_schema_add_entity")}
        @change=${(event) => {
          const entity = event.target.value.trim();
          event.target.value = "";
          if (entity) set([...list, entity]);
        }}
      />
    </div>`;
  }

  // Nobody ticked means everyone, so an entry does not vanish by itself when a new person arrives.
  _users(field, value, set, path) {
    const chosen = asList(value);
    return html`<div class="group" data-schema-field=${path}>
      ${this._label(field)}
      <small class="help">${this._t(chosen.length ? "block_users_some" : "block_users_all")}</small>
      <div class="chips">
        ${(this.users ?? []).map(
          ({ id, name }) => html`<button
            class=${chosen.includes(id) ? "on" : ""}
            data-schema-user=${id}
            @click=${() => set(chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id])}
          >
            ${name}
          </button>`,
        )}
      </div>
    </div>`;
  }

  _list(field, value, set, path) {
    const list = asList(value).map((item) => (typeof item === "string" && field.scalar ? { [field.scalar]: item } : item));
    // An entry with nothing but its entity is written as the entity alone, as by hand.
    const plain = (entry) => {
      const kept = cleanBlock(entry);
      const keys = field.scalar && kept && typeof kept === "object" ? Object.keys(kept) : [];
      return keys.length === 1 && keys[0] === field.scalar ? kept[field.scalar] : entry;
    };
    const change = (index, item) => set(list.map((entry, at) => plain(at === index ? item : entry)));
    const seed = field.item ? ITEM_SEEDS.entities : {};
    return html`<div class="group" data-schema-field=${path}>
      ${this._label(field)}
      ${list.map((item, index) => {
        const at = `${path}.${index}`;
        return html`<details
          ?open=${this._opened.has(at)}
          data-schema-entry=${at}
          @toggle=${(event) => {
            event.stopPropagation();
            if (event.target.open) this._opened.add(at);
            else this._opened.delete(at);
          }}
        >
          <summary><strong>${entryTitle(item, index)}</strong>${this._tools(list, index, set)}</summary>
          <div class="fields">
            ${field.item ? this._item(item, (next) => change(index, next), at) : this._fields(field.fields, item, (next) => change(index, next), at)}
          </div>
        </details>`;
      })}
      <button
        class="add"
        data-schema-add=${path}
        @click=${() => {
          this._opened.add(`${path}.${list.length}`);
          set([...list, { ...seed }]);
        }}
      >
        <ha-icon icon="mdi:plus"></ha-icon>${this._t("block_add")}
      </button>
    </div>`;
  }

  _item(item, set, path) {
    const kind = itemKind(item);
    return html`<label class="field" data-schema-field=${`${path}.kind`}>
        <span class="label"><span>${this._t("block_item_kind")}</span></span>
        <select @change=${(event) => set(withItemKind(item, event.target.value))}>
          ${Object.keys(ITEM_SEEDS).map((key) => html`<option value=${key} ?selected=${key === kind}>${this._t(`block_item_${key}`)}</option>`)}
        </select>
      </label>
      ${this._fields(itemFields(item), item, set, path)}`;
  }

  render() {
    if (!this.hass || !this.fields || !this._yaml) return nothing;
    const value = this.value && typeof this.value === "object" ? this.value : {};
    return html`<datalist id="entities">${Object.keys(this.hass.states).sort().map((id) => html`<option value=${id}></option>`)}</datalist>
      <datalist id="panels">
        ${Object.values(this.hass.panels ?? {}).map(({ url_path: urlPath }) => html`<option value=${`/${urlPath}`}></option>`)}
      </datalist>
      <datalist id="addons">
        ${Object.values(this.hass.panels ?? {})
          .filter(({ config }) => config?.addon)
          .map(({ config }) => html`<option value=${config.addon}></option>`)}
      </datalist>
      <datalist id="shortcuts">${(this.shortcuts ?? []).map((name) => html`<option value=${name}></option>`)}</datalist>
      <div class="form" data-schema-form>${this._fields(this.fields, value, (next) => this._emit(next), "")}</div>`;
  }

  static styles = css`
    :host {
      display: block;
      --mdc-icon-size: 18px;
    }
    .maker-dialog {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: grid;
      place-items: stretch;
      padding: 24px;
      background: rgba(0, 0, 0, 0.6);
    }
    .maker-box {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 14px;
      min-height: 0;
      padding: 18px 20px;
      border: 1px solid var(--line, #2f343c);
      border-radius: 16px;
      background: var(--panel, #1b1e24);
    }
    .maker-box h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 16px;
    }
    .maker-box h3 span {
      font-weight: 400;
      color: var(--muted, #9aa0a6);
    }
    .form,
    .fields {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .field,
    .group,
    .object {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    /* A picture's address with its magnifier beside it. */
    .field.with-peek {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 5px 6px;
    }
    .field.with-peek > :not(input) {
      grid-column: 1 / -1;
    }
    .field.with-peek > input {
      grid-column: 1;
    }
    .group,
    .object {
      padding: 10px;
      border: 1px solid var(--line, #2f343c);
      border-radius: 10px;
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
    select,
    textarea {
      box-sizing: border-box;
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--line, #2f343c);
      border-radius: 9px;
      font: inherit;
      color: var(--text, #e8eaed);
      background: var(--panel2, #23272e);
    }
    textarea {
      font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
      resize: vertical;
    }
    .broken textarea {
      border-color: var(--amber);
    }
    .grow {
      flex: 1;
    }
    .row.order {
      padding: 4px 8px;
      border-radius: 8px;
      background: var(--hover);
    }
    input.swatch.unset {
      opacity: 0.35;
    }
    input.swatch {
      flex: none;
      width: 38px;
      height: 34px;
      padding: 2px;
    }
    .with-icon,
    .row {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .toggle {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
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
    details {
      border-radius: 9px;
      background: var(--hover);
    }
    details > .fields {
      padding: 4px 10px 10px;
    }
    summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      cursor: pointer;
    }
    summary strong {
      overflow: hidden;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tools {
      display: flex;
      flex: none;
      gap: 4px;
    }
    .mini {
      display: grid;
      place-items: center;
      min-width: 26px;
      height: 26px;
      padding: 0 4px;
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
    .add {
      display: inline-flex;
      align-self: flex-start;
      gap: 6px;
      align-items: center;
      padding: 6px 10px;
      border: 0;
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      color: var(--text, #e8eaed);
      background: var(--panel2, #23272e);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
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
    .chips button.on {
      color: #fff;
      background: rgba(79, 140, 255, 0.45);
    }
    .help {
      font-size: 12px;
      color: var(--muted, #9aa0a6);
    }
    .problem {
      font-size: 12px;
      color: var(--warn-text);
    }
  `;
}

if (!customElements.get(TAG)) customElements.define(TAG, HomeDashboardEditorSchema);
