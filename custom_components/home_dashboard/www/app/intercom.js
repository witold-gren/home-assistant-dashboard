// Voice messages to a room or the whole house. Recording needs a secure page and, for the upload to
// the media library, an administrator; everywhere else the text field takes over, and the keyboard's
// dictation does the speaking. What plays the message is the user's own script.

import { LitElement, css, html, nothing, svg } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";

const MAX_SECONDS = 30;
const MIN_SECONDS = 0.8;
const SAMPLE_RATE = 24000;
const MAX_GAIN = 4;
const TARGET_PEAK = 0.9;
const KEEP_MINUTES = 15;
const CLOSE_DELAY_MS = 2000;
const TICK_MS = 500;
// The live wave of the card: one bar per step, the newest on the right.
const WAVE_BARS = 56;
const WAVE_STEP_MS = 70;

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

// The media folder takes uploads from an administrator only; an endpoint of its own takes them from anyone signed in,
// such as the account of a tablet on the wall.
export function canRecord(hass, config) {
  const { upload, media_folder: folder } = config.intercom;
  return Boolean(
    (upload || (folder && hass.user?.is_admin)) && window.isSecureContext && navigator.mediaDevices?.getUserMedia,
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
    // How loud the voice is now, for the wave drawn while recording.
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.samples = new Float32Array(this.analyser.fftSize);
    source.connect(this.analyser);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.processor.onaudioprocess = (event) =>
      this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    source.connect(this.processor);
    // iOS only fires the callback on a connected node; nothing reaches the speakers.
    this.processor.connect(this.context.destination);
    this.startedAt = Date.now();
  }

  /** The loudness of the last moment, 0 to 1. */
  level() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const sample of this.samples) sum += sample * sample;
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 6);
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
    this.analyser = null;
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

/**
 * A recording to the endpoint of `intercom.upload`, which plays it in the rooms itself: the WAV as the body, the rooms
 * in the address. It answers where it played and which rooms had no speaker.
 */
