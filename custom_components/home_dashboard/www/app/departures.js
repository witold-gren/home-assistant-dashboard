// The departures screen: the next vehicle large, and under it every line with its coming times.
// The times come from sensors that keep them in a `list` attribute.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const SECONDS_IN_MINUTE = 60;
// A tablet on its side shows the departures on the whole screen: the next one large, all of them in order, the next
// hour as a line of time a row per line, and a card per line with every time the timetable gives.
export const WIDE_DEPARTURES = "(orientation: landscape) and (min-width: 900px) and (min-height: 501px)";
// Lines get a colour of their own, the same everywhere in the window; `colors` in the shortcut chooses them by hand.
const LINE_COLOURS = ["#ff9f0a", "#30d158", "#0a84ff", "#bf5af2", "#ff375f", "#64d2ff", "#ffd60a", "#ac8e68"];
const UPCOMING = 8;

/** The colour of each line, in the order they come, or as the shortcut sets them. */
export function lineColours(lines, chosen = {}) {
  const colours = new Map();
  for (const { line } of lines) {
    if (!colours.has(line)) colours.set(line, chosen[line] ?? LINE_COLOURS[colours.size % LINE_COLOURS.length]);
  }
  return colours;
}

/** The span of the line of time, in minutes: an hour, longer to show the last departure up to two hours. */
export function timelineSpan(lines) {
  const last = Math.max(0, ...lines.flatMap(({ times }) => times.map(({ minutes }) => minutes)));
  return Math.min(120, Math.max(60, Math.ceil(last / 15) * 15));
}

// Some timetables shout their stop names, and the screen capitalises them itself.
const quiet = (name, language) => (name === name.toLocaleUpperCase(language) ? name.toLocaleLowerCase(language) : name);

export function departureLines(hass, entities) {
  const lines = new Map();
  for (const entityId of entities ?? []) {
    for (const item of hass.states[entityId]?.attributes.list ?? []) {
      const direction = quiet(item.direction ?? "", hass.language);
      const key = `${item.line}|${direction}`;
      if (!lines.has(key)) lines.set(key, { key, line: item.line, direction, times: [] });
      lines.get(key).times.push({
        departure: item.departure,
        minutes: item.time_to_departure,
        late: Math.floor((item.delay ?? 0) / SECONDS_IN_MINUTE),
      });
    }
  }
  return [...lines.values()].filter(({ times }) => times.length);
}

/** The notices of the timetable (`news`: an entity keeping them as texts in `list`), while there are any. */
export function departureNews(hass, entityId) {
  const list = entityId ? hass.states[entityId]?.attributes?.list : null;
  return Array.isArray(list) ? list.map((text) => String(text ?? "").trim()).filter(Boolean) : [];
}

export function nextDeparture(lines) {
  const coming = lines.flatMap(({ line, direction, times }) => times.map((time) => ({ ...time, line, direction })));
  return coming.sort((first, second) => first.minutes - second.minutes)[0] ?? null;
}

