// The windows of single entities: thermostat, cover, light, PIN, switch, sensors and lists, alarm and lock. A part of the sheet (sheet.js), as a mixin of its methods.

import { html, nothing, svg } from "../vendor/lit-all.min.js";
import {
  arcPath,
  clamp,
  coverEstimate,
  DIAL_START,
  DIAL_SWEEP,
  dialAngle,
  dialValue,
  lockIntent,
  sliderRatio,
  startCoverMotion,
  stepTemperature,
} from "./controls.js";
import { ALERT_CLASSES, buildTile, canUnlock, domainOf, optionLabel } from "./model.js";
import {
  ALARM_MODES,
  COLOUR_MODES,
  COLOUR_PRESETS,
  COMMIT_DELAY_MS,
  COVER_SET_POSITION,
  COVER_STOP,
  DIAL_RADIUS,
  DIAL_SIZE,
  LIGHT_HOLD_MS,
  PIN_LENGTH,
  PIN_SETTLE_MS,
  WHITE_PRESETS,
} from "./sheet-shared.js";

export const EntitySheets = (Base) =>
  class extends Base {
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
                    ${effects.map(
                      (effect) => html`<option value=${effect} ?selected=${effect === attributes.effect}>${this._effectName(effect)}</option>`,
                    )}
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

    // An automation is only switched on and off here; what it does is set in Home Assistant, behind the cog.
    _renderSwitch() {
      const { attributes, state } = this._stateObj;
      const automation = this.sheet.entityId.startsWith("automation.");
      const on = state === "on";
      const label = this.hass.formatEntityState?.(this._stateObj) ?? state;
      const power = automation ? null : this._deviceSensor(this.sheet.entityId, "power");
      return html`
        ${this._renderHeader(this.sheet.name ?? attributes.friendly_name)}
        <div class="body center">
          <button
            class="big-switch ${on ? "on" : ""} ${power ? "short" : ""}"
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
        ${this._renderInfo([
          { icon: "mdi:toggle-switch-outline", text: label },
          automation && { icon: "mdi:history", text: this._lastTriggered(attributes.last_triggered) },
        ])}
        ${power ? this._renderSwitchPower(power) : nothing}
      `;
    }

    // The name of a light's effect as Home Assistant translates it; "off" of a Hue lamp said in words.
  _effectName(effect) {
    const name = this.hass.formatEntityAttributeValue?.(this._stateObj, "effect", effect) ?? effect;
    return ["off", "none"].includes(String(name).toLowerCase()) ? this._t("light_effect_none") : name;
  }

  _lastTriggered(iso) {
      return iso ? this._t("automation_last", { when: this._ago(iso) }) : this._t("automation_never");
    }

    _ago(iso) {
      const minutes = Math.round((new Date(iso) - Date.now()) / 60000);
      const format = new Intl.RelativeTimeFormat(this.hass.language, { numeric: "auto" });
      if (minutes > -60) return format.format(minutes, "minute");
      return minutes > -1440 ? format.format(Math.round(minutes / 60), "hour") : format.format(Math.round(minutes / 1440), "day");
    }

    // Sensors and lists ---------------------------------------------------------------------------

    // The battery of the device of an entity: a leak sensor says nothing when it is flat.
    _deviceBattery(entityId) {
      const value = Number.parseFloat(this.hass.states[this._deviceSensor(entityId, "battery")]?.state);
      return Number.isFinite(value) ? Math.round(value) : null;
    }

    /** A sensor of this class on the same device as the entity (the power of a plug, the battery of a sensor). */
    _deviceSensor(entityId, deviceClass) {
      const device = this.hass.entities?.[entityId]?.device_id;
      if (!device) return null;
      return (
        Object.keys(this.hass.entities).find(
          (other) =>
            this.hass.entities[other].device_id === device &&
            domainOf(other) === "sensor" &&
            !this.hass.entities[other].hidden &&
            this.hass.states[other]?.attributes?.device_class === deviceClass,
        ) ?? null
      );
    }

    // A plug that measures what it lets through: the power now, the energy so far and a line of the power.
    _renderSwitchPower(power) {
      const energy = this._deviceSensor(this.sheet.entityId, "energy");
      const number = (id, digits) => {
        const stateObj = this.hass.states[id];
        const value = Number.parseFloat(stateObj?.state);
        if (!Number.isFinite(value)) return "–";
        const text = value.toLocaleString(this.hass.language, { minimumFractionDigits: digits, maximumFractionDigits: digits });
        return `${text} ${stateObj.attributes.unit_of_measurement ?? ""}`.trim();
      };
      this._sensorCharts ??= new Map();
      if (!this._sensorCharts.has(power)) {
        this._sensorCharts.set(power, { mode: "lines", now: false, lines: [{ id: power, name: this._t("chart_power"), unit: "W" }] });
      }
      return html`
        <div class="switch-power" data-switch-power=${power}>
          <div class="switch-power-facts">
            <span><small>${this._t("chart_power")}</small><strong data-switch-watts>${number(power, 1)}</strong></span>
            ${energy ? html`<span><small>${this._t("host_energy_total")}</small><strong>${number(energy, 2)}</strong></span>` : nothing}
          </div>
          <home-dashboard-history-chart .hass=${this.hass} .chart=${this._sensorCharts.get(power)}></home-dashboard-history-chart>
        </div>
      `;
    }

    _changedInfo(stateObj) {
      return stateObj.last_changed ? { icon: "mdi:history", text: this._t("state_changed", { when: this._ago(stateObj.last_changed) }) } : null;
    }

    // Something on or off (a leak, smoke, a door): its state at a glance, then when it was on.
    _renderBinary() {
      const stateObj = this._stateObj;
      const tile = buildTile(this.hass, this.sheet.entityId, null, this.config, this.layout);
      const battery = this._deviceBattery(this.sheet.entityId);
      const on = stateObj.state === "on";
      return html`
        ${this._renderHeader(this.sheet.name ?? stateObj.attributes.friendly_name)}
        <div class="body center state-body">
          <span class="state-badge ${on ? tile.tone : "off"}" data-state-badge><ha-icon .icon=${tile.icon}></ha-icon></span>
          <strong class="state-text" data-state-text>${tile.stateText}</strong>
        </div>
        ${this._renderInfo([
          this._changedInfo(stateObj),
          battery !== null && { icon: battery < 20 ? "mdi:battery-alert-variant-outline" : "mdi:battery", text: this._t("state_battery", { value: battery }) },
        ])}
        <home-dashboard-state-history class="sheet-history" .hass=${this.hass} .entity=${this.sheet.entityId}
          ?alarm=${ALERT_CLASSES.has(tile.deviceClass)}></home-dashboard-state-history>
      `;
    }

    // A list to choose from (a drink of a coffee machine, a mode): every option as a button. A tile with `confirm`
    // runs nothing on a touch: the touch marks an option and its button runs it, as a drink should not be made by
    // brushing the screen. A tile's `labels` name the options in place of the integration's names.
    _renderSelect() {
      const stateObj = this._stateObj;
      const tile = buildTile(this.hass, this.sheet.entityId, null, this.config, this.layout);
      const options = stateObj.attributes.options ?? [];
      const own = this.sheet.labels ?? {};
      const labels = Object.fromEntries(options.map((option) => [option, own[option] ?? optionLabel(this.hass, stateObj, option)]));
      const confirm = Boolean(this.sheet.confirm);
      const picked = confirm && this._picked?.entity === this.sheet.entityId ? this._picked.option : null;
      const row = {
        entity: this.sheet.entityId,
        name: this._t(confirm ? "select_pick" : "select_choose"),
        labels,
        current: confirm ? picked : undefined,
        onPick: confirm ? (option) => (this._picked = { entity: this.sheet.entityId, option }) : undefined,
      };
      const run = () => {
        this._selectOption(this.sheet.entityId, picked);
        this._picked = null;
      };
      return html`
        ${this._renderHeader(this.sheet.name ?? stateObj.attributes.friendly_name)}
        ${this._renderInfo([{ icon: tile.icon, text: labels[stateObj.state] ?? tile.stateText }, this._changedInfo(stateObj)])}
        <div class="rows select-body">
          ${this._renderChoices(row, stateObj)}
          ${confirm
            ? html`<button class="select-run" data-select-run ?disabled=${!picked || stateObj.state === "unavailable"} @click=${run}>
                <ha-icon icon="mdi:play"></ha-icon>
                <span>${picked ? this._t("select_run", { option: labels[picked] }) : this._t("select_run_none")}</span>
              </button>`
            : nothing}
        </div>
      `;
    }

    // A number: its value and its line, in the dashboard's own chart.
    _renderSensor() {
      const stateObj = this._stateObj;
      const tile = buildTile(this.hass, this.sheet.entityId, null, this.config, this.layout);
      this._sensorCharts ??= new Map();
      const id = this.sheet.entityId;
      if (!this._sensorCharts.has(id)) {
        const unit = stateObj.attributes.unit_of_measurement;
        this._sensorCharts.set(id, { mode: "lines", now: false, lines: [{ id, name: this.sheet.name ?? stateObj.attributes.friendly_name, unit }] });
      }
      return html`
        ${this._renderHeader(this.sheet.name ?? stateObj.attributes.friendly_name)}
        <div class="body center state-body">
          <span class="state-badge off"><ha-icon .icon=${tile.icon}></ha-icon></span>
          <strong class="state-text" data-state-text>${tile.stateText}</strong>
        </div>
        ${this._renderInfo([this._changedInfo(stateObj)])}
        <home-dashboard-history-chart class="sheet-history" .hass=${this.hass} .chart=${this._sensorCharts.get(id)}></home-dashboard-history-chart>
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
  };
