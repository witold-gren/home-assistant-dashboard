// Recordings of a Frigate camera in its window: a row of days at the top, and at the bottom a line of the day's time
// that is moved sideways to choose a moment. The recording plays in the same place as the picture and the live view,
// so the window only ever shows one of them. Everything comes through the Frigate integration of Home Assistant.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const PX_PER_HOUR = 360;
// Frigate keeps short pieces; pieces this close together are one stretch of recording on the line.
const JOIN_GAP_S = 3;
// A recording is asked for in parts, so a long stretch starts at once and the next part follows when one ends.
const CHUNK_S = 600;
const SETTLE_MS = 350;
const REFRESH_AFTER_LIVE_MS = 5000;
// Holding the line still this long shows the whole day on it, to move far at once.
const OVERVIEW_HOLD_MS = 400;
const HOLD_SLOP_PX = 8;
const SWIPE_PX = 40;
const EVENTS_LIMIT = 500;
const HLS = "application/vnd.apple.mpegurl";

// The Frigate camera behind an entity: the camera itself, or the camera of the same device.
export function frigateCamera(hass, entityId) {
  const of = (id) => {
    const stateObj = hass.states[id];
    const { camera_name: camera, client_id: instance } = stateObj?.attributes ?? {};
    const frigate = hass.entities[id]?.platform === "frigate" || Boolean(instance && camera);
    return id?.startsWith("camera.") && frigate && camera ? { instance: instance ?? "frigate", camera } : null;
  };
  const direct = of(entityId);
  if (direct) return direct;
  const deviceId = hass.entities[entityId]?.device_id;
  if (!deviceId) return null;
  const sibling = Object.keys(hass.entities).find((id) => hass.entities[id].device_id === deviceId && of(id));
  return sibling ? of(sibling) : null;
}

// Frigate answers some of its messages with JSON as text.
const parsed = (answer) => (typeof answer === "string" ? JSON.parse(answer) : answer);
const pad = (number) => String(number).padStart(2, "0");

export function localDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateOf(day) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

export function shiftDay(day, days) {
  const date = dateOf(day);
  date.setDate(date.getDate() + days);
  return localDay(date);
}

export function dayBounds(day) {
  const start = dateOf(day);
  const end = dateOf(shiftDay(day, 1));
  return { after: Math.floor(start.getTime() / 1000), before: Math.floor(end.getTime() / 1000) };
}

