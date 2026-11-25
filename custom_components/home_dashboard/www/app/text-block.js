// A block of text (`kind: text`): sections of text from entities, to read on the screen or aloud — the readings of the
// day's Mass, a page of a book for today, a thought of the day. Each section is one entity: its state is the small line
// above the text (a reference, a page), its attributes the text: `paragraphs` (a list) or `text`, and optionally
// `title`, `intro`, `refrain`, `refrain_alt`, `ending` (the Polish names of an integration in Polish work too:
// `akapity`, `tekst`, `tytul`, `wstep`, `refren`, `refren_zamienny`, `zakonczenie`). An entity without any of them shows
// its state as the text. A section with nothing to say is left out, and a block with nothing at all is not shown.
// The window first asks where to read: on the device it was opened on (a phone, a tablet, a Mac) or on the player, when
// the block has one; then what: one section (`read` of the section) or everything. The player reads by `tts.speak` on
// `speaker`, or by the script with the text in `script_field` and `script_data` beside it — for a speaker that needs a
// whole file first (a HomePod); under it is its volume. The device plays a recording of the same text-to-speech in the
// browser, or reads in the browser's own voice; `hide_read_here` hides it. Until the voice starts the window says that
// it is loading. `voice` chooses a voice of the text-to-speech; a script gets it in `script_voice_field`.
// What is read can come ready from an entity: `speech_entity` of the block for reading everything, `speech_entity` of a section for its own buttons — its attribute `text` (`tekst`), else its state. The
// screen shows the sections laid out, the voice reads the text made for it (the refrain after every stanza of a psalm).

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { followRanges, rangeStyles, syncRanges } from "./range.js";
import { tokens } from "./styles.js";

