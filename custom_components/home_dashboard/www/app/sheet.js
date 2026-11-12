// Full-screen controls, opened over the page: a centred panel on tablets. One element serves every
// kind, so a stream can never outlive its sheet: closing removes the card that holds it.

import { LitElement, css, html, nothing, svg } from "../vendor/lit-all.min.js";
import { clipThumbnail } from "./clip-thumbs.js";
import { streamDot, streamDotStyles } from "./connections.js";
import {
  arcPath,
  clamp,
  DIAL_START,
  DIAL_SWEEP,
  dialAngle,
  dialValue,
  formatTime,
  lockIntent,
  coverEstimate,
  followCover,
  sheetDismissed,
  sliderRatio,
  startCoverMotion,
  stepTemperature,
} from "./controls.js";
import { translate } from "./i18n.js";
import { NEW_BLOCK_ICONS } from "./block-editor.js";
import { personalPrefs, savePrefs } from "./prefs.js";
import { createRecorder } from "./intercom.js";
import {
  buildCameras,
  CAMERA_COLUMNS,
  CAMERA_LAYOUTS,
  cameraMoves,
  cameraQuickControls,
  controlEntityIds,
  domainOf,
  loadTranslationKeys,
  presetCalls,
  cameraSettingsPanel,
  cameraStreaming,
  cameraStreamSensors,
  buildPlayer,
  buildTile,
  canUnlock,
  personalChoices,
  sharedLayoutChoices,
  backgroundSlot,
  BACKGROUND_POSITIONS,
  accessChoices,
  favoriteCandidates,
  roomViewChoices,
  ROOM_SCENES_ID,
  entityIcon,
  effectiveArea,
  intercomAreas,
  isBatteryCamera,
  deviceSettingsPanel,
  liveCameraFor,
  nextRepeat,
  pictureAge,
} from "./model.js";
import {
  blockRowName,
  isTvOn,
  matchSource,
  panelStats,
  panelValue,
  pressCall,
  rememberedSources,
  rowControl,
  runAction,
  selectSourceAfterStart,
  tvStatus,
} from "./panel.js";
import { tileCandidates } from "./room-editor.js";
import { localDay, recordingSource } from "./recordings.js";
import { WIDE_WEATHER } from "./weather.js";
import { WIDE_DEPARTURES } from "./departures.js";
import { createSoundMixer, hasSound } from "./sound.js";
import { clipFor, PictureZoom } from "./zoom.js";
import { startTalk, talkMode, TALK_LIMIT_MS } from "./talk.js";
import {
  activeTheme,
  addTheme,
  buildTheme,
  currentAsTheme,
  importableIcons,
  materializeTheme,
  parseTheme,
  removeTheme,
  saveIntoTheme,
  suggestTargets,
  themeChanged,
  themeId,
  themeLibrary,
  useTheme,
} from "./theme.js";
import {
  appearanceDiff,
  loadIconList,
  NAV_PAGES,
  NAV_RANGE,
  NAV_STYLES,
  sheetVariables,
  STATUS_PARTS,
  mergeAppearance,
  searchIcons,
  TILE_FILLS,
  TILE_KINDS,
  TILE_RADIUS_RANGE,
  tileColour,
  tileColourStyle,
  tileVariables,
} from "./appearance.js";
import { dashboardStart, setDashboardStart } from "./settings.js";
import { roomActions } from "./status.js";
import { backgroundStyle, currentColorMode, isDark, screenShape, tokens } from "./styles.js";

const COMMIT_DELAY_MS = 500;
const COVER_SET_POSITION = 4;
const COVER_STOP = 8;
const COVER_TICK_MS = 250;
const EVERYONE_ELSE = "__everyone_else";
const VOLUME_STEP_MS = 250;
const VOLUME_HOLD_MS = 1500;
const SHEET_LEAVE_MS = 240;
const SHEET_DRAG_START_PX = 8;
// Whatever handles a finger itself keeps it: a slider, a dial or a card with its own gestures.
// Places whose own gestures come first: a drag down there does not close the window. A zoomed camera picture is
// one of them, as the finger moves the picture; unzoomed, a drag down on it closes the window as before.
const OWN_GESTURES =
  "[data-slider], .dial, .panel-card, .live, input, textarea, select, iframe, video, home-dashboard-timeline, .stage.zoomed, .cameras-open .thumbs";
const LIVE_LIMIT_MS = 120000;
// How often a waking live view is checked for a moving video.
const LIVE_WATCH_MS = 200;
// Turning a quick button's entity on or off: a siren by its own service, a script by running it, the rest generally.
function onOff(entityId, on) {
  const domain = domainOf(entityId);
  if (domain === "siren") return { domain, service: on ? "turn_on" : "turn_off", data: { entity_id: entityId } };
  if (domain === "script") return { domain, service: on ? "turn_on" : "turn_off", data: { entity_id: entityId } };
  return { domain: "homeassistant", service: on ? "turn_on" : "turn_off", data: { entity_id: entityId } };
}

// A picture narrower than this is not one yet (still loading, or none): the buttons keep to the screen's edges.
const MEDIA_MIN_PX = 100;
// How often the pictures of the list of cameras are asked for again.
const CAMERA_CARDS_REFRESH_MS = 30_000;
// A tablet: the cameras fill a black screen, in as many columns as chosen, on this device or in the settings.
const TABLET = "(min-width: 900px)";
const CAMERA_COLUMNS_KEY = "home-dashboard-camera-columns";
const CAMERA_LAYOUT_KEY = "home-dashboard-camera-layout";
// The recordings on a camera's own card: asked for again this often while their window is open (what is on the disk,
// what is coming down, new pictures), and at most this many pictures asked for at once, each waking the camera.
const SD_POLL_MS = 3000;
// A copy asked for that has not started by then was turned down by the camera.
const SD_GIVE_UP_MS = 20_000;
const SD_THUMBNAILS_AT_ONCE = 24;
// The recordings on the disk are read a few days at a time, newest first, as the list is scrolled to its end.
const DISK_MIN_CLIPS = 24;
const DISK_DAYS_AT_ONCE = 7;
// A panel with a card beside its own parts: a wide screen on its side, a tablet's.
const SPLIT_PANEL = "(orientation: landscape) and (min-width: 900px) and (min-height: 501px)";
// How often a camera's picture that did not load is asked for again.
const PICTURE_RETRY_MS = 5000;
// How long, and how often, a starting live view is made to take the sound before its stream connects.
const LIVE_HEAR_MS = 10000;
const LIVE_HEAR_TICK_MS = 50;
// A long press on the sound button opens its slider.
const SOUND_HOLD_MS = 500;
// A phone on its side: the camera fills the screen and the days and the line of time wait at its edges.
// The camera on the whole screen: a phone on its side, and a tablet on its side (a touch screen, so a computer with a
// mouse keeps its window).
const LANDSCAPE_PHONE = "(orientation: landscape) and (max-height: 500px), (orientation: landscape) and (min-width: 900px) and (pointer: coarse)";
const SWIPE_AWAY_PX = 40;
const PLAYER_TICK_MS = 1000;
const DIAL_SIZE = 280;
const DIAL_RADIUS = 124;
const TILE_SHEETS = {
  alarm_control_panel: "alarm",
  climate: "climate",
  cover: "cover",
  input_boolean: "switch",
  light: "light",
  lock: "lock",
  media_player: "player",
  switch: "switch",
};
const CHOICE_LIMIT = 12;
const PIN_LENGTH = 8;
const PIN_SETTLE_MS = 400;
const TV_ALERT_CLASSES = new Set(["door", "window", "problem"]);
const WEBOS_ARROWS = [
  { key: "tv_key_up", button: "UP", icon: "mdi:chevron-up", place: "up" },
  { key: "tv_key_left", button: "LEFT", icon: "mdi:chevron-left", place: "left" },
  { key: "tv_key_ok", button: "ENTER", label: "OK", place: "ok" },
  { key: "tv_key_right", button: "RIGHT", icon: "mdi:chevron-right", place: "right" },
  { key: "tv_key_down", button: "DOWN", icon: "mdi:chevron-down", place: "down" },
];
const WEBOS_KEYS = [
  { key: "tv_key_back", button: "BACK", icon: "mdi:arrow-left" },
  { key: "tv_key_home", button: "HOME", icon: "mdi:home" },
  { key: "tv_key_menu", button: "MENU", icon: "mdi:cog-outline" },
  { key: "tv_key_exit", button: "EXIT", icon: "mdi:exit-to-app" },
  { key: "tv_key_channel_down", button: "CHANNELDOWN", icon: "mdi:minus-box-outline" },
  { key: "tv_key_play", button: "PLAY", icon: "mdi:play" },
  { key: "tv_key_pause", button: "PAUSE", icon: "mdi:pause" },
  { key: "tv_key_channel_up", button: "CHANNELUP", icon: "mdi:plus-box-outline" },
];
const LIGHT_HOLD_MS = 2000;
const COLOUR_MODES = new Set(["hs", "xy", "rgb", "rgbw", "rgbww"]);
const WHITE_PRESETS = [
  { kelvin: 2200, colour: "#ff9a3c" },
  { kelvin: 2700, colour: "#ffc48f" },
  { kelvin: 4000, colour: "#ffe6d2" },
  { kelvin: 6500, colour: "#fdfcf6" },
];
const COLOUR_PRESETS = [
  [122, 167, 255],
  [199, 146, 255],
  [255, 155, 232],
  [255, 106, 77],
];
// Bits of supported_features; disarming needs none.
const ALARM_MODES = [
  { state: "armed_home", service: "alarm_arm_home", feature: 1, icon: "mdi:home" },
  { state: "armed_away", service: "alarm_arm_away", feature: 2, icon: "mdi:lock" },
  { state: "armed_night", service: "alarm_arm_night", feature: 4, icon: "mdi:weather-night" },
  { state: "armed_vacation", service: "alarm_arm_vacation", feature: 32, icon: "mdi:airplane" },
  { state: "armed_custom_bypass", service: "alarm_arm_custom_bypass", feature: 16, icon: "mdi:shield" },
  { state: "disarmed", service: "alarm_disarm", feature: 0, icon: "mdi:shield-off" },
];
const BACKGROUNDS = [
  "linear-gradient(160deg, #1d3b53, #4d7ea8)",
  "linear-gradient(160deg, #2d5a3d, #8fbf7f)",
  "linear-gradient(160deg, #7a3e1d, #e0a458)",
  "linear-gradient(160deg, #4a2f6b, #b08bd6)",
  "linear-gradient(160deg, #7a1f3d, #e07a8f)",
  "linear-gradient(160deg, #2b2d33, #6b6f7a)",
];
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const ENTITY_FREE_KINDS = new Set([
  "access",
  "chart",
  "sd",
  "disk",
  "app",
  "background",
  "block-edit",
  "cameras",
  "blocks",
  "departures",
  "group",
  "history",
  "host",
  "intercom",
  "logbook",
  "news",
  "notifications",
  "page",
  "panel",
  "personal",
  "look",
  "pin",
  "room-view",
  "rooms",
  "school",
  "overview",
  "tile-edit",
  "tile-picker",
]);

export class HomeDashboardSheet extends LitElement {
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

  // Thermostat ------------------------------------------------------------------------------

  get _climateRange() {
    const { min_temp: min = 7, max_temp: max = 35, target_temp_step: step = 0.5 } = this._stateObj.attributes;
    return { min, max, step };
  }

  _commitTemperature(value) {
    this._draft = value;
    clearTimeout(this._commitTimer);
    this._commitTimer = setTimeout(() => {
      this._call("climate", "set_temperature", { temperature: value });
      this._draft = undefined;
    }, COMMIT_DELAY_MS);
  }

  _dialMove(event) {
    if (event.type === "pointermove" && !event.buttons) return;
    const svgElement = event.currentTarget;
    const box = svgElement.getBoundingClientRect();
    const value = dialValue(
      event.clientX,
      event.clientY,
      box.left + box.width / 2,
      box.top + box.height / 2,
      this._climateRange,
    );
    this._commitTemperature(value);
  }

  _renderClimate() {
    const { attributes, state } = this._stateObj;
    const range = this._climateRange;
    const target = this._draft ?? attributes.temperature;
    const center = DIAL_SIZE / 2;
    const hasTarget = target != null;
    const end = hasTarget ? dialAngle(target, range.min, range.max) : DIAL_START;
    const label = this.hass.formatEntityState?.(this._stateObj) ?? state;
    return html`
      ${this._renderHeader(attributes.friendly_name)}
      <div class="body center">
        <div class="dial">
          <svg
            viewBox="0 0 ${DIAL_SIZE} ${DIAL_SIZE}"
            @pointerdown=${hasTarget ? this._dialMove : nothing}
            @pointermove=${hasTarget ? this._dialMove : nothing}
          >
            ${svg`<path class="track" d=${arcPath(center, DIAL_RADIUS, DIAL_START, DIAL_START + DIAL_SWEEP)}></path>`}
            ${hasTarget ? svg`<path class="value" d=${arcPath(center, DIAL_RADIUS, DIAL_START, end)}></path>` : nothing}
          </svg>
          <div class="reading">
            <small>${hasTarget ? `${label} · ${this._t("set_to")}` : label}</small>
            <strong data-target>${hasTarget ? target : attributes.current_temperature ?? "–"}<sup>°C</sup></strong>
          </div>
        </div>
        ${hasTarget
          ? html`<div class="stepper">
              <button
                aria-label="-"
                data-step="-1"
                @click=${() => this._commitTemperature(stepTemperature(target, -1, range))}
              >
                <ha-icon icon="mdi:minus"></ha-icon>
              </button>
              <button
                aria-label="+"
                data-step="1"
                @click=${() => this._commitTemperature(stepTemperature(target, 1, range))}
              >
                <ha-icon icon="mdi:plus"></ha-icon>
              </button>
            </div>`
          : nothing}
        <div class="modes">
          ${(attributes.hvac_modes ?? []).map(
            (mode) => html`
              <button
                class=${mode === state ? "active" : ""}
                @click=${() => this._call("climate", "set_hvac_mode", { hvac_mode: mode })}
              >
                ${this.hass.formatEntityState?.(this._stateObj, mode) ?? mode}
              </button>
            `,
          )}
        </div>
      </div>
      ${this._renderInfo([
        attributes.current_temperature != null && {
          icon: "mdi:thermometer",
          text: `${attributes.current_temperature} °C`,
        },
        attributes.current_humidity != null && { icon: "mdi:water", text: `${attributes.current_humidity}%` },
      ])}
    `;
  }

  // Cover -----------------------------------------------------------------------------------

  _coverPointer(event) {
    if (event.type === "pointermove" && !event.buttons) return;
    if (event.type === "pointerdown") event.currentTarget.setPointerCapture?.(event.pointerId);
    this._draft = Math.round(sliderRatio(event.clientY, event.currentTarget.getBoundingClientRect()) * 100);
  }

  _coverRelease() {
    if (this._draft === undefined) return;
    const position = this._draft;
    this._draft = undefined;
    this._moveCover("set_cover_position", position, { position });
  }

  get _coverShown() {
    const { attributes, state } = this._stateObj;
    if (this._motion) return coverEstimate(this._motion, Date.now());
    return attributes.current_position ?? (state === "open" ? 100 : 0);
  }

  // The blind answers at once, even though the entity will not say where it is until it stops.
  _moveCover(service, target, data) {
    const reported = this._stateObj.attributes.current_position;
    this._motion = startCoverMotion(this._coverShown, target, Date.now(), reported);
    this._call("cover", service, data);
  }

  _stopCover() {
    const shown = this._coverShown;
    const reported = this._stateObj.attributes.current_position;
    this._motion = { ...startCoverMotion(shown, shown, Date.now(), reported), hold: true };
    this._call("cover", "stop_cover");
  }

  _renderCover() {
    const { attributes, state } = this._stateObj;
    const features = attributes.supported_features ?? 0;
    const canSetPosition = Boolean(features & COVER_SET_POSITION);
    const position = this._draft ?? this._coverShown;
    const motion = this._motion && !this._motion.hold && position !== this._motion.to ? this._motion : null;
    const rising = motion && motion.to > motion.from;
    const label = motion
      ? this._t(rising ? "cover_opening" : "cover_closing")
      : (this.hass.formatEntityState?.(this._stateObj) ?? state);
    return html`
      ${this._renderHeader(attributes.friendly_name)}
      <div class="body center">
        ${canSetPosition
          ? html`
              <div
                class="slider cover-slider ${motion ? "moving" : ""}"
                data-slider
                @pointerdown=${this._coverPointer}
                @pointermove=${this._coverPointer}
                @pointerup=${this._coverRelease}
              >
                <div class="blind" style="height: ${100 - position}%"></div>
              </div>
            `
          : nothing}
        <div class="actions">
          <button
            class=${motion && rising ? "moving" : ""}
            aria-label=${this._t("open")}
            @click=${() => this._moveCover("open_cover", 100)}
          >
            <ha-icon icon="mdi:arrow-up"></ha-icon>
          </button>
          <button aria-label=${this._t("stop")} ?disabled=${!(features & COVER_STOP)} @click=${this._stopCover}>
            <ha-icon icon="mdi:stop"></ha-icon>
          </button>
          <button
            class=${motion && !rising ? "moving" : ""}
            aria-label=${this._t("closed")}
            @click=${() => this._moveCover("close_cover", 0)}
          >
            <ha-icon icon="mdi:arrow-down"></ha-icon>
          </button>
        </div>
      </div>
      ${this._renderInfo([
        {
          icon: "mdi:window-shutter",
          text: !canSetPosition ? label : motion ? `${label} · ${position}%` : `${position}%`,
        },
      ])}
    `;
  }

  // Light -----------------------------------------------------------------------------------

  _lightPointer(event) {
    if (event.type === "pointermove" && !event.buttons) return;
    if (event.type === "pointerdown") event.currentTarget.setPointerCapture?.(event.pointerId);
    clearTimeout(this._commitTimer);
    this._draft = Math.round(sliderRatio(event.clientY, event.currentTarget.getBoundingClientRect()) * 100);
  }

  // The light reports its new level a moment later, and the slider must not jump back meanwhile.
  _lightRelease() {
    if (this._draft === undefined) return;
    if (this._draft === 0) this._call("light", "turn_off");
    else this._call("light", "turn_on", { brightness_pct: this._draft });
    this._commitTimer = setTimeout(() => {
      this._draft = undefined;
    }, LIGHT_HOLD_MS);
  }

  _renderLight() {
    const { attributes, state } = this._stateObj;
    const on = state === "on";
    const offline = state === "unavailable";
    const modes = attributes.supported_color_modes ?? [];
    const dims = modes.some((mode) => mode !== "onoff");
    const whites = modes.includes("color_temp");
    const colours = modes.some((mode) => COLOUR_MODES.has(mode));
    const level = this._draft ?? (on ? Math.round(((attributes.brightness ?? 255) / 255) * 100) : 0);
    const [red, green, blue] = attributes.rgb_color ?? [];
    const fill = red === undefined ? "var(--hd-light-icon)" : `rgb(${red}, ${green}, ${blue})`;
    const label = on ? (dims ? `${level}%` : this._t("tv_on")) : this._t("light_off");
    const effects = attributes.effect_list ?? [];
    const swatch = (colour, data) => html`
      <button
        class="light-preset"
        style="background: ${colour}"
        aria-label=${colour}
        data-swatch
        ?disabled=${offline}
        @click=${() => this._call("light", "turn_on", data)}
      ></button>
    `;
    return html`
      ${this._renderHeader(this.sheet.name ?? attributes.friendly_name)}
      <div class="body center">
        ${dims
          ? html`
              <div
                class="slider light-slider ${offline ? "disabled" : ""}"
                data-slider
                @pointerdown=${offline ? nothing : this._lightPointer}
                @pointermove=${offline ? nothing : this._lightPointer}
                @pointerup=${offline ? nothing : this._lightRelease}
              >
                <div class="level" style="height: ${level}%; background: ${fill}"></div>
              </div>
            `
          : nothing}
        <div class="actions">
          <button
            class=${on ? "lit" : ""}
            aria-label=${this._t("tv_power")}
            data-light-power
            ?disabled=${offline}
            @click=${() => this._call("light", "toggle")}
          >
            <ha-icon icon="mdi:power"></ha-icon>
          </button>
        </div>
        ${whites || colours
          ? html`
              <div class="light-presets">
                ${whites
                  ? WHITE_PRESETS.map((white) => swatch(white.colour, { color_temp_kelvin: white.kelvin }))
                  : nothing}
                ${colours ? COLOUR_PRESETS.map((rgb) => swatch(`rgb(${rgb.join(", ")})`, { rgb_color: rgb })) : nothing}
              </div>
            `
          : nothing}
        ${effects.length
          ? html`
              <label class="field effect">
                <span>${this._t("light_effect")}</span>
                <select
                  data-light-effect
                  @change=${(event) => this._call("light", "turn_on", { effect: event.target.value })}
                >
                  ${effects.map((effect) => html`<option ?selected=${effect === attributes.effect}>${effect}</option>`)}
                </select>
              </label>
            `
          : nothing}
      </div>
      ${this._renderInfo([{ icon: "mdi:lightbulb-outline", text: label }])}
    `;
  }

  // PIN -------------------------------------------------------------------------------------

  _pinKey(key) {
    this._pinState = null;
    if (this._pin.length < PIN_LENGTH) this._pin += key;
  }

  // The server checks the PIN, so all this page learns is whether the entity went off.
  async _sendPin() {
    const { service, field } = this.sheet.offPin;
    const [domain, name] = service.split(".");
    const pin = this._pin;
    if (!pin || this._pinState === "checking") return;
    this._pin = "";
    this._pinState = "checking";
    try {
      await this.hass.callService(domain, name, { [field]: pin });
    } catch {
      // A failed call means the same to the person at the keypad as a wrong PIN.
    }
    await new Promise((resolve) => {
      setTimeout(resolve, PIN_SETTLE_MS);
    });
    if (this.sheet?.kind === "pin") this._pinState = "wrong";
  }

  _renderPin() {
    const message = { checking: "pin_checking", wrong: "pin_wrong" }[this._pinState] ?? "pin_enter";
    const waiting = this._pinState === "checking";
    return html`
      ${this._renderHeader(this.sheet.name, false, false)}
      <div class="body center">
        <p class="pin-message ${this._pinState === "wrong" ? "wrong" : ""}" data-pin-message>${this._t(message)}</p>
        <div class="pin-dots" data-pin-dots>
          ${Array.from({ length: this._pin.length }, () => html`<span></span>`)}
        </div>
        <div class="pin-keys">
          ${["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(
            (key) => html`
              <button data-pin-key=${key} ?disabled=${waiting} @click=${() => this._pinKey(key)}>${key}</button>
            `,
          )}
          <button aria-label=${this._t("pin_clear")} data-pin-clear ?disabled=${waiting} @click=${() => (this._pin = "")}>
            <ha-icon icon="mdi:backspace-outline"></ha-icon>
          </button>
          <button data-pin-key="0" ?disabled=${waiting} @click=${() => this._pinKey("0")}>0</button>
          <button class="ok" data-pin-ok ?disabled=${waiting || !this._pin} @click=${this._sendPin}>OK</button>
        </div>
      </div>
    `;
  }

  // Switch ----------------------------------------------------------------------------------

  _renderSwitch() {
    const { attributes, state } = this._stateObj;
    const on = state === "on";
    const label = this.hass.formatEntityState?.(this._stateObj) ?? state;
    return html`
      ${this._renderHeader(this.sheet.name ?? attributes.friendly_name)}
      <div class="body center">
        <button
          class="big-switch ${on ? "on" : ""}"
          role="switch"
          aria-checked=${on}
          aria-label=${this.sheet.name ?? attributes.friendly_name}
          data-big-switch
          ?disabled=${state === "unavailable"}
          @click=${() => this.hass.callService("homeassistant", "toggle", { entity_id: this.sheet.entityId })}
        >
          <span class="big-thumb"><ha-icon icon="mdi:power"></ha-icon></span>
        </button>
      </div>
      ${this._renderInfo([{ icon: "mdi:toggle-switch-outline", text: label }])}
    `;
  }

  // Alarm -----------------------------------------------------------------------------------

  _renderAlarm() {
    const { attributes, state } = this._stateObj;
    const features = attributes.supported_features ?? 0;
    const modes = ALARM_MODES.filter((mode) => !mode.feature || features & mode.feature);
    const label = this.hass.formatEntityState?.(this._stateObj) ?? state;
    return html`
      ${this._renderHeader(this.sheet.name ?? attributes.friendly_name)}
      <div class="body center">
        <div class="alarm-modes">
          ${modes.map(
            (mode) => html`
              <button
                class="alarm-mode ${mode.state === state ? "on" : ""} ${mode.state === "disarmed" ? "off" : ""}"
                data-alarm=${mode.state}
                ?disabled=${state === "unavailable"}
                @click=${() => this._call("alarm_control_panel", mode.service)}
              >
                <ha-icon .icon=${mode.icon}></ha-icon>
                <span>${this._t(`alarm_${mode.state}`)}</span>
              </button>
            `,
          )}
        </div>
      </div>
      ${this._renderInfo([{ icon: "mdi:shield-outline", text: label }])}
    `;
  }

  // Lock ------------------------------------------------------------------------------------

  _lockPointer(event) {
    if (event.type === "pointermove" && !event.buttons) return;
    if (event.type === "pointerdown") event.currentTarget.setPointerCapture?.(event.pointerId);
    this._draft = sliderRatio(event.clientY, event.currentTarget.getBoundingClientRect());
  }

  _lockRelease() {
    if (this._draft === undefined) return;
    const locked = this._stateObj.state === "locked";
    const intent = lockIntent(this._draft, locked);
    this._draft = undefined;
    if (intent === "unlock" && canUnlock(this.layout, this.config)) this._call("lock", "unlock");
    if (intent === "lock") this._call("lock", "lock");
  }

  _renderLock() {
    const { attributes, state } = this._stateObj;
    const locked = state === "locked";
    const allowed = !locked || canUnlock(this.layout, this.config);
    const rest = locked ? 0 : 1;
    const ratio = clamp(this._draft ?? rest, 0, 1);
    const label = this.hass.formatEntityState?.(this._stateObj) ?? state;
    const hint = !allowed ? "unlock_disabled" : locked ? "slide_unlock" : "slide_lock";
    return html`
      ${this._renderHeader(attributes.friendly_name)}
      <div class="body center">
        <div
          class="slider lock-slider ${allowed ? "" : "disabled"}"
          data-slider
          @pointerdown=${allowed ? this._lockPointer : nothing}
          @pointermove=${allowed ? this._lockPointer : nothing}
          @pointerup=${allowed ? this._lockRelease : nothing}
        >
          <div class="thumb" style="bottom: calc(${ratio} * (100% - 148px) + 6px)">
            <ha-icon .icon=${locked ? "mdi:lock" : "mdi:lock-open-variant"}></ha-icon>
          </div>
        </div>
        <p class="hint">${this._t(hint)}</p>
      </div>
      ${this._renderInfo([{ icon: "mdi:shield-outline", text: label }])}
    `;
  }

  // Camera ----------------------------------------------------------------------------------

  async _startLive(cameraId) {
    this._clip = null;
    this._playhead = null;
    await this._mountLive({
      type: "picture-entity",
      entity: cameraId,
      camera_view: "live",
      show_name: false,
      show_state: false,
      tap_action: { action: "none" },
    });
    if (!this._live) return;
    this._liveTimer = setTimeout(() => this._stopLive(), LIVE_LIMIT_MS);
    this._hearLive();
  }

  // The card of Home Assistant starts its player muted, and a muted WebRTC player throws the sound of the
  // stream away for good. So the player is let take the sound before it connects; what is heard is still
  // decided by the video alone, muted until the sound button.
  _hearLive() {
    clearInterval(this._hearWatch);
    const started = Date.now();
    this._hearWatch = setInterval(() => {
      this._letPlayersHear();
      if (!this._live || Date.now() - started > LIVE_HEAR_MS) clearInterval(this._hearWatch);
    }, LIVE_HEAR_TICK_MS);
  }

  async _letPlayersHear() {
    const streams = this._inStage("ha-camera-stream").filter((stream) => stream.muted);
    for (const stream of streams) stream.muted = false;
    // Unmuted, the players render their videos unmuted too: those are muted again before any sound comes.
    await Promise.all(streams.map((stream) => stream.updateComplete));
    await Promise.all(this._inStage("ha-web-rtc-player", "ha-hls-player").map((player) => player.updateComplete));
    this._applySound();
  }

  async _mountLive(config) {
    this._live = true;
    await this.updateComplete;
    const helpers = await window.loadCardHelpers?.();
    const card = helpers?.createCardElement(config);
    if (!card || !this._live) return;
    card.hass = this.hass;
    this._liveCard = card;
    this.renderRoot.querySelector("[data-live]")?.appendChild(card);
    // The player of Home Assistant makes its video later and mutes it itself, so the sound is set on it again.
    this._soundTicker = setInterval(() => this._applySound(), 1000);
    this._watchLive();
  }

  // The last picture stays over the player until its video moves, so waking a camera never shows a black box.
  _watchLive() {
    this._liveShown = false;
    clearInterval(this._liveWatch);
    const started = Date.now();
    this._liveWatch = setInterval(() => {
      const moving = this._videos().some((video) => video.readyState >= 2 && video.videoWidth > 0 && !video.paused);
      if (moving) this._liveShown = true;
      if (moving || Date.now() - started > LIVE_LIMIT_MS) clearInterval(this._liveWatch);
    }, LIVE_WATCH_MS);
  }

  // A camera is gone while it or its live camera is unavailable in Home Assistant.
  _cameraGone(shown, cameraId) {
    return shown.unavailable || Boolean(cameraId && this.hass.states[cameraId]?.state === "unavailable");
  }

  // The picture to show: the camera's own, or the last one it had while it is away; asked again every few
  // seconds while it does not load.
  _cameraPicture(shown) {
    this._lastPictures ??= {};
    if (shown.picture && !shown.unavailable) this._lastPictures[shown.entityId] = shown.picture;
    const url = shown.unavailable ? this._lastPictures[shown.entityId] : (shown.picture ?? this._lastPictures[shown.entityId]);
    if (!url) return null;
    const full = this.hass.hassUrl(url);
    if (!this._pictureTry || this._pictureFailed !== shown.entityId) return full;
    return `${full}${full.includes("?") ? "&" : "?"}retry=${this._pictureTry}`;
  }

