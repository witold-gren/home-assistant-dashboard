// Full-screen controls, opened over the page: a centred panel on tablets. One element serves every
// kind, so a stream can never outlive its sheet: closing removes the card that holds it.

import { html, LitElement, nothing } from "../vendor/lit-all.min.js";
import { sheetVariables } from "./appearance.js";
import { streamDotStyles } from "./connections.js";
import { followCover, sheetDismissed } from "./controls.js";
import { WIDE_DEPARTURES } from "./departures.js";
import { translate } from "./i18n.js";
import { buildTile, controlEntityIds, deviceSettingsPanel, liveCameraFor, loadTranslationKeys } from "./model.js";
import {
  COVER_TICK_MS,
  ENTITY_FREE_KINDS,
  MEDIA_MIN_PX,
  OWN_GESTURES,
  PLAYER_TICK_MS,
  REDUCED_MOTION,
  SHEET_DRAG_START_PX,
  SHEET_LEAVE_MS,
  TABLET,
  TILE_SHEETS,
} from "./sheet-shared.js";
import { tokens } from "./styles.js";
import { WIDE_WEATHER } from "./weather.js";
import { EntitySheets } from "./sheet-entities.js";
import { CameraSheets } from "./sheet-camera.js";
import { RecordingSheets } from "./sheet-recordings.js";
import { SettingsSheets } from "./sheet-settings.js";
import { LookSheets } from "./sheet-look.js";
import { BlockSheets } from "./sheet-blocks.js";
import { MediaSheets } from "./sheet-media.js";
import { baseStyles } from "./sheet-styles-base.js";
import { lookStyles } from "./sheet-styles-look.js";
import { controlStyles } from "./sheet-styles-controls.js";
import { cameraStyles } from "./sheet-styles-camera.js";

// The methods of each kind of window live in their own module, mixed into this one element.
const SheetParts = [EntitySheets, CameraSheets, RecordingSheets, SettingsSheets, LookSheets, BlockSheets, MediaSheets];

