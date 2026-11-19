// The window of the quick start: a few questions, one at a time, each starting from what was found in Home Assistant,
// and what was found counted on the right. Every answer shows in the preview behind; the last step adds it all to the
// draft as one change (one Undo takes it back) and can open the tour of the editor.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "../app/i18n.js";
import { BUILTIN_THEMES } from "../app/builtin-themes.js";
import { generatableAreas } from "./generate.js";
import { dialogStyles } from "./publish.js";
import {
  LEVELS,
  QUICK_STEPS,
  defaultAnswers,
  namesOf,
  quickStartFindings,
  quickStartSummary,
  withQuickStart,
} from "./quick-start.js";

const TAG = "home-dashboard-editor-quick-start";
const STEP_ICONS = {
  devices: "mdi:tablet-cellphone",
  rooms: "mdi:floor-plan",
  home: "mdi:home-heart",
  safety: "mdi:shield-home-outline",
  look: "mdi:palette-outline",
  summary: "mdi:check-decagram-outline",
};

export class HomeDashboardEditorQuickStart extends LitElement {
  static properties = {
    hass: { attribute: false },
    strategy: { attribute: false },
    _step: { state: true },
    _answers: { state: true },
    _tour: { state: true },
  };

  constructor() {
    super();
    this._step = 0;
    this._tour = true;
  }

