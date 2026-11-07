// A window for an add-on with a web interface. It does what the add-on panel of Home Assistant does:
// opens an ingress session, keeps it alive and shows the add-on in a frame, without a second frontend.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const KEEP_ALIVE_MS = 60000;

function rememberSession(session) {
  const secure = window.location.protocol === "https:" ? ";Secure" : "";
  document.cookie = `ingress_session=${session};path=/api/hassio_ingress/;SameSite=Strict${secure}`;
  return session;
}

export class HomeDashboardApp extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    _url: { state: true },
    _problem: { state: true },
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._keepAlive);
    this._started = false;
  }

  updated() {
    if (this._started || !this.hass || !this.item) return;
    this._started = true;
    this._open();
  }

  _supervisor(endpoint, method, data) {
    return this.hass.callWS({ type: "supervisor/api", endpoint, method, ...(data ? { data } : {}) });
  }

  async _newSession() {
    const { session } = await this._supervisor("/ingress/session", "post");
    return rememberSession(session);
  }

  async _keepSession(session) {
    let current = session;
    clearInterval(this._keepAlive);
    this._keepAlive = setInterval(async () => {
      try {
        await this._supervisor("/ingress/validate_session", "post", { session: current });
      } catch {
        current = await this._newSession().catch(() => current);
      }
    }, KEEP_ALIVE_MS);
  }

  async _open() {
    const { addon, frame } = this.item;
    try {
      const session = await this._newSession();
      const info = await this._supervisor(`/addons/${addon}/info`, "get");
      if (!info?.ingress_url) throw new Error("app_no_interface");
      if (info.state !== "started") throw new Error("app_not_running");
      this._keepSession(session);
      this._url = info.ingress_url;
    } catch (error) {
      if (frame) this._url = frame;
      else this._problem = error.message.startsWith("app_") ? error.message : "app_failed";
    }
  }

  render() {
    if (!this.hass || !this.item) return nothing;
    const language = this.hass.language;
    if (this._url) {
      return html`<iframe
        data-app-frame
        title=${this.item.name}
        allow="fullscreen; autoplay; clipboard-read; clipboard-write"
        src=${this._url}
      ></iframe>`;
    }
    return html`
      <div class="message" data-app-message>
        <p>${translate(language, this._problem ?? "app_loading")}</p>
        ${this._problem
          ? html`<a data-app-link href=${this.item.path ?? `/${this.item.addon}`} target="_top">
              ${translate(language, "app_open_panel")}
            </a>`
          : nothing}
      </div>
    `;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: flex;
        flex: 1;
        min-height: 60vh;
      }
      iframe {
        flex: 1;
        width: 100%;
        border: 0;
      }
      .message {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 16px;
        color: var(--hd-text);
        text-align: center;
      }
      a {
        padding: 10px 16px;
        border-radius: 12px;
        color: var(--hd-text);
        background: var(--hd-off);
        text-decoration: none;
      }
    `,
  ];
}