export class HomeDashboardSheet extends SheetParts.reduceRight((base, part) => part(base), LitElement) {
  static properties = {
    hass: { attribute: false },
    sheet: { attribute: false },
    config: { attribute: false },
    raw: { attribute: false },
    layout: { type: String },
    _draft: { state: true },
    _volume: { state: true },
    _live: { state: true },
    _liveShown: { state: true },
    _heard: { state: true },
    _zoomScale: { state: true },
    _quickMenu: { state: true },
    _tileSize: { state: true },
    _sirenAsk: { state: true },
    _talkState: { state: true },
    _pictureFailed: { state: true },
    _pictureTry: { state: true },
    _ptzOpen: { state: true },
    _recordingDay: { state: true },
    _clip: { state: true },
    _clipPaused: { state: true },
    _playhead: { state: true },
    _muted: { state: true },
    _volume: { state: true },
    _volumeOpen: { state: true },
    _edit: { state: true },
    _talking: { state: true },
    _talkBusy: { state: true },
    _talkProblem: { state: true },
    _daysOpen: { state: true },
    _lineOpen: { state: true },
    _camerasOpen: { state: true },
    _wallBig: { state: true },
    _sd: { state: true },
    _rooms: { state: true },
    _deleting: { state: true },
    _sdError: { state: true },
    _sdTurnedDown: { state: true },
    _sdQueued: { state: true },
    _disk: { state: true },
    _wallPaused: { state: true },
    _tick: { state: true },
    _voice: { state: true },
    _pending: { state: true },
    _query: { state: true },
    _uploadProblem: { state: true },
    _pin: { state: true },
    _tab: { state: true },
    _picked: { state: true },
    _rule: { state: true },
    _bg: { state: true },
    _bgMode: { state: true },
    _bgShape: { state: true },
    _bgEveryone: { state: true },
    _shared: { state: true },
    _look: { state: true },
    _lookEveryone: { state: true },
    _lookEntity: { state: true },
    _lookIcons: { state: true },
    _theme: { state: true },
    _themeChoices: { state: true },
    _themeBusy: { state: true },
    _themeProblem: { state: true },
    _themeName: { state: true },
    _access: { state: true },
    _accessUser: { state: true },
    _users: { state: true },
    _pinState: { state: true },
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._pictureRetry);
    clearTimeout(this._cardsTimer);
    this._stopTalk();
    this._stopLive();
    this._stopWallLive();
    this._stopSd();
    clearInterval(this._ticker);
    clearTimeout(this._commitTimer);
    clearTimeout(this._soundHold);
    this._stopVolume();
    this.removeEventListener("touchstart", this._touchStart);
    window.removeEventListener("resize", this._onResize);
    this.removeEventListener("touchmove", this._touchMove);
    this.removeEventListener("touchend", this._touchEnd);
    this.removeEventListener("touchcancel", this._touchEnd);
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("touchstart", this._touchStart, { passive: true });
    window.addEventListener("resize", this._onResize);
    this.addEventListener("touchmove", this._touchMove, { passive: false });
    this.addEventListener("touchend", this._touchEnd);
    this.addEventListener("touchcancel", this._touchEnd);
  }

  willUpdate(changed) {
    // A camera that goes away while it streams: the live view ends and the window says the camera is gone.
    if (changed.has("hass") && this._live && this.sheet?.kind === "camera") {
      const cameraId = liveCameraFor(this.hass, this.sheet.entityId, this.config);
      if (cameraId && this.hass.states[cameraId]?.state === "unavailable") this._stopLive();
    }
    if (changed.has("sheet")) {
      this._picked = null;
      this._quickMenu = null;
      this._tileSize = undefined;
      this._sirenAsk = false;
      clearTimeout(this._pictureRetry);
      this._pictureFailed = null;
      this._pictureTry = 0;
      this._stopLive();
      this._wallPaused = false;
      this._stopSd();
      this._rooms = { selected: [], repeats: 1 };
      this._deleting = null;
      if (this.sheet?.kind === "sd") this._startSd();
      this._diskObserver?.disconnect();
      this._diskObserver = undefined;
      if (this.sheet?.kind === "disk") this._startDisk();
      this._recordingDay = null;
      this._stopTalk();
      this._talkProblem = null;
      this._daysOpen = false;
      this._lineOpen = false;
      this._camerasOpen = false;
      this._edit = null;
      if (this.sheet?.kind === "device-edit") this._loadEdit();
      this._clip = null;
      this._playhead = null;
      this._volumeOpen = false;
      this._stopVolume();
      this._draft = undefined;
      this._voice = null;
      this._pending = null;
      this._query = "";
      this._uploadProblem = false;
      this._motion = null;
      this._leaving = false;
      this._embedded = null;
      this._pin = "";
      this._pinState = null;
      this._tab = this.sheet?.item?.tabs ? (this.sheet.item.groups[0]?.key ?? "activity") : "cameras";
      this._shared = null;
      this._access = null;
      if (["access", "block-edit", "tile-edit"].includes(this.sheet?.kind)) this._loadUsers();
      if (this.sheet?.kind === "tile-edit") this._startRule();
      if (this.sheet?.kind === "background") this._startBackground();
      if (this.sheet?.kind === "look") {
        this._tab = "background";
        this._theme = null;
        this._themeName = "";
        this._themeProblem = false;
        this._startLook();
      }
      this.classList.remove("settling");
      this._setDrag(0);
      clearInterval(this._ticker);
      const tick = { player: PLAYER_TICK_MS, cover: COVER_TICK_MS }[this.sheet?.kind];
      if (tick) {
        this._ticker = setInterval(() => {
          this._tick = Date.now();
        }, tick);
      }
    }
    if (this.sheet?.kind === "cover" && this._stateObj) {
      this._motion = followCover(this._motion, this._stateObj, Date.now());
    }
    if (this._liveCard) this._liveCard.hass = this.hass;
    if (this._wallLive?.card) this._wallLive.card.hass = this.hass;
  }

  // A phone turned: the picture lies elsewhere, measured again once the new layout is drawn.
  _onResize = () =>
    requestAnimationFrame(() => {
      this._measureMedia();
      if (["panel", "weather", "departures"].includes(this.sheet?.kind)) this.requestUpdate();
    });

  // Where the picture's edges lie from the screen's, for the buttons to stand wholly on it on a phone or a tablet on
  // its side.
  _measureMedia() {
    const body = this.renderRoot.querySelector(".camera-body");
    const stage = body?.querySelector(".stage");
    const element = this.renderRoot.querySelector(".stage > .picture, .stage > .live-wrap, .stage > video.clip");
    if (!stage || !element || this._zoomScale > 1) return;
    const stageBox = stage.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const content = this._zoomContent(element, box);
    let left = content ? box.left + content.left : box.left;
    let right = content ? box.left + content.left + content.width : box.right;
    let top = content ? box.top + content.top : box.top;
    let bottom = content ? box.top + content.top + content.height : box.bottom;
    // No picture yet (not loaded, the camera away): the buttons keep to the edges of the screen, not to an empty box.
    if (right - left < MEDIA_MIN_PX) {
      [left, right, top, bottom] = [stageBox.left, stageBox.right, stageBox.top, stageBox.bottom];
    }
    // On the whole window, so the header, both columns, the ring and the button of the line of time keep to the
    // picture.
    const panel = body.closest(".panel") ?? body;
    const set = (name, value) => {
      const px = `${Math.max(0, Math.round(value))}px`;
      if (panel.style.getPropertyValue(name) !== px) panel.style.setProperty(name, px);
    };
    set("--media-left", left - stageBox.left);
    set("--media-right", stageBox.right - right);
    set("--media-top", top - stageBox.top);
    set("--media-bottom", stageBox.bottom - bottom);
  }

  // A card beside a panel's parts (a vacuum's map) grows with its width, and a map as wide as the column can run past
  // the screen: it is narrowed, in proportion, until the window fits, watched as the card loads and the screen turns.
  _fitSplitCard() {
    const split = this.renderRoot.querySelector(".panel-split.split");
    const live = split?.querySelector(":scope > .live");
    const card = live?.firstElementChild;
    if (!split || !card) {
      this._splitObserver?.disconnect();
      this._splitObserver = undefined;
      return;
    }
    if (!this._splitObserver) {
      this._splitObserver = new ResizeObserver(() => requestAnimationFrame(() => this._fitSplitCard()));
      this._splitObserver.observe(card);
    }
    // The card's own buttons, put away where the rooms stand beside it.
    const root = card.shadowRoot;
    if (root && split.querySelector("[data-room-picker]") && !root.querySelector("style[data-home-dashboard]")) {
      const style = document.createElement("style");
      style.dataset.homeDashboard = "";
      style.textContent = ".controls-wrapper, .tiles-wrapper, .vacuum-controls { display: none !important; }";
      root.appendChild(style);
    }
    const panel = split.closest(".panel");
    const side = split.querySelector(":scope > .side");
    const style = getComputedStyle(split);
    const column = split.clientWidth - side.offsetWidth - parseFloat(style.columnGap || 0)
      - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // The room under the window's header: a centred card is measured against the whole row, not where it stands.
    const room = panel.clientHeight - (split.getBoundingClientRect().top - panel.getBoundingClientRect().top)
      - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - parseFloat(getComputedStyle(panel).paddingBottom || 0);
    const width = live.offsetWidth;
    const height = card.offsetHeight;
    if (!width || !height || room <= 0) return;
    // A card whose height does not follow its width (no map yet, a fixed card) is left as it is.
    const last = this._splitLast;
    if (last && last.width > width && height >= last.height) return;
    const wanted = Math.round(Math.min(column, (width * room) / height));
    if (Math.abs(wanted - width) < 4) return;
    this._splitLast = { width, height };
    live.style.maxWidth = `${wanted}px`;
  }

  updated(changed) {
    // The big camera of all cameras: the one just drawn plays, and only it.
    this._syncWallLive();
    if (changed.has("sheet")) {
      this._splitObserver?.disconnect();
      this._splitObserver = undefined;
      this._splitLast = undefined;
    }
    if (this.sheet?.kind === "panel") requestAnimationFrame(() => this._fitSplitCard());
    else if (this._splitObserver) {
      this._splitObserver.disconnect();
      this._splitObserver = undefined;
    }
    if (this.sheet?.kind === "camera") requestAnimationFrame(() => this._measureMedia());
    // Another camera, or the picture, the live view and a recording taking each other's place: back to the whole view.
    const shown = this.sheet?.kind === "camera" ? `${this.sheet.entityId}|${this._live}|${this._clip?.url ?? ""}` : null;
    if (shown !== this._zoomShown) {
      this._zoomShown = shown;
      if (this._zoomer && this._zoomScale > 1) this._zoomer.reset();
    }
    // The Look sheet shows its own windows as they will be, before anything is saved.
    if (this.sheet?.kind === "look" && this._look) {
      this.setAttribute("style", sheetVariables(this._look));
      this._previewingLook = true;
    } else if (this._previewingLook) {
      this.setAttribute("style", sheetVariables(this.config?.appearance));
      this._previewingLook = false;
    }
    if (this.sheet?.kind === "pin" && this._stateObj?.state === "off") this._close();
    if (changed.has("sheet") && this.sheet?.kind === "camera" && this.sheet.at) this._seekWhenLoaded(this.sheet.at);
    if (changed.has("sheet") && this.sheet?.kind === "camera") {
      this._centreThumb();
      // A ready-made way of turning finds its buttons by translation keys, read from the registry once.
      const ids = controlEntityIds(this.hass, this.sheet.entityId, this.config);
      loadTranslationKeys(this.hass, ids).then((loaded) => loaded && this.requestUpdate());
    }
    const { auto_card: auto, card_open: open } = this.sheet?.item ?? {};
    if (changed.has("sheet") && (auto || open) && this._usesCard) this._mountLive(this.sheet.item.card);
  }

  get _stateObj() {
    return this.hass.states[this.sheet.entityId];
  }

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  _call(domain, service, data = {}) {
    return this.hass.callService(domain, service, { entity_id: this.sheet.entityId, ...data });
  }

  // The sheet slides away first; the chrome removes it afterwards.
  async _close() {
    if (this._leaving) return;
    this._leaving = true;
    // A message still being recorded is dropped now, not when the window is gone.
    this.renderRoot.querySelector("home-dashboard-intercom")?.recorder?.cancel();
    await this._slideOut();
    this.dispatchEvent(new CustomEvent("sheet-close"));
  }

  _slideOut() {
    const panel = this.renderRoot.querySelector(".panel");
    if (!panel || window.matchMedia(REDUCED_MOTION).matches) return Promise.resolve();
    this.classList.add("settling");
    this._setDrag(window.innerHeight);
    return new Promise((resolve) => {
      setTimeout(resolve, SHEET_LEAVE_MS);
    });
  }

  _setDrag(distance) {
    this.style.setProperty("--hd-drag", `${distance}px`);
    this.style.setProperty("--hd-drag-fade", String(Math.min(distance / window.innerHeight, 1)));
  }

  // Dragging -----------------------------------------------------------------------------------

  // Scrolled content goes on scrolling, so the sheet moves only from the very top of it.
  _canDrag(path) {
    const inside = path.slice(0, path.findIndex((node) => node === this.renderRoot));
    if (!inside.some((node) => node.classList?.contains("panel"))) return false;
    if (inside.some((node) => node.dataset?.grip !== undefined || node.localName === "header")) return true;
    if (inside.some((node) => node.scrollTop > 0)) return false;
    return !inside.some((node) => node.matches?.(OWN_GESTURES));
  }

  _dragBegin(y) {
    this.classList.remove("settling");
    this._drag = { ...this._drag, active: true, lastY: y, lastTime: performance.now(), speed: 0 };
  }

  _dragMove(y) {
    const now = performance.now();
    const { startY, lastY, lastTime } = this._drag;
    this._drag.speed = (y - lastY) / Math.max(now - lastTime, 1);
    this._drag.lastY = y;
    this._drag.lastTime = now;
    this._setDrag(Math.max(y - startY, 0));
  }

  _dragEnd() {
    const { active, lastY, startY, speed } = this._drag ?? {};
    this._drag = null;
    if (!active) return;
    const height = this.renderRoot.querySelector(".panel")?.offsetHeight ?? window.innerHeight;
    if (sheetDismissed(lastY - startY, height, speed)) {
      this._close();
      return;
    }
    this.classList.add("settling");
    this._setDrag(0);
  }

  _touchStart = (event) => {
    if (event.touches.length !== 1 || this._leaving || !this._canDrag(event.composedPath())) return;
    const { clientX, clientY } = event.touches[0];
    this._drag = { startX: clientX, startY: clientY, active: false };
  };

  _touchMove = (event) => {
    if (!this._drag) return;
    const { clientX, clientY } = event.touches[0];
    if (!this._drag.active) {
      const down = clientY - this._drag.startY;
      if (Math.abs(clientX - this._drag.startX) > Math.abs(down) || down < -SHEET_DRAG_START_PX) {
        this._drag = null;
        return;
      }
      if (down < SHEET_DRAG_START_PX) return;
      this._dragBegin(clientY);
    }
    event.preventDefault();
    this._dragMove(clientY);
  };

  _touchEnd = () => {
    if (this._drag) this._dragEnd();
  };

  // A mouse has no touch events: it takes the sheet by the handle.
  _gripDown(event) {
    if (event.pointerType === "touch") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    this._drag = { startY: event.clientY, active: false };
    this._dragBegin(event.clientY);
  }

  _gripMove(event) {
    if (this._drag?.active && event.pointerType !== "touch") this._dragMove(event.clientY);
  }

  _gripUp(event) {
    if (event.pointerType !== "touch") this._dragEnd();
  }

  // The chrome owns the sheet: anything set here would be overwritten by its next render.
  _change(sheet) {
    this.dispatchEvent(new CustomEvent("sheet-change", { detail: sheet }));
  }

  // The gear opens what the device reports, what can be set on it and what it did; the window of Home Assistant is
  // one more tap, on the gear of that window.
  _details() {
    const entityId = this.sheet.entityId;
    const name = (this.hass.states[entityId]?.attributes.friendly_name ?? entityId).trim();
    this._change({ kind: "panel", entityId, item: deviceSettingsPanel(this.hass, entityId, this._t("camera_settings", { name })) });
  }

  _showDetails(entityId) {
    this.dispatchEvent(new CustomEvent("sheet-details", { detail: { entityId } }));
  }

  // What the pencil changes: the device of the window, or the entity when it has no device.
  _editTarget() {
    const entityId = this.sheet.item?.details ?? this.sheet.entityId;
    return this.hass.user?.is_admin && entityId && this.hass.entities[entityId] ? entityId : null;
  }

  _renderHeader(title, dark = false, details = true, onDetails = this._details, extra = nothing) {
    const editable = details ? this._editTarget() : null;
    return html`
      <header class=${dark ? "dark" : ""}>
        ${["camera", "sd", "disk"].includes(this.sheet?.kind) && this.sheet.back
          ? html`<button aria-label=${this._t("back")} data-back @click=${() => this._change(this.sheet.back)}>
              <ha-icon icon="mdi:arrow-left"></ha-icon>
            </button>`
          : html`<button aria-label=${this._t("close")} @click=${this._close}><ha-icon icon="mdi:close"></ha-icon></button>`}
        <h2>${title}</h2>
        ${extra}
        ${editable
          ? html`<button
              aria-label=${this._t("device_edit")}
              data-edit-device
              @click=${() => this._change({ kind: "device-edit", entityId: editable, back: this.sheet })}
            >
              <ha-icon icon="mdi:pencil-outline"></ha-icon>
            </button>`
          : nothing}
        ${details
          ? html`<button aria-label=${this._t("details")} data-details @click=${onDetails}>
              <ha-icon icon="mdi:cog-outline"></ha-icon>
            </button>`
          : html`<span class="header-end"></span>`}
      </header>
    `;
  }

  _renderInfo(items) {
    const shown = items.filter(Boolean);
    if (!shown.length) return nothing;
    return html`<div class="info">
      ${shown.map((item) => html`<span><ha-icon .icon=${item.icon}></ha-icon>${item.text}</span>`)}
    </div>`;
  }

  // Group of a room's status icon ---------------------------------------------------------------

  _tapRow(tile) {
    if (tile.tapAction === "call") this.hass.callService(tile.call.domain, tile.call.service, tile.call.data);
    if (tile.tapAction === "more-info") {
      this.dispatchEvent(new CustomEvent("sheet-details", { detail: { entityId: tile.entityId } }));
    }
    if (tile.tapAction === "sheet") this._change({ kind: TILE_SHEETS[tile.domain], entityId: tile.entityId, name: tile.name });
    if (tile.tapAction === "panel") this._change({ kind: "panel", entityId: tile.entityId, item: tile.item });
    if (tile.tapAction === "block") this._change({ kind: tile.item.kind, entityId: tile.entityId, item: tile.item });
    if (tile.tapAction === "pin") {
      this._change({ kind: "pin", entityId: tile.entityId, name: tile.name, offPin: tile.offPin });
    }
  }

  _tapRowIcon(event, tile) {
    if (tile.iconAction !== "toggle") return;
    event.stopPropagation();
    this.hass.callService("homeassistant", "toggle", { entity_id: tile.entityId });
  }

  _renderGroup() {
    const tiles = this.sheet.ids
      .map((id) => buildTile(this.hass, id, null, this.config, this.layout))
      .filter(Boolean);
    return html`
      ${this._renderHeader(this.sheet.title, false, false)}
      <div class="rows">
        ${tiles.map(
          (tile) => html`
            <button class="row ${tile.tone}" data-row=${tile.entityId} @click=${() => this._tapRow(tile)}>
              <span class="row-icon" @click=${(event) => this._tapRowIcon(event, tile)}>
                <ha-icon .icon=${tile.icon}></ha-icon>
              </span>
              <span class="row-text"><strong>${tile.name}</strong><small>${tile.stateText}</small></span>
            </button>
          `,
        )}
      </div>
    `;
  }

  // Intercom --------------------------------------------------------------------------------

  // A chart of the dashboard's own, for what the Energy page shows, in place of the details window of Home Assistant.
  _renderChart() {
    const { chart } = this.sheet;
    return html`
      ${this._renderHeader(chart.title, false, false)}
      ${chart.subtitle ? html`<p class="hint chart-subtitle">${chart.subtitle}</p>` : nothing}
      <home-dashboard-history-chart .hass=${this.hass} .chart=${chart}></home-dashboard-history-chart>
    `;
  }

  _renderIntercom() {
    const { areas, label, recorder } = this.sheet;
    // A card of its own, like a phone's intercom: whom it goes to, the voice as a wave, one button to send.
    return html`
      <home-dashboard-intercom
        card
        .hass=${this.hass}
        .config=${this.config}
        .areas=${areas}
        .label=${label}
        .recorder=${recorder}
        @intercom-close=${this._close}
      ></home-dashboard-intercom>
    `;
  }

  render() {
    if (!this.sheet || !this.hass) return nothing;
    if (!ENTITY_FREE_KINDS.has(this.sheet.kind) && !this._stateObj) return nothing;
    const renderers = {
      climate: this._renderClimate,
      cover: this._renderCover,
      lock: this._renderLock,
      camera: this._renderCamera,
      player: this._renderPlayer,
      group: this._renderGroup,
      intercom: this._renderIntercom,
      chart: this._renderChart,
      panel: this._renderPanel,
      "device-edit": this._renderDeviceEdit,
      tv: this._renderTv,
      rooms: this._renderRooms,
      "tile-edit": this._renderTileEdit,
      "tile-picker": this._renderTilePicker,
      background: this._renderBackground,
      scale: this._renderScale,
      school: this._renderSchool,
      weather: this._renderWeather,
      departures: this._renderDepartures,
      app: this._renderApp,
      news: this._renderNews,
      history: this._renderHistory,
      logbook: this._renderLogbook,
      notifications: this._renderNotifications,
      blocks: this._renderBlocks,
      cameras: this._renderCameraCards,
      sd: this._renderSd,
      disk: this._renderDisk,
      "block-edit": this._renderBlockEdit,
      overview: this._renderOverview,
      host: this._renderHost,
      page: this._renderPage,
      pin: this._renderPin,
      personal: this._renderPersonal,
      look: this._renderLook,
      "room-view": this._renderRoomView,
      access: this._renderAccess,
      light: this._renderLight,
      switch: this._renderSwitch,
      binary: this._renderBinary,
      select: this._renderSelect,
      sensor: this._renderSensor,
      alarm: this._renderAlarm,
    };
    const wall = this.sheet.kind === "cameras" && window.matchMedia(TABLET).matches;
    const dark = ["camera", "sd", "disk"].includes(this.sheet.kind) || wall;
    // The intercom floats as a card over the page, blurred behind it, like a phone's intercom.
    const floating = this.sheet.kind === "intercom";
    const { item } = this.sheet;
    // The weather takes the whole screen of a tablet on its side, where it has room for a chart and the week.
    const wideWeather =
      (this.sheet.kind === "weather" && window.matchMedia(WIDE_WEATHER).matches) ||
      (this.sheet.kind === "departures" && window.matchMedia(WIDE_DEPARTURES).matches);
    const whole = dark || wideWeather || ["app", "block-edit", "blocks", "history", "host", "logbook", "news", "overview", "page", "school"].includes(this.sheet.kind) || Boolean(item?.frame || item?.fullscreen);
    // A block of several groups without a card of its own: on a tablet a wider window with its groups in two columns,
    // so it fits without scrolling (a phone scrolls it).
    const roomy = this.sheet.kind === "panel" && !whole && !item?.card && !item?.tabs && (item?.groups?.length ?? 0) >= 2;
    return html`
      <div class="scrim" @click=${this._close}></div>
      <div class="backdrop ${dark ? "dark" : ""} ${whole ? "whole" : ""} ${floating ? "floating" : ""}"></div>
      <section class="panel ${dark ? "dark" : ""} ${whole ? "whole" : ""} ${floating ? "floating" : ""} ${roomy ? "roomy" : ""}" data-kind=${this.sheet.kind}>
        <div
          class="grip"
          data-grip
          @pointerdown=${this._gripDown}
          @pointermove=${this._gripMove}
          @pointerup=${this._gripUp}
          @pointercancel=${this._gripUp}
        ></div>
        ${renderers[this.sheet.kind].call(this)}
      </section>
    `;
  }

  static styles = [
    tokens,
    streamDotStyles,
    baseStyles,
    lookStyles,
    controlStyles,
    cameraStyles,
  ];
}
