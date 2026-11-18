// Variants of a page in the editor (variants.py): the cards of Home's or a room's variants with what to do with each,
// and the dialog "Who sees it". A variant nobody sees changes nothing in the home; the published page is changed
// only by making a variant the published one (its old page stays as a variant) or by the draft as before.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "../app/i18n.js";
import { dialogStyles } from "./publish.js";
import { askInEditor } from "./ask-dialog.js";
import { callWS } from "./ws.js";

const DOMAIN = "home_dashboard";

/** The tree's node of a page's variants: its key on the server, from the node's own key. */
export const variantPageOf = (node) => node?.variantPage ?? null;

/** The devices and people that see a variant, in words for its card. */
export function seenBy(item, devices, people, t) {
  const deviceNames = item.devices.map((id) => deviceName(devices.find((device) => device.id === id), t) ?? t("editor_variant_device_gone"));
  const peopleNames = item.people.map((id) => people.find((person) => person.id === id)?.name ?? id);
  return [...deviceNames.map((name) => ({ kind: "device", name })), ...peopleNames.map((name) => ({ kind: "person", name }))];
}

export function deviceName(device, t) {
  if (!device) return null;
  return device.name || device.browser_mod || `${device.label ?? t("editor_variant_device")} · ${device.user_name}`;
}

export class HomeDashboardEditorVariants extends LitElement {
  static properties = {
    hass: { attribute: false },
    urlPath: { attribute: false },
    page: { attribute: false },
    title: { attribute: false },
    editing: { attribute: false },
    users: { attribute: false },
    _data: { state: true },
    _chosen: { state: true },
    _busy: { state: true },
    _error: { state: true },
  };

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  updated(changed) {
    if ((changed.has("page") || changed.has("urlPath")) && this.hass && this.urlPath && this.page) {
      this._chosen = null;
      this.reload();
    }
  }

  async reload() {
    try {
      this._data = await callWS(this.hass, { type: `${DOMAIN}/variants/list`, url_path: this.urlPath });
      this._error = null;
    } catch (error) {
      this._error = error?.message ?? String(error);
    }
  }

  get _page() {
    return this._data?.pages?.[this.page] ?? { live_name: null, items: [] };
  }

  async _call(message, after = null) {
    this._busy = true;
    try {
      const result = await callWS(this.hass, { url_path: this.urlPath, page: this.page, ...message });
      await this.reload();
      after?.(result);
      return result;
    } catch (error) {
      this._error = error?.message ?? String(error);
      return null;
    } finally {
      this._busy = false;
    }
  }

  _choose(item) {
    this._chosen = item?.id ?? "live";
    this._emit("variant-preview", { page: this.page, slice: item?.slice ?? null });
  }

  async _create(from = null) {
    const source = from ? this._page.items.find((item) => item.id === from) : null;
    const suggested = source ? this._t("editor_variant_copy_of", { name: source.name || this._t("variant_unnamed") }) : this._t("editor_variant_new_name");
    const name = await askInEditor(this, {
      icon: "mdi:layers-plus",
      title: this._t("editor_variant_new_title"),
      text: this._t(source ? "editor_variant_new_text_from" : "editor_variant_new_text", { name: source?.name || this._page.live_name || this._t("variant_live") }),
      input: suggested,
      placeholder: this._t("editor_variant_name_ask"),
      confirm: this._t("editor_variant_create"),
    });
    if (!name) return;
    return this._call({ type: `${DOMAIN}/variants/create`, name, ...(from ? { from } : {}) }, (result) => this._choose(result.variant));
  }

  async _rename(item) {
    const current = item ? item.name : this._page.live_name ?? "";
    const name = await askInEditor(this, {
      icon: "mdi:pencil-outline",
      title: this._t("editor_variant_rename_title"),
      text: item ? null : this._t("editor_variant_rename_live_text"),
      input: current,
      placeholder: this._t("editor_variant_name_ask"),
      confirm: this._t("save"),
      required: Boolean(item),
    });
    if (name === null || name === current) return;
    if (!item) return this._call({ type: `${DOMAIN}/variants/name_live`, name: name || null });
    if (!name) return;
    return this._call({ type: `${DOMAIN}/variants/update`, variant: item.id, name });
  }

