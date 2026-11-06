// The weather screen. The forecast does not live in the entity's state: Home Assistant sends it
// only to those who subscribe, so this element holds the subscriptions for as long as it is open.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { FORECAST_DAILY, FORECAST_HOURLY, weatherIcon } from "./model.js";
import { tokens } from "./styles.js";

const HOURS_SHOWN = 24;
const DAYS_SHOWN = 7;
const FACTS = [
  { key: "apparent_temperature", label: "weather_feels_like", icon: "mdi:thermometer", unit: "temperature_unit" },
  { key: "humidity", label: "weather_humidity", icon: "mdi:water-percent", fixedUnit: "%" },
  { key: "pressure", label: "weather_pressure", icon: "mdi:gauge", unit: "pressure_unit" },
  { key: "wind_speed", label: "weather_wind", icon: "mdi:weather-windy", unit: "wind_speed_unit" },
  { key: "cloud_coverage", label: "weather_clouds", icon: "mdi:cloud-outline", fixedUnit: "%" },
  { key: "dew_point", label: "weather_dew_point", icon: "mdi:thermometer-water", unit: "temperature_unit" },
  { key: "uv_index", label: "weather_uv", icon: "mdi:sun-wireless-outline" },
  { key: "visibility", label: "weather_visibility", icon: "mdi:eye-outline", unit: "visibility_unit" },
];

const isSameDay = (first, second) => first.toDateString() === second.toDateString();

// A station often measures only part of this, so the rest comes from the forecast entity.
export function weatherFacts(current, forecast) {
  return FACTS.flatMap((fact) => {
    const source = [current, forecast].find((attributes) => typeof attributes?.[fact.key] === "number");
    if (!source) return [];
    return [{ ...fact, value: source[fact.key], unit: fact.fixedUnit ?? source[fact.unit] ?? "" }];
  });
}

