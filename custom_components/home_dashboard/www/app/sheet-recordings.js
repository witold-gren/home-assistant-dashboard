// All cameras, and the recordings on a camera's own card and on the disk of Home Assistant. A part of the sheet (sheet.js), as a mixin of its methods.

import { html, nothing } from "../vendor/lit-all.min.js";
import { clipThumbnail } from "./clip-thumbs.js";
import { streamDot } from "./connections.js";
import { translate } from "./i18n.js";
import {
  buildCameras,
  CAMERA_COLUMNS,
  CAMERA_LAYOUTS,
  cameraMoves,
  cameraQuickControls,
  cameraSettingsPanel,
  cameraStreaming,
  cameraStreamSensors,
  domainOf,
  isBatteryCamera,
  liveCameraFor,
  pictureAge,
  presetCalls,
} from "./model.js";
import { localDay, recordingSource } from "./recordings.js";
import {
  CAMERA_CARDS_REFRESH_MS,
  CAMERA_COLUMNS_KEY,
  CAMERA_LAYOUT_KEY,
  DISK_DAYS_AT_ONCE,
  DISK_MIN_CLIPS,
  LANDSCAPE_PHONE,
  LIVE_LIMIT_MS,
  LIVE_WATCH_MS,
  onOff,
  SD_GIVE_UP_MS,
  SD_POLL_MS,
  SD_THUMBNAILS_AT_ONCE,
  TABLET,
} from "./sheet-shared.js";
import { talkMode } from "./talk.js";

export const RecordingSheets = (Base) =>
  class extends Base {
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
          ${this._talkProblem
            ? html`<p class="hint talk-problem" role="status" data-talk-problem>${this._t(`talk_${this._talkProblem}`)}</p>`
            : nothing}
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
  };
