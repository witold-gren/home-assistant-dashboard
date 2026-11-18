// A question of the editor in its own look, instead of the browser's prompt and confirm: a title, a text, an optional
// field, and the buttons. A part of the editor asks with `askInEditor(element, question)`; the editor shows the dialog
// and the promise answers the typed text (or true) when confirmed, null when cancelled.

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
    // Nothing to show it (a part used on its own): the browser's own dialogs.
    if (!event.defaultPrevented) {
      if (question.input !== undefined) resolve(window.prompt(question.title, question.input));
      else resolve(window.confirm(`${question.title}\n\n${question.text ?? ""}`) || null);
    }
  });
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

  firstUpdated() {
    const field = this.renderRoot.querySelector("input");
    if (field) {
      field.focus();
      field.select();
    } else this.renderRoot.querySelector("[data-ask-ok]")?.focus();
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
      <section class="dialog ask" role="dialog" aria-modal="true" aria-label=${question.title} data-ask>
        <header>
          ${question.icon ? html`<ha-icon .icon=${question.icon}></ha-icon>` : nothing}
          <h2 data-ask-title>${question.title}</h2>
        </header>
        <div class="text">
          ${question.text ? html`<p data-ask-text>${question.text}</p>` : nothing}
          ${withField
            ? html`<input
                data-ask-input
                .value=${this._value}
                maxlength="80"
                placeholder=${question.placeholder ?? ""}
                @input=${(event) => (this._value = event.target.value)}
                @keydown=${(event) => {
                  if (event.key === "Enter") this._answer(true);
                  if (event.key === "Escape") this._answer(false);
                }}
              />`
            : nothing}
        </div>
        <footer @keydown=${(event) => event.key === "Escape" && this._answer(false)}>
          <span class="grow"></span>
          <button data-ask-cancel @click=${() => this._answer(false)}>${this._t("cancel")}</button>
          <button class="primary ${question.danger ? "danger" : ""}" data-ask-ok ?disabled=${empty} @click=${() => this._answer(true)}>
            ${question.confirm ?? this._t("save")}
          </button>
        </footer>
      </section>
    `;
  }

  static styles = [
    dialogStyles,
    css`
      .dialog.ask {
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
