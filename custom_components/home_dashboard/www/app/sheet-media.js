// The remote of a TV, the volume and the player. A part of the sheet (sheet.js), as a mixin of its methods.

import { html, nothing } from "../vendor/lit-all.min.js";
import { formatTime } from "./controls.js";
import { buildPlayer, nextRepeat } from "./model.js";
import { isTvOn, matchSource, rememberedSources, runAction, selectSourceAfterStart, tvStatus } from "./panel.js";
import {
  APPLE_ARROWS,
  APPLE_KEYS,
  CHOICE_LIMIT,
  VOLUME_HOLD_MS,
  VOLUME_STEP_MS,
  WEBOS_ARROWS,
  WEBOS_KEYS,
} from "./sheet-shared.js";

export const MediaSheets = (Base) =>
  class extends Base {
    // Remote ----------------------------------------------------------------------------------

    _tvSource(source) {
      const { item, entityId } = this.sheet;
      if (isTvOn(this._stateObj)) {
        this.hass.callService("media_player", "select_source", { entity_id: entityId, source });
      } else if (item.source_script) {
        const [domain, service] = item.source_script.service.split(".");
        this.hass.callService(domain, service, { [item.source_script.field]: source });
      } else {
        runAction(this.hass, this._tvPower(item, false));
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
            ${button("tv_power", "mdi:power", () => runAction(this.hass, this._tvPower(item, on)), on)}
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
          ${this._renderTvNowPlaying(stateObj)}
          ${this._renderTvKeys(stateObj, on)}
          ${on && attributes.volume_level != null
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

    // Without its own way to start and stop, a player starts and stops itself (an Apple TV wakes and sleeps).
    _tvPower(item, on) {
      const own = on ? item.off : item.on;
      return own ?? { service: on ? "media_player.turn_off" : "media_player.turn_on", target: this.sheet.entityId };
    }

    // The remote entity of the player's device, for an Apple TV.
    get _appleRemote() {
      const entities = this.hass.entities ?? {};
      const device = entities[this.sheet.entityId]?.device_id;
      if (!device || entities[this.sheet.entityId]?.platform !== "apple_tv") return null;
      return Object.keys(entities).find((id) => id.startsWith("remote.") && entities[id].device_id === device) ?? null;
    }

    _renderTvKeys(stateObj, on) {
      if (this.hass.entities?.[stateObj.entity_id]?.platform === "webostv") return this._renderWebosKeys(on);
      const remote = this._appleRemote;
      if (!remote) return nothing;
      const send = (command) => this.hass.callService("remote", "send_command", { entity_id: remote, command });
      return this._renderRemoteKeys(APPLE_ARROWS, APPLE_KEYS, on, send);
    }

    // What plays now on a TV box: its picture, title and what it comes from, with the buttons to move through it.
    _renderTvNowPlaying(stateObj) {
      const { attributes } = stateObj;
      if (!isTvOn(stateObj) || !attributes.media_title) return nothing;
      const picture = attributes.entity_picture ? this.hass.hassUrl?.(attributes.entity_picture) ?? attributes.entity_picture : null;
      const detail = [attributes.media_series_title ?? attributes.media_artist, attributes.app_name].filter(Boolean).join(" · ");
      const playing = stateObj.state === "playing";
      return html`
        <div class="tv-now" data-tv-now>
          ${picture ? html`<img src=${picture} alt="" />` : html`<span class="tv-now-icon"><ha-icon icon="mdi:play-box-outline"></ha-icon></span>`}
          <span class="tv-now-text"><strong>${attributes.media_title}</strong>${detail ? html`<small>${detail}</small>` : nothing}</span>
          <button class="tv-now-play" aria-label=${this._t(playing ? "tv_key_pause" : "tv_key_play")} data-tv-now-play
            @click=${() => this._call("media_player", "media_play_pause")}>
            <ha-icon .icon=${playing ? "mdi:pause" : "mdi:play"}></ha-icon>
          </button>
        </div>
      `;
    }

    _webosButton(button) {
      this.hass.callService("webostv", "button", { entity_id: this.sheet.entityId, button });
    }

    // A TV that is off cannot take keys, so they wait in grey until it starts.
    _renderWebosKeys(on) {
      return this._renderRemoteKeys(WEBOS_ARROWS, WEBOS_KEYS, on, (button) => this._webosButton(button));
    }

    _renderRemoteKeys(arrows, keys, on, send) {
      const key = ({ key, button, icon, label, place }) => html`
        <button
          class="key ${place ?? ""}"
          aria-label=${this._t(key)}
          data-tv-key=${button}
          ?disabled=${!on}
          @click=${() => send(button)}
        >
          ${icon ? html`<ha-icon .icon=${icon}></ha-icon>` : label}
        </button>
      `;
      return html`
        <div class="dpad">${arrows.map(key)}</div>
        <div class="keys ${keys.length % 4 ? "three" : ""}">${keys.map(key)}</div>
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
  };
