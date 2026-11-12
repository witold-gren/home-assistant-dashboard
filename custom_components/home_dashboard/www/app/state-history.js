// The history of something that is on or off (a leak, smoke, a door): a strip of the day or the week with the
// times it was on, and a list of them, newest first. From the history of Home Assistant; read-only.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { CONNECTION_DAYS, formatSeconds, sessionsOf } from "./connections.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const DAY_MS = 86_400_000;
const SHOWN_SESSIONS = 20;

/** Where on a strip from `start` to `end` each time on stands, in percent of its width. */
export function stripSegments(sessions, start, end, now = Date.now()) {
  const span = end - start;
  return sessions
    .map((session) => {
      const from = Math.max(session.start, start);
      const to = Math.min(session.end ?? now, end);
      return to > from ? { left: ((from - start) / span) * 100, width: Math.max(0.4, ((to - from) / span) * 100) } : null;
    })
    .filter(Boolean);
}

export class HomeDashboardStateHistory extends LitElement {
  static properties = {
    hass: { attribute: false },
    entity: { type: String },
    // The tone of a time on: an alarm (a leak, smoke) is red, the rest takes the colour of things that are on.
    alarm: { type: Boolean },
    _days: { state: true },
    _rows: { state: true },
  };

  constructor() {
    super();
    this._days = CONNECTION_DAYS[0];
    this._rows = null;
  }

  willUpdate(changed) {
    if ((changed.has("entity") || changed.has("_days")) && this.hass && this.entity) this._load();
  }

  async _load() {
    const asked = `${this._days}|${this.entity}`;
    this._asked = asked;
    this._rows = null;
    const end = Date.now();
    const history = await this.hass
      .callWS({
        type: "history/history_during_period",
        start_time: new Date(end - this._days * DAY_MS).toISOString(),
        end_time: new Date(end).toISOString(),
        entity_ids: [this.entity],
        minimal_response: true,
        no_attributes: true,
      })
      .catch(() => ({}));
    if (this._asked === asked) {
      this._rows = history?.[this.entity] ?? [];
      this._end = end;
    }
  }

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  render() {
    if (!this.hass || !this.entity) return nothing;
    const language = this.hass.language;
    const end = this._end ?? Date.now();
    const start = end - this._days * DAY_MS;
    const sessions = this._rows ? sessionsOf(this._rows, end) : [];
    const time = (at) => new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }).format(at);
    const day = (at) => new Intl.DateTimeFormat(language, { weekday: "short", day: "numeric", month: "short" }).format(at);
    const ticks = this._days === 1 ? [start, start + DAY_MS / 2, end].map(time) : [start, start + (end - start) / 2, end].map(day);
    return html`
      <div class="ranges" data-state-ranges>
        ${CONNECTION_DAYS.map(
          (count) => html`<button class=${count === this._days ? "on" : ""} data-state-days=${count} @click=${() => (this._days = count)}>
            ${this._t(count === 1 ? "conn_day" : "conn_week")}
          </button>`,
        )}
      </div>
      ${this._rows === null
        ? html`<p class="hint">${this._t("chart_loading")}</p>`
        : html`
            <div class="strip ${this.alarm ? "alarm" : ""}" data-state-strip>
              ${stripSegments(sessions, start, end, end).map(
                (segment) => html`<span style="left: ${segment.left}%; width: ${segment.width}%"></span>`,
              )}
            </div>
            <div class="ticks">${ticks.map((tick) => html`<small>${tick}</small>`)}</div>
            <div class="summary" data-state-summary>
              <span><small>${this._t("state_times")}</small><strong>${sessions.length}</strong></span>
              <span>
                <small>${this._t("state_last")}</small>
                <strong>${sessions[0] ? `${day(sessions[0].start)}, ${time(sessions[0].start)}` : "–"}</strong>
              </span>
            </div>
            ${sessions.length
              ? sessions.slice(0, SHOWN_SESSIONS).map(
                  (session) => html`
                    <div class="row ${session.end ? "" : "open"} ${this.alarm ? "alarm" : ""}" data-state-row>
                      <span class="when">${day(session.start)}, ${time(session.start)}${session.end ? ` – ${time(session.end)}` : ` – ${this._t("conn_now")}`}</span>
                      <strong>${formatSeconds(session.seconds, language)}</strong>
                    </div>
                  `,
                )
              : html`<p class="hint" data-state-empty>${this._t("state_none")}</p>`}
          `}
    `;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
      }
      small,
      .hint {
        color: var(--hd-text-muted);
      }
      .ranges {
        display: flex;
        gap: 4px;
        padding: 4px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .ranges button {
        flex: 1;
        padding: 7px 0;
        border-radius: 10px;
        font-size: 14px;
        text-align: center;
      }
      .ranges button.on {
        font-weight: 500;
        background: var(--hd-pill);
      }
      .strip {
        position: relative;
        height: 28px;
        overflow: hidden;
        border-radius: 8px;
        background: var(--hd-off);
      }
      .strip span {
        position: absolute;
        top: 0;
        bottom: 0;
        background: var(--hd-appliance-icon, #34c759);
      }
      .strip.alarm span {
        background: #ff453a;
      }
      .ticks {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .summary span {
        display: flex;
        flex-direction: column;
        padding: 10px 12px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .summary strong {
        font-size: 17px;
        font-weight: 500;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 14px;
        background: var(--hd-off);
        font-variant-numeric: tabular-nums;
      }
      .row strong {
        font-weight: 500;
      }
      .row.alarm strong {
        color: #ff6961;
      }
      .row.open strong::before {
        content: "● ";
        color: #ff3b30;
      }
      .hint {
        margin: 12px 0;
        text-align: center;
      }
    `,
  ];
}
