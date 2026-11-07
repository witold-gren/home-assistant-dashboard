// Everything that outlives a view: navigation, mini player, menu and the sheets. Home Assistant
// removes the old view on every switch, so these live once, in hui-root's shadow root.
//
// Everything that depends on Home Assistant's internals lives in this file. When hui-root cannot
// be found the bar goes to the document body and the regular header stays visible.

import { LitElement, css, html, nothing, unsafeCSS } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import {
  buildPlayer,
  buildRoomList,
  normalizeConfig,
  nowPlaying,
  MENU_LINKS,
  menuGroups,
  personalize,
  renameBlockRules,
  selectEntities,
  shownMenu,
} from "./model.js";
import { loadPrefs, PREFS_EVENT, personalPrefs } from "./prefs.js";
import { stopWatchingPresses, watchPresses } from "./press.js";
import { applyColorMode, backgroundTop, DARK_SCHEME, isDark, pageColour, tokens, viewBackground } from "./styles.js";

export const TABLET_MEDIA_QUERY = "(min-width: 900px)";
const CHROME_TAG = "home-dashboard-chrome";
const STYLE_ID = "home-dashboard-root-style";
const REGISTRIES = ["entities", "devices", "areas", "floors"];
const FOLLOW_ROOT_MS = 800;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchmove"];
const PAGES = [
  { key: "home", icon: "mdi:home", path: "home" },
  { key: "media", icon: "mdi:play-box-multiple-outline", path: "media" },
  { key: "energy", icon: "mdi:lightning-bolt", path: "energy" },
  { key: "map", icon: "mdi:map-outline", path: "map" },
];
const MUSIC_PAGE = { key: "music", icon: "mdi:music", path: "music" };
// Pages of Home Assistant that have a window here, so that nobody has to leave the dashboard for them.
const WINDOWS = { "/history": "history", "/logbook": "logbook" };
const LINKS = MENU_LINKS;

const CAMERA_BAND = "#17181a";
const BAND_REPEAT_MS = 800;
const PLAYER_SPACE = "88px";
const NO_PLAYER_SPACE = "16px";
const APP_COLOURS = [
  "--app-header-background-color",
  "--app-theme-color",
  "--primary-background-color",
  "--text-primary-color",
  "--primary-color",
];

// Tells the iOS app the colours of the theme, as the frontend does; a band replaces the ones of
// the area around the page. Without it the app goes back to the colours of the theme.
function postThemeColors({ band }) {
  const handler = window.webkit?.messageHandlers?.updateThemeColors;
  if (!handler) return;
  const computed = getComputedStyle(document.documentElement);
  const colours = Object.fromEntries(APP_COLOURS.map((name) => [name, computed.getPropertyValue(name).trim()]));
  if (band) APP_COLOURS.slice(0, 3).forEach((name) => (colours[name] = band));
  handler.postMessage(colours);
}

// Replaces the regular header and the view padding that makes room for it. The opaque background
// covers whatever the active theme paints behind the view.
// The view scrolls by itself: on iOS a scrolling document slides under the status bar, past what
// fixed elements reach, and takes the navigation up with it at the end of the page.
export const rootStyle = () => `
  .header { display: none !important; }
  #view {
    box-sizing: border-box;
    height: 100dvh;
    min-height: 0 !important;
    padding: 0 !important;
    overflow-y: auto;
    overscroll-behavior-y: none;
    touch-action: pan-x pan-y;
  }
  ${viewBackground()}
  @media ${TABLET_MEDIA_QUERY} {
    #view { padding-left: 88px !important; }
  }
`;

export const currentLayout = () => (window.matchMedia(TABLET_MEDIA_QUERY).matches ? "tablet" : "phone");

// What scrolls the page: the view on a dashboard, the window anywhere else.
export function pageScroller(node) {
  return findRoot(node)?.shadowRoot?.getElementById("view") ?? window;
}

export function findRoot(node) {
  let current = node;
  while (current) {
    if (current.localName === "hui-root") return current;
    current = current.parentNode ?? current.host;
  }
  return null;
}

