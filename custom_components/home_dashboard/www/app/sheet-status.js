// What the status bar counts as on: its lights or its devices, each with its room and since when it is on, and for
// an administrator a way to leave one out of the count (`status_panel.ignore`) or count it again. A part of the sheet
// (sheet.js), as a mixin of its methods.

import { html, nothing } from "../vendor/lit-all.min.js";
import { effectiveArea } from "./model.js";
import { TILE_SHEETS } from "./sheet-shared.js";
import { COUNTED } from "./status-panel.js";

const domainOf = (entityId) => entityId.split(".")[0];

/** Since when an entity is in its state: the hour today, the day and the hour before. */
export function sinceText(lastChanged, language, now = new Date()) {
  const date = new Date(lastChanged);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return time;
  return `${date.toLocaleDateString(language, { day: "numeric", month: "short" })} ${time}`;
}

/** The entities of a count that are on now, and those of them left out of it: `{ on, ignored }`. */
export function statusOn(hass, selection, config, group) {
  const domains = COUNTED[group] ?? [];
  const ignore = new Set(config?.status_panel?.ignore ?? []);
  const lit = (selection?.entityIds ?? []).filter(
    (id) => domains.includes(domainOf(id)) && hass.states[id]?.state === "on",
  );
  const newestFirst = (a, b) => String(hass.states[b].last_changed).localeCompare(String(hass.states[a].last_changed));
  return {
    on: lit.filter((id) => !ignore.has(id)).sort(newestFirst),
    ignored: lit.filter((id) => ignore.has(id)).sort(newestFirst),
  };
}

export const StatusSheets = (Base) =>
  class extends Base {
    _renderStatusOn() {
      const { group } = this.sheet;
      const { on, ignored } = statusOn(this.hass, this.selection, this.raw ?? this.config, group);
      const admin = Boolean(this.hass.user?.is_admin);
      return html`
        ${this._renderHeader(this._t(`status_on_${group}`), false, false)}
        <div class="status-on" data-status-on=${group}>
          ${on.length
            ? on.map((id) => this._renderStatusRow(id, false, admin))
            : html`<p class="hint" data-status-none>${this._t("status_on_none")}</p>`}
          ${ignored.length
            ? html`<h3 class="status-ignored">${this._t("status_on_ignored")}</h3>
                ${ignored.map((id) => this._renderStatusRow(id, true, admin))}`
            : nothing}
          ${admin ? html`<p class="hint">${this._t("status_on_ignore_hint")}</p>` : nothing}
        </div>
      `;
    }

    // The window the dashboard has for the entity (a light's, a switch's); else Home Assistant's own.
    _openCounted(entityId, name) {
      const kind = TILE_SHEETS[domainOf(entityId)];
      if (kind) this._change({ kind, entityId, name });
      else this.dispatchEvent(new CustomEvent("sheet-details", { detail: { entityId } }));
    }

    _renderStatusRow(entityId, ignored, admin) {
      const stateObj = this.hass.states[entityId];
      const name = stateObj.attributes.friendly_name ?? entityId;
      const area = this.hass.areas?.[effectiveArea(this.hass, entityId, this.config)]?.name;
      const since = sinceText(stateObj.last_changed, this.hass.language);
      const icon = stateObj.attributes.icon ?? (domainOf(entityId) === "light" ? "mdi:lightbulb-on" : "mdi:power-plug");
      return html`<div class="status-row ${ignored ? "ignored" : ""}" data-status-row=${entityId}>
        <button
          class="status-main"
          data-status-open=${entityId}
          @click=${() => this._openCounted(entityId, name)}
        >
          <ha-icon .icon=${icon}></ha-icon>
          <span class="row-text">
            <strong>${name}</strong>
            <span>${[area, since && this._t("status_on_since", { time: since })].filter(Boolean).join(" · ")}</span>
          </span>
        </button>
        ${admin
          ? html`<button
              class="status-ignore"
              data-status-ignore=${entityId}
              @click=${() =>
                this.dispatchEvent(new CustomEvent("sheet-status-ignore", { detail: { entityId, ignore: !ignored } }))}
            >
              ${ignored ? this._t("status_on_count_again") : this._t("status_on_ignore")}
            </button>`
          : nothing}
      </div>`;
    }
  };
