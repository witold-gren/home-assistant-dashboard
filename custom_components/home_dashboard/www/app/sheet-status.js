// What the status bar counts as on: its lights or its devices, each with its room and since when it is on, and those
// left out of the count apart. What is left out is configuration (`status_panel.ignore`, the editor on a computer),
// not a button here. A part of the sheet (sheet.js), as a mixin of its methods.

import { html, nothing } from "../vendor/lit-all.min.js";
import { effectiveArea } from "./model.js";
import { TILE_SHEETS } from "./sheet-shared.js";
import { COUNTED, nameOf, openItems } from "./status-panel.js";

// Lists of what is open, not on: the doors and the windows the status bar watches.
const OPEN_GROUPS = { doors: "mdi:door-open", windows: "mdi:window-open-variant" };

const domainOf = (entityId) => entityId.split(".")[0];

/** Since when an entity is in its state: the hour today, the day and the hour before. */
export function sinceText(lastChanged, language, now = new Date()) {
  const date = new Date(lastChanged);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return time;
  return `${date.toLocaleDateString(language, { day: "numeric", month: "short" })} ${time}`;
}

/**
 * The entities of a count that are on now, and those of them left out of it: `{ on, ignored }`. Doors and windows
 * are those of the status bar open now, with their names there (`names`).
 */
export function statusOn(hass, selection, config, group) {
  const newest = (a, b) => String(hass.states[b].last_changed).localeCompare(String(hass.states[a].last_changed));
  if (OPEN_GROUPS[group]) {
    const items = openItems(hass, config, group);
    return {
      on: items.map((item) => item.entity).sort(newest),
      ignored: [],
      names: Object.fromEntries(items.map((item) => [item.entity, nameOf(hass, item)])),
    };
  }
  const domains = COUNTED[group] ?? [];
  const ignore = new Set(config?.status_panel?.ignore ?? []);
  const lit = (selection?.entityIds ?? []).filter(
    (id) => domains.includes(domainOf(id)) && hass.states[id]?.state === "on",
  );
  return {
    on: lit.filter((id) => !ignore.has(id)).sort(newest),
    ignored: lit.filter((id) => ignore.has(id)).sort(newest),
  };
}

export const StatusSheets = (Base) =>
  class extends Base {
    _renderStatusOn() {
      const { group } = this.sheet;
      const { on, ignored, names = {} } = statusOn(this.hass, this.selection, this.raw ?? this.config, group);
      const icon = OPEN_GROUPS[group];
      return html`
        ${this._renderHeader(this._t(`status_on_${group}`), false, false)}
        <div class="status-on" data-status-on=${group}>
          ${on.length
            ? on.map((id) => this._renderStatusRow(id, false, names[id], icon))
            : html`<p class="hint" data-status-none>${this._t(icon ? "status_open_none" : "status_on_none")}</p>`}
          ${ignored.length
            ? html`<h3 class="status-ignored">${this._t("status_on_ignored")}</h3>
                ${ignored.map((id) => this._renderStatusRow(id, true))}`
            : nothing}
          ${ignored.length ? html`<p class="hint">${this._t("status_on_ignore_hint")}</p>` : nothing}
        </div>
      `;
    }

    // The window the dashboard has for the entity (a light's, a switch's); else Home Assistant's own.
    _openCounted(entityId, name) {
      const kind = TILE_SHEETS[domainOf(entityId)];
      if (kind) this._change({ kind, entityId, name });
      else this.dispatchEvent(new CustomEvent("sheet-details", { detail: { entityId } }));
    }

    _renderStatusRow(entityId, ignored, shownName = undefined, groupIcon = undefined) {
      const stateObj = this.hass.states[entityId];
      const name = shownName ?? stateObj.attributes.friendly_name ?? entityId;
      const area = this.hass.areas?.[effectiveArea(this.hass, entityId, this.config)]?.name;
      const since = sinceText(stateObj.last_changed, this.hass.language);
      const icon = groupIcon ?? stateObj.attributes.icon ?? (domainOf(entityId) === "light" ? "mdi:lightbulb-on" : "mdi:power-plug");
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
      </div>`;
    }
  };
