// A block of text (`kind: text`): sections of text from entities, to read on the screen or aloud — the readings of the
// day's Mass, a page of a book for today, a thought of the day. Each section is one entity: its state is the small line
// above the text (a reference, a page), its attributes the text: `paragraphs` (a list) or `text`, and optionally
// `title`, `intro`, `refrain`, `refrain_alt`, `ending` (the Polish names of an integration in Polish work too:
// `akapity`, `tekst`, `tytul`, `wstep`, `refren`, `refren_zamienny`, `zakonczenie`). An entity without any of them shows
// its state as the text. A section with nothing to say is left out, and a block with nothing at all is not shown.
// With a speaker or a script chosen, the window reads everything or one section aloud: `tts.speak` on the speaker, or
// the script with the text in `script_field` and `script_data` beside it — for a speaker that needs a whole file first
// (a HomePod), where a script of announcements does that.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const EMPTY = new Set(["", "unavailable", "unknown", "none", "brak"]);
const QUOTES = /[«»„”“"]/g;

const pick = (attributes, ...names) => names.map((name) => attributes?.[name]).find((value) => value !== undefined && value !== null && value !== "");

/** One section of the block from its entity; null when it has nothing to show. */
export function textSection(hass, section) {
  const state = hass?.states?.[section?.entity];
  if (!state) return null;
  const attributes = state.attributes ?? {};
  let paragraphs = pick(attributes, "paragraphs", "akapity");
  if (!Array.isArray(paragraphs)) {
    const text = pick(attributes, "text", "tekst");
    paragraphs = typeof text === "string" ? text.split(/\n\s*\n/) : [];
  }
  paragraphs = paragraphs.map((paragraph) => String(paragraph).trim()).filter(Boolean);
  const own = !EMPTY.has(String(state.state).trim().toLowerCase());
  // An entity without text in its attributes: its state is the text.
  const reference = paragraphs.length && own ? state.state : "";
  if (!paragraphs.length && own) paragraphs = [state.state];
  if (!paragraphs.length) return null;
  return {
    entity: section.entity,
    name: section.name || attributes.friendly_name || section.entity,
    read: Boolean(section.read),
    reference,
    title: pick(attributes, "title", "tytul") ?? "",
    intro: pick(attributes, "intro", "wstep") ?? "",
    refrain: pick(attributes, "refrain", "refren") ?? "",
    alternative: pick(attributes, "refrain_alt", "refren_zamienny") ?? "",
    ending: pick(attributes, "ending", "zakonczenie") ?? "",
    paragraphs,
  };
}

/** The sections of the block that have something to show. */
export const textSections = (hass, item) => (item?.sections ?? []).map((section) => textSection(hass, section)).filter(Boolean);

/** The small line of the block's badge: its own label, else the state of `label_entity` (the Gospel of the day). */
export function textLabel(hass, item) {
  if (item?.label) return item.label;
  const state = hass?.states?.[item?.label_entity];
  return state && !EMPTY.has(String(state.state).trim().toLowerCase()) ? state.state : "";
}

// A line to be read: no caesura marks of a psalm, no quotation marks, a full stop at the end.
const spoken = (text) => {
  const clean = String(text).replace(QUOTES, "").replace(/\s\*(\s|$)/g, " ").replace(/\s+/g, " ").trim();
  return clean && !/[.!?:;,]$/.test(clean) ? `${clean}.` : clean;
};

/** The text of sections to be read aloud: each its intro (or name), refrain, text and ending. */
export function speechOf(sections) {
  return sections
    .map((section) =>
      [
        spoken(section.intro || section.name),
        section.refrain ? `Refren: ${spoken(section.refrain)}` : "",
        ...section.paragraphs.map(spoken),
        section.ending ? spoken(section.ending) : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

// The lines of a paragraph keep their breaks (the verses of a psalm); the „*” of the caesura is not shown.
const lines = (paragraph) => paragraph.split("\n").map((line) => line.replace(/\s*\*\s*$/, "").replace(/\s\*\s/g, " "));

export class HomeDashboardTextBlock extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    _reading: { state: true },
    _error: { state: true },
  };

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  async _read(key, sections) {
    const { speaker, tts, script, script_field: field, script_data: data } = this.item;
    const message = speechOf(sections);
    this._error = null;
    if (!message) {
      this._error = this._t("text_nothing");
      return;
    }
    this._reading = key;
    try {
      if (script) {
        await this.hass.callService("script", "turn_on", { entity_id: script, variables: { ...(data ?? {}), [field || "message"]: message } });
        return;
      }
      const engine = tts || Object.keys(this.hass.states).find((id) => id.startsWith("tts."));
      await this.hass.callService("tts", "speak", { entity_id: engine, media_player_entity_id: speaker, message, cache: true });
    } catch (error) {
      this._error = error?.message ?? String(error);
      this._reading = null;
    }
  }

  _stop() {
    this._reading = null;
    if (this.item.speaker) this.hass.callService("media_player", "media_stop", { entity_id: this.item.speaker });
    else if (this.item.script) this.hass.callService("script", "turn_off", { entity_id: this.item.script });
  }

  _renderActions(sections) {
    if (!this.item.speaker && !this.item.script) return nothing;
    const button = (key, icon, label, chosen) => html`<button class=${this._reading === key ? "on" : ""} data-text-read=${key}
      @click=${() => this._read(key, chosen)}><ha-icon .icon=${icon}></ha-icon>${label}</button>`;
    return html`<div class="actions" data-text-actions>
      ${sections
        .filter((section) => section.read)
        .map((section) => button(section.entity, "mdi:account-voice", this._t("text_read_one", { name: section.name }), [section]))}
      ${button("all", "mdi:book-open-variant", this._t("text_read_all"), sections)}
      ${this._reading ? html`<button data-text-stop @click=${this._stop}><ha-icon icon="mdi:stop"></ha-icon>${this._t("text_stop")}</button>` : nothing}
    </div>
    ${this._error ? html`<p class="error" data-text-error>${this._error}</p>` : nothing}`;
  }

  _renderSection(section) {
    return html`<section data-text-section=${section.entity}>
      <header>
        <h3>${section.name}</h3>
        ${section.reference ? html`<span class="reference" data-text-reference>${section.reference}</span>` : nothing}
      </header>
      ${section.title ? html`<p class="title">${section.title}</p>` : nothing}
      ${section.intro ? html`<p class="intro">${section.intro}</p>` : nothing}
      ${section.refrain
        ? html`<p class="refrain" data-text-refrain>
            ${section.refrain}
            ${section.alternative ? html`<span class="alternative">${this._t("text_or")} ${section.alternative}</span>` : nothing}
          </p>`
        : nothing}
      ${section.paragraphs.map(
        (paragraph) => html`<p>${lines(paragraph).map((line, index) => html`${index ? html`<br />` : nothing}${line}`)}</p>`,
      )}
      ${section.ending ? html`<p class="ending">${section.ending}</p>` : nothing}
    </section>`;
  }

  _renderHeading() {
    const state = this.hass.states[this.item.heading];
    if (!state || EMPTY.has(String(state.state).trim().toLowerCase())) return nothing;
    const day = state.attributes?.date ?? state.attributes?.data;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(day ?? "")
      ? new Intl.DateTimeFormat(this.hass.language, { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00`))
      : "";
    return html`<div class="heading" data-text-heading>
      <strong>${state.state}</strong>
      ${date ? html`<small>${date}</small>` : nothing}
    </div>`;
  }

  render() {
    if (!this.hass || !this.item) return nothing;
    const sections = textSections(this.hass, this.item);
    if (!sections.length) return html`<p class="empty" data-text-empty>${this._t("text_none")}</p>`;
    const attribution = this.hass.states[sections[0].entity]?.attributes?.attribution;
    return html`<div class="content">
      ${this._renderHeading()} ${this._renderActions(sections)} ${sections.map((section) => this._renderSection(section))}
      ${attribution ? html`<small class="source">${attribution}</small>` : nothing}
    </div>`;
  }

  static styles = [
    tokens,
    css`
      .content {
        display: flex;
        flex-direction: column;
        gap: 18px;
        max-width: 720px;
        margin: 0 auto;
        padding: 0 16px 24px;
        color: var(--hd-text);
      }
      .heading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        text-align: center;
      }
      .heading strong {
        font-size: 18px;
        font-weight: 600;
      }
      .heading small,
      .source {
        color: var(--hd-text-muted);
        font-size: 13px;
      }
      .source {
        text-align: center;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
      }
      .actions button {
        all: unset;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 999px;
        background: var(--hd-off);
        cursor: pointer;
        --mdc-icon-size: 18px;
      }
      .actions button.on {
        color: #fff;
        background: var(--hd-media-accent);
      }
      .error {
        margin: 0;
        color: var(--hd-alert, #e5383b);
        text-align: center;
      }
      section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px;
        border-radius: var(--hd-radius);
        background: var(--hd-off);
      }
      header {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 4px 12px;
      }
      h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--hd-text-muted);
      }
      /* In the colour of the text: an accent colour of the theme can be lost on its own background. */
      .reference {
        font-size: 14px;
        font-weight: 600;
        opacity: 0.8;
      }
      p {
        margin: 0;
        font-size: 16px;
        line-height: 25px;
        overflow-wrap: anywhere;
      }
      .title {
        font-style: italic;
        color: var(--hd-text-muted);
      }
      .intro {
        font-weight: 500;
      }
      .refrain {
        padding: 8px 12px;
        border-radius: 10px;
        background: color-mix(in srgb, currentColor 12%, transparent);
        font-weight: 600;
      }
      .alternative {
        display: block;
        font-weight: 400;
        color: var(--hd-text-muted);
      }
      .ending {
        font-weight: 600;
      }
      .empty {
        margin: 48px 16px;
        color: var(--hd-text-muted);
        text-align: center;
      }
    `,
  ];
}