  async _delete(item) {
    const asked = await askInEditor(this, {
      icon: "mdi:delete-outline",
      title: this._t("editor_variant_delete_title", { name: item.name || this._t("variant_unnamed") }),
      text: this._t("editor_variant_delete_text"),
      confirm: this._t("editor_variant_delete"),
      danger: true,
    });
    if (!asked) return;
    if (this._chosen === item.id) this._choose(null);
    return this._call({ type: `${DOMAIN}/variants/delete`, variant: item.id });
  }

  async _deploy(item) {
    const name = item.name || this._t("variant_unnamed");
    const asked = await askInEditor(this, {
      icon: "mdi:earth",
      title: this._t("editor_variant_deploy_title", { name }),
      text: this._t("editor_variant_deploy_text", { live: this._page.live_name || this._t("variant_live") }),
      confirm: this._t("editor_variant_deploy"),
    });
    if (!asked) return;
    return this._call({ type: `${DOMAIN}/variants/deploy`, variant: item.id }, () => {
      this._chosen = null;
      this._emit("variant-deployed", { page: this.page, name });
    });
  }

  render() {
    if (!this.hass) return nothing;
    if (!this._data) return html`<p class="hint">${this._error ?? this._t("editor_loading")}</p>`;
    const page = this._page;
    const when = new Intl.DateTimeFormat(this.hass.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const who = (id) => (this.users ?? []).find((user) => user.id === id)?.name ?? (this._data.people ?? []).find((user) => user.id === id)?.name ?? "";
    const badges = (item) =>
      seenBy(item, this._data.devices ?? [], this._data.people ?? [], (key) => this._t(key)).map(
        (seen) => html`<span class="badge ${seen.kind}"><ha-icon .icon=${seen.kind === "device" ? "mdi:tablet" : "mdi:account"}></ha-icon>${seen.name}</span>`,
      );
    const action = (key, icon, onClick, disabled = false) => html`<button data-variant-action=${key} ?disabled=${disabled || this._busy} @click=${(event) => {
      event.stopPropagation();
      onClick();
    }}><ha-icon .icon=${icon}></ha-icon>${this._t(`editor_variant_${key}`)}</button>`;
    const liveChosen = this._chosen === "live";
    return html`
      ${this._error ? html`<div class="problem" data-variant-error>${this._error}</div>` : nothing}
      <div class="cards" data-variant-cards>
        <div class="card ${liveChosen ? "on" : ""}" data-variant-card="live" @click=${() => this._choose(null)}>
          <div class="name"><ha-icon icon="mdi:check-decagram-outline"></ha-icon><b>${page.live_name || this._t("variant_live")}</b>
            <span class="grow"></span>
            <button class="ghost icon" data-variant-rename="live" title=${this._t("editor_variant_rename")} @click=${(event) => {
              event.stopPropagation();
              this._rename(null);
            }}><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
          </div>
          <div class="badges"><span class="badge live"><ha-icon icon="mdi:earth"></ha-icon>${this._t("editor_variant_published")}</span></div>
          ${liveChosen ? html`<div class="actions">${action("copy", "mdi:content-copy", () => this._create())}</div>` : nothing}
        </div>
        ${page.items.map((item) => {
          const on = this._chosen === item.id;
          const editing = this.editing === item.id;
          return html`
            <div class="card ${on ? "on" : ""} ${editing ? "editing" : ""}" data-variant-card=${item.id} @click=${() => this._choose(item)}>
              <div class="name"><ha-icon icon="mdi:layers-outline"></ha-icon><b>${item.name || this._t("variant_unnamed")}</b>
                <span class="grow"></span>
                <button class="ghost icon" data-variant-rename=${item.id} title=${this._t("editor_variant_rename")} @click=${(event) => {
                  event.stopPropagation();
                  this._rename(item);
                }}><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
                <button class="ghost icon" data-variant-delete=${item.id} title=${this._t("editor_variant_delete")} ?disabled=${editing} @click=${(event) => {
                  event.stopPropagation();
                  this._delete(item);
                }}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
              </div>
              <small>${[who(item.by), item.updated_at ? when.format(new Date(item.updated_at)) : ""].filter(Boolean).join(" · ")}</small>
              <div class="badges">
                ${item.shared ? html`<span class="badge shared" data-variant-shared><ha-icon icon="mdi:account-group"></ha-icon>${this._t("editor_variant_shared")}</span>` : nothing}
                ${item.devices.length + item.people.length ? badges(item) : html`<span class="badge none">${this._t("variant_unseen")}</span>`}
              </div>
              ${on || editing
                ? html`<div class="actions">
                    ${editing
                      ? html`<span class="badge editing"><ha-icon icon="mdi:pencil"></ha-icon>${this._t("editor_variant_editing")}</span>`
                      : action("edit", "mdi:pencil-ruler", () => this._emit("variant-edit", { page: this.page, item }))}
                    ${action("copy", "mdi:content-copy", () => this._create(item.id))}
                    ${action("who", "mdi:account-multiple-outline", () => this._emit("variant-access", { page: this.page, item, data: this._data }))}
                    ${action(item.shared ? "unshare" : "share", item.shared ? "mdi:account-group" : "mdi:account-group-outline", () =>
                      this._call({ type: `${DOMAIN}/variants/update`, variant: item.id, shared: !item.shared }),
                    )}
                    ${action("deploy", "mdi:earth", () => this._deploy(item), editing)}
                  </div>`
                : nothing}
            </div>
          `;
        })}
        <button class="add" data-variant-new ?disabled=${this._busy} @click=${() => this._create(this._chosen && this._chosen !== "live" ? this._chosen : null)}>
          <ha-icon icon="mdi:content-copy"></ha-icon>${this._t(this._chosen && this._chosen !== "live" ? "editor_variant_new_from_chosen" : "editor_variant_new")}
        </button>
      </div>
      <p class="hint">${this._t("editor_variant_hint")}</p>
    `;
  }

  static styles = css`
    :host {
      display: block;
      padding: 10px 14px 16px;
      --mdc-icon-size: 18px;
    }
    .cards {
      display: grid;
      gap: 10px;
    }
    .card {
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--panel);
      cursor: pointer;
    }
    .card.on {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent);
    }
    .name {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .grow {
      flex: 1;
    }
    small,
    .hint {
      font-size: 12px;
      color: var(--muted);
    }
    .badges,
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .badge {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      --mdc-icon-size: 14px;
      color: var(--text);
      background: color-mix(in srgb, var(--accent) 14%, transparent);
    }
    .badge.live {
      color: #1e7d3a;
      background: rgba(52, 199, 89, 0.16);
    }
    .badge.device {
      color: #9a5b00;
      background: rgba(255, 159, 10, 0.18);
    }
    .badge.shared {
      color: #6d3fc0;
      background: rgba(140, 90, 230, 0.16);
    }
    .badge.none {
      color: var(--muted);
      background: transparent;
      padding-left: 0;
    }
    button {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 6px 10px;
      border: 1px solid var(--line);
      border-radius: 9px;
      font: inherit;
      font-size: 13px;
      color: inherit;
      background: var(--panel);
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    button.ghost {
      border: 0;
      background: transparent;
      color: var(--muted);
    }
    button.icon {
      padding: 4px;
    }
    button.add {
      justify-content: center;
      padding: 10px;
      border-style: dashed;
      color: var(--muted);
    }
    .problem {
      margin-bottom: 8px;
      color: var(--red, #d93025);
    }
  `;
}

/**
 * Where the variants run: for every page with variants, each variant (the published one first) with the devices and
 * people that see it, those who chose it themselves marked, and when each device last opened the dashboard.
 */
export class HomeDashboardEditorVariantOverview extends LitElement {
  static properties = {
    hass: { attribute: false },
    data: { attribute: false },
    rooms: { attribute: false },
    users: { attribute: false },
  };

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  render() {
    if (!this.hass || !this.data) return nothing;
    const t = (key, values) => this._t(key, values);
    const when = new Intl.DateTimeFormat(this.hass.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const devices = this.data.devices ?? [];
    const people = this.data.people ?? [];
    const personName = (id) => people.find((person) => person.id === id)?.name ?? (this.users ?? []).find((user) => user.id === id)?.name ?? id;
    const pageName = (page) => (page === "home" ? t("editor_tree_home_page") : ((this.rooms ?? []).find((room) => `room:${room.id}` === page)?.name ?? page));
    const pages = Object.entries(this.data.pages ?? {}).filter(([, entry]) => entry.items.length);
    const deviceRow = (device) => html`<li data-overview-device=${device.id}>
      <ha-icon icon="mdi:tablet-cellphone"></ha-icon>${deviceName(device, t)}
      <small>${device.seen ? t("editor_variant_seen_at", { when: when.format(new Date(device.seen)) }) : ""}</small>
    </li>`;
    const personRow = (id, chosen) => html`<li data-overview-person=${id}>
      <ha-icon icon="mdi:account"></ha-icon>${personName(id)}
      ${chosen ? html`<span class="badge shared">${t("editor_variant_chose_self")}</span>` : nothing}
    </li>`;
    return html`
      <div class="scrim" @click=${() => this.dispatchEvent(new CustomEvent("dialog-close"))}></div>
      <section class="dialog" role="dialog" aria-label=${t("editor_variants_overview")} data-variant-overview>
        <header>
          <ha-icon icon="mdi:magnify"></ha-icon>
          <h2>${t("editor_variants_overview")}</h2>
          <span class="grow"></span>
          <button class="ghost" data-dialog-close aria-label=${t("close")} @click=${() => this.dispatchEvent(new CustomEvent("dialog-close"))}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        <div class="list">
          ${pages.length
            ? pages.map(([page, entry]) => {
                const given = new Set(entry.items.flatMap((item) => item.devices));
                const others = devices.filter((device) => !given.has(device.id));
                return html`<div class="page" data-overview-page=${page}>
                  <h3>${pageName(page)}</h3>
                  <div class="variant live" data-overview-variant="live">
                    <b><ha-icon icon="mdi:earth"></ha-icon>${entry.live_name || t("variant_live")}</b>
                    <small>${t("editor_variant_live_rest", { count: others.length })}</small>
                  </div>
                  ${entry.items.map(
                    (item) => html`<div class="variant" data-overview-variant=${item.id}>
                      <b><ha-icon icon="mdi:layers-outline"></ha-icon>${item.name || t("variant_unnamed")}
                        ${item.shared ? html`<span class="badge shared">${t("editor_variant_shared")}</span>` : nothing}</b>
                      ${item.devices.length + item.people.length
                        ? html`<ul>
                            ${item.devices.map((id) => devices.find((device) => device.id === id)).filter(Boolean).map(deviceRow)}
                            ${item.people.map((id) => personRow(id, (item.chosen ?? []).includes(id)))}
                          </ul>`
                        : html`<small>${t("variant_unseen")}</small>`}
                    </div>`,
                  )}
                </div>`;
              })
            : html`<p class="hint" data-overview-empty>${t("editor_variants_overview_empty")}</p>`}
        </div>
      </section>
    `;
  }

  static styles = [
    dialogStyles,
    css`
      .dialog {
        width: min(760px, calc(100vw - 48px));
      }
      .list {
        display: grid;
        gap: 18px;
        padding: 12px 18px 18px;
        overflow: auto;
      }
      h3 {
        margin: 0 0 8px;
        font-size: 15px;
      }
      .page {
        display: grid;
        gap: 8px;
      }
      .variant {
        display: grid;
        gap: 4px;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 12px;
      }
      .variant b {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      ul {
        margin: 2px 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 4px;
      }
      li {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      small,
      .hint {
        font-size: 12px;
        color: var(--muted);
      }
      .badge {
        padding: 1px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 500;
      }
      .badge.shared {
        color: #6d3fc0;
        background: rgba(140, 90, 230, 0.16);
      }
    `,
  ];
}

if (!customElements.get("home-dashboard-editor-variant-overview")) {
  customElements.define("home-dashboard-editor-variant-overview", HomeDashboardEditorVariantOverview);
}

/** "Who sees it": for each device and person of the home, which variant of this page it shows. */
export class HomeDashboardEditorVariantAccess extends LitElement {
  static properties = {
    hass: { attribute: false },
    urlPath: { attribute: false },
    page: { attribute: false },
    item: { attribute: false },
    data: { attribute: false },
    _devices: { state: true },
    _people: { state: true },
    _names: { state: true },
    _busy: { state: true },
    _error: { state: true },
  };

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  willUpdate(changed) {
    if (changed.has("data") || changed.has("page")) {
      const page = this.data?.pages?.[this.page] ?? { items: [] };
      const of = (kind) => Object.fromEntries(page.items.flatMap((item) => item[kind].map((id) => [id, item.id])));
      this._devices = of("devices");
      this._people = of("people");
      this._names = {};
    }
  }

