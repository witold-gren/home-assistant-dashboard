// The connections of a camera on a battery: a red dot wherever the camera shows while a stream of it is open (from
// this dashboard, another window of Home Assistant or anything asking the bridge), and in its settings a log of when
// and for how long it was awake, from the history of Home Assistant. A long one left open is what drains it.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const DAY_MS = 86_400_000;
export const CONNECTION_DAYS = [1, 7];
// Longer than this is a stream someone left open, and it is marked.
export const LONG_CONNECTION_S = 300;
// The link to the camera (Neolink) says it is awake; streaming and recording a live view say what kept it so.
const KINDS = [
  [/_camera_link$/, "link"],
  [/_recording_live_view$/, "recording"],
  [/_streaming$/, "stream"],
];
export const sensorKind = (id) => KINDS.find(([pattern]) => pattern.test(id))?.[1] ?? "stream";

/** The red dot of an open stream, for the corner of a picture. */
export const streamDot = (on, label) => (on ? html`<span class="stream-dot" data-stream-dot role="img" aria-label=${label}></span>` : nothing);

export const streamDotStyles = css`
  .stream-dot {
    position: absolute;
    z-index: 2;
    top: 10px;
    right: 10px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff453a;
    /* A thin ring keeps it seen on a bright picture without a heavy glow. */
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
    opacity: 0.85;
    animation: stream-blink 2s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes stream-blink {
    50% {
      opacity: 0.3;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .stream-dot {
      animation: none;
    }
  }
`;

/**
 * The times a sensor was on, from its history (minimal rows: `s` the state, `lu`/`lc` the time in seconds): each with
 * its start, end (null while it goes on) and length in seconds, newest first.
 */
export function sessionsOf(rows, now = Date.now()) {
  const sessions = [];
  let start = null;
  for (const row of rows ?? []) {
    const time = (row.lu ?? row.lc ?? 0) * 1000;
    if (row.s === "on" && start === null) start = time;
    else if (row.s !== "on" && start !== null) {
      sessions.push({ start, end: time, seconds: Math.max(0, Math.round((time - start) / 1000)) });
      start = null;
    }
  }
  if (start !== null) sessions.push({ start, end: null, seconds: Math.max(0, Math.round((now - start) / 1000)) });
  return sessions.reverse();
}

/** How many times and for how long in all. */
export function sessionTotals(sessions) {
  return { count: sessions.length, seconds: sessions.reduce((sum, session) => sum + session.seconds, 0) };
}

export function formatSeconds(seconds, language) {
  const t = (key, values) => translate(language, key, values);
  if (seconds < 60) return t("conn_seconds", { s: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("conn_minutes", { m: minutes, s: seconds % 60 });
  return t("conn_hours", { h: Math.floor(minutes / 60), m: minutes % 60 });
}

export class HomeDashboardConnections extends LitElement {
  static properties = {
    hass: { attribute: false },
    sensors: { attribute: false },
    _days: { state: true },
    _rows: { state: true },
  };

  constructor() {
    super();
    this._days = CONNECTION_DAYS[0];
    this._rows = null;
  }

  willUpdate(changed) {
    if ((changed.has("sensors") || changed.has("_days")) && this.hass && this.sensors?.length) this._load();
  }

  async _load() {
    const asked = `${this._days}|${this.sensors.join(",")}`;
    this._asked = asked;
    this._rows = null;
    const end = Date.now();
    const history = await this.hass
      .callWS({
        type: "history/history_during_period",
        start_time: new Date(end - this._days * DAY_MS).toISOString(),
        end_time: new Date(end).toISOString(),
        entity_ids: this.sensors,
        minimal_response: true,
        no_attributes: true,
      })
      .catch(() => ({}));
    if (this._asked === asked) this._rows = history ?? {};
  }

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  render() {
    if (!this.hass || !this.sensors?.length) return nothing;
    const language = this.hass.language;
    const kinds = this.sensors.map((id) => ({ id, kind: sensorKind(id) }));
    // The link of a camera says best how long it was awake; without one, its stream does.
    const main = kinds.find((entry) => entry.kind === "link") ?? kinds.find((entry) => entry.kind === "stream") ?? kinds[0];
    const sessions = this._rows
      ? kinds
          .flatMap(({ id, kind }) => sessionsOf(this._rows[id], Date.now()).map((session) => ({ ...session, kind, id })))
          .sort((first, second) => second.start - first.start)
      : [];
    const totals = sessionTotals(sessions.filter((session) => session.id === main.id));
    const time = (at) => new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(at);
    const dayOf = (at) => new Intl.DateTimeFormat(language, { weekday: "long", day: "numeric", month: "long" }).format(at);
    const days = [];
    for (const session of sessions) {
      const day = dayOf(session.start);
      if (days.at(-1)?.day !== day) days.push({ day, sessions: [] });
      days.at(-1).sessions.push(session);
    }
    return html`
      <div class="ranges" data-conn-ranges>
        ${CONNECTION_DAYS.map(
          (count) => html`<button class=${count === this._days ? "on" : ""} data-conn-days=${count} @click=${() => (this._days = count)}>
            ${this._t(count === 1 ? "conn_day" : "conn_week")}
          </button>`,
        )}
      </div>
      ${this._rows === null
        ? html`<p class="hint">${this._t("chart_loading")}</p>`
        : html`
            <div class="totals" data-conn-totals>
              <span><small>${this._t(main.kind === "link" ? "conn_wakes" : "conn_streams")}</small><strong>${totals.count}</strong></span>
              <span><small>${this._t("conn_awake")}</small><strong>${formatSeconds(totals.seconds, language)}</strong></span>
              <span><small>${this._t("conn_long")}</small><strong>${sessions.filter((s) => s.id === main.id && s.seconds > LONG_CONNECTION_S).length}</strong></span>
            </div>
            ${sessions.length ? nothing : html`<p class="hint" data-conn-empty>${this._t("conn_none")}</p>`}
            ${days.map(
              ({ day, sessions: list }) => html`
                <h4>${day}</h4>
                ${list.map(
                  (session) => html`
                    <div class="row ${session.seconds > LONG_CONNECTION_S ? "long" : ""} ${session.end ? "" : "open"}"
                      data-conn-row=${session.kind}>
                      <span class="when">${time(session.start)}${session.end ? html` – ${time(session.end)}` : html` – ${this._t("conn_now")}`}</span>
                      <span class="kind">${this._t(`conn_kind_${session.kind}`)}</span>
                      <strong>${formatSeconds(session.seconds, language)}</strong>
                    </div>
                  `,
                )}
              `,
            )}
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
        padding: 4px 0 12px;
      }
      button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
      }
      small,
      .hint,
      h4 {
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
      .totals {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .totals span {
        display: flex;
        flex-direction: column;
        padding: 10px 12px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .totals strong {
        font-size: 17px;
        font-weight: 500;
      }
      h4 {
        margin: 10px 0 0;
        font-size: 13px;
        font-weight: 500;
      }
      h4::first-letter {
        text-transform: uppercase;
      }
      .row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 14px;
        background: var(--hd-off);
        font-variant-numeric: tabular-nums;
      }
      .kind {
        font-size: 12px;
        color: var(--hd-text-muted);
      }
      .row strong {
        min-width: 72px;
        font-weight: 500;
        text-align: right;
      }
      /* Left open for long: what drains a battery. */
      .row.long {
        background: color-mix(in srgb, #ff453a 18%, var(--hd-off));
      }
      .row.long strong {
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
