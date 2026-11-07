// Full-screen controls, opened over the page: a centred panel on tablets. One element serves every
// kind, so a stream can never outlive its sheet: closing removes the card that holds it.

import { LitElement, css, html, nothing, svg } from "../vendor/lit-all.min.js";
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
  buildPlayer,
  buildTile,
  canUnlock,
  personalChoices,
  accessChoices,
  entityIcon,
  effectiveArea,
  intercomAreas,
  isBatteryCamera,
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
import { backgroundStyle, isDark, tokens } from "./styles.js";

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
const OWN_GESTURES = "[data-slider], .dial, .panel-card, .live, input, textarea, select, iframe, video";
const LIVE_LIMIT_MS = 120000;
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
  "app",
  "background",
  "block-edit",
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
  "pin",
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
    _bgEveryone: { state: true },
    _access: { state: true },
    _accessUser: { state: true },
    _users: { state: true },
    _pinState: { state: true },
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopLive();
    clearInterval(this._ticker);
    clearTimeout(this._commitTimer);
    this._stopVolume();
    this.removeEventListener("touchstart", this._touchStart);
    this.removeEventListener("touchmove", this._touchMove);
    this.removeEventListener("touchend", this._touchEnd);
    this.removeEventListener("touchcancel", this._touchEnd);
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("touchstart", this._touchStart, { passive: true });
    this.addEventListener("touchmove", this._touchMove, { passive: false });
    this.addEventListener("touchend", this._touchEnd);
    this.addEventListener("touchcancel", this._touchEnd);
  }

  willUpdate(changed) {
    if (changed.has("sheet")) {
      this._stopLive();
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
      this._tab = "cameras";
      this._access = null;
      if (["access", "block-edit", "tile-edit"].includes(this.sheet?.kind)) this._loadUsers();
      if (this.sheet?.kind === "tile-edit") this._startRule();
      if (this.sheet?.kind === "background") this._startBackground();
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
  }

  updated(changed) {
    if (this.sheet?.kind === "pin" && this._stateObj?.state === "off") this._close();
    if (changed.has("sheet") && this.sheet?.kind === "camera") {
      this.renderRoot.querySelector(".camera-thumb.current")?.scrollIntoView({ block: "nearest", inline: "center" });
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

  _details() {
    this.dispatchEvent(new CustomEvent("sheet-details", { detail: { entityId: this.sheet.entityId } }));
  }

  _renderHeader(title, dark = false, details = true) {
    return html`
      <header class=${dark ? "dark" : ""}>
        <button aria-label=${this._t("close")} @click=${this._close}><ha-icon icon="mdi:close"></ha-icon></button>
        <h2>${title}</h2>
        ${details
          ? html`<button aria-label=${this._t("details")} data-details @click=${this._details}>
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
    await this._mountLive({
      type: "picture-entity",
      entity: cameraId,
      camera_view: "live",
      show_name: false,
      show_state: false,
      tap_action: { action: "none" },
    });
    if (this._live) this._liveTimer = setTimeout(() => this._stopLive(), LIVE_LIMIT_MS);
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
  }

  _stopLive() {
    clearTimeout(this._liveTimer);
    this._liveCard?.remove();
    this._liveCard = undefined;
    this._live = false;
  }

  _showCamera(entityId) {
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

  _renderCameraThumbs(cameras) {
    if (cameras.length < 2) return nothing;
    return html`
      <div class="thumbs" data-thumbs>
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

  _renderCamera() {
    const cameras = buildCameras(this.hass, this.config).filter((camera) => !camera.unavailable);
    const shown = cameras.find((camera) => camera.entityId === this.sheet.entityId);
    if (!shown) return this._renderHeader("", true, false);
    const cameraId = liveCameraFor(this.hass, this.sheet.entityId, this.config);
    const battery = cameraId && isBatteryCamera(this.hass, cameraId, this.config);
    const room = this._cameraRoom();
    return html`
      ${this._renderHeader(shown.name, true)}
      <div class="body camera-body">
        ${this._live ? html`<span class="live-pill">${this._t("live")}</span>` : nothing}
        ${this._live
          ? html`<div class="live" data-live></div>`
          : html`<div class="picture">
              <img src=${this.hass.hassUrl(shown.picture)} alt="" />
              <span class="age">${pictureAge(this.hass.language, shown.updatedAt, Date.now())}</span>
            </div>`}
        <div class="camera-actions">
          ${this._live || !cameraId
            ? nothing
            : html`
                <button class="start-live" data-start-live @click=${() => this._startLive(cameraId)}>
                  <ha-icon icon="mdi:play"></ha-icon>${this._t("start_live")}
                </button>
              `}
          ${room
            ? html`
                <button
                  class="voice"
                  aria-label=${this._t("intercom_to", { room: room.name })}
                  data-voice
                  @click=${() => this._startVoice(room)}
                >
                  <ha-icon icon="mdi:microphone-message"></ha-icon>
                </button>
              `
            : nothing}
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
        ${this._live ? nothing : battery ? html`<p class="hint">${this._t("battery_hint")}</p>` : nothing}
        ${!this._live && !cameraId ? html`<p class="hint">${this._t("no_live")}</p>` : nothing}
        ${this._renderCameraThumbs(cameras)}
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

  _renderIntercom() {
    const { areas, label, recorder } = this.sheet;
    return html`
      ${this._renderHeader(label, false, false)}
      <div class="rows">
        <home-dashboard-intercom
          .hass=${this.hass}
          .config=${this.config}
          .areas=${areas}
          .label=${label}
          .recorder=${recorder}
          @intercom-close=${this._close}
        ></home-dashboard-intercom>
      </div>
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

  _movePersonal(list, index, delta) {
    const order = list.map((item) => item.id);
    const [moved] = order.splice(index, 1);
    order.splice(index + delta, 0, moved);
    savePrefs(this.hass, { ...personalPrefs(), [this._tab]: order });
    this.requestUpdate();
  }

  _togglePersonal(id) {
    const key = `hidden_${this._tab}`;
    const prefs = personalPrefs();
    const hidden = prefs[key] ?? [];
    const next = hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id];
    savePrefs(this.hass, { ...prefs, [key]: next });
    this.requestUpdate();
  }

  _renderPersonal() {
    const choices = personalChoices(this.hass, this.raw, this.hass.user?.id, personalPrefs());
    const list = choices[this._tab];
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
        ])}
        ${list.map(
          (item, index) => html`
            <div class="order-row ${item.hidden ? "muted" : ""}" data-order=${item.id}>
              <span>${item.name}</span>
              ${button("personal_hide", item.hidden ? "mdi:eye-off-outline" : "mdi:eye-outline", false, () => this._togglePersonal(item.id), "hide")}
              ${button("personal_up", "mdi:arrow-up", index === 0, () => this._movePersonal(list, index, -1), "up")}
              ${button("personal_down", "mdi:arrow-down", index === list.length - 1, () => this._movePersonal(list, index, 1), "down")}
            </div>
          `,
        )}
        <button class="block-action" data-personal-reset @click=${() => this._resetPersonal()}>
          <span>${this._t("personal_reset")}</span>
        </button>
      </div>
    `;
  }

  _resetPersonal() {
    savePrefs(this.hass, {});
    this.requestUpdate();
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
    const key = this._tab === "rooms" ? "rooms" : "hide";
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
        <small>${this._t("access_hidden", { count: this._accessHidden("hide").length + this._accessHidden("rooms").length })}</small>
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
    const value = (mode) => (mode in own ? own[mode] : shared[mode]);
    this._bg = { light: value("light"), dark: value("dark") };
    this._bgMode = isDark() ? "dark" : "light";
    this._bgEveryone = { light: admin && !("light" in own), dark: admin && !("dark" in own) };
  }

  _pickBackground(value) {
    this._bg = { ...this._bg, [this._bgMode]: value };
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
      if (this._bgEveryone[mode]) nextShared[mode] = this._bg[mode];
      else own[mode] = this._bg[mode];
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
    const value = this._bg[mode];
    const admin = this.hass.user?.is_admin;
    return html`
      <div class="look ${this._bgMode === mode ? "on" : ""}" data-look=${mode}>
        <button class="look-preview" style=${value ? backgroundStyle(value) : nothing} @click=${() => (this._bgMode = mode)}>
          ${value ? nothing : html`<small>${this._t("background_none")}</small>`}
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

  _renderBackground() {
    const current = this._bg[this._bgMode];
    return html`
      ${this._renderHeader(this._t("screen_background"), false, false)}
      <div class="rows">
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
          <input type="color" data-colour @change=${(event) => this._pickBackground(event.target.value)} />
        </label>
        <label class="field">
          <span>${this._t("background_picture")}</span>
          <input type="file" accept="image/*" data-picture @change=${this._uploadBackground} />
        </label>
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
    const { item, onRename, onRemove, onRule } = this.sheet;
    const save = () => {
      onRename(this.renderRoot.querySelector("[data-tile-name]").value);
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
    const stats = panelStats(this.hass, item);
    return html`
      ${this._renderHeader(item.name, false, false)}
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
      panel: this._renderPanel,
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
      "block-edit": this._renderBlockEdit,
      overview: this._renderOverview,
      host: this._renderHost,
      page: this._renderPage,
      pin: this._renderPin,
      personal: this._renderPersonal,
      access: this._renderAccess,
      light: this._renderLight,
      switch: this._renderSwitch,
      alarm: this._renderAlarm,
    };
    const dark = this.sheet.kind === "camera";
    const { item } = this.sheet;
    const whole = dark || ["app", "block-edit", "blocks", "history", "host", "logbook", "page", "school"].includes(this.sheet.kind) || Boolean(item?.frame || item?.fullscreen);
    return html`
      <div class="scrim" @click=${this._close}></div>
      <div class="cover ${dark ? "dark" : ""} ${whole ? "whole" : ""}"></div>
      <section class="panel ${dark ? "dark" : ""} ${whole ? "whole" : ""}" data-kind=${this.sheet.kind}>
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
        background: rgba(0, 0, 0, 0.45);
        animation: fade 240ms ease-out;
      }
      /* iOS draws the page under its bars, where a panel with inset: 0 does not reach. */
      .cover {
        position: fixed;
        inset: -120px 0;
        z-index: 7;
        transform: translateY(var(--hd-drag, 0px));
        background: var(--hd-background);
        animation: rise 320ms cubic-bezier(0.2, 0.9, 0.25, 1);
      }
      .cover.dark {
        background: #17181a;
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
        background: var(--hd-background);
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
      .field input[type="range"] {
        flex: 1;
        min-width: 0;
        max-width: 55%;
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
      .center {
        display: flex;
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
      .age {
        position: absolute;
        bottom: 8px;
        left: 8px;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 13px;
        color: #fff;
        background: rgba(0, 0, 0, 0.5);
      }
      .camera-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      .voice {
        display: grid;
        flex: none;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        color: #fff;
        background: rgba(255, 255, 255, 0.16);
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
      .camera-body img,
      .live {
        display: block;
        width: 100%;
        max-height: 60vh;
        object-fit: contain;
      }
      .picture img {
        width: auto;
        max-width: 100%;
      }
      .camera-body home-dashboard-intercom {
        padding: 0 16px;
      }
      .camera-body .hint {
        color: #c4c7cc;
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
      @media (min-width: 900px) {
        .cover:not(.whole) {
          display: none;
        }
        .panel {
          inset: 50% auto auto 50%;
          width: 520px;
          max-height: calc(100vh - 48px);
          padding-top: 0;
          border-radius: 28px;
          transform: translate(-50%, calc(-50% + var(--hd-drag, 0px)));
          animation-name: rise-centre;
        }
        .panel.whole {
          inset: 0;
          width: auto;
          max-height: none;
          padding-top: var(--hd-safe-top);
          border-radius: 0;
          transform: translateY(var(--hd-drag, 0px));
          animation-name: rise;
        }
      }
    `,
  ];
}
