// A field for an icon: what is typed searches the icons of Home Assistant by name and keyword ("dashboard", "home",
// "lamp") and lists them with their pictures; a click or Enter takes one. Any text still goes, for icons of other sets.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { loadIconList, searchIcons } from "./appearance.js";

const LIMIT = 80;

export class HomeDashboardIconPicker extends LitElement {
  static properties = {
    value: { type: String },
    placeholder: { type: String },
    _query: { state: true },
    _found: { state: true },
    _active: { state: true },
    _open: { state: true },
  };

  constructor() {
    super();
    this.value = "";
    this._query = null;
    this._found = [];
    this._active = -1;
    this._open = false;
  }

  _emit(value) {
    this._query = null;
    this._open = false;
    this._active = -1;
    if (value === (this.value ?? "")) return;
    this.dispatchEvent(new CustomEvent("icon-change", { detail: { value }, bubbles: true, composed: true }));
  }

  async _search(query) {
    this._query = query;
    this._open = true;
    this._active = -1;
    const list = await loadIconList();
    if (this._query === query) this._found = searchIcons(list, query, LIMIT);
  }

  _key(event) {
    const last = this._found.length - 1;
    if (event.key === "ArrowDown" && this._open && last >= 0) {
      event.preventDefault();
      this._active = Math.min(last, this._active + 1);
      this._scrollToActive();
    } else if (event.key === "ArrowUp" && this._open && last >= 0) {
      event.preventDefault();
      this._active = Math.max(0, this._active - 1);
      this._scrollToActive();
    } else if (event.key === "Enter") {
      event.preventDefault();
      this._emit(this._active >= 0 ? this._found[this._active] : event.target.value.trim());
    } else if (event.key === "Escape" && this._open) {
      event.stopPropagation();
      this._query = null;
      this._open = false;
    }
  }

  async _scrollToActive() {
    await this.updateComplete;
    this.renderRoot.querySelector("[data-icon-option].active")?.scrollIntoView({ block: "nearest" });
  }

  // Leaving the field keeps what was typed; a click in the list comes first (pointerdown) and is not lost.
  _leave(event) {
    if (this._query === null) return;
    this._emit(event.target.value.trim());
  }

  render() {
    const text = this._query ?? this.value ?? "";
    const shown = this._open && this._query?.trim();
    return html`
      <div class="box">
        <ha-icon class="preview" .icon=${(this._active >= 0 && this._found[this._active]) || this.value || "mdi:shape-outline"}></ha-icon>
        <input
          data-icon-input
          role="combobox"
          aria-expanded=${shown ? "true" : "false"}
          autocomplete="off"
          spellcheck="false"
          .value=${text}
          placeholder=${this.placeholder || "mdi:home"}
          @input=${(event) => this._search(event.target.value)}
          @keydown=${this._key}
          @change=${this._leave}
          @blur=${this._leave}
        />
        ${this.value
          ? html`<button class="clear" data-icon-clear aria-label="×" @pointerdown=${(event) => event.preventDefault()}
              @click=${() => this._emit("")}>×</button>`
          : nothing}
      </div>
      ${shown
        ? html`<div class="list" role="listbox" data-icon-list>
            ${this._found.length
              ? this._found.map(
                  (icon, index) => html`<button
                    class="option ${index === this._active ? "active" : ""}"
                    role="option"
                    data-icon-option=${icon}
                    @pointerdown=${(event) => event.preventDefault()}
                    @click=${() => this._emit(icon)}
                  >
                    <ha-icon .icon=${icon}></ha-icon><span>${icon.replace(/^mdi:/, "")}</span>
                  </button>`,
                )
              : html`<div class="none" data-icon-none>—</div>`}
          </div>`
        : nothing}
    `;
  }

  static styles = css`
    :host {
      position: relative;
      display: block;
      --mdc-icon-size: 20px;
    }
    .box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 8px 0 10px;
      border: 1px solid var(--line, var(--hd-outline, #2f343c));
      border-radius: 9px;
      background: var(--panel2, var(--hd-surface-2, #23272e));
    }
    .preview {
      flex: none;
      color: var(--muted, var(--hd-text-muted, #9aa0a6));
    }
    input {
      flex: 1;
      min-width: 0;
      padding: 8px 0;
      border: 0;
      outline: none;
      font: inherit;
      color: var(--text, var(--hd-text, #e8eaed));
      background: transparent;
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .clear {
      padding: 2px 6px;
      border: 0;
      background: none;
      font-size: 16px;
      color: var(--muted, var(--hd-text-muted, #9aa0a6));
    }
    .list {
      position: absolute;
      z-index: 20;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 2px;
      max-height: 280px;
      overflow: auto;
      padding: 6px;
      border: 1px solid var(--line, var(--hd-outline, #2f343c));
      border-radius: 10px;
      background: var(--panel, var(--hd-surface, #1b1e24));
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    }
    .option {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 6px 8px;
      border: 0;
      border-radius: 7px;
      background: none;
      font-size: 13px;
      text-align: left;
    }
    .option span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .option:hover,
    .option.active {
      background: var(--hover, rgba(127, 127, 127, 0.16));
    }
    .none {
      padding: 6px 8px;
      color: var(--muted, var(--hd-text-muted, #9aa0a6));
    }
  `;
}

if (!customElements.get("home-dashboard-icon-picker")) customElements.define("home-dashboard-icon-picker", HomeDashboardIconPicker);