export class HomeDashboardDepartures extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
  };

  _wide = window.matchMedia(WIDE_DEPARTURES);

  _redraw = () => this.requestUpdate();

  connectedCallback() {
    super.connectedCallback();
    this._wide.addEventListener("change", this._redraw);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._wide.removeEventListener("change", this._redraw);
  }

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  _wait(minutes) {
    return minutes > 0 ? this._t("departures_minutes", { minutes }) : this._t("departures_now");
  }

  _renderNext(next) {
    return html`
      <div class="next" data-departures-next>
        <ha-icon .icon=${this.item.icon}></ha-icon>
        <div>
          <strong>${this._wait(next.minutes)}</strong>
          <span><b>${next.line}</b> <i>${next.direction}</i> · ${next.departure}</span>
        </div>
      </div>
    `;
  }

  _renderLine({ key, line, direction, times }) {
    return html`
      <section data-departures-line=${key}>
        <h3><b>${line}</b><span>${direction}</span></h3>
        <div class="times">
          ${times.map(
            ({ departure, minutes, late }) => html`
              <div class="time" data-departure>
                <strong>${departure}</strong>
                <small>${this._wait(minutes)}</small>
                ${late > 0 ? html`<small class="late">${this._t("departures_late", { minutes: late })}</small>` : nothing}
              </div>
            `,
          )}
        </div>
      </section>
    `;
  }

  _renderNews() {
    const news = departureNews(this.hass, this.item.news);
    if (!news.length) return nothing;
    return html`
      <section class="news" data-departures-news>
        <h4><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${this._t("departures_news")}</h4>
        ${news.map((text) => html`<p>${text}</p>`)}
      </section>
    `;
  }

  _badge(line, colours, size = 34) {
    return html`<span class="badge" style="background: ${colours.get(line)}; --size: ${size}px">${line}</span>`;
  }

  _renderWide(lines, next) {
    const colours = lineColours(lines, this.item.colors);
    const coming = lines
      .flatMap(({ line, direction, times }) => times.map((time) => ({ ...time, line, direction })))
      .sort((first, second) => first.minutes - second.minutes);
    const span = timelineSpan(lines);
    const ticks = Array.from({ length: span / 15 + 1 }, (_, index) => index * 15);
    return html`
      <div class="wide" data-departures-wide>
        <div class="side">
          <section class="card next-card" data-departures-next>
            <h4>${this._t("departures_next")}</h4>
            <div class="next-line">${this._badge(next.line, colours, 56)}<span>${next.direction}</span></div>
            <strong class="wait">${this._wait(next.minutes)}</strong>
            <span class="at">${this._t("departures_at", { time: next.departure })}</span>
            <span class="state ${next.late > 0 ? "late" : ""}" data-departures-state>
              ${next.late > 0 ? this._t("departures_late", { minutes: next.late }) : this._t("departures_on_time")}
            </span>
          </section>
          <section class="card" data-departures-coming>
            <h4>${this._t("departures_coming")}</h4>
            ${coming.slice(0, UPCOMING).map(
              (time) => html`<div class="coming" data-departures-coming-row>
                ${this._badge(time.line, colours, 30)}<span class="direction">${time.direction}</span><b>${time.departure}</b
                ><small>${this._wait(time.minutes)}</small>
              </div>`,
            )}
          </section>
        </div>
        <div class="main">
          ${this._renderNews()}
          <section class="card" data-departures-timeline>
            <h4>${this._t("departures_hour", { minutes: span })}</h4>
            <div class="axis">
              ${ticks.map(
                (tick) => html`<span style="left: ${(tick / span) * 100}%"
                  >${tick ? `+${tick} min` : this._t("departures_now")}</span
                >`,
              )}
            </div>
            ${lines.map(
              ({ key, line, direction, times }) => html`<div class="row">
                <span class="label">${this._badge(line, colours, 30)}<span>${direction}</span></span>
                <span class="track">
                  ${times
                    .filter(({ minutes }) => minutes <= span)
                    .map(
                      ({ departure, minutes }) => html`<span
                        class="mark"
                        data-departures-mark=${key}
                        style="left: ${(Math.max(0, minutes) / span) * 100}%; background: ${colours.get(line)}"
                        >${departure}</span
                      >`,
                    )}
                </span>
              </div>`,
            )}
          </section>
          <div class="cards" style="--lines: ${Math.min(lines.length, 4)}">
            ${lines.map(
              ({ key, line, direction, times }) => html`<section class="card line-card" data-departures-line=${key}>
                <div class="line-head">${this._badge(line, colours, 38)}<span>${direction}</span></div>
                ${times.map(
                  ({ departure, minutes, late }) => html`<div class="slot" data-departure>
                    <strong>${departure}</strong>
                    <small class=${late > 0 ? "late" : ""}>
                      ${late > 0 ? this._t("departures_late", { minutes: late }) : this._wait(minutes)}
                    </small>
                  </div>`,
                )}
              </section>`,
            )}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.hass || !this.item) return nothing;
    const lines = departureLines(this.hass, this.item.entities);
    const next = nextDeparture(lines);
    if (next && this._wide.matches) return this._renderWide(lines, next);
    return html`
      <div class="content">
        ${this._renderNews()}
        ${next
          ? html`${this._renderNext(next)} ${lines.map((line) => this._renderLine(line))}`
          : html`<p data-departures-empty>${this._t("departures_none")}</p>`}
      </div>
    `;
  }

  static styles = [
    tokens,
    css`
      .content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 0 16px 16px;
        color: var(--hd-text);
      }
      .next {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 8px 0;
      }
      .next ha-icon {
        flex: none;
        --mdc-icon-size: 72px;
        color: var(--hd-media-chip);
      }
      .next div {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .next strong {
        font-size: 44px;
        font-weight: 500;
        line-height: 52px;
      }
      .next span {
        color: var(--hd-text-muted);
        font-size: 15px;
      }
      .next b {
        font-weight: 500;
      }
      .next i {
        font-style: normal;
        text-transform: capitalize;
      }
      h3 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 500;
      }
      h3 b {
        display: grid;
        flex: none;
        place-items: center;
        min-width: 32px;
        height: 32px;
        padding: 0 6px;
        box-sizing: border-box;
        border-radius: 16px;
        color: #ffffff;
        background: var(--hd-media-chip);
        font-size: 15px;
        font-weight: 500;
      }
      h3 span {
        min-width: 0;
        text-transform: capitalize;
      }
      .times {
        display: flex;
        gap: 8px;
        margin: 0 -16px;
        padding: 0 16px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .time {
        display: flex;
        flex: 1 0 84px;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 10px 6px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .time strong {
        font-size: 17px;
        font-weight: 500;
      }
      .time small {
        color: var(--hd-text-muted);
        font-size: 12px;
        line-height: 16px;
      }
      .time .late {
        color: var(--hd-security-ink);
      }
      p {
        margin: 0;
        color: var(--hd-text-muted);
        text-align: center;
      }
      /* A tablet on its side ---------------------------------------------------------------------------------- */
      .wide {
        display: grid;
        grid-template-columns: 340px minmax(0, 1fr);
        gap: 16px;
        align-items: start;
        padding: 0 20px 20px;
        color: var(--hd-text);
      }
      .side,
      .main {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
      }
      .card {
        display: flex;
        flex-direction: column;
        padding: 16px 18px;
        border-radius: 28px;
        background: var(--hd-off);
      }
      h4 {
        margin: 0 0 12px;
        font-size: 15px;
        font-weight: 500;
        color: var(--hd-text-muted);
      }
      .badge {
        display: inline-grid;
        flex: none;
        place-items: center;
        width: var(--size);
        height: var(--size);
        border-radius: 50%;
        color: #ffffff;
        font-size: calc(var(--size) * 0.45);
        font-weight: 700;
      }
      .next-line {
        display: flex;
        gap: 14px;
        align-items: center;
        font-size: 22px;
        font-weight: 500;
        text-transform: capitalize;
      }
      .wait {
        margin-top: 14px;
        font-size: 64px;
        font-weight: 300;
        line-height: 1;
      }
      .at {
        margin-top: 6px;
        color: var(--hd-text-muted);
      }
      .state {
        align-self: flex-start;
        margin-top: 12px;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 13px;
        color: color-mix(in srgb, #30d158 65%, var(--hd-text));
        background: rgba(48, 209, 88, 0.22);
      }
      .state.late {
        color: var(--hd-security-ink);
        background: var(--hd-security);
      }
      .coming {
        display: grid;
        grid-template-columns: 30px minmax(0, 1fr) auto 64px;
        gap: 10px;
        align-items: center;
        padding: 7px 0;
        border-bottom: 1px solid var(--hd-outline);
      }
      .coming:last-child {
        border-bottom: 0;
      }
      .coming .direction {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-transform: capitalize;
      }
      .coming b {
        font-weight: 500;
      }
      .coming small {
        text-align: right;
        color: var(--hd-text-muted);
      }
      .axis {
        position: relative;
        height: 20px;
        margin: 0 24px 0 170px;
        font-size: 12px;
        color: var(--hd-text-muted);
      }
      .axis span {
        position: absolute;
        white-space: nowrap;
        transform: translateX(-50%);
      }
      .row {
        display: flex;
        align-items: center;
        height: 54px;
        padding-right: 24px;
      }
      .label {
        display: flex;
        flex: none;
        gap: 10px;
        align-items: center;
        width: 170px;
        text-transform: capitalize;
      }
      .track {
        position: relative;
        flex: 1;
        height: 6px;
        border-radius: 3px;
        background: var(--hd-outline);
      }
      .track::before {
        position: absolute;
        top: -14px;
        bottom: -14px;
        left: 0;
        width: 2px;
        content: "";
        background: currentColor;
        opacity: 0.5;
      }
      .mark {
        position: absolute;
        top: 50%;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        color: #ffffff;
        transform: translate(-50%, -50%);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(var(--lines, 3), minmax(0, 1fr));
        gap: 12px;
      }
      .line-card {
        gap: 8px;
      }
      .line-head {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 4px;
        font-size: 18px;
        font-weight: 500;
        text-transform: capitalize;
      }
      .slot {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        padding: 9px 12px;
        border-radius: 14px;
        background: var(--hd-surface, rgba(255, 255, 255, 0.1));
      }
      .slot strong {
        font-size: 20px;
        font-weight: 500;
      }
      .slot small {
        color: var(--hd-text-muted);
      }
      .slot .late {
        color: var(--hd-security-ink);
      }
      /* The timetable's notices: a warm card, only while there are any. */
      .news {
        padding: 14px 18px;
        border-radius: 24px;
        color: var(--hd-text);
        background: color-mix(in srgb, #ff9f0a 28%, var(--hd-off));
      }
      .news h4 {
        display: flex;
        gap: 8px;
        align-items: center;
        margin: 0 0 6px;
        color: inherit;
        --mdc-icon-size: 20px;
      }
      .news p {
        margin: 6px 0 0;
        font-size: 15px;
        line-height: 21px;
        text-align: left;
      }
    `,
  ];
}
