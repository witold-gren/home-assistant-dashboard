// What a person does not see (`access`): a person chosen, then what the dashboard shows in kinds (cameras, rooms,
// sections, the blocks at the top, lights, media, security, scenes and scripts, the rest), each with an eye. The same
// lists as the tablet's window User access (accessChoices); it hides things in the dashboard and is no permission.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "../app/i18n.js";
import { accessChoices } from "../app/model.js";

const TAG = "home-dashboard-editor-access";

// The kinds in the order of the tablet's window, the key of `access` each writes, and its name.
export const ACCESS_KINDS = [
  ["cameras", "hide", "access_cameras"],
  ["rooms", "rooms", "access_rooms"],
  ["sections", "sections", "access_sections"],
  ["chips", "hide", "personal_chips"],
  ["lights", "hide", "access_lights"],
  ["media", "hide", "access_media"],
  ["security", "hide", "access_security"],
  ["actions", "hide", "access_actions"],
  ["other", "hide", "access_other"],
];

/** The access of everyone with one thing of one person hidden or shown again; a person with nothing hidden goes. */
export function withAccess(access, user, key, id, hide) {
  const rule = { ...(access?.[user] ?? {}) };
  const list = rule[key] ?? [];
  const next = hide ? [...new Set([...list, id])] : list.filter((item) => item !== id);
  if (next.length) rule[key] = next;
  else delete rule[key];
  const all = { ...(access ?? {}) };
  if (Object.keys(rule).length) all[user] = rule;
  else delete all[user];
  return all;
}

export class HomeDashboardEditorAccess extends LitElement {
  static properties = {
    hass: { attribute: false },
    strategy: { attribute: false },
    users: { attribute: false },
    _user: { state: true },
    _query: { state: true },
  };

  constructor() {
    super();
    this._query = "";
  }

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  get _people() {
    return (this.users ?? []).filter((user) => !user.is_owner || Object.keys(this.strategy?.access ?? {}).includes(user.id));
  }

  render() {
    if (!this.hass) return nothing;
    const people = this._people;
    const user = this._user ?? people[0]?.id;
    if (!user) return html`<p class="hint">${this._t("editor_access_nobody")}</p>`;
    const access = this.strategy?.access ?? {};
    const rule = access[user] ?? {};
    const choices = accessChoices(this.hass, this.strategy ?? {});
    const query = this._query.trim().toLowerCase();
    const count = ["hide", "rooms", "sections"].reduce((sum, key) => sum + (rule[key]?.length ?? 0), 0);
    return html`<label class="field">
        <span class="label"><span>${this._t("access_user")}</span><code>access.&lt;id&gt;</code></span>
        <select data-access-user @change=${(event) => (this._user = event.target.value)}>
          ${people.map(
            (person) => html`<option value=${person.id} ?selected=${person.id === user}>
              ${person.name}${access[person.id] ? ` · ${this._t("editor_access_has_rules")}` : ""}
            </option>`,
          )}
        </select>
      </label>
      <p class="hint" data-access-count>${this._t("access_hidden", { count })} · ${this._t("editor_access_hint")}</p>
      <input class="search" type="search" data-access-search placeholder=${this._t("access_search")}
        .value=${this._query} @input=${(event) => (this._query = event.target.value)} />
      ${ACCESS_KINDS.map(([kind, key, title]) => {
        const shut = new Set(rule[key] ?? []);
        const items = (choices[kind] ?? []).filter((item) => !query || item.name.toLowerCase().includes(query));
        if (!items.length) return nothing;
        const hiddenHere = items.filter((item) => shut.has(item.id)).length;
        return html`<details data-access-kind=${kind} ?open=${Boolean(query) || hiddenHere > 0}>
          <summary>${this._t(title)} <span class="count">${hiddenHere ? `${hiddenHere} / ` : ""}${items.length}</span></summary>
          ${items.map(
            (item) => html`<div class="row ${shut.has(item.id) ? "off" : ""}" data-access-item=${item.id}>
              <span>${item.name}</span>
              <button
                class="eye"
                aria-pressed=${shut.has(item.id)}
                @click=${() =>
                  this.dispatchEvent(
                    new CustomEvent("access-change", { detail: { access: withAccess(access, user, key, item.id, !shut.has(item.id)) } }),
                  )}
              >
                <ha-icon .icon=${shut.has(item.id) ? "mdi:eye-off-outline" : "mdi:eye-outline"}></ha-icon>
              </button>
            </div>`,
          )}
        </details>`;
      })}`;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
      --mdc-icon-size: 18px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .label {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--muted, #9aa0a6);
    }
    code {
      font-size: 11px;
      color: var(--faint);
    }
    select,
    input {
      box-sizing: border-box;
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--line, #2f343c);
      border-radius: 9px;
      font: inherit;
      color: var(--text, #e8eaed);
      background: var(--panel2, #23272e);
    }
    .hint {
      margin: 0;
      font-size: 12px;
      color: var(--muted, #9aa0a6);
    }
    details {
      border-radius: 9px;
      background: var(--hover);
    }
    summary {
      display: flex;
      justify-content: space-between;
      padding: 7px 10px;
      cursor: pointer;
    }
    .count {
      font-size: 12px;
      color: var(--muted, #9aa0a6);
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 3px 10px;
      font-size: 13px;
    }
    .row.off span {
      opacity: 0.5;
      text-decoration: line-through;
    }
    .eye {
      display: grid;
      place-items: center;
      width: 30px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 7px;
      cursor: pointer;
      color: var(--muted, #9aa0a6);
      background: var(--panel2, #23272e);
    }
  `;
}

if (!customElements.get(TAG)) customElements.define(TAG, HomeDashboardEditorAccess);