  async _save() {
    this._busy = true;
    const page = this.data?.pages?.[this.page] ?? { items: [] };
    const all = (kind, known) => Object.fromEntries(known.map((id) => [id, this[`_${kind}`][id] ?? null]));
    try {
      for (const [device, name] of Object.entries(this._names)) {
        await callWS(this.hass, { type: `${DOMAIN}/variants/name_device`, device, name: name || null });
      }
      await callWS(this.hass, {
        type: `${DOMAIN}/variants/assign`,
        url_path: this.urlPath,
        page: this.page,
        devices: all("devices", [...new Set([...(this.data.devices ?? []).map((device) => device.id), ...page.items.flatMap((item) => item.devices)])]),
        people: all("people", [...new Set([...(this.data.people ?? []).map((person) => person.id), ...page.items.flatMap((item) => item.people)])]),
      });
      this._emit("variant-access-saved");
    } catch (error) {
      this._error = error?.message ?? String(error);
    } finally {
      this._busy = false;
    }
  }

  _select(kind, id) {
    const page = this.data?.pages?.[this.page] ?? { items: [], live_name: null };
    const chosen = this[`_${kind}`][id] ?? "";
    return html`<select data-variant-for=${`${kind}:${id}`} @change=${(event) => {
      this[`_${kind}`] = { ...this[`_${kind}`], [id]: event.target.value || null };
    }}>
      <option value="" ?selected=${!chosen}>${page.live_name || this._t("variant_live")}</option>
      ${page.items.map((item) => html`<option value=${item.id} ?selected=${chosen === item.id}>${item.name || this._t("variant_unnamed")}</option>`)}
    </select>`;
  }