function chromeFor(root) {
  const parent = root?.shadowRoot ?? document.body;
  let chrome = parent.querySelector(CHROME_TAG);
  if (chrome) return chrome;
  chrome = document.createElement(CHROME_TAG);
  chrome.root = root;
  parent.appendChild(chrome);
  if (root?.shadowRoot && !root.shadowRoot.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = rootStyle();
    root.shadowRoot.appendChild(style);
  }
  return chrome;
}

function existingChrome(card) {
  const parent = findRoot(card)?.shadowRoot ?? document.body;
  return parent.querySelector(CHROME_TAG);
}

export function attachChrome(card, hass, page, raw) {
  const root = findRoot(card);
  if (!root && !card.isConnected) return;
  const chrome = chromeFor(root);
  chrome.raw = raw;
  chrome.card = card;
  chrome.hass = hass;
  chrome.page = page;
  if (page !== "music") chrome.navTucked = false;
}

export function setPageBackground(card, background) {
  const chrome = existingChrome(card);
  if (chrome) chrome.pageBackground = background;
}

export function goHome(card) {
  existingChrome(card)?._navigate(PAGES[0]);
}

export function tuckNavigation(card, tucked) {
  const chrome = existingChrome(card);
  if (chrome) chrome.navTucked = tucked && chrome.page === "music";
}

export function updateChrome(card, hass) {
  const chrome = existingChrome(card);
  if (chrome) chrome.hass = hass;
}

export function openSheet(card, sheet) {
  existingChrome(card)?.open({ type: "sheet", sheet });
}

export function saveDashboard(card, dashboard) {
  return existingChrome(card)?._saveSettings({ detail: { dashboard } });
}

export function openDrawer(card) {
  existingChrome(card)?.open({ type: "drawer" });
}

// What someone may be using without touching this page: a form, a recording, a frame or a robot.
export function holdsScreen(overlay) {
  const sheet = overlay?.sheet;
  const busy = ["app", "intercom"].includes(sheet?.kind);
  return overlay?.type === "settings" || busy || Boolean(sheet?.item?.frame || sheet?.item?.card);
}

export function dashboardPath(pathname) {
  return `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
}

export function navigateTo(path) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

// Numbers for the unexplained gap at the bottom of the screen on iOS: open with ?dashboard_debug=1.
export function layoutReport(nav, root) {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;height:env(safe-area-inset-bottom,0px);width:0;visibility:hidden";
  document.body.appendChild(probe);
  const envBottom = probe.getBoundingClientRect().height;
  probe.remove();
  const view = root?.shadowRoot?.querySelector("#view");
  const under = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 1);
  return {
    inner: `${window.innerWidth}x${window.innerHeight}`,
    visual: `${Math.round(window.visualViewport?.width ?? 0)}x${Math.round(window.visualViewport?.height ?? 0)}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    html_height: document.documentElement.clientHeight,
    env_bottom: envBottom,
    ha_bottom: getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-bottom").trim() || "unset",
    nav_bottom: Math.round(nav?.getBoundingClientRect().bottom ?? 0),
    view_padding_bottom: view ? getComputedStyle(view).paddingBottom : "none",
    element_at_bottom: under?.localName ?? "none",
    agent: navigator.userAgent,
  };
}

export class HomeDashboardChrome extends LitElement {
  static properties = {
    hass: { attribute: false },
    page: { type: String },
    pageBackground: { attribute: false },
    navTucked: { type: Boolean },
    _left: { state: true },
    _report: { state: true },
    _overlay: { state: true },
  };

  shouldUpdate(changed) {
    // hass changes on every state event: render only for what is visible from here.
    if (changed.size === 1 && changed.has("hass")) {
      const previous = changed.get("hass");
      if (previous?.language !== this.hass.language || this._overlay) return true;
      const before = this._playerId;
      this._refreshPlayer();
      return before !== this._playerId || previous?.states[this._playerId] !== this.hass.states[this._playerId];
    }
    return true;
  }

  willUpdate() {
    if (this.hass) loadPrefs(this.hass);
    this._refreshPlayer();
    this._watchSettings();
  }

