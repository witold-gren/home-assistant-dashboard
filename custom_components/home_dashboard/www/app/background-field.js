// A field for a background: a picture, a colour or a gradient. The field shows what it holds at its end (a sample of the
// colour, a magnifier for a picture that opens it big); a click opens a window to choose a picture already in Home
// Assistant (sent in, or in the `www` folder), send one from the computer, or set a colour or a gradient on a palette.
// The text stays, for whatever CSS someone writes by hand.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { MAKER_PALETTES, MAKER_PRESETS, uploadPicture } from "./background-maker.js";

const ANGLES = [180, 170, 135, 90, 225];
const HEX = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi;

/** A picture's address: a path of Home Assistant, a page on the web or a picture written inline. */
export const isPicture = (value) => /^(\/|https?:|data:image\/)/.test(String(value ?? "").trim());

const fullHex = (colour) => (colour.length === 4 ? `#${[...colour.slice(1)].map((digit) => digit + digit).join("")}` : colour).toLowerCase();

/**
 * What a background is, for the palette: `{ kind: "solid", colour }`, `{ kind: "gradient", angle, stops }` with stops
 * of `{ colour, at }` (percent), or `{ kind: "picture" | "other" | "empty" }`.
 */
export function readBackground(value) {
  const text = String(value ?? "").trim();
  if (!text) return { kind: "empty" };
  if (isPicture(text)) return { kind: "picture" };
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) return { kind: "solid", colour: fullHex(text) };
  const gradient = /^linear-gradient\((.*)\)$/i.exec(text);
  if (gradient) {
    const parts = gradient[1].split(/,(?![^(]*\))/).map((part) => part.trim());
    const angle = /^(-?\d+(?:\.\d+)?)deg$/.exec(parts[0]);
    const colours = parts.slice(angle ? 1 : 0);
    const stops = colours.map((part, index) => {
      const colour = part.match(HEX)?.[0];
      const at = /(\d+(?:\.\d+)?)%/.exec(part.replace(HEX, ""));
      return colour ? { colour: fullHex(colour), at: at ? Number(at[1]) : Math.round((index / Math.max(1, colours.length - 1)) * 100) } : null;
    });
    if (stops.length >= 2 && stops.every(Boolean)) return { kind: "gradient", angle: angle ? Number(angle[1]) : 180, stops };
  }
  return { kind: "other" };
}

/** The CSS of a gradient from its angle and stops. */
export const gradientValue = (angle, stops) =>
  `linear-gradient(${angle}deg, ${stops.map((stop) => `${stop.colour} ${stop.at}%`).join(", ")})`;

const PALETTE = [...new Set(Object.values(MAKER_PALETTES).flat(2))];

export class HomeDashboardBackgroundField extends LitElement {
  static properties = {
    hass: { attribute: false },
    value: { type: String },
    placeholder: { type: String },
    heading: { type: String },
    _open: { state: true },
    _tab: { state: true },
    _draft: { state: true },
    _peek: { state: true },
    _pictures: { state: true },
    _uploads: { state: true },
    _busy: { state: true },
    _problem: { state: true },
  };

  constructor() {
    super();
    this.value = "";
    this._open = false;
    this._tab = "files";
    this._peek = null;
    this._pictures = null;
    this._uploads = null;
    this._busy = false;
    this._problem = "";
  }

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  _emit(value) {
    this.dispatchEvent(new CustomEvent("background-change", { detail: { value }, bubbles: true, composed: true }));
  }

  _url(path) {
    return this.hass?.hassUrl ? this.hass.hassUrl(path) : path;
  }

  // The window opens on what the field holds: its colours on the palette, else the pictures.
  _openWindow() {
    const read = readBackground(this.value);
    this._draft = this.value ?? "";
    this._tab = ["solid", "gradient"].includes(read.kind) ? "colour" : "files";
    this._problem = "";
    this._open = true;
    this._loadPictures();
  }