  _pictureBroke(entityId) {
    this._pictureFailed = entityId;
    clearTimeout(this._pictureRetry);
    this._pictureRetry = setTimeout(() => (this._pictureTry = (this._pictureTry ?? 0) + 1), PICTURE_RETRY_MS);
  }

  _pictureLoaded(entityId) {
    if (this._pictureFailed !== entityId) return;
    clearTimeout(this._pictureRetry);
    this._pictureFailed = null;
    this._pictureTry = 0;
  }

  _stopLive() {
    // Nobody to see any more: the camera's speaker goes quiet with the picture.
    if (this._talking) this._stopTalk();
    clearTimeout(this._liveTimer);
    clearInterval(this._soundTicker);
    clearInterval(this._liveWatch);
    clearInterval(this._hearWatch);
    this._liveShown = false;
    this._heard = false;
    // Turning is for the live view: it goes away with it.
    this._ptzOpen = false;
    this._liveCard?.remove();
    this._liveCard = undefined;
    this._live = false;
  }

  _showCamera(entityId) {
    this._ptzOpen = false;
    this._change({ ...this.sheet, entityId });
  }

  _cameraRoom() {
    if (!this.config.intercom.script) return null;
    const area = effectiveArea(this.hass, this.sheet.entityId, this.config);
    return intercomAreas(this.hass, this.config).find((room) => room.id === area) ?? null;
  }

  _startVoice(room) {
    this._voice = { room, recorder: createRecorder(this.hass, this.config) };
  }

  // The current camera in the middle of the list of cameras, by scrolling only the list: scrolling it into view would
  // also move the window when the list lies hidden below it (a phone or a tablet on its side).
  _centreThumb() {
    const thumb = this.renderRoot.querySelector(".camera-thumb.current");
    const list = thumb?.parentElement;
    if (!list) return;
    const at = thumb.getBoundingClientRect();
    const around = list.getBoundingClientRect();
    list.scrollLeft += at.left + at.width / 2 - (around.left + around.width / 2);
  }

  _renderCameraThumbs(cameras) {
    if (cameras.length < 2) return nothing;
    return html`
      <div
        class="thumbs"
        data-thumbs
        @pointerdown=${(event) => this._camerasOpen && this._swipeAway(event, () => (this._camerasOpen = false), 1)}
      >
        ${cameras.map(
          (camera) => html`
            <button
              class="camera-thumb ${camera.entityId === this.sheet.entityId ? "current" : ""}"
              aria-label=${camera.name}
              data-thumb=${camera.entityId}
              @click=${() => this._showCamera(camera.entityId)}
            >
              <img src=${this.hass.hassUrl(camera.picture)} alt="" loading="lazy" />
            </button>
          `,
        )}
      </div>
    `;
  }

  // Recordings, live view and sound ----------------------------------------------------------

  _recordings() {
    const cameraId = liveCameraFor(this.hass, this.sheet.entityId, this.config);
    return recordingSource(this.hass, this.sheet.entityId, cameraId, this.config);
  }

  _clipVideo() {
    return this.renderRoot.querySelector("[data-clip]");
  }

  // A recording takes the place of the live view, which ends, so a camera on a battery is let go.
  async _playClip(clip) {
    if (!clip) return;
    this._stopLive();
    // A recording cannot be steered: the controls of turning go away while it plays.
    this._ptzOpen = false;
    const url = await this._recordings()?.url(clip);
    if (!url) return;
    this._clip = { ...clip, url };
    this._heard = false;
    this._clipPaused = false;
    this._playhead = clip.start + (clip.offset ?? 0);
    await this.updateComplete;
    const video = this._clipVideo();
    if (!video) return;
    // A recorded file plays from the moment chosen inside it.
    if (clip.offset) video.addEventListener("loadedmetadata", () => (video.currentTime = clip.offset), { once: true });
    this._applySound();
    // A phone may refuse to play with sound before a tap; then it plays muted.
    video.play().catch((error) => {
      if (error.name !== "NotAllowedError") return;
      this._muted = true;
      video.muted = true;
      video.play().catch(() => {});
    });
  }

  _clipTime(event) {
    if (!this._clip) return;
    const heard = hasSound(event.target);
    if (heard !== this._heard) this._heard = heard;
    const time = this._clip.start + event.target.currentTime;
    if (Math.floor(time) !== Math.floor(this._playhead ?? 0)) this._playhead = time;
  }

  _clipEnded() {
    if (!this._clip) return;
    const next = this.renderRoot.querySelector("home-dashboard-timeline")?.clipFrom(this._clip.end);
    if (next) this._playClip(next);
    else {
      // The last recording is over: back to the camera's last picture, never to the live view.
      this._clip = null;
      this._playhead = null;
    }
  }

  // Play only ever plays recordings: the live view, which wakes a camera on a battery, is LIVE's alone.
  _timelinePlay(event) {
    const video = this._clipVideo();
    if (this._clip && video) {
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    } else if (event.detail.clip) this._playClip(event.detail.clip);
  }

  // Live is now: the days jump to today and the line to its end.
  // LIVE starts the live view; pressed again (it says DISCONNECT once the video moves) it ends it, and the window
  // stays, with the line of time to look through.
  _timelineLive(cameraId) {
    if (this._live) {
      this._stopLive();
      return;
    }
    this._recordingDay = localDay(new Date());
    this.renderRoot.querySelector("home-dashboard-timeline")?.showNow();
    if (!this._live && cameraId) this._startLive(cameraId);
  }

  _videos() {
    return this._inStage("video");
  }

  // Elements of these names in the picture, down through the shadow roots of the players.
  _inStage(...names) {
    const found = (root) =>
      [...root.querySelectorAll("*")].flatMap((element) => [
        ...(names.includes(element.localName) ? [element] : []),
        ...(element.shadowRoot ? found(element.shadowRoot) : []),
      ]);
    const stage = this.renderRoot.querySelector(".stage");
    return stage ? found(stage) : [];
  }

  // The sound goes through one gain (sound.js), which turns smoothly also on iPhone and iPad, where a video's own
  // volume is fixed.
  get _mixer() {
    this._soundMixer ??= createSoundMixer();
    return this._soundMixer;
  }

  _applySound() {
    const videos = this._videos();
    this._mixer.apply(videos, { muted: this._muted ?? true, volume: this._volume ?? 1 });
    // The sound button is lit only when what plays has sound: a camera without a microphone has nothing to hear.
    this._heard = videos.some(hasSound);
  }

  _soundAdjustable() {
    return this._mixer.adjustable;
  }

  _soundDown() {
    this._soundHeld = false;
    clearTimeout(this._soundHold);
    if (!this._soundAdjustable()) return;
    this._soundHold = setTimeout(() => {
      this._soundHeld = true;
      this._volumeOpen = true;
    }, SOUND_HOLD_MS);
  }

  _soundClick() {
    clearTimeout(this._soundHold);
    if (this._soundHeld) {
      this._soundHeld = false;
      return;
    }
    if (this._volumeOpen) {
      this._volumeOpen = false;
      return;
    }
    this._muted = !(this._muted ?? true);
    if (!this._muted && this._volume === 0) this._volume = 1;
    this._mixer.resume();
    this._applySound();
  }

  _setVolume(value) {
    this._volume = value;
    this._muted = value === 0;
    this._mixer.resume();
    this._applySound();
  }

  _renderSound() {
    const silent = (this._muted ?? true) || this._volume === 0;
    return html`
      <button
        aria-label=${this._t("sound")}
        aria-pressed=${silent ? "false" : "true"}
        ?disabled=${(!this._live && !this._clip) || !this._heard}
        data-sound
        @pointerdown=${this._soundDown}
        @pointerup=${() => clearTimeout(this._soundHold)}
        @pointerleave=${() => clearTimeout(this._soundHold)}
        @contextmenu=${(event) => event.preventDefault()}
        @click=${this._soundClick}
      >
        <ha-icon icon=${silent ? "mdi:volume-off" : "mdi:volume-high"}></ha-icon>
      </button>
    `;
  }

  // The edges of a phone belong to its system (notifications above, apps below), so the days and the line of time
  // come out with buttons; a swipe back towards their edge puts them away.
  _swipeAway(event, close, direction) {
    const from = { x: event.clientX, y: event.clientY };
    const end = (up) => {
      window.removeEventListener("pointerup", end);
      const dx = up.clientX - from.x;
      const dy = (up.clientY - from.y) * direction;
      if (dy > SWIPE_AWAY_PX && dy > Math.abs(dx)) close();
    };
    window.addEventListener("pointerup", end);
  }

  // On a phone on its side a tap on the picture puts the days and the line of time away; the buttons lying on it keep
  // their taps. Upright the bars do not hide, so a tap there does nothing.
  // Pinching zooms into the picture (zoom.js); the buttons lying over it keep their taps.
  get _pictureZoom() {
    this._zoomer ??= new PictureZoom(
      () => this.renderRoot.querySelector(".stage > .picture, .stage > .live-wrap, .stage > video.clip"),
      (view) => this._showZoom(view),
      (element, box) => this._zoomContent(element, box),
    );
    return this._zoomer;
  }

  // Fingers go through touch events, which always list the fingers on the screen; a mouse or a pen through pointers.
  _zoomTouch = (event) => {
    const onControl = event.composedPath().some((node) => ["button", "select", "input"].includes(node.localName));
    if (onControl && event.type === "touchstart" && event.touches.length === 1) return;
    this._pictureZoom.touch(event);
    // Two fingers, or one on a zoomed picture, move the picture and never the page.
    if (event.type === "touchmove" && event.cancelable && (event.touches.length > 1 || this._zoomScale > 1)) event.preventDefault();
  };

