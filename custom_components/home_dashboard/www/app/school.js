// The school year screen: read-only, from the family data sensors. Attributes are large and change
// rarely, so nothing here is watched: the sheet renders with whatever hass it was given.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const DEFAULT_SOURCES = {
  plan: "sensor.rodzinnik_plan_lekcji",
  grades: "sensor.rodzinnik_oceny",
  events: "sensor.rodzinnik_terminarz",
  meals: "sensor.rodzinnik_obiady",
  duties: "sensor.rodzinnik_obowiazki",
  jobs: "sensor.rodzinnik_prace",
  bank: "sensor.rodzinnik_bank",
  librus: "sensor.rodzinnik_librus",
};
const CHILD_VIEWS = ["plan", "grades", "events"];
const COMMON_TABS = ["meals", "duties", "jobs", "bank"];
const WEEKS = { "-1": "previous_week", 1: "next_week" };
const WEEK_LABELS = { "-1": "school_week_previous", 0: "school_week_current", 1: "school_week_next" };
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const WEEKEND_NAMES = ["Sobota", "Niedziela", "Saturday", "Sunday"];

export function schoolChildren(hass, item) {
  const sources = { ...DEFAULT_SOURCES, ...item.sources };
  const found = (hass.states[sources.plan]?.attributes.children ?? []).map((child) => child.child);
  const wanted = item.children ?? [];
  return [...wanted.filter((name) => found.includes(name)), ...found.filter((name) => !wanted.includes(name))];
}

export function currentDayIndex(days) {
  const today = days.findIndex((day) => day.is_today);
  return today < 0 ? 0 : today;
}

// The date says it in any language, and the name is for sources that send no date.
const isWeekend = (day) =>
  day.date ? [0, 6].includes(new Date(`${day.date}T12:00:00`).getDay()) : WEEKEND_NAMES.includes(day.name);

export function shownDays(days) {
  return days.filter((day) => day.lessons?.length || day.events?.length || !isWeekend(day));
}

const isoDate = (date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

// Each account of a child has its own entry, so the same event comes once per account.
export function familyEvents(children) {
  const events = (children ?? []).flatMap(({ child, events: own }) => (own ?? []).map((event) => ({ ...event, child })));
  return [...new Map(events.map((event) => [`${event.child}|${event.date}|${event.title}|${event.start}`, event])).values()];
}

export function importantEvents(children, now = new Date()) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const important = familyEvents(children).filter((event) => event.important);
  const on = (date) => important.filter((event) => event.date === isoDate(date));
  return { today: on(now), tomorrow: on(tomorrow) };
}

export function subjectAverage(subject, semester) {
  return subject.averages?.[`semester_${semester}`] ?? subject.averages?.year ?? null;
}

export function dutiesWeek(attributes, offset) {
  return offset ? attributes?.[WEEKS[offset]] : attributes;
}

export function shortDate(date) {
  const [, month, day] = (date ?? "").split("-").map(Number);
  return month ? `${day}.${month}` : "";
}

// Colours come from the family app, so the text on them has to adapt.
export function colourStyle(colour) {
  if (!HEX_COLOUR.test(colour ?? "")) return "";
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(colour.slice(start, start + 2), 16));
  const light = 0.299 * red + 0.587 * green + 0.114 * blue > 150;
  return `background: ${colour}; color: ${light ? "#1b1b1f" : "#ffffff"}`;
}

export function formatMoney(language, value, currency) {
  return Number(value ?? 0).toLocaleString(language, { style: "currency", currency });
}