  async _loadPictures() {
    if (!this.hass?.callWS) return;
    const [uploads, pictures] = await Promise.allSettled([
      this.hass.callWS({ type: "image/list" }),
      this.hass.callWS({ type: "home_dashboard/editor/pictures" }),
    ]);
    this._uploads = uploads.status === "fulfilled" && Array.isArray(uploads.value) ? [...uploads.value].reverse() : [];
    // Before a restart of Home Assistant the integration does not know the command yet.
    const list = pictures.status === "fulfilled" ? pictures.value?.pictures : null;
    this._pictures = Array.isArray(list) ? list : "unknown";
  }

  async _upload(event) {
    const input = event.target;
    const [file] = input.files;
    input.value = "";
    if (!file) return;
    this._busy = true;
    this._problem = "";
    try {
      this._choose(await uploadPicture(this.hass, file, file.name));
    } catch {
      this._problem = this._t("background_upload_failed");
    }
    this._busy = false;
  }

  _choose(value) {
    this._open = false;
    this._emit(value);
  }

  render() {
    const value = this.value ?? "";
    const picture = isPicture(value);
    return html`
      <div class="box">
        <button class="open" data-bg-open title=${this._t("background_choose")} @click=${() => this._openWindow()}>
          <span class=${value ? "" : "empty"}>${value || this.placeholder || this._t("background_choose")}</span>
        </button>
        ${value ? html`<button class="clear" data-bg-clear aria-label="×" @click=${() => this._emit("")}>×</button>` : nothing}
        ${picture
          ? html`<button class="end peek" data-bg-peek title=${this._t("background_preview")} @click=${() => (this._peek = value)}>
              <ha-icon icon="mdi:magnify"></ha-icon>
            </button>`
          : html`<button class="end sample ${value ? "" : "none"}" data-bg-sample title=${this._t("background_choose")}
              style=${value ? `background: ${value.replace(/[";{}<>]/g, "")}` : ""} @click=${() => this._openWindow()}></button>`}
      </div>
      ${this._open ? this._renderWindow() : nothing}
      ${this._peek ? this._renderPeek() : nothing}
    `;
  }

  _renderPeek() {
    return html`<div class="veil top" data-bg-viewer @click=${() => (this._peek = null)}
        @keydown=${(event) => event.key === "Escape" && (this._peek = null)}>
      <figure @click=${(event) => event.stopPropagation()}>
        <img src=${this._url(this._peek)} alt="" />
        <figcaption><code>${this._peek}</code>
          <button data-bg-viewer-close @click=${() => (this._peek = null)}>${this._t("background_close")}</button></figcaption>
      </figure>
    </div>`;
  }

  _renderWindow() {
    const tab = (key) => html`<button class=${this._tab === key ? "on" : ""} data-bg-tab=${key} @click=${() => (this._tab = key)}>
      ${this._t(`background_tab_${key}`)}
    </button>`;
    return html`<div class="veil" data-bg-dialog @click=${() => (this._open = false)}>
      <section class="window" @click=${(event) => event.stopPropagation()}>
        <header>
          <h3>${this.heading || this._t("background_choose")}</h3>
          <nav>${tab("files")}${tab("colour")}</nav>
          <button class="close" data-bg-cancel aria-label=${this._t("background_close")} @click=${() => (this._open = false)}>×</button>
        </header>
        <div class="content">${this._tab === "files" ? this._renderFiles() : this._renderColour()}</div>
      </section>
    </div>`;
  }