  willUpdate() {
    if (this._answers === undefined && this.hass && this.strategy) {
      this._found = quickStartFindings(this.hass);
      this._answers = defaultAnswers(this.hass, this.strategy, this._found);
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
    this._emit("quick-preview", { answers: this._answers });
  }

  _set(change) {
    this._answers = { ...this._answers, ...change };
    this._preview();
  }

  _setSafety(change) {
    this._set({ safety: { ...this._answers.safety, ...change } });
  }

  _toggle(key, value) {
    const list = this._answers[key];
    this._set({ [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] });
  }

  _go(step) {
    this._step = Math.max(0, Math.min(QUICK_STEPS.length - 1, step));
  }

  _name(entity) {
    return this.hass.states[entity]?.attributes?.friendly_name ?? entity;
  }

  _switch(on, change, key) {
    return html`<button class="switch ${on ? "on" : ""}" role="switch" aria-checked=${on ? "true" : "false"}
      data-quick-switch=${key} @click=${() => change(!on)}></button>`;
  }

  _row(icon, title, hint, control, key) {
    return html`<div class="row" data-quick-row=${key}>
      <span class="icon"><ha-icon .icon=${icon}></ha-icon></span>
      <span class="text"><strong>${title}</strong>${hint ? html`<small>${hint}</small>` : nothing}</span>
      ${control}
    </div>`;
  }

  _level(key) {
    const value = this._answers.safety[key];
    return html`<select data-quick-level=${key} @change=${(event) => this._setSafety({ [key]: event.target.value })}>
      ${LEVELS.map((level) => html`<option value=${level} ?selected=${value === level}>${this._t(`quick_level_${level}`)}</option>`)}
    </select>`;
  }

  _renderDevices() {
    const a = this._answers;
    return html`
      <h3>${this._t("quick_devices_title")}</h3>
      <p class="lead">${this._t("quick_devices_lead")}</p>
      <div class="list">
        ${this._row("mdi:cellphone", this._t("quick_devices_phones"), this._t("quick_devices_phones_hint"), html`<span class="always">✓</span>`, "phones")}
        ${this._row("mdi:tablet", this._t("quick_devices_tablet"), this._t("quick_devices_tablet_hint"), this._switch(a.tablet, (on) => this._set({ tablet: on }), "tablet"), "tablet")}
        ${a.tablet
          ? this._row("mdi:timer-sand", this._t("quick_devices_idle"), this._t("quick_devices_idle_hint"), this._switch(a.idle, (on) => this._set({ idle: on }), "idle"), "idle")
          : nothing}
      </div>
      ${a.tablet ? html`<p class="note">${this._t("quick_devices_battery_note")}</p>` : nothing}
    `;
  }

  _renderRooms() {
    const areas = generatableAreas(this.hass, this.strategy);
    const floors = new Map();
    for (const item of areas) {
      const floor = this.hass.floors?.[this.hass.areas?.[item.area]?.floor_id]?.name ?? "";
      floors.set(floor, [...(floors.get(floor) ?? []), item]);
    }
    return html`
      <h3>${this._t("quick_rooms_title")}</h3>
      <p class="lead">${this._t("quick_rooms_lead")}</p>
      ${areas.length
        ? [...floors.entries()].map(
            ([floor, items]) => html`
              ${floor ? html`<h4>${floor}</h4>` : nothing}
              <div class="list">
                ${items.map(
                  (item) => html`<label class="row check" data-quick-area=${item.area}>
                    <input type="checkbox" .checked=${this._answers.areas.includes(item.area)} ?disabled=${Boolean(item.covered)}
                      @change=${() => this._toggle("areas", item.area)} />
                    <span class="text"><strong>${item.name}</strong>
                      <small>${item.covered
                        ? this._t("editor_generate_covered", { room: item.covered })
                        : this._t("editor_generate_tiles", { count: item.tiles })}</small></span>
                  </label>`,
                )}
              </div>
            `,
          )
        : html`<p class="note" data-quick-no-areas>${this._t("quick_rooms_none")}</p>`}
      <div class="list">
        ${this._row("mdi:home-outline", this._t("editor_generate_home"), null, this._switch(this._answers.home, (on) => this._set({ home: on }), "home"), "home")}
      </div>
    `;
  }

  _chips(key, entities) {
    return html`<div class="chips" data-quick-chips=${key}>
      ${entities.map(
        (entity) => html`<button class=${this._answers[key].includes(entity) ? "chip on" : "chip"} data-quick-chip=${entity}
          aria-pressed=${this._answers[key].includes(entity) ? "true" : "false"} @click=${() => this._toggle(key, entity)}>
          ${this._name(entity)}
        </button>`,
      )}
    </div>`;
  }

  _renderHome() {
    const found = this._found;
    const offered = [...new Set([...this._answers.favourites, ...found.locks, ...found.alarms, ...found.climates, ...found.covers.slice(0, 4), ...found.lights.slice(0, 4)])]
      .filter((entity) => !(this.strategy.favorites ?? []).includes(entity))
      .slice(0, 14);
    return html`
      <h3>${this._t("quick_home_title")}</h3>
      <p class="lead">${this._t("quick_home_lead")}</p>
      <h4>${this._t("quick_home_favourites")}</h4>
      ${offered.length ? this._chips("favourites", offered) : html`<p class="note">${this._t("quick_none")}</p>`}
      <h4>${this._t("quick_home_scenes")}</h4>
      ${found.scenes.length ? this._chips("scenes", found.scenes.slice(0, 16)) : html`<p class="note">${this._t("quick_none")}</p>`}
      ${found.cameras.length ? html`<p class="note">${this._t("quick_home_cameras", { count: found.cameras.length })}</p>` : nothing}
    `;
  }

  _renderSafety() {
    const found = this._found;
    const s = this._answers.safety;
    const rows = [];
    if (found.leaks.length) rows.push(this._row("mdi:water-alert", this._t("quick_item_leak"), this._t("quick_found", { count: found.leaks.length, names: namesOf(this.hass, found.leaks) }), this._level("leak"), "leak"));
    if (found.smoke.length) rows.push(this._row("mdi:smoke-detector-alert", this._t("quick_item_smoke"), this._t("quick_found", { count: found.smoke.length, names: namesOf(this.hass, found.smoke) }), this._level("smoke"), "smoke"));
    if (found.batteries.length)
      rows.push(
        this._row(
          "mdi:battery-alert",
          this._t("quick_item_battery"),
          this._t("quick_found_batteries", { count: found.batteries.length }),
          html`<span class="below">${this._t("quick_below")}
              <input type="number" min="5" max="90" step="5" .value=${String(s.battery_below)} data-quick-below
                @change=${(event) => this._setSafety({ battery_below: Number(event.target.value) || 20 })} />%</span>
            ${this._level("battery")}`,
          "battery",
        ),
      );
    if (found.hubs.length) rows.push(this._row("mdi:router-wireless-off", this._t("quick_item_hubs"), this._t("quick_hubs_hint", { names: found.hubs.map((hub) => hub.name).slice(0, 4).join(", ") }), this._level("hubs"), "hubs"));
    if (found.alarms.length) rows.push(this._row("mdi:shield-alert", this._t("quick_item_alarm"), namesOf(this.hass, found.alarms), this._level("alarm"), "alarm"));
    if ((found.doors.length || found.windows.length) && this._answers.tablet)
      rows.push(this._row("mdi:door-open", this._t("quick_doors"), this._t("quick_doors_hint", { count: found.doors.length + found.windows.length }), this._switch(s.doors, (on) => this._setSafety({ doors: on }), "doors"), "doors"));
    const missing = [
      !found.leaks.length && this._t("quick_item_leak"),
      !found.smoke.length && this._t("quick_item_smoke"),
      !found.hubs.length && this._t("quick_item_hubs"),
    ].filter(Boolean);
    return html`
      <h3>${this._t("quick_safety_title")}</h3>
      <p class="lead">${this._t("quick_safety_lead")}</p>
      ${rows.length ? html`<div class="list">${rows}</div>` : html`<p class="note">${this._t("quick_none")}</p>`}
      ${missing.length ? html`<p class="note" data-quick-missing>${this._t("quick_safety_missing", { names: missing.join(", ") })}</p>` : nothing}
    `;
  }

  _renderLook() {
    return html`
      <h3>${this._t("quick_look_title")}</h3>
      <p class="lead">${this._t("quick_look_lead")}</p>
      <div class="themes">
        ${BUILTIN_THEMES.map(
          (theme) => html`<button class="theme ${this._answers.theme === theme.id ? "on" : ""}" data-quick-theme=${theme.id}
            @click=${() => this._set({ theme: theme.id })}>
            <span class="swatch" style="background:${theme.appearance?.page?.background_light ?? "linear-gradient(135deg, #e9eef4, #cfd9e6)"}"></span>
            <strong>${theme.name}</strong>
          </button>`,
        )}
      </div>
      ${this.strategy.appearance && Object.keys(this.strategy.appearance).length > 1
        ? html`<p class="note">${this._t("quick_look_kept")}</p>`
        : nothing}
    `;
  }

  _renderSummary() {
    const after = withQuickStart(this.hass, this.strategy, this._answers, this._found);
    const sum = quickStartSummary(this.strategy, after);
    const tile = (value, key) => html`<div data-quick-sum=${key}><b>${value}</b>${this._t(`quick_sum_${key}`)}</div>`;
    const nothingNew = !sum.rooms && !sum.home && !sum.scenes && !sum.warnings && !sum.status && after === this.strategy;
    return html`
      <h3>${this._t("quick_summary_title")}</h3>
      <p class="lead">${this._t("quick_summary_lead")}</p>
      ${nothingNew
        ? html`<p class="note" data-quick-nothing>${this._t("quick_summary_nothing")}</p>`
        : html`<div class="sum">
            ${tile(sum.rooms, "rooms")} ${tile(sum.home, "home")} ${tile(sum.scenes, "scenes")} ${tile(sum.warnings, "warnings")}
            ${tile(sum.status ? "✓" : "–", "status")}
          </div>`}
      <div class="list">
        ${this._row("mdi:map-marker-path", this._t("quick_tour"), this._t("quick_tour_hint"), this._switch(this._tour, (on) => (this._tour = on), "tour"), "tour")}
      </div>
      <p class="note">${this._t("quick_again")}</p>
    `;
  }

  render() {
    if (!this.hass || !this._answers) return nothing;
    const step = QUICK_STEPS[this._step];
    const found = this._found;
    const last = this._step === QUICK_STEPS.length - 1;
    const body = {
      devices: this._renderDevices,
      rooms: this._renderRooms,
      home: this._renderHome,
      safety: this._renderSafety,
      look: this._renderLook,
      summary: this._renderSummary,
    }[step].call(this);
    const stat = (key, value) => html`<div class="stat"><span>${this._t(`quick_count_${key}`)}</span><b>${value}</b></div>`;
    return html`
      <div class="scrim"></div>
      <section class="dialog quick" role="dialog" aria-label=${this._t("quick_title")} data-quick-dialog>
        <header>
          <ha-icon icon="mdi:auto-fix"></ha-icon>
          <h2>${this._t("quick_title")}</h2>
          <span class="grow"></span>
          <button class="ghost" data-dialog-close aria-label=${this._t("close")} @click=${() => this._emit("dialog-close")}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        <div class="main">
          <ol class="steps">
            ${QUICK_STEPS.map(
              (key, index) => html`<li class=${index < this._step ? "done" : index === this._step ? "on" : ""}>
                <button data-quick-step=${key} @click=${() => this._go(index)}>
                  <b>${index < this._step ? "✓" : index + 1}</b><ha-icon .icon=${STEP_ICONS[key]}></ha-icon>${this._t(`quick_step_${key}`)}
                </button>
              </li>`,
            )}
          </ol>
          <div class="content" data-quick-content=${step}>${body}</div>
          <aside class="found" data-quick-found>
            <h5>${this._t("quick_found_title")}</h5>
            ${stat("areas", found.areas.length)} ${stat("lights", found.lights.length)} ${stat("covers", found.covers.length)}
            ${stat("climates", found.climates.length)} ${stat("cameras", found.cameras.length)}
            ${stat("safety", `${found.leaks.length} / ${found.smoke.length}`)} ${stat("batteries", found.batteries.length)}
            ${stat("hubs", found.hubs.length)} ${stat("scenes", found.scenes.length)}
            <p class="hint">${this._t("quick_found_preview")}</p>
          </aside>
        </div>
        <footer>
          <span class="hint" data-quick-progress>${this._t("quick_progress", { step: this._step + 1, count: QUICK_STEPS.length })}</span>
          <span class="grow"></span>
          ${this._step ? html`<button class="ghost" data-quick-back @click=${() => this._go(this._step - 1)}>${this._t("editor_tour_back")}</button>` : nothing}
          ${last
            ? html`<button class="primary" data-quick-apply
                @click=${() => this._emit("quick-apply", { answers: this._answers, tour: this._tour })}>
                <ha-icon icon="mdi:auto-fix"></ha-icon>${this._t("quick_apply")}
              </button>`
            : html`<button class="primary" data-quick-next @click=${() => this._go(this._step + 1)}>${this._t("editor_tour_next")}</button>`}
        </footer>
      </section>
    `;
  }

  static styles = [
    dialogStyles,
    css`
      .dialog.quick {
        height: 90vh;
        width: min(1100px, calc(100vw - 48px));
      }
      .main {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 210px minmax(0, 1fr) 240px;
      }
      .steps {
        margin: 0;
        padding: 14px 10px;
        list-style: none;
        border-right: 1px solid var(--line);
      }
      .steps button {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 10px;
        border-radius: 10px;
        color: var(--muted, #66727f);
        cursor: pointer;
      }
      .steps b {
        display: grid;
        place-items: center;
        flex: none;
        width: 22px;
        height: 22px;
        border: 1.5px solid currentColor;
        border-radius: 50%;
        font-size: 12px;
      }
      .steps ha-icon {
        display: none;
      }
      .steps .done button {
        color: inherit;
      }
      .steps .done b {
        border-color: #1f9d55;
        color: #fff;
        background: #1f9d55;
      }
      .steps .on button {
        color: var(--accent, #0a84ff);
        background: color-mix(in srgb, var(--accent, #0a84ff) 12%, transparent);
        font-weight: 600;
      }
      .steps .on b {
        border-color: var(--accent, #0a84ff);
        color: #fff;
        background: var(--accent, #0a84ff);
      }
      .content {
        min-height: 0;
        padding: 20px 24px;
        overflow: auto;
      }
      .content h3 {
        margin: 0 0 4px;
        font-size: 19px;
      }
      .content h4 {
        margin: 16px 0 8px;
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.65;
      }
      .lead {
        margin: 0 0 16px;
        opacity: 0.75;
      }
      .list {
        margin-bottom: 14px;
        border: 1px solid var(--line);
        border-radius: 12px;
        overflow: hidden;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-top: 1px solid var(--line);
      }
      .row:first-child {
        border-top: 0;
      }
      .row.check {
        cursor: pointer;
      }
      .row .icon {
        display: grid;
        place-items: center;
        flex: none;
        width: 30px;
        height: 30px;
        border-radius: 9px;
        background: color-mix(in srgb, currentColor 8%, transparent);
      }
      .row .text {
        flex: 1;
        min-width: 0;
      }
      .row .text strong {
        display: block;
        font-weight: 500;
      }
      .row small {
        display: block;
        opacity: 0.65;
      }
      .row select,
      .row input[type="number"] {
        padding: 4px 8px;
        border: 1px solid var(--line);
        border-radius: 8px;
        font: inherit;
        color: inherit;
        background: var(--field, transparent);
      }
      .row input[type="number"] {
        width: 58px;
        margin: 0 4px;
      }
      .below {
        white-space: nowrap;
        opacity: 0.85;
      }
      .always {
        color: #1f9d55;
        font-weight: 700;
      }
      .switch {
        position: relative;
        flex: none;
        width: 40px;
        height: 24px;
        padding: 0;
        border: 0;
        border-radius: 12px;
        background: #c3ccd6;
        cursor: pointer;
      }
      .switch::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 2px #0003;
        transition: left 0.15s;
      }
      .switch.on {
        background: #1f9d55;
      }
      .switch.on::after {
        left: 19px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }
      .chip {
        padding: 6px 12px;
        border: 1.5px solid var(--line);
        border-radius: 99px;
        font: inherit;
        color: inherit;
        background: none;
        cursor: pointer;
      }
      .chip.on {
        border-color: var(--accent, #0a84ff);
        color: var(--accent, #0a84ff);
        background: color-mix(in srgb, var(--accent, #0a84ff) 12%, transparent);
        font-weight: 600;
      }
      .note {
        padding: 10px 12px;
        border-radius: 10px;
        background: color-mix(in srgb, currentColor 5%, transparent);
        opacity: 0.85;
        font-size: 13px;
      }
      .themes {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 14px;
      }
      .theme {
        padding: 12px;
        border: 1.5px solid var(--line);
        border-radius: 14px;
        font: inherit;
        color: inherit;
        text-align: left;
        background: none;
        cursor: pointer;
      }
      .theme.on {
        border-color: var(--accent, #0a84ff);
        background: color-mix(in srgb, var(--accent, #0a84ff) 10%, transparent);
      }
      .swatch {
        display: block;
        height: 70px;
        margin-bottom: 8px;
        border-radius: 10px;
      }
      .sum {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      }
      .sum div {
        padding: 12px;
        border-radius: 12px;
        background: color-mix(in srgb, currentColor 5%, transparent);
      }
      .sum b {
        display: block;
        font-size: 24px;
      }
      .found {
        padding: 16px;
        border-left: 1px solid var(--line);
        overflow: auto;
      }
      .found h5 {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.65;
      }
      .stat {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px dashed var(--line);
      }
      .stat b {
        font-variant-numeric: tabular-nums;
      }
      .found .hint {
        margin-top: 12px;
        font-size: 12px;
      }
      header ha-icon {
        --mdc-icon-size: 20px;
      }
    `,
  ];
}

if (!customElements.get(TAG)) customElements.define(TAG, HomeDashboardEditorQuickStart);