export class HomeDashboardSchool extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    _tab: { state: true },
    _view: { state: true },
    _day: { state: true },
    _variant: { state: true },
    _week: { state: true },
  };

  get _sources() {
    return { ...DEFAULT_SOURCES, ...this.item.sources };
  }

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  _attribute(source, name) {
    return this.hass.states[this._sources[source]]?.attributes[name];
  }

  _child(source, name) {
    return (this._attribute(source, "children") ?? []).find((child) => child.child === name);
  }

  _tabs(selected, tabs, select, attribute) {
    return html`
      <div class="tabs">
        ${tabs.map(
          ({ key, label }) => html`
            <button class=${key === selected ? "selected" : ""} data-tab=${attribute}:${key} @click=${() => select(key)}>
              ${label}
            </button>
          `,
        )}
      </div>
    `;
  }

  _eventDetails(event) {
    return [event.instead_of_lessons ? this._t("school_instead_of_lessons") : "", event.place, event.description]
      .filter(Boolean)
      .join(" · ");
  }

  _renderEventRow(event) {
    return html`
      <div class="row day-event" data-day-event>
        <span class="time">
          ${event.start ?? html`<ha-icon icon="mdi:calendar-star"></ha-icon>`}<small>${event.end ?? ""}</small>
        </span>
        <span class="main">
          <strong>${event.title}</strong>
          <small>${[event.child, this._eventDetails(event)].filter(Boolean).join(" · ")}</small>
        </span>
      </div>
    `;
  }

  _renderImportantDay(key, events) {
    if (!events.length) return nothing;
    return html`
      <section data-important=${key}>
        <h3>${this._t(key)}</h3>
        ${events.map((event) => this._renderEventRow(event))}
      </section>
    `;
  }

  _renderImportant() {
    const { today, tomorrow } = importantEvents(this._attribute("librus", "children"));
    return html`
      ${this._renderImportantDay("school_today", today)} ${this._renderImportantDay("school_tomorrow", tomorrow)}
    `;
  }

  _renderPlan(name) {
    const days = shownDays(this._child("plan", name)?.days ?? []);
    if (!days.length) return html`<p class="empty">${this._t("school_no_data")}</p>`;
    const index = Math.min(this._day ?? currentDayIndex(days), days.length - 1);
    const lessons = days[index].lessons ?? [];
    const events = days[index].events ?? [];
    return html`
      ${this._tabs(
        String(index),
        days.map((day, key) => ({ key: String(key), label: day.is_today ? `● ${day.name}` : day.name })),
        (key) => {
          this._day = Number(key);
        },
        "day",
      )}
      ${events.map((event) => this._renderEventRow(event))}
      ${lessons.length || events.length ? nothing : html`<p class="empty">${this._t("school_no_lessons")}</p>`}
      ${lessons.map(
        (lesson) => html`
          <div class="row ${lesson.canceled || (days[index].no_lessons && lesson.type !== "extra") ? "canceled" : ""}" data-lesson>
            <span class="time">${lesson.start}<small>${lesson.end}</small></span>
            <span class="main">
              <strong>${lesson.number != null ? `${lesson.number}. ` : ""}${lesson.subject}</strong>
              <small>
                ${[lesson.classroom, lesson.teacher, lesson.substitution ? this._t("school_substitution") : "", lesson.note]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
          </div>
        `,
      )}
    `;
  }

  _renderGrades(name) {
    const child = this._child("grades", name);
    const subjects = child?.subjects ?? [];
    if (!subjects.length) return html`<p class="empty">${this._t("school_no_data")}</p>`;
    return subjects.map((subject) => {
      const average = subjectAverage(subject, child.semester);
      return html`
        <div class="row" data-subject>
          <span class="main">
            <strong>${subject.subject}</strong>
            <span class="grades">
              ${(subject.grades ?? []).map(
                (grade) => html`
                  <span class="grade ${grade.is_new ? "new" : ""}" title=${grade.category ?? ""}>
                    ${grade.grade}${grade.proposition ? "?" : ""}
                  </span>
                `,
              )}
            </span>
          </span>
          ${average != null ? html`<b class="average">${average.toLocaleString(this.hass.language)}</b>` : nothing}
        </div>
      `;
    });
  }

  _renderEvents(name) {
    const school = (this._child("events", name)?.entries ?? []).map((entry) => ({
      ...entry,
      title: `${entry.kind}: ${entry.title}`,
      details: entry.description ?? "",
    }));
    const own = familyEvents(this._attribute("librus", "children"))
      .filter((event) => event.child === name)
      .map((event) => ({ ...event, details: this._eventDetails(event), own: true }));
    const moment = ({ date, start }) => `${date} ${start ?? ""}`;
    const entries = [...school, ...own].sort((first, second) => moment(first).localeCompare(moment(second)));
    if (!entries.length) return html`<p class="empty">${this._t("school_no_events")}</p>`;
    return entries.map(
      (entry) => html`
        <div class="row ${entry.own ? "day-event" : ""}" data-event>
          <span class="time">${entry.date?.slice(5).split("-").reverse().join(".")}<small>${entry.start ?? ""}</small></span>
          <span class="main">
            <strong>${entry.title}</strong>
            <small>${entry.details}</small>
          </span>
        </div>
      `,
    );
  }

  _renderChild(name) {
    const view = this._view ?? "plan";
    const views = CHILD_VIEWS.map((key) => ({ key, label: this._t(`school_${key}`) }));
    const renderers = { plan: this._renderPlan, grades: this._renderGrades, events: this._renderEvents };
    return html`
      ${this._tabs(
        view,
        views,
        (key) => {
          this._view = key;
        },
        "view",
      )}
      ${renderers[view].call(this, name)}
    `;
  }

  _renderMeals() {
    const variants = (this._attribute("meals", "variants") ?? []).filter((variant) => variant.available);
    if (!variants.length) return html`<p class="empty">${this._t("school_no_data")}</p>`;
    const selected = variants.find((variant) => variant.variant === this._variant) ?? variants[0];
    return html`
      ${this._tabs(
        selected.variant,
        variants.map((variant) => ({ key: variant.variant, label: variant.label })),
        (key) => {
          this._variant = key;
        },
        "variant",
      )}
      ${(selected.days ?? []).map(
        (day) => html`
          <h3>${day.name}</h3>
          ${(day.meals ?? []).map(
            (meal) => html`
              <div class="row" data-meal>
                <span class="main">
                  <strong>${meal.meal}</strong>
                  <small>${(meal.items ?? []).map((item) => item.name).join(" · ")}</small>
                </span>
              </div>
            `,
          )}
        `,
      )}
    `;
  }

  _renderDutyCard(child) {
    const accent = HEX_COLOUR.test(child.child_color ?? "") ? `border-top-color: ${child.child_color}` : "";
    return html`
      <div class="duty" style=${accent} data-duty=${child.child}>
        <div class="duty-head">
          <span class="avatar">
            ${child.child?.[0] ?? ""}
            ${child.avatar
              ? html`<img src=${child.avatar} alt="" loading="lazy" @error=${(event) => event.target.remove()} />`
              : nothing}
          </span>
          <strong>${child.child}</strong>
        </div>
        ${child.free_week
          ? html`<p class="empty">${this._t("school_free_week")}</p>`
          : html`
              <span class="duty-set" style=${colourStyle(child.color)}>${child.set}</span>
              <ul>
                ${(child.tasks ?? []).map((task) => html`<li>${task}</li>`)}
              </ul>
            `}
      </div>
    `;
  }

  _renderDuties() {
    const attributes = this.hass.states[this._sources.duties]?.attributes;
    const offset = this._week ?? 0;
    const week = dutiesWeek(attributes, offset);
    const step = (delta, icon, key) => html`
      <button
        aria-label=${this._t(WEEK_LABELS[delta])}
        data-week=${key}
        ?disabled=${!dutiesWeek(attributes, offset + delta) || Math.abs(offset + delta) > 1}
        @click=${() => {
          this._week = offset + delta;
        }}
      >
        <ha-icon .icon=${icon}></ha-icon>
      </button>
    `;
    if (!week) return html`<p class="empty">${this._t("school_no_data")}</p>`;
    return html`
      <div class="week">
        ${step(-1, "mdi:chevron-left", "previous")}
        <span data-week-label>
          <strong>${this._t(WEEK_LABELS[offset])}</strong>
          <small>${shortDate(week.week_start)} – ${shortDate(week.week_end)}</small>
        </span>
        ${step(1, "mdi:chevron-right", "next")}
      </div>
      <div class="duties">${(week.children ?? []).map((child) => this._renderDutyCard(child))}</div>
    `;
  }

  _renderJobs() {
    const jobs = this._attribute("jobs", "jobs") ?? [];
    if (!jobs.length) return html`<p class="empty">${this._t("school_no_data")}</p>`;
    return jobs.map(
      (job) => html`
        <div class="row" data-job>
          <span class="main">
            <strong>${job.name}</strong>
            <small>${[job.description, job.limit?.label].filter(Boolean).join(" · ")}</small>
          </span>
          <b class="average">${job.reward_label}</b>
        </div>
      `,
    );
  }

  _renderBank() {
    const currency = this._attribute("bank", "currency") ?? "PLN";
    const money = (value) => formatMoney(this.hass.language, value, currency);
    const children = this._attribute("bank", "children") ?? [];
    if (!children.length) return html`<p class="empty">${this._t("school_no_data")}</p>`;
    return children.map(
      (child) => html`
        <div class="row" data-account>
          <span class="main">
            <strong>${child.child}</strong>
            <small>
              ${[
                child.savings ? this._t("school_savings", { value: money(child.savings) }) : "",
                child.debt ? this._t("school_debt", { value: money(child.debt) }) : "",
                child.allowance?.next_payment ? this._t("school_next", { date: child.allowance.next_payment }) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </span>
          <b class="average">${money(child.balance)}</b>
        </div>
      `,
    );
  }

  render() {
    if (!this.hass || !this.item) return nothing;
    const children = schoolChildren(this.hass, this.item);
    const tab = this._tab ?? children[0] ?? COMMON_TABS[0];
    const tabs = [
      ...children.map((key) => ({ key, label: key })),
      ...COMMON_TABS.map((key) => ({ key, label: this._t(`school_${key}`) })),
    ];
    const renderers = {
      meals: this._renderMeals,
      duties: this._renderDuties,
      jobs: this._renderJobs,
      bank: this._renderBank,
    };
    return html`
      <div class="content">
        ${this._renderImportant()}
        ${this._tabs(
          tab,
          tabs,
          (key) => {
            this._tab = key;
            this._day = undefined;
          },
          "tab",
        )}
        ${renderers[tab] ? renderers[tab].call(this) : this._renderChild(tab)}
      </div>
    `;
  }

  static styles = [
    tokens,
    css`
      button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
      }
      .content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 1100px;
        margin: 0 auto;
        padding: 0 16px 16px;
      }
      .tabs {
        display: flex;
        flex: none;
        gap: 8px;
        padding-bottom: 4px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .tabs button {
        flex: none;
        padding: 8px 14px;
        border: 1px solid var(--hd-outline);
        border-radius: 12px;
        font-size: 14px;
      }
      .tabs .selected {
        background: var(--hd-pill);
      }
      h3 {
        margin: 12px 0 0;
        font-size: 15px;
        font-weight: 500;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      section h3 {
        margin: 0;
      }
      .row.day-event {
        background: var(--hd-ov-highlight, var(--hd-light));
      }
      .row.day-event ha-icon {
        color: var(--hd-ov-highlight-ink, var(--hd-light-ink));
      }
      .row.canceled strong {
        text-decoration: line-through;
      }
      .time {
        display: flex;
        flex: none;
        flex-direction: column;
        width: 48px;
        font-size: 14px;
        font-weight: 500;
      }
      .main {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .main strong {
        font-size: 15px;
        font-weight: 500;
      }
      small {
        font-size: 13px;
        color: var(--hd-text-muted);
      }
      .grades {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
      }
      .grade {
        padding: 2px 8px;
        border-radius: 8px;
        font-size: 14px;
        background: var(--hd-off-icon);
      }
      .grade.new {
        font-weight: 700;
        background: var(--hd-pill);
      }
      .average {
        flex: none;
        font-size: 16px;
        font-weight: 500;
      }
      .empty {
        color: var(--hd-text-muted);
      }
      .week {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
      }
      .week span {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 128px;
      }
      .week strong {
        font-size: 14px;
        font-weight: 500;
      }
      .week button {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border: 1px solid var(--hd-outline);
        border-radius: 12px;
      }
      .week button[disabled] {
        opacity: 0.3;
        pointer-events: none;
      }
      .duties {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 8px;
      }
      .duty {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 12px;
        border-top: 4px solid var(--hd-outline);
        border-radius: 14px;
        background: var(--hd-off);
      }
      .duty-head {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 16px;
      }
      .duty-head strong {
        font-weight: 500;
      }
      .avatar {
        position: relative;
        display: grid;
        flex: none;
        place-items: center;
        width: 40px;
        height: 40px;
        overflow: hidden;
        border-radius: 50%;
        background: var(--hd-off-icon);
      }
      .avatar img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .duty-set {
        padding: 3px 10px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
      }
      .duty ul {
        margin: 0;
        padding-left: 18px;
        font-size: 14px;
        line-height: 20px;
        color: var(--hd-text-muted);
      }
    `,
  ];
}
