// The phones and tablets of the preview as a person keeps them: the built-in models (Apple's), each of which can be
// renamed, resized or hidden, and their own devices of any make, added with a name and a size. Kept in the browser,
// as the editor's look and the model chosen are; the window is under the gear in the top bar.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "../app/i18n.js";

export const DEVICES_KEY = "home-dashboard-editor-devices";
export const KINDS = ["phone", "tablet"];
// A screen in points: at least a small watch-like phone, at most a large wall panel.
export const SIZE_LIMITS = { min: 200, max: 3000 };

/** What is kept: `{ phone: { key: { name, width, height, hidden, custom } }, tablet: { … } }`, only the changes. */
export function readDevicePrefs(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(DEVICES_KEY) ?? "{}");
    return Object.fromEntries(KINDS.map((kind) => [kind, saved?.[kind] && typeof saved[kind] === "object" ? saved[kind] : {}]));
  } catch {
    return { phone: {}, tablet: {} };
  }
}

export function writeDevicePrefs(prefs, storage = globalThis.localStorage) {
  try {
    storage?.setItem(DEVICES_KEY, JSON.stringify(prefs));
  } catch {
    // A browser that keeps nothing still shows the changes until the page is closed.
  }
}

/** A size kept within the limits, upright for a phone and on its side for a tablet. */
export function screenOf(kind, width, height) {
  const fit = (value) => Math.round(Math.min(SIZE_LIMITS.max, Math.max(SIZE_LIMITS.min, Number(value) || 0)));
  const [a, b] = [fit(width), fit(height)];
  return kind === "phone" ? { width: Math.min(a, b), height: Math.max(a, b) } : { width: Math.max(a, b), height: Math.min(a, b) };
}

/** A label without the size at its end ("iPad mini 6–7 · 1133 × 744" → "iPad mini 6–7"). */
export const nameOf = (label) => String(label ?? "").replace(/\s*·\s*\d+\s*×\s*\d+\s*$/, "").trim();

/**
 * Every device of a kind, built-in ones first in their order and then a person's own: `{ key, name, width, height,
 * label, hidden, custom, changed }`; the label is the name with the size, as the built-in ones have it.
 */
export function deviceList(builtIn, prefs, kind) {
  const own = prefs?.[kind] ?? {};
  const entry = (key, base, change = {}, custom = false) => {
    const name = change.name ?? nameOf(base.label) ?? key;
    const width = change.width ?? base.width;
    const height = change.height ?? base.height;
    return {
      key,
      name,
      width,
      height,
      label: `${name} · ${width} × ${height}`,
      hidden: Boolean(change.hidden),
      custom,
      changed: !custom && ["name", "width", "height"].some((field) => change[field] !== undefined),
    };
  };
  return [
    // Smallest screen first: keys like "8" or "11" would otherwise come first, as numbers do in an object.
    ...Object.entries(builtIn)
      .sort(([, a], [, b]) => a.width * a.height - b.width * b.height || a.width - b.width)
      .map(([key, base]) => entry(key, base, own[key])),
    ...Object.entries(own)
      .filter(([key, item]) => !(key in builtIn) && item?.custom && item.width && item.height && item.name)
      .map(([key, item]) => entry(key, { label: item.name, width: item.width, height: item.height }, { hidden: item.hidden }, true)),
  ];
}

/** The devices a kind offers in the preview: the visible ones as `{ key: { width, height, label } }`. */
export function deviceCatalog(builtIn, prefs, kind) {
  const shown = deviceList(builtIn, prefs, kind).filter((item) => !item.hidden);
  return Object.fromEntries(shown.map(({ key, width, height, label }) => [key, { width, height, label }]));
}

/** The model to show: the one chosen while it is offered, else the default, else the first one offered. */
export function shownModel(catalog, chosen, fallback) {
  if (chosen && catalog[chosen]) return chosen;
  if (catalog[fallback]) return fallback;
  return Object.keys(catalog)[0] ?? fallback;
}