  _renderFiles() {
    const tile = (url, name, thumb = url) => html`<div class="file ${url === this.value ? "chosen" : ""}" data-bg-file=${url}>
      <button class="pick" title=${url} @click=${() => this._choose(url)}>
        <img loading="lazy" src=${this._url(thumb)} alt="" />
        <span>${name}</span>
      </button>
      <button class="zoom" data-bg-file-peek title=${this._t("background_preview")} @click=${() => (this._peek = url)}>
        <ha-icon icon="mdi:magnify"></ha-icon>
      </button>
    </div>`;
    const uploads = this._uploads ?? [];
    const pictures = Array.isArray(this._pictures) ? this._pictures : [];
    return html`
      <div class="bar">
        <label class="upload ${this._busy ? "busy" : ""}">
          <ha-icon icon="mdi:upload"></ha-icon>${this._t(this._busy ? "background_uploading" : "background_upload")}
          <input type="file" accept="image/*" hidden data-bg-upload ?disabled=${this._busy} @change=${this._upload} />
        </label>
        ${this._problem ? html`<span class="problem" data-bg-problem>${this._problem}</span>` : nothing}
      </div>
      ${this._uploads === null ? html`<p class="hint">…</p>` : nothing}
      <h4>${this._t("background_uploaded")}</h4>
      ${uploads.length
        ? html`<div class="files" data-bg-uploads>
            ${uploads.map((image) => tile(`/api/image/serve/${image.id}/original`, image.name ?? image.id, `/api/image/serve/${image.id}/256x256`))}
          </div>`
        : html`<p class="hint">${this._t("background_field_none")}</p>`}
      <h4>${this._t("background_www")} <code>/config/www</code></h4>
      ${this._pictures === "unknown"
        ? html`<p class="hint" data-bg-restart>${this._t("background_www_restart")}</p>`
        : pictures.length
          ? html`<div class="files" data-bg-www>${pictures.map((item) => tile(item.url, item.url.replace(/^\/local\//, "")))}</div>`
          : html`<p class="hint">${this._t("background_field_none")}</p>`}
    `;
  }

  _renderColour() {
    const read = readBackground(this._draft);
    const current = read.kind === "gradient" ? read : read.kind === "solid" ? read : null;
    const solid = current?.kind === "solid";
    const gradient = current?.kind === "gradient" ? current : null;
    const setGradient = (angle, stops) => (this._draft = gradientValue(angle, stops));
    const base = gradient ?? { angle: 180, stops: [{ colour: solid ? current.colour : "#3b4a6e", at: 0 }, { colour: "#1b2033", at: 100 }] };
    const draft = this._draft.replace(/[";{}<>]/g, "");
    return html`
      <div class="colour">
        <div class="preview" data-bg-preview style=${draft && !isPicture(draft) ? `background: ${draft}` : ""}></div>
        <div class="controls">
          <div class="chips">
            <button class=${solid ? "on" : ""} data-bg-kind="solid"
              @click=${() => (this._draft = gradient ? gradient.stops[0].colour : solid ? this._draft : "#f3f1ec")}>${this._t("background_solid")}</button>
            <button class=${gradient ? "on" : ""} data-bg-kind="gradient" @click=${() => setGradient(base.angle, base.stops)}>
              ${this._t("background_gradient")}</button>
          </div>
          ${solid
            ? html`<label class="line">${this._t("background_field_colour")}
                <input type="color" data-bg-solid .value=${current.colour} @input=${(event) => (this._draft = event.target.value)} /></label>`
            : nothing}
          ${gradient
            ? html`<div class="stops">
                  ${gradient.stops.map(
                    (stop, index) => html`<label class="line">${this._t("background_stop", { n: index + 1 })}
                      <input type="color" data-bg-stop=${index} .value=${stop.colour}
                        @input=${(event) => setGradient(gradient.angle, gradient.stops.map((old, at) => (at === index ? { ...old, colour: event.target.value } : old)))} />
                      <input type="number" min="0" max="100" class="at" data-bg-at=${index} .value=${String(stop.at)}
                        @change=${(event) => setGradient(gradient.angle, gradient.stops.map((old, at) => (at === index ? { ...old, at: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } : old)))} />%
                    </label>`,
                  )}
                </div>
                <div class="chips" data-bg-angles>
                  ${ANGLES.map((angle) => html`<button class=${gradient.angle === angle ? "on" : ""} data-bg-angle=${angle}
                    @click=${() => setGradient(angle, gradient.stops)}><span class="arrow" style="transform: rotate(${angle}deg)">↑</span>${angle}°</button>`)}
                  <button data-bg-reverse title=${this._t("background_reverse")}
                    @click=${() => setGradient(gradient.angle, [...gradient.stops].reverse().map((stop) => ({ ...stop, at: 100 - stop.at })))}>⇅</button>
                </div>`
            : nothing}
          ${read.kind === "other" ? html`<p class="hint">${this._t("background_custom")}</p>` : nothing}
          <h4>${this._t(gradient ? "background_ready_gradients" : "background_palette")}</h4>
          ${gradient
            ? html`<div class="swatches" data-bg-presets>
                ${MAKER_PRESETS.map(([top, bottom]) => html`<button class="swatch wide" data-bg-preset="${top},${bottom}"
                  style="background: linear-gradient(${gradient.angle}deg, ${top}, ${bottom})"
                  @click=${() => setGradient(gradient.angle, [{ colour: top, at: 0 }, { colour: bottom, at: 100 }])}></button>`)}
              </div>`
            : html`<div class="swatches" data-bg-palette>
                ${PALETTE.map((colour) => html`<button class="swatch" data-bg-swatch=${colour} style="background: ${colour}"
                  @click=${() => (this._draft = colour)}></button>`)}
              </div>`}
          <label class="css">CSS
            <input data-bg-css .value=${this._draft} @change=${(event) => (this._draft = event.target.value.trim())} /></label>
          <div class="actions">
            <button data-bg-cancel-colour @click=${() => (this._open = false)}>${this._t("background_cancel")}</button>
            <button class="primary" data-bg-use @click=${() => this._choose(this._draft)}>${this._t("background_use")}</button>
          </div>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      --mdc-icon-size: 18px;
      color: var(--text, #e8eaed);
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .box {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 6px 0 0;
      border: 1px solid var(--line, #2f343c);
      border-radius: 9px;
      background: var(--panel2, #23272e);
    }
    .open {
      flex: 1;
      min-width: 0;
      padding: 9px 10px;
      border: 0;
      background: none;
      text-align: left;
    }
    .open span {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .open .empty {
      color: var(--muted, #9aa0a6);
    }
    .clear {
      padding: 2px 6px;
      border: 0;
      background: none;
      font-size: 16px;
      color: var(--muted, #9aa0a6);
    }
    .end {
      flex: none;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid var(--line, #2f343c);
      border-radius: 7px;
    }
    .peek {
      display: grid;
      place-items: center;
      background: var(--panel, #1b1e24);
    }
    .sample.none {
      background: repeating-conic-gradient(#8885 0 25%, transparent 0 50%) 0 0 / 10px 10px;
    }
    .veil {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(0, 0, 0, 0.55);
    }
    .veil.top {
      z-index: 1001;
      background: rgba(0, 0, 0, 0.8);
    }
    figure {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 92vw;
      max-height: 92vh;
      margin: 0;
    }
    figure img {
      max-width: 92vw;
      max-height: calc(92vh - 50px);
      object-fit: contain;
      border-radius: 10px;
      background: repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 16px 16px;
    }
    figcaption {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: #fff;
    }
    figcaption button,
    .actions button,
    .chips button,
    .upload {
      padding: 7px 14px;
      border: 1px solid var(--line, #2f343c);
      border-radius: 9px;
      background: var(--panel2, #23272e);
    }
    .window {
      display: flex;
      flex-direction: column;
      width: min(1040px, 94vw);
      height: min(760px, 90vh);
      border: 1px solid var(--line, #2f343c);
      border-radius: 14px;
      background: var(--panel, #1b1e24);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line, #2f343c);
    }
    h3 {
      margin: 0;
      font-size: 16px;
    }
    nav {
      display: flex;
      gap: 4px;
      flex: 1;
    }
    nav button {
      padding: 6px 14px;
      border: 0;
      border-radius: 8px;
      background: none;
      color: var(--muted, #9aa0a6);
    }
    nav button.on {
      color: var(--text, #e8eaed);
      background: var(--panel2, #23272e);
    }
    .close {
      border: 0;
      background: none;
      font-size: 22px;
    }
    .content {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }
    h4 {
      margin: 18px 0 8px;
      font-size: 13px;
      color: var(--muted, #9aa0a6);
      font-weight: 600;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .upload {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .upload.busy {
      opacity: 0.6;
    }
    .problem {
      color: var(--red, #ff453a);
    }
    .hint {
      color: var(--muted, #9aa0a6);
      font-size: 13px;
    }
    .files {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .file {
      position: relative;
      border: 2px solid transparent;
      border-radius: 10px;
    }
    .file.chosen {
      border-color: var(--accent, #4f8cff);
    }
    .file .pick {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      padding: 0;
      border: 0;
      background: none;
      text-align: left;
    }
    .file img {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      border-radius: 8px;
      background: var(--panel2, #23272e);
    }
    .file span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      color: var(--muted, #9aa0a6);
    }
    .file .zoom {
      position: absolute;
      top: 6px;
      right: 6px;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      color: #fff;
      background: rgba(0, 0, 0, 0.55);
    }
    .colour {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(320px, 1.3fr);
      gap: 20px;
      min-height: 100%;
    }
    .preview {
      min-height: 320px;
      border: 1px solid var(--line, #2f343c);
      border-radius: 12px;
      background: repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 16px 16px;
    }
    .controls {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chips button.on {
      border-color: var(--accent, #4f8cff);
      background: color-mix(in srgb, var(--accent, #4f8cff) 22%, transparent);
    }
    .chips .arrow {
      display: inline-block;
      margin-right: 4px;
    }
    .line {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .stops {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    input[type="color"] {
      width: 44px;
      height: 32px;
      padding: 0;
      border: 1px solid var(--line, #2f343c);
      border-radius: 7px;
      background: none;
    }
    input.at {
      width: 64px;
    }
    input {
      padding: 7px 9px;
      border: 1px solid var(--line, #2f343c);
      border-radius: 8px;
      font: inherit;
      color: inherit;
      background: var(--field, #0d1117);
    }
    .swatches {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(28px, 1fr));
      gap: 6px;
    }
    .swatch {
      aspect-ratio: 1;
      padding: 0;
      border: 1px solid var(--line, #2f343c);
      border-radius: 7px;
    }
    .swatches:has(.wide) {
      grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    }
    .swatch.wide {
      aspect-ratio: 3 / 2;
    }
    .css {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: var(--muted, #9aa0a6);
    }
    .css input {
      font-family: ui-monospace, monospace;
      font-size: 12px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: auto;
    }
    .actions .primary {
      border-color: var(--accent, #4f8cff);
      color: #fff;
      background: var(--accent, #4f8cff);
    }
    @media (max-width: 720px) {
      .colour {
        grid-template-columns: 1fr;
      }
      .preview {
        min-height: 160px;
      }
    }
  `;
}

if (!customElements.get("home-dashboard-background-field")) customElements.define("home-dashboard-background-field", HomeDashboardBackgroundField);

/** A magnifier that opens a picture big, for a text field holding one. */
export class HomeDashboardPicturePeek extends LitElement {
  static properties = { src: { type: String }, hass: { attribute: false }, _open: { state: true } };

  render() {
    if (!isPicture(this.src)) return nothing;
    const url = this.hass?.hassUrl ? this.hass.hassUrl(this.src) : this.src;
    const close = () => (this._open = false);
    return html`<button data-picture-peek title=${translate(this.hass?.language, "background_preview")} @click=${() => (this._open = true)}>
        <ha-icon icon="mdi:magnify"></ha-icon>
      </button>
      ${this._open
        ? html`<div class="veil" data-bg-viewer @click=${close}>
            <figure @click=${(event) => event.stopPropagation()}>
              <img src=${url} alt="" />
              <figcaption><code>${this.src}</code><button data-bg-viewer-close @click=${close}>
                ${translate(this.hass?.language, "background_close")}</button></figcaption>
            </figure>
          </div>`
        : nothing}`;
  }

  static styles = css`
    :host {
      display: contents;
      --mdc-icon-size: 18px;
    }
    button {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid var(--line, #2f343c);
      border-radius: 8px;
      color: inherit;
      background: var(--panel, #1b1e24);
      cursor: pointer;
    }
    figcaption button {
      width: auto;
      padding: 7px 14px;
    }
    .veil {
      position: fixed;
      inset: 0;
      z-index: 1001;
      display: grid;
      place-items: center;
      background: rgba(0, 0, 0, 0.8);
    }
    figure {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
    }
    img {
      max-width: 92vw;
      max-height: calc(92vh - 50px);
      object-fit: contain;
      border-radius: 10px;
    }
    figcaption {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: #fff;
    }
  `;
}

if (!customElements.get("home-dashboard-picture-peek")) customElements.define("home-dashboard-picture-peek", HomeDashboardPicturePeek);