  _onPrefs = () => {
    this._selectionRaw = null;
    this._useColorMode();
    this.requestUpdate();
  };

  _noPinch = (event) => event.preventDefault();

  // A dashboard is used like an app: a stray pinch or double tap must not leave it enlarged.
  _lockZoom() {
    const meta = document.querySelector('meta[name="viewport"]');
    this._viewport = meta?.getAttribute("content");
    meta?.setAttribute("content", `${this._viewport}, maximum-scale=1, user-scalable=no`);
    document.addEventListener("gesturestart", this._noPinch, { passive: false });
  }

  _unlockZoom() {
    if (this._viewport) document.querySelector('meta[name="viewport"]')?.setAttribute("content", this._viewport);
    document.removeEventListener("gesturestart", this._noPinch);
  }

  _watchSettings() {
    if (this._settingsWatch || !this.hass?.connection?.subscribeMessage) return;
    this._settingsWatch = this.hass.connection
      .subscribeMessage((settings) => this._applySettings(settings), { type: "home_dashboard/settings/subscribe" })
      .catch(() => null);
  }

  _applySettings({ color_mode: mode }) {
    this._sharedMode = mode;
    this._useColorMode();
  }

  // What someone chose for themselves beats the option of the integration.
  _useColorMode() {
    const mode = personalPrefs().color_mode ?? this._sharedMode;
    if (!mode || mode === this._usedMode) return;
    this._usedMode = mode;
    applyColorMode(mode);
    const style = this.root?.shadowRoot?.getElementById(STYLE_ID);
    if (style) style.textContent = rootStyle();
    this._paintDocument();
  }

  // iOS fills the area under its bars and past the end of the page from the document, not the view.
  _paintDocument = () => {
    const colour = pageColour();
    document.documentElement.style.backgroundColor = colour;
    document.body.style.backgroundColor = colour;
    this._themeMeta?.setAttribute("content", colour);
    this._matchTheme(!isDark());
    this._paintBand();
    // A page may have a background for this mode.
    window.dispatchEvent(new CustomEvent(PREFS_EVENT));
  };

  _restoreDocument() {
    document.documentElement.style.backgroundColor = "";
    document.body.style.backgroundColor = "";
    this._themeMeta?.setAttribute("content", this._themeColour);
    this._matchTheme(false);
    this._sheetObserver?.disconnect();
    clearTimeout(this._bandTimer);
    this._band = null;
    postThemeColors({});
  }

  // Dialogs of Home Assistant use its theme, which may be dark only. The change stays in this
  // page: it is not saved, and leaving the dashboard brings the user's theme back.
  _matchTheme(light) {
    const app = document.querySelector("home-assistant");
    if (!app?._updateHass || !app._applyTheme || !app.hass) return;
    if (light && !this._userTheme) this._userTheme = { value: app.hass.selectedTheme };
    if (!light && !this._userTheme) return;
    app._updateHass({ selectedTheme: light ? { theme: "default", dark: false } : this._userTheme.value });
    if (!light) this._userTheme = null;
    app._applyTheme(window.matchMedia(DARK_SCHEME).matches);
  }

  // A dialog of Home Assistant opens on the whole screen, like the sheets here.
  _watchDialogs() {
    const parent = document.querySelector("home-assistant")?.shadowRoot;
    if (!parent) return;
    this._sheetObserver = new MutationObserver(() => {
      parent.querySelectorAll("ha-more-info-dialog").forEach((dialog) => {
        dialog.style.setProperty("--ha-bottom-sheet-height", "100dvh");
        dialog.style.setProperty("--ha-bottom-sheet-max-height", "100dvh");
      });
    });
    this._sheetObserver.observe(parent, { childList: true });
  }

  get _bandBackground() {
    if (this._overlay?.sheet?.kind === "camera") return CAMERA_BAND;
    return this._overlay ? null : this.pageBackground;
  }