/** The prefs with a change to one device; a built-in one changed back to how it was keeps no entry. */
export function withDevice(prefs, kind, key, change, builtIn) {
  const own = { ...(prefs[kind] ?? {}) };
  const next = { ...(own[key] ?? {}), ...change };
  for (const field of Object.keys(next)) if (next[field] === undefined) delete next[field];
  const base = builtIn[key];
  if (base) {
    if (next.name === nameOf(base.label)) delete next.name;
    if (next.width === base.width) delete next.width;
    if (next.height === base.height) delete next.height;
    if (!next.hidden) delete next.hidden;
  }
  if (base && !Object.keys(next).length) delete own[key];
  else own[key] = next;
  return { ...prefs, [kind]: own };
}

export function withoutDevice(prefs, kind, key) {
  const own = { ...(prefs[kind] ?? {}) };
  delete own[key];
  return { ...prefs, [kind]: own };
}

/** A new device of a person's own, under a key no other device has. */
export function withNewDevice(prefs, kind, name, width, height, builtIn) {
  const taken = new Set([...Object.keys(builtIn), ...Object.keys(prefs[kind] ?? {})]);
  let index = 1;
  while (taken.has(`custom${index}`)) index += 1;
  const key = `custom${index}`;
  const size = screenOf(kind, width, height);
  return { prefs: { ...prefs, [kind]: { ...(prefs[kind] ?? {}), [key]: { custom: true, name: name.trim(), ...size } } }, key };
}

export class HomeDashboardEditorDevices extends LitElement {
  static properties = {
    hass: { attribute: false },
    prefs: { attribute: false },
    builtIn: { attribute: false },
  };

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  _emit(prefs) {
    this.dispatchEvent(new CustomEvent("devices-change", { detail: { prefs } }));
  }

  _close() {
    this.dispatchEvent(new CustomEvent("dialog-close"));
  }

  _renderKind(kind) {
    const builtIn = this.builtIn[kind];
    const list = deviceList(builtIn, this.prefs, kind);
    const visible = list.filter((item) => !item.hidden).length;
    const change = (key, field, value) => {
      const item = list.find((entry) => entry.key === key);
      if (field === "name") {
        const name = value.trim();
        return name && this._emit(withDevice(this.prefs, kind, key, { name }, builtIn));
      }
      const size = screenOf(kind, field === "width" ? value : item.width, field === "height" ? value : item.height);
      this._emit(withDevice(this.prefs, kind, key, size, builtIn));
    };
    const add = (event) => {
      event.preventDefault();
      const form = event.target;
      const name = form.elements.name.value.trim();
      if (!name || !form.elements.width.value || !form.elements.height.value) return;
      const { prefs } = withNewDevice(this.prefs, kind, name, form.elements.width.value, form.elements.height.value, builtIn);
      form.reset();
      this._emit(prefs);
    };
    return html`<section data-devices=${kind}>
      <h4><ha-icon icon=${kind === "phone" ? "mdi:cellphone" : "mdi:tablet"}></ha-icon>${this._t(`editor_devices_${kind}`)}</h4>
      <p class="hint">${this._t(`editor_devices_${kind}_hint`)}</p>
      <div class="rows">
        <div class="row head">
          <span>${this._t("editor_devices_shown")}</span><span>${this._t("editor_devices_name")}</span>
          <span>${this._t("editor_devices_width")}</span><span>${this._t("editor_devices_height")}</span><span></span>
        </div>
        ${list.map(
          (item) => html`<div class="row ${item.hidden ? "hidden" : ""}" data-device-row="${kind}/${item.key}">
            <input type="checkbox" data-device-visible .checked=${!item.hidden} ?disabled=${!item.hidden && visible <= 1}
              title=${this._t("editor_devices_shown")}
              @change=${(event) => this._emit(withDevice(this.prefs, kind, item.key, { hidden: !event.target.checked }, builtIn))} />
            <input data-device-name .value=${item.name} @change=${(event) => change(item.key, "name", event.target.value)} />
            <input type="number" data-device-width min=${SIZE_LIMITS.min} max=${SIZE_LIMITS.max} .value=${String(item.width)}
              @change=${(event) => change(item.key, "width", event.target.value)} />
            <input type="number" data-device-height min=${SIZE_LIMITS.min} max=${SIZE_LIMITS.max} .value=${String(item.height)}
              @change=${(event) => change(item.key, "height", event.target.value)} />
            ${item.custom
              ? html`<button class="icon" data-device-remove title=${this._t("editor_devices_remove")}
                  @click=${() => this._emit(withoutDevice(this.prefs, kind, item.key))}><ha-icon icon="mdi:delete-outline"></ha-icon></button>`
              : item.changed
                ? html`<button class="icon" data-device-reset title=${this._t("editor_devices_reset")}
                    @click=${() => this._emit(withDevice(this.prefs, kind, item.key, { name: undefined, width: undefined, height: undefined }, builtIn))}>
                    <ha-icon icon="mdi:restore"></ha-icon></button>`
                : html`<span></span>`}
          </div>`,
        )}
      </div>
      <form class="row add" data-device-add=${kind} @submit=${add}>
        <span><ha-icon icon="mdi:plus"></ha-icon></span>
        <input name="name" placeholder=${this._t(`editor_devices_${kind}_example`)} />
        <input name="width" type="number" min=${SIZE_LIMITS.min} max=${SIZE_LIMITS.max} placeholder=${kind === "phone" ? "412" : "1280"} />
        <input name="height" type="number" min=${SIZE_LIMITS.min} max=${SIZE_LIMITS.max} placeholder=${kind === "phone" ? "915" : "800"} />
        <button type="submit" class="primary">${this._t("editor_devices_add")}</button>
      </form>
    </section>`;
  }