export async function sendRecording(hass, config, areas, recording) {
  const url = `${config.intercom.upload}?areas=${areas.map(encodeURIComponent).join(",")}`;
  const response = await hass.fetchWithAuth(url, { method: "POST", body: recording, headers: { "Content-Type": "audio/wav" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const answer = await response.json().catch(() => ({}));
  if (!answer?.played?.length) throw new Error(translate(hass.language, "intercom_no_speaker"));
  return answer;
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
    // The window of its own (a card like a phone's intercom), not the bar inside a camera window.
    card: { type: Boolean, reflect: true },
    _state: { state: true },
    _wave: { state: true },
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
    clearInterval(this._waver);
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
    if (this.card) {
      this._wave = Array(WAVE_BARS).fill(0);
      this._waver = setInterval(() => {
        this._wave = [...this._wave.slice(1), this.recorder?.level() ?? 0];
      }, WAVE_STEP_MS);
    }
    this._ticker = setInterval(() => {
      this._seconds = Math.round(this.recorder.seconds);
      if (this._seconds >= MAX_SECONDS) this._finish();
    }, TICK_MS);
  }

  async _finish() {
    clearInterval(this._ticker);
    clearInterval(this._waver);
    const recording = this.recorder.stop();
    if (!recording) {
      this._state = "failed";
      this._note = this._t("intercom_too_short");
      return;
    }
    if (this.config.intercom.upload) {
      await this._send(null, () => sendRecording(this.hass, this.config, this.areas, recording));
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

  // `deliver` sends it another way than the script, as the endpoint of uploads does.
  async _send(content, deliver = null) {
    this._state = "sending";
    try {
      if (deliver) await deliver();
      else await sendMessage(this.hass, this.config, this.areas, await content());
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

  // The wave: quiet moments are dots, louder ones lines as tall as the voice, centred on one line.
  _renderWave() {
    const bars = this._wave ?? Array(WAVE_BARS).fill(0);
    const step = 100 / WAVE_BARS;
    return html`<svg class="wave" data-intercom-wave viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      ${bars.map((level, index) => {
        const x = (index + 0.5) * step;
        const half = Math.max(0.6, level * 19);
        return half <= 0.6
          ? svg`<line x1=${x} x2=${x} y1="19.6" y2="20.4" class="dot"></line>`
          : svg`<line x1=${x} x2=${x} y1=${20 - half} y2=${20 + half}></line>`;
      })}
    </svg>`;
  }

  _renderCard() {
    const state = this._state;
    const button = {
      starting: ["mdi:microphone", this._t("intercom_starting"), null],
      recording: [null, this._t("intercom_done"), this._finish],
      sending: ["mdi:dots-horizontal", this._t("intercom_sending"), null],
      sent: ["mdi:check", this._t("intercom_sent"), null],
      failed: ["mdi:alert-circle-outline", this._note, this._close],
    }[state];
    return html`
      <div class="card" data-intercom-card data-intercom-state=${state}>
        <button class="close" aria-label=${this._t("intercom_cancel")} data-intercom-cancel @click=${this._close}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
        <h2>${this._t("intercom_card_to", { room: this.label })}</h2>
        <small class="kind">${this._t("intercom_card_title")}</small>
        ${state === "text"
          ? html`<div class="text-mode">${this._renderText()}</div>`
          : html`${this._renderWave()}
              <button
                class="big ${state}"
                data-intercom-done
                ?disabled=${!button[2]}
                @click=${button[2]}
              >
                ${button[0] ? html`<ha-icon .icon=${button[0]}></ha-icon>` : html`<span class="square"></span>`}
              </button>
              <small class="label">${button[1]}</small>`}
      </div>
    `;
  }

  _renderText() {
    return html`
      ${this._note ? html`<p>${this._note}</p>` : nothing}
      <form @submit=${this._submit}>
        <input enterkeyhint="send" autocomplete="off" placeholder=${this._t("intercom_text")} autofocus />
        <button class="send" data-intercom-send>${this._t("intercom_send")}</button>
        ${this.card
          ? nothing
          : html`<button class="cancel" type="button" aria-label=${this._t("intercom_cancel")} @click=${this._close}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>`}
      </form>
    `;
  }

  render() {
    if (!this._state || !this.hass) return nothing;
    if (this.card) return this._renderCard();
    if (this._state === "text") return this._renderText();
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
    /* The card: whom it goes to at the top, the voice as a wave in the middle, one big button at the bottom. */
    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
      min-height: min(560px, 70dvh);
      padding: 56px 20px 28px;
      text-align: center;
    }
    .close {
      position: absolute;
      top: 12px;
      right: 12px;
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border: 1px solid var(--hd-outline, rgba(128, 128, 128, 0.3));
      border-radius: 50%;
      background: var(--hd-surface, transparent);
    }
    h2 {
      margin: 0;
      font-size: 30px;
      font-weight: 700;
      line-height: 36px;
    }
    .kind,
    .label {
      margin-top: 4px;
      font-size: 17px;
      color: var(--hd-text-muted, rgba(128, 128, 128, 1));
    }
    .wave {
      flex: 1;
      width: 100%;
      min-height: 96px;
      max-height: 160px;
      margin: 24px 0;
      stroke: currentColor;
      stroke-width: 0.45;
      stroke-linecap: round;
    }
    .wave .dot {
      stroke-width: 0.5;
      opacity: 0.6;
    }
    .big {
      margin-top: auto;
      display: grid;
      place-items: center;
      width: 76px;
      height: 76px;
      border-radius: 50%;
      color: #ffffff;
      background: #f0943f;
      box-shadow: 0 2px 10px rgba(240, 148, 63, 0.35);
      --mdc-icon-size: 34px;
    }
    .big.failed {
      background: #d32f2f;
    }
    .big.sent {
      background: #34c759;
    }
    .big[disabled] {
      cursor: default;
    }
    .square {
      width: 24px;
      height: 24px;
      border-radius: 5px;
      background: #ffffff;
    }
    .text-mode {
      width: 100%;
      margin-top: auto;
    }
  `;
}
