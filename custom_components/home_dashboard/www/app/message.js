// A message of the dashboard in its own look, instead of the browser's alert: a card over the screen (the look of the
// siren's question) with one button. Esc, a click beside the card and the button close it; the focus comes back to
// where it was.
//
//   await showMessage(this.renderRoot, { language, title, text, icon });

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";

/** Shows the message inside `root` (a shadow root, so it has the theme there) and resolves when it is closed. */
export function showMessage(root, { language, title = "", text = "", icon = "mdi:alert-circle-outline" } = {}) {
  const host = root?.isConnected === false ? document.body : (root ?? document.body);
  const box = document.createElement("home-dashboard-message");
  Object.assign(box, { language, heading: title, text, icon });
  return new Promise((resolve) => {
    box.addEventListener(
      "message-close",
      () => {
        box.remove();
        resolve();
      },
      { once: true },
    );
    host.appendChild(box);
  });
}

export class HomeDashboardMessage extends LitElement {
  static properties = {
    language: {},
    heading: {},
    text: {},
    icon: {},
  };

  connectedCallback() {
    super.connectedCallback();
    // The element that had the focus, through the shadow roots: it gets it back on close.
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    this._before = active;
    this._keys = (event) => this._key(event);
    window.addEventListener("keydown", this._keys, true);
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this._keys, true);
    this._before?.focus?.();
    super.disconnectedCallback();
  }

  firstUpdated() {
    this.renderRoot.querySelector("[data-message-ok]")?.focus();
  }

  _close() {
    this.dispatchEvent(new CustomEvent("message-close"));
  }

  _key(event) {
    if (event.key === "Escape") {
      // Captured first, so Home Assistant's own dialogs underneath do not close too.
      event.preventDefault();
      event.stopPropagation();
      this._close();
    } else if (event.key === "Tab") {
      // One button: the focus stays on it.
      event.preventDefault();
      this.renderRoot.querySelector("[data-message-ok]")?.focus();
    }
  }

  render() {
    return html`<div class="scrim" @click=${(event) => event.target === event.currentTarget && this._close()}>
      <div class="card" role="alertdialog" aria-modal="true" aria-labelledby="message-text" data-message>
        ${this.icon ? html`<ha-icon .icon=${this.icon}></ha-icon>` : nothing}
        ${this.heading ? html`<strong data-message-title>${this.heading}</strong>` : nothing}
        <p id="message-text" data-message-text>${this.text}</p>
        <button type="button" data-message-ok @click=${() => this._close()}>${translate(this.language, "close")}</button>
      </div>
    </div>`;
  }

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 20;
      font: 14px/1.4 -apple-system, "SF Pro Text", Roboto, system-ui, sans-serif;
    }
    .scrim {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(0, 0, 0, 0.45);
    }
    .card {
      display: grid;
      justify-items: center;
      gap: 8px;
      width: min(100%, 340px);
      padding: 20px;
      box-sizing: border-box;
      border-radius: 24px;
      text-align: center;
      color: #ffffff;
      background: #2c2c2e;
      --mdc-icon-size: 36px;
    }
    ha-icon {
      color: #ff9f0a;
    }
    strong {
      font-size: 18px;
    }
    p {
      margin: 0 0 8px;
      font-size: 14px;
      white-space: pre-line;
      color: rgba(255, 255, 255, 0.75);
    }
    button {
      width: 100%;
      padding: 12px;
      border: 0;
      border-radius: 14px;
      font: inherit;
      font-weight: 600;
      color: #ffffff;
      background: rgba(255, 255, 255, 0.14);
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
    }
  `;
}

if (!customElements.get("home-dashboard-message")) customElements.define("home-dashboard-message", HomeDashboardMessage);