// The seven days, Monday first, of the week a day is in.
export function weekOf(day) {
  const monday = shiftDay(day, -((dateOf(day).getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftDay(monday, index));
}

// Pieces of recording joined into the stretches shown on the line.
export function recordedRanges(segments, gap = JOIN_GAP_S) {
  const ranges = [];
  for (const { start_time: start, end_time: end } of [...segments].sort((a, b) => a.start_time - b.start_time)) {
    const last = ranges.at(-1);
    if (last && start - last.end <= gap) last.end = Math.max(last.end, end);
    else ranges.push({ start, end });
  }
  return ranges;
}

// What plays from a moment: from that moment when it was recorded, else from the next stretch of recording.
export function clipAt(ranges, time, chunk = CHUNK_S) {
  const inside = ranges.find((range) => range.start <= time && time < range.end - 1);
  const range = inside ?? ranges.find((candidate) => candidate.start > time);
  if (!range) return null;
  const start = Math.floor(inside ? time : range.start);
  return { start, end: Math.ceil(Math.min(range.end, start + chunk)) };
}

// iPhone and iPad play the stream of Frigate themselves; other browsers get the same part as one file.
export function playsHls() {
  return Boolean(document.createElement("video").canPlayType(HLS));
}

export async function clipUrl(hass, frigate, clip, hls = playsHls()) {
  const { instance, camera } = frigate;
  const range = `${camera}/start/${clip.start}/end/${clip.end}`;
  const path = hls ? `/api/frigate/${instance}/vod/${range}/index.m3u8` : `/api/frigate/${instance}/recording/${range}`;
  const { path: signed } = await hass.callWS({ type: "auth/sign_path", path, expires: 3600 });
  return hass.hassUrl(signed);
}

// Where a camera's recordings come from ----------------------------------------------------------

const FILE_NAME = /^(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.mp4$/;
// The media folder of Home Assistant: without a folder of its own Home Assistant names it "local"; one named
// in media_dirs is tried next.
const MEDIA_ROOTS = ["media-source://media_source/local", "media-source://media_source/media"];
// Where the eufy bridge keeps recorded live views, in the media folder.
const FILE_FOLDERS = MEDIA_ROOTS.map((root) => `${root}/eufy`);

/**
 * A camera whose live views are recorded: its device has a "record live view" switch. The switch may say
 * where its recordings are in the media folder (`recordings_path`, e.g. Neolink's `neolink/<camera>`);
 * without it they are the eufy bridge's, in a folder named after the serial number.
 */
export function recordedLiveCamera(hass, entityId) {
  const deviceId = hass.entities[entityId]?.device_id;
  if (!deviceId) return null;
  const toggle = Object.keys(hass.entities).find(
    (id) => id.startsWith("switch.") && id.endsWith("_record_live") && hass.entities[id].device_id === deviceId,
  );
  if (!toggle) return null;
  const path = hass.states[toggle]?.attributes?.recordings_path;
  if (path) return { sn: path, toggle, folders: MEDIA_ROOTS };
  const sn = hass.devices?.[deviceId]?.serial_number;
  return sn ? { sn, toggle } : null;
}

/** The span of one recorded file, from its name `HHMMSS-HHMMSS.mp4` in the folder of its day. */
export function fileRange(day, item) {
  const match = FILE_NAME.exec(item?.title ?? "");
  if (!match) return null;
  const [year, month, date] = day.split("-").map(Number);
  const at = (h, m, sec) => new Date(year, month - 1, date, Number(h), Number(m), Number(sec)).getTime() / 1000;
  const start = at(match[1], match[2], match[3]);
  let end = at(match[4], match[5], match[6]);
  if (end < start) end += 86400; // a recording that went on past midnight
  return { start, end, id: item.media_content_id };
}

/** What plays from a moment of recorded files: that file from the moment, else the next file from its start. */
export function fileClipAt(ranges, time) {
  const inside = ranges.find((range) => range.start <= time && time < range.end - 1);
  const range = inside ?? ranges.find((candidate) => candidate.start > time);
  if (!range) return null;
  return { start: range.start, end: range.end, id: range.id, offset: inside ? Math.max(0, Math.floor(time - range.start)) : 0 };
}

function frigateSource(hass, frigate) {
  const { instance, camera } = frigate;
  return {
    key: `frigate/${instance}/${camera}`,
    async days() {
      const timezone = hass.config?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const days = parsed(await hass.callWS({ type: "frigate/recordings/summary", instance_id: instance, camera, timezone }));
      return (days ?? []).map(({ day }) => day);
    },
    async day(day) {
      const ask = (message) => hass.callWS({ instance_id: instance, ...dayBounds(day), ...message }).then(parsed);
      const [segments, events] = await Promise.all([
        ask({ type: "frigate/recordings/get", camera }).catch(() => []),
        ask({ type: "frigate/events/get", cameras: [camera], limit: EVENTS_LIMIT }).catch(() => []),
      ]);
      return { ranges: recordedRanges(segments ?? []), events: events ?? [] };
    },
    clipAt: (ranges, time) => clipAt(ranges, time),
    url: (clip) => clipUrl(hass, frigate, clip),
  };
}

function fileSource(hass, { sn, toggle }, folders) {
  const browse = async (path) => {
    for (const folder of folders) {
      try {
        return await hass.callWS({ type: "media_source/browse_media", media_content_id: `${folder}/${path}` });
      } catch {
        // Not this folder; the next one may hold the recordings.
      }
    }
    return null;
  };
  return {
    key: `files/${sn}`,
    toggle,
    // A live view becomes a file only once it ends.
    refreshAfterLive: true,
    // Every day on the disk: a recording brought down from a camera's card may be weeks old.
    async days() {
      const folder = await browse(sn);
      return (folder?.children ?? []).map((child) => child.title).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day));
    },
    async day(day) {
      const folder = await browse(`${sn}/${day}`);
      const ranges = (folder?.children ?? []).map((child) => fileRange(day, child)).filter(Boolean);
      return { ranges: ranges.sort((a, b) => a.start - b.start), events: [] };
    },
    clipAt: fileClipAt,
    /** The media id of `file` (`YYYY-MM-DD/HHMMSS-HHMMSS.mp4`) where the folders keep it, or null. */
    async fileId(file) {
      const [day, name] = file.split("/");
      const folder = await browse(`${sn}/${day}`);
      return (folder?.children ?? []).find((child) => child.title === name)?.media_content_id ?? null;
    },
    async url(clip) {
      const { url } = await hass.callWS({ type: "media_source/resolve_media", media_content_id: clip.id });
      return hass.hassUrl(url);
    },
  };
}

/** The recordings of a camera window: Frigate's, or the recorded live views; null when there are none. */
export function recordingSource(hass, entityId, cameraId, config) {
  const frigate = frigateCamera(hass, cameraId ?? entityId);
  if (frigate) return frigateSource(hass, frigate);
  const recorded = recordedLiveCamera(hass, cameraId ?? entityId) ?? recordedLiveCamera(hass, entityId);
  if (!recorded) return null;
  // recordings_folder moves the eufy bridge's folder; a switch that names its own path keeps it.
  const folder = config?.cameras?.recordings_folder;
  return fileSource(hass, recorded, recorded.folders ?? (folder ? [folder] : FILE_FOLDERS));
}

const sourceKey = (source) => source?.key ?? "";

const shared = css`
  button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
  }
  button[disabled] {
    cursor: default;
  }
`;

// Days ----------------------------------------------------------------------------------------

export class HomeDashboardRecordingDays extends LitElement {
  static properties = {
    hass: { attribute: false },
    source: { attribute: false },
    day: {},
    _days: { state: true },
    _week: { state: true },
  };

  willUpdate(changed) {
    if (changed.has("source") && sourceKey(this.source) !== this._key) this._load();
    if (changed.has("day") && this.day && !weekOf(this.day).includes(this._week)) this._week = weekOf(this.day)[0];
  }

  async _load() {
    const key = sourceKey(this.source);
    this._key = key;
    if (!this.source) {
      this._days = new Set();
      this._week = weekOf(this.day ?? localDay(new Date()))[0];
      return;
    }
    this._days = undefined;
    let days = [];
    try {
      days = await this.source.days();
    } catch {
      days = [];
    }
    if (key !== this._key) return;
    this._days = new Set(days);
    const newest = [...this._days].sort().at(-1) ?? null;
    this._week = weekOf(this.day ?? newest ?? localDay(new Date()))[0];
    this.dispatchEvent(new CustomEvent("recording-days", { detail: { newest, count: this._days.size } }));
  }

  // A camera without recordings has the same days, greyed, so every camera window looks alike.
  updated() {
    this.toggleAttribute("empty", !this._days?.size);
    if (this._slide) {
      this.renderRoot.querySelector(".week")?.animate(
        [{ transform: `translateX(${this._slide * 40}px)`, opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 220, easing: "ease-out" },
      );
      this._slide = 0;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("pointerdown", this._swipeStart);
    this.addEventListener("pointerup", this._swipeEnd);
    this.addEventListener("pointercancel", () => (this._swipe = null));
  }

  _canShift(direction) {
    const week = weekOf(this._week);
    if (direction > 0) return !week.includes(localDay(new Date()));
    return ([...this._days].sort()[0] ?? localDay(new Date())) < week[0];
  }

  _shift(direction) {
    if (!this._canShift(direction)) return;
    this._week = shiftDay(this._week, 7 * direction);
    this._slide = direction;
  }

  // A swipe sideways turns the week, as a finger turns the pages of a calendar.
  _swipeStart(event) {
    this._swipe = { x: event.clientX, y: event.clientY };
  }

  _swipeEnd(event) {
    if (!this._swipe) return;
    const dx = event.clientX - this._swipe.x;
    const dy = event.clientY - this._swipe.y;
    this._swipe = null;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    this._swallowClick = true;
    this._shift(dx < 0 ? 1 : -1);
  }

  _pick(day) {
    if (this._swallowClick) {
      this._swallowClick = false;
      return;
    }
    this.dispatchEvent(new CustomEvent("recording-day", { detail: { day } }));
  }

  render() {
    if (!this.hass || !this._days) return nothing;
    const language = this.hass.language;
    const week = weekOf(this._week);
    return html`
      <button
        class="arrow"
        aria-label=${translate(language, "week_earlier")}
        data-week="-1"
        ?disabled=${!this._canShift(-1)}
        @click=${() => this._shift(-1)}
      >
        <ha-icon icon="mdi:chevron-left"></ha-icon>
      </button>
      <div class="week" data-recording-days>
        ${week.map((day) => {
          const date = dateOf(day);
          return html`
            <button
              class="${day === this.day ? "on" : ""} ${this._days.has(day) ? "has" : ""}"
              data-recording-day=${day}
              ?disabled=${!this._days.has(day)}
              @click=${() => this._pick(day)}
            >
              <small>${new Intl.DateTimeFormat(language, { weekday: "narrow" }).format(date)}</small>
              <strong>${date.getDate()}</strong>
            </button>
          `;
        })}
      </div>
      <button
        class="arrow"
        aria-label=${translate(language, "week_later")}
        data-week="1"
        ?disabled=${!this._canShift(1)}
        @click=${() => this._shift(1)}
      >
        <ha-icon icon="mdi:chevron-right"></ha-icon>
      </button>
    `;
  }

  static styles = [
    tokens,
    shared,
    css`
      :host {
        display: flex;
        align-items: center;
        box-sizing: border-box;
        width: min(100% - 24px, 520px);
        min-height: 66px;
        touch-action: pan-y;
        user-select: none;
        -webkit-user-select: none;
        padding: 4px;
        border-radius: 18px;
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
      }
      :host([empty]) {
        opacity: 0.45;
      }
      .arrow {
        display: grid;
        flex: none;
        place-items: center;
        width: 40px;
        height: 48px;
        --mdc-icon-size: 26px;
      }
      .arrow[disabled] {
        opacity: 0.3;
      }
      .week {
        display: grid;
        flex: 1;
        grid-template-columns: repeat(7, 1fr);
      }
      .week button {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 4px 0;
        color: rgba(255, 255, 255, 0.35);
      }
      .week button.has {
        color: #ffffff;
      }
      small {
        font-size: 13px;
        font-weight: 500;
      }
      strong {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        font-size: 16px;
        font-weight: 500;
      }
      .week button.on strong {
        color: #ffffff;
        background: #ff9f0a;
      }
    `,
  ];
}

// Line of time --------------------------------------------------------------------------------

export class HomeDashboardTimeline extends LitElement {
  static properties = {
    hass: { attribute: false },
    source: { attribute: false },
    day: {},
    // The moment shown under the line while a recording plays; empty while the line is free.
    time: { type: Number },
    playing: { type: Boolean },
    live: { type: Boolean },
    // The live view's video moves: LIVE becomes the button that ends it.
    connected: { type: Boolean },
    // A camera with only a stored picture has no live view.
    canLive: { type: Boolean },
    _ranges: { state: true },
    _events: { state: true },
    _shown: { state: true },
    _overview: { state: true },
  };

  constructor() {
    super();
    this._ranges = [];
    this._events = [];
  }

  connectedCallback() {
    super.connectedCallback();
    const window = this.renderRoot?.querySelector?.(".window");
    if (this._resize && window) this._resize.observe(window);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._settle);
    clearTimeout(this._hold);
    clearTimeout(this._refresh);
    this._resize?.disconnect();
  }

  firstUpdated() {
    const window = this.renderRoot.querySelector(".window");
    // The window opens sliding and growing; the mark is put back on its moment whenever the line changes size.
    this._resize = new ResizeObserver(() => {
      if (this._scrubbing || this._overview || this._shown === undefined) return;
      const track = this.renderRoot.querySelector("[data-timeline-track]");
      if (!track) return;
      track.scrollLeft = this._x(this._shown);
      this._expected = track.scrollLeft;
    });
    this._resize.observe(window);
    // While the whole day is shown the finger moves the mark, so the page must not scroll under it.
    window.addEventListener(
      "touchmove",
      (event) => {
        if (this._overview) event.preventDefault();
      },
      { passive: false },
    );
  }

  // Holding the line still squeezes the whole day into it; moving the finger then moves the mark across hours,
  // and letting go brings the usual line back at the chosen moment, which plays from there.
  _holdStart(event) {
    if (!this.day || this._overview) return;
    clearTimeout(this._hold);
    this._press = { x: event.clientX, id: event.pointerId };
    this._hold = setTimeout(() => {
      const { left, width } = this.renderRoot.querySelector(".window").getBoundingClientRect();
      this._press = { ...this._press, left, width };
      this._overview = true;
      this._fire("timeline-scrub");
    }, OVERVIEW_HOLD_MS);
  }

  _holdMove(event) {
    if (!this._press || event.pointerId !== this._press.id) return;
    const dx = event.clientX - this._press.x;
    if (!this._overview) {
      if (Math.abs(dx) > HOLD_SLOP_PX) this._holdCancel();
      return;
    }
    // The mark stays where it was until the finger moves; from then on it is under the finger, so the whole day is
    // one sweep from the left edge of the line to the right one.
    if (!this._press.follow && Math.abs(dx) <= HOLD_SLOP_PX) return;
    this._press.follow = true;
    const { after, before } = dayBounds(this.day);
    const share = Math.min(Math.max((event.clientX - this._press.left) / this._press.width, 0), 1);
    this._shown = Math.min(after + share * (before - after), before - 1);
  }

  _holdEnd() {
    clearTimeout(this._hold);
    this._press = null;
    if (!this._overview) return;
    this._overview = false;
    this._moveTo(this._shown);
    this._fire("timeline-seek", { time: this._shown, clip: this.clipFrom(this._shown) });
  }

  _holdCancel() {
    clearTimeout(this._hold);
    this._press = null;
  }

  willUpdate(changed) {
    const key = `${sourceKey(this.source)}/${this.day}`;
    if ((changed.has("source") || changed.has("day")) && this.day && key !== this._key) this._load(key);
    // A recorded live view is on disk a moment after it ends; look again then.
    if (changed.has("live") && changed.get("live") && !this.live && this.source?.refreshAfterLive) {
      clearTimeout(this._refresh);
      this._refresh = setTimeout(() => this._load(this._key, { keepPlace: true }), REFRESH_AFTER_LIVE_MS);
    }
    if (changed.has("live") && this.live) this._moveTo(Date.now() / 1000);
    if (changed.has("time") && this.time != null && !this._scrubbing) this._moveTo(this.time);
  }

  updated() {
    if (this._follow === undefined) return;
    const track = this.renderRoot.querySelector("[data-timeline-track]");
    if (!track) return;
    track.scrollLeft = this._x(this._follow);
    this._expected = track.scrollLeft;
    this._follow = undefined;
  }

  async _load(key, { keepPlace = false } = {}) {
    this._key = key;
    const bounds = dayBounds(this.day);
    if (!this.source) {
      this._ranges = [];
      this._events = [];
      this._moveTo(Math.min(Date.now() / 1000, bounds.before));
      return;
    }
    const { ranges, events } = await this.source.day(this.day).catch(() => ({ ranges: [], events: [] }));
    if (key !== this._key) return;
    this._ranges = ranges;
    this._events = events;
    if (keepPlace) return;
    // Today starts at this moment; another day at its last recording.
    const now = Date.now() / 1000;
    this._moveTo(now < bounds.before ? now : (this._ranges.at(-1)?.start ?? bounds.after));
  }

  showNow() {
    this._moveTo(Date.now() / 1000);
    this.requestUpdate();
  }

  _moveTo(time) {
    this._shown = time;
    this._follow = time;
  }

  _x(time) {
    return ((time - dayBounds(this.day).after) / 3600) * PX_PER_HOUR;
  }

  // The recording to play from a moment, and the one after a part that has ended.
  clipFrom(time) {
    return (this.source?.clipAt ?? clipAt)(this._ranges, time);
  }

  // The recording before or after the one under the mark (`step` -1 or 1), or null at either end of the day.
  neighbour(time, step) {
    const current = this._ranges.find((range) => range.start <= time && time < range.end);
    if (step > 0) return this._ranges.find((range) => range.start > time) ?? null;
    const before = current ? current.start : time;
    return this._ranges.filter((range) => range.start < before).at(-1) ?? null;
  }

  _skip(step) {
    const range = this.neighbour(this._shown ?? Date.now() / 1000, step);
    if (!range) return;
    this._moveTo(range.start);
    this._fire("timeline-seek", { time: range.start, clip: this.clipFrom(range.start) });
  }

  _renderSkip(step, shown, t) {
    return html`
      <button
        class="skip"
        aria-label=${t(step > 0 ? "recordings_next" : "recordings_previous")}
        data-timeline-skip=${step > 0 ? "next" : "previous"}
        ?disabled=${!this.neighbour(shown, step)}
        @click=${() => this._skip(step)}
      >
        <ha-icon icon=${step > 0 ? "mdi:skip-next" : "mdi:skip-previous"}></ha-icon>
      </button>
    `;
  }

  // What play plays: from the moment under the mark, or, past the last recording, that last recording.
  playable(time) {
    const last = this._ranges.filter((range) => range.start <= time).at(-1) ?? this._ranges.at(-1);
    return this.clipFrom(time) ?? (last ? this.clipFrom(last.start) : null);
  }

  _fire(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  _scrolled(event) {
    const track = event.currentTarget;
    if (this._expected !== undefined && Math.abs(track.scrollLeft - this._expected) < 2) return;
    this._expected = undefined;
    this._shown = dayBounds(this.day).after + (track.scrollLeft / PX_PER_HOUR) * 3600;
    if (!this._scrubbing) {
      this._scrubbing = true;
      this._fire("timeline-scrub");
    }
    clearTimeout(this._settle);
    this._settle = setTimeout(() => {
      this._scrubbing = false;
      this._fire("timeline-seek", { time: this._shown, clip: this.clipFrom(this._shown) });
    }, SETTLE_MS);
  }

  _seekEvent(event) {
    this._moveTo(event.start_time);
    this._fire("timeline-seek", { time: event.start_time, clip: this.clipFrom(event.start_time) });
  }

  _clock(seconds) {
    return new Intl.DateTimeFormat(this.hass.language, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(seconds * 1000);
  }

  render() {
    if (!this.hass) return nothing;
    const t = (key) => translate(this.hass.language, key);
    // Until the day is known the line stands empty, so the window does not jump when it comes.
    const day = this.day;
    const shown = this._shown ?? Date.now() / 1000;
    // Only a moment between two recordings is a gap; after the last one it is simply now.
    const gap =
      !this.live &&
      !this._ranges.some((range) => range.start <= shown && shown < range.end) &&
      this._ranges.some((range) => range.start > shown);
    return html`
      <div class="time ${this.live ? "quiet" : ""}" data-timeline-time>
        <!-- Live hides the time but keeps its room (.quiet), so the window does not move when LIVE is tapped. -->
        <strong>${this._clock(shown)}</strong>
        <small class=${gap ? "" : "spare"} data-timeline-gap>${t("recordings_gap")}</small>
      </div>
      <div class="bar">
        ${this._renderSkip(-1, shown, t)}
        <button
          class="play"
          aria-label=${t(this.playing ? "recordings_pause" : "recordings_play")}
          data-timeline-play
          ?disabled=${!this.playing && !this._ranges.length}
          @click=${() => this._fire("timeline-play", { clip: this.playable(shown) })}
        >
          <ha-icon icon=${this.playing ? "mdi:pause" : "mdi:play"}></ha-icon>
        </button>
        ${this._renderSkip(1, shown, t)}
        <div
          class="window ${this._overview ? "overview" : ""}"
          data-timeline-window
          @pointerdown=${this._holdStart}
          @pointermove=${this._holdMove}
          @pointerup=${this._holdEnd}
          @pointercancel=${() => (this._overview ? this._holdEnd() : this._holdCancel())}
          @contextmenu=${(event) => event.preventDefault()}
        >
          ${day ? this._renderTrack() : nothing} ${this._overview ? this._renderDay() : nothing}
          <i class="playhead" style=${this._overview ? `left: ${this._share(this._shown) * 100}%` : ""}></i>
        </div>
        <button
          class="live ${this.live ? "on" : ""}"
          data-timeline-live
          aria-pressed=${this.live ? "true" : "false"}
          ?disabled=${!this.canLive && !this.live}
          @click=${() => this._fire("timeline-live")}
        >
          ${this.live && this.connected ? t("live_disconnect") : t("live")}
        </button>
      </div>
    `;
  }

  _share(time) {
    const { after, before } = dayBounds(this.day);
    return Math.min(Math.max((time - after) / (before - after), 0), 1);
  }

  // The whole day at once, laid over the line while it is held.
  _renderDay() {
    return html`
      <div class="day" data-timeline-day>
        ${[0, 3, 6, 9, 12, 15, 18, 21].map(
          (hour) => html`<span class="hour" style="left: ${(hour / 24) * 100}%">${pad(hour)}</span>`,
        )}
        ${this._ranges.map(
          (range) =>
            html`<i
              class="range"
              style="left: ${this._share(range.start) * 100}%; width: max(1px, ${(this._share(range.end) - this._share(range.start)) * 100}%)"
            ></i>`,
        )}
      </div>
    `;
  }

  _renderTrack() {
    return html`
      <div class="track" data-timeline-track @scroll=${this._scrolled}>
        <span class="pad"></span>
        <div class="strip" style="width: ${24 * PX_PER_HOUR}px">
          ${Array.from(
            { length: 25 },
            (_, hour) => html`<span class="hour" style="left: ${hour * PX_PER_HOUR}px">${pad(hour % 24)}:00</span>`,
          )}
          ${this._ranges.map(
            (range) =>
              html`<i class="range" style="left: ${this._x(range.start)}px; width: ${Math.max(2, this._x(range.end) - this._x(range.start))}px"></i>`,
          )}
          ${this._events.map(
            (event) => html`
              <button
                class="event"
                style="left: ${this._x(event.start_time)}px"
                aria-label=${`${this._clock(event.start_time)} ${event.sub_label ?? event.label ?? ""}`}
                data-timeline-event=${event.id}
                @click=${() => this._seekEvent(event)}
              ></button>
            `,
          )}
        </div>
        <span class="pad"></span>
      </div>
    `;
  }

  static styles = [
    tokens,
    shared,
    css`
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        box-sizing: border-box;
        width: min(100% - 24px, 720px);
        color: #ffffff;
      }
      .time {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-height: 40px;
      }
      /* Live needs no time over the line: LIVE is lit on it already. Upright the place stays, so nothing jumps. */
      .time.quiet {
        visibility: hidden;
      }
      @media (orientation: landscape) and (max-height: 500px), (orientation: landscape) and (min-width: 900px) and (pointer: coarse) {
        .time.quiet {
          display: none;
        }
      }
      .time strong {
        font-size: 18px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }
      .time small {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }
      /* The line under the time keeps its room when there is nothing to say, so the window never jumps. */
      .time small.spare {
        visibility: hidden;
      }
      .bar {
        display: flex;
        align-items: center;
        box-sizing: border-box;
        width: 100%;
        height: 60px;
        overflow: hidden;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.1);
      }
      .play,
      .live {
        display: grid;
        flex: none;
        place-items: center;
        height: 100%;
      }
      .play {
        width: 52px;
        --mdc-icon-size: 28px;
      }
      /* Grey while off, orange from the tap on; as wide for DISCONNECT as for LIVE, so the line never moves. */
      .live {
        min-width: 104px;
        padding: 0 14px;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: #8e8e93;
      }
      .live.on {
        color: #ff9f0a;
      }
      /* Jumping between recordings: on a phone on its side only, where the line is out of reach of a thumb. */
      .skip {
        display: none;
        flex: none;
        place-items: center;
        width: 40px;
        height: 100%;
        --mdc-icon-size: 24px;
      }
      @media (orientation: landscape) and (max-height: 500px), (orientation: landscape) and (min-width: 900px) and (pointer: coarse) {
        .skip {
          display: grid;
        }
      }
      .play[disabled],
      .skip[disabled] {
        opacity: 0.35;
      }
      .live[disabled] {
        opacity: 0.35;
      }
      .window {
        position: relative;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        flex: 1;
        align-self: stretch;
        min-width: 0;
      }
      .track {
        display: flex;
        height: 100%;
        overflow-x: auto;
        scrollbar-width: none;
        overscroll-behavior-x: contain;
        touch-action: pan-x;
      }
      .track::-webkit-scrollbar {
        display: none;
      }
      .pad {
        flex: none;
        width: 50%;
      }
      .strip {
        position: relative;
        flex: none;
        height: 100%;
        background: linear-gradient(rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.25)) 0 50% / 100% 1px no-repeat;
      }
      .hour {
        position: absolute;
        top: 4px;
        padding-left: 3px;
        border-left: 1px solid rgba(255, 255, 255, 0.3);
        font-size: 10px;
        line-height: 10px;
        color: rgba(255, 255, 255, 0.55);
      }
      .range {
        position: absolute;
        top: calc(50% - 7px);
        height: 14px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.55);
      }
      .event {
        position: absolute;
        top: calc(50% + 10px);
        width: 18px;
        height: 18px;
        margin-left: -9px;
      }
      .event::after {
        content: "";
        position: absolute;
        inset: 5px;
        border-radius: 50%;
        background: #ff9f0a;
      }
      .window.overview .track {
        visibility: hidden;
      }
      .day {
        position: absolute;
        inset: 0;
        background: linear-gradient(rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.25)) 0 50% / 100% 1px no-repeat;
        animation: squeeze 160ms ease-out;
      }
      @keyframes squeeze {
        from {
          opacity: 0;
          transform: scaleX(1.6);
        }
      }
      .day .range {
        border-radius: 2px;
      }
      .window.overview .playhead {
        margin-left: -1.5px;
      }
      .playhead {
        position: absolute;
        top: 4px;
        bottom: 4px;
        left: calc(50% - 1.5px);
        width: 3px;
        border-radius: 2px;
        background: #ff9f0a;
        pointer-events: none;
      }
    `,
  ];
}
