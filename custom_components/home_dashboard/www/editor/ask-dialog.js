// A question of the editor in its own look, never the browser's prompt or confirm: a title, a text, an optional field,
// and the buttons (Cancel and one named after the action). A part of the editor asks with
// `askInEditor(element, question)`; the editor shows the dialog and the promise answers the typed text (or true) when
// confirmed, null when cancelled. Esc, a click on the scrim and Cancel cancel; Tab stays in the window; the focus goes
// back to the opener. A dangerous action (`danger`) has a red button and starts with the focus on Cancel.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "../app/i18n.js";
import { dialogStyles } from "./publish.js";

export const ASK_EVENT = "editor-ask";

/**
 * Ask through the editor this element is in. `question`: { title, text, input (a starting value, for a field),
 * confirm (the label of the button), danger }. Resolves to the text (with `input`), true, or null.
 */
export function askInEditor(element, question) {
  return new Promise((resolve) => {
    const event = new CustomEvent(ASK_EVENT, { detail: { ...question, resolve }, bubbles: true, composed: true, cancelable: true });
    element.dispatchEvent(event);
    // Nothing took it: the part is not inside the editor (used on its own, or already taken off the page). The same
    // window is shown by itself then, never the browser's prompt or confirm.
    if (!event.defaultPrevented) askOnItsOwn(element, question, resolve);
  });
}

function askOnItsOwn(element, question, resolve) {
  const root = element?.isConnected ? element.getRootNode() : null;
  const host = root instanceof ShadowRoot ? root : document.body;
  const box = document.createElement("home-dashboard-editor-ask");
  box.hass = element?.hass;
  box.question = {
    ...question,
    resolve: (value) => {
      box.remove();
      resolve(value);
    },
  };
  box.addEventListener("dialog-close", () => box.remove(), { once: true });
  host.appendChild(box);
}

export class HomeDashboardEditorAsk extends LitElement {
  static properties = {
    hass: { attribute: false },
    question: { attribute: false },
    _value: { state: true },
  };

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  willUpdate(changed) {
    if (changed.has("question")) this._value = this.question?.input ?? "";
  }

  connectedCallback() {
    super.connectedCallback();
    // The button that opened it, through the shadow roots: the focus goes back there on close.
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
    const field = this.renderRoot.querySelector("input");
    if (field) {
      field.focus();
      field.select();
    } else {
      // A dangerous action starts on Cancel, so Enter alone never does it.
      this.renderRoot.querySelector(this.question?.danger ? "[data-ask-cancel]" : "[data-ask-ok]")?.focus();
    }
  }

  _key(event) {
    if (!this.question) return;
    if (event.key === "Escape") {
      // Captured on the window first, so a dialog of Home Assistant underneath does not close too.
      event.preventDefault();
      event.stopPropagation();
      this._answer(false);
    } else if (event.key === "Tab") {
      // The focus stays in the window.
      const stops = [...this.renderRoot.querySelectorAll("input, button:not([disabled])")];
      if (!stops.length) return;
      const at = stops.indexOf(this.renderRoot.activeElement);
      event.preventDefault();
      const next = at < 0 ? 0 : (at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
      stops[next].focus();
    }
  }

  _answer(ok) {
    const { question } = this;
    if (!question) return;
    const withField = question.input !== undefined;
    const value = withField ? this._value.trim() : true;
    if (ok && withField && !value && question.required !== false) return;
    question.resolve(ok ? value : null);
    this.dispatchEvent(new CustomEvent("dialog-close"));
  }

  render() {
    const question = this.question;
    if (!question) return nothing;
    const withField = question.input !== undefined;
    const empty = withField && !this._value.trim() && question.required !== false;
    return html`
      <div class="scrim" @click=${() => this._answer(false)}></div>
      <section
        class="dialog ask"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ask-title"
        aria-describedby=${question.text ? "ask-text" : nothing}
        data-ask
      >
        <header>
          ${question.icon ? html`<ha-icon .icon=${question.icon}></ha-icon>` : nothing}
          <h2 id="ask-title" data-ask-title>${question.title}</h2>
        </header>
        <div class="text">
          ${question.text ? html`<p id="ask-text" data-ask-text>${question.text}</p>` : nothing}
          ${withField
            ? html`<input
                data-ask-input
                .value=${this._value}
                maxlength="80"
                placeholder=${question.placeholder ?? ""}
                @input=${(event) => (this._value = event.target.value)}
                @keydown=${(event) => event.key === "Enter" && this._answer(true)}
              />`
            : nothing}
        </div>
        <footer>
          <span class="grow"></span>
          <button type="button" data-ask-cancel @click=${() => this._answer(false)}>${this._t("cancel")}</button>
          <button type="button" class="primary ${question.danger ? "danger" : ""}" data-ask-ok ?disabled=${empty} @click=${() => this._answer(true)}>
            ${question.confirm ?? this._t("save")}
          </button>
        </footer>
      </section>
    `;
  }

  static styles = [
    dialogStyles,
    css`
      /* The editor's colours, or Home Assistant's when the window is shown on its own outside the editor. */
      :host {
        color: var(--text, var(--primary-text-color, #1c1c1e));
      }
      .scrim {
        background: var(--scrim, rgba(0, 0, 0, 0.45));
      }
      .dialog.ask {
        background: var(--panel, var(--card-background-color, #ffffff));
        top: 22vh;
        width: min(460px, calc(100vw - 48px));
      }
      .text {
        display: grid;
        gap: 12px;
        padding: 16px 18px 18px;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.5;
        white-space: pre-line;
      }
      input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        font-size: 15px;
      }
      input:focus {
        outline: 2px solid var(--accent);
        outline-offset: -1px;
      }
      button.primary.danger {
        background: var(--red, #d93025);
      }
    `,
  ];
}

if (!customElements.get("home-dashboard-editor-ask")) customElements.define("home-dashboard-editor-ask", HomeDashboardEditorAsk);
