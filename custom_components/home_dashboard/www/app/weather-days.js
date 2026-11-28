// A chosen day of the forecast in the weather window. The hours of a forecast end sooner than its days (Met.no: 48
// hours), so a day with hours is drawn by the hour and a farther one among the days, with a note about it.

import { css, html, nothing, svg } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { weatherIcon } from "./model.js";

/** What falls in a forecast step, by its condition: snow, rain and snow, or rain. */
export function precipitationKind(condition) {
  if (condition === "snowy") return "snow";
  if (condition === "snowy-rainy") return "mix";
  return "rain";
}

export const lowOf = (day) => day.templow ?? day.temperature;

const midnight = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** How many calendar days a moment is from today: 0 today, 1 tomorrow, below 0 the past. */
export const daysAhead = (datetime, now = new Date()) =>
  Math.round((midnight(new Date(datetime)) - midnight(now)) / 86_400_000);

/** The hours of the forecast that fall on the day so many days ahead. */
export const hoursOfDay = (hourly, ahead, now = new Date()) =>
  (hourly ?? []).filter((hour) => daysAhead(hour.datetime, now) === ahead);

/** The days after today a person can choose, the nearest first, without gaps in front of them. */
export function daysToChoose(days, now = new Date()) {
  return (days ?? []).map((day) => daysAhead(day.datetime, now)).filter((ahead) => ahead > 0).sort((a, b) => a - b);
}

