// The notifications of Home Assistant in a window of the dashboard. They come by subscription, so the
// list follows the server for as long as the window is open.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const MESSAGE_PARTS = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
const SAFE_LINK = /^(https?:\/\/|\/)/;

// Messages hold a little Markdown. Each part stays text, so a message can never bring its own HTML.
export function messageParts(message) {
  const parts = [];
  let end = 0;
  for (const match of (message ?? "").matchAll(MESSAGE_PARTS)) {
    if (match.index > end) parts.push({ text: message.slice(end, match.index) });
    if (match[1]) parts.push({ text: match[1], bold: true });
    else if (SAFE_LINK.test(match[3])) parts.push({ text: match[2], link: match[3] });
    else parts.push({ text: match[2] });
    end = match.index + match[0].length;
  }
  if (end < (message ?? "").length) parts.push({ text: message.slice(end) });
  return parts;
}

export function applyNotifications(current, { type, notifications }) {
  if (type === "current") return { ...notifications };
  if (type === "removed") {
    return Object.fromEntries(Object.entries(current).filter(([id]) => !(id in notifications)));
  }
  return { ...current, ...notifications };
}

export class HomeDashboardNotifications extends LitElement {
  static properties = {
    hass: { attribute: false },
    _items: { state: true },
    _clearing: { state: true },
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this._watch?.then((unsubscribe) => unsubscribe?.()).catch(() => {});
    this._watch = null;
  }

  updated() {
    if (this._watch || !this.hass?.connection) return;
    this._watch = this.hass.connection.subscribeMessage(
      (event) => {
        this._items = applyNotifications(this._items ?? {}, event);
      },
      { type: "persistent_notification/subscribe" },
    );
  }

  _t(key) {
    return translate(this.hass.language, key);
  }

  _dismiss(id) {
    this.hass.callService("persistent_notification", "dismiss", { notification_id: id });
  }

  _clearAll() {
    if (this._clearing) this.hass.callService("persistent_notification", "dismiss_all", {});
    this._clearing = !this._clearing;
  }

  _openLink(event, path) {
    if (!path.startsWith("/")) return;
    event.preventDefault();
    this.dispatchEvent(new CustomEvent("sheet-link", { bubbles: true, composed: true, detail: { path } }));
  }

  _renderPart({ text, bold, link }) {
    if (bold) return html`<b>${text}</b>`;
    if (link) {
      return html`<a href=${link} target="_blank" rel="noreferrer" @click=${(event) => this._openLink(event, link)}>${text}</a>`;
    }
    return text;
  }

  _renderItem({ notification_id: id, title, message, created_at: created }) {
    const when = new Intl.DateTimeFormat(this.hass.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return html`
      <article data-notification=${id}>
        <ha-icon icon="mdi:bell-outline"></ha-icon>
        <div>
          ${title ? html`<strong>${title}</strong>` : nothing}
          <p>${messageParts(message).map((part) => this._renderPart(part))}</p>
          ${created ? html`<small>${when.format(new Date(created))}</small>` : nothing}
        </div>
        <button aria-label=${this._t("notifications_dismiss")} data-notification-dismiss @click=${() => this._dismiss(id)}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </article>
    `;
  }

  render() {
    if (!this.hass) return nothing;
    const items = Object.values(this._items ?? {}).sort((first, second) =>
      String(second.created_at ?? "").localeCompare(String(first.created_at ?? "")),
    );
    return html`
      <div class="content">
        ${items.length
          ? html`
              ${items.map((item) => this._renderItem(item))}
              ${items.length > 1
                ? html`<button class="clear" data-notifications-clear @click=${this._clearAll}>
                    ${this._t(this._clearing ? "notifications_clear_sure" : "notifications_clear")}
                  </button>`
                : nothing}
            `
          : html`
              <div class="empty" data-notifications-empty>
                <ha-icon icon="mdi:bell-check-outline"></ha-icon>
                <span>${this._t("notifications_none")}</span>
              </div>
            `}
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
        padding: 0 16px 16px;
        color: var(--hd-text);
      }
      article {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      article > ha-icon {
        flex: none;
        margin-top: 2px;
        color: var(--hd-text-muted);
      }
      article > div {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      strong {
        font-size: 15px;
        font-weight: 500;
      }
      p {
        margin: 0;
        font-size: 14px;
        line-height: 20px;
        overflow-wrap: anywhere;
        white-space: pre-line;
      }
      p b {
        font-weight: 500;
      }
      a {
        color: var(--hd-media-accent);
      }
      small {
        color: var(--hd-text-muted);
        font-size: 12px;
        line-height: 16px;
      }
      [data-notification-dismiss] {
        display: grid;
        flex: none;
        place-items: center;
        width: 32px;
        height: 32px;
        color: var(--hd-text-muted);
        --mdc-icon-size: 20px;
      }
      .clear {
        padding: 12px;
        border-radius: 12px;
        font-size: 14px;
        text-align: center;
        background: var(--hd-off);
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 48px 0;
        color: var(--hd-text-muted);
        font-size: 15px;
        --mdc-icon-size: 56px;
      }
    `,
  ];
}
