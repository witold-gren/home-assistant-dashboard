// Voice messages to a room or the whole house. Recording needs a secure page and, for the upload to
// the media library, an administrator; everywhere else the text field takes over, and the keyboard's
// dictation does the speaking. What plays the message is the user's own script.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";

const MAX_SECONDS = 30;
const MIN_SECONDS = 0.8;
const SAMPLE_RATE = 24000;
const MAX_GAIN = 4;
const TARGET_PEAK = 0.9;
const KEEP_MINUTES = 15;
const CLOSE_DELAY_MS = 2000;
const TICK_MS = 500;

function writeText(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}

// Float32 chunks to mono 16-bit WAV, normalised because phone microphones are quiet.
export function encodeWav(chunks, inputRate) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const input = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    input.set(chunk, offset);
    offset += chunk.length;
  }
  const ratio = inputRate / SAMPLE_RATE;
  const outputLength = Math.floor(length / ratio);
  const samples = new Float32Array(outputLength);
  let peak = 0;
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const start = Math.floor(position);
    const fraction = position - start;
    samples[index] = input[start] * (1 - fraction) + (input[start + 1] ?? 0) * fraction;
    peak = Math.max(peak, Math.abs(samples[index]));
  }
  const gain = peak > 0 ? Math.min(MAX_GAIN, TARGET_PEAK / peak) : 1;
  const buffer = new ArrayBuffer(44 + outputLength * 2);
  const view = new DataView(buffer);
  writeText(view, 0, "RIFF");
  view.setUint32(4, 36 + outputLength * 2, true);
  writeText(view, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(view, 36, "data");
  view.setUint32(40, outputLength * 2, true);
  for (let index = 0; index < outputLength; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] * gain));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function canRecord(hass, config) {
  return Boolean(
    config.intercom.media_folder &&
      window.isSecureContext &&
      navigator.mediaDevices?.getUserMedia &&
      hass.user?.is_admin,
  );
}

class VoiceRecorder {
  // Called inside the tap: after an await, iOS keeps the audio context suspended and records nothing.
  constructor() {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    this.context = new Context();
    this.resumed = this.context.resume().catch(() => {});
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    await Promise.race([this.resumed, new Promise((resolve) => setTimeout(resolve, 1000))]);
    if (!this.context) return;
    const source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.processor.onaudioprocess = (event) =>
      this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    source.connect(this.processor);
    // iOS only fires the callback on a connected node; nothing reaches the speakers.
    this.processor.connect(this.context.destination);
    this.startedAt = Date.now();
  }

  get seconds() {
    return (Date.now() - this.startedAt) / 1000;
  }

  stop() {
    const rate = this.context?.sampleRate;
    const { chunks, seconds } = this;
    this.cancel();
    return seconds >= MIN_SECONDS && chunks?.length ? encodeWav(chunks, rate) : null;
  }

  cancel() {
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.context?.close().catch(() => {});
    this.processor = null;
    this.stream = null;
    this.context = null;
  }
}

export function createRecorder(hass, config) {
  return canRecord(hass, config) ? new VoiceRecorder() : null;
}

function stamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `${day}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function removeOldRecordings(hass, folder) {
  try {
    const listing = await hass.connection.sendMessagePromise({
      type: "media_source/browse_media",
      media_content_id: folder,
    });
    const limit = stamp(new Date(Date.now() - KEEP_MINUTES * 60000));
    for (const item of listing.children ?? []) {
      const taken = /_(\d{8}_\d{6})\.wav$/.exec(item.title ?? item.media_content_id ?? "")?.[1];
      if (taken && taken < limit) {
        await hass.connection.sendMessagePromise({
          type: "media_source/local_source/remove",
          media_content_id: item.media_content_id,
        });
      }
    }
  } catch {
    // The folder appears with the first upload.
  }
}

async function uploadRecording(hass, config, recording) {
  const folder = config.intercom.media_folder;
  removeOldRecordings(hass, folder);
  const form = new FormData();
  form.append("media_content_id", folder);
  form.append("file", recording, `message_${stamp(new Date())}.wav`);
  const response = await hass.fetchWithAuth("/api/media_source/local_source/upload", { method: "POST", body: form });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()).media_content_id;
}

export async function sendMessage(hass, config, areas, content) {
  const { script, areas_field: areasField, played_field: playedField } = config.intercom;
  const [domain, service] = script.split(".");
  const result = await hass.connection.sendMessagePromise({
    type: "call_service",
    domain,
    service,
    service_data: { [areasField]: areas, ...content },
    return_response: true,
  });
  if (playedField && !result?.response?.[playedField]?.length) {
    throw new Error(translate(hass.language, "intercom_no_speaker"));
  }
}

export class HomeDashboardIntercom extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false },
    areas: { attribute: false },
    label: { type: String },
    recorder: { attribute: false },
    _state: { state: true },
    _note: { state: true },
    _seconds: { state: true },
  };

  firstUpdated() {
    if (this.recorder) this._record();
    else this._setText();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._ticker);
    clearTimeout(this._closer);
    this.recorder?.cancel();
  }

  _t(key, values) {
    return translate(this.hass.language, key, values);
  }

  _setText(note = "") {
    this._state = "text";
    this._note = note;
  }

  async _record() {
    this._state = "starting";
    try {
      await this.recorder.start();
    } catch {
      this.recorder.cancel();
      this.recorder = null;
      this._setText(this._t("intercom_no_mic"));
      return;
    }
    this._state = "recording";
    this._seconds = 0;
    this._ticker = setInterval(() => {
      this._seconds = Math.round(this.recorder.seconds);
      if (this._seconds >= MAX_SECONDS) this._finish();
    }, TICK_MS);
  }

  async _finish() {
    clearInterval(this._ticker);
    const recording = this.recorder.stop();
    if (!recording) {
      this._state = "failed";
      this._note = this._t("intercom_too_short");
      return;
    }
    await this._send(async () => ({
      [this.config.intercom.file_field]: await uploadRecording(this.hass, this.config, recording),
    }));
  }

  _submit(event) {
    event.preventDefault();
    const text = this.renderRoot.querySelector("input").value.trim();
    if (text) this._send(async () => ({ [this.config.intercom.text_field]: text }));
  }

  async _send(content) {
    this._state = "sending";
    try {
      await sendMessage(this.hass, this.config, this.areas, await content());
    } catch (error) {
      this._state = "failed";
      this._note = this._t("intercom_failed", { reason: error?.message ?? error });
      return;
    }
    this._state = "sent";
    this._closer = setTimeout(() => this._close(), CLOSE_DELAY_MS);
  }

  _close() {
    this.dispatchEvent(new CustomEvent("intercom-close"));
  }

  _renderStatus(icon, text, onTap) {
    return html`
      <button class="status ${this._state}" data-intercom-state=${this._state} ?disabled=${!onTap} @click=${onTap}>
        <span class="mic"><ha-icon .icon=${icon}></ha-icon></span>
        <span class="text"><strong>${this.label}</strong><small>${text}</small></span>
      </button>
    `;
  }

  render() {
    if (!this._state || !this.hass) return nothing;
    if (this._state === "text") {
      return html`
        ${this._note ? html`<p>${this._note}</p>` : nothing}
        <form @submit=${this._submit}>
          <input enterkeyhint="send" autocomplete="off" placeholder=${this._t("intercom_text")} autofocus />
          <button class="send" data-intercom-send>${this._t("intercom_send")}</button>
          <button class="cancel" type="button" aria-label=${this._t("intercom_cancel")} @click=${this._close}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </form>
      `;
    }
    if (this._state === "recording") {
      return this._renderStatus("mdi:stop", this._t("intercom_recording", { seconds: this._seconds }), this._finish);
    }
    if (this._state === "starting") return this._renderStatus("mdi:microphone", this._t("intercom_starting"));
    if (this._state === "sending") return this._renderStatus("mdi:dots-horizontal", this._t("intercom_sending"));
    if (this._state === "sent") return this._renderStatus("mdi:check", this._t("intercom_sent"));
    return this._renderStatus("mdi:alert-circle-outline", this._note, this._close);
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      box-sizing: border-box;
      color: inherit;
    }
    button {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      border-radius: 20px;
      background: rgba(128, 128, 128, 0.18);
    }
    .mic {
      display: grid;
      flex: none;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(128, 128, 128, 0.25);
    }
    .recording .mic {
      color: #fff;
      background: #d32f2f;
    }
    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .text strong {
      font-weight: 500;
    }
    .text small {
      opacity: 0.75;
    }
    p {
      margin: 0 0 8px;
      font-size: 14px;
      opacity: 0.75;
    }
    form {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    input {
      flex: 1;
      min-width: 0;
      box-sizing: border-box;
      height: 48px;
      padding: 0 14px;
      font: inherit;
      font-size: 16px;
      color: var(--hd-text);
      border: 1px solid var(--hd-outline);
      border-radius: 14px;
      background: var(--hd-surface);
    }
    .send {
      padding: 13px 16px;
      border-radius: 14px;
      color: #ffffff;
      background: #2b6cb0;
    }
    .cancel {
      display: grid;
      flex: none;
      place-items: center;
      width: 44px;
      height: 44px;
    }
  `;
}