  render() {
    if (!this.prefs || !this.builtIn) return nothing;
    return html`<div class="veil" @click=${this._close}>
      <section class="box" data-editor-settings-dialog @click=${(event) => event.stopPropagation()}>
        <header>
          <h3><ha-icon icon="mdi:cog-outline"></ha-icon>${this._t("editor_settings")}</h3>
          <button class="icon" data-settings-close aria-label=${this._t("background_close")} @click=${this._close}>×</button>
        </header>
        <div class="content">
          <p class="hint">${this._t("editor_devices_hint")}</p>
          ${KINDS.map((kind) => this._renderKind(kind))}
        </div>
      </section>
    </div>`;
  }

  static styles = css`
    :host {
      --mdc-icon-size: 18px;
    }
    .veil {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(0, 0, 0, 0.55);
    }
    .box {
      display: flex;
      flex-direction: column;
      width: min(820px, 94vw);
      max-height: 90vh;
      border: 1px solid var(--line);
      border-radius: 14px;
      color: var(--text);
      background: var(--panel);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
    }
    h3,
    h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
    }
    h3 {
      font-size: 16px;
    }
    h4 {
      margin-top: 18px;
      font-size: 14px;
    }
    .content {
      overflow: auto;
      padding: 4px 16px 18px;
    }
    .hint {
      margin: 6px 0;
      font-size: 12px;
      color: var(--muted);
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .row {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr) 90px 90px 40px;
      gap: 6px;
      align-items: center;
    }
    .row.head {
      font-size: 11px;
      text-align: left;
      color: var(--muted);
    }
    .row.hidden input:not([type="checkbox"]) {
      opacity: 0.45;
    }
    .row.add {
      grid-template-columns: 64px minmax(0, 1fr) 90px 90px auto;
      margin-top: 8px;
      color: var(--muted);
    }
    input {
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--line);
      border-radius: 7px;
      font: inherit;
      font-size: 13px;
      color: var(--text);
      background: var(--field);
    }
    input[type="checkbox"] {
      justify-self: center;
      width: 16px;
      height: 16px;
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .icon {
      display: grid;
      place-items: center;
      padding: 4px;
      border: 0;
      background: none;
      color: var(--muted);
      font-size: 20px;
    }
    .primary {
      padding: 6px 12px;
      border: 0;
      border-radius: 7px;
      color: #fff;
      background: var(--accent);
    }
  `;
}

if (!customElements.get("home-dashboard-editor-devices")) customElements.define("home-dashboard-editor-devices", HomeDashboardEditorDevices);