export class HomeDashboardWeather extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    _hourly: { state: true },
    _daily: { state: true },
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this._watches?.forEach((watch) => watch.then((unsubscribe) => unsubscribe?.()).catch(() => {}));
    this._watches = null;
  }

  updated() {
    if (this._watches || !this.hass || !this.item) return;
    this._watches = [];
    const features = this.hass.states[this.item.forecast]?.attributes.supported_features ?? 0;
    if (features & FORECAST_HOURLY) this._watch("hourly");
    if (features & FORECAST_DAILY) this._watch("daily");
  }

  _watch(type) {
    const watch = this.hass.connection?.subscribeMessage(
      (event) => {
        this[`_${type}`] = event.forecast ?? [];
      },
      { type: "weather/subscribe_forecast", forecast_type: type, entity_id: this.item.forecast },
    );
    if (watch) this._watches.push(watch);
  }

  _t(key) {
    return translate(this.hass.language, key);
  }

  _number(value, digits = 1) {
    return new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: digits }).format(value);
  }

  _renderNow() {
    const stateObj = this.hass.states[this.item.entity];
    const { temperature } = stateObj.attributes;
    return html`
      <div class="now" data-weather-now>
        <ha-icon .icon=${weatherIcon(stateObj.state)}></ha-icon>
        <div>
          <strong>${typeof temperature === "number" ? `${this._number(temperature)}°` : this._t("no_data")}</strong>
          <span>${this.hass.formatEntityState?.(stateObj) ?? stateObj.state}</span>
        </div>
      </div>
    `;
  }

  _renderFacts() {
    const facts = weatherFacts(
      this.hass.states[this.item.entity].attributes,
      this.hass.states[this.item.forecast]?.attributes,
    );
    if (!facts.length) return nothing;
    return html`
      <div class="facts">
        ${facts.map(
          (fact) => html`
            <div class="fact" data-weather-fact=${fact.key}>
              <ha-icon .icon=${fact.icon}></ha-icon>
              <span>
                <small>${this._t(fact.label)}</small>
                <strong>${this._number(fact.value)} ${fact.unit}</strong>
              </span>
            </div>
          `,
        )}
      </div>
    `;
  }

  _renderHourly() {
    const hours = (this._hourly ?? []).slice(0, HOURS_SHOWN);
    if (!hours.length) return nothing;
    const format = new Intl.DateTimeFormat(this.hass.language, { hour: "2-digit", minute: "2-digit" });
    return html`
      <section>
        <h3>${this._t("weather_hourly")}</h3>
        <div class="hours">
          ${hours.map(
            (hour) => html`
              <div class="hour" data-weather-hour>
                <small>${format.format(new Date(hour.datetime))}</small>
                <ha-icon .icon=${weatherIcon(hour.condition)}></ha-icon>
                <strong>${this._number(hour.temperature, 0)}°</strong>
                <small class="rain">${hour.precipitation ? `${this._number(hour.precipitation)} mm` : ""}</small>
              </div>
            `,
          )}
        </div>
      </section>
    `;
  }

  // The bars share one scale, so a warm day stands out from the whole week at a glance.
  _renderDaily() {
    const days = (this._daily ?? []).slice(0, DAYS_SHOWN);
    if (!days.length) return nothing;
    const lowOf = (day) => day.templow ?? day.temperature;
    const lowest = Math.min(...days.map(lowOf));
    const range = Math.max(...days.map((day) => day.temperature)) - lowest || 1;
    const format = new Intl.DateTimeFormat(this.hass.language, { weekday: "short" });
    const today = new Date();
    return html`
      <section>
        <h3>${this._t("weather_daily")}</h3>
        <div class="days">
          ${days.map((day) => {
            const date = new Date(day.datetime);
            const start = ((lowOf(day) - lowest) / range) * 100;
            const width = ((day.temperature - lowOf(day)) / range) * 100;
            return html`
              <div class="day" data-weather-day>
                <span class="name">${isSameDay(date, today) ? this._t("weather_today") : format.format(date)}</span>
                <ha-icon .icon=${weatherIcon(day.condition)}></ha-icon>
                <small class="rain">${day.precipitation ? `${this._number(day.precipitation)} mm` : ""}</small>
                <span class="low">${this._number(lowOf(day), 0)}°</span>
                <span class="bar"><i style="left: ${start}%; width: ${Math.max(width, 4)}%"></i></span>
                <strong>${this._number(day.temperature, 0)}°</strong>
              </div>
            `;
          })}
        </div>
      </section>
    `;
  }

  render() {
    if (!this.hass || !this.item || !this.hass.states[this.item.entity]) return nothing;
    return html`
      <div class="content">
        ${this._renderNow()} ${this._renderFacts()} ${this._renderHourly()} ${this._renderDaily()}
        ${this.item.forecast ? nothing : html`<p data-weather-empty>${this._t("weather_no_forecast")}</p>`}
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
      .now {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 8px 0;
      }
      .now ha-icon {
        --mdc-icon-size: 72px;
        color: var(--hd-media-chip);
      }
      .now div {
        display: flex;
        flex-direction: column;
      }
      .now strong {
        font-size: 44px;
        font-weight: 500;
        line-height: 52px;
      }
      .now span {
        color: var(--hd-text-muted);
        font-size: 15px;
      }
      .facts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .fact {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .fact ha-icon {
        flex: none;
        color: var(--hd-text-muted);
      }
      .fact span {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .fact small {
        color: var(--hd-text-muted);
        font-size: 12px;
        line-height: 16px;
      }
      .fact strong {
        font-size: 15px;
        font-weight: 500;
      }
      h3 {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 500;
      }
      .hours {
        display: flex;
        gap: 8px;
        margin: 0 -16px;
        padding: 0 16px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .hour {
        display: flex;
        flex: none;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        min-width: 60px;
        padding: 10px 6px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .hour small {
        color: var(--hd-text-muted);
        font-size: 12px;
        line-height: 16px;
      }
      .hour ha-icon,
      .day ha-icon {
        color: var(--hd-media-chip);
      }
      .hour strong {
        font-size: 15px;
        font-weight: 500;
      }
      .hour .rain {
        min-height: 16px;
      }
      .days {
        display: flex;
        flex-direction: column;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .day {
        display: grid;
        grid-template-columns: 56px 28px 48px 32px 1fr 32px;
        align-items: center;
        gap: 6px;
        padding: 10px 12px;
        font-size: 15px;
      }
      .day .rain,
      .day .low {
        color: var(--hd-text-muted);
      }
      .day .rain {
        font-size: 12px;
      }
      .day .low {
        text-align: right;
      }
      .day strong {
        font-weight: 500;
      }
      .bar {
        position: relative;
        height: 6px;
        border-radius: 3px;
        background: var(--hd-off-icon);
      }
      .bar i {
        position: absolute;
        top: 0;
        bottom: 0;
        border-radius: 3px;
        background: var(--hd-media-chip);
      }
      p {
        margin: 0;
        color: var(--hd-text-muted);
        text-align: center;
      }
    `,
  ];
}
