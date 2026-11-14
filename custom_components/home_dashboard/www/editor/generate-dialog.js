// The generator of rooms: every area of Home Assistant with the tiles its room would get, the kinds of sections to
// make and whether rooms show on Home. What is ticked shows in the preview; "Add" puts the rooms in the draft as one
// step. Areas a room already holds are shown and left alone.

import { LitElement, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "../app/i18n.js";
import { SECTIONS, generatableAreas } from "./generate.js";
import { dialogStyles } from "./publish.js";

const TAG = "home-dashboard-editor-generate";

export class HomeDashboardEditorGenerate extends LitElement {
  static properties = {
    hass: { attribute: false },
    strategy: { attribute: false },
    _areas: { state: true },
    _kinds: { state: true },
    _home: { state: true },
  };

  constructor() {
    super();
    this._kinds = SECTIONS.filter((section) => section.key !== "automations").map((section) => section.key);
    this._home = true;
  }

  get options() {
    return { kinds: this._kinds, home: this._home };
  }

  willUpdate() {
    // Every area without a room and with something to show is ticked at first.
    if (this._areas === undefined && this.hass && this.strategy) {
      this._areas = generatableAreas(this.hass, this.strategy, this.options)
        .filter((item) => !item.covered && item.tiles)
        .map((item) => item.area);
      this.updateComplete.then(() => this._preview());
    }
  }

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  _preview() {
    this._emit("generate-preview", { areas: this._areas, options: this.options });
  }

  _toggle(list, key) {
    return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
  }

  render() {
    if (!this.hass || !this._areas) return nothing;
    const areas = generatableAreas(this.hass, this.strategy, this.options);
    const free = areas.filter((item) => !item.covered);
    return html`
      <div class="scrim" @click=${() => this._emit("dialog-close")}></div>
      <section class="dialog" role="dialog" aria-label=${this._t("editor_generate_title")} data-generate-dialog>
        <header>
          <h2>${this._t("editor_generate_title")}</h2>
          <span class="grow"></span>
          <button class="ghost" data-dialog-close aria-label=${this._t("close")} @click=${() => this._emit("dialog-close")}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        <div class="body">
          <div>
            <p class="hint">${this._t("editor_generate_help")}</p>
            <h3>${this._t("editor_generate_areas", { count: this._areas.length })}</h3>
            <div class="versions" data-generate-areas>
              ${free.length
                ? nothing
                : html`<p class="hint" data-generate-none>${this._t("editor_generate_all_there")}</p>`}
              ${areas.map(
                (item) => html`<button
                  class=${this._areas.includes(item.area) ? "on" : ""}
                  data-generate-area=${item.area}
                  ?disabled=${Boolean(item.covered)}
                  @click=${() => {
                    this._areas = this._toggle(this._areas, item.area);
                    this._preview();
                  }}
                >
                  <span>${item.name}</span>
                  <span class="hint">
                    ${item.covered ? this._t("editor_generate_covered", { room: item.covered }) : this._t("editor_generate_tiles", { count: item.tiles })}
                  </span>
                </button>`,
              )}
            </div>
          </div>
          <div>
            <h3>${this._t("editor_generate_sections")}</h3>
            ${SECTIONS.map(
              (section) => html`<label class="check" data-generate-kind=${section.key}>
                <span>${this._t(section.title)}</span>
                <input type="checkbox" .checked=${this._kinds.includes(section.key)} @change=${() => {
                  this._kinds = this._toggle(this._kinds, section.key);
                  this._preview();
                }} />
              </label>`,
            )}
            <label class="check" data-generate-home>
              <span>${this._t("editor_generate_home")}</span>
              <input type="checkbox" .checked=${this._home} @change=${(event) => {
                this._home = event.target.checked;
                this._preview();
              }} />
            </label>
            <p class="hint">${this._t("editor_generate_after")}</p>
          </div>
        </div>
        <footer>
          <span class="grow"></span>
          <button class="ghost" @click=${() => this._emit("dialog-close")}>${this._t("editor_picker_cancel")}</button>
          <button class="primary" data-generate-add ?disabled=${!this._areas.length}
            @click=${() => this._emit("generate-add", { areas: this._areas, options: this.options })}>
            <ha-icon icon="mdi:auto-fix"></ha-icon>${this._t("editor_generate_add", { count: this._areas.length })}
          </button>
        </footer>
      </section>
    `;
  }

  static styles = dialogStyles;
}

if (!customElements.get(TAG)) customElements.define(TAG, HomeDashboardEditorGenerate);