export const WeatherDays = (Base) =>
  class extends Base {
    static properties = { _ahead: { state: true } };

    get _choices() {
      return this.item?.forecast ? daysToChoose(this._shownDays) : [];
    }

    _chosen(ahead) {
      return this._shownDays.find((day) => daysAhead(day.datetime) === ahead);
    }

    _dayName(day, options = { weekday: "long", day: "numeric", month: "long" }) {
      const name = new Intl.DateTimeFormat(this.hass.language, options).format(new Date(day.datetime));
      return daysAhead(day.datetime) === 1 ? `${this._t("weather_tomorrow")}, ${name}` : name;
    }

    _conditionName(condition) {
      const stateObj = this.hass.states[this.item.forecast];
      return (condition && this.hass.formatEntityState?.(stateObj, condition)) || condition || "";
    }

    _renderDayParts(day, hours) {
      const { limit } = this.item.history ?? {};
      const unit = this.hass.states[this.item.forecast]?.attributes.wind_speed_unit ?? "";
      // With all the hours the numbers come from them, so that they agree with the chart over them.
      const whole = hours.length >= 23;
      const temps = whole ? hours.map((hour) => hour.temperature) : [lowOf(day), day.temperature];
      const rain = whole ? hours.reduce((sum, hour) => sum + (hour.precipitation ?? 0), 0) : day.precipitation;
      const part = (key, icon, label, value) => html`
        <span data-weather-day-part=${key}><ha-icon .icon=${icon}></ha-icon><small>${label}</small><b>${value}</b></span>
      `;
      return html`
        <div class="parts" data-weather-day-parts>
          ${day.condition
            ? part("condition", weatherIcon(day.condition), "", this._conditionName(day.condition))
            : nothing}
          ${part("range", "mdi:thermometer", this._t("weather_low_high"), `${this._degrees(Math.min(...temps))} – ${this._degrees(Math.max(...temps))}`)}
          ${typeof rain === "number"
            ? part("rain", "mdi:water", this._t("weather_rainfall"), `${this._number(rain)} mm`)
            : nothing}
          ${typeof day.wind_speed === "number"
            ? part("wind", "mdi:weather-windy", this._t("weather_wind"), `${this._number(day.wind_speed)} ${unit}`)
            : nothing}
          ${typeof day.humidity === "number"
            ? part("humidity", "mdi:water-percent", this._t("weather_humidity"), `${this._number(day.humidity, 0)} %`)
            : nothing}
          ${Number.isFinite(limit) && whole
            ? part(
                "cold",
                "mdi:snowflake-thermometer",
                translate(this.hass.language, "weather_forecast_below", { value: this._number(limit) }),
                `${hours.filter((hour) => hour.temperature < limit).length} h`,
              )
            : nothing}
        </div>
      `;
    }

    // Why a day has fewer hours than 24, or none.
    _renderHoursNote(hours) {
      if (hours.length >= 23) return nothing;
      const last = hours.length > 1 ? hours.at(-1) : null;
      const clock = new Intl.DateTimeFormat(this.hass.language, { hour: "2-digit", minute: "2-digit" });
      return html`<span data-weather-hours-note>
        ${last
          ? translate(this.hass.language, "weather_hours_until", { time: clock.format(new Date(last.datetime)) })
          : this._t("weather_no_hours")}
      </span>`;
    }

    _renderChosenDay(ahead) {
      const day = this._chosen(ahead);
      if (!day) return nothing;
      const hours = hoursOfDay(this._hourly, ahead);
      const facts = this._renderDayParts(day, hours);
      const note = this._renderHoursNote(hours);
      if (hours.length > 1) return this._renderHoursChart(hours, { label: this._dayName(day), day: true, facts, note });
      return this._renderDaysChart(day, facts, note);
    }

    // The highs and lows of the days with the chosen one marked: for a day without hours.
    _renderDaysChart(chosen, facts, note) {
      const days = this._shownDays;
      const { width, height, top, bottom, rainTop, rainBottom } = this._dims;
      const { limit } = this.item.history ?? {};
      const bounds = [...days.map((day) => day.temperature), ...days.map(lowOf), ...(Number.isFinite(limit) ? [limit] : [])];
      const low = Math.min(...bounds) - 1;
      const high = Math.max(...bounds) + 1;
      const step = (width - 20) / days.length;
      const x = (index) => 10 + step * (index + 0.5);
      const y = (value) => bottom - ((value - low) / (high - low)) * (bottom - top);
      const path = (value) =>
        days.map((day, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value(day)).toFixed(1)}`).join(" ");
      const scale = Math.max(1, ...days.map((day) => day.precipitation ?? 0));
      const bar = Math.min(40, step * 0.4);
      const name = new Intl.DateTimeFormat(this.hass.language, { weekday: "short" });
      const plot = html`<svg class="chart" viewBox="0 0 ${width} ${height}">
        <rect x=${x(days.indexOf(chosen)) - step / 2} y="0" width=${step} height=${height} rx="14" class="chosen"></rect>
        ${this._renderLimit(limit, y)}
        <path d=${path((day) => day.temperature)} class="line"></path>
        <path d=${path(lowOf)} class="line cool"></path>
        <line x1="10" x2=${width - 10} y1=${rainBottom} y2=${rainBottom} class="base"></line>
        <text x="10" y=${rainTop - 8} class="axis">${this._t("weather_precipitation_day")}</text>
        ${days.map((day, index) => {
          const rain = day.precipitation ?? 0;
          const tall = rain ? Math.max(4, (rain / scale) * (rainBottom - rainTop - 16)) : 0;
          return svg`
            ${rain
              ? svg`<rect x=${x(index) - bar / 2} y=${rainBottom - tall} width=${bar} height=${tall} rx="3" class=${precipitationKind(day.condition)}></rect>
                <text x=${x(index)} y=${rainBottom - tall - 5} class="amount">${this._number(rain)}</text>`
              : nothing}
            <text x=${x(index)} y=${y(day.temperature) - 10} class="temperature">${this._number(day.temperature, 0)}°</text>
            <text x=${x(index)} y=${y(lowOf(day)) + 20} class="temperature">${this._number(lowOf(day), 0)}°</text>
            <text x=${x(index)} y=${height - 6} class="hour">${daysAhead(day.datetime) === 0 ? this._t("weather_today") : name.format(new Date(day.datetime))}</text>
          `;
        })}
      </svg>`;
      return this._renderFrame({
        kind: "days",
        label: this._dayName(chosen),
        icons: days.map((day, index) => ({ x: x(index), condition: day.condition })),
        plot,
        legend: html`<span><i class="high"></i>${this._t("weather_day_high")}</span>
          <span><i class="low"></i>${this._t("weather_day_low")}</span> ${this._forecastLegend()}`,
        facts,
        note,
      });
    }

    _renderLimit(limit, y) {
      if (!Number.isFinite(limit)) return nothing;
      return svg`<line x1="10" x2=${this._dims.width - 10} y1=${y(limit)} y2=${y(limit)} class="limit" data-weather-limit></line>
        <text x="10" y=${y(limit) - 5} class="limit-label">${this._degrees(limit)}</text>`;
    }

    // A phone: the hours of the day open under its row.
    _renderDayDetails(ahead) {
      const day = this._chosen(ahead);
      if (!day) return nothing;
      const hours = hoursOfDay(this._hourly, ahead);
      return html`
        <div class="day-details" data-weather-day-details>
          ${hours.length > 1 ? this._renderHourStrip(hours) : nothing} ${this._renderDayParts(day, hours)}
          ${ahead > 0 ? this._renderHoursNote(hours) : nothing}
        </div>
      `;
    }
  };

export const daysStyles = css`
  button.column,
  button.day {
    border: 0;
    background-color: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button.column {
    background: var(--hd-surface, rgba(255, 255, 255, 0.08));
  }
  button.day {
    width: 100%;
    font-size: 15px;
    text-align: start;
  }
  .legend i.high,
  .legend i.low,
  .legend i.mean,
  .legend i.band {
    height: 4px;
    vertical-align: 3px;
  }
  .legend i.high,
  .legend i.mean {
    background: #ffb703;
  }
  .legend i.low {
    background: #5ab0ff;
  }
  .legend i.band {
    height: 12px;
    vertical-align: -1px;
    background: color-mix(in srgb, #ffb703 35%, transparent);
  }
  .chart .line.cool {
    stroke: #5ab0ff;
  }
  .chart .chosen {
    fill: currentColor;
    opacity: 0.1;
  }
  .day-details {
    padding: 0 12px 12px;
    min-width: 0;
  }
  .day-details .hours {
    margin: 0 -12px;
    padding: 0 12px;
  }
  .day-details .hour {
    background: var(--hd-surface);
  }
`;