  // The app colours the area above the page itself. A theme change sends the colours of the theme
  // shortly after, so the band goes out once more when that has passed.
  async _paintBand() {
    const background = this._bandBackground;
    const band = background === CAMERA_BAND ? CAMERA_BAND : await backgroundTop(background);
    if (background !== this._bandBackground) return;
    this._band = band;
    postThemeColors({ band });
    clearTimeout(this._bandTimer);
    this._bandTimer = setTimeout(() => postThemeColors({ band: this._band }), BAND_REPEAT_MS);
  }

  _onVisible = () => {
    if (document.visibilityState === "visible") this._paintBand();
  };

  get _showsPlayer() {
    return Boolean(this._playerId) && this.page !== "music";
  }

  _refreshPlayer() {
    if (!this.hass) return;
    if (this.raw !== this._selectionRaw || REGISTRIES.some((name) => this._registries?.[name] !== this.hass[name])) {
      this._config = personalize(normalizeConfig(this.raw), this.hass.user?.id, personalPrefs());
      this._selection = selectEntities(this.hass, this._config);
      this._selectionRaw = this.raw;
      this._registries = this.hass;
      this._armIdle();
    }
    this._playerId = nowPlaying(this.hass, this._selection);
  }

  connectedCallback() {
    super.connectedCallback();
    this._debug = new URLSearchParams(window.location.search).has("dashboard_debug");
    this._onPopState = () => {
      if (!this._overlay) return;
      this._overlay = null;
      this._closing = null;
      this._afterClose?.();
      this._afterClose = null;
    };
    window.addEventListener("popstate", this._onPopState);
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, this._armIdle, { capture: true, passive: true }));
    this._themeMeta = document.querySelector('meta[name="theme-color"]');
    this._themeColour = this._themeMeta?.getAttribute("content");
    this._scheme = window.matchMedia(DARK_SCHEME);
    this._scheme.addEventListener("change", this._paintDocument);
    document.addEventListener("visibilitychange", this._onVisible);
    window.addEventListener(PREFS_EVENT, this._onPrefs);
    this._lockZoom();
    watchPresses();
    this._paintDocument();
    this._watchDialogs();
    if (this.root) {
      this._observer = new ResizeObserver(this._followRoot);
      this._observer.observe(this.root);
      window.addEventListener("click", this._followRoot, { capture: true, passive: true });
    }
  }

  // The sidebar of Home Assistant slides, and the last resize can come before it stops, so the bars
  // keep up for a moment longer. A click counts too: it is what folds the sidebar.
  _followRoot = () => {
    this._followUntil = performance.now() + FOLLOW_ROOT_MS;
    if (this._following) return;
    this._following = true;
    const step = () => {
      if (this.root) this._left = Math.round(this.root.getBoundingClientRect().left);
      if (this.isConnected && performance.now() < this._followUntil) requestAnimationFrame(step);
      else this._following = false;
    };
    requestAnimationFrame(step);
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("popstate", this._onPopState);
    ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, this._armIdle, { capture: true }));
    this._observer?.disconnect();
    window.removeEventListener("click", this._followRoot, { capture: true });
    clearInterval(this._timer);
    clearTimeout(this._idleTimer);
    this._settingsWatch?.then((unsubscribe) => unsubscribe?.());
    this._settingsWatch = null;
    this._scheme.removeEventListener("change", this._paintDocument);
    document.removeEventListener("visibilitychange", this._onVisible);
    window.removeEventListener(PREFS_EVENT, this._onPrefs);
    this._unlockZoom();
    stopWatchingPresses();
    this._restoreDocument();
  }

  // Tablets only: a phone is in someone's hand, and its page should wait for them.
  _armIdle = () => {
    clearTimeout(this._idleTimer);
    const seconds = this._config?.idle.return_after;
    if (seconds && currentLayout() === "tablet") {
      this._idleTimer = setTimeout(this._returnHome, seconds * 1000);
    }
  };

  _returnHome = async () => {
    if (holdsScreen(this._overlay) || this.card?.editing || this.page === "music") {
      this._armIdle();
      return;
    }
    await this.close();
    if (this.page === "home") this.card?.resetView?.();
    else this._navigate(PAGES[0]);
    pageScroller(this.card).scrollTo(0, 0);
  };

  updated(changed) {
    if (changed.has("pageBackground") || changed.has("_overlay")) this._paintBand();
    const space = this._showsPlayer ? PLAYER_SPACE : NO_PLAYER_SPACE;
    (this.root ?? document.documentElement).style.setProperty("--hd-player-space", space);
    if (this._debug && !this._timer) {
      const refresh = () => {
        this._report = layoutReport(this.renderRoot.querySelector("nav"), this.root);
      };
      refresh();
      this._timer = setInterval(refresh, 2000);
    }
  }

  // Overlays take a history entry, so the back button closes them instead of leaving the page.
  open(overlay) {
    if (!this._overlay) window.history.pushState({ homeDashboardOverlay: true }, "");
    // What opens from a page in a sheet goes back to that page.
    const opener = this._overlay?.sheet?.kind === "page" && overlay.sheet?.kind !== "page" ? this._overlay : null;
    this._overlay = opener ? { ...overlay, opener } : overlay;
  }

  // A second call while the first is on its way must not step back through the history again.
  close() {
    if (!this._overlay) return Promise.resolve();
    if (this._overlay.opener) {
      this._overlay = this._overlay.opener;
      return Promise.resolve();
    }
    this._closing ??= new Promise((resolve) => {
      this._afterClose = resolve;
      window.history.back();
    });
    return this._closing;
  }

  // A room has no place in the navigation of its own: it belongs to Home.
  // With a music page configured it takes the place of Media, which moves to the shortcuts.
  get _pages() {
    if (!this._config?.music) return PAGES;
    return PAGES.map((page) => (page.key === "media" ? MUSIC_PAGE : page));
  }

  _openShortcut(item) {
    this.open({ type: "sheet", sheet: { kind: item.kind, entityId: item.entity, item } });
  }

  get _activePage() {
    return this.page === "room" ? "home" : this.page;
  }

  _navigate(page) {
    if (page.key === this.page) return;
    navigateTo(`${dashboardPath(window.location.pathname)}/${page.path}${this._debug ? "?dashboard_debug=1" : ""}`);
  }

  async _pickPage(page) {
    await this.close();
    this._navigate(page);
  }

  async _pickLink(path) {
    await this.close();
    navigateTo(path);
  }

  async _pickRoom(id) {
    await this.close();
    navigateTo(`${dashboardPath(window.location.pathname)}/room?room=${encodeURIComponent(id)}`);
  }

  async _pickHome() {
    await this.close();
    navigateTo(`${dashboardPath(window.location.pathname)}/home`);
  }

  // Only an administrator gets here. The older places of a background give way to the shared list.
  _saveBackground(event) {
    const { target, shared } = event.detail;
    const { background, ...raw } = this.raw;
    const layout = (raw.layout ?? []).map((room) => {
      if (room.id !== target) return room;
      const { background: old, ...rest } = room;
      return rest;
    });
    const dashboard = { ...(target === "home" ? raw : this.raw), layout, backgrounds: { ...raw.backgrounds, [target]: shared } };
    return this._saveSettings({ detail: { dashboard } });
  }

  _saveShortcuts(event) {
    const { shortcuts, renamed } = event.detail;
    const raw = renamed ? renameBlockRules(this.raw, renamed.from, renamed.to) : this.raw;
    return this._saveSettings({ detail: { dashboard: { ...raw, shortcuts } } });
  }

  _saveMedia(event) {
    const media = { ...this.raw.media, sections: event.detail.sections };
    return this._saveSettings({ detail: { dashboard: { ...this.raw, media } } });
  }

  _saveLayout(event) {
    const { rooms, favorites } = event.detail;
    const dashboard = { ...this.raw, rooms: { ...this.raw.rooms, ...rooms }, favorites };
    return this._saveSettings({ detail: { dashboard } });
  }

  _saveAccess(event) {
    return this._saveSettings({ detail: { dashboard: { ...this.raw, access: event.detail.access } } });
  }

  async _editScreen(event) {
    await this.close();
    event.detail.onEdit();
  }

  async _details(event) {
    await this.close();
    this._fire("hass-more-info", { entityId: event.detail.entityId });
  }

  async _saveSettings(event) {
    const urlPath = dashboardPath(window.location.pathname).slice(1);
    const current = await this.hass.callWS({ type: "lovelace/config", url_path: urlPath });
    const strategy = { ...event.detail.dashboard, type: current.strategy.type };
    await this.hass.callWS({ type: "lovelace/config/save", url_path: urlPath, config: { ...current, strategy } });
    await this.close();
    this._reload();
  }

  _reload() {
    window.location.reload();
  }

  _fire(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  _renderDebug() {
    if (!this._report) return nothing;
    return html`<pre class="debug">${Object.entries(this._report)
      .map(([name, value]) => `${name}: ${value}`)
      .join("\n")}</pre>`;
  }

  _renderMiniPlayer(language) {
    // Music Assistant shows its own player on the music page.
    if (!this._showsPlayer) return nothing;
    const player = buildPlayer(this.hass, this._playerId, this._config);
    if (!player) return nothing;
    return html`
      <div class="mini" style="--hd-left: ${this._left ?? 0}px" data-mini>
        <button
          class="mini-open"
          aria-label=${translate(language, "now_playing")}
          @click=${() => this.open({ type: "sheet", sheet: { kind: "player", entityId: this._playerId } })}
        >
          <span class="mini-art">
            ${player.picture
              ? html`<img src=${this.hass.hassUrl(player.picture)} alt="" />`
              : html`<ha-icon icon="mdi:music"></ha-icon>`}
          </span>
          <span class="mini-text"><strong>${player.room}</strong><small>${player.title}</small></span>
        </button>
        <button
          class="mini-play"
          data-mini-play
          aria-label="play"
          @click=${() => this.hass.callService("media_player", "media_play_pause", { entity_id: this._playerId })}
        >
          <ha-icon .icon=${player.playing ? "mdi:pause" : "mdi:play"}></ha-icon>
        </button>
      </div>
    `;
  }

  _renderMenuItem(item) {
    const icon = html`<ha-icon .icon=${item.icon ?? "mdi:circle-small"}></ha-icon>`;
    if (item.block) {
      return html`<button data-drawer-shortcut=${item.name} @click=${() => this._openShortcut(item.block)}>${icon}${item.name}</button>`;
    }
    if (item.addon) {
      const open = () => this.open({ type: "sheet", sheet: { kind: "app", item } });
      return html`<button data-menu-app=${item.addon} @click=${open}>${icon}${item.name}</button>`;
    }
    if (item.action) {
      return html`<button data-menu-action=${item.action} @click=${() => this._runMenuAction(item.action)}>${icon}${item.name}</button>`;
    }
    const kind = WINDOWS[item.path];
    const open = () => (kind ? this.open({ type: "sheet", sheet: { kind } }) : this._pickLink(item.path));
    return html`<button data-link=${item.path} @click=${open}>${icon}${item.name}</button>`;
  }

  _runMenuAction(action) {
    if (action === "notifications") this.open({ type: "sheet", sheet: { kind: "notifications" } });
  }

  _editMenu() {
    const groups = menuGroups(this._config, LINKS, this.hass.language);
    const onSave = ({ kind, ...menu }) => this._saveSettings({ detail: { dashboard: { ...this.raw, menu } } });
    this.open({ type: "sheet", sheet: { kind: "block-edit", item: { kind: "menu", groups }, onSave } });
  }

  _renderDrawer(language) {
    const admin = this.hass.user?.is_admin;
    const rooms = buildRoomList(this.hass, this._config, this._selection);
    const groups = shownMenu(this.hass, this._config, LINKS);
    return html`
      <div class="scrim" @click=${() => this.close()}></div>
      <aside class="drawer" data-drawer>
        <ul>
          ${this._pages.map(
            (page) => html`
              <li>
                <button
                  class=${page.key === this._activePage ? "active" : ""}
                  data-go=${page.key}
                  @click=${() => this._pickPage(page)}
                >
                  <ha-icon .icon=${page.icon}></ha-icon>${translate(language, `nav_${page.key}`)}
                </button>
              </li>
            `,
          )}
        </ul>
        ${groups.map(
          (group) => html`
            <hr />
            ${group.title ? html`<h3>${group.title}</h3>` : nothing}
            <ul>
              ${group.items.map((item) => html`<li>${this._renderMenuItem(item)}</li>`)}
            </ul>
          `,
        )}
        ${admin
          ? html`
              <hr />
              <ul>
                <li>
                  <button data-settings @click=${() => this.open({ type: "settings" })}>
                    <ha-icon icon="mdi:cog-outline"></ha-icon>${translate(language, "settings")}
                  </button>
                </li>
              </ul>
            `
          : nothing}
        ${rooms.length
          ? html`
              <hr />
              <ul>
                ${rooms.map(
                  (room) => html`
                    <li><button data-jump=${room.id} @click=${() => this._pickRoom(room.id)}>${room.name}</button></li>
                  `,
                )}
              </ul>
            `
          : nothing}
        ${admin
          ? html`
              <hr />
              <ul>
                <li>
                  <button data-menu-edit @click=${this._editMenu}>
                    <ha-icon icon="mdi:pencil-outline"></ha-icon>${translate(language, "menu_edit")}
                  </button>
                </li>
              </ul>
            `
          : nothing}
      </aside>
    `;
  }

  _renderOverlay(language) {
    const overlay = this._overlay;
    if (!overlay) return nothing;
    if (overlay.type === "drawer") return this._renderDrawer(language);
    if (overlay.type === "settings") {
      return html`<home-dashboard-settings
        .hass=${this.hass}
        .raw=${this.raw}
        @settings-close=${() => this.close()}
        @settings-save=${this._saveSettings}
      ></home-dashboard-settings>`;
    }
    return html`<home-dashboard-sheet
      .hass=${this.hass}
      .sheet=${overlay.sheet}
      .config=${this._config}
      .raw=${this.raw}
      .layout=${currentLayout()}
      @sheet-close=${() => this.close()}
      @sheet-change=${(event) => this.open({ type: "sheet", sheet: event.detail })}
      @sheet-room=${(event) => this._pickRoom(event.detail.id)}
      @sheet-home=${this._pickHome}
      @sheet-edit=${this._editScreen}
      @sheet-access=${this._saveAccess}
      @sheet-layout=${this._saveLayout}
      @sheet-shortcuts=${this._saveShortcuts}
      @sheet-media=${this._saveMedia}
      @sheet-link=${(event) => this._pickLink(event.detail.path)}
      @sheet-background=${this._saveBackground}
      @sheet-details=${this._details}
    ></home-dashboard-sheet>`;
  }

  render() {
    const language = this.hass?.language;
    return html`
      ${this.hass ? this._renderMiniPlayer(language) : nothing}
      <nav class=${this.navTucked ? "tucked" : ""} style="--hd-left: ${this._left ?? 0}px">
        <button
          class="rail-only"
          data-menu
          aria-label=${translate(language, "menu")}
          @click=${() => this.open({ type: "drawer" })}
        >
          <ha-icon icon="mdi:menu"></ha-icon>
        </button>
        ${this._pages.map(
          (page) => html`
            <button
              class="item ${page.key === this._activePage ? "active" : ""}"
              data-page=${page.key}
              @click=${() => this._navigate(page)}
            >
              <span class="pill"><ha-icon .icon=${page.icon}></ha-icon></span>
              <span class="label">${translate(language, `nav_${page.key}`)}</span>
            </button>
          `,
        )}
        <span class="rail-only spacer"></span>
        <button
          class="rail-only"
          aria-label=${translate(language, "voice")}
          @click=${() =>
            this._fire("hass-action", {
              config: { tap_action: { action: "assist", start_listening: true } },
              action: "tap",
            })}
        >
          <ha-icon icon="mdi:microphone"></ha-icon>
        </button>
      </nav>
      ${this.hass ? this._renderOverlay(language) : nothing}
      ${this._renderDebug()}
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
      nav {
        position: fixed;
        z-index: 5;
        right: 0;
        bottom: 0;
        left: var(--hd-left, 0);
        display: flex;
        justify-content: space-around;
        box-sizing: border-box;
        height: calc(var(--hd-nav-height) + var(--hd-nav-safe));
        padding: 8px 8px var(--hd-nav-safe);
        background: var(--hd-background);
        transition: transform 220ms ease;
      }
      /* On a phone the bar goes away for a full-screen player inside the music page. */
      nav.tucked {
        transform: translateY(100%);
      }
      .rail-only {
        display: none;
      }
      .item {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      .pill {
        display: grid;
        place-items: center;
        width: 60px;
        height: 32px;
        border-radius: 16px;
        transition: background-color 180ms ease;
      }
      .active .pill {
        background: var(--hd-pill);
      }
      .label {
        font-size: 12px;
        line-height: 16px;
        font-weight: 500;
      }
      .mini {
        position: fixed;
        z-index: 5;
        right: 16px;
        bottom: calc(var(--hd-nav-height) + var(--hd-nav-safe) + 8px);
        left: calc(var(--hd-left, 0px) + 16px);
        display: flex;
        align-items: center;
        box-sizing: border-box;
        height: 64px;
        padding: 0 8px;
        border-radius: 16px;
        background: var(--hd-player);
      }
      .mini-open {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .mini-art {
        display: grid;
        flex: none;
        place-items: center;
        width: 48px;
        height: 48px;
        overflow: hidden;
        border-radius: 8px;
        background: var(--hd-off);
      }
      .mini-art img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .mini-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .mini-text strong,
      .mini-text small {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .mini-text strong {
        font-size: 15px;
        font-weight: 500;
      }
      .mini-text small {
        font-size: 13px;
        color: var(--hd-text-muted);
      }
      .mini-play {
        display: grid;
        flex: none;
        place-items: center;
        width: 48px;
        height: 48px;
      }
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 7;
        background: rgba(0, 0, 0, 0.45);
      }
      .drawer {
        position: fixed;
        z-index: 8;
        top: 0;
        bottom: 0;
        left: 0;
        box-sizing: border-box;
        width: min(320px, 86vw);
        padding: 0 12px calc(var(--hd-safe-bottom) + 16px);
        overflow-y: auto;
        background: var(--hd-background);
      }
      /* Stands still under the clock of the phone, so the list does not run through it. */
      .drawer::before {
        content: "";
        position: sticky;
        z-index: 1;
        top: 0;
        display: block;
        height: calc(var(--hd-safe-top) + 16px);
        margin: 0 -12px;
        background: var(--hd-background);
      }
      .drawer ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .drawer button {
        display: flex;
        align-items: center;
        gap: 16px;
        box-sizing: border-box;
        width: 100%;
        min-height: 52px;
        padding: 0 16px;
        border-radius: 26px;
      }
      .drawer button.active {
        background: var(--hd-pill);
      }
      .drawer h3 {
        margin: 0;
        padding: 4px 24px 0;
        color: var(--hd-text-muted);
        font-size: 13px;
        font-weight: 500;
      }
      .drawer hr {
        margin: 8px 16px;
        border: 0;
        border-top: 1px solid var(--hd-outline);
      }
      .debug {
        position: fixed;
        z-index: 9;
        top: 60px;
        right: 8px;
        max-width: 320px;
        margin: 0;
        padding: 8px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        font: 11px/15px monospace;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.8);
        pointer-events: none;
      }
      @media ${unsafeCSS(TABLET_MEDIA_QUERY)} {
        nav.tucked {
          transform: none;
        }
        nav {
          top: 0;
          right: auto;
          flex-direction: column;
          justify-content: flex-start;
          gap: 12px;
          width: var(--hd-rail-width);
          height: auto;
          padding: calc(var(--hd-safe-top) + 12px) 0 calc(var(--hd-safe-bottom) + 12px);
        }
        .rail-only {
          display: grid;
          place-items: center;
          min-height: 56px;
        }
        .spacer {
          flex: 1;
        }
        .item {
          flex: none;
          min-height: 56px;
        }
        .mini {
          right: 24px;
          bottom: 24px;
          left: auto;
          width: 340px;
        }
      }
    `,
  ];
}
