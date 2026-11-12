// The window of a camera: its picture, live view, sound, turning and quick buttons. A part of the sheet (sheet.js), as a mixin of its methods.

import { html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { createRecorder } from "./intercom.js";
import { effectiveArea, intercomAreas, liveCameraFor } from "./model.js";
import { localDay, recordingSource } from "./recordings.js";
import {
  LANDSCAPE_PHONE,
  LIVE_HEAR_MS,
  LIVE_HEAR_TICK_MS,
  LIVE_LIMIT_MS,
  LIVE_WATCH_MS,
  PICTURE_RETRY_MS,
  SOUND_HOLD_MS,
  SWIPE_AWAY_PX,
  TALK_PROBLEM_MS,
} from "./sheet-shared.js";
import { createSoundMixer, hasSound } from "./sound.js";
import { microphoneReachable, startTalk, TALK_LIMIT_MS } from "./talk.js";
import { clipFor, PictureZoom } from "./zoom.js";

export const CameraSheets = (Base) =>
  class extends Base {
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
      // Talking through a camera only to someone who can be seen: the live view must be moving first. Over plain
      // http:// the browser gives no microphone, so the button is crossed out and only says why.
      const seeing = this._live && this._liveShown;
      const blocked = !talking && !microphoneReachable();
      const waiting = !talking && !blocked && !seeing;
      const label = talking
        ? this._talkState === "connecting" ? "talk_connecting" : "talk_stop"
        : blocked ? "talk_https" : seeing ? "talk_camera" : "talk_needs_live";
      return html`
        <button
          class="voice camera-talk ${talking ? "on" : ""} ${talking && this._talkState === "connecting" ? "connecting" : ""}
            ${blocked ? "blocked" : ""} ${waiting ? "waiting" : ""}"
          aria-label=${this._t(label)}
          aria-pressed=${talking ? "true" : "false"}
          aria-disabled=${blocked || waiting ? "true" : "false"}
          ?disabled=${this._talkBusy}
          data-camera-talk
          @click=${() => {
            if (talking) this._stopTalk();
            else if (blocked) this._sayTalkProblem("https");
            else if (waiting) this._sayTalkProblem("needs_live");
            else this._startTalk(talk.speaker);
          }}
        >
          <ha-icon icon=${talking ? "mdi:microphone" : blocked ? "mdi:microphone-off" : "mdi:account-voice"}></ha-icon>
        </button>
      `;
    }

    // Why talking did not start or ended, for a few seconds: on a screen on its side it lies over the picture.
    _sayTalkProblem(reason) {
      clearTimeout(this._talkProblemTimer);
      this._talkProblem = reason;
      this._talkProblemTimer = setTimeout(() => (this._talkProblem = null), TALK_PROBLEM_MS);
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
            if (reason) this._sayTalkProblem(reason);
          },
        });
        this._talking = session;
        // Talking ends by itself after a while, so a forgotten button does not keep the camera's speaker on.
        this._talkTimer = setTimeout(() => this._stopTalk(), TALK_LIMIT_MS);
      } catch (error) {
        this._sayTalkProblem(error.reason ?? "failed");
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
  };
