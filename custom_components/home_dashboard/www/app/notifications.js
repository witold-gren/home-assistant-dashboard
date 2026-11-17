// The notifications of Home Assistant in a window of the dashboard. They come by subscription, so the
// list follows the server for as long as the window is open.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

// Inline Markdown: a picture, bold, a link, code, italic (in this order: a picture is a link with "!" before it).
const MESSAGE_PARTS =
  /!\[([^\]]*)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|__(.+?)__|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*([^*\s][^*]*?)\*|(?<![\w])_([^_\s][^_]*?)_(?![\w])/g;
const SAFE_LINK = /^(https?:\/\/|\/)/;
// A picture only from Home Assistant itself or over https (the QR code of a HomeKit pairing).
const SAFE_PICTURE = /^(https:\/\/|\/)/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const ITEM = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
const PICTURE_LINE = /^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;

// Messages hold Markdown (Home Assistant's own messages do: a heading, a picture). Each part stays text, so a
// message can never bring its own HTML.
export function messageParts(message) {
  const parts = [];
  let end = 0;
  for (const match of (message ?? "").matchAll(MESSAGE_PARTS)) {
    if (match.index > end) parts.push({ text: message.slice(end, match.index) });
    const [, alt, src, bold, boldToo, label, href, code, italic, italicToo] = match;
    if (src !== undefined) parts.push(SAFE_PICTURE.test(src) ? { picture: src, text: alt } : { text: alt });
    else if (bold ?? boldToo) parts.push({ text: bold ?? boldToo, bold: true });
    else if (label !== undefined) parts.push(SAFE_LINK.test(href) ? { text: label, link: href } : { text: label });
    else if (code !== undefined) parts.push({ text: code, code: true });
    else parts.push({ text: italic ?? italicToo, italic: true });
    end = match.index + match[0].length;
  }
  if (end < (message ?? "").length) parts.push({ text: message.slice(end) });
  return parts;
}

/** The blocks of a message: paragraphs (their lines kept), headings, items of a list, pictures on their own line. */
export function messageBlocks(message) {
  const blocks = [];
  let paragraph = [];
  const close = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", parts: messageParts(paragraph.join("\n")) });
    paragraph = [];
  };
  for (const line of String(message ?? "").split(/\r?\n/)) {
    const heading = HEADING.exec(line);
    const item = ITEM.exec(line);
    const picture = PICTURE_LINE.exec(line);
    if (!line.trim()) close();
    else if (heading) {
      close();
      blocks.push({ kind: "heading", level: heading[1].length, parts: messageParts(heading[2]) });
    } else if (picture) {
      close();
      if (SAFE_PICTURE.test(picture[2])) blocks.push({ kind: "picture", src: picture[2], text: picture[1] });
      else blocks.push({ kind: "paragraph", parts: [{ text: picture[1] }] });
    } else if (item) {
      close();
      blocks.push({ kind: "item", ordered: /\d/.test(item[1]), mark: item[1], parts: messageParts(item[2]) });
    } else paragraph.push(line);
  }
  close();
  return blocks;
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

  _renderPart({ text, bold, link, italic, code, picture }) {
    if (picture) return html`<img class="inline-picture" src=${this.hass.hassUrl?.(picture) ?? picture} alt=${text ?? ""} />`;
    if (bold) return html`<b>${text}</b>`;
    if (italic) return html`<i>${text}</i>`;
    if (code) return html`<code>${text}</code>`;
    if (link) {
      return html`<a href=${link} target="_blank" rel="noreferrer" @click=${(event) => this._openLink(event, link)}>${text}</a>`;
    }
    return text;
  }

  _renderBlock(block) {
    const parts = (block.parts ?? []).map((part) => this._renderPart(part));
    if (block.kind === "heading") return html`<p class="heading level-${block.level}" data-heading>${parts}</p>`;
    if (block.kind === "picture") {
      return html`<img class="picture" data-picture src=${this.hass.hassUrl?.(block.src) ?? block.src} alt=${block.text ?? ""} />`;
    }
    if (block.kind === "item") return html`<p class="item" data-item><span class="mark">${block.ordered ? block.mark : "•"}</span><span>${parts}</span></p>`;
    return html`<p>${parts}</p>`;
  }

  _renderItem({ notification_id: id, title, message, created_at: created }) {
    const when = new Intl.DateTimeFormat(this.hass.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return html`
      <article data-notification=${id}>
        <ha-icon icon="mdi:bell-outline"></ha-icon>
        <div>
          ${title ? html`<strong>${title}</strong>` : nothing}
          <div class="message">${messageBlocks(message).map((block) => this._renderBlock(block))}</div>
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
      .message {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      p.heading {
        font-size: 17px;
        line-height: 24px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      p.heading.level-1 {
        font-size: 20px;
      }
      p.item {
        display: flex;
        gap: 8px;
      }
      p.item .mark {
        flex: none;
        color: var(--hd-text-muted);
      }
      code {
        padding: 1px 5px;
        border-radius: 5px;
        font-size: 13px;
        background: var(--hd-off);
      }
      /* A picture of the message (the QR code of a HomeKit pairing) on a white card, to be read by a camera. */
      img.picture {
        align-self: flex-start;
        max-width: min(100%, 220px);
        padding: 10px;
        border-radius: 12px;
        background: #fff;
      }
      img.inline-picture {
        max-height: 1.4em;
        vertical-align: middle;
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
