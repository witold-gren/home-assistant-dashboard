// One dashboard page. Tiles are templates, not elements: hundreds of elements are what makes a
// dashboard heavy on a tablet.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import {
  attachChrome,
  currentLayout,
  dashboardPath,
  navigateTo,
  openDrawer,
  openSheet,
  pageScroller,
  saveDashboard,
  setPageBackground,
  setViewBackground,
  paintsView,
  goHome,
  tuckNavigation,
  updateChrome,
} from "./chrome.js";
import { translate } from "./i18n.js";
import { backgroundVeil, panelVariables, tileColour, tileColourStyle, tileVariables } from "./appearance.js";
import { PREFS_EVENT, personalPrefs } from "./prefs.js";
import { createRecorder } from "./intercom.js";
import { dismissAlert, homeAlerts, shownAlerts } from "./alerts.js";
import {
  applyFilter,
  blockFor,
  buildHomeModel,
  buildPeople,
  buildRoomList,
  buildRoomModel,
  buildMediaSections,
  buildTrackers,
  buildZones,
  MAP_HOURS,
  mapCardConfig,
  buildSpeakers,
  cameraColumns,
  editableTile,
  intercomAreas,
  normalizeConfig,
  personalize,
  tileKey,
  visibilityMark,
  visibilityRule,
  withVisibility,
  pickBackground,
  pickBackgroundPosition,
  sharedBackground,
  pictureAge,
  playableSources,
  SCENES_ROOM,
  selectEntities,
  arrangeChips,
  blockKey,
  chipKey,
  shownShortcuts,
  watchedEntityIds,
} from "./model.js";
import {
  addSection,
  addTile,
  applyRoom,
  editableLists,
  moveSection,
  toggleSectionRow,
  moveTile,
  removeSection,
  removeTile,
  renameSection,
  renameTile,
  resizeTile,
  replaceTile,
  roomDraft,
  SCENE_DOMAINS,
  scenesDraft,
} from "./room-editor.js";
import { rememberConfig } from "./settings.js";
import { streamDot, streamDotStyles } from "./connections.js";
import { buildRoomStatus, roomActions } from "./status.js";
import { backgroundStyle, isDark, screenShape, tokens, viewBackgroundFor, WIDE_QUERY } from "./styles.js";

const REGISTRIES = ["entities", "devices", "areas", "floors"];
const MEDIA_BROWSER_PATH = "/media-browser/browser";
const SHEET_KINDS = { alarm_control_panel: "alarm", input_boolean: "switch", media_player: "player" };
const PICTURE_REFRESH_MS = 30000;
const SHORTCUT_TONES = ["green", "purple", "teal", "pink"];
const DRAG_EDGE = 72;
const DRAG_SCROLL = 12;
const LONG_TITLE = 14;
const RAN_MS = 2000;
// What Music Assistant needs to run under the clock of a phone: its bars and panels start lower.
const MUSIC_INSET_STYLE = `
  header.v-toolbar { height: auto !important; padding-top: var(--hd-inset) !important; }
  [data-sidebar="header"] { padding-top: calc(var(--hd-inset) + 8px) !important; }
  .v-overlay__content { padding-top: var(--hd-inset); box-sizing: border-box; }
`;
const FRAME_MENU_MESSAGE = "home-assistant/toggle-menu";
const MAP_FOCUS_ZOOM = 15;
const MAP_PANEL_FOLDED_PX = 32;
const MAP_PANEL_OPEN = 0.48;
const MAP_DRAG_START_PX = 6;
const CLICK_AFTER_DRAG_MS = 300;
const MAP_CONTROL_TRIES = 20;
const MAP_HOURS_KEY = "home_dashboard_map_hours";
const MAP_WHO_KEY = "home_dashboard_map_who";
const MAP_CONTROL_WAIT_MS = 500;
const MUSIC_PLAYER_CHECK_MS = 250;
const MUSIC_PLAYER = ".v-overlay--active .fullscreen-player-card";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const FILTER_RISE_MS = 520;
const FILTER_FADE_MS = 280;

export class HomeDashboardPage extends LitElement {
  static properties = {
    _model: { state: true },
    _sources: { state: true },
    _edit: { state: true },
    _drag: { state: true },
    _energyReady: { state: true },
    _mapTab: { state: true },
    _mapPanel: { state: true },
    _musicUnderClock: { state: true },
    _mapDrag: { state: true },
    _leavingModel: { state: true },
    _ran: { state: true },
  };

  setConfig(config) {
    this._page = config.page ?? "home";
    this._raw = config.dashboard ?? {};
    this._config = normalizeConfig(config.dashboard);
    // Inside a sheet the page is only content: the navigation and the scrolling belong to the view.
    this._embedded = Boolean(config.embedded);
    this.toggleAttribute("embedded", this._embedded);
    this._selection = null;
    this._filter = new URLSearchParams(window.location.search).get("filter");
  }