  _zoomDown = (event) => {
    if (event.pointerType === "touch") return;
    if (event.composedPath().some((node) => ["button", "select", "input"].includes(node.localName))) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser does not track (a made-up one): the gesture goes on without capture.
    }
    this._pictureZoom.down(event);
  };

  _zoomWheel = (event) => {
    if (this._pictureZoom.wheel(event)) event.preventDefault();
  };

  _showZoom(view) {
    const { scale, x, y } = view;
    const picture = this.renderRoot.querySelector(".stage > .picture, .stage > .live-wrap, .stage > video.clip");
    if (picture) {
      picture.style.transform = scale > 1 ? `translate(${x}px, ${y}px) scale(${scale})` : "";
      // Zoomed, the picture keeps to where it lay: on a phone on its side it does not spill over the whole screen.
      picture.style.clipPath = clipFor(view, picture.offsetWidth, picture.offsetHeight, this._zoomer?.rect ?? undefined);
    }
    this._zoomScale = Math.round(scale * 10) / 10;
  }

  // Where the picture itself lies in the zoomed element, in its own pixels: a live view or a recording is shown
  // smaller than its element (bands on the sides or at the top), the stored picture fills its own.
  _zoomContent(element, box) {
    const shown = element.classList.contains("live-wrap")
      ? (this._videos().find((video) => video.videoWidth > 0) ?? element.querySelector(".poster"))
      : element.localName === "video"
        ? element
        : element.querySelector("img");
    if (!shown) return null;
    const rect = shown.getBoundingClientRect();
    let { left, top, width, height } = rect;
    const naturalWidth = shown.videoWidth || shown.naturalWidth;
    const naturalHeight = shown.videoHeight || shown.naturalHeight;
    if (naturalWidth && naturalHeight && width && height) {
      // Shown whole inside its box ("contain"): the bands around it are not the picture.
      const fit = Math.min(width / naturalWidth, height / naturalHeight);
      left += (width - naturalWidth * fit) / 2;
      top += (height - naturalHeight * fit) / 2;
      width = naturalWidth * fit;
      height = naturalHeight * fit;
    }
    if (!width || !height) return null;
    return { left: left - box.left, top: top - box.top, width, height };
  }

  _tapPicture(event) {
    // A pinch, a move of a zoomed picture or a double tap is not also a tap on the picture.
    if (this._zoomer?.takeGesture()) return;
    if (!window.matchMedia(LANDSCAPE_PHONE).matches || (!this._daysOpen && !this._lineOpen && !this._camerasOpen)) return;
    if (event.composedPath().some((node) => node.localName === "button" || node.localName === "select")) return;
    this._daysOpen = false;
    this._lineOpen = false;
    this._camerasOpen = false;
  }

  _renderTalk(talk) {
    if (!talk) return nothing;
    if (talk.kind === "intercom") {
      return html`
        <button
          class="voice"
          aria-label=${this._t("intercom_to", { room: talk.room.name })}
          data-voice
          @click=${() => this._startVoice(talk.room)}
        >
          <ha-icon icon="mdi:microphone-message"></ha-icon>
        </button>
      `;
    }
    const talking = Boolean(this._talking);
    // Talking through a camera only to someone who can be seen: the live view must be moving first.
    const seeing = this._live && this._liveShown;
    return html`
      <button
        class="voice camera-talk ${talking ? "on" : ""} ${talking && this._talkState === "connecting" ? "connecting" : ""}"
        aria-label=${this._t(
          talking ? (this._talkState === "connecting" ? "talk_connecting" : "talk_stop") : seeing ? "talk_camera" : "talk_needs_live",
        )}
        aria-pressed=${talking ? "true" : "false"}
        ?disabled=${this._talkBusy || (!talking && !seeing)}
        data-camera-talk
        @click=${() => (talking ? this._stopTalk() : this._startTalk(talk.speaker))}
      >
        <ha-icon icon=${talking ? "mdi:microphone" : "mdi:account-voice"}></ha-icon>
      </button>
    `;
  }

  async _startTalk(speaker) {
    this._talkProblem = null;
    this._talkState = null;
    this._talkBusy = true;
    try {
      const session = await startTalk(this.hass, speaker, {
        // A camera that needs time to wake says "connecting", then "connected": the button shows the wait.
        onState: (state) => (this._talkState = state),
        onEnd: (reason) => {
          this._talkState = null;
          clearTimeout(this._talkTimer);
          this._talking = null;
          if (reason) this._talkProblem = reason;
        },
      });
      this._talking = session;
      // Talking ends by itself after a while, so a forgotten button does not keep the camera's speaker on.
      this._talkTimer = setTimeout(() => this._stopTalk(), TALK_LIMIT_MS);
    } catch (error) {
      this._talkProblem = error.reason ?? "failed";
    } finally {
      this._talkBusy = false;
    }
  }

  _stopTalk() {
    clearTimeout(this._talkTimer);
    this._talking?.stop();
    this._talking = null;
  }

  _renderPtzToggle() {
    return html`
      <button
        class="ptz-toggle ${this._ptzOpen ? "on" : ""}"
        aria-label=${this._t("ptz_toggle")}
        aria-pressed=${this._ptzOpen ? "true" : "false"}
        ?disabled=${Boolean(this._clip) || !this._live}
        data-ptz-toggle
        @click=${() => (this._ptzOpen = !this._ptzOpen)}
      >
        <ha-icon icon="mdi:arrow-all"></ha-icon>
      </button>
    `;
  }

  // All cameras of the page one under another, big, as the heading Cameras opens them. A tap opens the camera, whose
  // window goes back here.
  // Recordings on the camera's own card ------------------------------------------------------------------------
  // A camera that keeps recordings on its card says how to reach them (`sd_recordings`: its list and its download
  // commands). The window lists them by day; one on the disk of Home Assistant shows on the line of time, the rest
  // can be brought down. Nothing on the card is ever removed.

  _sdSource(cameraId) {
    const source = cameraId && this.hass.states[cameraId]?.attributes?.sd_recordings;
    return source?.list && source?.download ? source : null;
  }

  _renderSdButton(shown, cameraId) {
    if (!this._sdSource(cameraId)) return nothing;
    return html`<button
      aria-label=${this._t("sd_open")}
      data-sd-open
      @click=${() => this._change({ kind: "sd", entityId: cameraId, name: shown.name, back: { ...this.sheet, at: undefined } })}
    >
      <ha-icon icon="mdi:sd"></ha-icon>
    </button>`;
  }

  _startSd() {
    this._sd = null;
    this._sdError = null;
    this._sdTurnedDown = false;
    this._sdQueued = new Set();
    this._sdWanted = new Set();
    const source = this._sdSource(this.sheet.entityId);
    if (!source) return;
    const sheet = this.sheet;
    // What was remembered comes at once; the card itself is asked once in the background, which wakes the camera.
    this._sdLoad(source, false);
    this._sdLoad(source, true);
    this._sdTimer = setInterval(() => this.sheet === sheet && this._sdLoad(source, false), SD_POLL_MS);
  }

  _stopSd() {
    clearInterval(this._sdTimer);
    this._sdTimer = undefined;
    this._sdObserver?.disconnect();
    this._sdObserver = undefined;
  }

  async _sdLoad(source, refresh) {
    const sheet = this.sheet;
    const message = { type: source.list, entity_id: sheet.entityId, refresh };
    if (!refresh && this._sdWanted?.size) {
      message.thumbnails = [...this._sdWanted].slice(0, SD_THUMBNAILS_AT_ONCE);
      for (const file of message.thumbnails) this._sdWanted.delete(file);
    }
    try {
      const answer = await this.hass.callWS(message);
      if (this.sheet !== sheet) return;
      this._sd = answer;
      this._sdError = answer.error ?? null;
      const shown = new Set((answer.recordings ?? []).filter((clip) => clip.downloading || clip.local).map((clip) => clip.file));
      for (const file of this._sdQueued) if (shown.has(file)) this._sdQueued.delete(file);
      // A copy the camera turned down never shows as coming: once it has had its time it is given up, and said so,
      // so the button does not turn for ever.
      const now = Date.now();
      // Only while nothing is coming: one waiting behind a long copy is not given up.
      const idle = !(answer.recordings ?? []).some((clip) => clip.downloading);
      const failed = idle
        ? [...this._sdQueued].filter((file) => !shown.has(file) && now - (this._sdAskedAt?.get(file) ?? now) > SD_GIVE_UP_MS)
        : [];
      if (failed.length) {
        for (const file of failed) {
          this._sdQueued.delete(file);
          this._sdAskedAt.delete(file);
        }
        this._sdTurnedDown = true;
      }
    } catch (error) {
      if (this.sheet === sheet) this._sdError = error?.message ?? String(error);
    }
  }

  // One recording, or every one of a day not yet on the disk, oldest first: the integration queues them.
  async _sdDownload(files) {
    const source = this._sdSource(this.sheet.entityId);
    if (!source || !files.length) return;
    this._sdQueued = new Set([...this._sdQueued, ...files]);
    this._sdAskedAt ??= new Map();
    this._sdTurnedDown = false;
    for (const file of files) this._sdAskedAt.set(file, Date.now());
    try {
      await this.hass.callWS({ type: source.download, entity_id: this.sheet.entityId, files });
    } catch (error) {
      this._sdError = error?.message ?? String(error);
      for (const file of files) this._sdQueued.delete(file);
      this.requestUpdate();
    }
  }

  // Pictures are asked for only for the recordings in sight: each one wakes the camera.
  _watchSdThumbnails() {
    this._sdObserver ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        this._sdWanted.add(entry.target.dataset.sdClip);
        this._sdObserver.unobserve(entry.target);
      }
    });
    for (const clip of this.renderRoot.querySelectorAll(".sd-clip.waiting:not([data-watched])")) {
      clip.dataset.watched = "";
      this._sdObserver.observe(clip);
    }
  }

  // Opened at a moment (a recording from the card now on the disk): the day of it, then the recording itself once
  // the line of time has found that day's recordings.
  _seekWhenLoaded(at) {
    const sheet = this.sheet;
    this._recordingDay = localDay(new Date(at * 1000));
    const started = Date.now();
    clearInterval(this._seekTimer);
    this._seekTimer = setInterval(() => {
      const timeline = this.renderRoot.querySelector("home-dashboard-timeline");
      const clip = timeline?._ranges?.length ? timeline.clipFrom(at) : null;
      if (clip) {
        timeline._moveTo(at);
        this._playClip(clip);
      }
      if (clip || this.sheet !== sheet || Date.now() - started > 15000) clearInterval(this._seekTimer);
    }, 250);
  }

  // The whole day at once: what is not on the disk yet and not coming, oldest first; a mark once all of it is.
  _renderSdDayDownload(list) {
    const missing = list
      .filter((clip) => !clip.local && !clip.downloading && !this._sdQueued?.has(clip.file))
      .map((clip) => clip.file)
      .reverse();
    const busy = list.some((clip) => !clip.local && (clip.downloading || this._sdQueued?.has(clip.file)));
    if (!missing.length) {
      return busy
        ? html`<span class="sd-day-action busy" data-sd-day-busy><ha-icon icon="mdi:progress-download"></ha-icon></span>`
        : html`<span class="sd-day-action done" data-sd-day-done><ha-icon icon="mdi:check-all"></ha-icon></span>`;
    }
    return html`<button
      class="sd-day-action"
      aria-label=${this._t("sd_download_day", { count: missing.length })}
      data-sd-day-download
      @click=${() => this._sdDownload(missing)}
    >
      <ha-icon icon="mdi:download-multiple"></ha-icon><span>${missing.length}</span>
    </button>`;
  }

  _renderSd() {
    const answer = this._sd;
    const clips = [...(answer?.recordings ?? [])].reverse();
    const days = new Map();
    for (const clip of clips) {
      const day = clip.start.slice(0, 10);
      days.set(day, [...(days.get(day) ?? []), clip]);
    }
    const { language } = this.hass;
    const clock = (value) => new Date(value).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
    const seconds = (clip) => Math.max(0, Math.round((new Date(clip.end) - new Date(clip.start)) / 1000));
    const status = this._sdError
      ? this._t("sd_error", { error: this._sdError })
      : answer?.refreshing
        ? this._t("sd_refreshing")
        : answer?.updated
          ? this._t("sd_updated", {
              time: new Date(answer.updated).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }),
            })
          : answer
            ? this._t("sd_never")
            : this._t("sd_loading");
    requestAnimationFrame(() => this.sheet?.kind === "sd" && this._watchSdThumbnails());
    return html`
      ${this._renderHeader(`${this._t("sd_title")} · ${this.sheet.name ?? ""}`, true, false)}
      <p class="sd-status ${this._sdError ? "error" : ""}" data-sd-status>${status}</p>
      ${this._sdTurnedDown ? html`<p class="sd-status error" data-sd-turned-down>${this._t("sd_copy_failed")}</p>` : nothing}
      ${answer && !clips.length ? html`<p class="hint">${this._t("sd_empty")}</p>` : nothing}
      <div class="sd-days">
        ${[...days].map(
          ([day, list]) => html`
            <section class="sd-day" data-sd-day=${day}>
              <h3>
                ${new Date(`${day}T12:00:00`).toLocaleDateString(language, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                <small>${list.length}</small>
                ${this._renderSdDayDownload(list)}
              </h3>
              <div class="sd-grid">
                ${list.map((clip) => {
                  const coming = clip.downloading || this._sdQueued?.has(clip.file);
                  const at = Math.floor(new Date(clip.start).getTime() / 1000);
                  return html`
                    <div class="sd-clip ${clip.thumbnail ? "" : "waiting"}" data-sd-clip=${clip.file}>
                      ${clip.thumbnail
                        ? html`<img src=${clip.thumbnail} alt="" loading="lazy" />`
                        : html`<ha-icon class="sd-placeholder" icon="mdi:filmstrip"></ha-icon>`}
                      <span class="sd-text">
                        <strong>${clock(clip.start)}</strong>
                        <small>${[`${seconds(clip)} s`, clip.kinds].filter(Boolean).join(" · ")}</small>
                      </span>
                      ${clip.local
                        ? this._renderRemove(`sd:${clip.file}`, new Date(clip.start).toLocaleTimeString(language), async () => {
                            const back = this.sheet.back;
                            const source = recordingSource(this.hass, back?.entityId, this.sheet.entityId, this.config);
                            const id = await source?.fileId?.(clip.file);
                            if (!id) throw new Error(this._t("remove_missing"));
                            await this._removeFile(id);
                            clip.local = false;
                            this.requestUpdate();
                          })
                        : nothing}
                      ${clip.local
                        ? html`<button
                            class="sd-mark local"
                            aria-label=${this._t("sd_local")}
                            data-sd-local=${clip.file}
                            @click=${() => this._change({ ...this.sheet.back, at })}
                          >
                            <ha-icon icon="mdi:check"></ha-icon>
                          </button>`
                        : coming
                          ? html`<span class="sd-mark busy" aria-label=${this._t("sd_downloading")} data-sd-busy=${clip.file}>
                              <ha-icon icon="mdi:progress-download"></ha-icon>
                            </span>`
                          : html`<button
                              class="sd-mark"
                              aria-label=${this._t("sd_download")}
                              data-sd-download=${clip.file}
                              @click=${() => this._sdDownload([clip.file])}
                            >
                              <ha-icon icon="mdi:download"></ha-icon>
                            </button>`}
                    </div>
                  `;
                })}
              </div>
            </section>
          `,
        )}
      </div>
      ${this._renderRemoveAsk()}
    `;
  }

  // Recordings on the disk ---------------------------------------------------------------------------------------
  // The recordings of the line of time as a list by day, newest first, read a few days at a time as it is scrolled:
  // a camera that records two or three times a week has its recordings found without searching along the line. A
  // tap goes back to the camera at that recording, its day chosen and the line moved to it.

  _renderDiskButton(shown, cameraId, recordings, where) {
    if (!recordings) return nothing;
    return html`<button
      class="disk-button ${where} ${where === "side" ? "landscape-only" : "quick-button"}"
      aria-label=${this._t("disk_open")}
      data-disk-open=${where}
      @click=${() =>
        this._change({ kind: "disk", entityId: this.sheet.entityId, cameraId, name: shown.name, back: { ...this.sheet, at: undefined } })}
    >
      <ha-icon icon="mdi:movie-search-outline"></ha-icon>
    </button>`;
  }

  async _startDisk() {
    const sheet = this.sheet;
    const source = recordingSource(this.hass, sheet.entityId, sheet.cameraId, this.config);
    this._disk = { source, days: null, next: 0, days_loaded: [], loading: true, error: null };
    try {
      const days = [...((await source?.days()) ?? [])].sort().reverse();
      if (this.sheet !== sheet) return;
      this._disk = { ...this._disk, days, loading: false };
      await this._loadDisk();
    } catch (error) {
      if (this.sheet === sheet) this._disk = { ...this._disk, loading: false, error: error?.message ?? String(error) };
    }
  }

  // The next days, until a screen's worth of recordings or the days run out.
  async _loadDisk() {
    const disk = this._disk;
    if (!disk?.days || disk.loading || disk.next >= disk.days.length) return;
    const sheet = this.sheet;
    this._disk = { ...disk, loading: true };
    const loaded = [];
    let next = disk.next;
    let clips = 0;
    while (next < disk.days.length && (clips < DISK_MIN_CLIPS || loaded.length === 0) && loaded.length < DISK_DAYS_AT_ONCE) {
      const day = disk.days[next++];
      try {
        const { ranges, events } = await disk.source.day(day);
        // Frigate keeps one span a day of continuous recording: its detections are what is looked for.
        const items = (events?.length ? events : ranges).map((item) => ({
          start: item.start_time ?? item.start,
          end: item.end_time ?? item.end,
          label: item.sub_label ?? item.label ?? "",
          thumbnail: item.thumbnail ? `data:image/jpeg;base64,${item.thumbnail}` : null,
          // A file of the folder of recordings can be removed; a Frigate detection cannot.
          id: events?.length ? null : item.id,
        }));
        items.sort((a, b) => b.start - a.start);
        if (items.length) loaded.push({ day, items });
        clips += items.length;
      } catch {
        // A day that does not open is left out.
      }
    }
    if (this.sheet !== sheet) return;
    this._disk = { ...this._disk, next, loading: false, days_loaded: [...this._disk.days_loaded, ...loaded] };
    requestAnimationFrame(() => this._watchDiskEnd());
    this._takeDiskThumbnails(loaded, disk.source, sheet);
  }

  // A recorded file has no picture of its own: one is taken from its start, in the order they show.
  _takeDiskThumbnails(days, source, sheet) {
    this._diskThumbs ??= new Map();
    for (const { items } of days) {
      for (const item of items) {
        if (item.thumbnail || !item.id || this._diskThumbs.has(item.id)) continue;
        clipThumbnail(item.id, () => source.url({ id: item.id })).then((picture) => {
          if (!picture || this.sheet !== sheet) return;
          this._diskThumbs.set(item.id, picture);
          this.requestUpdate();
        });
      }
    }
  }

  _watchDiskEnd() {
    const end = this.renderRoot.querySelector("[data-disk-more]");
    if (!end) return;
    this._diskObserver ??= new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) this._loadDisk();
    });
    this._diskObserver.disconnect();
    this._diskObserver.observe(end);
  }

  // Removing a recording from the disk of Home Assistant, asked first; an administrator's, as Home Assistant demands.
  _canRemove() {
    return Boolean(this.hass.user?.is_admin);
  }

  _renderRemove(key, label, remove) {
    if (!this._canRemove()) return nothing;
    return html`<button
      class="remove-button"
      aria-label=${this._t("remove")}
      data-remove=${key}
      @click=${(event) => {
        event.stopPropagation();
        this._deleting = { key, label, remove };
      }}
    >
      <ha-icon icon="mdi:trash-can-outline"></ha-icon>
    </button>`;
  }

  // Asked the way the siren asks: a card over the window, cancel or delete.
  _renderRemoveAsk() {
    const asking = this._deleting;
    if (!asking) return nothing;
    const close = () => (this._deleting = null);
    return html`
      <div class="siren-ask" data-remove-ask role="alertdialog" aria-label=${this._t("remove_title")}>
        <div class="siren-card">
          <ha-icon icon="mdi:trash-can-outline"></ha-icon>
          <strong>${this._t("remove_title")}</strong>
          <p>${this._t("remove_ask", { time: asking.label })}</p>
          <div class="siren-actions">
            <button data-remove-no @click=${close}>${this._t("cancel")}</button>
            <button
              class="danger"
              data-remove-yes
              @click=${async () => {
                close();
                try {
                  await asking.remove();
                } catch (error) {
                  this._sdError = error?.message ?? String(error);
                }
              }}
            >
              ${this._t("remove")}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async _removeFile(id) {
    await this.hass.callWS({ type: "media_source/local_source/remove", media_content_id: id });
  }

  _renderDisk() {
    const disk = this._disk;
    const { language } = this.hass;
    const clock = (seconds) => new Date(seconds * 1000).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
    const seconds = (at) => new Date(at * 1000).toLocaleTimeString(language);
    const length = (item) => {
      const seconds = Math.max(0, Math.round((item.end ?? item.start) - item.start));
      return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`;
    };
    const more = disk?.days && disk.next < disk.days.length;
    return html`
      ${this._renderHeader(`${this._t("disk_title")} · ${this.sheet.name ?? ""}`, true, false)}
      ${disk?.error ? html`<p class="sd-status error">${this._t("sd_error", { error: disk.error })}</p>` : nothing}
      ${disk?.days && !disk.days_loaded.length && !more && !disk.loading
        ? html`<p class="hint" data-disk-empty>${this._t("disk_empty")}</p>`
        : nothing}
      <div class="sd-days">
        ${(disk?.days_loaded ?? []).map(
          ({ day, items }) => html`
            <section class="sd-day" data-disk-day=${day}>
              <h3>
                ${new Date(`${day}T12:00:00`).toLocaleDateString(language, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                <small>${items.length}</small>
              </h3>
              <div class="sd-grid">
                ${items.map(
                  (item) => html`
                    <div class="sd-clip" data-disk-clip=${item.start} @click=${() => this._change({ ...this.sheet.back, at: item.start })}>
                      ${item.thumbnail || this._diskThumbs?.get(item.id)
                        ? html`<img src=${item.thumbnail || this._diskThumbs.get(item.id)} alt="" data-disk-thumb />`
                        : html`<ha-icon class="sd-placeholder" icon="mdi:play-circle-outline"></ha-icon>`}
                      <span class="sd-text">
                        <strong>${clock(item.start)}</strong>
                        <small>${[length(item), item.label].filter(Boolean).join(" · ")}</small>
                      </span>
                      ${item.id
                        ? this._renderRemove(`disk:${item.id}`, seconds(item.start), async () => {
                            await this._removeFile(item.id);
                            this._disk = {
                              ...this._disk,
                              days_loaded: this._disk.days_loaded
                                .map((entry) => ({ ...entry, items: entry.items.filter((other) => other.id !== item.id) }))
                                .filter((entry) => entry.items.length),
                            };
                          })
                        : nothing}
                    </div>
                  `,
                )}
              </div>
            </section>
          `,
        )}
      </div>
      ${more || disk?.loading || !disk
        ? html`<p class="sd-status disk-more" data-disk-more>${this._t("sd_loading")}</p>`
        : nothing}
      ${this._renderRemoveAsk()}
    `;
  }

  // The columns of the window of all cameras: this device's own choice, else the settings'.
  _cameraColumns() {
    const own = Number(localStorage.getItem(CAMERA_COLUMNS_KEY));
    return CAMERA_COLUMNS.includes(own) ? own : this.config.cameras.columns;
  }

  _setCameraColumns(columns) {
    localStorage.setItem(CAMERA_COLUMNS_KEY, String(columns));
    this.requestUpdate();
  }

  // The layout of the window of all cameras: this device's own choice, else the settings'.
  _cameraLayout() {
    const own = localStorage.getItem(CAMERA_LAYOUT_KEY);
    return CAMERA_LAYOUTS.includes(own) ? own : this.config.cameras.layout;
  }

  _setCameraLayout(layout) {
    localStorage.setItem(CAMERA_LAYOUT_KEY, layout);
    this.requestUpdate();
  }

  // The big camera of the window of all cameras plays live by itself, and only it: another one taking its place lets
  // it go. A camera on a battery stops after the same time as in its window, and a tap starts it again.
  _syncWallLive() {
    const want = this.sheet?.kind === "cameras" && !this._wallPaused ? this._wallWanted : null;
    if (want === (this._wallLive?.entityId ?? null)) return;
    this._stopWallLive();
    if (want) this._startWallLive(want);
  }

  async _startWallLive(entityId) {
    const cameraId = liveCameraFor(this.hass, entityId, this.config);
    if (!cameraId) return;
    const live = { entityId };
    this._wallLive = live;
    const helpers = await window.loadCardHelpers?.();
    const card = helpers?.createCardElement({
      type: "picture-entity",
      entity: cameraId,
      camera_view: "live",
      show_name: false,
      show_state: false,
      tap_action: { action: "none" },
    });
    const box = this.renderRoot.querySelector("[data-wall-live]");
    if (!card || !box || this._wallLive !== live) return;
    card.hass = this.hass;
    live.card = card;
    box.replaceChildren(card);
    // Its last picture stays until the video moves, so a waking camera never shows a black box.
    live.watch = setInterval(() => {
      const videos = this._deepFind(box, "video");
      if (videos.some((video) => video.readyState >= 2 && video.videoWidth > 0 && !video.paused)) {
        box.classList.add("shown");
        clearInterval(live.watch);
      }
    }, LIVE_WATCH_MS);
    if (isBatteryCamera(this.hass, cameraId, this.config)) {
      live.timer = setTimeout(() => {
        this._wallPaused = true;
        this._stopWallLive();
      }, LIVE_LIMIT_MS);
    }
  }

  _stopWallLive() {
    const live = this._wallLive;
    if (!live) return;
    clearInterval(live.watch);
    clearTimeout(live.timer);
    live.card?.remove();
    this.renderRoot.querySelector("[data-wall-live]")?.classList.remove("shown");
    this._wallLive = undefined;
  }

  _deepFind(root, name) {
    return [...root.querySelectorAll("*")].flatMap((element) => [
      ...(element.localName === name ? [element] : []),
      ...(element.shadowRoot ? this._deepFind(element.shadowRoot, name) : []),
    ]);
  }

  _openCameraWindow(entityId) {
    this._change({ kind: "camera", entityId, back: this.sheet });
  }

  _renderCameraCards() {
    const all = buildCameras(this.hass, this.config);
    const cameras = (this.sheet.cameras ?? all.map((camera) => camera.entityId))
      .map((id) => all.find((camera) => camera.entityId === id))
      .filter(Boolean);
    // The pictures are asked for again every half minute while the list is open, as on the page.
    const tick = Math.floor(Date.now() / CAMERA_CARDS_REFRESH_MS);
    clearTimeout(this._cardsTimer);
    this._cardsTimer = setTimeout(() => this.sheet?.kind === "cameras" && this.requestUpdate(), CAMERA_CARDS_REFRESH_MS);
    const url = (camera) => {
      const full = this.hass.hassUrl(camera.picture);
      return camera.updatedAt ? full : `${full}${full.includes("?") ? "&" : "?"}tick=${tick}`;
    };
    const columns = this._cameraColumns();
    const next = CAMERA_COLUMNS[(CAMERA_COLUMNS.indexOf(columns) + 1) % CAMERA_COLUMNS.length];
    const wall = window.matchMedia(TABLET).matches;
    const layout = wall ? this._cameraLayout() : "grid";
    // One big camera, live, the first working one until another is tapped; the rest small after it.
    const working = (camera) => !camera.unavailable && !camera.guest;
    const big =
      layout === "featured"
        ? (cameras.find((camera) => camera.entityId === this._wallBig && working(camera)) ?? cameras.find(working))
        : undefined;
    this._wallWanted = big?.entityId ?? null;
    const rest = big ? cameras.filter((camera) => camera !== big) : cameras;
    const otherLayout = layout === "featured" ? "grid" : "featured";
    const card = (camera, isBig = false) => {
      const off = camera.unavailable || camera.guest;
      // In the layout with one big camera a tap puts a camera in its place; the corner button opens its window.
      const tap = () =>
        layout === "featured" && !off
          ? isBig
            ? this._wallPaused && (this._wallPaused = false)
            : ((this._wallBig = camera.entityId), (this._wallPaused = false))
          : this._openCameraWindow(camera.entityId);
      return html`
        <div class="camera-cell ${isBig ? "big" : ""}">
          <button
            class="camera-card ${off ? "off" : ""}"
            data-camera-card=${camera.entityId}
            aria-label=${camera.name}
            ?disabled=${camera.guest}
            @click=${tap}
          >
            ${camera.picture ? html`<img src=${url(camera)} alt="" loading="lazy" />` : nothing}
            ${streamDot(camera.streaming, this._t("stream_open"))}
            ${isBig ? html`<div class="wall-live" data-wall-live></div>` : nothing}
            ${isBig && this._wallPaused
              ? html`<span class="wall-resume" data-wall-resume><ha-icon icon="mdi:play"></ha-icon></span>`
              : nothing}
            <span class="camera-card-text">
              <strong>${camera.name}</strong>
              <small>
                ${off
                  ? this._t(camera.guest ? "camera_guest" : "camera_unavailable")
                  : isBig && !this._wallPaused
                    ? this._t("live")
                    : pictureAge(this.hass.language, camera.updatedAt, Date.now())}
              </small>
            </span>
          </button>
          ${layout === "featured" && !camera.guest
            ? html`<button
                class="camera-expand"
                aria-label=${this._t("camera_expand")}
                data-camera-expand=${camera.entityId}
                @click=${() => this._openCameraWindow(camera.entityId)}
              >
                <ha-icon icon="mdi:arrow-expand"></ha-icon>
              </button>`
            : nothing}
        </div>
      `;
    };
    return html`
      ${this._renderHeader(
        this._t("section_cameras"),
        true,
        false,
        undefined,
        wall
          ? html`<button
                class="columns"
                aria-label=${this._t(`camera_layout_${otherLayout}`)}
                data-camera-layout=${layout}
                @click=${() => this._setCameraLayout(otherLayout)}
              >
                <ha-icon icon=${layout === "featured" ? "mdi:view-dashboard-outline" : "mdi:view-grid-outline"}></ha-icon>
              </button>
              <button
                class="columns"
                aria-label=${this._t("camera_columns", { columns: next })}
                data-camera-columns=${columns}
                @click=${() => this._setCameraColumns(next)}
              >
                <ha-icon icon="mdi:view-column-outline"></ha-icon><span>${columns}</span>
              </button>`
          : nothing,
      )}
      <div class="camera-cards ${layout}" data-camera-cards style="--camera-columns: ${columns}">
        ${big ? card(big, true) : nothing} ${rest.map((camera) => card(camera))}
      </div>
    `;
  }

  _renderCamera() {
    const all = buildCameras(this.hass, this.config);
    const cameras = all.filter((camera) => !camera.unavailable);
    // The window stays on a camera that went away, with its last picture, until it comes back.
    const shown = all.find((camera) => camera.entityId === this.sheet.entityId);
    if (!shown) return this._renderHeader("", true, false);
    const cameraId = liveCameraFor(this.hass, this.sheet.entityId, this.config);
    // Gone from Home Assistant: no live view to start. A picture that does not load only says so over itself.
    const gone = this._cameraGone(shown, cameraId);
    const down = gone || (this._pictureFailed === shown.entityId && !this._live && !this._clip);
    const picture = this._cameraPicture(shown);
    const battery = cameraId && isBatteryCamera(this.hass, cameraId, this.config);
    const room = this._cameraRoom();
    // One button to talk: through the room's intercom, or, when chosen in the settings, the camera's own speaker.
    const talk = talkMode(this.hass, this.sheet.entityId, this.config, { room });
    const recordings = recordingSource(this.hass, this.sheet.entityId, cameraId, this.config);
    // Live views of this camera are recorded (the bridge's switch is on): the pill on the live view says REC.
    const recording = this.hass.states[recordings?.toggle]?.state === "on";
    // A Frigate camera opens at its newest day with recordings, once it is known; any other camera at today.
    const day = this._recordingDay ?? (recordings ? null : localDay(new Date()));
    // Turning is hidden behind a button, so a camera that turns has the same window as one that does not.
    const controls = cameraMoves(this.hass, this.sheet.entityId, this.config);
    const quick = cameraQuickControls(this.hass, this.sheet.entityId, this.config);
    // The positions belong to turning: they show while the camera is turned live.
    const positions = controls.presets && this._ptzOpen && this._live ? controls.presets : null;
    const turns = Boolean(Object.keys(controls.moves).length || controls.presets);
    // The gear opens what the camera reports and what can be set on it, not the window of Home Assistant.
    const settings = () =>
      this._change({
        kind: "panel",
        entityId: cameraId ?? this.sheet.entityId,
        item: cameraSettingsPanel(this.hass, this.sheet.entityId, this.config, this._t("camera_settings", { name: shown.name })),
      });
    return html`
      ${this._renderHeader(
        shown.name,
        true,
        true,
        settings,
        html`${cameras.length > 1
            ? html`<button
                class="landscape-only ${this._camerasOpen ? "on" : ""}"
                aria-label=${this._t("cameras_other")}
                aria-expanded=${this._camerasOpen ? "true" : "false"}
                data-open-cameras
                @click=${() => {
                  this._camerasOpen = !this._camerasOpen;
                  if (this._camerasOpen) this._lineOpen = false;
                }}
              >
                <ha-icon icon="mdi:cctv"></ha-icon>
              </button>`
            : nothing}
          <button
            class="landscape-only ${this._daysOpen ? "on" : ""}"
            aria-label=${this._t("recordings_days")}
            aria-expanded=${this._daysOpen ? "true" : "false"}
            data-open-days
            @click=${() => (this._daysOpen = !this._daysOpen)}
          >
            <ha-icon icon="mdi:calendar-month-outline"></ha-icon>
          </button>
          <button
            class="corner-live ${this._live ? "on" : ""}"
            data-corner-live
            ?disabled=${(!cameraId || gone) && !this._live}
            @click=${() => this._timelineLive(cameraId)}
          >
            ${this._live && this._liveShown ? this._t("live_disconnect") : this._t("live")}
          </button>
          ${this._renderSdButton(shown, cameraId)}${turns ? this._renderPtzToggle() : nothing}${this._renderSound()}`,
      )}
      <div
        class="body camera-body ${this._daysOpen ? "days-open" : ""} ${this._lineOpen ? "line-open" : ""} ${this
          ._camerasOpen
          ? "cameras-open"
          : ""}"
      >
        ${this._volumeOpen
          ? html`<label class="sound-level" data-sound-level>
              <ha-icon icon="mdi:volume-low"></ha-icon>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                aria-label=${this._t("sound_level")}
                .value=${String((this._muted ?? true) ? 0 : (this._volume ?? 1))}
                @input=${(event) => this._setVolume(Number(event.target.value))}
              />
              <ha-icon icon="mdi:volume-high"></ha-icon>
            </label>`
          : nothing}
        <home-dashboard-recording-days
              @pointerdown=${(event) => this._daysOpen && this._swipeAway(event, () => (this._daysOpen = false), -1)}
              .hass=${this.hass}
              .source=${recordings}
              .day=${day}
              @recording-days=${(event) => {
                this._recordingDay ??= event.detail.newest ?? localDay(new Date());
              }}
              @recording-day=${(event) => {
                this._recordingDay = event.detail.day;
                if (window.matchMedia(LANDSCAPE_PHONE).matches) this._daysOpen = false;
                this._clip = null;
                this._playhead = null;
              }}
            ></home-dashboard-recording-days>
        <div
          class="stage ${this._zoomScale > 1 ? "zoomed" : ""}"
          @click=${this._tapPicture}
          @pointerdown=${this._zoomDown}
          @pointermove=${(event) => event.pointerType !== "touch" && this._pictureZoom.move(event)}
          @pointerup=${(event) => event.pointerType !== "touch" && this._pictureZoom.up(event)}
          @pointercancel=${(event) => event.pointerType !== "touch" && this._pictureZoom.cancel(event)}
          @lostpointercapture=${(event) => event.pointerType !== "touch" && this._pictureZoom.cancel(event)}
          @touchstart=${this._zoomTouch}
          @touchmove=${this._zoomTouch}
          @touchend=${this._zoomTouch}
          @touchcancel=${this._zoomTouch}
          @gesturestart=${(event) => event.preventDefault()}
          @wheel=${this._zoomWheel}
        >
          ${this._zoomScale > 1
            ? html`<button class="zoom-badge" aria-label=${this._t("zoom_reset")} data-zoom-reset @click=${() => this._pictureZoom.reset()}>
                ${new Intl.NumberFormat(this.hass.language, { maximumFractionDigits: 1 }).format(this._zoomScale)}×
              </button>`
            : nothing}
          ${this._live
            ? html`<span class="live-pill ${recording ? "recording" : ""} ${this._liveShown ? "" : "waiting"}" data-live-pill>
                ${recording ? html`<i class="rec" data-rec></i>REC · ` : nothing}${this._t("live")}
              </span>`
            : nothing}
          ${this._live
            ? html`<div class="live-wrap ${this._liveShown ? "shown" : ""}">
                ${this._liveShown
                  ? nothing
                  : html`<img class="poster" data-live-poster src=${this.hass.hassUrl(shown.picture)} alt="" />
                      <span class="waking" data-live-waking role="progressbar" aria-label=${this._t("live_waking")}></span>`}
                <div class="live" data-live></div>
              </div>`
            : this._clip
              ? html`<video
                  class="clip"
                  data-clip
                  src=${this._clip.url}
                  playsinline
                  .muted=${this._muted ?? true}
                  @timeupdate=${this._clipTime}
                  @ended=${this._clipEnded}
                  @play=${() => (this._clipPaused = false)}
                  @pause=${() => (this._clipPaused = true)}
                ></video>`
              : html`<div class="picture">
                  ${picture
                    ? html`<img
                        src=${picture}
                        alt=""
                        @load=${() => {
                          this._pictureLoaded(shown.entityId);
                          this._measureMedia();
                        }}
                        @error=${() => this._pictureBroke(shown.entityId)}
                      />`
                    : html`<div class="no-picture"></div>`}
                  ${down ? nothing : html`<span class="age">${pictureAge(this.hass.language, shown.updatedAt, Date.now())}</span>`}
                </div>`}
          ${down
            ? html`<div class="camera-down" data-camera-down><span>${this._t("camera_is_unavailable")}</span></div>`
            : nothing}
          ${streamDot(cameraStreaming(this.hass, cameraStreamSensors(this.hass, this.sheet.entityId, this.config)), this._t("stream_open"))}
          ${!this._live && !this._clip && !down && cameraId
            ? html`<button
                class="play-live ${this._zoomScale > 1 ? "hidden" : ""}"
                data-play-live
                aria-label=${this._t("live")}
                @click=${(event) => {
                  // The picture under it zooms on a tap: this tap is for the live view only.
                  event.stopPropagation();
                  this._timelineLive(cameraId);
                }}
              >
                <ha-icon icon="mdi:play"></ha-icon>
              </button>`
            : nothing}
          ${turns && this._ptzOpen && this._live ? this._renderCameraMoves(controls) : nothing}
          ${this._renderTalk(talk)}
        </div>
        ${this._voice
          ? html`<home-dashboard-intercom
              .hass=${this.hass}
              .config=${this.config}
              .areas=${[this._voice.room.id]}
              .label=${this._voice.room.name}
              .recorder=${this._voice.recorder}
              @intercom-close=${() => {
                this._voice = null;
              }}
            ></home-dashboard-intercom>`
          : nothing}
        ${this._talkProblem ? html`<p class="hint" data-talk-problem>${this._t(`talk_${this._talkProblem}`)}</p>` : nothing}
        ${battery
          ? html`<p class="hint battery-hint ${this._clip ? "faint" : ""}" data-battery-hint>${this._t("battery_hint")}</p>`
          : nothing}
        ${!this._live && !cameraId ? html`<p class="hint">${this._t("no_live")}</p>` : nothing}
        ${this._renderCameraThumbs(cameras)} ${this._renderQuick(quick, positions, this._renderDiskButton(shown, cameraId, recordings, "upright"))} ${this._renderSirenAsk(quick, shown.name)}
        <home-dashboard-timeline
              @pointerdown=${(event) => this._lineOpen && this._swipeAway(event, () => (this._lineOpen = false), 1)}
              .hass=${this.hass}
              .source=${recordings}
              .day=${day}
              .time=${this._clip ? this._playhead : null}
              .playing=${Boolean(this._clip && !this._clipPaused)}
              .live=${this._live}
              .canLive=${Boolean(cameraId) && !gone}
              .connected=${this._live && this._liveShown}
              @timeline-scrub=${() => {
                this._clipVideo()?.pause();
                // Looking back in time lets the camera go at once.
                if (this._live) this._stopLive();
              }}
              @timeline-seek=${(event) => this._playClip(event.detail.clip)}
              @timeline-play=${(event) => this._timelinePlay(event)}
              @timeline-live=${() => this._timelineLive(cameraId)}
            ></home-dashboard-timeline>
        <button
          class="landscape-only line-button ${this._lineOpen ? "on" : ""}"
          aria-label=${this._t("recordings_line")}
          aria-expanded=${this._lineOpen ? "true" : "false"}
          data-open-line
          @click=${() => {
            this._lineOpen = !this._lineOpen;
            if (this._lineOpen) this._camerasOpen = false;
          }}
        >
          <ha-icon icon="mdi:timeline-clock-outline"></ha-icon>
        </button>
        ${this._renderDiskButton(shown, cameraId, recordings, "side")}
      </div>
    `;
  }

  // A camera that can turn: a ring of arrows over the picture, and its saved positions in a list under it.
  _renderCameraMoves({ moves }) {
    const run = (call) => this.hass.callService(call.domain, call.service, call.data);
    const arrow = (direction, icon) => html`
      <button
        class="ptz-${direction}"
        aria-label=${this._t(`ptz_${direction}`)}
        data-ptz=${direction}
        ?disabled=${!moves[direction]}
        @click=${() => run(moves[direction])}
      >
        <ha-icon icon=${icon}></ha-icon>
      </button>
    `;
    return html`
      ${Object.keys(moves).length
        ? html`<div class="ptz-overlay" data-ptz-overlay>
            <div class="ptz" data-ptz-pad>
              ${arrow("up", "mdi:menu-up")} ${arrow("right", "mdi:menu-right")} ${arrow("left", "mdi:menu-left")}
              ${arrow("down", "mdi:menu-down")}
            </div>
          </div>`
        : nothing}
    `;
  }

  // Quick buttons of a camera: siren, light, night vision and, while turning, its positions. Upright they stand in a
  // row over the line of time from the right; on a phone on its side in a column in the bottom left corner, from the
  // bottom. A list (night vision, positions) opens next to its button.
  _renderQuick(quick, presets, disk = nothing) {
    const run = (call) => this.hass.callService(call.domain, call.service, call.data);
    const state = (id) => this.hass.states[id]?.state;
    const sirenOn = quick.siren && state(quick.siren) === "on";
    const lightOn = quick.light && state(quick.light) === "on";
    const night = quick.night;
    const menu = this._quickMenu;
    const button = (key, icon, label, { on = false, alarm = false, click }) => html`
      <button
        class="quick-button ${on ? "on" : ""} ${alarm ? "alarm" : ""}"
        aria-label=${label}
        aria-pressed=${on || alarm ? "true" : "false"}
        data-quick=${key}
        @click=${click}
      >
        <ha-icon .icon=${icon}></ha-icon>
      </button>
    `;
    const list = (key, options, current, label, pick) =>
      menu === key
        ? html`<div class="quick-menu" data-quick-menu=${key} role="listbox" aria-label=${label}>
            ${options.map(
              (option) => html`<button
                class=${option === current ? "chosen" : ""}
                data-quick-option=${option}
                @click=${() => {
                  this._quickMenu = null;
                  pick(option);
                }}
              >
                ${key === "night" ? this._nightLabel(option) : option}
              </button>`,
            )}
          </div>`
        : nothing;
    const toggleMenu = (key) => () => (this._quickMenu = menu === key ? null : key);
    if (!quick.siren && !quick.light && !night && !presets && disk === nothing) return nothing;
    return html`
      <div class="quick" data-quick-bar>
        ${quick.siren
          ? button("siren", "mdi:alarm-light-outline", this._t(sirenOn ? "quick_siren_off" : "quick_siren"), {
              alarm: sirenOn,
              click: () => (sirenOn ? run(onOff(quick.siren, false)) : (this._sirenAsk = true)),
            })
          : nothing}
        ${quick.light
          ? button("light", lightOn ? "mdi:lightbulb-on" : "mdi:lightbulb-outline", this._t("quick_light"), {
              on: lightOn,
              click: () => run(onOff(quick.light, !lightOn)),
            })
          : nothing}
        ${night
          ? html`<span class="quick-slot">
              ${button("night", this._nightIcon(night.current), this._t("quick_night"), { on: menu === "night", click: toggleMenu("night") })}
              ${list("night", night.options, night.current, this._t("quick_night"), (option) =>
                run({ domain: domainOf(night.entity), service: "select_option", data: { entity_id: night.entity, option } }),
              )}
            </span>`
          : nothing}
        ${presets
          ? html`<span class="quick-slot">
              ${button("positions", "mdi:map-marker-radius-outline", this._t("ptz_preset"), {
                on: menu === "positions",
                click: toggleMenu("positions"),
              })}
              ${list("positions", presets.options, presets.current, this._t("ptz_preset"), async (option) => {
                for (const call of presetCalls(presets, option)) await run(call);
              })}
            </span>`
          : nothing}
        ${disk}
      </div>
    `;
  }

  // Neolink's infrared offers auto / on / off: "on" is infrared, "auto" switches by the light.
  _nightLabel(option) {
    const key = { off: "night_off", auto: "night_auto", on: "night_infrared", infrared: "night_infrared", "full color": "night_colour" }[
      String(option).toLowerCase()
    ];
    return key ? this._t(key) : option;
  }

  _nightIcon(option) {
    return (
      { off: "mdi:weather-sunny", on: "mdi:weather-night", infrared: "mdi:weather-night", "full color": "mdi:lightbulb-on-outline" }[
        String(option).toLowerCase()
      ] ?? "mdi:theme-light-dark"
    );
  }

  // The siren asks first: it is loud, and a tap is easily made by mistake.
  _renderSirenAsk(quick, name) {
    if (!this._sirenAsk || !quick.siren) return nothing;
    const close = () => (this._sirenAsk = false);
    return html`
      <div class="siren-ask" data-siren-ask role="alertdialog" aria-label=${this._t("siren_ask_title")}>
        <div class="siren-card">
          <ha-icon icon="mdi:alarm-light"></ha-icon>
          <strong>${this._t("siren_ask_title")}</strong>
          <p>${translate(this.hass.language, "siren_ask_text", { name })}</p>
          <div class="siren-actions">
            <button data-siren-cancel @click=${close}>${this._t("cancel")}</button>
            <button
              class="danger"
              data-siren-confirm
              @click=${() => {
                close();
                const call = onOff(quick.siren, true);
                this.hass.callService(call.domain, call.service, call.data);
              }}
            >
              ${this._t("siren_ask_confirm")}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Group of a room's status icon ---------------------------------------------------------------

  _tapRow(tile) {
    if (tile.tapAction === "call") this.hass.callService(tile.call.domain, tile.call.service, tile.call.data);
    if (tile.tapAction === "more-info") {
      this.dispatchEvent(new CustomEvent("sheet-details", { detail: { entityId: tile.entityId } }));
    }
    if (tile.tapAction === "sheet") this._change({ kind: TILE_SHEETS[tile.domain], entityId: tile.entityId, name: tile.name });
    if (tile.tapAction === "panel") this._change({ kind: "panel", entityId: tile.entityId, item: tile.item });
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

  // Rooms -----------------------------------------------------------------------------------

  _renderRooms() {
    return html`
      ${this._renderHeader(this._t("rooms_pick"), false, false)}
      <div class="rows">
        <button class="row off" data-home-link @click=${() => this.dispatchEvent(new CustomEvent("sheet-home"))}>
          <span class="row-icon"><ha-icon icon="mdi:home"></ha-icon></span>
          <span class="row-text"><strong>${this._t("home_page")}</strong></span>
        </button>
        ${this.sheet.rooms.map(
          (room) => html`
            <button
              class="row off"
              data-area-link=${room.id}
              @click=${() => this.dispatchEvent(new CustomEvent("sheet-room", { detail: { id: room.id } }))}
            >
              <span class="row-icon"><ha-icon icon="mdi:floor-plan"></ha-icon></span>
              <span class="row-text"><strong>${room.name}</strong></span>
            </button>
          `,
        )}
        <hr />
        ${this.hass.user?.is_admin
          ? html`
              <button class="row off" data-sheet-access @click=${() => this._change({ kind: "access" })}>
                <span class="row-icon"><ha-icon icon="mdi:account-lock-outline"></ha-icon></span>
                <span class="row-text"><strong>${this._t("access_title")}</strong></span>
              </button>
            `
          : nothing}
        ${this.sheet.onBackground
          ? html`
              <button class="row off" data-sheet-background @click=${() => this._leaveFor(this.sheet.onBackground)}>
                <span class="row-icon"><ha-icon icon="mdi:image-outline"></ha-icon></span>
                <span class="row-text"><strong>${this._t("screen_background")}</strong></span>
              </button>
            `
          : nothing}
        ${this.sheet.roomView
          ? html`
              <button class="row off" data-sheet-room-view @click=${() => this._change({ kind: "room-view", room: this.sheet.roomView })}>
                <span class="row-icon"><ha-icon icon="mdi:eye-settings-outline"></ha-icon></span>
                <span class="row-text"><strong>${this._t("room_view_title")}</strong></span>
              </button>
            `
          : nothing}
        ${this.sheet.personal
          ? html`
              <button class="row off" data-sheet-personal @click=${() => this._change({ kind: "personal" })}>
                <span class="row-icon"><ha-icon icon="mdi:sort"></ha-icon></span>
                <span class="row-text"><strong>${this._t("personal_title")}</strong></span>
              </button>
            `
          : nothing}
        ${this.hass.user?.is_admin && this.sheet.personal
          ? html`
              <button class="row off" data-sheet-blocks @click=${() => this._change({ kind: "blocks" })}>
                <span class="row-icon"><ha-icon icon="mdi:view-grid-plus-outline"></ha-icon></span>
                <span class="row-text"><strong>${this._t("block_title")}</strong></span>
              </button>
            `
          : nothing}
        ${this.sheet.onEdit
          ? html`
              <button class="row off" data-sheet-edit @click=${() => this._leaveFor(this.sheet.onEdit)}>
                <span class="row-icon"><ha-icon icon="mdi:pencil-outline"></ha-icon></span>
                <span class="row-text"><strong>${this._t("edit_screen")}</strong></span>
              </button>
            `
          : nothing}
      </div>
    `;
  }

  // My layout -------------------------------------------------------------------------------

  _renderTabs(tabs) {
    return html`
      <div class="choices sheet-tabs">
        ${tabs.map(
          ([key, label]) => html`
            <button class="choice ${this._tab === key ? "on" : ""}" data-tab=${key} @click=${() => (this._tab = key)}>
              <span>${label}</span>
            </button>
          `,
        )}
      </div>
    `;
  }

  // An administrator arranges rooms and favorites for everyone here too, so there is one place for both.
  _toggleShared(on) {
    const config = this.raw ?? {};
    this._shared = on
      ? { order: [...(config.rooms?.order ?? [])], hidden: [...(config.rooms?.hidden ?? [])], favorites: [...(config.favorites ?? [])] }
      : null;
    this._query = "";
  }

  _saveShared() {
    const { order, hidden, favorites } = this._shared;
    this.dispatchEvent(new CustomEvent("sheet-layout", { detail: { rooms: { order, hidden }, favorites } }));
  }

  _movePersonal(list, index, delta) {
    const order = list.map((item) => item.id);
    const [moved] = order.splice(index, 1);
    order.splice(index + delta, 0, moved);
    if (this._sharedTab) {
      this._shared = { ...this._shared, [this._tab === "rooms" ? "order" : "favorites"]: order };
      return;
    }
    savePrefs(this.hass, { ...personalPrefs(), [this._tab]: order });
    this.requestUpdate();
  }

  _togglePersonal(id) {
    if (this._sharedTab) {
      const { hidden } = this._shared;
      this._shared = { ...this._shared, hidden: hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id] };
      return;
    }
    const key = `hidden_${this._tab}`;
    const prefs = personalPrefs();
    const hidden = prefs[key] ?? [];
    const next = hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id];
    savePrefs(this.hass, { ...prefs, [key]: next });
    this.requestUpdate();
  }

  _setFavorites(ids) {
    this._query = "";
    if (this._sharedTab) {
      this._shared = { ...this._shared, favorites: ids };
      return;
    }
    savePrefs(this.hass, { ...personalPrefs(), favorites: ids });
    this.requestUpdate();
  }

  _renderFavorites(list) {
    const ids = list.map((item) => item.id);
    const matches = favoriteCandidates(this.hass, this.raw, this.hass.user?.id, ids, this._query ?? "");
    return html`
      <input
        class="search"
        type="search"
        placeholder=${this._t("favorites_add")}
        data-favorite-search
        .value=${this._query ?? ""}
        @input=${(event) => (this._query = event.target.value)}
      />
      ${matches.map(
        ({ id, name }) => html`
          <button class="row off" data-favorite-match=${id} @click=${() => this._setFavorites([...ids, id])}>
            <span class="row-icon"><ha-icon icon="mdi:plus"></ha-icon></span>
            <span class="row-text"><strong>${name}</strong><small>${id}</small></span>
          </button>
        `,
      )}
      ${list.map(
        (item, index) => html`
          <div class="order-row" data-order=${item.id}>
            <span>${item.name}</span>
            <button aria-label=${this._t("personal_remove")} data-personal="remove" @click=${() => this._setFavorites(ids.filter((id) => id !== item.id))}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
            <button aria-label=${this._t("personal_up")} data-personal="up" ?disabled=${index === 0} @click=${() => this._movePersonal(list, index, -1)}>
              <ha-icon icon="mdi:arrow-up"></ha-icon>
            </button>
            <button
              aria-label=${this._t("personal_down")}
              data-personal="down"
              ?disabled=${index === list.length - 1}
              @click=${() => this._movePersonal(list, index, 1)}
            >
              <ha-icon icon="mdi:arrow-down"></ha-icon>
            </button>
          </div>
        `,
      )}
    `;
  }

  // Kept with the account, so every device of the person opens here; the device remembers it too.
  _toggleStart(on) {
    const start = on ? dashboardStart() : false;
    savePrefs(this.hass, { ...personalPrefs(), start });
    setDashboardStart(on ? start : null);
    this.requestUpdate();
  }

  get _sharedTab() {
    return Boolean(this._shared) && ["rooms", "favorites"].includes(this._tab);
  }

  _renderPersonal() {
    const choices = this._sharedTab
      ? sharedLayoutChoices(this.hass, this.raw, this._shared)
      : personalChoices(this.hass, this.raw, this.hass.user?.id, personalPrefs());
    const list = choices[this._tab];
    const canShare = this.hass.user?.is_admin && ["rooms", "favorites"].includes(this._tab);
    const orderable = this._tab !== "menu";
    const button = (key, icon, disabled, onTap, data) => html`
      <button aria-label=${this._t(key)} data-personal=${data} ?disabled=${disabled} @click=${onTap}>
        <ha-icon .icon=${icon}></ha-icon>
      </button>
    `;
    return html`
      ${this._renderHeader(this._t("personal_title"), false, false)}
      <div class="rows">
        ${this._renderTabs([
          ["cameras", this._t("personal_cameras")],
          ["rooms", this._t("personal_rooms")],
          ["chips", this._t("personal_chips")],
          ["scenes", this._t("personal_scenes")],
          ["favorites", this._t("personal_favorites")],
          ["menu", this._t("personal_menu")],
        ])}
        ${canShare
          ? html`<label class="field" data-layout-everyone>
              <span>${this._t("layout_everyone")}</span>
              <input type="checkbox" .checked=${Boolean(this._shared)} @change=${(event) => this._toggleShared(event.target.checked)} />
            </label>`
          : nothing}
        ${this._tab === "favorites"
          ? this._renderFavorites(list)
          : list.map(
              (item, index) => html`
                <div class="order-row ${item.hidden ? "muted" : ""}" data-order=${item.id}>
                  <span>${item.name}</span>
                  ${button("personal_hide", item.hidden ? "mdi:eye-off-outline" : "mdi:eye-outline", false, () => this._togglePersonal(item.id), "hide")}
                  ${orderable ? button("personal_up", "mdi:arrow-up", index === 0, () => this._movePersonal(list, index, -1), "up") : nothing}
                  ${orderable
                    ? button("personal_down", "mdi:arrow-down", index === list.length - 1, () => this._movePersonal(list, index, 1), "down")
                    : nothing}
                </div>
              `,
            )}
        ${this._sharedTab
          ? html`<button class="block-action on" data-layout-save @click=${() => this._saveShared()}>
              <span>${this._t("layout_save_everyone")}</span>
            </button>`
          : html`<label class="field" data-start-mine>
                <span>${this._t("start_mine")}</span>
                <input type="checkbox" .checked=${Boolean(personalPrefs().start)} @change=${(event) => this._toggleStart(event.target.checked)} />
              </label>
              <button class="block-action" data-personal-reset @click=${() => this._resetPersonal()}>
                <span>${this._t("personal_reset")}</span>
              </button>`}
      </div>
    `;
  }

  _resetPersonal() {
    savePrefs(this.hass, {});
    this.requestUpdate();
  }

  // My view of a room ---------------------------------------------------------------------

  _toggleRoomHidden(kind, key) {
    const prefs = personalPrefs();
    const { room } = this.sheet;
    const all = prefs[kind] ?? {};
    const list = all[room] ?? [];
    const next = list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
    savePrefs(this.hass, { ...prefs, [kind]: { ...all, [room]: next } });
    this.requestUpdate();
  }

  _restoreRoom() {
    const prefs = personalPrefs();
    const { room } = this.sheet;
    const without = (kind) => Object.fromEntries(Object.entries(prefs[kind] ?? {}).filter(([key]) => key !== room));
    savePrefs(this.hass, { ...prefs, hidden_tiles: without("hidden_tiles"), hidden_sections: without("hidden_sections") });
    this.requestUpdate();
  }

  _renderRoomView() {
    const prefs = personalPrefs();
    const actionsOf = (config, model) => roomActions(this.hass, config, model, "phone");
    const sections = roomViewChoices(this.hass, this.raw, this.hass.user?.id, prefs, this.sheet.room, actionsOf);
    const eye = (hidden, label, onTap, data) => html`
      <button aria-label=${this._t("personal_hide")} data-view=${data} @click=${onTap}>
        <ha-icon .icon=${hidden ? "mdi:eye-off-outline" : "mdi:eye-outline"}></ha-icon>
      </button>
    `;
    return html`
      ${this._renderHeader(this._t("room_view_title"), false, false)}
      <div class="rows">
        <p class="hint">${this._t("room_view_hint")}</p>
        ${sections.map(
          (section) => html`
            <div class="order-row view-section ${section.hidden ? "muted" : ""}" data-view-section=${section.id}>
              <span><strong>${section.title}</strong></span>
              ${section.whole ? eye(section.hidden, section.title, () => this._toggleRoomHidden("hidden_sections", section.id), "section") : nothing}
            </div>
            ${section.hidden
              ? nothing
              : section.tiles.map(
                  (tile) => html`
                    <div class="order-row view-tile ${tile.hidden ? "muted" : ""}" data-view-tile=${tile.key}>
                      <span>${tile.name}</span>
                      ${eye(tile.hidden, tile.name, () => this._toggleRoomHidden("hidden_tiles", tile.key), "tile")}
                    </div>
                  `,
                )}
          `,
        )}
        <button class="block-action" data-view-restore @click=${() => this._restoreRoom()}>
          <span>${this._t("room_view_restore")}</span>
        </button>
      </div>
    `;
  }

  // Access ----------------------------------------------------------------------------------

  async _loadUsers() {
    this._users = [];
    const users = await this.hass.callWS({ type: "config/auth/list" });
    this._users = (Array.isArray(users) ? users : []).filter((user) => !user.system_generated && user.is_active !== false);
    this._accessUser = this._users.find((user) => !user.is_owner)?.id ?? this._users[0]?.id;
  }

  get _accessDraft() {
    return this._access ?? this.config.access;
  }

  get _accessTargets() {
    if (this._accessUser !== EVERYONE_ELSE) return [this._accessUser];
    return (this._users ?? []).map((user) => user.id).filter((id) => id !== this.hass.user?.id);
  }

  // With several people, only what all of them have hidden counts as hidden.
  _accessHidden(key) {
    const [first, ...rest] = this._accessTargets.map((id) => this._accessDraft[id]?.[key] ?? []);
    return (first ?? []).filter((id) => rest.every((list) => list.includes(id)));
  }

  _toggleAccess(key, id) {
    const hide = !this._accessHidden(key).includes(id);
    const draft = { ...this._accessDraft };
    for (const user of this._accessTargets) {
      const rule = draft[user] ?? {};
      const others = (rule[key] ?? []).filter((item) => item !== id);
      draft[user] = { ...rule, [key]: hide ? [...others, id] : others };
    }
    this._access = draft;
  }

  _renderAccess() {
    const choices = accessChoices(this.hass, this.raw);
    const key = { rooms: "rooms", sections: "sections" }[this._tab] ?? "hide";
    const query = this._query.toLowerCase();
    const list = (choices[this._tab] ?? []).filter((item) => item.name.toLowerCase().includes(query));
    const shut = this._accessHidden(key);
    const hidden = (id) => shut.includes(id);
    return html`
      ${this._renderHeader(this._t("access_title"), false, false)}
      <div class="rows">
        <label class="field">
          <span>${this._t("access_user")}</span>
          <select data-access-user @change=${(event) => (this._accessUser = event.target.value)}>
            ${(this._users ?? []).map(
              (user) => html`<option value=${user.id} ?selected=${user.id === this._accessUser}>${user.name}</option>`,
            )}
            <option value=${EVERYONE_ELSE} ?selected=${this._accessUser === EVERYONE_ELSE}>${this._t("access_everyone_else")}</option>
          </select>
        </label>
        ${this._renderTabs([
          ["cameras", this._t("access_cameras")],
          ["rooms", this._t("access_rooms")],
          ["sections", this._t("access_sections")],
          ["chips", this._t("personal_chips")],
          ["lights", this._t("access_lights")],
          ["media", this._t("access_media")],
          ["security", this._t("access_security")],
          ["actions", this._t("access_actions")],
          ["other", this._t("access_other")],
        ])}
        <input
          class="search"
          type="search"
          placeholder=${this._t("access_search")}
          data-access-search
          .value=${this._query}
          @input=${(event) => (this._query = event.target.value)}
        />
        <small>${this._t("access_hidden", {
          count: ["hide", "rooms", "sections"].reduce((sum, key) => sum + this._accessHidden(key).length, 0),
        })}</small>
        ${[...list]
          .sort((a, b) => Number(hidden(b.id)) - Number(hidden(a.id)))
          .map(
            (item) => html`
              <div class="order-row ${hidden(item.id) ? "muted" : ""}" data-access=${item.id}>
                <span>${item.name}</span>
                <button aria-label=${this._t("personal_hide")} @click=${() => this._toggleAccess(key, item.id)}>
                  <ha-icon .icon=${hidden(item.id) ? "mdi:eye-off-outline" : "mdi:eye-outline"}></ha-icon>
                </button>
              </div>
            `,
          )}
        <button
          class="block-action on"
          data-access-save
          ?disabled=${!this._access}
          @click=${() => this.dispatchEvent(new CustomEvent("sheet-access", { detail: { access: this._access } }))}
        >
          <span>${this._t("save")}</span>
        </button>
      </div>
    `;
  }

  async _leaveFor(onEdit) {
    if (this._leaving) return;
    this._leaving = true;
    await this._slideOut();
    this.dispatchEvent(new CustomEvent("sheet-edit", { detail: { onEdit } }));
  }

  // Background ------------------------------------------------------------------------------

  _startBackground() {
    const { shared, own } = this.sheet;
    const admin = Boolean(this.hass.user?.is_admin);
    const mine = (mode) => mode in own || `${mode}_wide` in own;
    const value = (mode, slot) => (mine(mode) ? (own[slot] ?? null) : shared[slot]);
    this._bg = {
      light: value("light", "light"),
      dark: value("dark", "dark"),
      light_wide: value("light", "light_wide"),
      dark_wide: value("dark", "dark_wide"),
      position: own.position ?? shared.position ?? "center",
    };
    this._bgMode = isDark() ? "dark" : "light";
    this._bgShape = screenShape();
    this._bgEveryone = { light: admin && !mine("light"), dark: admin && !mine("dark") };
  }

  _pickBackground(value) {
    this._bg = { ...this._bg, [backgroundSlot(this._bgMode, this._bgShape)]: value };
  }

  async _uploadBackground(event) {
    const [file] = event.target.files;
    if (!file) return;
    this._uploadProblem = false;
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await this.hass.fetchWithAuth("/api/image/upload", { method: "POST", body });
      if (!response.ok) throw new Error(String(response.status));
      const { id } = await response.json();
      this._pickBackground(`/api/image/serve/${id}/original`);
    } catch {
      this._uploadProblem = true;
    }
  }

  // Each look goes either to everyone, which only an administrator can do, or to this account alone.
  async _saveBackground() {
    const { target, shared } = this.sheet;
    const prefs = personalPrefs();
    const nextShared = { ...shared };
    const own = {};
    ["light", "dark"].forEach((mode) => {
      const place = this._bgEveryone[mode] ? nextShared : own;
      place[mode] = this._bg[mode];
      place[`${mode}_wide`] = this._bg[`${mode}_wide`];
    });
    // A wide picture or a part to keep that nobody chose is left out, so the configuration stays short.
    [nextShared, own].forEach((place) => {
      ["light_wide", "dark_wide"].forEach((slot) => place[slot] ?? delete place[slot]);
      if (Object.keys(place).length) place.position = this._bg.position;
      if (place.position === "center") delete place.position;
    });
    const backgrounds = { ...prefs.backgrounds, [target]: own };
    if (!Object.keys(own).length) delete backgrounds[target];
    savePrefs(this.hass, { ...prefs, backgrounds });
    if (Object.values(this._bgEveryone).some(Boolean)) {
      this.dispatchEvent(new CustomEvent("sheet-background", { detail: { target, shared: nextShared } }));
    } else {
      this._close();
    }
  }

  _clearOwnBackground() {
    const prefs = personalPrefs();
    const { [this.sheet.target]: dropped, ...backgrounds } = prefs.backgrounds ?? {};
    savePrefs(this.hass, { ...prefs, backgrounds });
    this._close();
  }

  _renderBackgroundField(mode) {
    const other = this._bgShape === "wide" ? "tall" : "wide";
    const own = this._bg[backgroundSlot(mode, this._bgShape)];
    const value = own ?? this._bg[backgroundSlot(mode, other)];
    const admin = this.hass.user?.is_admin;
    const note = own ? nothing : html`<small>${this._t(value ? `background_as_${other}` : "background_none")}</small>`;
    return html`
      <div class="look ${this._bgMode === mode ? "on" : ""}" data-look=${mode}>
        <button
          class="look-preview ${own ? "" : "borrowed"}"
          style=${value ? backgroundStyle(value, this._bg.position) : nothing}
          @click=${() => (this._bgMode = mode)}
        >
          ${note}
        </button>
        <strong>${this._t(`background_${mode}`)}</strong>
        ${admin
          ? html`<label class="look-scope">
              <input
                type="checkbox"
                data-everyone=${mode}
                .checked=${this._bgEveryone[mode]}
                @change=${(event) => (this._bgEveryone = { ...this._bgEveryone, [mode]: event.target.checked })}
              />
              <span>${this._t("background_everyone")}</span>
            </label>`
          : nothing}
      </div>
    `;
  }

  _pickColorMode(mode) {
    savePrefs(this.hass, { ...personalPrefs(), color_mode: mode });
    this._bgMode = isDark() ? "dark" : "light";
    this.requestUpdate();
  }

  _renderBackgroundChoices(data, items, current, onPick) {
    return html`
      <div class="choices even" data-group=${data}>
        ${items.map(
          ([key, label]) => html`
            <button class="choice ${key === current ? "on" : ""}" data-choice=${key} @click=${() => onPick(key)}>${label}</button>
          `,
        )}
      </div>
    `;
  }

  _renderBackground() {
    const current = this._bg[backgroundSlot(this._bgMode, this._bgShape)];
    return html`
      ${this._renderHeader(this._t("screen_background"), false, false)}
      <div class="rows">
        <div class="choices" data-color-modes>
          ${["auto", "light", "dark"].map(
            (mode) => html`
              <button
                class="choice ${mode === (personalPrefs().color_mode ?? currentColorMode()) ? "on" : ""}"
                data-color-mode=${mode}
                @click=${() => this._pickColorMode(mode)}
              >
                ${this._t(`color_mode_${mode}`)}
              </button>
            `,
          )}
        </div>
        <p class="hint">${this._t("background_shape_hint")}</p>
        ${this._renderBackgroundChoices(
          "bg-shape",
          [
            ["tall", this._t("background_tall")],
            ["wide", this._t("background_wide")],
          ],
          this._bgShape,
          (shape) => (this._bgShape = shape),
        )}
        <div class="looks">${this._renderBackgroundField("light")}${this._renderBackgroundField("dark")}</div>
        <div class="swatches">
          ${BACKGROUNDS.map(
            (background) => html`
              <button
                class="swatch ${background === current ? "selected" : ""}"
                style=${backgroundStyle(background)}
                data-swatch=${background}
                @click=${() => this._pickBackground(background)}
              ></button>
            `,
          )}
        </div>
        <label class="field">
          <span>${this._t("background_colour")}</span>
          <span class="swatch-pick rainbow">
            <input type="color" data-colour @change=${(event) => this._pickBackground(event.target.value)} />
          </span>
        </label>
        <label class="field">
          <span>${this._t("background_picture")}</span>
          <input type="file" accept="image/*" data-picture @change=${this._uploadBackground} />
        </label>
        <p class="hint">${this._t("background_position_hint")}</p>
        ${this._renderBackgroundChoices(
          "bg-position",
          BACKGROUND_POSITIONS.map((position) => [position, this._t(`background_${position}`)]),
          this._bg.position,
          (position) => (this._bg = { ...this._bg, position }),
        )}
        ${this._uploadProblem ? html`<p class="hint" data-upload-problem>${this._t("background_failed")}</p>` : nothing}
        ${current
          ? html`<button class="row off" data-background-clear @click=${() => this._pickBackground(null)}>
              <span class="row-icon"><ha-icon icon="mdi:close"></ha-icon></span>
              <span class="row-text"><strong>${this._t("background_clear")}</strong></span>
            </button>`
          : nothing}
        ${Object.keys(this.sheet.own).length
          ? html`<button class="row off" data-background-own-clear @click=${this._clearOwnBackground}>
              <span class="row-icon"><ha-icon icon="mdi:restore"></ha-icon></span>
              <span class="row-text"><strong>${this._t("background_mine_clear")}</strong></span>
            </button>`
          : nothing}
        <button class="block-action on" data-background-save @click=${this._saveBackground}>
          <span>${this._t("save")}</span>
        </button>
      </div>
    `;
  }

  // Look of the page ------------------------------------------------------------------------

  // An administrator edits the shared look; everyone else, and an administrator who unticks it,
  // edits their own on top of it.
  _startLook(everyone = Boolean(this.hass.user?.is_admin)) {
    const shared = mergeAppearance(this.raw?.appearance);
    this._lookEveryone = everyone;
    this._look = everyone ? shared : mergeAppearance(this.raw?.appearance, personalPrefs().appearance);
    this._lookEntity = null;
    this._lookIcons = [];
    this._query = "";
  }

  _setLook(change) {
    this._look = { ...this._look, ...change };
  }

  _setLookTiles(change) {
    this._look = { ...this._look, tiles: { ...this._look.tiles, ...change } };
  }

  _setKindColour(kind, colour) {
    const { [kind]: dropped, ...colours } = this._look.tiles.colours;
    this._setLookTiles({ colours: colour ? { ...colours, [kind]: colour } : colours });
  }

  _setIcon(entityId, icon) {
    const { [entityId]: dropped, ...icons } = this._look.icons;
    this._setLook({ icons: icon ? { ...icons, [entityId]: icon } : icons });
  }

  async _searchIcons(query) {
    this._iconQuery = query;
    const list = await loadIconList((url) => this.hass.fetchWithAuth(url));
    if (this._iconQuery === query) this._lookIcons = searchIcons(list, query);
  }

  _saveLook() {
    const prefs = personalPrefs();
    if (this._lookEveryone) {
      this.dispatchEvent(new CustomEvent("sheet-appearance", { detail: { appearance: appearanceDiff(this._look) } }));
      return;
    }
    const own = appearanceDiff(this._look, mergeAppearance(this.raw?.appearance));
    const { appearance: dropped, ...rest } = prefs;
    savePrefs(this.hass, Object.keys(own).length ? { ...rest, appearance: own } : rest);
    this._close();
  }

  _resetOwnLook() {
    const { appearance: dropped, ...rest } = personalPrefs();
    savePrefs(this.hass, rest);
    this._startLook(false);
  }

  _renderSlider(data, label, value, [low, high], unit, onInput) {
    return html`
      <label class="field slider-field" data-look=${data}>
        <span>${label}</span>
        <input type="range" min=${low} max=${high} .value=${String(value)} @input=${(event) => onInput(Number(event.target.value))} />
        <output>${value}${unit}</output>
      </label>
    `;
  }

  // A few tiles drawn with the draft, so a change shows before it is saved.
  _renderLookPreview() {
    const { tiles } = this._look;
    const samples = [
      { kind: "light", tone: "light", icon: "mdi:lightbulb", name: this._t("look_kind_light"), state: "80%" },
      { kind: "cover", tone: "cover", icon: "mdi:blinds", name: this._t("look_kind_cover"), state: this._t("open_percent", { value: 100 }) },
      { kind: "scene", tone: "off", icon: "mdi:palette", name: this._t("look_kind_scene"), state: this._t("run") },
      { kind: "switch", tone: "off", icon: "mdi:toggle-switch-off-outline", name: this._t("look_kind_switch"), state: this._t("look_off") },
    ];
    return html`
      <div class="tile-preview ${tiles.fill === "icon" ? "fill-icon" : ""}" style=${tileVariables(this._look)} data-look-preview>
        ${samples.map(
          (sample) => html`
            <div class="look-tile tone-${sample.tone}" style=${tileColourStyle(tileColour(sample, this._look)) ?? nothing}>
              <span class="look-icon"><ha-icon .icon=${sample.icon}></ha-icon></span>
              <span class="row-text"><strong>${sample.name}</strong><small>${sample.state}</small></span>
            </div>
          `,
        )}
      </div>
    `;
  }

  // A colour or a gradient for the pages without a background of their own, one per look.
  _renderPaintField(key) {
    const value = this._look.page[key];
    return html`
      <div class="field look-colour" data-look-field="page.${key}">
        <span class="paint-swatch" style=${value ? `background: ${value}` : nothing}></span>
        <span>${this._t(`look_page_${key}`)}</span>
        ${value
          ? html`<button aria-label=${this._t("look_colour_clear")} data-look-field-clear @click=${() => this._setLookGroup("page", { [key]: null })}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>`
          : nothing}
        <input
          type="text"
          placeholder=${this._t("look_paint_placeholder")}
          .value=${value ?? ""}
          @change=${(event) => this._setLookGroup("page", { [key]: event.target.value.trim() || null })}
        />
      </div>
    `;
  }

  _renderLookBackground() {
    return html`
      ${this._renderSlider("strength", this._t("look_strength"), this._look.background_strength, [0, 100], "%", (value) =>
        this._setLook({ background_strength: value }),
      )}
      <p class="hint">${this._t("look_strength_hint")}</p>
      <label class="field" data-look="bounce">
        <span>${this._t("look_bounce")}</span>
        <input type="checkbox" .checked=${this._look.bounce} @change=${(event) => this._setLook({ bounce: event.target.checked })} />
      </label>
      <p class="hint">${this._t("look_bounce_hint")}</p>
      <p class="hint">${this._t("look_page_hint")}</p>
      ${this._renderPaintField("background_light")} ${this._renderPaintField("background_dark")}
      <h3 class="look-group">${this._t("look_tab_map")}</h3>
      <p class="hint">${this._t("look_map_theme_hint")}</p>
      ${this._renderBackgroundChoices(
        "map-theme",
        ["auto", "light", "dark"].map((theme) => [theme, this._t(`look_map_${theme}`)]),
        this._look.map.theme,
        (theme) => this._setLookGroup("map", { theme }),
      )}
      <p class="hint">${this._t("look_map_hours_hint")}</p>
      ${this._renderBackgroundChoices(
        "map-hours",
        [6, 24, 72, 168].map((hours) => [hours, this._t(`map_hours_${hours}`)]),
        this._look.map.hours,
        (hours) => this._setLookGroup("map", { hours }),
      )}
    `;
  }

  _setLookGroup(group, change) {
    this._look = { ...this._look, [group]: { ...this._look[group], ...change } };
  }

  _renderColourField(group, key) {
    const value = this._look[group][key];
    return html`
      <div class="field look-colour" data-look-field="${group}.${key}">
        <span>${this._t(`look_${group}_${key}`)}</span>
        ${this._renderSwatch(value, {
          pick: (colour) => this._setLookGroup(group, { [key]: colour + (value?.slice(7) ?? "") }),
          clear: () => this._setLookGroup(group, { [key]: null }),
          clearData: "data-look-field-clear",
        })}
      </div>
    `;
  }

  // A chosen colour as a round sample on a checkerboard (a see-through colour shows as such) with its code next to
  // it; no colour as an empty dashed ring, "Default". A tap on the sample opens the colour picker of the system.
  _renderSwatch(value, { pick, clear = null, clearData = "data-swatch-clear" }) {
    const hex = value?.slice(0, 7).toUpperCase();
    const alpha = value?.length === 9 ? Math.round((parseInt(value.slice(7), 16) / 255) * 100) : null;
    return html`
      <small class="swatch-text">${value ? `${hex}${alpha === null ? "" : ` · ${alpha}%`}` : this._t("look_colour_default")}</small>
      ${value && clear
        ? html`<button
            class="swatch-clear"
            aria-label=${this._t("look_colour_clear")}
            ?data-look-field-clear=${clearData === "data-look-field-clear"}
            ?data-look-colour-clear=${clearData === "data-look-colour-clear"}
            @click=${clear}
          >
            <ha-icon icon="mdi:close"></ha-icon>
          </button>`
        : nothing}
      <label class="swatch-pick ${value ? "" : "unset"}" style=${value ? `--swatch: ${value}` : ""}>
        <input type="color" .value=${value?.slice(0, 7) ?? "#808080"} @change=${(event) => pick(event.target.value)} />
      </label>
    `;
  }

  // Colours of everything around the tiles: writing, the blocks at the top, the round buttons.
  _renderLookColours() {
    const { chips, buttons, badges } = this._look;
    const heading = (key) => html`<h3 class="look-group">${this._t(key)}</h3>`;
    return html`
      ${this._renderLookPreview()}
      <p class="hint">${this._t("look_colours_page_hint")}</p>
      ${heading("look_group_text")} ${this._renderColourField("text", "title")} ${this._renderColourField("text", "headings")}
      ${heading("look_group_tiles")} ${this._renderColourField("tiles", "background")} ${this._renderColourField("tiles", "text")}
      ${this._renderColourField("tiles", "icon")} ${this._renderColourField("tiles", "icon_background")}
      ${heading("look_group_chips")} ${this._renderColourField("chips", "background")} ${this._renderColourField("chips", "text")}
      ${this._renderSlider("chip-opacity", this._t("look_opacity_short"), chips.opacity, [20, 100], "%", (value) =>
        this._setLookGroup("chips", { opacity: value }),
      )}
      ${this._renderSlider("chip-radius", this._t("look_radius"), chips.radius, [0, 30], " px", (value) =>
        this._setLookGroup("chips", { radius: value }),
      )}
      ${heading("look_group_buttons")} ${this._renderColourField("buttons", "background")} ${this._renderColourField("buttons", "icon")}
      ${this._renderSlider("button-opacity", this._t("look_opacity_short"), buttons.opacity, [20, 100], "%", (value) =>
        this._setLookGroup("buttons", { opacity: value }),
      )}
      ${heading("look_group_badges")} ${this._renderColourField("badges", "text")} ${this._renderColourField("badges", "icon")}
      <label class="field" data-look-badge-kinds>
        <span>${this._t("look_badge_kinds")}</span>
        <input type="checkbox" .checked=${badges.kinds} @change=${(event) => this._setLookGroup("badges", { kinds: event.target.checked })} />
      </label>
    `;
  }

  // What the bar may hold here: the pages, Scenes, the menu and each room.
  get _navChoices() {
    const music = Boolean(this.config?.music);
    const pages = NAV_PAGES.filter((key) => key !== (music ? "media" : "music"));
    const name = (key) => this._t({ scenes: "personal_scenes", menu: "menu" }[key] ?? `nav_${key}`);
    return [
      ...pages.map((key) => ({ key, name: name(key) })),
      ...(this.sheet.rooms ?? []).map((room) => ({ key: `room:${room.id}`, name: room.name })),
    ];
  }

  get _navItems() {
    const music = Boolean(this.config?.music);
    return this._look.nav.items ?? ["home", music ? "music" : "media", "energy", "map"];
  }

  _setNavItems(items) {
    this._setLookGroup("nav", { items });
  }

  _renderLookNav() {
    const { nav } = this._look;
    const items = this._navItems;
    const choices = this._navChoices;
    const name = (key) => choices.find((choice) => choice.key === key)?.name ?? key;
    const [low, high] = NAV_RANGE;
    const move = (index, delta) => {
      const next = [...items];
      const [moved] = next.splice(index, 1);
      next.splice(index + delta, 0, moved);
      this._setNavItems(next);
    };
    return html`
      <p class="hint">${this._t("look_nav_items_hint", { low, high })}</p>
      ${items.map(
        (key, index) => html`
          <div class="order-row" data-nav-item=${key}>
            <span>${name(key)}</span>
            <button aria-label=${this._t("personal_remove")} data-nav-remove ?disabled=${items.length <= low}
              @click=${() => this._setNavItems(items.filter((item) => item !== key))}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
            <button aria-label=${this._t("personal_up")} data-nav-up ?disabled=${index === 0} @click=${() => move(index, -1)}>
              <ha-icon icon="mdi:arrow-up"></ha-icon>
            </button>
            <button aria-label=${this._t("personal_down")} data-nav-down ?disabled=${index === items.length - 1} @click=${() => move(index, 1)}>
              <ha-icon icon="mdi:arrow-down"></ha-icon>
            </button>
          </div>
        `,
      )}
      ${items.length < high
        ? html`<label class="field" data-nav-add>
            <span>${this._t("look_nav_add")}</span>
            <select @change=${(event) => event.target.value && this._setNavItems([...items, event.target.value])}>
              <option value="">—</option>
              ${choices.filter((choice) => !items.includes(choice.key)).map((choice) => html`<option value=${choice.key}>${choice.name}</option>`)}
            </select>
          </label>`
        : nothing}
      <p class="hint">${this._t("look_nav_style_hint")}</p>
      ${this._renderBackgroundChoices(
        "nav-style",
        NAV_STYLES.map((style) => [style, this._t(`look_nav_${style}`)]),
        nav.style,
        (style) => this._setLookGroup("nav", { style }),
      )}
      ${this._renderColourField("nav", "background")} ${this._renderColourField("nav", "icon")}
      ${this._renderColourField("nav", "active")}
      ${this._renderSlider("nav-opacity", this._t("look_opacity_short"), nav.opacity, [20, 100], "%", (value) =>
        this._setLookGroup("nav", { opacity: value }),
      )}
      ${this._renderSlider("nav-blur", this._t("look_nav_blur"), nav.blur, [0, 30], " px", (value) =>
        this._setLookGroup("nav", { blur: value }),
      )}
      <p class="hint">${this._t("look_nav_blur_hint")}</p>
      ${this._renderLookStatus()} ${this._renderLookPlayer()}
    `;
  }

  _renderLookSheets() {
    const { sheets } = this._look;
    const set = (change) => this._setLookGroup("sheets", change);
    return html`
      <p class="hint">${this._t("look_sheets_hint")}</p>
      ${this._renderColourField("sheets", "background")} ${this._renderColourField("sheets", "text")}
      ${this._renderColourField("sheets", "controls")} ${this._renderColourField("sheets", "cards")}
      <p class="hint">${this._t("look_sheets_cards_hint")}</p>
      ${this._renderSlider("sheet-opacity", this._t("look_opacity_short"), sheets.opacity, [20, 100], "%", (value) => set({ opacity: value }))}
      ${this._renderSlider("sheet-blur", this._t("look_nav_blur"), sheets.blur, [0, 40], " px", (value) => set({ blur: value }))}
      ${this._renderSlider("sheet-scrim", this._t("look_sheets_scrim"), sheets.scrim, [0, 80], "%", (value) => set({ scrim: value }))}
      <p class="hint">${this._t("look_sheets_scrim_hint")}</p>
    `;
  }

  // The status bar of a tablet: on or off, its parts in order and its colours.
  _renderLookStatus() {
    const { status } = this._look;
    const set = (change) => this._setLookGroup("status", change);
    const parts = status.widgets ?? STATUS_PARTS;
    const setParts = (widgets) => set({ widgets });
    const move = (index, delta) => {
      const next = [...parts];
      const [moved] = next.splice(index, 1);
      next.splice(index + delta, 0, moved);
      setParts(next);
    };
    const name = (key) => this._t(`status_part_${key}`);
    return html`
      <h3 class="look-group">${this._t("look_status_title")}</h3>
      <label class="field" data-look-status-shown>
        <span>${this._t("look_status_shown")}</span>
        <input type="checkbox" .checked=${status.shown} @change=${(event) => set({ shown: event.target.checked })} />
      </label>
      <p class="hint">${this._t("look_status_hint")}</p>
      ${status.shown
        ? html`
            <p class="hint">${this._t("look_status_widgets_hint")}</p>
            ${parts.map(
              (key, index) => html`
                <div class="order-row" data-status-part=${key}>
                  <span>${name(key)}</span>
                  <button aria-label=${this._t("personal_remove")} data-status-part-remove ?disabled=${parts.length <= 1}
                    @click=${() => setParts(parts.filter((part) => part !== key))}>
                    <ha-icon icon="mdi:close"></ha-icon>
                  </button>
                  <button aria-label=${this._t("personal_up")} data-status-part-up ?disabled=${index === 0} @click=${() => move(index, -1)}>
                    <ha-icon icon="mdi:arrow-up"></ha-icon>
                  </button>
                  <button aria-label=${this._t("personal_down")} data-status-part-down ?disabled=${index === parts.length - 1}
                    @click=${() => move(index, 1)}>
                    <ha-icon icon="mdi:arrow-down"></ha-icon>
                  </button>
                </div>
              `,
            )}
            ${parts.length < STATUS_PARTS.length
              ? html`<label class="field" data-status-part-add>
                  <span>${this._t("look_status_add")}</span>
                  <select @change=${(event) => event.target.value && setParts([...parts, event.target.value])}>
                    <option value="">—</option>
                    ${STATUS_PARTS.filter((key) => !parts.includes(key)).map((key) => html`<option value=${key}>${name(key)}</option>`)}
                  </select>
                </label>`
              : nothing}
            <label class="field" data-look-status-colourful>
              <span>${this._t("look_status_colourful")}</span>
              <input type="checkbox" .checked=${status.colourful} @change=${(event) => set({ colourful: event.target.checked })} />
            </label>
            ${this._renderColourField("status", "background")} ${this._renderColourField("status", "text")}
            ${this._renderSlider("status-opacity", this._t("look_opacity_short"), status.opacity, [20, 100], "%", (value) =>
              set({ opacity: value }),
            )}
            ${this._renderSlider("status-blur", this._t("look_nav_blur"), status.blur, [0, 30], " px", (value) => set({ blur: value }))}
          `
        : nothing}
    `;
  }

  _renderLookPlayer() {
    const { player } = this._look;
    const set = (change) => this._setLookGroup("player", change);
    return html`
      <h3 class="look-group">${this._t("look_group_player")}</h3>
      ${this._renderSlider("player-paused", this._t("look_player_paused"), player.paused_minutes, [0, 120], " min", (value) =>
        set({ paused_minutes: value }),
      )}
      <p class="hint">${this._t("look_player_paused_hint")}</p>
      ${this._renderColourField("player", "background")} ${this._renderColourField("player", "text")}
      ${this._renderSlider("player-opacity", this._t("look_opacity_short"), player.opacity, [20, 100], "%", (value) => set({ opacity: value }))}
      ${this._renderSlider("player-blur", this._t("look_nav_blur"), player.blur, [0, 30], " px", (value) => set({ blur: value }))}
      ${this._renderSlider("player-radius", this._t("look_radius"), player.radius, [0, 32], " px", (value) => set({ radius: value }))}
    `;
  }

  _renderLookTiles() {
    const { tiles } = this._look;
    return html`
      ${this._renderLookPreview()}
      ${this._renderSlider("opacity", this._t("look_opacity"), tiles.opacity, [20, 100], "%", (value) => this._setLookTiles({ opacity: value }))}
      ${this._renderSlider("radius", this._t("look_radius"), tiles.radius, TILE_RADIUS_RANGE, " px", (value) => this._setLookTiles({ radius: value }))}
      <p class="hint">${this._t("look_fill_hint")}</p>
      ${this._renderBackgroundChoices(
        "look-fill",
        TILE_FILLS.map((fill) => [fill, this._t(`look_fill_${fill}`)]),
        tiles.fill,
        (fill) => this._setLookTiles({ fill }),
      )}
      <p class="hint">${this._t("look_colours_hint")}</p>
      ${TILE_KINDS.map((kind) => {
        const colour = tiles.colours[kind];
        return html`
          <div class="field look-colour" data-look-colour=${kind}>
            <span>${this._t(`look_kind_${kind}`)}</span>
            ${this._renderSwatch(colour, {
              pick: (value) => this._setKindColour(kind, value),
              clear: () => this._setKindColour(kind, null),
              clearData: "data-look-colour-clear",
            })}
          </div>
        `;
      })}
    `;
  }

  _renderLookIcons() {
    const { icons } = this._look;
    const query = (this._query ?? "").trim().toLowerCase();
    const matches = query
      ? Object.keys(this.hass.states)
          .filter((id) => !(id in icons))
          .filter((id) => id.includes(query) || (this.hass.states[id].attributes.friendly_name ?? "").toLowerCase().includes(query))
          .slice(0, 12)
      : [];
    const name = (id) => this.hass.states[id]?.attributes.friendly_name ?? id;
    const iconOf = (id) => (this.hass.states[id] ? entityIcon(this.hass, id, this.config) : "mdi:help-circle-outline");
    if (this._lookEntity) {
      const id = this._lookEntity;
      return html`
        <button class="row off" data-look-icon-back @click=${() => (this._lookEntity = null)}>
          <span class="row-icon"><ha-icon .icon=${icons[id] ?? iconOf(id)}></ha-icon></span>
          <span class="row-text"><strong>${name(id)}</strong><small>${id}</small></span>
        </button>
        <input
          class="search"
          type="search"
          placeholder=${this._t("look_icon_search")}
          data-look-icon-search
          @input=${(event) => this._searchIcons(event.target.value)}
        />
        <div class="icon-grid" data-look-icon-results>
          ${this._lookIcons.map(
            (icon) => html`
              <button
                class="choice ${icons[id] === icon ? "on" : ""}"
                aria-label=${icon}
                title=${icon}
                data-look-icon=${icon}
                @click=${() => {
                  this._setIcon(id, icon);
                  this._lookEntity = null;
                }}
              >
                <ha-icon .icon=${icon}></ha-icon>
              </button>
            `,
          )}
        </div>
        ${icons[id]
          ? html`<button class="row off" data-look-icon-clear @click=${() => {
              this._setIcon(id, null);
              this._lookEntity = null;
            }}>
              <span class="row-icon"><ha-icon icon="mdi:restore"></ha-icon></span>
              <span class="row-text"><strong>${this._t("look_icon_default")}</strong></span>
            </button>`
          : nothing}
      `;
    }
    return html`
      <p class="hint">${this._t("look_icons_hint")}</p>
      <input
        class="search"
        type="search"
        placeholder=${this._t("look_entity_search")}
        data-look-entity-search
        .value=${this._query ?? ""}
        @input=${(event) => (this._query = event.target.value)}
      />
      ${matches.map(
        (id) => html`
          <button class="row off" data-look-entity=${id} @click=${() => this._pickLookEntity(id)}>
            <span class="row-icon"><ha-icon .icon=${iconOf(id)}></ha-icon></span>
            <span class="row-text"><strong>${name(id)}</strong><small>${id}</small></span>
          </button>
        `,
      )}
      ${Object.entries(icons).map(
        ([id, icon]) => html`
          <div class="order-row" data-look-own-icon=${id}>
            <ha-icon .icon=${icon}></ha-icon>
            <span>${name(id)}</span>
            <button aria-label=${this._t("look_icon_change")} data-look-icon-edit @click=${() => this._pickLookEntity(id)}>
              <ha-icon icon="mdi:pencil"></ha-icon>
            </button>
            <button aria-label=${this._t("look_icon_default")} data-look-icon-remove @click=${() => this._setIcon(id, null)}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
        `,
      )}
    `;
  }

  _pickLookEntity(id) {
    this._lookEntity = id;
    this._lookIcons = [];
    this._query = "";
  }

  _renderLook() {
    if (this._theme) return this._renderThemeImport();
    const admin = Boolean(this.hass.user?.is_admin);
    const tabs = {
      background: this._renderLookBackground,
      tiles: this._renderLookTiles,
      colours: this._renderLookColours,
      nav: this._renderLookNav,
      sheets: this._renderLookSheets,
      icons: this._renderLookIcons,
    };
    if (this._lookEveryone) tabs.themes = this._renderLookThemes;
    const tab = tabs[this._tab] ? this._tab : "background";
    return html`
      ${this._renderHeader(this._t("look_title"), false, false)}
      <div class="rows">
        ${this._renderTabs([
          ["background", this._t("look_tab_background")],
          ["tiles", this._t("look_tab_tiles")],
          ["colours", this._t("look_tab_colours")],
          ["nav", this._t("look_tab_nav")],
          ["sheets", this._t("look_tab_sheets")],
          ["icons", this._t("look_tab_icons")],
          ...(this._lookEveryone ? [["themes", this._t("look_tab_themes")]] : []),
        ])}
        ${admin
          ? html`<label class="field" data-look-everyone>
              <span>${this._t("layout_everyone")}</span>
              <input type="checkbox" .checked=${this._lookEveryone} @change=${(event) => this._startLook(event.target.checked)} />
            </label>`
          : nothing}
        <p class="hint">${this._t(this._lookEveryone ? "look_everyone_hint" : "look_mine_hint")}</p>
        ${tabs[tab].call(this)}
        ${tab === "themes"
          ? nothing
          : html`${!this._lookEveryone && personalPrefs().appearance
          ? html`<button class="row off" data-look-reset @click=${this._resetOwnLook}>
              <span class="row-icon"><ha-icon icon="mdi:restore"></ha-icon></span>
              <span class="row-text"><strong>${this._t("look_reset")}</strong></span>
            </button>`
          : nothing}
        <button class="block-action on" data-look-save @click=${this._saveLook}>
          <span>${this._t(this._lookEveryone ? "layout_save_everyone" : "save")}</span>
        </button>`}
      </div>
    `;
  }

  // Theme ---------------------------------------------------------------------------------------

  get _themeTargets() {
    return [
      { id: "home", name: this._t("home_page") },
      { id: "scenes", name: this._t("personal_scenes") },
      ...(this.sheet.rooms ?? []).map((room) => ({ id: room.id, name: room.name })),
    ];
  }

  async _readPicture(url) {
    try {
      const response = url.startsWith("/api/") ? await this.hass.fetchWithAuth(url) : await fetch(url);
      return response.ok ? await response.blob() : null;
    } catch {
      return null;
    }
  }

  // Exports the shared look as it is now, or a theme of the library.
  async _exportTheme(theme = null) {
    this._themeBusy = true;
    const names = Object.fromEntries(this._themeTargets.map((target) => [target.id, target.name]));
    const source = theme ?? { appearance: this.raw?.appearance ?? {}, backgrounds: this.raw?.backgrounds ?? {} };
    const name = theme?.name ?? (this._themeName.trim() || activeTheme(this.raw)?.name || "Home Dashboard");
    const file = await buildTheme(source, names, (url) => this._readPicture(url), name);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
    link.download = `${themeId(name).replace(/_[a-z0-9]+$/, "")}.home-dashboard-theme.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
    this._themeBusy = false;
  }

  async _readTheme(event) {
    const input = event.target;
    const [file] = input.files;
    if (!file) return;
    const theme = parseTheme(await file.text());
    // The same file can be chosen again after a change.
    input.value = "";
    this._themeProblem = !theme;
    if (!theme) return;
    this._theme = theme;
    this._themeName = theme.name || file.name.replace(/(\.home-dashboard-theme)?\.json$/, "");
    this._themeChoices = suggestTargets(theme, this._themeTargets);
  }

  async _uploadPicture(blob, name) {
    const body = new FormData();
    body.append("file", blob, `${name}.${blob.type.split("/")[1] ?? "jpg"}`);
    const response = await this.hass.fetchWithAuth("/api/image/upload", { method: "POST", body });
    if (!response.ok) throw new Error(String(response.status));
    const { id } = await response.json();
    return `/api/image/serve/${id}/original`;
  }

  get _unsavedName() {
    return this._t("theme_unsaved", { date: new Date().toLocaleDateString(this.hass.language) });
  }

  _saveDashboard(dashboard) {
    this.dispatchEvent(new CustomEvent("sheet-theme", { detail: { dashboard } }));
  }

  // An imported theme joins the library and is used at once.
  async _importTheme() {
    this._themeBusy = true;
    this._themeProblem = false;
    try {
      const entry = await materializeTheme(
        this._theme,
        this._themeName.trim() || this._t("theme_imported"),
        this._themeChoices,
        (blob, name) => this._uploadPicture(blob, name),
        (entityId) => entityId in this.hass.states,
      );
      this._saveDashboard(useTheme(addTheme(this.raw, entry), entry, this._unsavedName));
    } catch {
      this._themeProblem = true;
    }
    this._themeBusy = false;
  }

  _saveCurrentTheme() {
    const name = this._themeName.trim();
    if (!name) return;
    const entry = currentAsTheme(this.raw, name);
    this._saveDashboard({ ...addTheme(this.raw, entry), theme: entry.id });
  }

  _renderLookThemes() {
    const library = themeLibrary(this.raw);
    const active = activeTheme(this.raw);
    const button = (key, icon, data, onTap) => html`
      <button aria-label=${this._t(key)} title=${this._t(key)} data-theme-action=${data} ?disabled=${this._themeBusy} @click=${onTap}>
        <ha-icon .icon=${icon}></ha-icon>
      </button>
    `;
    return html`
      <p class="hint">${this._t("theme_hint")}</p>
      ${active
        ? html`<p class="hint" data-theme-active>
            ${this._t(themeChanged(this.raw) ? "theme_active_changed" : "theme_active", { name: active.name })}
          </p>`
        : nothing}
      ${active && themeChanged(this.raw)
        ? html`<button class="row off" data-theme-update @click=${() => this._saveDashboard(saveIntoTheme(this.raw, active))}>
            <span class="row-icon"><ha-icon icon="mdi:content-save-edit-outline"></ha-icon></span>
            <span class="row-text"><strong>${this._t("theme_update", { name: active.name })}</strong></span>
          </button>`
        : nothing}
      ${active && themeChanged(this.raw)
        ? html`<button class="row off" data-theme-reset @click=${() => this._saveDashboard(useTheme(this.raw, active, this._unsavedName))}>
            <span class="row-icon"><ha-icon icon="mdi:restore"></ha-icon></span>
            <span class="row-text"><strong>${this._t("theme_reset", { name: active.name })}</strong></span>
          </button>`
        : nothing}
      ${library.map(
        (theme) => html`
          <div class="order-row" data-theme=${theme.id}>
            <ha-icon .icon=${theme.id === active?.id ? "mdi:check-circle" : "mdi:palette-swatch-outline"}></ha-icon>
            <span class="row-text">
              <strong>${theme.name}</strong>
              ${theme.builtin ? html`<small>${this._t(theme.own ? "theme_builtin_own" : "theme_builtin")}</small>` : nothing}
            </span>
            ${button("theme_use", "mdi:play-circle-outline", "use", () => this._saveDashboard(useTheme(this.raw, theme, this._unsavedName)))}
            ${button("theme_export", "mdi:export-variant", "export", () => this._exportTheme(theme))}
            ${!theme.builtin
              ? button("theme_delete", "mdi:delete-outline", "delete", () => this._saveDashboard(removeTheme(this.raw, theme.id)))
              : theme.own
                ? button("theme_restore", "mdi:restore", "restore", () => this._saveDashboard(removeTheme(this.raw, theme.id)))
                : nothing}
          </div>
        `,
      )}
      <button class="row off" data-theme-plain @click=${() => this._saveDashboard(useTheme(this.raw, null, this._unsavedName))}>
        <span class="row-icon"><ha-icon icon="mdi:palette-outline"></ha-icon></span>
        <span class="row-text"><strong>${this._t("theme_plain")}</strong><small>${this._t("theme_plain_hint")}</small></span>
      </button>
      <label class="field">
        <span>${this._t("theme_name")}</span>
        <input type="text" data-theme-name .value=${this._themeName} @input=${(event) => (this._themeName = event.target.value)} />
      </label>
      <button class="row off" data-theme-save-current ?disabled=${!this._themeName.trim()} @click=${this._saveCurrentTheme}>
        <span class="row-icon"><ha-icon icon="mdi:content-save-outline"></ha-icon></span>
        <span class="row-text"><strong>${this._t("theme_save_current")}</strong></span>
      </button>
      <button class="row off" data-theme-export ?disabled=${this._themeBusy} @click=${() => this._exportTheme()}>
        <span class="row-icon"><ha-icon icon="mdi:export-variant"></ha-icon></span>
        <span class="row-text"><strong>${this._t("theme_export_current")}</strong></span>
      </button>
      <label class="row off" data-theme-import>
        <span class="row-icon"><ha-icon icon="mdi:import"></ha-icon></span>
        <span class="row-text"><strong>${this._t("theme_import")}</strong></span>
        <input type="file" accept="application/json,.json" hidden @change=${this._readTheme} />
      </label>
      ${this._themeProblem ? html`<p class="hint" data-theme-problem>${this._t("theme_problem")}</p>` : nothing}
    `;
  }

  _renderThemeImport() {
    const theme = this._theme;
    const icons = Object.keys(theme.appearance.icons ?? {});
    const matching = Object.keys(importableIcons(theme.appearance, (entityId) => entityId in this.hass.states));
    const targets = this._themeTargets;
    return html`
      ${this._renderHeader(this._t("theme_import"), false, false)}
      <div class="rows">
        <p class="hint">${this._t("theme_import_hint")}</p>
        <label class="field">
          <span>${this._t("theme_name")}</span>
          <input type="text" data-theme-name .value=${this._themeName} @input=${(event) => (this._themeName = event.target.value)} />
        </label>
        ${icons.length ? html`<p class="hint" data-theme-icons>${this._t("theme_icons", { count: matching.length, total: icons.length })}</p>` : nothing}
        ${Object.entries(theme.backgrounds).map(([key, entry]) => {
          const shown = entry.light ?? entry.dark ?? entry.light_wide ?? entry.dark_wide;
          return html`
            <div class="field theme-background" data-theme-background=${key}>
              <span class="theme-thumb" style=${backgroundStyle(shown, "top")}></span>
              <span>${entry.name}</span>
              <select @change=${(event) => (this._themeChoices = { ...this._themeChoices, [key]: event.target.value || null })}>
                <option value="" ?selected=${!this._themeChoices[key]}>${this._t("theme_skip")}</option>
                ${targets.map(
                  (target) => html`<option value=${target.id} ?selected=${this._themeChoices[key] === target.id}>${target.name}</option>`,
                )}
              </select>
            </div>
          `;
        })}
        ${this._themeProblem ? html`<p class="hint" data-theme-problem>${this._t("theme_upload_problem")}</p>` : nothing}
        <button class="row off" data-theme-cancel @click=${() => (this._theme = null)}>
          <span class="row-icon"><ha-icon icon="mdi:arrow-left"></ha-icon></span>
          <span class="row-text"><strong>${this._t("theme_back")}</strong></span>
        </button>
        <button class="block-action on" data-theme-save ?disabled=${this._themeBusy} @click=${this._importTheme}>
          <span>${this._t("layout_save_everyone")}</span>
        </button>
      </div>
    `;
  }

  _renderPage() {
    const { item } = this.sheet;
    if (!this._embedded) {
      this._embedded = document.createElement("home-dashboard-page");
      this._embedded.setConfig({ page: item.page, dashboard: this.raw, embedded: true });
    }
    this._embedded.hass = this.hass;
    return html`${this._renderHeader(item.name, false, false)}${this._embedded}`;
  }

  _renderHost() {
    return html`
      ${this._renderHeader(this.sheet.item.name, false, false)}
      <home-dashboard-host .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-host>
    `;
  }

  _renderSchool() {
    return html`
      ${this._renderHeader(this.sheet.item.name, false, false)}
      <home-dashboard-school .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-school>
    `;
  }

  _renderWeather() {
    return html`
      ${this._renderHeader(this.sheet.item.label, false, false)}
      <home-dashboard-weather .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-weather>
    `;
  }

  _renderDepartures() {
    return html`
      ${this._renderHeader(this.sheet.item.name, false, false)}
      <home-dashboard-departures .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-departures>
    `;
  }

  _renderApp() {
    return html`
      ${this._renderHeader(this.sheet.item.name, false, false)}
      <home-dashboard-app .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-app>
    `;
  }

  _renderHistory() {
    return html`
      ${this._renderHeader(this._t("history"), false, false)}
      <home-dashboard-history .hass=${this.hass} .config=${this.config}></home-dashboard-history>
    `;
  }

  _renderLogbook() {
    return html`
      ${this._renderHeader(this._t("logbook"), false, false)}
      <home-dashboard-logbook .hass=${this.hass} .config=${this.config}></home-dashboard-logbook>
    `;
  }

  _renderNews() {
    return html`
      ${this._renderHeader(this.sheet.item.name, false, false)}
      <home-dashboard-news .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-news>
    `;
  }

  _renderNotifications() {
    return html`
      ${this._renderHeader(this._t("notifications_title"), false, false)}
      <home-dashboard-notifications .hass=${this.hass}></home-dashboard-notifications>
    `;
  }

  _renderOverview() {
    return html`
      ${this._renderHeader(this.sheet.item.name, false, false)}
      <home-dashboard-overview .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-overview>
    `;
  }

  _saveShortcuts(shortcuts, renamed) {
    this.dispatchEvent(new CustomEvent("sheet-shortcuts", { detail: { shortcuts, renamed } }));
  }

  _renderBlocks() {
    const shortcuts = this.raw?.shortcuts ?? [];
    const move = (index, delta) => {
      const next = [...shortcuts];
      const [moved] = next.splice(index, 1);
      next.splice(index + delta, 0, moved);
      this._saveShortcuts(next);
    };
    return html`
      ${this._renderHeader(this._t("block_title"), false, false)}
      <div class="rows">
        ${shortcuts.map(
          (item, index) => html`
            <div class="order-row" data-block=${item.name}>
              <span>${item.name}</span>
              <button aria-label=${this._t("block_edit")} data-block-edit @click=${() => this._change({ kind: "block-edit", item, index })}>
                <ha-icon icon="mdi:pencil-outline"></ha-icon>
              </button>
              <button aria-label=${this._t("personal_up")} ?disabled=${index === 0} @click=${() => move(index, -1)}>
                <ha-icon icon="mdi:arrow-up"></ha-icon>
              </button>
              <button aria-label=${this._t("personal_down")} ?disabled=${index === shortcuts.length - 1} @click=${() => move(index, 1)}>
                <ha-icon icon="mdi:arrow-down"></ha-icon>
              </button>
            </div>
          `,
        )}
        <button class="row off" data-block-media @click=${this._editMediaSections}>
          <span class="row-icon"><ha-icon icon="mdi:play-box-multiple-outline"></ha-icon></span>
          <span class="row-text"><strong>${this._t("block_kind_media")}</strong></span>
        </button>
        <h3>${this._t("block_add_title")}</h3>
        <div class="block-actions">
          ${Object.entries(NEW_BLOCK_ICONS).map(
            ([kind, icon]) => html`
              <button class="block-action" data-block-new=${kind} @click=${() => this._change({ kind: "block-edit", item: { kind, name: "", icon } })}>
                <ha-icon .icon=${icon}></ha-icon>
                <span>${this._t(`block_kind_${kind}`)}</span>
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }

  _editMediaSections() {
    const sections = this.raw?.media?.sections ?? [];
    const onSave = (item) => this.dispatchEvent(new CustomEvent("sheet-media", { detail: { sections: item.sections ?? [] } }));
    this._change({ kind: "block-edit", item: { kind: "media", sections }, onSave });
  }

  _blockSaved(item) {
    const { onSave, index, item: before } = this.sheet;
    if (onSave) {
      onSave(item);
      this._close();
      return;
    }
    const shortcuts = [...(this.raw?.shortcuts ?? [])];
    if (index === undefined) shortcuts.push(item);
    else shortcuts[index] = item;
    const renamed = before.name && before.name !== item.name ? { from: before.name, to: item.name } : null;
    this._saveShortcuts(shortcuts, renamed);
  }

  _blockRemoved() {
    this._saveShortcuts((this.raw?.shortcuts ?? []).filter((_, position) => position !== this.sheet.index));
  }

  _renderBlockEdit() {
    const { item, index } = this.sheet;
    return html`
      ${this._renderHeader(item.name || this._t(`block_kind_${item.kind}`), false, false)}
      <home-dashboard-block-editor
        .hass=${this.hass}
        .item=${item}
        .shortcuts=${(this.raw?.shortcuts ?? []).map(({ name }) => name)}
        .users=${this._users}
        ?removable=${index !== undefined}
        @block-save=${(event) => this._blockSaved(event.detail.item)}
        @block-remove=${this._blockRemoved}
      ></home-dashboard-block-editor>
    `;
  }

  // Layout editor ---------------------------------------------------------------------------

  _pickTile(entityId) {
    this.sheet.onPick(entityId);
    this._close();
  }

  _renderTilePicker() {
    const { room, tab, domains } = this.sheet;
    const tiles = tileCandidates(this.hass, this.sheet.config ?? this.config, room, tab, this._query ?? "", domains);
    return html`
      ${this._renderHeader(this._t("edit_add_tile"), false, false)}
      <div class="rows">
        <input
          class="search"
          type="search"
          data-pick-search
          placeholder=${this._t("search")}
          @input=${(event) => {
            this._query = event.target.value;
          }}
        />
        ${tiles.map(
          (tile) => html`
            <button class="row off" data-pick=${tile.entityId} @click=${() => this._pickTile(tile.entityId)}>
              <span class="row-icon"><ha-icon .icon=${tile.icon}></ha-icon></span>
              <span class="row-text"><strong>${tile.name}</strong><small>${tile.entityId}</small></span>
            </button>
          `,
        )}
        ${tiles.length ? nothing : html`<p class="hint">${this._t("edit_no_tiles")}</p>`}
      </div>
    `;
  }

  _startRule() {
    const { only = [], except = [] } = this.sheet.rule ?? {};
    const mode = only.length ? "only" : except.length ? "except" : "everyone";
    this._rule = { mode, users: only.length ? only : except };
  }

  get _ruleResult() {
    const { mode, users } = this._rule;
    return { only: mode === "only" ? users : [], except: mode === "except" ? users : [] };
  }

  _toggleRuleUser(id) {
    const { users } = this._rule;
    this._rule = { ...this._rule, users: users.includes(id) ? users.filter((user) => user !== id) : [...users, id] };
  }

  _renderRule() {
    const { mode, users } = this._rule;
    const modes = [
      ["everyone", "who_everyone"],
      ["only", "who_only"],
      ["except", "who_except"],
    ];
    return html`
      <div class="choice-field" data-rule>
        <h3>${this._t("who_sees")}</h3>
        <div class="choices sheet-tabs">
          ${modes.map(
            ([key, label]) => html`
              <button
                class="choice ${mode === key ? `on ${key}` : ""}"
                data-rule-mode=${key}
                @click=${() => (this._rule = { ...this._rule, mode: key })}
              >
                <span>${this._t(label)}</span>
              </button>
            `,
          )}
        </div>
        ${mode === "everyone"
          ? nothing
          : html`<div class="choices rule-users">
              ${(this._users ?? []).map(
                (user) => html`
                  <button
                    class="choice ${users.includes(user.id) ? `on ${mode}` : ""}"
                    data-rule-user=${user.id}
                    @click=${() => this._toggleRuleUser(user.id)}
                  >
                    <span>${user.name}</span>
                  </button>
                `,
              )}
            </div>`}
      </div>
    `;
  }

  _renderTileEdit() {
    const { item, onRename, onRemove, onRule, onResize } = this.sheet;
    const size = this._tileSize ?? item.size ?? "flat";
    const save = () => {
      onRename(this.renderRoot.querySelector("[data-tile-name]").value);
      if (onResize && size !== (item.size ?? "flat")) onResize(size);
      this._tileSize = undefined;
      onRule?.(this._ruleResult);
      this._close();
    };
    const remove = () => {
      onRemove();
      this._close();
    };
    return html`
      ${this._renderHeader(item.name ?? item.entity ?? "", false, false)}
      <div class="rows">
        <input class="search" data-tile-name placeholder=${this._t("edit_tile_name")} .value=${item.name ?? ""} />
        <p class="hint">${item.entity ?? ""}</p>
        ${onResize && item.kind !== "panel"
          ? html`<h3 class="look-group">${this._t("tile_size")}</h3>
              <div class="choices" data-tile-size>
                ${["flat", "tall"].map(
                  (key) => html`<button
                    class="choice ${size === key ? "on" : ""}"
                    data-choice=${key}
                    @click=${() => (this._tileSize = key)}
                  >
                    <ha-icon icon=${key === "tall" ? "mdi:rectangle-outline" : "mdi:minus-box-outline"}></ha-icon>
                    <span>${this._t(`tile_size_${key}`)}</span>
                  </button>`,
                )}
              </div>`
          : nothing}
        ${onRule ? this._renderRule() : nothing}
        <button class="row off" data-tile-save @click=${save}>
          <span class="row-icon"><ha-icon icon="mdi:check"></ha-icon></span>
          <span class="row-text"><strong>${this._t("save")}</strong></span>
        </button>
        ${this.sheet.onBlock && item.kind === "panel"
          ? html`
              <button
                class="row off"
                data-tile-block
                @click=${() => this._change({ kind: "block-edit", item, onSave: this.sheet.onBlock })}
              >
                <span class="row-icon"><ha-icon icon="mdi:pencil-outline"></ha-icon></span>
                <span class="row-text"><strong>${this._t("block_edit")}</strong></span>
              </button>
            `
          : nothing}
        <button class="row off" data-tile-remove @click=${remove}>
          <span class="row-icon"><ha-icon icon="mdi:delete-outline"></ha-icon></span>
          <span class="row-text"><strong>${this._t("edit_remove_tile")}</strong></span>
        </button>
      </div>
    `;
  }

  // Block of several entities ---------------------------------------------------------------

  _press(entityId) {
    const { domain, service, data } = pressCall(entityId);
    this.hass.callService(domain, service, data);
  }

  _runBlockAction(action) {
    if (action.service) runAction(this.hass, { service: action.service, target: action.entity });
    else this._press(action.entity);
  }

  _tapAction(action) {
    if (action.confirm) this._pending = action;
    else this._runBlockAction(action);
  }

  _confirmAction() {
    this._runBlockAction(this._pending);
    this._pending = null;
  }

  _renderFrame(item) {
    const blocked = window.location.protocol === "https:" && item.frame.startsWith("http:");
    if (blocked) return html`<p class="hint" data-frame-blocked>${this._t("panel_frame_blocked")}</p>`;
    return html`<iframe class="frame" src=${item.frame} title=${item.name}></iframe>`;
  }

  _renderActions(actions = []) {
    const shown = actions.filter((action) => this.hass.states[action.entity]);
    if (!shown.length) return nothing;
    return html`
      <div class="block-actions">
        ${shown.map(
          (action) => html`
            <button
              class="block-action"
              data-action=${action.entity}
              ?disabled=${this.hass.states[action.entity].state === "unavailable"}
              @click=${() => this._tapAction(action)}
            >
              <ha-icon .icon=${action.icon ?? "mdi:gesture-tap-button"}></ha-icon>
              <span>${action.name}</span>
            </button>
          `,
        )}
      </div>
      ${this._pending
        ? html`
            <div class="confirm" data-confirm>
              <span>${this._pending.confirm}</span>
              <button data-confirm-no @click=${() => (this._pending = null)}>${this._t("confirm_no")}</button>
              <button class="yes" data-confirm-yes @click=${this._confirmAction}>${this._t("confirm_yes")}</button>
            </div>
          `
        : nothing}
    `;
  }

  _renderRowControl(row, stateObj) {
    const { entity } = row;
    const control = rowControl(entity);
    const unavailable = stateObj.state === "unavailable";
    if (control === "select") {
      return html`
        <select
          data-select=${entity}
          ?disabled=${unavailable}
          @change=${(event) => this._selectOption(entity, event.target.value)}
        >
          ${(stateObj.attributes.options ?? []).map(
            (option) => html`
              <option value=${option} ?selected=${option === stateObj.state}>${row.labels?.[option] ?? option}</option>
            `,
          )}
        </select>
      `;
    }
    if (control === "range") {
      const { min = 0, max = 100, step = 1 } = stateObj.attributes;
      return html`
        <input
          type="range"
          data-range=${entity}
          min=${min}
          max=${max}
          step=${step}
          .value=${stateObj.state}
          ?disabled=${unavailable}
          @change=${(event) => this._setNumber(entity, Number(event.target.value))}
        />
      `;
    }
    if (control === "toggle") {
      return html`
        <button
          class="switch ${stateObj.state === "on" ? "on" : ""}"
          role="switch"
          aria-checked=${stateObj.state === "on"}
          aria-label=${row.name ?? stateObj.attributes.friendly_name}
          data-toggle=${entity}
          ?disabled=${unavailable}
          @click=${() => this.hass.callService("homeassistant", "toggle", { entity_id: entity })}
        ></button>
      `;
    }
    if (control === "press") {
      return html`
        <button class="press" data-press=${entity} ?disabled=${unavailable} @click=${() => this._press(entity)}>
          <ha-icon icon="mdi:play"></ha-icon>
        </button>
      `;
    }
    return html`<small data-value=${entity}>${panelValue(this.hass, row)}</small>`;
  }

  _selectOption(entityId, option) {
    const domain = entityId.split(".")[0];
    this.hass.callService(domain, "select_option", { entity_id: entityId, option });
  }

  _setNumber(entityId, value) {
    const domain = entityId.split(".")[0];
    this.hass.callService(domain, "set_value", { entity_id: entityId, value });
  }

  // A group of controls shows what each one does instead of a list of equal rows.
  _renderControls(rows) {
    const shown = rows
      .map((row) => ({ row, stateObj: this.hass.states[row.entity], control: rowControl(row.entity) }))
      .filter(({ stateObj }) => stateObj);
    const of = (kind) => shown.filter(({ control }) => control === kind);
    return html`
      <div class="big-toggles">${of("toggle").map(({ row, stateObj }) => this._renderBigToggle(row, stateObj))}</div>
      ${of("select").map(({ row, stateObj }) => this._renderChoices(row, stateObj))}
      ${of("range").map(({ row, stateObj }) => this._renderRange(row, stateObj))}
      ${this._renderFacts(of("read").map(({ row }) => row))}
    `;
  }

  _isAlert(row) {
    const stateObj = this.hass.states[row.entity];
    return stateObj?.state === "on" && TV_ALERT_CLASSES.has(stateObj.attributes.device_class);
  }

  _renderFacts(rows) {
    const shown = rows.filter((row) => this.hass.states[row.entity]);
    if (!shown.length) return nothing;
    const name = (row) =>
      row.name ??
      blockRowName(this.hass.states[row.entity].attributes.friendly_name ?? row.entity, this.sheet.item.name);
    return html`
      <div class="facts">
        ${shown.map(
          (row) => html`
            <button
              class="fact ${this._isAlert(row) ? "alert" : ""}"
              data-value=${row.entity}
              @click=${() => this.dispatchEvent(new CustomEvent("sheet-details", { detail: { entityId: row.entity } }))}
            >
              <ha-icon .icon=${row.icon ?? entityIcon(this.hass, row.entity, this.config)}></ha-icon>
              <span><small>${name(row)}</small><b>${panelValue(this.hass, row)}</b></span>
            </button>
          `,
        )}
      </div>
    `;
  }

  // Many things that are normally fine read as one line, and open by themselves when one is not.
  _renderSummary(group) {
    const alerts = group.rows.filter((row) => this._isAlert(row)).length;
    return html`
      <details class="summary" ?open=${alerts > 0} data-summary=${group.title}>
        <summary>
          <strong>${group.title}</strong>
          <small class=${alerts ? "alert" : ""}>
            ${alerts ? this._t("group_alert", { count: alerts }) : this._t("group_ok")}
          </small>
          <ha-icon icon="mdi:chevron-down"></ha-icon>
        </summary>
        ${this._renderFacts(group.rows)}
      </details>
    `;
  }

  _renderBigToggle(row, stateObj) {
    const on = stateObj.state === "on";
    return html`
      <button
        class="big-toggle ${on ? "on" : ""}"
        role="switch"
        aria-checked=${on}
        data-toggle=${row.entity}
        ?disabled=${stateObj.state === "unavailable"}
        @click=${() => this.hass.callService("homeassistant", "toggle", { entity_id: row.entity })}
      >
        <ha-icon .icon=${row.icon ?? "mdi:power"}></ha-icon>
        <strong>${row.name}</strong>
        <small>${this.hass.formatEntityState?.(stateObj) ?? stateObj.state}</small>
      </button>
    `;
  }

  _renderChoices(row, stateObj) {
    const options = stateObj.attributes.options ?? [];
    return html`
      <div class="choice-field" data-field=${row.entity}>
        <h3>${row.name}</h3>
        <div class="choices">
          ${options.map(
            (option) => html`
              <button
                class="choice ${option === stateObj.state ? "on" : ""}"
                data-choice=${option}
                ?disabled=${stateObj.state === "unavailable"}
                @click=${() => this._selectOption(row.entity, option)}
              >
                ${row.icons?.[option] ? html`<ha-icon .icon=${row.icons[option]}></ha-icon>` : nothing}
                <span>${row.labels?.[option] ?? option}</span>
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }

  _renderRange(row, stateObj) {
    return html`
      <div class="range-field" data-field=${row.entity}>
        <h3>${row.name}<span>${stateObj.state}</span></h3>
        ${this._renderRowControl(row, stateObj)}
      </div>
    `;
  }

  // The window of a device's settings: one tab at a time, so a device with many entities needs no long scroll.
  _renderSettingsTabs(item) {
    const tabs = [...item.groups.map((group) => [group.key, group.title]), ["activity", this._t("settings_activity")]];
    const group = item.groups.find((candidate) => candidate.key === this._tab);
    return html`
      ${this._renderHeader(item.name, false, true, () => this._showDetails(item.details))}
      <div class="rows" data-settings-tabs>
        ${this._renderTabs(tabs)}
        ${group?.connections
          ? html`<home-dashboard-connections .hass=${this.hass} .sensors=${group.connections}></home-dashboard-connections>`
          : group
          ? group.rows.map((row) => this._renderPanelRow(row))
          : html`<home-dashboard-logbook
              class="settings-activity"
              .hass=${this.hass}
              .config=${this.config}
              .entityIds=${item.activity}
            ></home-dashboard-logbook>`}
      </div>
    `;
  }

  _renderPanelRow(row) {
    const stateObj = this.hass.states[row.entity];
    if (!stateObj) return nothing;
    const name = row.name ?? blockRowName(stateObj.attributes.friendly_name ?? row.entity, this.sheet.item.name);
    const details = rowControl(row.entity) === "read";
    const openDetails = () => {
      this.dispatchEvent(new CustomEvent("sheet-details", { detail: { entityId: row.entity } }));
    };
    return html`
      <div class="field" data-field=${row.entity} @click=${details ? openDetails : nothing}>
        <span>${name}</span>
        ${this._renderRowControl(row, stateObj)}
      </div>
    `;
  }

  // A card that needs an administrator falls back to the plain page for everyone else.
  get _usesCard() {
    const { item } = this.sheet;
    return Boolean(item?.card) && (!item.admin_card || Boolean(this.hass.user?.is_admin));
  }

  // Name, area, labels and whether it is on: simple changes to a device without leaving the app ------------------

  async _loadEdit() {
    const entityId = this.sheet.entityId;
    const deviceId = this.hass.entities[entityId]?.device_id;
    try {
      const [labels, entry] = await Promise.all([
        this.hass.callWS({ type: "config/label_registry/list" }),
        deviceId ? null : this.hass.callWS({ type: "config/entity_registry/get", entity_id: entityId }),
      ]);
      const device = deviceId ? this.hass.devices[deviceId] : null;
      const source = device ?? entry;
      if (this.sheet?.entityId !== entityId) return;
      this._edit = {
        device: Boolean(device),
        id: device ? device.id : entityId,
        name: (device ? device.name_by_user : entry.name) ?? "",
        placeholder: device ? device.name : (entry.original_name ?? this.hass.states[entityId]?.attributes.friendly_name ?? ""),
        area: source.area_id ?? "",
        labels: [...(source.labels ?? [])],
        enabled: !source.disabled_by,
        wasEnabled: !source.disabled_by,
        allLabels: [...(labels ?? [])].sort((a, b) => a.name.localeCompare(b.name, this.hass.language)),
      };
    } catch (error) {
      this._edit = { problem: error?.message ?? String(error) };
    }
  }

  _editChange(changes) {
    this._edit = { ...this._edit, ...changes };
  }

  async _saveEdit() {
    const edit = this._edit;
    const common = { area_id: edit.area || null, labels: edit.labels };
    if (edit.enabled !== edit.wasEnabled) common.disabled_by = edit.enabled ? null : "user";
    const message = edit.device
      ? { type: "config/device_registry/update", device_id: edit.id, name_by_user: edit.name.trim() || null, ...common }
      : { type: "config/entity_registry/update", entity_id: edit.id, name: edit.name.trim() || null, ...common };
    this._editChange({ busy: true, problem: null });
    try {
      await this.hass.callWS(message);
    } catch (error) {
      this._editChange({ busy: false, problem: error?.message ?? String(error) });
      return;
    }
    // A switched off device is gone from Home Assistant, and so is its window.
    if (!edit.enabled) this._close();
    else this._change(this.sheet.back ?? { kind: "panel" });
  }

  _renderDeviceEdit() {
    const edit = this._edit;
    const back = () => (this.sheet.back ? this._change(this.sheet.back) : this._close());
    const header = this._renderHeader(this._t(edit?.device === false ? "entity_edit" : "device_edit"), false, false);
    if (!edit) return html`${header}<p class="hint">${this._t("loading")}</p>`;
    if (!edit.allLabels) return html`${header}<p class="hint" data-edit-problem>${edit.problem}</p>`;
    const areas = Object.values(this.hass.areas ?? {}).sort((a, b) => a.name.localeCompare(b.name, this.hass.language));
    const toggleLabel = (id) =>
      this._editChange({ labels: edit.labels.includes(id) ? edit.labels.filter((label) => label !== id) : [...edit.labels, id] });
    return html`
      ${header}
      <div class="rows" data-device-edit>
        <label class="field">
          <span>${this._t("edit_name")}</span>
          <input
            type="text"
            data-edit-name
            placeholder=${edit.placeholder}
            .value=${edit.name}
            @input=${(event) => this._editChange({ name: event.target.value })}
          />
        </label>
        <label class="field">
          <span>${this._t("edit_area")}</span>
          <select data-edit-area @change=${(event) => this._editChange({ area: event.target.value })}>
            <option value="" ?selected=${!edit.area}>${this._t("edit_no_area")}</option>
            ${areas.map((area) => html`<option value=${area.area_id} ?selected=${area.area_id === edit.area}>${area.name}</option>`)}
          </select>
        </label>
        ${edit.allLabels.length
          ? html`<h3>${this._t("edit_labels")}</h3>
              <div class="choice-chips" data-edit-labels>
                ${edit.allLabels.map(
                  (label) => html`<button
                    class=${edit.labels.includes(label.label_id) ? "active" : ""}
                    aria-pressed=${edit.labels.includes(label.label_id) ? "true" : "false"}
                    data-edit-label=${label.label_id}
                    @click=${() => toggleLabel(label.label_id)}
                  >
                    ${label.icon ? html`<ha-icon .icon=${label.icon}></ha-icon>` : nothing}${label.name}
                  </button>`,
                )}
              </div>`
          : nothing}
        <label class="field">
          <span>${this._t(edit.device ? "edit_enabled_device" : "edit_enabled_entity")}</span>
          <input
            type="checkbox"
            data-edit-enabled
            .checked=${edit.enabled}
            @change=${(event) => this._editChange({ enabled: event.target.checked })}
          />
        </label>
        ${edit.enabled ? nothing : html`<p class="hint" data-edit-warning>${this._t("edit_disable_warning")}</p>`}
        ${edit.problem ? html`<p class="hint" data-edit-problem>${edit.problem}</p>` : nothing}
        <button class="row off" data-edit-save ?disabled=${edit.busy} @click=${this._saveEdit}>
          <span class="row-icon"><ha-icon icon="mdi:content-save-outline"></ha-icon></span>
          <span class="row-text"><strong>${this._t("edit_save")}</strong></span>
        </button>
        <button class="row off" data-edit-cancel @click=${back}>
          <span class="row-icon"><ha-icon icon="mdi:arrow-left"></ha-icon></span>
          <span class="row-text"><strong>${this._t("edit_back")}</strong></span>
        </button>
      </div>
    `;
  }

  _renderPanel() {
    const { item } = this.sheet;
    if (item.auto_card && this._usesCard) {
      return html`
        ${this._renderHeader(item.name, false, false)}
        <div class="live panel-card fill" data-live></div>
      `;
    }
    if (item.frame) {
      return html`${this._renderHeader(item.name, false, false)}${this._renderFrame(item)}`;
    }
    if (item.tabs) return this._renderSettingsTabs(item);
    const stats = panelStats(this.hass, item);
    if (item.fullscreen && item.card && item.card_open && !item.card_last) return this._renderSplitPanel(item, stats);
    return html`
      ${this._renderHeader(item.name, false, Boolean(item.details), () => this._showDetails(item.details))}
      <div class="rows">
        ${stats.length
          ? html`<div class="stats">
              ${stats.map((stat) => html`<span><b>${stat.value}</b><small>${stat.name}</small></span>`)}
            </div>`
          : nothing}
        ${item.card_open ? this._renderActions(item.actions) : nothing}
        ${item.card && !item.card_last && (this._live || item.card_open)
          ? html`<div class="live panel-card" data-live></div>`
          : nothing}
        ${item.card && !this._live && !item.card_open
          ? html`<button class="start-live" data-panel-card @click=${() => this._mountLive(item.card)}>
              <ha-icon .icon=${item.card_icon ?? "mdi:gamepad-variant-outline"}></ha-icon>
              ${item.card_label ?? this._t("panel_control")}
            </button>`
          : nothing}
        ${item.card_open ? nothing : this._renderActions(item.actions)}
        ${(item.groups ?? []).map(
          (group) => html`
            ${group.title && group.layout !== "summary" ? html`<h3>${group.title}</h3>` : nothing}
            ${group.layout === "summary" ? this._renderSummary(group) : nothing}
            ${group.layout === "controls" ? this._renderControls(group.rows) : nothing}
            ${group.layout ? nothing : group.rows.map((row) => this._renderPanelRow(row))}
          `,
        )}
        ${item.card_last && item.card_open ? html`<div class="live panel-card" data-live></div>` : nothing}
      </div>
    `;
  }

  // A panel on the whole screen with its card always open, such as a vacuum's map: on a tablet on its side the
  // panel's own parts (its rows, its numbers as tiles with a bar for a share, its buttons at the bottom) stand in a
  // column beside the card, which keeps the rest of the screen; upright and on a phone they stand above it, as before.
  // The card's box is the same element in both, so turning the tablet does not start the card again.
  _renderSplitPanel(item, stats) {
    const split = window.matchMedia(SPLIT_PANEL).matches;
    const share = (index) => {
      const stat = item.stats[index];
      const value = Number(this.hass.states[stat.entity]?.state);
      return stat.unit === "%" && Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : null;
    };
    return html`
      ${this._renderHeader(item.name, false, Boolean(item.details), () => this._showDetails(item.details))}
      <div class="rows panel-split ${split ? "split" : ""}">
        <div class="side">
          ${stats.length
            ? html`<div class="stats" data-panel-stats>
                ${stats.map(
                  (stat, index) => html`<span>
                    <b>${stat.value}</b><small>${stat.name}</small>
                    ${split && share(index) !== null ? html`<i class="share"><u style="width: ${share(index)}%"></u></i>` : nothing}
                  </span>`,
                )}
              </div>`
            : nothing}
          ${split ? this._renderRoomPicker(item) : nothing}
          <div class="side-actions">${this._renderActions(item.actions)}</div>
          ${(item.groups ?? []).map(
            (group) => html`<div class="panel-group">
              ${group.title && group.layout !== "summary" ? html`<h3>${group.title}</h3>` : nothing}
              ${group.layout === "summary" ? this._renderSummary(group) : nothing}
              ${group.layout === "controls" ? this._renderControls(group.rows) : nothing}
              ${group.layout ? nothing : group.rows.map((row) => this._renderPanelRow(row))}
            </div>`,
          )}
        </div>
        <div class="live panel-card" data-live></div>
      </div>
    `;
  }

  // The rooms a vacuum map card offers (its mode that cleans rooms, with the rooms set up in it), as buttons beside
  // the map: the card's own buttons are put away on a tablet on its side, and its map stands alone.
  _roomMode(item) {
    const mode = (item.card?.map_modes ?? []).find(
      (entry) => entry?.template === "vacuum_clean_segment" && entry.predefined_selections?.length && entry.service_call_schema,
    );
    return mode ? { ...mode, entity: item.card.entity } : null;
  }

  _renderRoomPicker(item) {
    const mode = this._roomMode(item);
    if (!mode) return nothing;
    const { selected, repeats } = this._rooms ?? { selected: [], repeats: 1 };
    const most = Number(mode.max_repeats) || 1;
    const toggle = (id) =>
      (this._rooms = {
        repeats,
        selected: selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id],
      });
    return html`
      <div class="room-picker" data-room-picker>
        <h3>${this._t("vacuum_rooms")}</h3>
        <div class="room-chips">
          ${mode.predefined_selections.map(
            (room) => html`<button
              class="room-chip ${selected.includes(room.id) ? "on" : ""}"
              aria-pressed=${selected.includes(room.id) ? "true" : "false"}
              data-room=${room.id}
              @click=${() => toggle(room.id)}
            >
              ${room.label?.text ?? room.id}
            </button>`,
          )}
        </div>
        <div class="room-run">
          <button
            class="room-repeats"
            aria-label=${this._t("vacuum_repeats")}
            data-room-repeats
            ?disabled=${most < 2}
            @click=${() => (this._rooms = { selected, repeats: (repeats % most) + 1 })}
          >
            ×${repeats}
          </button>
          <button class="room-go" data-room-go ?disabled=${!selected.length} @click=${() => this._cleanRooms(mode)}>
            <ha-icon icon="mdi:play"></ha-icon>${this._t("vacuum_clean_rooms", { count: selected.length })}
          </button>
        </div>
      </div>
    `;
  }

  // The card's own call, its placeholders filled: [[entity_id]], [[selection]] (the rooms) and [[repeats]].
  _cleanRooms(mode) {
    const { selected, repeats } = this._rooms;
    const fill = (value) => {
      if (value === "[[selection]]") return selected;
      if (value === "[[repeats]]") return repeats;
      if (value === "[[entity_id]]") return mode.entity;
      if (Array.isArray(value)) return value.map(fill);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)]));
      return value;
    };
    const { service, service_data: data } = mode.service_call_schema;
    const [domain, name] = service.split(".");
    this.hass.callService(domain, name, fill(data ?? {}));
    this._rooms = { selected: [], repeats };
  }

  // Remote ----------------------------------------------------------------------------------

  _tvSource(source) {
    const { item, entityId } = this.sheet;
    if (isTvOn(this._stateObj)) {
      this.hass.callService("media_player", "select_source", { entity_id: entityId, source });
    } else if (item.source_script) {
      const [domain, service] = item.source_script.service.split(".");
      this.hass.callService(domain, service, { [item.source_script.field]: source });
    } else {
      runAction(this.hass, item.on);
      selectSourceAfterStart(() => document.querySelector("home-assistant")?.hass ?? this.hass, entityId, source);
    }
  }

  _renderTv() {
    const { item } = this.sheet;
    const stateObj = this._stateObj;
    const { attributes } = stateObj;
    const on = isTvOn(stateObj);
    const sources = rememberedSources(stateObj.entity_id, attributes.source_list);
    const current = attributes.source || attributes.app_name;
    const modes = item.sound_mode ? (attributes.sound_mode_list ?? []).filter((mode) => !mode.startsWith("Unknown")) : [];
    const volume = this._volume ?? Math.round((attributes.volume_level ?? 0) * 100);
    const taken = (item.shortcuts ?? []).map((shortcut) => matchSource(sources, shortcut.name));
    const rest = sources.filter((source) => !taken.includes(source));
    const button = (key, icon, onTap, active = false) => html`
      <button class="remote ${active ? "on" : ""}" aria-label=${this._t(key)} data-remote=${key} @click=${onTap}>
        <ha-icon .icon=${icon}></ha-icon>
      </button>
    `;
    return html`
      ${this._renderHeader(item.name ?? attributes.friendly_name, false, false)}
      <div class="rows">
        <p class="tv-status" data-tv-status>${tvStatus(this.hass.language, stateObj)}</p>
        <div class="remotes">
          ${button("tv_power", "mdi:power", () => runAction(this.hass, on ? item.off : item.on), on)}
          ${button(
            "tv_mute",
            attributes.is_volume_muted ? "mdi:volume-off" : "mdi:volume-high",
            () => this._call("media_player", "volume_mute", { is_volume_muted: !attributes.is_volume_muted }),
            attributes.is_volume_muted === true,
          )}
          ${button("tv_volume_down", "mdi:volume-minus", () => this._call("media_player", "volume_down"))}
          ${button("tv_volume_up", "mdi:volume-plus", () => this._call("media_player", "volume_up"))}
        </div>
        <div class="block-actions">
          ${(item.shortcuts ?? []).map((shortcut) => {
            const source = matchSource(sources, shortcut.name);
            return html`
              <button
                class="block-action ${on && current === source ? "on" : ""}"
                data-shortcut=${shortcut.name}
                @click=${() => this._tvSource(source)}
              >
                <ha-icon .icon=${shortcut.icon}></ha-icon>
                <span>${shortcut.name}</span>
              </button>
            `;
          })}
        </div>
        ${this.hass.entities?.[stateObj.entity_id]?.platform === "webostv" ? this._renderWebosKeys(on) : nothing}
        ${on
          ? html`
              <div class="range-field">
                <h3>${this._t("tv_volume")}<span>${volume}%</span></h3>
                <input
                  type="range"
                  data-tv-volume
                  min="0"
                  max="100"
                  .value=${String(volume)}
                  @input=${this._volumeInput}
                />
              </div>
            `
          : nothing}
        ${this._renderTvSources(rest, on ? current : null)}
        ${modes.length
          ? html`
              <div class="choice-field">
                <h3>${this._t("tv_sound_mode")}</h3>
                ${this._renderTvChoices(modes, attributes.sound_mode, (mode) =>
                  this._call("media_player", "select_sound_mode", { sound_mode: mode }),
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  _webosButton(button) {
    this.hass.callService("webostv", "button", { entity_id: this.sheet.entityId, button });
  }

  // A TV that is off cannot take keys, so they wait in grey until it starts.
  _renderWebosKeys(on) {
    const key = ({ key, button, icon, label, place }) => html`
      <button
        class="key ${place ?? ""}"
        aria-label=${this._t(key)}
        data-tv-key=${button}
        ?disabled=${!on}
        @click=${() => this._webosButton(button)}
      >
        ${icon ? html`<ha-icon .icon=${icon}></ha-icon>` : label}
      </button>
    `;
    return html`
      <div class="dpad">${WEBOS_ARROWS.map(key)}</div>
      <div class="keys">${WEBOS_KEYS.map(key)}</div>
    `;
  }

  // A long list of apps would push everything else away, so it opens on request.
  _renderTvSources(sources, current) {
    if (!sources.length) return nothing;
    const choices = this._renderTvChoices(sources, current, (source) => this._tvSource(source));
    if (sources.length <= CHOICE_LIMIT) {
      return html`<div class="choice-field"><h3>${this._t("tv_source")}</h3>${choices}</div>`;
    }
    return html`
      <details class="summary" data-tv-sources>
        <summary>
          <strong>${this._t("tv_all_sources", { count: sources.length })}</strong>
          <ha-icon icon="mdi:chevron-down"></ha-icon>
        </summary>
        ${choices}
      </details>
    `;
  }

  _renderTvChoices(options, current, onPick) {
    return html`
      <div class="choices">
        ${options.map(
          (option) => html`
            <button class="choice ${option === current ? "on" : ""}" data-choice=${option} @click=${() => onPick(option)}>
              <span>${option}</span>
            </button>
          `,
        )}
      </div>
    `;
  }

  // Volume ----------------------------------------------------------------------------------

  // The sound follows the slider while it moves, at a pace a speaker can keep up with. The player
  // reports its level a moment later, and the slider must not jump back meanwhile.
  _volumeInput(event) {
    clearTimeout(this._volumeHold);
    this._volume = Number(event.target.value);
    this._volumeHold = setTimeout(() => this._stopVolume(), VOLUME_HOLD_MS);
    if (!this._volumeTimer) this._sendVolume();
  }

  _sendVolume() {
    this._volumeTimer = null;
    if (this._volume === this._volumeSent) return;
    this._volumeSent = this._volume;
    this._call("media_player", "volume_set", { volume_level: this._volume / 100 });
    this._volumeTimer = setTimeout(() => this._sendVolume(), VOLUME_STEP_MS);
  }

  _stopVolume() {
    clearTimeout(this._volumeHold);
    clearTimeout(this._volumeTimer);
    this._volumeTimer = null;
    this._volume = undefined;
    this._volumeSent = undefined;
  }

  // Player ----------------------------------------------------------------------------------

  _renderPlayer() {
    const player = buildPlayer(this.hass, this.sheet.entityId, this.config);
    const percent = player.duration ? (player.position / player.duration) * 100 : 0;
    return html`
      ${this._renderHeader(player.room)}
      <div class="body player">
        <div class="art">
          ${player.picture
            ? html`<img src=${this.hass.hassUrl(player.picture)} alt="" />`
            : html`<ha-icon icon="mdi:music"></ha-icon>`}
        </div>
        <strong class="track-title">${player.title}</strong>
        <small class="artist">${player.artist}</small>
        ${player.duration
          ? html`
              <div class="progress"><span style="width: ${percent}%"></span></div>
              <div class="times"><span>${formatTime(player.position)}</span><span>${formatTime(player.duration)}</span></div>
            `
          : nothing}
        <div class="transport">
          <button
            ?disabled=${!player.can.previous}
            aria-label="previous"
            @click=${() => this._call("media_player", "media_previous_track")}
          >
            <ha-icon icon="mdi:skip-previous"></ha-icon>
          </button>
          <button
            class="main"
            data-play
            aria-label="play"
            @click=${() => this._call("media_player", "media_play_pause")}
          >
            <ha-icon .icon=${player.playing ? "mdi:pause" : "mdi:play"}></ha-icon>
          </button>
          <button
            ?disabled=${!player.can.next}
            aria-label="next"
            @click=${() => this._call("media_player", "media_next_track")}
          >
            <ha-icon icon="mdi:skip-next"></ha-icon>
          </button>
        </div>
        ${player.can.volume && player.volume !== null
          ? html`
              <label class="volume">
                <ha-icon icon="mdi:volume-medium"></ha-icon>
                <input
                  type="range"
                  min="0"
                  max="100"
                  .value=${String(this._volume ?? Math.round(player.volume * 100))}
                  @input=${this._volumeInput}
                />
              </label>
            `
          : nothing}
        <div class="extras">
          <button
            class=${player.shuffle ? "active" : ""}
            ?disabled=${!player.can.shuffle}
            aria-label="shuffle"
            @click=${() => this._call("media_player", "shuffle_set", { shuffle: !player.shuffle })}
          >
            <ha-icon icon="mdi:shuffle"></ha-icon>
          </button>
          <button
            class=${player.repeat === "off" ? "" : "active"}
            ?disabled=${!player.can.repeat}
            aria-label="repeat"
            @click=${() => this._call("media_player", "repeat_set", { repeat: nextRepeat(player.repeat) })}
          >
            <ha-icon .icon=${player.repeat === "one" ? "mdi:repeat-once" : "mdi:repeat"}></ha-icon>
          </button>
        </div>
      </div>
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
    return html`
      <div class="scrim" @click=${this._close}></div>
      <div class="cover ${dark ? "dark" : ""} ${whole ? "whole" : ""} ${floating ? "floating" : ""}"></div>
      <section class="panel ${dark ? "dark" : ""} ${whole ? "whole" : ""} ${floating ? "floating" : ""}" data-kind=${this.sheet.kind}>
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
    css`
      button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
      }
      button[disabled] {
        opacity: 0.3;
        pointer-events: none;
      }
      :host(.settling) .scrim,
      :host(.settling) .cover,
      :host(.settling) .panel {
        transition:
          transform 240ms cubic-bezier(0.3, 0, 0.2, 1),
          opacity 240ms ease;
      }
      .scrim {
        position: fixed;
        inset: -120px 0;
        z-index: 7;
        opacity: calc(1 - var(--hd-drag-fade, 0) * 2);
        touch-action: none;
        background: rgba(0, 0, 0, var(--hd-sheet-scrim, 0.45));
        animation: fade 240ms ease-out;
      }
      /* iOS draws the page under its bars, where a panel with inset: 0 does not reach. */
      .cover {
        position: fixed;
        inset: -120px 0;
        z-index: 7;
        transform: translateY(var(--hd-drag, 0px));
        background: color-mix(in srgb, var(--hd-sheet-bg, var(--hd-background)) var(--hd-sheet-opacity, 100%), transparent);
        -webkit-backdrop-filter: blur(var(--hd-sheet-blur, 0px));
        backdrop-filter: blur(var(--hd-sheet-blur, 0px));
        animation: rise 320ms cubic-bezier(0.2, 0.9, 0.25, 1);
      }
      .cover.dark {
        background: #17181a;
      }
      .cover.floating {
        background: rgba(0, 0, 0, 0.12);
        -webkit-backdrop-filter: blur(28px);
        backdrop-filter: blur(28px);
      }
      @media (max-width: 899px) {
        .panel.floating {
          inset: max(14dvh, calc(var(--hd-safe-top) + 24px)) 12px auto;
          padding: 0;
          overflow: visible;
          border-radius: 34px;
          background: var(--hd-sheet-bg, var(--hd-background));
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
        }
      }
      .panel.floating > .grip {
        display: none;
      }
      .panel {
        position: fixed;
        inset: 0;
        z-index: 8;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        padding: var(--hd-safe-top) 0 calc(var(--hd-safe-bottom) + 16px);
        overflow-y: auto;
        overscroll-behavior: contain;
        touch-action: pan-x pan-y;
        transform: translateY(var(--hd-drag, 0px));
        /* The cover under it carries the background, so a see-through look is not laid on twice. */
        background: transparent;
        animation: rise 320ms cubic-bezier(0.2, 0.9, 0.25, 1);
      }
      .grip {
        position: sticky;
        top: 0;
        z-index: 1;
        display: grid;
        flex: none;
        place-items: center;
        height: 20px;
        touch-action: none;
        cursor: grab;
      }
      .grip::before {
        content: "";
        width: 36px;
        height: 5px;
        border-radius: 3px;
        opacity: 0.35;
        background: currentcolor;
      }
      .panel.dark {
        color: #ffffff;
        background: #17181a;
      }
      @keyframes rise {
        from {
          transform: translateY(100%);
        }
      }
      @keyframes rise-centre {
        from {
          transform: translate(-50%, 50vh);
          opacity: 0;
        }
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .scrim,
        .cover,
        .panel {
          animation: none !important;
        }
      }
      h3 {
        margin: 12px 0 0;
        font-size: 15px;
        font-weight: 500;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
        gap: 8px;
        padding: 12px;
        border-radius: var(--hd-radius);
        background: var(--hd-off);
      }
      .stats span {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .stats b {
        font-size: 17px;
        line-height: 24px;
        font-weight: 500;
        overflow-wrap: anywhere;
      }
      .stats small {
        font-size: 12px;
        line-height: 16px;
        color: var(--hd-text-muted);
      }
      /* Upright the parts keep the order of a panel: numbers, buttons, the card, then the rows. */
      .panel-split .side {
        display: contents;
      }
      .panel-split > .live {
        order: 1;
      }
      .panel-split .panel-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        order: 2;
      }
      /* On its side: a column of 360 px for the panel's parts, the card beside it on the rest of the screen. */
      .panel-split.split {
        display: grid;
        flex: 1;
        grid-template-columns: 360px minmax(0, 1fr);
        gap: 16px;
        min-height: 0;
        padding: 8px 16px 16px;
      }
      .panel-split.split .side {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
        overflow-y: auto;
      }
      .panel-split.split .panel-group {
        order: 0;
      }
      .panel-split.split .stats {
        order: 1;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 0;
        background: none;
      }
      .panel-split.split .stats span {
        padding: 14px 16px;
        border-radius: var(--hd-radius);
        background: var(--hd-off);
      }
      .panel-split.split .stats b {
        font-size: 20px;
      }
      .room-picker {
        order: 2;
      }
      .room-picker h3 {
        margin: 0 0 8px;
        font-size: 15px;
        font-weight: 500;
      }
      .room-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .room-chip {
        padding: 8px 12px;
        border-radius: 16px;
        font-size: 14px;
        background: var(--hd-off);
        cursor: pointer;
      }
      .room-chip.on {
        color: #ffffff;
        background: var(--hd-appliance-icon, #2b6cb0);
      }
      .room-run {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      .room-repeats,
      .room-go {
        display: flex;
        gap: 6px;
        align-items: center;
        justify-content: center;
        height: 44px;
        padding: 0 14px;
        border-radius: 22px;
        background: var(--hd-off);
        cursor: pointer;
      }
      .room-go {
        flex: 1;
        color: #ffffff;
        background: var(--hd-appliance-icon, #2b6cb0);
      }
      .room-go[disabled],
      .room-repeats[disabled] {
        opacity: 0.4;
        cursor: default;
      }
      .share {
        display: block;
        height: 4px;
        margin-top: 10px;
        border-radius: 2px;
        background: color-mix(in srgb, currentColor 20%, transparent);
      }
      .share u {
        display: block;
        height: 100%;
        border-radius: 2px;
        background: currentColor;
      }
      .panel-split.split .side-actions {
        order: 3;
        margin-top: auto;
      }
      .panel-split.split .block-actions {
        grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
        gap: 12px;
      }
      .panel-split.split .block-action {
        justify-content: center;
        min-height: 96px;
        font-size: 15px;
        --mdc-icon-size: 30px;
      }
      /* The card takes the whole column (a window on the whole screen keeps other cards narrow and centred), and the row
         is as tall as the card, so the buttons at the bottom of the column end with it. */
      .panel.whole .rows.panel-split.split {
        flex: none;
        align-items: stretch;
      }
      .panel.whole .rows.panel-split.split > .live {
        order: 0;
        justify-self: center;
        align-self: center;
        width: 100%;
        max-width: none;
        /* The map on the window's own background. */
        --map-card-zoomer-background: transparent;
        --ha-card-background: transparent;
        --ha-card-box-shadow: none;
        margin: 0;
        min-height: 0;
      }
      .panel.whole .rows.panel-split.split > .live > * {
        display: block;
        width: 100%;
      }
      .panel-split.split .side {
        overflow: visible;
      }
      .block-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
        gap: 8px;
      }
      .block-action {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 12px 4px;
        border-radius: var(--hd-radius);
        font-size: 13px;
        text-align: center;
        background: var(--hd-off);
      }
      .block-action.on {
        color: #ffffff;
        background: var(--hd-appliance-icon);
      }
      .confirm {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 12px;
        border-radius: var(--hd-radius);
        background: var(--hd-security);
      }
      .confirm span {
        flex: 1 1 100%;
      }
      .confirm button {
        flex: 1;
        padding: 10px;
        border-radius: 12px;
        text-align: center;
        background: var(--hd-surface);
      }
      .confirm .yes {
        font-weight: 500;
      }
      .field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 48px;
        padding: 4px 12px;
        border-radius: 12px;
        background: var(--hd-off);
      }
      .field > span {
        min-width: 0;
        font-size: 14px;
      }
      .field small {
        flex: none;
        max-width: 55%;
        font-size: 14px;
        text-align: right;
        color: var(--hd-text-muted);
      }
      .field select {
        max-width: 55%;
        padding: 8px;
        border: 1px solid var(--hd-outline);
        border-radius: 10px;
        font: inherit;
        color: inherit;
        background: var(--hd-surface);
      }
      .field input[type="text"] {
        box-sizing: border-box;
        width: 60%;
        min-width: 0;
        padding: 8px 10px;
        border: 1px solid var(--hd-outline);
        border-radius: 10px;
        font: inherit;
        color: inherit;
        background: var(--hd-surface);
      }
      .field input[type="range"] {
        flex: 1;
        min-width: 0;
        max-width: 55%;
      }
      .slider-field output {
        flex: none;
        min-width: 48px;
        font-size: 14px;
        text-align: right;
        color: var(--hd-text-muted);
      }
      .look-colour > span {
        flex: 1;
      }
      .look-colour button {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        color: inherit;
        background: transparent;
      }
      /* A colour: its code, a small cross back to the default, and a round sample that opens the picker. */
      .look-colour .swatch-text {
        margin-left: auto;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        color: var(--hd-text-muted);
      }
      .look-colour .swatch-clear {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        --mdc-icon-size: 18px;
        color: var(--hd-text-muted);
      }
      .swatch-pick {
        position: relative;
        flex: none;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        cursor: pointer;
        /* The colour over a checkerboard, so a see-through one shows how see-through it is. */
        background:
          linear-gradient(var(--swatch, transparent), var(--swatch, transparent)),
          repeating-conic-gradient(#c8c8c8 0% 25%, #ffffff 0% 50%) 50% / 10px 10px;
        box-shadow:
          0 0 0 1px rgba(0, 0, 0, 0.25),
          0 0 0 3px rgba(255, 255, 255, 0.35);
      }
      /* A colour still to be chosen: every colour around the circle. */
      .swatch-pick.rainbow {
        background: conic-gradient(#ff3b30, #ffcc00, #34c759, #00c7be, #007aff, #af52de, #ff3b30);
      }
      .swatch-pick.unset {
        background: none;
        box-shadow: none;
        border: 2px dashed var(--hd-text-muted);
        box-sizing: border-box;
      }
      .swatch-pick input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
      }
      /* A copy of the tiles of the page, only what the look changes. */
      .theme-background > span:nth-child(2) {
        flex: 1;
        min-width: 0;
      }
      .theme-thumb {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background-size: cover;
      }
      .tile-preview {
        display: grid;
        flex: none;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 12px;
        border-radius: 16px;
        background: linear-gradient(160deg, #6a8fd0, #3b2f7a);
      }
      .paint-swatch {
        flex: none;
        width: 28px;
        height: 28px;
        border: 1px solid var(--hd-outline);
        border-radius: 8px;
      }
      .look-colour input[type="text"] {
        width: 45%;
        padding: 6px 8px;
        border: 1px solid var(--hd-outline);
        border-radius: 8px;
        font: inherit;
        font-size: 13px;
        color: inherit;
        background: var(--hd-surface);
      }
      .look-group {
        margin: 12px 4px 0;
        font-size: 15px;
        font-weight: 500;
      }
      .look-tile {
        --tile-background: var(--hd-look-tile-bg, var(--hd-off));
        --tile-icon: var(--hd-look-tile-icon-bg, var(--hd-off-icon));
        --tile-ink: var(--hd-look-tile-icon, var(--hd-off-ink));
        --tile-fill: var(--tile-background);
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        min-height: 60px;
        padding: 6px 10px;
        border-radius: var(--hd-tile-radius, var(--hd-radius));
        color: var(--hd-look-tile-text, var(--hd-text));
        background: color-mix(in srgb, var(--tile-fill) var(--hd-tile-opacity, 100%), transparent);
      }
      .look-tile.tone-light,
      .look-tile.tone-cover {
        color: var(--hd-text);
      }
      .tile-preview.fill-icon .look-tile {
        color: var(--hd-look-tile-text, var(--hd-text));
      }
      .look-tile.tone-light {
        --tile-background: var(--hd-light);
        --tile-icon: var(--hd-light-icon);
        --tile-ink: var(--hd-light-ink);
      }
      .look-tile.tone-cover {
        --tile-background: var(--hd-cover);
        --tile-icon: var(--hd-cover-icon);
        --tile-ink: var(--hd-cover-ink);
      }
      .tile-preview.fill-icon .look-tile {
        --tile-fill: var(--hd-look-tile-bg, var(--hd-off));
      }
      .look-icon {
        display: grid;
        flex: none;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        color: var(--tile-ink);
        background: var(--tile-icon);
        --mdc-icon-size: 20px;
      }
      .look-tile small {
        display: block;
        font-size: 12px;
        color: var(--hd-look-tile-muted, var(--hd-text-muted));
      }
      .look-tile.tone-light small,
      .look-tile.tone-cover small {
        color: var(--hd-text-muted);
      }
      .icon-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
        gap: 6px;
      }
      .icon-grid .choice {
        min-height: 52px;
      }
      .switch {
        position: relative;
        flex: none;
        width: 48px;
        height: 28px;
        border-radius: 14px;
        background: var(--hd-off-icon);
        transition: background-color 180ms ease;
      }
      .switch::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #ffffff;
        transition: transform 180ms ease;
      }
      .switch.on {
        background: var(--hd-appliance-icon);
      }
      .switch.on::after {
        transform: translateX(20px);
      }
      .press {
        display: grid;
        flex: none;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--hd-off-icon);
      }
      .remotes {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }
      .remote {
        display: grid;
        place-items: center;
        height: 64px;
        border-radius: var(--hd-radius);
        background: var(--hd-off);
      }
      .remote.on {
        color: #ffffff;
        background: var(--hd-appliance-icon);
      }
      .order-row {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 52px;
        padding: 2px 4px 2px 14px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .order-row span {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        font-size: 14px;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .order-row button {
        display: grid;
        flex: none;
        place-items: center;
        width: 44px;
        height: 44px;
      }
      .order-row.muted span {
        opacity: 0.5;
      }
      .choice.on.except {
        background: var(--hd-security-icon);
      }
      .rule-users {
        margin-top: 8px;
      }
      .choices.sheet-tabs {
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .sheet-tabs .choice {
        flex: 1 0 auto;
        padding: 8px 16px;
      }
      [data-color-modes],
      .choices.even {
        flex-wrap: nowrap;
      }
      .look-preview.borrowed {
        opacity: 0.55;
      }
      [data-color-modes] .choice,
      .choices.even .choice {
        flex: 1 1 0;
        min-width: 0;
      }
      .view-section {
        margin-top: 8px;
      }
      .view-tile {
        margin-left: 16px;
      }
      .looks {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .look {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        border: 2px solid transparent;
        border-radius: var(--hd-radius);
        background: var(--hd-off);
      }
      .look.on {
        border-color: var(--hd-appliance-icon);
      }
      .look strong {
        font-size: 14px;
        font-weight: 500;
      }
      .look-preview {
        display: grid;
        place-items: center;
        height: 96px;
        border-radius: 12px;
        background-position: center;
        background-size: cover;
        background-color: var(--hd-surface);
      }
      .look-scope {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
      }
      .search {
        box-sizing: border-box;
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--hd-outline);
        border-radius: 12px;
        font: inherit;
        color: inherit;
        background: var(--hd-surface);
      }
      .pin-message {
        margin: 0;
        color: var(--hd-text-muted);
      }
      .pin-message.wrong {
        font-weight: 500;
        color: var(--hd-security-ink);
      }
      .pin-dots {
        display: flex;
        gap: 12px;
        height: 16px;
      }
      .pin-dots span {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: currentcolor;
      }
      .pin-keys {
        display: grid;
        grid-template-columns: repeat(3, 76px);
        gap: 14px;
      }
      .pin-keys button {
        display: grid;
        place-items: center;
        height: 76px;
        border-radius: 50%;
        font-size: 26px;
        background: var(--hd-off);
      }
      .pin-keys .ok {
        font-size: 18px;
        font-weight: 500;
        color: #ffffff;
        background: var(--hd-appliance-icon);
      }
      .light-slider {
        background: var(--hd-off);
      }
      .light-slider.disabled {
        opacity: 0.5;
      }
      .level {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        transition: height 200ms ease-out;
      }
      .actions button.lit {
        color: var(--hd-light-ink);
        background: var(--hd-light-icon);
      }
      .light-presets {
        display: grid;
        grid-template-columns: repeat(4, 44px);
        gap: 16px;
      }
      .light-preset {
        width: 44px;
        height: 44px;
        box-sizing: border-box;
        border: 1px solid var(--hd-outline);
        border-radius: 50%;
      }
      .field.effect {
        align-self: stretch;
      }
      .big-switch {
        position: relative;
        width: 120px;
        height: min(340px, 46vh);
        box-sizing: border-box;
        padding: 6px;
        border-radius: 36px;
        background: var(--hd-off);
        transition: background 200ms ease;
      }
      .big-switch.on {
        background: var(--hd-appliance);
      }
      .big-thumb {
        position: absolute;
        right: 6px;
        bottom: 6px;
        left: 6px;
        display: grid;
        place-items: center;
        height: calc(50% - 6px);
        border-radius: 30px;
        color: var(--hd-text-muted);
        background: var(--hd-surface);
        transition:
          bottom 200ms ease,
          color 200ms ease,
          background 200ms ease;
      }
      .big-switch.on .big-thumb {
        bottom: 50%;
        color: #ffffff;
        background: var(--hd-appliance-icon);
      }
      .alarm-modes {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        align-self: stretch;
        gap: 12px;
      }
      .alarm-mode {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 24px 8px;
        border-radius: var(--hd-radius);
        text-align: center;
        background: var(--hd-off);
      }
      .alarm-mode.on {
        color: #ffffff;
        background: var(--hd-security-icon);
      }
      .alarm-mode.on.off {
        background: var(--hd-appliance-icon);
      }
      .big-toggles {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .big-toggle {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px;
        border-radius: var(--hd-radius);
        background: var(--hd-off);
      }
      .big-toggle ha-icon {
        margin-bottom: 8px;
      }
      .big-toggle strong {
        font-size: 15px;
        font-weight: 500;
      }
      .big-toggle small {
        font-size: 13px;
        color: var(--hd-text-muted);
      }
      .big-toggle.on {
        color: #ffffff;
        background: var(--hd-appliance-icon);
      }
      .big-toggle.on small {
        color: inherit;
        opacity: 0.8;
      }
      .choice-field h3,
      .range-field h3 {
        display: flex;
        justify-content: space-between;
        margin: 8px 0;
      }
      .range-field h3 span {
        font-weight: 400;
        color: var(--hd-text-muted);
      }
      .range-field input[type="range"] {
        width: 100%;
      }
      .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .choice {
        display: flex;
        flex: 1 1 calc(50% - 4px);
        align-items: center;
        justify-content: center;
        gap: 6px;
        box-sizing: border-box;
        min-height: 48px;
        padding: 8px 10px;
        border-radius: 14px;
        font-size: 14px;
        text-align: center;
        background: var(--hd-off);
      }
      .choice.on {
        color: #ffffff;
        background: var(--hd-appliance-icon);
      }
      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .fact {
        display: flex;
        flex: 1 1 calc(50% - 4px);
        align-items: center;
        gap: 10px;
        box-sizing: border-box;
        min-width: 0;
        padding: 10px 12px;
        border-radius: 14px;
        background: var(--hd-off);
      }
      .fact ha-icon {
        flex: none;
        color: var(--hd-text-muted);
      }
      .fact span {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .fact small {
        font-size: 12px;
        line-height: 16px;
        color: var(--hd-text-muted);
      }
      .fact b {
        overflow: hidden;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .fact.alert {
        color: var(--hd-security-ink);
        background: var(--hd-security);
      }
      .fact.alert ha-icon,
      .fact.alert small {
        color: inherit;
      }
      .summary {
        border-radius: var(--hd-radius);
        background: var(--hd-off);
      }
      .summary summary {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 56px;
        padding: 0 16px;
        list-style: none;
        cursor: pointer;
      }
      .summary summary::-webkit-details-marker {
        display: none;
      }
      .summary strong {
        flex: 1;
        min-width: 0;
        font-size: 15px;
        font-weight: 500;
      }
      .summary small {
        font-size: 13px;
        color: var(--hd-text-muted);
      }
      .summary small.alert {
        font-weight: 500;
        color: var(--hd-security-ink);
      }
      .summary summary ha-icon {
        flex: none;
        transition: transform 200ms ease;
      }
      .summary[open] summary ha-icon {
        transform: rotate(180deg);
      }
      .summary .facts,
      .summary .choices {
        padding: 0 8px 8px;
      }
      .summary .fact,
      .summary .choice {
        background: var(--hd-surface);
      }
      .summary .fact.alert {
        background: var(--hd-security);
      }
      .summary .choice.on {
        background: var(--hd-appliance-icon);
      }
      .dpad {
        display: grid;
        grid-template-areas:
          ". up ."
          "left ok right"
          ". down .";
        grid-template-columns: repeat(3, 72px);
        grid-template-rows: repeat(3, 72px);
        justify-content: center;
        padding: 8px 0;
      }
      .key {
        display: grid;
        place-items: center;
        border-radius: 18px;
        font-weight: 500;
        background: var(--hd-off);
      }
      .dpad .up {
        grid-area: up;
        border-radius: 22px 22px 0 0;
      }
      .dpad .down {
        grid-area: down;
        border-radius: 0 0 22px 22px;
      }
      .dpad .left {
        grid-area: left;
        border-radius: 22px 0 0 22px;
      }
      .dpad .right {
        grid-area: right;
        border-radius: 0 22px 22px 0;
      }
      .dpad .ok {
        grid-area: ok;
        border-radius: 0;
        color: #ffffff;
        background: var(--hd-appliance-icon);
      }
      .keys {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }
      .keys .key {
        height: 56px;
      }
      hr {
        width: 100%;
        margin: 8px 0;
        border: 0;
        border-top: 1px solid var(--hd-outline);
      }
      .tv-status {
        margin: 0;
        text-align: center;
        color: var(--hd-text-muted);
      }
      .fill {
        flex: 1;
        min-height: 0;
      }
      .swatches {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .swatch {
        height: 72px;
        border-radius: 14px;
      }
      .swatch.selected {
        outline: 2px solid var(--hd-link);
        outline-offset: 2px;
      }
      .field input[type="color"] {
        width: 56px;
        height: 36px;
        padding: 0;
        border: 0;
        background: none;
      }
      .field input[type="file"] {
        max-width: 60%;
        font-size: 13px;
      }
      .search {
        box-sizing: border-box;
        width: 100%;
        padding: 12px 14px;
        border: 1px solid var(--hd-outline);
        border-radius: 12px;
        font: inherit;
        font-size: 16px;
        color: inherit;
        background: var(--hd-surface);
      }
      .frame {
        flex: 1;
        width: 100%;
        min-height: 60vh;
        border: 0;
      }
      .live.panel-card {
        min-height: 240px;
        max-height: none;
      }
      .panel.whole .rows .panel-card {
        max-width: 760px;
        margin: 0 auto;
      }
      header {
        display: flex;
        flex: none;
        align-items: center;
        height: 64px;
        padding: 0 8px;
      }
      header button {
        display: grid;
        flex: none;
        place-items: center;
        width: 48px;
        height: 48px;
      }
      h2 {
        flex: 1;
        min-width: 0;
        margin: 0 8px;
        overflow: hidden;
        font-size: 22px;
        font-weight: 400;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .body {
        flex: 1;
        min-height: 0;
      }
      /* Never smaller than what it holds: on a low screen the window scrolls instead of laying the controls over its
         header and the state under them. */
      .center {
        display: flex;
        flex: 1 0 auto;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
        padding: 16px;
      }
      .info {
        display: flex;
        flex: none;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        padding: 8px 16px;
      }
      .info span {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: 1px solid var(--hd-outline);
        border-radius: 10px;
        font-size: 14px;
        --mdc-icon-size: 18px;
      }
      .hint {
        margin: 0;
        padding: 0 16px;
        font-size: 14px;
        text-align: center;
        color: var(--hd-text-muted);
      }
      .dial {
        position: relative;
        width: min(280px, 76vw);
        aspect-ratio: 1;
      }
      .dial svg {
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
      }
      .dial path {
        fill: none;
        stroke-width: 12;
        stroke-linecap: round;
      }
      .dial .track {
        stroke: var(--hd-outline);
      }
      .dial .value {
        stroke: var(--hd-climate-icon);
      }
      .reading {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .reading small {
        font-size: 14px;
        color: var(--hd-climate-icon);
      }
      .reading strong {
        font-size: 60px;
        line-height: 72px;
        font-weight: 400;
      }
      .reading sup {
        font-size: 28px;
      }
      .stepper,
      .actions,
      .modes,
      .transport,
      .extras {
        display: flex;
        justify-content: center;
        gap: 16px;
      }
      .modes {
        flex-wrap: wrap;
        gap: 8px;
      }
      .modes button {
        padding: 8px 14px;
        border: 1px solid var(--hd-outline);
        border-radius: 12px;
        font-size: 14px;
      }
      /* Choices that can be several at once, as labels: neutral, in the colours of the window. */
      .choice-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .choice-chips button {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border: 1px solid var(--hd-outline);
        border-radius: 18px;
        font-size: 14px;
        --mdc-icon-size: 18px;
      }
      .choice-chips button.active {
        border-color: transparent;
        color: var(--hd-surface);
        background: var(--hd-text);
      }
      .modes button.active {
        border-color: transparent;
        background: var(--hd-climate);
      }
      .stepper button,
      .actions button {
        display: grid;
        place-items: center;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--hd-off);
      }
      .slider {
        position: relative;
        flex: none;
        box-sizing: border-box;
        width: 120px;
        height: min(340px, 46vh);
        overflow: hidden;
        border-radius: 36px;
        touch-action: none;
      }
      .cover-slider {
        background: var(--hd-cover);
      }
      .blind {
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        background: #a7a9ad;
      }
      .moving .blind {
        transition: height 260ms linear;
      }
      .actions button.moving {
        color: var(--hd-cover-icon);
        background: var(--hd-cover);
        animation: pulse 1400ms ease-in-out infinite;
      }
      @keyframes pulse {
        50% {
          opacity: 0.55;
        }
      }
      .lock-slider {
        background: var(--hd-security);
      }
      .lock-slider.disabled {
        opacity: 0.6;
      }
      .thumb {
        position: absolute;
        right: 6px;
        left: 6px;
        display: grid;
        place-items: center;
        height: 142px;
        border-radius: 30px;
        color: #ffffff;
        background: var(--hd-security-icon);
      }
      .header-end {
        width: 48px;
      }
      .picture {
        position: relative;
        width: fit-content;
        max-width: 100%;
      }
      /* The age of the picture sits top left, where LIVE shows once the camera streams. */
      .age {
        position: absolute;
        top: 8px;
        left: 8px;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 13px;
        color: #fff;
        background: rgba(0, 0, 0, 0.5);
      }
      /* The picture or the live view, with the controls of turning lying over it. */
      /* Room for the controls even before the picture comes, so nothing jumps when it does. */
      .stage {
        position: relative;
        flex: none;
        display: grid;
        place-items: center;
        width: fit-content;
        min-width: min(100%, 320px);
        max-width: 100%;
        min-height: 180px;
      }
      .stage:has(.live),
      .stage:has(.clip) {
        width: 100%;
      }
      .stage .live-pill {
        top: 8px;
        left: 8px;
        z-index: 1;
      }
      .ptz-overlay {
        position: absolute;
        top: 50%;
        right: 12px;
        transform: translateY(-50%);
      }
      /* Four quarters of a ring with a hole, turned so that the gaps between them run diagonally. */
      .ptz {
        display: grid;
        grid-template: 1fr 1fr / 1fr 1fr;
        gap: 3px;
        /* Smaller on a narrow phone, so it fits on the picture and never covers the buttons under it. */
        width: min(132px, 30vw);
        aspect-ratio: 1;
        overflow: hidden;
        border-radius: 50%;
        transform: rotate(45deg);
        -webkit-mask: radial-gradient(circle closest-side, transparent 40%, #000 41%);
        mask: radial-gradient(circle closest-side, transparent 40%, #000 41%);
      }
      .ptz button {
        display: grid;
        place-items: center;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.45);
        -webkit-backdrop-filter: blur(12px);
        backdrop-filter: blur(12px);
        --mdc-icon-size: 26px;
      }
      .ptz button:active {
        background: rgba(255, 255, 255, 0.35);
      }
      .ptz button[disabled] {
        cursor: default;
        opacity: 0.4;
      }
      .ptz ha-icon {
        transform: rotate(-45deg);
      }
      /* Quick buttons upright: a row over the line of time, from the right, round like those on the picture. */
      .quick {
        display: flex;
        flex: none;
        flex-direction: row-reverse;
        gap: 10px;
        align-self: stretch;
        margin: 0 16px;
      }
      .quick-slot {
        position: relative;
        display: flex;
      }
      .quick-button {
        display: grid;
        flex: none;
        place-items: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        color: #ffffff;
        background: rgba(255, 255, 255, 0.12);
        -webkit-backdrop-filter: blur(12px);
        backdrop-filter: blur(12px);
        cursor: pointer;
      }
      .quick-button.on {
        color: #17181a;
        background: #ffd60a;
      }
      .quick-button.alarm {
        color: #ffffff;
        background: #d70015;
        animation: pulse 1400ms ease-in-out infinite;
      }
      /* A list next to its button: above it upright, beside it on a phone on its side. */
      .quick-menu {
        position: absolute;
        right: 0;
        bottom: calc(100% + 8px);
        z-index: 6;
        display: grid;
        align-content: start;
        min-width: 150px;
        /* A long list (many positions) scrolls instead of leaving the screen. */
        max-height: 55dvh;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 6px;
        border-radius: 16px;
        background: rgba(30, 31, 34, 0.94);
        -webkit-backdrop-filter: blur(16px);
        backdrop-filter: blur(16px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      }
      .quick-menu button {
        padding: 10px 12px;
        border: 0;
        border-radius: 10px;
        font: inherit;
        font-size: 15px;
        text-align: left;
        color: #ffffff;
        background: none;
        cursor: pointer;
      }
      .quick-menu button.chosen {
        background: rgba(255, 255, 255, 0.14);
      }
      /* The siren asks first, in the middle of the window. */
      .siren-ask {
        position: fixed;
        inset: 0;
        z-index: 9;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(0, 0, 0, 0.45);
      }
      .siren-card {
        display: grid;
        justify-items: center;
        gap: 8px;
        width: min(100%, 340px);
        padding: 20px;
        border-radius: 24px;
        text-align: center;
        color: #ffffff;
        background: #2c2c2e;
        --mdc-icon-size: 36px;
      }
      .siren-card ha-icon {
        color: #ff453a;
      }
      .siren-card strong {
        font-size: 18px;
      }
      .siren-card p {
        margin: 0 0 8px;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.75);
      }
      .siren-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        width: 100%;
      }
      .siren-actions button {
        padding: 12px;
        border: 0;
        border-radius: 14px;
        font: inherit;
        font-weight: 600;
        color: #ffffff;
        background: rgba(255, 255, 255, 0.14);
        cursor: pointer;
      }
      .siren-actions .danger {
        background: #d70015;
      }
      header .ptz-toggle {
        border-radius: 50%;
      }
      .ptz-toggle.on {
        color: #1b1b1f;
        background: #ffffff;
      }
      /* The intercom lies on the picture, in the corner opposite its age. */
      .stage .voice.camera-talk.on.connecting {
        background: #8e8e93;
      }
      .stage .voice.camera-talk.on {
        color: #ffffff;
        background: #d70015;
        animation: pulse 1400ms ease-in-out infinite;
      }
      .stage .voice {
        position: absolute;
        right: 8px;
        bottom: 8px;
        z-index: 1;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        color: #fff;
        background: rgba(0, 0, 0, 0.5);
        -webkit-backdrop-filter: blur(12px);
        backdrop-filter: blur(12px);
      }
      .thumbs {
        display: flex;
        flex: none;
        gap: 6px;
        box-sizing: border-box;
        justify-content: safe center;
        width: 100%;
        padding: 4px 16px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .thumbs::-webkit-scrollbar {
        display: none;
      }
      .camera-thumb {
        flex: 0 0 112px;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        border-radius: 12px;
        background: #2a2c30;
      }
      .camera-thumb.current {
        outline: 2px solid #fff;
        outline-offset: 1px;
      }
      .thumbs .camera-thumb img {
        display: block;
        width: 100%;
        height: 100%;
        max-height: none;
        object-fit: cover;
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 16px 16px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: var(--hd-radius);
        background: var(--row-background, var(--hd-off));
      }
      .row-icon {
        display: grid;
        flex: none;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--row-icon, var(--hd-off-icon));
      }
      .row-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .row-text strong {
        font-weight: 500;
      }
      .row-text small {
        color: var(--hd-text-muted);
      }
      .row.light {
        --row-background: var(--hd-light);
        --row-icon: var(--hd-light-icon);
      }
      .row.climate {
        --row-background: var(--hd-climate);
        --row-icon: var(--hd-climate-icon);
      }
      .row.cover {
        --row-background: var(--hd-cover);
        --row-icon: var(--hd-cover-icon);
      }
      .row.security {
        --row-background: var(--hd-security);
        --row-icon: var(--hd-security-icon);
      }
      .row.media {
        --row-background: var(--hd-media);
        --row-icon: var(--hd-media-icon);
      }
      .row.appliance {
        --row-background: var(--hd-appliance);
        --row-icon: var(--hd-appliance-icon);
      }
      .camera-body {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
      }
      /* Room for the days, the line of time and the thumbnails, so a tall picture never pushes them over it. */
      .camera-body img,
      .live,
      .clip {
        display: block;
        width: 100%;
        max-height: clamp(180px, 100dvh - 440px, 60vh);
        object-fit: contain;
      }
      .clip {
        aspect-ratio: 16 / 9;
        background: #000000;
      }
      /* Days at the top and the line of time at the bottom; the picture stays between them. */
      .camera-body home-dashboard-recording-days {
        flex: none;
        margin-bottom: auto;
      }
      .camera-body home-dashboard-timeline {
        flex: none;
        margin-top: auto;
        margin-bottom: 8px;
      }
      .sound-level {
        position: absolute;
        top: 0;
        right: 12px;
        z-index: 3;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 18px;
        color: #ffffff;
        background: rgba(40, 40, 44, 0.92);
        -webkit-backdrop-filter: blur(20px);
        backdrop-filter: blur(20px);
      }
      .sound-level input {
        width: 160px;
        accent-color: #ffffff;
      }
      .picture img {
        width: auto;
        max-width: 100%;
      }
      /* While the camera wakes its last picture holds the place, and the player loads unseen behind it. */
      .live-wrap {
        position: relative;
        width: 100%;
      }
      /* The player and the picture standing in for it stay in the middle when they are narrower than the window. */
      .live-wrap .live,
      .live-wrap .poster {
        margin-inline: auto;
      }
      /* A quiet ring in the middle of the last picture while the camera wakes. */
      .waking {
        position: absolute;
        top: 50%;
        left: 50%;
        z-index: 1;
        box-sizing: border-box;
        width: 44px;
        height: 44px;
        margin: -22px 0 0 -22px;
        border: 3px solid rgba(255, 255, 255, 0.25);
        border-top-color: rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.25);
        animation: waking 900ms linear infinite;
      }
      @keyframes waking {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .waking {
          animation-duration: 2400ms;
        }
      }
      /* Zooming: the picture is scaled from its top left corner within the stage, which cuts off what goes past it.
         A finger moves the page as before until the picture is zoomed, then it moves the picture. */
      .stage {
        overflow: hidden;
        touch-action: pan-y;
      }
      .stage.zoomed {
        touch-action: none;
      }
      .stage > .picture,
      .stage > .live-wrap,
      .stage > video.clip {
        transform-origin: 0 0;
      }
      .zoom-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 3;
        padding: 3px 10px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 500;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.55);
      }
      /* The list of cameras: big pictures one under another, two side by side on a tablet. */
      /* The window scrolls as a whole, its heading with it, as a room does: no box of its own that cuts the cards. */
      .camera-cards {
        display: grid;
        flex: none;
        grid-template-columns: 1fr;
        grid-auto-rows: max-content;
        gap: 12px;
        padding: 0 16px 8px;
      }
      .camera-cell {
        position: relative;
        min-width: 0;
      }
      /* The recordings on a camera's card: by day, newest first, small pictures in a grid. */
      .sd-status {
        margin: 0 16px 8px;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
      }
      .sd-status.error {
        color: #ff6961;
      }
      .sd-days {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 0 16px 16px;
      }
      .sd-day {
        content-visibility: auto;
        contain-intrinsic-size: auto 400px;
      }
      .sd-day h3 {
        display: flex;
        gap: 8px;
        align-items: baseline;
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 500;
      }
      .sd-day h3::first-letter {
        text-transform: uppercase;
      }
      .sd-day h3 small {
        opacity: 0.6;
      }
      .remove-button {
        position: absolute;
        top: 6px;
        left: 6px;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.55);
        cursor: pointer;
        --mdc-icon-size: 18px;
      }
      .sd-clip {
        cursor: pointer;
      }
      .disk-more {
        padding: 16px;
        text-align: center;
      }
      button.sd-clip {
        cursor: pointer;
        color: #ffffff;
      }
      /* Upright the recordings button stands alone at the left end of the row over the line of time (last in a row laid
         from the right), the quick buttons stay at the right. */
      .quick .disk-button.upright {
        margin-right: auto;
      }
      .sd-day-action {
        display: inline-flex;
        gap: 4px;
        align-items: center;
        margin-left: auto;
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 14px;
        color: #ffffff;
        background: rgba(255, 255, 255, 0.14);
        --mdc-icon-size: 20px;
      }
      .sd-day-action.done {
        color: #30d158;
        background: none;
      }
      .sd-day-action.busy ha-icon {
        animation: sd-pulse 1.2s ease-in-out infinite;
      }
      .sd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 8px;
      }
      .sd-clip {
        position: relative;
        display: grid;
        place-items: center;
        overflow: hidden;
        aspect-ratio: 16 / 9;
        border-radius: 12px;
        background: #2c2c2e;
      }
      .sd-clip img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .sd-placeholder {
        opacity: 0.35;
        --mdc-icon-size: 32px;
      }
      .sd-text {
        position: absolute;
        inset: auto 0 0 0;
        display: grid;
        padding: 18px 8px 6px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
      }
      .sd-text strong {
        font-size: 14px;
        font-weight: 600;
      }
      .sd-text small {
        overflow: hidden;
        font-size: 11px;
        white-space: nowrap;
        text-overflow: ellipsis;
        opacity: 0.85;
      }
      .sd-mark {
        position: absolute;
        top: 6px;
        right: 6px;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.55);
        --mdc-icon-size: 20px;
      }
      .sd-mark.local {
        background: #30d158;
      }
      .sd-mark.busy ha-icon {
        animation: sd-pulse 1.2s ease-in-out infinite;
      }
      @keyframes sd-pulse {
        50% {
          opacity: 0.3;
        }
      }
      /* The live view of the big camera lies over its last picture, unseen until its video moves. */
      .wall-live {
        position: absolute;
        inset: 0;
        opacity: 0;
        pointer-events: none;
      }
      .wall-live.shown {
        opacity: 1;
      }
      .wall-live > * {
        display: block;
        width: 100%;
        height: 100%;
        --ha-card-border-radius: 0;
        --ha-card-border-width: 0;
      }
      .wall-resume {
        position: absolute;
        top: 50%;
        left: 50%;
        display: grid;
        place-items: center;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.5);
        transform: translate(-50%, -50%);
        --mdc-icon-size: 36px;
      }
      .camera-expand {
        position: absolute;
        right: 8px;
        bottom: 8px;
        z-index: 1;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.5);
        -webkit-backdrop-filter: blur(12px);
        backdrop-filter: blur(12px);
        --mdc-icon-size: 22px;
      }
      .camera-card {
        position: relative;
        display: block;
        flex: none;
        width: 100%;
        overflow: hidden;
        aspect-ratio: 16 / 9;
        padding: 0;
        border: 0;
        border-radius: 24px;
        color: #ffffff;
        background: #2c2c2e;
        cursor: pointer;
      }
      .camera-card img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .camera-card.off img {
        transform: scale(1.1);
        filter: blur(12px) brightness(0.5);
      }
      .camera-card-text {
        position: absolute;
        inset: auto 0 0 0;
        display: grid;
        gap: 2px;
        padding: 32px 16px 14px;
        text-align: left;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
      }
      .camera-card-text strong {
        font-size: 18px;
        font-weight: 600;
      }
      .camera-card-text small {
        font-size: 14px;
        opacity: 0.85;
      }
      /* A tablet: the cameras on the whole screen, black around them, in the chosen number of columns. */
      @media (min-width: 900px) {
        .panel.dark[data-kind="cameras"] {
          background: #000000;
        }
        .camera-cards {
          grid-template-columns: repeat(var(--camera-columns, 3), minmax(0, 1fr));
          gap: 10px;
          padding: 0 10px 10px;
        }
        .camera-card {
          border-radius: 14px;
        }
        .camera-card-text {
          inset: 0 0 auto 0;
          padding: 12px 14px 28px;
          background: linear-gradient(rgba(0, 0, 0, 0.55), transparent);
        }
        .camera-card-text strong {
          font-size: 16px;
        }
        .camera-card-text small {
          font-size: 13px;
        }
        /* One big camera over two rows and two columns, the rest small around it. */
        .camera-cards.featured .camera-cell.big {
          grid-row: span 2;
          grid-column: span 2;
        }
        .camera-cell.big .camera-card {
          height: 100%;
          aspect-ratio: auto;
        }
        header .columns {
          display: flex;
          gap: 4px;
          align-items: center;
          width: auto;
          padding: 0 12px;
          border-radius: 24px;
          font-size: 16px;
          font-weight: 600;
        }
      }
      /* A camera that went away: its last picture, dimmed, with the reason in the middle. */
      /* A still picture of a working camera: a tap in its middle starts the live view, as LIVE does. */
      /* Placed by its corner, not moved by a transform: the press of a finger scales it, and a transform it does not
         keep would throw it off the finger, and iOS would then drop the tap. */
      .play-live {
        position: absolute;
        z-index: 2;
        top: calc(50% - 38px);
        left: calc(50% - 38px);
        display: grid;
        place-items: center;
        width: 76px;
        height: 76px;
        border-radius: 50%;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.42);
        -webkit-backdrop-filter: blur(12px);
        backdrop-filter: blur(12px);
        --mdc-icon-size: 46px;
        transition: opacity 150ms ease;
      }
      /* Out of sight on an enlarged picture, but still there: two fingers that began on it go on moving the picture. */
      .stage > .stream-dot {
        top: calc(var(--media-top, 0px) + 12px);
        right: calc(var(--media-right, 0px) + 12px);
      }
      .play-live.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .camera-down {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: grid;
        place-items: center;
        padding: 16px;
        text-align: center;
        pointer-events: none;
        background: rgba(0, 0, 0, 0.55);
      }
      .camera-down span {
        padding: 8px 16px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 500;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.45);
      }
      .no-picture {
        width: min(100vw, 640px);
        aspect-ratio: 16 / 9;
        background: #1c1c1e;
      }
      /* Always there for a camera on a battery, so the window does not jump; faint while a recording plays. */
      .battery-hint.faint {
        opacity: 0.35;
      }
      .live-wrap:not(.shown) .live {
        position: absolute;
        inset: 0;
        opacity: 0;
        pointer-events: none;
      }
      .camera-body home-dashboard-intercom {
        padding: 0 16px;
      }
      .camera-body .hint {
        color: #c4c7cc;
      }
      .live-pill.recording {
        background: #d70015;
      }
      /* Grey while the camera wakes and the last picture stands in; the colour comes with the video. */
      .live-pill.waiting {
        background: #636366;
      }
      .live-pill .rec {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 6px;
        border-radius: 50%;
        vertical-align: 1px;
        background: #ff3b30;
      }
      .live-pill .rec {
        background: #ffffff;
      }
      .live-pill {
        position: absolute;
        top: 0;
        padding: 3px 12px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 500;
        background: #cc6f00;
      }
      .start-live {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        border-radius: 24px;
        color: #1b1b1f;
        background: #ffdf3d;
      }
      .player {
        display: flex;
        flex-direction: column;
        padding: 8px 20px;
      }
      .art {
        display: grid;
        flex: none;
        place-items: center;
        width: min(100%, 44vh);
        aspect-ratio: 1;
        align-self: center;
        overflow: hidden;
        border-radius: 12px;
        background: var(--hd-off);
        --mdc-icon-size: 64px;
      }
      .art img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .track-title {
        margin-top: 20px;
        font-size: 22px;
        font-weight: 400;
      }
      .artist {
        font-size: 15px;
        color: var(--hd-text-muted);
      }
      .progress {
        height: 6px;
        margin-top: 20px;
        overflow: hidden;
        border-radius: 3px;
        background: var(--hd-outline);
      }
      .progress span {
        display: block;
        height: 100%;
        background: var(--hd-control);
      }
      .times {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        font-size: 12px;
        color: var(--hd-text-muted);
      }
      .transport {
        align-items: center;
        gap: 32px;
        margin-top: 16px;
        --mdc-icon-size: 36px;
      }
      .transport button {
        display: grid;
        place-items: center;
        min-width: 56px;
        min-height: 56px;
      }
      .volume {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 12px;
      }
      .volume input {
        flex: 1;
        accent-color: var(--hd-control);
      }
      .extras {
        margin-top: 8px;
      }
      .extras button {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
      }
      .extras button.active {
        background: var(--hd-pill);
      }
      .landscape-only,
      .corner-live {
        display: none;
      }
      @media (min-width: 900px) {
        .cover:not(.whole) {
          display: none;
        }
        .panel[data-kind="chart"] {
          width: min(760px, calc(100vw - 64px));
        }
        .panel {
          inset: 50% auto auto 50%;
          width: 520px;
          max-height: calc(100vh - 48px);
          padding-top: 0;
          border-radius: 28px;
          transform: translate(-50%, calc(-50% + var(--hd-drag, 0px)));
          animation-name: rise-centre;
          background: color-mix(in srgb, var(--hd-sheet-bg, var(--hd-background)) var(--hd-sheet-opacity, 100%), transparent);
          -webkit-backdrop-filter: blur(var(--hd-sheet-blur, 0px));
          backdrop-filter: blur(var(--hd-sheet-blur, 0px));
        }
        .panel.whole {
          inset: 0;
          width: auto;
          max-height: none;
          padding-top: var(--hd-safe-top);
          border-radius: 0;
          transform: translateY(var(--hd-drag, 0px));
          animation-name: rise;
          background: transparent;
          -webkit-backdrop-filter: none;
          backdrop-filter: none;
        }
      }
      /* A phone or a tablet on its side: the camera on the whole screen, its name and buttons over it, the days
         hidden above, the line of time and the other cameras below, each brought out with its handle. LIVE stays in
         the corner. */
      @media (orientation: landscape) and (max-height: 500px), (orientation: landscape) and (min-width: 900px) and (pointer: coarse) {
        /* Clipped, not hidden: a hidden box can still be scrolled (a focused button, a list scrolled into view on
           iOS), which slid the header off the top and the put-away line of time into view. */
        .panel[data-kind="camera"] {
          padding: 0;
          overflow: clip;
        }
        .panel[data-kind="camera"] > .grip,
        .panel[data-kind="camera"] .hint,
        .panel[data-kind="camera"] .live-pill {
          display: none;
        }
        .panel[data-kind="camera"] header {
          position: absolute;
          top: 0;
          right: 0;
          left: 0;
          z-index: 4;
          /* Across the whole screen: close in the far left corner, the settings in the far right one (over the dark
             bands beside a narrower picture), the camera's own buttons set a little apart from the settings. What
             turns the camera stays on the picture. */
          /* Over a band above the picture (a tablet) the header fills the band, its buttons in its middle. */
          height: max(64px, var(--media-top, 0px));
          padding: 0 max(12px, env(safe-area-inset-right)) max(0px, calc(12px - var(--media-top, 0px)))
            max(12px, env(safe-area-inset-left));
          background: linear-gradient(rgba(0, 0, 0, 0.55), transparent);
        }
        .panel[data-kind="camera"] header > button:last-of-type {
          margin-left: 20px;
        }
        /* What stands at the bottom keeps to the picture's bottom edge, 16 px over it, when the picture leaves a band
           under it (a tablet); on a phone the picture reaches the bottom of the screen. */
        .camera-body {
          --media-foot: max(16px, calc(var(--media-bottom, 0px) + 12px));
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          gap: 0;
        }
        .camera-body .stage {
          position: absolute;
          inset: 0;
          width: auto;
          min-width: 0;
          min-height: 0;
        }
        .camera-body img,
        .camera-body .clip {
          max-height: 100dvh;
        }
        .camera-body .picture img {
          width: auto;
        }
        /* A camera away keeps the place of its picture, so the header and the buttons stay where they always are. */
        .camera-body .no-picture {
          width: min(100vw, 100dvh * 16 / 9);
        }
        .camera-body .clip {
          height: 100dvh;
          aspect-ratio: auto;
        }
        /* The player of Home Assistant keeps room for its own header, 97 px, unless told otherwise. */
        .camera-body .live {
          width: min(100%, 100dvh * 16 / 9);
          max-height: 100dvh;
          --video-max-height: 100dvh;
        }
        /* Under the header where it lies over the picture (a phone); in the corner where the header stands above it. */
        .camera-body .age,
        .camera-body .zoom-badge {
          top: max(8px, calc(64px - var(--media-top, 0px)));
          bottom: auto;
        }
        .camera-body .sound-level {
          top: 60px;
        }
        .camera-body home-dashboard-recording-days,
        .camera-body home-dashboard-timeline {
          position: absolute;
          left: 50%;
          z-index: 5;
          margin: 0;
          transition: transform 260ms cubic-bezier(0.2, 0.9, 0.25, 1);
        }
        /* Pinned near the top edge, over the header: whoever opens the days wants a date, not LIVE. */
        .camera-body home-dashboard-recording-days {
          top: 8px;
          width: min(70%, 520px);
          background: rgba(23, 24, 26, 0.85);
          transform: translate(-50%, calc(-100% - 16px));
        }
        .panel:has(.camera-body.days-open) header :is([data-open-days], [data-corner-live]),
        .camera-body.line-open .line-button {
          visibility: hidden;
        }
        .camera-body.days-open home-dashboard-recording-days {
          transform: translate(-50%, 0);
        }
        .camera-body home-dashboard-timeline {
          bottom: calc(var(--media-foot) - 8px);
          width: min(70%, 640px);
          box-sizing: border-box;
          padding: 4px 8px 8px;
          border-radius: 24px;
          background: rgba(23, 24, 26, 0.85);
          transform: translate(-50%, calc(100% + 16px + var(--media-bottom, 0px)));
        }
        .camera-body.line-open home-dashboard-timeline {
          transform: translate(-50%, 0);
        }
        header .landscape-only {
          display: grid;
          border-radius: 50%;
        }
        header .landscape-only.on {
          color: #17181a;
          background: #ffffff;
        }
        .line-button {
          position: absolute;
          right: max(16px, env(safe-area-inset-right));
          bottom: var(--media-foot);
          z-index: 4;
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          color: #ffffff;
          background: rgba(0, 0, 0, 0.5);
          -webkit-backdrop-filter: blur(12px);
          backdrop-filter: blur(12px);
        }
        /* The right column mirrors the left one: from the bottom the button of the line of time and the talk button,
           48 px with 12 px between. Both columns and the ring stand wholly on the picture, 12 px in from its edges:
           --media-left and --media-right are how far the picture's edges lie from the screen's (bands beside it). */
        .camera-body .stage .voice {
          right: max(16px, env(safe-area-inset-right), calc(var(--media-right, 0px) + 12px));
          bottom: calc(var(--media-foot) + 60px);
          width: 48px;
          height: 48px;
        }
        .line-button {
          right: max(16px, env(safe-area-inset-right), calc(var(--media-right, 0px) + 12px));
        }
        /* On its side the recordings button stands beside the button of the line of time, to its left; the one in
           the row of quick buttons, which stands in the left column here, is left out. */
        .quick .disk-button.upright {
          display: none;
        }
        .disk-button.side {
          position: absolute;
          right: calc(max(16px, env(safe-area-inset-right), calc(var(--media-right, 0px) + 12px)) + 60px);
          bottom: var(--media-foot);
          z-index: 4;
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          color: #ffffff;
          background: rgba(0, 0, 0, 0.5);
          -webkit-backdrop-filter: blur(12px);
          backdrop-filter: blur(12px);
        }
        .camera-body:is(.line-open, .cameras-open) .disk-button.side {
          visibility: hidden;
        }
        .camera-body .ptz-overlay {
          top: auto;
          right: max(16px, env(safe-area-inset-right), calc(var(--media-right, 0px) + 12px));
          bottom: calc(var(--media-foot) + 120px);
          transform: none;
        }
        /* On its side the quick buttons stand in a column in the bottom left corner, from the bottom, like the
           column on the right; they step aside for the line of time. */
        .camera-body .quick {
          position: absolute;
          bottom: var(--media-foot);
          left: max(16px, env(safe-area-inset-left), calc(var(--media-left, 0px) + 12px));
          z-index: 4;
          flex-direction: column-reverse;
          gap: 12px;
          margin: 0;
        }
        .camera-body .quick-button {
          width: 48px;
          height: 48px;
          background: rgba(0, 0, 0, 0.5);
        }
        .camera-body .quick-button.on {
          background: #ffd60a;
        }
        .camera-body .quick-button.alarm {
          background: #d70015;
        }
        /* On its side a list stands on the bottom of the column, whichever button opened it, and reaches at most
           up to under the header; a longer one scrolls. */
        .camera-body .quick-slot {
          position: static;
        }
        .camera-body .quick-menu {
          right: auto;
          bottom: 0;
          left: calc(100% + 10px);
          max-height: calc(100dvh - 120px);
        }
        .camera-body:is(.line-open, .cameras-open) .quick {
          visibility: hidden;
        }
        /* The other cameras come up from the bottom, like the line of time, and a drag down puts them away. */
        .camera-body .thumbs {
          position: absolute;
          bottom: calc(var(--media-foot) - 8px);
          left: 50%;
          z-index: 5;
          width: min(92%, 1100px);
          padding: 10px;
          border-radius: 24px;
          background: rgba(23, 24, 26, 0.85);
          visibility: hidden;
          transform: translate(-50%, calc(100% + 16px + var(--media-bottom, 0px)));
          transition:
            transform 260ms cubic-bezier(0.2, 0.9, 0.25, 1),
            visibility 260ms;
          touch-action: pan-x;
        }
        .camera-body.cameras-open .thumbs {
          visibility: visible;
          transform: translate(-50%, 0);
        }
        .camera-body.cameras-open .line-button {
          visibility: hidden;
        }
        .camera-body home-dashboard-recording-days {
          touch-action: none;
        }
        .camera-body home-dashboard-timeline {
          touch-action: pan-x;
        }
        /* LIVE sits in the header, by the sound, since the line of time with its own LIVE is hidden. */
        header .corner-live {
          display: block;
          width: auto;
          height: auto;
          margin-right: 4px;
          padding: 8px 14px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #ffffff;
          background: rgba(0, 0, 0, 0.5);
          -webkit-backdrop-filter: blur(12px);
          backdrop-filter: blur(12px);
        }
        .corner-live.on {
          color: #ff9f0a;
        }
      }
      /* A tablet on its side has more screen than a picture has pixels: the picture grows to the width of the screen,
         or to its height when it is the taller of the two, and never past either. */
      @media (orientation: landscape) and (min-width: 900px) and (pointer: coarse) {
        /* The other cameras come out in the middle of the band under the picture, kept off the screen's edge when
           there is no band; the line of time stays on the picture. */
        .camera-body .thumbs {
          bottom: max(40px, calc(var(--media-bottom, 0px) / 2));
          padding: 6px;
        }
        .camera-body.cameras-open .thumbs {
          transform: translate(-50%, 50%);
        }
        /* There they cover no button, so the buttons stay, the one of the line of time too, to put it away. */
        .camera-body:is(.line-open, .cameras-open) :is(.quick, .line-button) {
          visibility: visible;
        }
        /* The ring that turns the camera halfway down the picture, by its right edge. */
        .camera-body .ptz-overlay {
          top: calc((100% + var(--media-top, 0px) - var(--media-bottom, 0px)) / 2);
          bottom: auto;
          transform: translateY(-50%);
        }
        .camera-body .picture img,
        .camera-body .live-wrap .poster {
          width: 100vw;
          height: auto;
          max-width: 100vw;
          max-height: 100dvh;
          object-fit: contain;
        }
        .camera-body .no-picture {
          width: 100vw;
          max-height: 100dvh;
        }
      }
    `,
  ];
}