  render() {
    if (!this.hass || !this.data) return nothing;
    const when = new Intl.DateTimeFormat(this.hass.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const devices = this.data.devices ?? [];
    const name = this.item?.name || this._t("variant_unnamed");
    return html`
      <div class="scrim" @click=${() => this._emit("dialog-close")}></div>
      <section class="dialog narrow" role="dialog" aria-label=${this._t("editor_variant_who_title", { name })} data-variant-access>
        <header>
          <ha-icon icon="mdi:account-multiple-outline"></ha-icon>
          <h2>${this._t("editor_variant_who_title", { name })}</h2>
          <span class="grow"></span>
          <button class="ghost" data-dialog-close aria-label=${this._t("close")} @click=${() => this._emit("dialog-close")}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        <div class="list">
          <h3>${this._t("editor_variant_devices")}</h3>
          ${devices.length
            ? devices.map(
                (device) => html`<div class="who" data-variant-device=${device.id}>
                  <ha-icon icon="mdi:tablet-cellphone"></ha-icon>
                  <span class="grow">
                    <input
                      data-device-name=${device.id}
                      .value=${this._names[device.id] ?? device.name ?? ""}
                      placeholder=${device.browser_mod ?? device.label ?? this._t("editor_variant_device")}
                      @input=${(event) => (this._names = { ...this._names, [device.id]: event.target.value })}
                    />
                    <small>${device.user_name}${device.label ? ` · ${device.label}` : ""}${device.seen ? ` · ${this._t("editor_variant_seen_at", { when: when.format(new Date(device.seen)) })}` : ""}</small>
                  </span>
                  ${this._select("devices", device.id)}
                </div>`,
              )
            : html`<p class="hint" data-no-devices>${this._t("editor_variant_no_devices")}</p>`}
          <h3>${this._t("editor_variant_people")}</h3>
          ${(this.data.people ?? []).map(
            (person) => html`<div class="who" data-variant-person=${person.id}>
              <ha-icon icon="mdi:account"></ha-icon>
              <span class="grow">${person.name}<small>${this._t("editor_variant_person_hint")}</small></span>
              ${this._select("people", person.id)}
            </div>`,
          )}
          <p class="hint">${this._t("editor_variant_order")}</p>
          ${this._error ? html`<p class="problem" data-variant-error>${this._error}</p>` : nothing}
        </div>
        <footer>
          <span class="grow"></span>
          <button data-dialog-cancel @click=${() => this._emit("dialog-close")}>${this._t("cancel")}</button>
          <button class="primary" data-variant-access-save ?disabled=${this._busy} @click=${this._save}>${this._t("save")}</button>
        </footer>
      </section>
    `;
  }

  static styles = [
    dialogStyles,
    css`
      .dialog.narrow {
        width: min(620px, calc(100vw - 48px));
      }
      .list {
        padding: 6px 18px 14px;
        overflow: auto;
      }
      h3 {
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted);
      }
      .who {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 6px;
        padding: 8px 10px;
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      .who .grow {
        display: grid;
        gap: 2px;
      }
      .who input {
        padding: 4px 8px;
      }
      small {
        font-size: 12px;
        color: var(--muted);
      }
    `,
  ];
}

/** The variant of each page a device shows: "Home: Sections", "Living room: B" ("Published" when none is its own). */
export function variantsOfDevice(data, device, roomName, t) {
  return Object.entries(data?.pages ?? {}).flatMap(([page, entry]) => {
    const item = entry.items.find((one) => one.devices.includes(device.id));
    if (!item) return [];
    const where = page === "home" ? t("editor_tree_home_page") : (roomName(page.slice("room:".length)) ?? page);
    return [{ page, where, name: item.name || t("variant_unnamed") }];
  });
}

/**
 * The phones and tablets that opened a dashboard since the variants came: a name to recognise each, its kind and
 * person, when it was last opened, what variant of which page it shows, and a way to forget one (signed out, sold).
 */
export class HomeDashboardEditorKnownDevices extends LitElement {
  static properties = {
    hass: { attribute: false },
    urlPath: { attribute: false },
    rooms: { attribute: false },
    _data: { state: true },
    _error: { state: true },
    _saved: { state: true },
  };

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  updated(changed) {
    if ((changed.has("urlPath") || changed.has("hass")) && this.hass && this.urlPath && !this._data) this.reload();
  }

