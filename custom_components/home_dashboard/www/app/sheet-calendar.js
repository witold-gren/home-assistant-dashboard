// The window of the calendars: a month on a tablet, with the events of the day chosen beside it; a list of days on a
// phone, with the place and the description of each event. Under the gear a person chooses their own calendars and
// whether they see the home's. A part of the sheet (sheet.js), as a mixin of its methods.

import { css, html, nothing } from "../vendor/lit-all.min.js";
import {
  addDays,
  agendaDays,
  allCalendars,
  cachedEvents,
  calendarColour,
  calendarName,
  dayTitle,
  eventsOn,
  homeCalendars,
  isNow,
  todayEvents,
  LIST_DAYS,
  monthWeeks,
  personCalendars,
  sameDay,
  shownCalendars,
  startOfDay,
  timeText,
} from "./calendar.js";
import { personalPrefs, savePrefs } from "./prefs.js";
import { TABLET } from "./sheet-shared.js";
import { mediaQuery } from "./media.js";

const WEEKDAY_BASE = new Date(2026, 10, 16); // a Monday

export const CalendarSheets = (Base) =>
  class extends Base {
    get _calendarState() {
      return this._calendar ?? { month: null, day: null, hidden: [], events: null, key: null, settings: false };
    }

    _setCalendar(change) {
      this._calendar = { ...this._calendarState, ...change };
    }

    _calendarIds() {
      return shownCalendars(this.hass, this.raw ?? this.config, personalPrefs());
    }

    // The events of what the window shows: the six weeks of the month on a tablet, two weeks from today on a phone.
    async _loadCalendar(month, wide) {
      const ids = this._calendarIds();
      const today = startOfDay(new Date());
      const weeks = monthWeeks(month.getFullYear(), month.getMonth());
      const from = wide ? weeks[0][0].date : today;
      const to = wide ? addDays(weeks[5][6].date, 1) : addDays(today, LIST_DAYS);
      const key = `${ids.join(",")}|${from.getTime()}|${to.getTime()}`;
      if (this._calendarState.key === key) return;
      this._setCalendar({ key, events: null });
      const events = await cachedEvents(this.hass, ids, from, to);
      if (this._calendarState.key === key) this._setCalendar({ events });
    }

    // After a render: the events of what is shown, once per month or list (sheet.js calls it from updated).
    _syncCalendar() {
      if (this.sheet?.kind === "rooms") return this._loadCalendarToday();
      if (this.sheet?.kind !== "calendar" || this._calendarState.settings) return;
      const today = startOfDay(new Date());
      this._loadCalendar(this._calendarState.month ?? new Date(today.getFullYear(), today.getMonth(), 1), mediaQuery(TABLET).matches);
    }

    // The list of areas says what today holds: the titles still to come and how many.
    async _loadCalendarToday() {
      const ids = this._calendarIds();
      const today = startOfDay(new Date());
      const key = `today|${ids.join(",")}|${today.getTime()}`;
      if (this._calendarState.key === key) return;
      this._setCalendar({ key, events: null });
      const events = ids.length ? await cachedEvents(this.hass, ids, today, addDays(today, 1)) : [];
      if (this._calendarState.key === key) this._setCalendar({ events });
    }

    _renderCalendarLink() {
      const events = todayEvents(this._calendarState.events ?? [], new Date());
      const language = this.hass.language;
      const titles = events
        .slice(0, 2)
        .map((event) => (event.allDay ? event.summary : `${timeText(event.start, language)} ${event.summary}`))
        .join(", ");
      return html`
        <h3 class="rooms-group">${this._t("calendar_group")}</h3>
        <button class="row off" data-calendar-link @click=${() => this._change({ kind: "calendar", back: this.sheet })}>
          <span class="row-icon"><ha-icon icon="mdi:calendar-month"></ha-icon></span>
          <span class="row-text"><strong>${this._t("calendar_mine")}</strong>${titles
            ? html`<small>${this._t("calendar_today_titles", { titles })}</small>`
            : nothing}</span>
          ${events.length ? html`<span class="cal-count" data-calendar-count>${events.length}</span>` : nothing}
        </button>
      `;
    }

    _renderCalendarSheet() {
      const state = this._calendarState;
      const wide = mediaQuery(TABLET).matches;
      const today = startOfDay(new Date());
      const month = state.month ?? new Date(today.getFullYear(), today.getMonth(), 1);
      if (state.settings) return this._renderCalendarSettings();
      return wide ? this._renderCalendarMonth(month, today) : this._renderCalendarList(today);
    }

    _calendarEvent(event, withDay = false) {
      const language = this.hass.language;
      const now = new Date();
      const where = [calendarName(this.hass, event.calendar), event.location].filter(Boolean).join(" · ");
      const when = event.allDay
        ? this._t("calendar_all_day")
        : `${timeText(event.start, language)}–${timeText(event.end, language)}`;
      return html`<div
        class="cal-event ${event.allDay ? "all-day" : ""} ${!event.allDay && event.end <= now ? "past" : ""} ${isNow(event, now) ? "now" : ""}"
        style="--event: ${calendarColour(this.hass, this.raw ?? this.config, event.calendar)}"
        data-cal-event=${event.key}
      >
        <i></i>
        <div>
          <strong>${event.summary}</strong>
          <small>${withDay ? `${when} · ${where}` : where}</small>
          ${event.description ? html`<p>${event.description}</p>` : nothing}
        </div>
        ${withDay ? nothing : html`<span class="cal-time">${event.allDay ? this._t("calendar_all_day") : html`${timeText(event.start, language)}<br />${timeText(event.end, language)}`}</span>`}
      </div>`;
    }

    _renderCalendarGear() {
      return html`<button class="cal-gear" data-cal-settings aria-label=${this._t("calendar_settings")} title=${this._t("calendar_settings")}
        @click=${() => this._setCalendar({ settings: true })}><ha-icon icon="mdi:cog-outline"></ha-icon></button>`;
    }

    // A phone: today and the days after it that have something, each event with its place and description.
    _renderCalendarList(today) {
      const state = this._calendarState;
      const ids = this._calendarIds();
      const days = agendaDays(state.events ?? [], today);
      return html`
        ${this._renderHeader(this._t("calendar_mine"), false, false, this._details, this._renderCalendarGear())}
        <div class="cal-list cal-body" data-cal-list>
          ${!ids.length
            ? html`<p class="hint" data-cal-none>${this._t("calendar_none_chosen")}</p>`
            : state.events === null
              ? html`<p class="hint">…</p>`
              : days.map(
                  ({ day, events }) => html`<section data-cal-day=${day.toISOString().slice(0, 10)}>
                    <h3>${dayTitle(day, today, this.hass.language)}</h3>
                    ${events.length ? events.map((event) => this._calendarEvent(event)) : html`<p class="hint">${this._t("calendar_free_day")}</p>`}
                  </section>`,
                )}
        </div>
      `;
    }

    // A tablet: the weeks of the month, today in a red circle, all-day events as bars; the day chosen on the right.
    _renderCalendarMonth(month, today) {
      const state = this._calendarState;
      const language = this.hass.language;
      const config = this.raw ?? this.config;
      const ids = this._calendarIds();
      const hidden = new Set(state.hidden);
      const events = (state.events ?? []).filter((event) => !hidden.has(event.calendar));
      const chosen = state.day ?? (month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear() ? today : month);
      const title = month.toLocaleDateString(language, { month: "long", year: "numeric" });
      const go = (months) => this._setCalendar({ month: new Date(month.getFullYear(), month.getMonth() + months, 1), day: null });
      const weekdays = Array.from({ length: 7 }, (_, index) => addDays(WEEKDAY_BASE, index).toLocaleDateString(language, { weekday: "short" }));
      const chosenEvents = eventsOn(events, chosen);
      return html`
        ${this._renderHeader(title.charAt(0).toLocaleUpperCase(language) + title.slice(1), false, false, this._details, this._renderCalendarGear())}
        <div class="cal-body cal-month-body">
        <div class="cal-bar">
          <div class="cal-legend" data-cal-legend>
            ${ids.map(
              (id) => html`<button class=${hidden.has(id) ? "off" : ""} style="--event: ${calendarColour(this.hass, config, id)}" data-cal-filter=${id}
                @click=${() => this._setCalendar({ hidden: hidden.has(id) ? state.hidden.filter((item) => item !== id) : [...state.hidden, id] })}>
                ${calendarName(this.hass, id)}
              </button>`,
            )}
          </div>
          <div class="cal-nav">
            <button data-cal-prev aria-label="‹" @click=${() => go(-1)}><ha-icon icon="mdi:chevron-left"></ha-icon></button>
            <button data-cal-today @click=${() => this._setCalendar({ month: null, day: null })}>${this._t("calendar_today")}</button>
            <button data-cal-next aria-label="›" @click=${() => go(1)}><ha-icon icon="mdi:chevron-right"></ha-icon></button>
          </div>
        </div>
        ${!ids.length ? html`<p class="hint" data-cal-none>${this._t("calendar_none_chosen")}</p>` : nothing}
        <div class="cal-split">
          <div class="cal-month" data-cal-month>
            ${weekdays.map((name) => html`<span class="cal-dow">${name}</span>`)}
            ${monthWeeks(month.getFullYear(), month.getMonth()).flat().map(({ date, out }) => {
              const dayEvents = eventsOn(events, date);
              return html`<button
                class="cal-day ${out ? "out" : ""} ${sameDay(date, today) ? "today" : ""} ${sameDay(date, chosen) ? "chosen" : ""}"
                data-cal-date=${`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`}
                @click=${() => this._setCalendar({ day: date })}
              >
                <span class="cal-n">${date.getDate()}</span>
                ${dayEvents.slice(0, 3).map(
                  (event) => html`<span class="cal-pill ${event.allDay ? "all-day" : ""}" style="--event: ${calendarColour(this.hass, config, event.calendar)}"
                    >${event.allDay ? event.summary : `${timeText(event.start, language)} ${event.summary}`}</span>`,
                )}
                ${dayEvents.length > 3 ? html`<span class="cal-more">+${dayEvents.length - 3}</span>` : nothing}
              </button>`;
            })}
          </div>
          <div class="cal-agenda" data-cal-agenda>
            <h3>${dayTitle(chosen, today, language)}</h3>
            ${state.events === null
              ? html`<p class="hint">…</p>`
              : chosenEvents.length
                ? chosenEvents.map((event) => this._calendarEvent(event, true))
                : html`<p class="hint">${this._t("calendar_free_day")}</p>`}
          </div>
        </div>
        </div>
      `;
    }

    // Under the gear: the home's calendars on or off, and the person's own, saved in their own settings.
    _renderCalendarSettings() {
      const prefs = personalPrefs();
      const kept = personCalendars(prefs);
      const config = this.raw ?? this.config;
      const home = homeCalendars(this.hass, config);
      const save = (change) => {
        const calendars = { ...kept, ...change };
        savePrefs(this.hass, { ...prefs, calendars })?.catch?.(() => {});
        this.requestUpdate();
      };
      return html`
        ${this._renderHeader(this._t("calendar_settings"), false, false)}
        <div class="cal-settings cal-body" data-cal-settings-list>
          <button class="back-link" data-cal-back @click=${() => this._setCalendar({ settings: false, key: null })}>
            <ha-icon icon="mdi:chevron-left"></ha-icon>${this._t("calendar_mine")}
          </button>
          <label class="cal-option">
            <span><strong>${this._t("calendar_home")}</strong><small>${home.map((id) => calendarName(this.hass, id)).join(", ") || this._t("calendar_home_none")}</small></span>
            <input type="checkbox" role="switch" class="cal-switch" data-cal-home .checked=${kept.home} @change=${(event) => save({ home: event.target.checked })} />
          </label>
          <p class="hint">${this._t("calendar_settings_hint")}</p>
          ${allCalendars(this.hass)
            .filter((id) => !home.includes(id))
            .map(
              (id) => html`<label class="cal-option" style="--event: ${calendarColour(this.hass, config, id)}">
                <i class="dot"></i>
                <span><strong>${calendarName(this.hass, id)}</strong></span>
                <input type="checkbox" class="cal-check" data-cal-own=${id} .checked=${kept.own.includes(id)}
                  @change=${(event) => save({ own: event.target.checked ? [...kept.own, id] : kept.own.filter((item) => item !== id) })} />
              </label>`,
            )}
        </div>
      `;
    }
  };