  getCardSize() {
    return 12;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._hass && !this._embedded) attachChrome(this, this._hass, this._page, this._raw);
    window.addEventListener(PREFS_EVENT, this._onPrefs);
    // A page shown again, as Home after a room, puts its own background back on the view.
    if (this.hasUpdated) this.requestUpdate();
    // Turning a tablet changes the shape of the screen, and with it the background.
    this._shapeQuery = window.matchMedia(WIDE_QUERY);
    this._shapeQuery.addEventListener("change", this._onShape);
    this._pictureTimer = setInterval(this._refreshPictures, PICTURE_REFRESH_MS);
    // Home Assistant keeps a page it has shown and puts the same one back on the way in.
    if (this.hasUpdated) this._watchMusic();
    // Home Assistant keeps this card when only the query changes, as between two rooms.
    if (this._page === "room") {
      window.addEventListener("location-changed", this._onLocation);
      window.addEventListener("popstate", this._onLocation);
      this._onLocation();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._pictureTimer);
    clearTimeout(this._leavingTimer);
    clearInterval(this._musicWatch);
    window.removeEventListener("message", this._onFrameMessage);
    clearTimeout(this._ranTimer);
    window.removeEventListener(PREFS_EVENT, this._onPrefs);
    this._shapeQuery?.removeEventListener("change", this._onShape);
    if (this._page === "music") tuckNavigation(this, false);
    window.removeEventListener("location-changed", this._onLocation);
    window.removeEventListener("popstate", this._onLocation);
  }

  // Music Assistant does not tell the page anything, and a frame from another address cannot be
  // read at all: there the navigation simply stays.
  _watchMusic() {
    if (this._page !== "music") return;
    clearInterval(this._musicWatch);
    this._musicWatch = setInterval(this._checkMusicPlayer, MUSIC_PLAYER_CHECK_MS);
    window.addEventListener("message", this._onFrameMessage);
  }

  get _musicFrame() {
    const card = this.renderRoot.querySelector("[data-cards] > *");
    return (
      this.renderRoot.querySelector("iframe") ??
      this.renderRoot.querySelector("home-dashboard-app")?.shadowRoot?.querySelector("iframe") ??
      card?.querySelector("iframe") ??
      card?.shadowRoot?.querySelector("iframe")
    );
  }

  // In a frame the menu button of an add-on asks for the sidebar. A fullscreen app has no other way out.
  _onFrameMessage = ({ data, source }) => {
    if (data?.type !== FRAME_MENU_MESSAGE || !this._config.music?.fullscreen) return;
    if (source === this._musicFrame?.contentWindow) goHome(this);
  };

  _checkMusicPlayer = () => {
    const frame = this._musicFrame;
    // The bar goes only once the frame is there: without it nobody could leave the page.
    if (frame && this._config.music?.fullscreen) {
      tuckNavigation(this, true);
      return;
    }
    let open = false;
    try {
      open = Boolean(frame?.contentDocument?.querySelector(MUSIC_PLAYER));
    } catch {
      open = false;
    }
    tuckNavigation(this, open);
  };

  _onPrefs = () => {
    this._selection = null;
    if (this._hass) this.hass = this._hass;
  };

  _onShape = () => this.requestUpdate();

  _onLocation = () => {
    const room = new URLSearchParams(window.location.search).get("room");
    if (!room || room === this._room) return;
    this._room = room;
    this._edit = null;
    pageScroller(this).scrollTo(0, 0);
    if (this._selection) {
      this._refresh();
      this._watchEntities();
    }
  };

  // Also ages the labels; a tablet left on the wall must not show a current picture as stale.
  _refreshPictures = () => {
    if (document.visibilityState !== "visible" || !this._model?.cameras?.length) return;
    this._pictureTick = Date.now();
    this.requestUpdate();
  };

  // A new page starts from its top, whatever the view scrolled to before.
  firstUpdated() {
    if (!this._embedded) {
      pageScroller(this).scrollTo(0, 0);
      attachChrome(this, this._hass, this._page, this._raw);
    }
    if (this._page === "media") this._loadSources();
    if (this._page === "energy") this._loadEnergy();
    if (this._page === "map") this._mountMap();
    if (this._page === "music" && this._musicCard) this._mountCards([this._musicCard]);
    this._watchMusic();
  }

  set hass(hass) {
    const previous = this._hass;
    this._hass = hass;
    if (!this._embedded) updateChrome(this, hass);
    this._cards?.forEach((card) => {
      card.hass = hass;
    });
    if (REGISTRIES.some((name) => previous?.[name] !== hass[name])) this._selection = null;
    const stale = !this._selection;
    if (stale) {
      this._config = personalize(normalizeConfig(this._raw), hass.user?.id, personalPrefs());
      this._selection = selectEntities(hass, this._config);
      this._watchEntities();
    }
    const changed = [...this._watched].some((id) => previous?.states[id] !== hass.states[id]);
    if (stale || !previous || changed || (this._page === "map" && previous.states !== hass.states)) {
      this._refresh();
    }
  }

  get hass() {
    return this._hass;
  }

  _watchEntities() {
    const areas = this._page === "room" ? this._roomAreas() : [];
    this._watched = watchedEntityIds(this._hass, this._config, this._selection, areas);
  }

  _roomAreas() {
    this._room ??= new URLSearchParams(window.location.search).get("room");
    return buildRoomModel(this._hass, this._config, this._selection, this._room).areas;
  }

  _refresh() {
    const layout = currentLayout();
    if (this._page === "room") {
      this._room ??= new URLSearchParams(window.location.search).get("room");
      const model = buildRoomModel(this._hass, this._config, this._selection, this._room, layout);
      const actions = roomActions(this._hass, this._config, model, layout);
      this._model = { ...model, actions, status: buildRoomStatus(this._hass, this._config, model.areas, model.fixedStatus) };
    } else if (this._page === "media") {
      this._model = {
        speakers: buildSpeakers(this._hass, this._config, this._selection, layout),
        sections: buildMediaSections(this._hass, this._config, layout),
      };
    } else if (this._page === "map") {
      this._model = {
        people: buildPeople(this._hass).filter(({ entityId }) => !this._config.denied?.includes(entityId)),
        devices: buildTrackers(this._hass, this._config),
        zones: buildZones(this._hass),
      };
    } else if (this._page === "home") {
      const model = buildHomeModel(this._hass, this._config, this._selection, layout);
      this._model = applyFilter(model, this._filter, this._hass.language);
      this._model.chips = model.chips;
    } else {
      this._model = {};
    }
  }

  _toggleFilter(key) {
    this._filter = this._filter === key ? null : key;
    const url = new URL(window.location.href);
    if (this._filter) url.searchParams.set("filter", this._filter);
    else url.searchParams.delete("filter");
    window.history.replaceState(window.history.state, "", url);
    const before = this._model;
    this._refresh();
    if (!window.matchMedia(REDUCED_MOTION).matches) this._playFilterChange(before);
  }

  // The old content fades where it is while the new one rises into place, further the lower it
  // starts, so the page seems to fold up. Both are on the page until the fade is over.
  async _playFilterChange(before) {
    this._leavingModel = before;
    clearTimeout(this._leavingTimer);
    await this.updateComplete;
    const root = this.renderRoot;
    const rise = { duration: FILTER_RISE_MS, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)", fill: "backwards" };
    [...(root.querySelector(".stage-now")?.children ?? [])].forEach((child) => {
      const distance = Math.min(40 + child.offsetTop * 0.45, 320);
      child.animate([{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: "none" }], rise);
    });
    const fade = { duration: FILTER_FADE_MS, easing: "ease-out", fill: "forwards" };
    root.querySelector(".stage-old")?.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-12px)" }], fade);
    root.querySelector(".title-old")?.animate([{ opacity: 1 }, { opacity: 0 }], fade);
    root.querySelector(".title-now")?.animate([{ opacity: 0 }, { opacity: 1 }], fade);
    this._leavingTimer = setTimeout(() => {
      this._leavingModel = null;
    }, FILTER_RISE_MS);
  }

  // Called when a wall tablet has been left alone: the next person starts from a clean page.
  resetView() {
    if (this._filter) this._toggleFilter(this._filter);
  }

  async _mountCards(configs) {
    const helpers = await window.loadCardHelpers?.();
    const slot = this.renderRoot.querySelector("[data-cards]");
    if (!helpers || !slot) return;
    this._cards = await Promise.all(configs.map((config) => helpers.createCardElement(config)));
    this._cards.forEach((card) => {
      card.hass = this._hass;
      slot.appendChild(card);
    });
  }

  // Each device remembers whose routes it shows and how far back.
  _remembered(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  get _mapHours() {
    const hours = Number(this._remembered(MAP_HOURS_KEY));
    return MAP_HOURS.includes(hours) ? hours : this._config.appearance.map.hours;
  }

  get _mapWho() {
    return this._remembered(MAP_WHO_KEY) ?? "all";
  }

  get _mapSubjects() {
    const { track } = this._config.map;
    return {
      people: buildPeople(this._hass).filter(({ entityId }) => !this._config.denied?.includes(entityId)),
      devices: buildTrackers(this._hass, this._config).filter(({ entityId }) => track.includes(entityId)),
      zones: buildZones(this._hass),
    };
  }

  _pickMap(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Private browsing: the choice holds until the page reloads.
    }
    this._mountMap();
    this.requestUpdate();
  }

  // Home Assistant's map draws the routes; the page chooses what it draws and in which colours.
  async _mountMap() {
    const { theme } = this._config.appearance.map;
    const dark = theme === "auto" ? isDark() : theme === "dark";
    const config = mapCardConfig(this._mapSubjects, {
      track: this._config.map.track,
      who: this._mapWho,
      hours: this._mapHours,
      dark,
    });
    this.renderRoot.querySelector("[data-cards]")?.replaceChildren();
    await this._mountCards([config]);
    this._placeMapControls(MAP_CONTROL_TRIES);
  }

  // The list lies over the left side, so the buttons of the map move right. They live inside the card
  // and appear late; when a new frontend moves them, the map simply keeps them where they were.
  _placeMapControls(tries) {
    const card = this._cards?.[0]?.shadowRoot;
    const map = card?.querySelector("ha-map")?.shadowRoot;
    if (!map?.querySelector(".maplibregl-ctrl-top-left")) {
      if (tries > 0) setTimeout(() => this._placeMapControls(tries - 1), MAP_CONTROL_WAIT_MS);
      return;
    }
    const style = document.createElement("style");
    // Below the buttons for whose routes and how far back, and below the own buttons of the map.
    style.textContent = ".maplibregl-ctrl-top-left { top: 220px; left: auto; right: 0; }";
    map.append(style);
    const buttons = card.querySelector("ha-icon-button")?.parentElement;
    if (buttons) Object.assign(buttons.style, { left: "auto", right: "3px" });
  }

  async _loadSources() {
    try {
      const root = await this._hass.callWS({ type: "media_source/browse_media" });
      this._sources = playableSources(root.children);
    } catch {
      this._sources = [];
    }
  }

  // The page draws the energy itself from the settings of Home Assistant; the costs it worked out
  // live in statistics of their own, which energy/info names.
  async _loadEnergy() {
    let prefs = null;
    let info = {};
    try {
      prefs = await this._hass.callWS({ type: "energy/get_prefs" });
      info = await this._hass.callWS({ type: "energy/info" }).catch(() => ({}));
    } catch {
      // Not configured: the page says so.
    }
    this._energyReady = Boolean(prefs?.energy_sources?.length || prefs?.device_consumption?.length);
    this._energy = this._energyReady ? { prefs, info } : null;
    this.requestUpdate();
  }

  _fire(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  _openRoom(id) {
    navigateTo(`${dashboardPath(window.location.pathname)}/room?room=${encodeURIComponent(id)}`);
  }

  _openIntercom(areas, label) {
    openSheet(this, { kind: "intercom", areas, label, recorder: createRecorder(this._hass, this._config) });
  }

  // The speakers of this room and no other, also when the room joins several areas.
  _roomSpeakers(areas) {
    if (!this._config.intercom.script) return [];
    return intercomAreas(this._hass, this._config)
      .map((area) => area.id)
      .filter((id) => areas.includes(id));
  }

  _tap(tile) {
    if (tile.tapAction === "call") {
      this._hass.callService(tile.call.domain, tile.call.service, tile.call.data);
      if (!tile.offPin && !tile.quiet) this._confirmRun(tile);
    }
    if (tile.tapAction === "more-info") this._fire("hass-more-info", { entityId: tile.entityId });
    if (tile.tapAction === "panel" || tile.tapAction === "tv") {
      openSheet(this, { kind: tile.tapAction, entityId: tile.entityId, item: tile.item });
    }
    // A block with a window of its own, as the scale.
    if (tile.tapAction === "block") openSheet(this, { kind: tile.item.kind, entityId: tile.entityId, item: tile.item });
    if (tile.tapAction === "pin") {
      openSheet(this, { kind: "pin", entityId: tile.entityId, name: tile.name, offPin: tile.offPin });
    }
    if (tile.tapAction === "sheet") {
      openSheet(this, { kind: SHEET_KINDS[tile.domain] ?? tile.domain, entityId: tile.entityId, name: tile.name });
    }
  }

  // A scene changes nothing on its tile, so the tile has to say that it worked.
  _confirmRun(tile) {
    this._ran = tile.entityId ?? tile.name;
    clearTimeout(this._ranTimer);
    this._ranTimer = setTimeout(() => {
      this._ran = null;
    }, RAN_MS);
  }

  _tapIcon(event, tile) {
    if (tile.iconAction !== "toggle") return;
    event.stopPropagation();
    this._hass.callService("homeassistant", "toggle", { entity_id: tile.entityId });
  }

  _renderTile(tile, showRoom) {
    const tint = tile.tint?.join(",");
    const ran = this._ran && this._ran === (tile.entityId ?? tile.name);
    // A colour chosen for the kind of tile wins over the colour of the lamp.
    const chosen = tileColourStyle(tileColour(tile, this._config.appearance));
    const tinted = tint ? `--tile-background: rgba(${tint}, 0.18); --tile-icon: rgba(${tint}, 0.75)` : null;
    return html`
      <button
        class="tile ${tile.tone} ${tile.available ? "" : "unavailable"} ${tile.stats?.length ? "wide" : ""} ${tile.size === "tall" && !tile.stats?.length ? "tall" : ""} ${ran ? "ran" : ""} ${tile.dormant ? "dormant" : ""}"
        style=${chosen ?? tinted ?? nothing}
        data-kind=${tile.kind ?? nothing}
        data-entity=${tile.entityId}
        data-tile=${tile.name}
        @click=${() => this._tap(tile)}
      >
        <span class="icon" @click=${(event) => this._tapIcon(event, tile)}>
          ${tile.badge ? html`<b>${tile.badge}</b>` : html`<ha-icon .icon=${ran ? "mdi:check" : tile.icon}></ha-icon>`}
        </span>
        <span class="text">
          ${showRoom && tile.roomName ? html`<small>${tile.roomName}</small>` : nothing}
          <strong>${tile.name}</strong>
          <small>${ran ? translate(this._hass.language, "run_done") : tile.stateText}</small>
        </span>
        ${tile.stats?.length
          ? html`<span class="stats">
              ${tile.stats.map((stat) => html`<span><b>${stat.value}</b><small>${stat.name}</small></span>`)}
            </span>`
          : nothing}
      </button>
    `;
  }

  _pictureUrl(camera) {
    const url = this._hass.hassUrl(camera.picture);
    if (camera.updatedAt || !this._pictureTick) return url;
    return `${url}${url.includes("?") ? "&" : "?"}tick=${this._pictureTick}`;
  }

  _renderCamera(camera, named = false) {
    // An unavailable camera still opens, to its window that says so under its name: which camera went away is seen
    // there, not written into a small tile. A guest's camera does not.
    const blocked = camera.unavailable || camera.guest;
    return html`
      <button
        class="camera ${blocked ? "offline" : ""} ${camera.guest ? "guest" : ""}"
        aria-label=${camera.name}
        data-camera=${camera.entityId}
        @click=${camera.guest ? nothing : () => openSheet(this, { kind: "camera", entityId: camera.entityId })}
      >
        ${camera.picture
          ? html`<img
              src=${this._pictureUrl(camera)}
              alt=""
              loading="lazy"
              @error=${(event) => (event.target.hidden = true)}
            />`
          : nothing}
        ${named ? html`<span class="camera-name">${camera.name}</span>` : nothing}
        ${streamDot(camera.streaming, translate(this._hass.language, "stream_open"))}
        ${blocked
          ? html`<span class="camera-off">
              <ha-icon icon=${camera.guest ? "mdi:lock" : "mdi:video-off-outline"}></ha-icon>
              ${translate(this._hass.language, camera.guest ? "camera_guest" : "camera_unavailable")}
            </span>`
          : html`<span class="age">${pictureAge(this._hass.language, camera.updatedAt, Date.now())}</span>`}
      </button>
    `;
  }

  _renderCameras(cameras) {
    if (!cameras.length) return nothing;
    const anyWorking = cameras.some((camera) => !camera.unavailable);
    return html`
      <section>
        <h2>
          <button
            class="section-link"
            data-cameras-all
            aria-label=${translate(this._hass.language, "cameras_all")}
            @click=${() => openSheet(this, { kind: "cameras", cameras: cameras.map((camera) => camera.entityId) })}
          >
            ${translate(this._hass.language, "section_cameras")}<ha-icon icon="mdi:chevron-right"></ha-icon>
          </button>
        </h2>
        <div class="cameras">
          ${cameraColumns(cameras).map(
            (column) => html`
              <div class="camera-column ${column.length > 1 || (column[0].unavailable && anyWorking) ? "stacked" : ""}">
                ${column.map((camera) => this._renderCamera(camera))}
              </div>
            `,
          )}
        </div>
      </section>
    `;
  }

  _renderCameraList(cameras) {
    if (!cameras?.length) return nothing;
    return html`
      <section>
        <h2>${translate(this._hass.language, "section_cameras")}</h2>
        <div class="camera-list">${cameras.map((camera) => this._renderCamera(camera, true))}</div>
      </section>
    `;
  }

  _renderRoomsButton() {
    const rooms = buildRoomList(this._hass, this._config, this._selection);
    return html`
      <button
        aria-label=${translate(this._hass.language, "rooms_pick")}
        data-rooms
        @click=${() =>
          openSheet(this, {
            kind: "rooms",
            rooms,
            personal: this._page === "home",
            roomView: this._page === "room" && this._room !== SCENES_ROOM ? this._room : null,
            onEdit: this._screenEditor,
            onBackground: this._backgroundEditor,
          })}
      >
        <ha-icon icon="mdi:dots-horizontal"></ha-icon>
      </button>
    `;
  }

  // What the menu offers to edit here. Editing is rare, so it has no button of its own.
  get _screenEditor() {
    return this._hass.user?.is_admin && this._page === "room" ? () => this._startEdit() : null;
  }

  get _backgroundEditor() {
    return this._backgroundKey ? () => this._openBackground() : null;
  }

  // Home, Map and Energy have a background of their own; a room is known by its id.
  get _backgroundKey() {
    if (["home", "map", "energy"].includes(this._page)) return this._page;
    if (this._page !== "room") return null;
    return this._room === SCENES_ROOM ? "scenes" : this._room;
  }

  get _legacyBackground() {
    return this._page === "home" ? this._config.background : this._model?.background;
  }

  _openBackground() {
    const target = this._backgroundKey;
    rememberConfig(JSON.stringify(this._raw, null, 2));
    openSheet(this, {
      kind: "background",
      target,
      shared: sharedBackground(this._config, target, this._legacyBackground),
      own: this._config.personalBackgrounds?.[target] ?? {},
    });
  }


  _openShortcut(item) {
    openSheet(this, { kind: item.kind, entityId: item.entity, item });
  }

  _renderWeather(weather) {
    if (!weather) return nothing;
    return html`
      <button
        class="chip"
        data-weather
        @click=${() => openSheet(this, { kind: "weather", entityId: weather.entity, item: weather })}
      >
        <ha-icon class=${weather.tone} .icon=${weather.icon}></ha-icon>
        <span><small>${weather.label}</small><strong>${weather.value}</strong></span>
      </button>
    `;
  }

  _renderShortcuts() {
    return shownShortcuts(this._hass, this._config).map((item, index) => ({
      id: blockKey(item),
      view: html`
        <button
          class="chip shortcut"
          data-shortcut=${item.name}
          @click=${() => this._openShortcut(item)}
        >
          <ha-icon class=${item.tone ?? SHORTCUT_TONES[index % SHORTCUT_TONES.length]} .icon=${item.icon}></ha-icon>
          <span>${item.label ? html`<small>${item.label}</small>` : nothing}<strong>${item.name}</strong></span>
        </button>
      `,
    }));
  }

  _renderChips({ chips, filter, weather }) {
    const entries = [
      ...(weather ? [{ id: chipKey("weather"), view: this._renderWeather(weather) }] : []),
      ...chips.map((chip) => ({
        id: chipKey(chip.key),
        view: html`
          <button
            class="chip ${chip.key === filter ? `selected ${chip.tone}` : ""}"
            data-chip=${chip.key}
            @click=${() => this._toggleFilter(chip.key)}
          >
            <ha-icon class=${chip.tone} .icon=${chip.icon}></ha-icon>
            <span><small>${chip.label}</small><strong>${chip.value}</strong></span>
          </button>
        `,
      })),
      ...this._renderShortcuts(),
    ];
    return arrangeChips(entries, this._config, filter && chipKey(filter)).map(({ view }) => view);
  }

  _renderPageTitle(title) {
    if (this._embedded) return nothing;
    return html`
      <div class="home-title">
        <h1>${title}</h1>
        <div class="intercom">${this._renderRoomsButton()}</div>
      </div>
    `;
  }

  _renderHomeActions() {
    const { intercom, filter } = this._model;
    const language = this._hass.language;
    const everywhere = translate(language, "intercom_home");
    return html`
      <div class="intercom">
        ${!filter && intercom?.length
          ? html`<button
              aria-label=${translate(language, "intercom")}
              data-intercom-all
              @click=${() =>
                this._openIntercom(
                  intercom.map((room) => room.id),
                  everywhere,
                )}
            >
              <ha-icon icon="mdi:waveform"></ha-icon>
            </button>`
          : nothing}
        ${this._renderRoomsButton()}
      </div>
    `;
  }

  // Warnings from the Status screen (alerts.js): one card each, a list of what it names, closable for today; with
  // one device, "More" opens it.
  _renderAlerts() {
    const alerts = shownAlerts(homeAlerts(this._hass, this._config));
    if (!alerts.length) return nothing;
    const language = this._hass.language;
    return html`
      <div class="alerts">
        ${alerts.map(
          (alert) => html`
            <div class="alert" data-alert=${alert.key}>
              <span class="alert-icon"><ha-icon .icon=${alert.icon ?? "mdi:alert-circle-outline"}></ha-icon></span>
              <span class="alert-text">
                <strong>${alert.name}</strong>
                <span>${alert.rows.map((row) => (row.value ? `${row.name} ${row.value}` : row.name)).join(", ")}</span>
                ${alert.rows.length === 1 && alert.rows[0].entity
                  ? html`<button
                      class="alert-more"
                      data-alert-more
                      @click=${() =>
                        this.dispatchEvent(
                          new CustomEvent("hass-more-info", {
                            bubbles: true,
                            composed: true,
                            detail: { entityId: alert.rows[0].entity },
                          }),
                        )}
                    >
                      ${translate(language, "alert_more")}
                    </button>`
                  : nothing}
              </span>
              <button
                class="alert-close"
                aria-label=${translate(language, "alert_close")}
                data-alert-close
                @click=${() => {
                  dismissAlert(alert);
                  this.requestUpdate();
                }}
              >
                <ha-icon icon="mdi:close"></ha-icon>
              </button>
            </div>
          `,
        )}
      </div>
    `;
  }

  _renderStatus(status) {
    if (!status.length) return nothing;
    return html`
      <div class="status">
        ${status.map(
          (pill) => html`
            <button
              class="pill ${pill.tone}"
              data-status=${pill.key}
              @click=${() => openSheet(this, { kind: "group", title: pill.title, ids: pill.ids })}
            >
              <span class="pill-icon"><ha-icon .icon=${pill.icon}></ha-icon></span>
              <span class="pill-text"><strong>${pill.title}</strong><small>${pill.value}</small></span>
            </button>
          `,
        )}
      </div>
    `;
  }

  _startSceneEdit() {
    const room = scenesDraft(this._fullConfig, translate(this._hass.language, "section_scenes"));
    this._edit = {
      room,
      tab: "home",
      scenes: true,
      scenesRow: this._config.scenes_layout === "row",
      ...this._rulesDraft,
    };
  }

  _renderScenes(scenes) {
    if (!scenes.length && !this._hass.user?.is_admin) return nothing;
    return html`
      <section data-scenes>
        <h2>
          <button class="room-link" data-room-link=${SCENES_ROOM} @click=${() => this._openRoom(SCENES_ROOM)}>
            ${translate(this._hass.language, "section_scenes")}<ha-icon icon="mdi:chevron-right"></ha-icon>
          </button>
        </h2>
        <div class="tiles ${this._config.scenes_layout === "row" ? "row" : ""}">
          ${scenes.map((tile) => this._renderTile(tile, false))}
        </div>
      </section>
    `;
  }

  _renderHome() {
    const { title } = this._model;
    const old = this._leavingModel;
    return html`
      <div class="home-title">
        <h1><span class="title-now">${title}</span>${old
          ? html`<span class="title-old" aria-hidden="true">${old.title}</span>`
          : nothing}</h1>
        ${this._renderHomeActions()}
      </div>
      <div class="chips">${this._renderChips(this._model)}</div>
      ${this._model.filter ? nothing : this._renderAlerts()}
      <div class="stage">
        <div class="stage-now">${this._renderHomeContent(this._model)}</div>
        ${old ? html`<div class="stage-old" aria-hidden="true" inert>${this._renderHomeContent(old)}</div>` : nothing}
      </div>
    `;
  }

  _renderHomeContent({ cameras, cameraList, favorites, rooms, filter, scenes }) {
    const language = this._hass.language;
    return html`
      ${this._renderCameras(cameras)}
      ${filter ? nothing : this._renderScenes(scenes)}
      ${favorites.length
        ? html`
            <section>
              <h2>${translate(language, "section_favorites")}</h2>
              <div class="tiles">${favorites.map((tile) => this._renderTile(tile, true))}</div>
            </section>
          `
        : nothing}
      ${rooms.map(
        (room) => html`
          <section data-room=${room.id}>
            <h2>
              ${room.plain
                ? room.name
                : html`<button class="room-link" data-room-link=${room.id} @click=${() => this._openRoom(room.id)}>
                    ${room.name}<ha-icon icon="mdi:chevron-right"></ha-icon>
                  </button>`}
            </h2>
            <div class="tiles">${room.tiles.map((tile) => this._renderTile(tile, false))}</div>
          </section>
        `,
      )}
      ${this._renderCameraList(cameraList)}
    `;
  }

  // A page without a background of its own takes the one of the look, except the music, which fills
  // the screen. The map takes it too: it shows above and below the map.
  get _background() {
    const key = this._backgroundKey;
    const mode = isDark() ? "dark" : "light";
    const own = key ? pickBackground(this._config, key, this._legacyBackground, mode, screenShape()) : null;
    if (own || this._page === "music") return own;
    return this._config.appearance.page[`background_${mode}`] ?? null;
  }

  get _backgroundPosition() {
    const key = this._backgroundKey;
    return key ? pickBackgroundPosition(this._config, key, this._legacyBackground) : "center";
  }

  // Editing ------------------------------------------------------------------------------------

  get editing() {
    return Boolean(this._edit);
  }

  // An administrator edits everything, also what this account does not see.
  get _fullConfig() {
    return normalizeConfig(this._raw);
  }

  _startEdit() {
    if (this._room === SCENES_ROOM) {
      this._startSceneEdit();
      return;
    }
    const room = roomDraft(this._hass, this._fullConfig, this._selection, this._room);
    // The editor starts from what the page shows, so saving keeps the same scenes.
    room.scenes ??= (this._model.actions ?? []).map((tile) => ({ entity: tile.entityId }));
    this._edit = { room, tab: "room", ...this._rulesDraft };
  }

  get _rulesDraft() {
    const { access, visibility } = this._fullConfig;
    return { access: structuredClone(access), visibility: structuredClone(visibility) };
  }

  _updateRoom(room) {
    this._edit = { ...this._edit, room };
  }

  async _saveEdit() {
    rememberConfig(JSON.stringify(this._raw, null, 2));
    const { room, scenes, scenesRow, access, visibility } = this._edit;
    this._edit = { ...this._edit, saving: true };
    const { scenes_layout: previous, ...rest } = this._raw;
    const scenesLayout = scenesRow ? { scenes_layout: "row" } : {};
    const saved = scenes ? { ...rest, scenes: room.home, ...scenesLayout } : applyRoom(this._raw, room);
    await saveDashboard(this, { ...saved, access, visibility });
  }

  _openPicker(list) {
    const { room, tab, scenes } = this._edit;
    openSheet(this, {
      kind: "tile-picker",
      config: this._fullConfig,
      room,
      tab,
      domains: scenes || tab === "scenes" ? SCENE_DOMAINS : null,
      onPick: (entity) => {
        const { room: current, tab: currentTab } = this._edit;
        this._updateRoom(addTile(current, currentTab, list, entity));
      },
    });
  }

  _openTile(at, item) {
    const { tab } = this._edit;
    const key = tileKey(item);
    openSheet(this, {
      kind: "tile-edit",
      item,
      rule: visibilityRule({ ...this._fullConfig, ...this._edit }, key),
      onRule: (rule) => {
        this._edit = { ...this._edit, ...withVisibility(this._edit, key, rule) };
      },
      onRename: (name) => this._updateRoom(renameTile(this._edit.room, tab, at, name)),
      onResize: (size) => this._updateRoom(resizeTile(this._edit.room, tab, at, size)),
      onBlock: (block) => this._updateRoom(replaceTile(this._edit.room, tab, at, block)),
      onRemove: () => this._updateRoom(removeTile(this._edit.room, tab, at)),
    });
  }

  _startDrag(event, from, name) {
    event.preventDefault();
    event.stopPropagation();
    this._drag = { from, name, to: null, x: event.clientX, y: event.clientY };
    window.addEventListener("pointermove", this._onDragMove);
    window.addEventListener("pointerup", this._onDragEnd);
    window.addEventListener("pointercancel", this._onDragCancel);
  }

  _onDragMove = (event) => {
    const { clientX: x, clientY: y } = event;
    const slot = this.renderRoot.elementFromPoint(x, y)?.closest("[data-slot]");
    const to = slot ? { list: Number(slot.dataset.list), index: Number(slot.dataset.slot) } : this._drag.to;
    this._drag = { ...this._drag, to, x, y };
    if (y < DRAG_EDGE) pageScroller(this).scrollBy(0, -DRAG_SCROLL);
    if (y > window.innerHeight - DRAG_EDGE) pageScroller(this).scrollBy(0, DRAG_SCROLL);
  };

  _stopDrag() {
    window.removeEventListener("pointermove", this._onDragMove);
    window.removeEventListener("pointerup", this._onDragEnd);
    window.removeEventListener("pointercancel", this._onDragCancel);
    this._drag = null;
  }

  _onDragEnd = () => {
    const { from, to } = this._drag;
    if (to) this._updateRoom(moveTile(this._edit.room, this._edit.tab, from, to));
    this._stopDrag();
  };

  _onDragCancel = () => this._stopDrag();

  _renderEditTile(item, list, index) {
    const { room } = this._edit;
    const full = { ...this._fullConfig, ...this._edit };
    const tile = editableTile(this._hass, item, room.name, full, currentLayout());
    const mark = visibilityMark(full, tileKey(item));
    const target = this._drag?.to;
    const dropping = target?.list === list && target.index === index;
    const dragged = this._drag?.from.list === list && this._drag.from.index === index;
    return html`
      <div
        class="tile edit-tile ${tile.tone} ${item.size === "tall" ? "tall" : ""} ${mark ?? ""} ${dropping ? "drop" : ""} ${dragged ? "dragged" : ""}"
        data-slot=${index}
        data-list=${list}
        data-edit-tile=${tile.name}
        @click=${() => this._openTile({ list, index }, item)}
      >
        <span class="icon"><ha-icon .icon=${tile.icon}></ha-icon></span>
        <span class="text"><strong>${tile.name}</strong><small>${tile.stateText}</small></span>
        ${mark
          ? html`<ha-icon class="mark" icon=${mark === "only" ? "mdi:account-check" : "mdi:account-cancel"}></ha-icon>`
          : nothing}
        <span
          class="grip"
          data-grip
          @click=${(event) => event.stopPropagation()}
          @pointerdown=${(event) => this._startDrag(event, { list, index }, tile.name)}
        >
          <ha-icon icon="mdi:drag"></ha-icon>
        </span>
      </div>
    `;
  }

  _renderRowToggle(row, onToggle) {
    return html`
      <button
        class="row-toggle ${row ? "on" : ""}"
        aria-label=${translate(this._hass.language, "edit_section_row")}
        aria-pressed=${Boolean(row)}
        data-section-row
        @click=${onToggle}
      >
        <ha-icon icon="mdi:arrow-left-right"></ha-icon>
      </button>
    `;
  }

  _renderEditList(section, list, count) {
    const { tab, room } = this._edit;
    const language = this._hass.language;
    const end = section.tiles.length;
    const dropping = this._drag?.to?.list === list && this._drag.to.index === end;
    return html`
      <section data-edit-list=${list}>
        ${tab === "room"
          ? html`<div class="edit-head">
              <input
                aria-label=${translate(language, "edit_section_name")}
                data-section-name
                .value=${section.title ?? ""}
                @change=${(event) => this._updateRoom(renameSection(room, list, event.target.value))}
              />
              ${this._renderRowToggle(section.layout === "row", () => this._updateRoom(toggleSectionRow(room, list)))}
              <button
                aria-label=${translate(language, "move_up")}
                ?disabled=${list === 0}
                data-section-up
                @click=${() => this._updateRoom(moveSection(room, list, -1))}
              >
                <ha-icon icon="mdi:chevron-up"></ha-icon>
              </button>
              <button
                aria-label=${translate(language, "move_down")}
                ?disabled=${list === count - 1}
                data-section-down
                @click=${() => this._updateRoom(moveSection(room, list, 1))}
              >
                <ha-icon icon="mdi:chevron-down"></ha-icon>
              </button>
              <button
                aria-label=${translate(language, "edit_remove_section")}
                data-section-remove
                @click=${() => this._updateRoom(removeSection(room, list))}
              >
                <ha-icon icon="mdi:delete-outline"></ha-icon>
              </button>
            </div>`
          : nothing}
        ${this._edit.scenes
          ? html`<div class="edit-head scenes">
              ${this._renderRowToggle(this._edit.scenesRow, () => {
                this._edit = { ...this._edit, scenesRow: !this._edit.scenesRow };
              })}
            </div>`
          : nothing}
        <div class="tiles">
          ${section.tiles.map((item, index) => this._renderEditTile(item, list, index))}
          <button
            class="tile add-tile ${dropping ? "drop" : ""}"
            data-slot=${end}
            data-list=${list}
            data-add-tile
            @click=${() => this._openPicker(list)}
          >
            <span class="icon"><ha-icon icon="mdi:plus"></ha-icon></span>
            <span class="text"><strong>${translate(language, "edit_add_tile")}</strong></span>
          </button>
        </div>
      </section>
    `;
  }

  _renderRoomEditor() {
    const { room, tab, saving, scenes } = this._edit;
    const language = this._hass.language;
    const lists = editableLists(room, tab);
    const tabs = [
      ["room", "edit_tab_room"],
      ["scenes", "section_scenes"],
      ["home", "edit_tab_home"],
    ];
    return html`
      <div class="room-title">
        <button aria-label=${translate(language, "edit_cancel")} data-edit-cancel @click=${() => (this._edit = null)}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
        <h1>${room.name}</h1>
        <button class="edit-save" data-edit-save ?disabled=${saving} @click=${this._saveEdit}>
          ${translate(language, "save")}
        </button>
      </div>
      <p class="edit-legend" data-edit-legend>${translate(language, "edit_legend")}</p>
      <div class="edit-tabs" ?hidden=${scenes}>
        ${tabs.map(
          ([key, label]) => html`
            <button
              class=${key === tab ? "selected" : ""}
              data-edit-tab=${key}
              @click=${() => (this._edit = { ...this._edit, tab: key })}
            >
              ${translate(language, label)}
            </button>
          `,
        )}
      </div>
      ${lists.map((section, list) => this._renderEditList(section, list, lists.length))}
      ${tab === "room"
        ? html`<button
            class="edit-add-section"
            data-add-section
            @click=${() => this._updateRoom(addSection(room, translate(language, "edit_new_section")))}
          >
            <ha-icon icon="mdi:plus"></ha-icon>${translate(language, "edit_add_section")}
          </button>`
        : nothing}
      ${this._drag
        ? html`<div class="ghost" style="left: ${this._drag.x}px; top: ${this._drag.y}px">${this._drag.name}</div>`
        : nothing}
    `;
  }

  _renderRoom() {
    if (this._edit) return this._renderRoomEditor();
    const { title, areas, cameras, sections, status, actions = [] } = this._model;
    const language = this._hass.language;
    const speakers = this._roomSpeakers(areas);
    return html`
      <div class="room-title">
        <button
          aria-label=${translate(language, "nav_home")}
          data-back
          @click=${() => navigateTo(`${dashboardPath(window.location.pathname)}/home`)}
        >
          <ha-icon icon="mdi:arrow-left"></ha-icon>
        </button>
        <h1 class="room-name ${title.length > LONG_TITLE ? "long" : ""}">${title}</h1>
        <div class="intercom">
          ${speakers.length
            ? html`<button
                aria-label=${translate(language, "intercom_to", { room: title })}
                data-intercom-here
                @click=${() => this._openIntercom(speakers, title)}
              >
                <ha-icon icon="mdi:waveform"></ha-icon>
              </button>`
            : nothing}
          ${this._renderRoomsButton()}
        </div>
      </div>
      ${this._renderStatus(status)}
      ${this._renderCameras(cameras)}
      ${actions.length
        ? html`
            <section data-room-scenes>
              <h2>${translate(language, "section_scenes")}</h2>
              <div class="tiles ${this._config.scenes_layout === "row" ? "row" : ""}">
                ${actions.map((tile) => this._renderTile(tile, false))}
              </div>
            </section>
          `
        : nothing}
      ${sections.map(
        (section) => html`
          <section data-section=${section.key}>
            ${section.title ? html`<h2>${section.title}</h2>` : nothing}
            <div class="tiles ${section.layout === "row" ? "row" : ""}">
              ${section.tiles.map((tile) => this._renderTile(tile, false))}
            </div>
          </section>
        `,
      )}
      ${sections.length || actions.length ? nothing : html`<p class="soon">${translate(language, "room_empty")}</p>`}
    `;
  }

  _renderMedia() {
    const language = this._hass.language;
    const { speakers = [], sections = [] } = this._model;
    const groups = sections.length ? sections : [{ title: translate(language, "speakers"), tiles: speakers }];
    const sources = this._sources ?? [];
    return html`
      ${this._renderPageTitle(translate(language, "nav_media"))}
      <div class="columns">
        <div class="main">
          ${groups
            .filter(({ tiles }) => tiles.length)
            .map(
              ({ title, tiles }) => html`
                <section data-media-section=${title}>
                  <h2>${title}</h2>
                  <div class="tiles">${tiles.map((tile) => this._renderTile(tile, false))}</div>
                </section>
              `,
            )}
        </div>
        <aside class="side">
          <section>
            <h2>${translate(language, "sources")}</h2>
            <div class="sources">
              ${sources.map(
                (source) => html`
                  <button class="source" data-source @click=${() => navigateTo(MEDIA_BROWSER_PATH)}>
                    <span class="source-art">
                      ${source.thumbnail
                        ? html`<img src=${source.thumbnail} alt="" />`
                        : html`<ha-icon icon="mdi:folder-music-outline"></ha-icon>`}
                    </span>
                    <span>${source.title}</span>
                  </button>
                `,
              )}
              <button class="source" data-browse @click=${() => navigateTo(MEDIA_BROWSER_PATH)}>
                <span class="source-art"><ha-icon icon="mdi:play-box-multiple-outline"></ha-icon></span>
                <span>${translate(language, "browse_media")}</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    `;
  }

  _renderEnergy() {
    const language = this._hass.language;
    return html`
      ${this._renderPageTitle(translate(language, "nav_energy"))}
      ${this._energyReady === false ? html`<p class="soon">${translate(language, "energy_unavailable")}</p>` : nothing}
      ${this._energy
        ? html`<home-dashboard-energy
            @energy-chart=${(event) => openSheet(this, { kind: "chart", chart: event.detail })}
            @energy-block=${(event) => {
              const store = event.detail;
              const block = blockFor(this._config, [store.battery, store.state, store.input, store.output], store.block);
              if (block) openSheet(this, { kind: block.kind, entityId: block.entity, item: block });
            }}
            .hass=${this._hass}
            .config=${this._config}
            .prefs=${this._energy.prefs}
            .info=${this._energy.info}
          ></home-dashboard-energy>`
        : nothing}
    `;
  }

  // The music card needs an administrator; everyone else gets the plain page.
  get _musicCard() {
    const { music } = this._config;
    return music?.card && (!music.admin_card || this._hass.user?.is_admin) ? music.card : null;
  }

  _renderMusic() {
    const { addon, frame: fallback } = this._config.music ?? {};
    if (addon) {
      const insetStyle = this._config.music.fullscreen ? MUSIC_INSET_STYLE : null;
      return html`<home-dashboard-app
        class="music"
        .hass=${this._hass}
        .item=${{ name: "Music", addon, frame: fallback, insetStyle }}
        @app-under-clock=${() => {
          this._musicUnderClock = true;
        }}
      ></home-dashboard-app>`;
    }
    if (this._musicCard) return html`<div class="cards music" data-cards></div>`;
    const frame = this._config.music?.frame;
    return frame ? html`<iframe class="music" src=${frame} title="Music"></iframe>` : nothing;
  }

  _ago(iso) {
    if (!iso) return "";
    const minutes = Math.round((new Date(iso) - Date.now()) / 60000);
    const format = new Intl.RelativeTimeFormat(this._hass.language, { numeric: "auto", style: "short" });
    if (minutes > -60) return format.format(minutes, "minute");
    return minutes > -2880 ? format.format(Math.round(minutes / 60), "hour") : format.format(Math.round(minutes / 1440), "day");
  }

  // A marker has no address of its own on the card, so the place is what the map is sent to.
  _showOnMap(position) {
    if (!position) return;
    const map = this._cards?.[0]?.shadowRoot?.querySelector("ha-map");
    map?.fitBounds?.([position, position], { zoom: MAP_FOCUS_ZOOM });
    if (this._mapPanel === "full") this._mapPanel = "half";
  }

  _renderMapRow({ key, person, position, known = true, picture, icon, name, details }) {
    return html`
      <li class=${known ? "" : "unknown"} data-map-row=${key} data-person=${person ?? nothing}>
        <button @click=${() => this._showOnMap(position)}>
          <span class="avatar">
            ${picture
              ? html`<img src=${this._hass.hassUrl(picture)} alt="" />`
              : icon
                ? html`<ha-icon .icon=${icon}></ha-icon>`
                : (name[0] ?? "")}
          </span>
          <span class="text">
            <strong>${name}</strong>
            <small>${details.filter(Boolean).join(" · ")}</small>
          </span>
        </button>
      </li>
    `;
  }

  _renderMapList() {
    const language = this._hass.language;
    const { people = [], devices = [], zones = [] } = this._model;
    const tab = this._mapTab ?? "people";
    if (tab === "devices") {
      return devices.map((device) =>
        this._renderMapRow({ ...device, key: device.entityId, details: [device.state, this._ago(device.changed)] }),
      );
    }
    if (tab === "zones") {
      return zones.map((zone) =>
        this._renderMapRow({
          ...zone,
          key: zone.entityId,
          details: [translate(language, "map_people_here", { count: zone.people })],
        }),
      );
    }
    return people.map((person) =>
      this._renderMapRow({
        ...person,
        key: person.entityId,
        person: person.entityId,
        details: [person.state, person.distance, this._ago(person.changed)],
      }),
    );
  }

  // The finger moves the panel, not the page. Up to the first few pixels it may still be a tap on a tab.
  _startMapDrag(event) {
    const panel = this.renderRoot.querySelector("[data-map-panel]");
    if (!this.renderRoot.querySelector("[data-map-grip]")?.offsetParent) return;
    const room = panel.parentElement.offsetHeight;
    const { clientY: startY } = event;
    const startHeight = panel.offsetHeight;
    let moved = false;
    const move = ({ clientY }) => {
      if (!moved && Math.abs(startY - clientY) < MAP_DRAG_START_PX) return;
      moved = true;
      this._mapDrag = Math.min(room, Math.max(MAP_PANEL_FOLDED_PX, startHeight + startY - clientY));
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (!moved) return;
      const stops = { folded: MAP_PANEL_FOLDED_PX, half: room * MAP_PANEL_OPEN, full: room };
      const nearest = (first, second) => (Math.abs(stops[second] - this._mapDrag) < Math.abs(stops[first] - this._mapDrag) ? second : first);
      this._mapPanel = Object.keys(stops).reduce(nearest);
      this._mapDrag = null;
      const swallow = (click) => click.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), CLICK_AFTER_DRAG_MS);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  _renderMapFilters() {
    const language = this._hass.language;
    const { people, devices } = this._mapSubjects;
    const hours = this._mapHours;
    const subjects = [
      ["all", translate(language, "map_everyone")],
      ...[...people, ...devices].map(({ entityId, name }) => [entityId, name.split(" ")[0]]),
    ];
    // Someone no longer on the map leaves everyone shown, as the map does.
    const who = subjects.some(([key]) => key === this._mapWho) ? this._mapWho : "all";
    return html`
      <div class="map-filters" style=${panelVariables(this._config.appearance)}>
        <div class="map-chips">
          ${subjects.map(
            ([key, label]) => html`
              <button class=${key === who ? "on" : ""} data-map-who=${key} @click=${() => this._pickMap(MAP_WHO_KEY, key)}>${label}</button>
            `,
          )}
        </div>
        <div class="map-chips">
          ${MAP_HOURS.map(
            (value) => html`
              <button class=${value === hours ? "on" : ""} data-map-hours=${value} @click=${() => this._pickMap(MAP_HOURS_KEY, value)}>
                ${translate(language, `map_hours_${value}`)}
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }

  _renderMap() {
    const language = this._hass.language;
    const tab = this._mapTab ?? "people";
    const dragged = this._mapDrag == null ? nothing : `height: ${this._mapDrag}px; transition: none`;
    const glass = panelVariables(this._config.appearance);
    return html`
      <div class="map-page">
        <div class="cards map" data-cards></div>
        ${this._renderMapFilters()}
        <aside class="map-panel ${this._mapPanel ?? "half"}" style="${glass}; ${dragged === nothing ? "" : dragged}" data-map-panel>
          <div class="map-grab" @pointerdown=${this._startMapDrag}>
          <button
            class="map-grip"
            aria-label=${translate(language, "map_fold")}
            data-map-grip
            @click=${() => {
              this._mapPanel = this._mapPanel === "folded" ? "half" : "folded";
            }}
          ></button>
          <div class="map-head">
          <div class="map-tabs">
            ${[
              ["people", "people"],
              ["devices", "map_devices"],
              ["zones", "map_zones"],
            ].map(
              ([key, label]) => html`
                <button
                  class=${key === tab ? "selected" : ""}
                  data-map-tab=${key}
                  @click=${() => {
                    this._mapTab = key;
                  }}
                >
                  ${translate(language, label)}
                </button>
              `,
            )}
          </div>
          <div class="intercom">${this._renderRoomsButton()}</div>
          </div>
          </div>
          <ul>
            ${this._renderMapList()}
          </ul>
        </aside>
      </div>
    `;
  }

  _renderTopBar() {
    const language = this._hass.language;
    return html`
      <header class="top-bar">
        <button aria-label=${translate(language, "menu")} data-menu @click=${() => openDrawer(this)}>
          <ha-icon icon="mdi:menu"></ha-icon>
        </button>
        <span>${this._page === "map" ? translate(language, "nav_map") : nothing}</span>
        <button
          aria-label=${translate(language, "voice")}
          @click=${() =>
            this._fire("hass-action", {
              config: { tap_action: { action: "assist", start_listening: true } },
              action: "tap",
            })}
        >
          <ha-icon icon="mdi:microphone"></ha-icon>
        </button>
      </header>
    `;
  }

  updated() {
    if (!this._embedded) {
      setPageBackground(this, this._background);
      const onView = this._onView;
      // A page shorter than the screen does not scroll, and what does not scroll does not bounce.
      this.toggleAttribute("bounce", onView && this._config.appearance.bounce && !["map", "music"].includes(this._page));
      this.toggleAttribute("on-view", onView && Boolean(this._background));
      if (onView) this._paintView();
    }
  }

  // On the dashboard the background lies on the view, which does not move when the page bounces.
  // Elsewhere, as in a sheet, the page carries it itself.
  get _onView() {
    return !this._embedded && paintsView(this);
  }

  // The view is shared by every page of the dashboard, so it alone knows what it shows now.
  _paintView() {
    const value = this._background
      ? viewBackgroundFor(this._background, this._backgroundPosition, backgroundVeil(this._config.appearance))
      : null;
    setViewBackground(this, value);
  }

  render() {
    if (!this._hass || !this._model) return nothing;
    const pages = {
      home: this._renderHome,
      room: this._renderRoom,
      media: this._renderMedia,
      music: this._renderMusic,
      energy: this._renderEnergy,
      map: this._renderMap,
    };
    const background = this._background;
    const { appearance } = this._config;
    return html`
      <div
        style="${tileVariables(appearance)}; --hd-veil: ${backgroundVeil(appearance)}"
        class="page ${appearance.tiles.fill === "icon" ? "fill-icon" : ""} ${background ? "with-background" : ""} ${this._page === "music" ? "whole" : ""} ${this._page === "music" && this._config.music?.fullscreen ? "music-full" : ""} ${this._page === "music" && this._musicUnderClock ? "under-clock" : ""} ${this._page === "map" ? "whole map-view" : ""}
          ${this._embedded ? "embedded" : ""}"
      >
        ${background && !this._onView && !this._embedded
          ? html`<div class="backdrop-rail"><div class="backdrop" style=${backgroundStyle(background, this._backgroundPosition)}></div></div>`
          : nothing}
        ${this._page === "music" || this._embedded ? nothing : this._renderTopBar()} ${pages[this._page].call(this)}
      </div>
    `;
  }

  static styles = [
    tokens,
    streamDotStyles,
    css`
      :host {
        display: block;
        container-type: inline-size;
        min-height: 100vh;
        background: var(--hd-background);
      }
      :host([bounce]) {
        min-height: calc(100dvh + 1px);
      }
      /* The view under the page carries the background. */
      :host([on-view]) {
        background: transparent;
      }
      /* A page in a window lies on the window's own background, the look of every window, not a background of its own. */
      :host([embedded]) {
        min-height: 0;
        background: transparent;
      }
      button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
      }
      .page {
        box-sizing: border-box;
        padding: calc(var(--hd-safe-top) + 8px) 16px
          calc(var(--hd-nav-height) + var(--hd-nav-safe) + var(--hd-nav-gap, 0px) + var(--hd-player-space, 88px));
      }
      .page.embedded {
        padding: 0 16px;
      }
      .top-bar {
        display: flex;
        align-items: center;
        height: 48px;
        margin: 0 -8px;
      }
      .top-bar span {
        flex: 1;
        color: var(--hd-look-title, inherit);
      }
      .top-bar button {
        color: var(--hd-look-title, inherit);
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
      }
      h1 {
        color: var(--hd-look-title, inherit);
        margin: 8px 0 16px;
        font-size: 30px;
        line-height: 38px;
        font-weight: 400;
      }
      .home-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .home-title h1 {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        font-size: min(30px, 6.2vw);
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .intercom {
        display: flex;
        flex: none;
        gap: 8px;
        margin-bottom: 8px;
      }
      .intercom button {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border: 1px solid var(--hd-look-button-border, var(--hd-outline));
        border-radius: 50%;
        color: var(--hd-look-button-icon, inherit);
        background: color-mix(in srgb, var(--hd-look-button-bg, var(--hd-surface)) var(--hd-button-opacity, 100%), transparent);
      }
      .room-link {
        display: inline-flex;
        align-items: center;
        min-height: 32px;
        color: inherit;
      }
      .room-link ha-icon {
        --mdc-icon-size: 20px;
        color: var(--hd-look-headings, var(--hd-text-muted));
      }
      .status {
        display: flex;
        gap: 16px;
        margin: 8px -16px 0;
        padding: 0 16px 4px;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
      }
      .status::-webkit-scrollbar {
        display: none;
      }
      .pill {
        display: flex;
        flex: none;
        align-items: center;
        gap: 10px;
      }
      .pill-icon {
        display: grid;
        flex: none;
        place-items: center;
        box-sizing: border-box;
        width: 44px;
        height: 44px;
        border: 2px solid var(--hd-badge-kind-ring, var(--pill-ring, var(--hd-look-badge-ring, var(--hd-outline))));
        border-radius: 50%;
        background: var(--hd-badge-kind-fill, var(--hd-badge-fill, var(--pill-fill, transparent)));
        color: var(--hd-badge-kind-ink, var(--pill-ink, var(--hd-look-badge-icon, var(--hd-off-ink))));
      }
      .pill-text {
        display: flex;
        flex-direction: column;
        white-space: nowrap;
      }
      .pill-text strong {
        color: var(--hd-look-badge-text, inherit);
        font-size: 15px;
        line-height: 20px;
        font-weight: 500;
      }
      .pill-text small {
        font-size: 13px;
        line-height: 18px;
        color: var(--hd-look-badge-muted, var(--hd-text-muted));
      }
      .pill.climate {
        --pill-ring: var(--hd-climate-icon);
        --pill-fill: var(--hd-climate);
        --pill-ink: var(--hd-climate-ink);
      }
      .pill.light {
        --pill-ring: var(--hd-light-icon);
        --pill-fill: var(--hd-light);
        --pill-ink: var(--hd-light-accent);
      }
      .pill.cover {
        --pill-ring: var(--hd-cover-icon);
        --pill-fill: var(--hd-cover);
        --pill-ink: var(--hd-cover-accent);
      }
      .pill.appliance {
        --pill-ring: var(--hd-appliance-icon);
        --pill-fill: var(--hd-appliance);
        --pill-ink: var(--hd-appliance-ink);
      }
      .pill.security {
        --pill-ring: var(--hd-security-icon);
        --pill-fill: var(--hd-security);
        --pill-ink: var(--hd-security-ink);
      }
      .pill.media {
        --pill-ring: var(--hd-media-icon);
        --pill-fill: var(--hd-media);
        --pill-ink: var(--hd-media-accent);
      }
      .room-title {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        margin-left: -8px;
      }
      .room-title button {
        color: var(--hd-look-title, inherit);
        display: grid;
        flex: none;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
      }
      .room-title .intercom {
        margin: 0 0 0 auto;
      }
      .page.whole {
        padding: var(--hd-safe-top) 0 0;
      }
      home-dashboard-app.music {
        display: flex;
      }
      .page.music-full .music {
        height: calc(100dvh - var(--hd-safe-top));
      }
      .page.under-clock {
        padding-top: 0;
      }
      .page.music-full.under-clock .music {
        height: 100dvh;
      }
      .music {
        display: block;
        box-sizing: border-box;
        width: 100%;
        height: calc(100dvh - var(--hd-safe-top) - var(--hd-nav-height) - var(--hd-nav-safe));
        border: 0;
      }
      .edit-tabs[hidden] {
        display: none;
      }
      /* Sticky inside the view, which is what scrolls. */
      .backdrop-rail {
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
      }
      .backdrop {
        position: sticky;
        top: 0;
        height: 100dvh;
        background-position: center;
        background-size: cover;
      }
      /* The theme shows through evenly, so headings stay readable on any picture and in both modes. */
      .backdrop::after {
        content: "";
        position: absolute;
        inset: 0;
        opacity: var(--hd-veil, 0.6);
        background: var(--hd-background);
      }
      .with-background {
        position: relative;
        isolation: isolate;
        min-height: 100dvh;
      }
      /* iOS keeps the page as long as the rising content made it, so it must not count at all. */
      .stage {
        position: relative;
        margin-inline: -16px;
        padding-inline: 16px;
        overflow: clip;
      }
      .stage-now {
        position: relative;
      }
      .stage-old {
        position: absolute;
        inset: 0 0 auto;
        max-height: 100vh;
        padding: 0 16px;
        overflow: hidden;
        pointer-events: none;
      }
      .home-title h1 {
        position: relative;
      }
      .title-old {
        position: absolute;
        inset: 0 0 auto;
        white-space: nowrap;
        pointer-events: none;
      }
      .room-title {
        margin-bottom: 24px;
      }
      .room-title .intercom button {
        width: 44px;
        height: 44px;
      }
      .room-title h1 {
        margin: 0;
      }
      /* The icons stay beside the name: a long one gets smaller first, and is cut only after that. */
      .room-title:has(.room-name) {
        flex-wrap: nowrap;
      }
      .room-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .room-name.long {
        font-size: 23px;
      }
      h2 {
        color: var(--hd-look-headings, inherit);
        margin: 28px 0 12px;
        font-size: 17px;
        line-height: 24px;
        font-weight: 500;
      }
      /* A heading that opens its whole list, as Cameras does. */
      .section-link {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 0;
        border: 0;
        font: inherit;
        color: inherit;
        background: none;
        cursor: pointer;
        --mdc-icon-size: 20px;
      }
      .section-link ha-icon {
        opacity: 0.6;
      }
      .soon {
        color: var(--hd-text-muted);
      }
      .chips {
        display: flex;
        gap: 8px;
        margin: 0 -16px;
        padding: 0 16px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .chips::-webkit-scrollbar {
        display: none;
      }
      .chip {
        display: flex;
        flex: none;
        align-items: center;
        gap: 8px;
        padding: 7px 14px 7px 10px;
        border: 1px solid var(--hd-look-chip-border, var(--hd-outline));
        border-radius: var(--hd-chip-radius, 14px);
        color: var(--hd-look-chip-text, inherit);
        background: color-mix(in srgb, var(--hd-look-chip-bg, var(--hd-surface)) var(--hd-chip-opacity, 100%), transparent);
      }
      /* A chosen chip has the colour of its kind, so it keeps the writing of the page. */
      .chip.selected {
        color: var(--hd-text);
      }
      .chip.selected small {
        color: var(--hd-text-muted);
      }
      .chip.selected.climate {
        border-color: transparent;
        background: var(--hd-climate);
      }
      .chip.selected.light {
        border-color: transparent;
        background: var(--hd-light);
      }
      .chip.selected.security {
        border-color: transparent;
        background: var(--hd-security);
      }
      .chip.selected.media {
        border-color: transparent;
        background: var(--hd-media);
      }
      .chip span {
        display: flex;
        flex-direction: column;
      }
      .chip small {
        font-size: 12px;
        line-height: 16px;
        color: var(--hd-look-chip-muted, var(--hd-text-muted));
      }
      .chip strong {
        font-size: 14px;
        line-height: 20px;
        font-weight: 500;
        white-space: nowrap;
      }
      .chip ha-icon {
        --mdc-icon-size: 20px;
      }
      .chip ha-icon.green {
        color: var(--hd-chip-green);
      }
      .chip ha-icon.purple {
        color: var(--hd-chip-purple);
      }
      .chip ha-icon.teal {
        color: var(--hd-chip-teal);
      }
      .chip ha-icon.pink {
        color: var(--hd-chip-pink);
      }
      .chip ha-icon.climate {
        color: var(--hd-climate-ink);
      }
      .chip ha-icon.light {
        color: var(--hd-light-chip);
      }
      .chip ha-icon.security {
        color: var(--hd-security-ink);
      }
      .chip ha-icon.media {
        color: var(--hd-media-chip);
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        /* A tall tile leaves a gap beside it; the next flat tiles fill it, as on a phone's home screen. */
        grid-auto-flow: row dense;
        gap: 8px;
      }
      /* Tall: two rows, the icon at the top and the name and state at the bottom. */
      .tiles:not(.row) > .tile.tall {
        grid-row: span 2;
        flex-direction: column;
        align-items: flex-start;
        justify-content: space-between;
        padding: 14px;
      }
      .tile.tall .text {
        width: 100%;
      }
      .tile.tall .icon {
        width: 48px;
        height: 48px;
        --mdc-icon-size: 28px;
      }
      .tiles.row {
        display: flex;
        margin-inline: -16px;
        padding-inline: 16px;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scroll-snap-type: x proximity;
        scroll-padding-inline: 16px;
        scrollbar-width: none;
      }
      .tiles.row::-webkit-scrollbar {
        display: none;
      }
      .tiles.row > .tile {
        flex: 0 0 calc((100% - 8px) / 2);
        box-sizing: border-box;
        scroll-snap-align: start;
      }
      .row-toggle.on {
        color: #ffffff;
        background: var(--hd-appliance-icon);
      }
      .edit-head.scenes {
        justify-content: flex-end;
      }
      .tile {
        --tile-background: var(--hd-off);
        --tile-icon: var(--hd-off-icon);
        --tile-ink: var(--hd-off-ink);
        --tile-fill: var(--tile-background);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        min-height: 72px;
        padding: 7px 12px;
        border-radius: var(--hd-tile-radius, var(--hd-radius));
        background: color-mix(in srgb, var(--tile-fill) var(--hd-tile-opacity, 100%), transparent);
        transition: background-color 180ms ease;
      }
      .tile.climate {
        --tile-background: var(--hd-climate);
        --tile-icon: var(--hd-climate-icon);
        --tile-ink: #ffffff;
      }
      .tile.light {
        --tile-background: var(--hd-light);
        --tile-icon: var(--hd-light-icon);
        --tile-ink: var(--hd-light-ink);
      }
      .tile.security {
        --tile-background: var(--hd-security);
        --tile-icon: var(--hd-security-icon);
        --tile-ink: #ffffff;
      }
      .tile.cover {
        --tile-background: var(--hd-cover);
        --tile-icon: var(--hd-cover-icon);
        --tile-ink: var(--hd-cover-ink);
      }
      .tile.media {
        --tile-background: var(--hd-media);
        --tile-icon: var(--hd-media-icon);
        --tile-ink: var(--hd-media-ink);
      }
      .tile.appliance {
        --tile-background: var(--hd-appliance);
        --tile-icon: var(--hd-appliance-icon);
        --tile-ink: #ffffff;
      }
      /* A tile that is off takes the colours chosen for the look of the page. */
      .tile.off {
        --tile-background: var(--hd-look-tile-bg, var(--hd-off));
        --tile-icon: var(--hd-look-tile-icon-bg, var(--hd-off-icon));
        --tile-ink: var(--hd-look-tile-icon, var(--hd-off-ink));
      }
      .tile.off,
      .fill-icon .tile:not(.ran) {
        color: var(--hd-look-tile-text, inherit);
      }
      .tile.off small,
      .fill-icon .tile:not(.ran) small {
        color: var(--hd-look-tile-muted, var(--hd-text-muted));
      }
      /* The colour stays on the icon only, the tile keeps the plain look. */
      .fill-icon .tile:not(.ran) {
        --tile-fill: var(--hd-look-tile-bg, var(--hd-off));
      }
      .tile.unavailable {
        opacity: 0.55;
      }
      .edit-tile {
        position: relative;
        cursor: pointer;
      }
      .edit-tile {
        gap: 8px;
      }
      .edit-tile .icon {
        width: 36px;
        height: 36px;
      }
      .edit-tile .text {
        flex: 1;
      }
      .edit-tile .text strong {
        display: block;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      section[data-edit-list] {
        margin-top: 16px;
      }
      .tile.dormant {
        opacity: 0.45;
      }
      .tile.ran {
        --tile-background: var(--hd-appliance-icon);
        --tile-icon: #ffffff;
        --tile-ink: var(--hd-appliance-icon);
        color: #ffffff;
        animation: confirmed 320ms ease-out;
      }
      .tile.ran small {
        color: inherit;
        opacity: 0.9;
      }
      @keyframes confirmed {
        40% {
          transform: scale(1.04);
        }
      }
      .tile.edit-tile.only {
        outline: 2px solid var(--hd-appliance-icon);
        background: var(--hd-appliance);
      }
      .tile.edit-tile.except {
        outline: 2px solid var(--hd-security-icon);
        background: var(--hd-security);
      }
      .edit-tile .mark {
        flex: none;
      }
      .edit-legend {
        margin: 8px 0 0;
        font-size: 13px;
        color: var(--hd-text-muted);
      }
      .edit-tile.dragged {
        opacity: 0.35;
      }
      .tile.drop {
        box-shadow: inset 4px 0 0 var(--hd-link);
      }
      .grip {
        display: grid;
        flex: none;
        place-items: center;
        width: 24px;
        height: 44px;
        color: var(--hd-text-muted);
        touch-action: none;
        cursor: grab;
      }
      .add-tile {
        border: 1px dashed var(--hd-outline);
        background: transparent;
      }
      .edit-head {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 8px;
      }
      .edit-head input {
        flex: 1;
        min-width: 0;
        padding: 8px 12px;
        border: 1px solid var(--hd-outline);
        border-radius: 12px;
        font: inherit;
        font-size: 16px;
        color: inherit;
        background: var(--hd-surface);
      }
      .edit-head button {
        display: grid;
        flex: none;
        place-items: center;
        width: 40px;
        height: 40px;
      }
      .edit-head button[disabled] {
        opacity: 0.3;
      }
      .edit-tabs {
        display: flex;
        gap: 8px;
        margin: 8px 0 16px;
      }
      .edit-tabs button {
        padding: 8px 14px;
        border: 1px solid var(--hd-outline);
        border-radius: 12px;
      }
      .edit-tabs .selected {
        background: var(--hd-pill);
      }
      .room-title .edit-save {
        width: auto;
        margin-left: auto;
        padding: 0 12px;
        border-radius: 12px;
        font-weight: 500;
        color: var(--hd-link);
      }
      .edit-add-section {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        padding: 10px 14px;
        border: 1px dashed var(--hd-outline);
        border-radius: 12px;
      }
      .ghost {
        position: fixed;
        z-index: 9;
        max-width: 200px;
        padding: 10px 14px;
        overflow: hidden;
        border-radius: 12px;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.75);
        white-space: nowrap;
        text-overflow: ellipsis;
        transform: translate(-50%, -120%);
        pointer-events: none;
      }
      .tile.wide {
        grid-column: 1 / -1;
        flex-wrap: wrap;
      }
      .stats {
        display: grid;
        flex-basis: 100%;
        grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
        gap: 8px;
      }
      .stats span {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .stats b {
        overflow: hidden;
        font-size: 17px;
        line-height: 24px;
        font-weight: 500;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .stats small {
        overflow: hidden;
        font-size: 12px;
        line-height: 16px;
        color: var(--hd-text-muted);
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .icon {
        display: grid;
        flex: none;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        color: var(--tile-ink);
        background: var(--tile-icon);
        --mdc-icon-size: 22px;
      }
      .icon b {
        font-size: 14px;
        font-weight: 500;
      }
      .text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .text small {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .text strong {
        display: -webkit-box;
        overflow: hidden;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        font-size: 15px;
        line-height: 20px;
        font-weight: 500;
      }
      .text small {
        font-size: 13px;
        line-height: 18px;
        color: var(--hd-text-muted);
      }
      .cameras {
        display: flex;
        gap: 2px;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scroll-snap-type: x proximity;
        scrollbar-width: none;
        border-radius: 24px;
      }
      .cameras::-webkit-scrollbar {
        display: none;
      }
      .camera-column {
        display: flex;
        flex: 1 0 340px;
        flex-direction: column;
        gap: 2px;
        height: 208px;
        scroll-snap-align: start;
      }
      /* Two cameras one above the other are each half of a single one, in both directions. */
      .camera-column.stacked {
        flex: 0.5 0 169px;
      }
      .camera-column.stacked .camera {
        flex: 0 0 calc(50% - 1px);
      }
      .camera {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        background: var(--hd-off);
        border-radius: var(--camera-tl, 0) var(--camera-tr, 0) var(--camera-br, 0) var(--camera-bl, 0);
        clip-path: inset(0 round var(--camera-tl, 0) var(--camera-tr, 0) var(--camera-br, 0) var(--camera-bl, 0));
      }
      /* The corners of the strip are round. Clipped by a path too: Safari leaves a blurred picture (an unavailable
         camera) square over rounded corners that only overflow hides. */
      .camera-column:first-child .camera:first-child {
        --camera-tl: 24px;
      }
      .camera-column:first-child .camera:last-child {
        --camera-bl: 24px;
      }
      .camera-column:last-child .camera:first-child {
        --camera-tr: 24px;
      }
      .camera-column:last-child .camera:last-child {
        --camera-br: 24px;
      }
      .camera img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      /* A warning: a dark card over any background and in both looks, its icon in red, the list of what it names. */
      /* A card a third of a wide screen at most, several side by side; on a phone each across the screen. */
      .alerts {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 8px;
        margin: 18px 0 8px;
      }
      .alert {
        position: relative;
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 10px 46px 10px 12px;
        border-radius: var(--hd-radius, 24px);
        color: #ffffff;
        background: var(--hd-alert-bg, rgba(28, 28, 30, 0.9));
        -webkit-backdrop-filter: blur(20px);
        backdrop-filter: blur(20px);
      }
      .alert-icon {
        display: grid;
        flex: none;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        color: #ffffff;
        background: #ff453a;
        --mdc-icon-size: 20px;
      }
      .alert-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .alert-text strong {
        font-size: 15px;
        font-weight: 600;
      }
      .alert-text span {
        font-size: 13px;
        line-height: 17px;
        color: rgba(255, 255, 255, 0.7);
      }
      .alert-more {
        align-self: flex-start;
        margin-top: 2px;
        font-size: 13px;
        color: #ff9f0a;
        cursor: pointer;
      }
      .alert-close {
        position: absolute;
        top: 50%;
        right: 10px;
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        transform: translateY(-50%);
        border-radius: 50%;
        color: rgba(255, 255, 255, 0.8);
        background: rgba(255, 255, 255, 0.12);
        cursor: pointer;
        --mdc-icon-size: 18px;
      }
      .camera-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .camera-list .camera {
        display: block;
        flex: none;
        aspect-ratio: 16 / 9;
        --camera-tl: var(--hd-radius);
        --camera-tr: var(--hd-radius);
        --camera-br: var(--hd-radius);
        --camera-bl: var(--hd-radius);
      }
      .camera.offline {
        background: #3a3d44;
      }
      .camera.guest {
        cursor: default;
      }
      .camera.offline img {
        transform: scale(1.15);
        filter: blur(14px) brightness(0.6);
      }
      .camera.guest img {
        filter: blur(28px) brightness(0.6);
      }
      .camera-off {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 4px;
        font-size: 13px;
        font-weight: 500;
        text-align: center;
        color: #ffffff;
      }
      .camera-name {
        position: absolute;
        top: 8px;
        left: 8px;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 500;
        color: #fff;
        background: rgba(0, 0, 0, 0.5);
      }
      .age {
        position: absolute;
        bottom: 8px;
        left: 8px;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 500;
        color: #fff;
        background: rgba(0, 0, 0, 0.5);
      }
      .sources {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .source {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        font-size: 15px;
      }
      .source-art {
        display: grid;
        place-items: center;
        aspect-ratio: 1;
        overflow: hidden;
        border-radius: 16px;
        background: var(--hd-off);
        --mdc-icon-size: 40px;
      }
      .source-art img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .cards {
        --divider-color: var(--hd-outline);
        display: flex;
        flex-direction: column;
        gap: 12px;
        --ha-card-background: var(--hd-surface);
        --ha-card-border-radius: var(--hd-radius);
        --ha-card-border-color: var(--hd-outline);
        --primary-text-color: var(--hd-text);
        --secondary-text-color: var(--hd-text-muted);
        --card-background-color: var(--hd-surface);
      }
      .page.map-view .top-bar {
        margin: 0;
        padding: 0 8px;
      }
      .page.map-view .top-bar span {
        font-size: 20px;
      }
      .map-page {
        position: relative;
        overscroll-behavior: none;
        height: calc(100dvh - var(--hd-safe-top) - var(--hd-nav-height) - var(--hd-nav-safe) - 48px);
        overflow: hidden;
      }
      .cards.map {
        height: 100%;
      }
      .map-panel {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        display: flex;
        flex-direction: column;
        height: 48%;
        padding: 0 12px;
        box-sizing: border-box;
        overflow: hidden;
        border-radius: var(--hd-radius) var(--hd-radius) 0 0;
        color: var(--hd-text);
        background: color-mix(in srgb, var(--hd-sheet-bg, var(--hd-background)) var(--hd-sheet-opacity, 100%), transparent);
        -webkit-backdrop-filter: blur(var(--hd-sheet-blur, 0px));
        backdrop-filter: blur(var(--hd-sheet-blur, 0px));
        transition: height 200ms ease;
      }
      /* Whose routes and how far back, over the top of the map and under the list, which comes later. */
      .map-filters {
        position: absolute;
        top: 8px;
        right: 0;
        left: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        pointer-events: none;
      }
      .map-chips {
        display: flex;
        gap: 6px;
        padding: 0 12px;
        overflow-x: auto;
        scrollbar-width: none;
        pointer-events: auto;
      }
      .map-chips::-webkit-scrollbar {
        display: none;
      }
      .map-chips button {
        flex: none;
        padding: 7px 14px;
        border-radius: 18px;
        font-size: 14px;
        color: var(--hd-text);
        background: color-mix(in srgb, var(--hd-sheet-bg, var(--hd-surface)) max(var(--hd-sheet-opacity, 100%), 70%), transparent);
        -webkit-backdrop-filter: blur(var(--hd-sheet-blur, 0px));
        backdrop-filter: blur(var(--hd-sheet-blur, 0px));
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
      }
      .map-chips button.on {
        color: #1b1b1f;
        background: #ffffff;
        font-weight: 500;
      }
      .map-panel.folded {
        height: 32px;
      }
      .map-panel.full {
        height: 100%;
        border-radius: 0;
      }
      .map-grab {
        flex: none;
        touch-action: none;
      }
      .map-grip {
        display: block;
        width: 100%;
        height: 32px;
      }
      .map-grip::after {
        content: "";
        display: block;
        width: 36px;
        height: 4px;
        margin: 14px auto;
        border-radius: 2px;
        background: var(--hd-off-icon);
      }
      .map-head {
        display: flex;
        flex: none;
        align-items: center;
        gap: 8px;
      }
      .map-head .intercom {
        margin: 0;
      }
      .map-tabs {
        display: flex;
        flex: 1;
        min-width: 0;
        gap: 4px;
        padding: 4px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .map-tabs button {
        flex: 1;
        min-height: 36px;
        border-radius: 10px;
        font-size: 14px;
        text-align: center;
      }
      .map-tabs .selected {
        background: var(--hd-surface);
        font-weight: 500;
      }
      .map-panel ul {
        flex: 1;
        min-height: 0;
        margin: 4px 0 0;
        padding: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        list-style: none;
      }
      .map-panel li.unknown {
        opacity: 0.6;
      }
      .map-panel li button {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 60px;
        padding: 4px;
      }
      .cards.map > * {
        display: block;
        height: 100%;
      }
      .people ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .people li {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 60px;
      }
      .avatar {
        display: grid;
        flex: none;
        place-items: center;
        width: 44px;
        height: 44px;
        overflow: hidden;
        border-radius: 50%;
        background: var(--hd-pill);
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .columns {
        display: flex;
        flex-direction: column;
      }
      /* A phone on its side is wide but low: it keeps the phone layout, with three tiles in a row. */
      @media (orientation: landscape) and (max-height: 500px) {
        .tiles:not(.row) {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      @media (min-height: 501px) {
        @container (min-width: 800px) {
          .page {
            padding: calc(var(--hd-safe-top) + 12px) 24px 32px;
          }
          .top-bar {
            display: none;
          }
          .status {
            margin: 8px -24px 0;
            padding: 0 24px 4px;
          }
          .columns {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 340px;
            align-items: start;
            gap: 24px;
          }
          .side {
            position: sticky;
            top: 12px;
          }
          .cameras {
            width: fit-content;
            max-width: 100%;
          }
          /* A width of its own, not only a flex basis: Safari measures the fitted strip by the size of the pictures
             in it, so a small last frame (320 px of an unavailable camera) cut the column and let it scroll. */
          .camera-column {
            flex: 0 0 412px;
            width: 412px;
            height: 232px;
          }
          .camera-column.stacked {
            flex: 0 0 205px;
            width: 205px;
          }
          .camera-list {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        /* A tablet on its side has room for four cameras in a row. */
        @container (min-width: 1000px) {
          .camera-list {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .music {
            height: calc(100dvh - var(--hd-safe-top));
          }
          .map-page {
            height: calc(100dvh - var(--hd-safe-top));
          }
          .map-panel,
          .map-panel.folded,
          .map-panel.full {
            top: 12px;
            right: auto;
            bottom: auto;
            left: 12px;
            width: 320px;
            height: auto;
            max-height: calc(100% - 24px);
            padding: 12px;
            border-radius: var(--hd-radius);
          }
          .map-grip {
            display: none;
          }
          .map-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 340px;
            align-items: start;
            gap: 24px;
          }
          .people h2 {
            margin-top: 0;
          }
          .cards.energy {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: start;
          }
          .cards.energy > :first-child {
            grid-column: 1 / -1;
          }
          /* Two columns at least, so a tile two wide never makes one of its own. */
          .tiles {
            grid-template-columns: repeat(auto-fill, minmax(min(196px, calc(50% - 4px)), 1fr));
          }
          /* A tile with numbers (a block) is two tiles wide, not the whole row, and comes after the ordinary tiles
             of its section: in their row its height would stretch them. */
          .tiles > .tile.wide {
            grid-column: span 2;
            order: 1;
          }
          /* The first of them starts a row of its own; the next stand beside it while there is room. Not filled
             back into the holes of the rows above, as tall tiles are. */
          .tiles:has(> .tile.wide) {
            grid-auto-flow: row;
          }
          .tiles > .tile.wide:not(.tile.wide ~ .tile.wide) {
            grid-column: 1 / span 2;
          }
          .tiles.row > .tile {
            flex-basis: 220px;
          }
          .tile {
            min-height: 80px;
          }
          .icon {
            width: 56px;
            height: 56px;
          }
        }
      }
    `,
  ];
}
