// The departures screen: the next vehicle large, and under it every line with its coming times.
// The times come from sensors that keep them in a `list` attribute.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const SECONDS_IN_MINUTE = 60;

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

export function nextDeparture(lines) {
  const coming = lines.flatMap(({ line, direction, times }) => times.map((time) => ({ ...time, line, direction })));
  return coming.sort((first, second) => first.minutes - second.minutes)[0] ?? null;
}

export class HomeDashboardDepartures extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
  };

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

  render() {
    if (!this.hass || !this.item) return nothing;
    const lines = departureLines(this.hass, this.item.entities);
    const next = nextDeparture(lines);
    return html`
      <div class="content">
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
    `,
  ];
}