export const calendarStyles = css`
  /* The gear stands at the end of the header, in line with the buttons under it: no room kept after it. */
  .cal-gear + .header-end {
    display: none;
  }
  .cal-gear {
    margin-right: 8px;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: color-mix(in srgb, currentColor 10%, transparent);
    --mdc-icon-size: 19px;
  }
  .cal-body {
    padding: 0 max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  }
  .cal-settings .hint {
    margin: 4px 0 8px;
    padding: 0;
    font-size: 13px;
    text-align: left;
  }
  /* The month fills the window of a tablet: six weeks as tall as there is room. */
  .cal-month-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .cal-month-body .cal-split {
    flex: 1;
    min-height: 0;
  }
  .cal-month-body .cal-month {
    grid-template-rows: 22px repeat(6, minmax(76px, 1fr));
  }
  .rooms-group {
    margin: 14px 4px 4px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .cal-count {
    padding: 1px 9px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: #ff453a;
  }
  .cal-list section {
    margin-bottom: 10px;
  }
  .cal-list h3,
  .cal-agenda h3 {
    margin: 10px 0 4px;
    font-size: 15px;
    font-weight: 600;
  }
  .cal-event {
    display: grid;
    grid-template-columns: 4px minmax(0, 1fr) auto;
    gap: 10px;
    padding: 9px 2px;
    border-bottom: 1px solid color-mix(in srgb, currentColor 9%, transparent);
  }
  .cal-event > i {
    border-radius: 2px;
    background: var(--event);
  }
  .cal-event strong {
    display: block;
    font-size: 15px;
  }
  .cal-event small {
    display: block;
    font-size: 12px;
    opacity: 0.68;
  }
  .cal-event p {
    margin: 4px 0 0;
    font-size: 13px;
    opacity: 0.85;
    white-space: pre-line;
  }
  .cal-time {
    text-align: right;
    font-size: 12px;
    line-height: 1.5;
    font-variant-numeric: tabular-nums;
    opacity: 0.85;
  }
  .cal-event.all-day {
    grid-template-columns: minmax(0, 1fr) auto;
    margin: 4px 0;
    padding: 9px 12px;
    border: 0;
    border-radius: 12px;
    background: color-mix(in srgb, var(--event) 38%, transparent);
  }
  .cal-event.all-day > i {
    display: none;
  }
  .cal-event.past {
    opacity: 0.45;
  }
  .cal-event.now {
    background: color-mix(in srgb, var(--event) 14%, transparent);
    border-radius: 10px;
  }
  .cal-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }
  .cal-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .cal-legend button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 11px;
    border-radius: 20px;
    font-size: 13px;
    background: color-mix(in srgb, currentColor 9%, transparent);
  }
  .cal-legend button::before {
    content: "";
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--event);
  }
  .cal-legend button.off {
    opacity: 0.4;
  }
  .cal-nav {
    display: flex;
    gap: 6px;
  }
  .cal-nav button {
    display: inline-flex;
    align-items: center;
    padding: 5px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, currentColor 10%, transparent);
    --mdc-icon-size: 18px;
  }
  .cal-split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 16px;
    min-height: 0;
  }
  .cal-month {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    grid-auto-rows: minmax(84px, 1fr);
    gap: 4px;
  }
  .cal-dow {
    align-self: end;
    padding-bottom: 2px;
    font-size: 11px;
    text-align: center;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .cal-month {
    grid-template-rows: 22px;
  }
  .cal-day {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 4px 5px;
    border-radius: 10px;
    text-align: left;
    overflow: hidden;
    background: color-mix(in srgb, currentColor 5%, transparent);
  }
  .cal-day.out {
    opacity: 0.45;
  }
  .cal-day.chosen {
    box-shadow: inset 0 0 0 2px color-mix(in srgb, currentColor 60%, transparent);
  }
  .cal-n {
    font-size: 12px;
    font-weight: 600;
  }
  .cal-day.today .cal-n {
    display: inline-grid;
    place-items: center;
    width: 21px;
    height: 21px;
    border-radius: 50%;
    color: #fff;
    background: #ff453a;
  }
  .cal-pill {
    padding: 1px 5px;
    border-left: 3px solid var(--event);
    border-radius: 5px;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: color-mix(in srgb, currentColor 8%, transparent);
  }
  .cal-pill.all-day {
    border-left: 0;
    color: #fff;
    background: color-mix(in srgb, var(--event) 70%, transparent);
  }
  .cal-more {
    font-size: 11px;
    opacity: 0.7;
  }
  .cal-agenda {
    padding-left: 14px;
    border-left: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    overflow: auto;
  }
  .cal-settings .back-link {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-bottom: 8px;
    opacity: 0.8;
  }
  .cal-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 2px;
    border-bottom: 1px solid color-mix(in srgb, currentColor 9%, transparent);
    cursor: pointer;
  }
  .cal-option span {
    flex: 1;
    min-width: 0;
  }
  .cal-option strong,
  .cal-option small {
    display: block;
  }
  .cal-option small {
    font-size: 12px;
    opacity: 0.65;
  }
  .cal-option .dot {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--event);
  }
  /* Own boxes, the same in every browser (iOS drew them black on a dark window): a round tick and a switch. */
  .cal-option input {
    flex: none;
    margin: 0;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }
  .cal-check {
    width: 24px;
    height: 24px;
    border: 2px solid color-mix(in srgb, currentColor 35%, transparent);
    border-radius: 50%;
    background: transparent;
  }
  .cal-check:checked {
    border-color: #0a84ff;
    background: #0a84ff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12.5l4 4 8-9' fill='none' stroke='white' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 18px no-repeat;
  }
  .cal-switch {
    position: relative;
    width: 50px;
    height: 30px;
    border-radius: 15px;
    background: color-mix(in srgb, currentColor 22%, transparent);
    transition: background 160ms;
  }
  .cal-switch::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform 160ms;
  }
  .cal-switch:checked {
    background: #34c759;
  }
  .cal-switch:checked::after {
    transform: translateX(20px);
  }
  @media (max-width: 899px) {
    .cal-split {
      grid-template-columns: 1fr;
    }
  }
`;