const EMPTY = new Set(["", "unavailable", "unknown", "none", "brak"]);
const QUOTES = /[«»„”“"]/g;
// A wav of no length: Safari on iOS plays sound only from a tap, so the tap starts this and the voice follows on it.
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

// A player that never says it plays (a script may use another speaker) does not load for ever.
const WAIT_MS = 60_000;
const VOLUME_SET = 4;
// The player reports its level a moment after it is set; the slider must not jump back meanwhile.
const VOLUME_HOLD_MS = 3000;

/** What kind of device this is: "phone", "tablet" or "computer". */
export function deviceKind(view = window) {
  if (!view.matchMedia("(pointer: coarse)").matches) return "computer";
  return Math.min(view.screen.width, view.screen.height) < 600 ? "phone" : "tablet";
}

/** What a player plays, to tell the voice from the music that was on before it. */
const playing = (state) => [state?.state, state?.attributes?.media_content_id, state?.attributes?.media_title].join("|");

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
    speech: section.speech_entity || "",
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

/** The text an entity has ready to be read aloud: its attribute `text` (`tekst`), else its state; "" without any. */
export function speechText(hass, entity) {
  const state = entity ? hass?.states?.[entity] : null;
  if (!state) return "";
  const text = pick(state.attributes, "text", "tekst");
  if (typeof text === "string" && text.trim()) return text.trim();
  return EMPTY.has(String(state.state).trim().toLowerCase()) ? "" : String(state.state).trim();
}

/**
 * What a button reads: everything (`all`) — the text of the block's `speech_entity`; one section — the text of its own
 * `speech_entity`; without them (or while they have nothing) the sections themselves.
 */
export function messageOf(hass, item, sections, all) {
  const entity = all ? item?.speech_entity : sections.length === 1 ? sections[0].speech : "";
  return speechText(hass, entity) || speechOf(sections);
}

// The lines of a paragraph keep their breaks (the verses of a psalm); the „*” of the caesura is not shown.
const lines = (paragraph) => paragraph.split("\n").map((line) => line.replace(/\s*\*\s*$/, "").replace(/\s\*\s/g, " "));

export class HomeDashboardTextBlock extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    _reading: { state: true },
    _preparing: { state: true },
    _paused: { state: true },
    _error: { state: true },
    _mode: { state: true },
    _volume: { state: true },
  };

  firstUpdated() {
    followRanges(this.renderRoot);
  }

  updated(changed) {
    if (changed.has("hass")) this._followSpeaker();
    syncRanges(this.renderRoot);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // A closed window does not go on talking with nothing left to stop it.
    this._stopHere();
    this._endWait();
    clearTimeout(this._volumeHold);
  }

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  async _read(key, sections) {
    this._stopHere();
    const { speaker, script, script_field: field, script_data: data } = this.item;
    const message = messageOf(this.hass, this.item, sections, key === "all");
    this._error = null;
    if (!message) {
      this._error = this._t("text_nothing");
      return;
    }
    this._reading = key;
    this._waitForSpeaker();
    try {
      if (script) {
        const variables = { ...(data ?? {}), [field || "message"]: message };
        if (this.item.voice && this.item.script_voice_field) variables[this.item.script_voice_field] = this.item.voice;
        await this.hass.callService("script", "turn_on", { entity_id: script, variables });
        return;
      }
      await this.hass.callService("tts", "speak", {
        entity_id: this._engine(),
        media_player_entity_id: speaker,
        message,
        cache: true,
        ...this._options(),
      });
    } catch (error) {
      this._endWait();
      this._error = error?.message ?? String(error);
      this._reading = null;
    }
  }

  // Loading until the player plays something else than before the tap.
  _waitForSpeaker() {
    this._endWait();
    this._preparing = true;
    this._started = false;
    this._before = playing(this.hass.states[this.item.speaker]);
    this._waitTimer = setTimeout(() => this._endWait(), this.item.speaker ? WAIT_MS : 10_000);
  }

  _endWait() {
    clearTimeout(this._waitTimer);
    this._waitTimer = null;
    this._preparing = false;
  }

  _followSpeaker() {
    if (!this._reading || this._hereOn || !this.item.speaker) return;
    const state = this.hass.states[this.item.speaker];
    if (!this._started && this._waitTimer && playing(state) !== this._before) {
      // The music before it stops first: only what plays after that is the voice.
      this._before = null;
      if (state?.state === "playing") {
        this._started = true;
        this._endWait();
      }
    } else if (this._started && state?.state !== "playing" && state?.state !== "buffering") {
      this._started = false;
      this._reading = null;
    }
  }

  /** The options of the text-to-speech: the chosen voice. */
  _options() {
    return this.item.voice ? { options: { voice: this.item.voice } } : {};
  }

  _engine() {
    return this.item.tts || Object.keys(this.hass.states).find((id) => id.startsWith("tts."));
  }

  /** Whether this device is reading (any of its buttons). */
  get _hereOn() {
    return String(this._reading ?? "").startsWith("here:");
  }

  /**
   * Reads the sections on this device: a recording of the text-to-speech, or the voice of the browser without one.
   * `key` is the button that started it: "here:all" or "here:<entity>" of one section.
   */
  async _readHere(sections, key = "here:all") {
    const message = messageOf(this.hass, this.item, sections, key === "here:all");
    this._stopHere();
    this._error = null;
    if (!message) {
      this._error = this._t("text_nothing");
      return;
    }
    const engine = this._engine();
    this._reading = key;
    if (!engine) {
      if (!this._speakHere(message, key)) this._failHere(this._t("text_here_none"));
      return;
    }
    const audio = new Audio();
    this._audio = audio;
    audio.src = SILENCE;
    audio.play().catch(() => {});
    this._preparing = true;
    try {
      const { url, path } = await this.hass.callApi("POST", "tts_get_url", { engine_id: engine, message, cache: true, ...this._options() });
      if (this._audio !== audio) return;
      audio.onended = () => this._audio === audio && this._stopHere();
      // The path, not the url: the url is the internal address of Home Assistant, out of reach over HTTPS or away from home.
      audio.src = path ? (this.hass.hassUrl?.(path) ?? path) : url;
      await audio.play();
      if (this._audio === audio) this._preparing = false;
    } catch (error) {
      if (this._audio !== audio) return;
      this._audio = null;
      this._preparing = false;
      // Without the recording the voice of the browser reads it, when it has one.
      if (!this._speakHere(message, key)) this._failHere(error?.message ?? String(error));
    }
  }

  _speakHere(message, key = "here:all") {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return false;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = this.hass.language;
    utterance.onend = () => this._utterance === utterance && this._stopHere();
    this._utterance = utterance;
    this._reading = key;
    synth.cancel();
    synth.speak(utterance);
    return true;
  }

  _failHere(message) {
    this._error = message;
    this._reading = null;
  }

  _pauseHere() {
    this._paused = !this._paused;
    if (this._audio) this._paused ? this._audio.pause() : this._audio.play().catch(() => {});
    else if (this._utterance) this._paused ? window.speechSynthesis.pause() : window.speechSynthesis.resume();
  }

  _stopHere() {
    if (this._audio) {
      this._audio.onended = null;
      this._audio.pause();
      this._audio.removeAttribute("src");
    }
    if (this._utterance) window.speechSynthesis?.cancel();
    const was = this._hereOn;
    this._audio = null;
    this._utterance = null;
    if (was) this._preparing = false;
    this._paused = false;
    if (was) this._reading = null;
  }

  get _canReadHere() {
    return !this.item.hide_read_here && (Boolean(this._engine()) || Boolean(window.speechSynthesis));
  }

  _stop() {
    if (this._hereOn) {
      this._stopHere();
      return;
    }
    // The script may still be making the recording: without this it would start after the stop.
    const waiting = this._preparing;
    this._reading = null;
    this._endWait();
    if (waiting && this.item.script && this.item.speaker) this.hass.callService("script", "turn_off", { entity_id: this.item.script });
    if (this.item.speaker) this.hass.callService("media_player", "media_stop", { entity_id: this.item.speaker });
    else if (this.item.script) this.hass.callService("script", "turn_off", { entity_id: this.item.script });
  }

  get _modes() {
    const modes = this._canReadHere ? ["here"] : [];
    if (this.item.speaker || this.item.script) modes.push("speaker");
    return modes;
  }

  // One reading at a time: the other place ends what this one reads.
  _choose(mode) {
    if (mode === this._mode) return;
    if (this._reading) this._stop();
    this._error = null;
    this._mode = mode;
  }

  _renderActions(sections) {
    const modes = this._modes;
    if (!modes.length) return nothing;
    const mode = modes.length === 1 ? modes[0] : modes.includes(this._mode) ? this._mode : null;
    const places = {
      here: ["mdi:cellphone-sound", this._t(`text_on_${deviceKind()}`)],
      speaker: ["mdi:speaker", this._t("text_on_speaker")],
    };
    return html`<div class="actions" data-text-actions>
        ${modes.length > 1
          ? html`<div class="pair" role="group">
              ${modes.map(
                (key) => html`<button
                  class="place ${key === mode ? "on" : ""}"
                  data-text-mode=${key}
                  aria-pressed=${key === mode}
                  @click=${() => this._choose(key)}
                >
                  <ha-icon .icon=${places[key][0]}></ha-icon><span>${places[key][1]}</span>
                </button>`,
              )}
            </div>`
          : nothing}
        ${mode ? this._renderWhat(sections, mode) : nothing}
      </div>
      ${this._error ? html`<p class="error" data-text-error>${this._error}</p>` : nothing}`;
  }

  // What to read there, and under it what it does now.
  _renderWhat(sections, mode) {
    const here = mode === "here";
    const button = (id, icon, label, chosen) => {
      const key = here ? `here:${id}` : id;
      const on = this._reading === key;
      const tap = () => (on ? this._stop() : here ? this._readHere(chosen, key) : this._read(key, chosen));
      const loading = on && this._preparing;
      return html`<button
        class="what ${on ? "on" : ""}"
        data-text-read=${here ? nothing : id}
        data-text-listen=${here ? id : nothing}
        data-text-read-here=${here && id === "all" ? "" : nothing}
        aria-busy=${loading}
        @click=${tap}
      >
        ${loading ? html`<i class="spinner" data-text-spinner></i>` : html`<ha-icon .icon=${icon}></ha-icon>`}<span>${label}</span>
      </button>`;
    };
    return html`
      <div class="pair">
        ${sections
          .filter((section) => section.read)
          .map((section) => button(section.entity, "mdi:account-voice", this._t("text_read_one", { name: section.name }), [section]))}
        ${button("all", "mdi:book-open-variant", this._t("text_read_all"), sections)}
      </div>
      ${this._reading && this._preparing
        ? html`<p class="loading" role="status" data-text-loading>${this._t("text_loading")}</p>`
        : nothing}
      ${here ? nothing : this._renderVolume()}
      ${this._reading
        ? html`<div class="pair">
            ${here && !this._preparing
              ? html`<button data-text-pause @click=${this._pauseHere}>
                  <ha-icon .icon=${this._paused ? "mdi:play" : "mdi:pause"}></ha-icon>${this._t(this._paused ? "text_resume" : "text_pause")}
                </button>`
              : nothing}
            <button data-text-stop @click=${this._stop}><ha-icon icon="mdi:stop"></ha-icon>${this._t("text_stop")}</button>
          </div>`
        : nothing}
    `;
  }

  _renderVolume() {
    const state = this.hass.states[this.item.speaker];
    if (!state || state.state === "unavailable" || !((state.attributes.supported_features ?? 0) & VOLUME_SET)) return nothing;
    const level = this._volume ?? Math.round((state.attributes.volume_level ?? 0) * 100);
    return html`<label class="volume" data-text-volume>
      <span><ha-icon icon="mdi:volume-high"></ha-icon>${state.attributes.friendly_name ?? this.item.speaker}<b>${level}%</b></span>
      <input
        type="range"
        min="0"
        max="100"
        aria-label=${this._t("text_volume")}
        .value=${String(level)}
        @input=${(event) => {
          clearTimeout(this._volumeHold);
          this._volume = Number(event.target.value);
        }}
        @change=${this._setVolume}
      />
    </label>`;
  }

  // Set when the finger lets go, so that the speaker gets one level.
  async _setVolume(event) {
    this._volume = Number(event.target.value);
    this._volumeHold = setTimeout(() => (this._volume = undefined), VOLUME_HOLD_MS);
    try {
      await this.hass.callService("media_player", "volume_set", {
        entity_id: this.item.speaker,
        volume_level: this._volume / 100,
      });
    } catch (error) {
      this._error = error?.message ?? String(error);
    }
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
    rangeStyles,
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
        flex-direction: column;
        gap: 10px;
      }
      .pair {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .actions button {
        all: unset;
        display: flex;
        flex: 1 1 40%;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-sizing: border-box;
        min-width: 0;
        min-height: 44px;
        padding: 8px 12px;
        border-radius: 22px;
        background: var(--hd-off);
        text-align: center;
        cursor: pointer;
        --mdc-icon-size: 20px;
      }
      .actions button ha-icon,
      .spinner {
        flex: none;
      }
      .actions button span {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .actions button.place {
        min-height: 52px;
      }
      .actions button.place.on {
        box-shadow: inset 0 0 0 2px var(--hd-media-accent);
      }
      .actions button.what.on {
        color: #fff;
        background: var(--hd-media-accent);
      }
      .actions button:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }
      .spinner {
        box-sizing: border-box;
        width: 20px;
        height: 20px;
        border: 3px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(1turn);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation-duration: 3s;
        }
      }
      .loading {
        color: var(--hd-text-muted);
        font-size: 14px;
        line-height: 20px;
        text-align: center;
      }
      .volume {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        border-radius: 22px;
        background: var(--hd-off);
      }
      .volume span {
        display: flex;
        gap: 8px;
        align-items: center;
        --mdc-icon-size: 20px;
      }
      .volume b {
        margin-left: auto;
        font-weight: 500;
      }
      .volume input {
        width: 100%;
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