  async reload() {
    try {
      this._data = await callWS(this.hass, { type: `${DOMAIN}/variants/list`, url_path: this.urlPath });
      this._error = null;
    } catch (error) {
      this._error = error?.message ?? String(error);
    }
  }

  async _name(device, name) {
    const value = name.trim() || null;
    if (value === (device.name ?? null)) return;
    try {
      await callWS(this.hass, { type: `${DOMAIN}/variants/name_device`, device: device.id, name: value });
      this._saved = device.id;
      await this.reload();
    } catch (error) {
      this._error = error?.message ?? String(error);
    }
  }

  async _forget(device) {
    const asked = await askInEditor(this, {
      icon: "mdi:tablet-off",
      title: this._t("editor_devices_forget_title", { name: deviceName(device, (key) => this._t(key)) }),
      text: this._t("editor_devices_forget_text"),
      confirm: this._t("editor_devices_forget"),
      danger: true,
    });
    if (!asked) return;
    try {
      await callWS(this.hass, { type: `${DOMAIN}/variants/forget_device`, device: device.id });
      await this.reload();
    } catch (error) {
      this._error = error?.message ?? String(error);
    }
  }

  render() {
    if (!this.hass) return nothing;
    if (!this._data) return html`<p class="hint">${this._error ?? this._t("editor_loading")}</p>`;
    const when = new Intl.DateTimeFormat(this.hass.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const roomName = (id) => (this.rooms ?? []).find((room) => room.id === id)?.name ?? null;
    const devices = this._data.devices ?? [];
    return html`
      ${this._error ? html`<div class="problem" data-devices-error>${this._error}</div>` : nothing}
      <p class="hint">${this._t("editor_known_devices_hint")}</p>
      ${devices.length
        ? html`<div class="cards" data-known-devices>
            ${devices.map((device) => {
              const shows = variantsOfDevice(this._data, device, roomName, (key) => this._t(key));
              const icon = /iPhone|Android/.test(device.label ?? "") ? "mdi:cellphone" : /iPad/.test(device.label ?? "") ? "mdi:tablet" : "mdi:monitor";
              return html`<div class="card device" data-known-device=${device.id}>
                <div class="name">
                  <ha-icon .icon=${icon}></ha-icon>
                  <input
                    data-known-device-name=${device.id}
                    .value=${device.name ?? ""}
                    placeholder=${device.browser_mod ?? device.label ?? this._t("editor_variant_device")}
                    aria-label=${this._t("editor_known_devices_name")}
                    @change=${(event) => this._name(device, event.target.value)}
                    @keydown=${(event) => event.key === "Enter" && event.target.blur()}
                  />
                  ${this._saved === device.id ? html`<ha-icon class="ok" icon="mdi:check"></ha-icon>` : nothing}
                  <button class="ghost icon" data-known-device-forget=${device.id} title=${this._t("editor_devices_forget")} @click=${() => this._forget(device)}>
                    <ha-icon icon="mdi:delete-outline"></ha-icon>
                  </button>
                </div>
                <small>${[device.label, device.user_name, device.seen ? this._t("editor_variant_seen_at", { when: when.format(new Date(device.seen)) }) : null]
                  .filter(Boolean)
                  .join(" · ")}</small>
                <div class="badges">
                  ${shows.length
                    ? shows.map((one) => html`<span class="badge" data-shows=${one.page}><ha-icon icon="mdi:layers-outline"></ha-icon>${one.where}: ${one.name}</span>`)
                    : html`<span class="badge none">${this._t("editor_devices_published")}</span>`}
                </div>
              </div>`;
            })}
          </div>`
        : html`<p class="hint" data-no-devices>${this._t("editor_variant_no_devices")}</p>`}
    `;
  }

  static styles = [
    HomeDashboardEditorVariants.styles,
    css`
      .card.device {
        cursor: default;
      }
      .name input {
        flex: 1;
        min-width: 0;
        padding: 5px 8px;
        border: 1px solid var(--line);
        border-radius: 8px;
        font: inherit;
        font-weight: 600;
        color: inherit;
        background: var(--field, transparent);
      }
      .ok {
        color: #34c759;
      }
      .hint {
        margin: 0 0 10px;
      }
    `,
  ];
}

if (!customElements.get("home-dashboard-editor-known-devices")) {
  customElements.define("home-dashboard-editor-known-devices", HomeDashboardEditorKnownDevices);
}
if (!customElements.get("home-dashboard-editor-variants")) customElements.define("home-dashboard-editor-variants", HomeDashboardEditorVariants);
if (!customElements.get("home-dashboard-editor-variant-access")) {
  customElements.define("home-dashboard-editor-variant-access", HomeDashboardEditorVariantAccess);
}
