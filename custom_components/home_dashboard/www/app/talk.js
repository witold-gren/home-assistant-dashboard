// Talking through a camera's own speaker. The microphone is read in the page as 16-bit PCM and sent over a
// WebSocket to the eufy-sdk integration, which needs the user's login and streams the sound on to the eufy
// bridge, which plays it on the camera. Holding nothing open on the camera until someone talks.

import { liveCameraFor } from "./model.js";

export const TALK_LIMIT_MS = 60_000;
const TALK_PATH = "/api/eufy_sdk/talk";

// Runs in the audio thread: hands each block of microphone samples to the page.
const WORKLET = `
class TalkCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("talk-capture", TalkCapture);
`;

/**
 * The speaker behind a camera window and the path to talk through it, or null. Any integration can offer one: an
 * entity of the camera's device with a `talk_path` attribute (a WebSocket taking 16-bit PCM, see startCameraTalk).
 * eufy-sdk's speaker switch is known without it.
 */
export function cameraSpeaker(hass, entityId, config) {
  const live = liveCameraFor(hass, entityId, config);
  // The camera that turns this one (cameras.controls) also talks for it; then the camera itself.
  const owners = [config.cameras.controls?.[entityId], live && config.cameras.controls?.[live], entityId, live];
  for (const owner of owners.filter(Boolean)) {
    const deviceId = hass.entities[owner]?.device_id;
    if (!deviceId) continue;
    const ids = Object.keys(hass.entities).filter((id) => hass.entities[id].device_id === deviceId);
    const offered = ids.find((id) => typeof hass.states[id]?.attributes?.talk_path === "string");
    if (offered) return { path: hass.states[offered].attributes.talk_path, speaker: offered };
    const speaker = ids.find((id) => id.startsWith("switch.") && id.endsWith("_speaker") && hass.entities[id].platform === "eufy_sdk");
    const sn = hass.devices?.[deviceId]?.serial_number;
    if (speaker && sn) return { path: `${TALK_PATH}/${sn}`, speaker };
  }
  return null;
}

// The camera whose stream go2rtc serves for a window: the camera it is linked to, else its own live camera.
function streamCamera(hass, entityId, config) {
  const linked = config.cameras.controls?.[entityId];
  if (linked) return linked;
  return liveCameraFor(hass, entityId, config) ?? entityId;
}

/**
 * Which way the talk button of a camera window speaks: the camera's speaker (through its integration or through
 * go2rtc), the room's intercom, or none. `cameras.talk_with` chooses it per camera; otherwise the dashboard's
 * setting decides between the camera's speaker and the intercom.
 */
export function talkMode(hass, entityId, config, { room } = {}) {
  const chosen = config.cameras.talk_with?.[entityId] ?? "auto";
  const intercom = room ? { kind: "intercom", room } : null;
  if (chosen === "none") return null;
  if (chosen === "intercom") return intercom;
  if (chosen === "go2rtc") return { kind: "camera", speaker: { go2rtc: streamCamera(hass, entityId, config) } };
  const speaker = config.cameras.talk === "camera" ? cameraSpeaker(hass, entityId, config) : null;
  if (speaker) return { kind: "camera", speaker };
  return intercom;
}

/** Start talking through a speaker found by talkMode, whichever way it is reached. */
export function startTalk(hass, speaker, options = {}) {
  return speaker.go2rtc ? startGo2rtcTalk(hass, speaker.go2rtc, options) : startCameraTalk(hass, speaker.path, options);
}

/** Float samples of the microphone as 16-bit little-endian PCM. */
export function toPcm16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return pcm.buffer;
}

/**
 * Start talking through the WebSocket at `path` (16-bit PCM at `?rate=`, then "stop"; it answers with
 * `{ ok, error }`, and may say `{ state }` on the way, passed to `onState`). Resolves to `{ stop }` once the microphone streams;
 * rejects with an Error whose `reason` is "microphone" or "failed". `onEnd(reason)` reports a talk the camera's
 * side ended ("busy", "no_speaker", "unreachable", "closed", "failed"), or null for a talk that simply finished.
 */
export async function startCameraTalk(
  hass,
  talkPath,
  {
    media = globalThis.navigator?.mediaDevices,
    AudioContextImpl = globalThis.AudioContext,
    WebSocketImpl = globalThis.WebSocket,
    WorkletNodeImpl = globalThis.AudioWorkletNode,
    onEnd = () => {},
    onState = () => {},
  } = {},
) {
  const fail = (reason, cause) => Object.assign(new Error(reason), { reason, cause });
  let stream;
  try {
    stream = await media.getUserMedia({ audio: { channelCount: 1, echoCancellation: true }, video: false });
  } catch (error) {
    throw fail("microphone", error);
  }
  let context;
  let socket;
  let ended = false;
  const release = () => {
    stream.getTracks().forEach((track) => track.stop());
    context?.close?.();
  };
  const finish = (reason) => {
    if (ended) return;
    ended = true;
    release();
    onEnd(reason);
  };
  try {
    context = new AudioContextImpl();
    const module = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
    await context.audioWorklet.addModule(module);
    URL.revokeObjectURL(module);
    const rate = Math.round(context.sampleRate);
    const query = `${talkPath.includes("?") ? "&" : "?"}rate=${rate}`;
    const { path } = await hass.callWS({ type: "auth/sign_path", path: `${talkPath}${query}`, expires: 300 });
    socket = new WebSocketImpl(hass.hassUrl(path).replace(/^http/, "ws"));
    socket.binaryType = "arraybuffer";
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = () => reject(fail("failed"));
    });
    socket.onmessage = (event) => {
      let outcome = {};
      try {
        outcome = JSON.parse(event.data);
      } catch {
        // Anything else from the integration is not an outcome.
      }
      // `{ state }` says how far the integration got (e.g. "connecting" while a camera wakes, then "connected");
      // only `{ ok }` ends the talk.
      if (outcome.state !== undefined && outcome.ok === undefined) {
        onState(outcome.state);
        return;
      }
      finish(outcome.ok === false ? (outcome.error ?? "failed") : null);
      socket.close();
    };
    socket.onclose = () => finish(null);
    const source = context.createMediaStreamSource(stream);
    const capture = new WorkletNodeImpl(context, "talk-capture");
    capture.port.onmessage = ({ data }) => {
      if (!ended && socket.readyState === 1) socket.send(toPcm16(data));
    };
    source.connect(capture);
  } catch (error) {
    ended = true;
    release();
    socket?.close?.();
    throw error.reason ? error : fail("failed", error);
  }
  return {
    stop() {
      if (ended) return;
      // The integration answers the end with how it went, then closes; the microphone stops at once.
      if (socket.readyState === 1) socket.send("stop");
      release();
    },
  };
}

/**
 * Talk through go2rtc, which Home Assistant streams its cameras with: a WebRTC connection of its own that only
 * sends the microphone, offered through `camera/webrtc/offer`. go2rtc passes the sound on to a camera with two-way
 * audio (ONVIF Profile T, Tapo, Dahua, Hikvision and others); one without it takes the connection and stays silent.
 */
export async function startGo2rtcTalk(
  hass,
  entityId,
  {
    media = globalThis.navigator?.mediaDevices,
    PeerConnectionImpl = globalThis.RTCPeerConnection,
    onEnd = () => {},
  } = {},
) {
  const fail = (reason, cause) => Object.assign(new Error(reason), { reason, cause });
  let stream;
  try {
    stream = await media.getUserMedia({ audio: { channelCount: 1, echoCancellation: true }, video: false });
  } catch (error) {
    throw fail("microphone", error);
  }
  let peer;
  let unsubscribe;
  let ended = false;
  let session = null;
  const waiting = []; // our candidates found before Home Assistant named the session
  const release = () => {
    stream.getTracks().forEach((track) => track.stop());
    peer?.close();
    unsubscribe?.();
  };
  const finish = (reason) => {
    if (ended) return;
    ended = true;
    release();
    onEnd(reason);
  };
  const sendCandidate = (candidate) =>
    hass.callWS({ type: "camera/webrtc/candidate", entity_id: entityId, session_id: session, candidate }).catch(() => {});
  try {
    peer = new PeerConnectionImpl({});
    peer.addTransceiver(stream.getAudioTracks()[0], { direction: "sendonly" });
    peer.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      const json = candidate.toJSON ? candidate.toJSON() : candidate;
      if (session) sendCandidate(json);
      else waiting.push(json);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed") finish("unreachable");
    };
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const answered = new Promise((resolve, reject) => {
      hass.connection
        .subscribeMessage(
          (message) => {
            if (message.type === "session") {
              session = message.session_id;
              waiting.splice(0).forEach(sendCandidate);
            } else if (message.type === "answer") {
              peer.setRemoteDescription({ type: "answer", sdp: message.answer }).then(resolve, reject);
            } else if (message.type === "candidate") {
              peer.addIceCandidate(message.candidate).catch(() => {});
            } else if (message.type === "error") {
              reject(fail("failed", message));
              finish("failed");
            }
          },
          { type: "camera/webrtc/offer", entity_id: entityId, offer: offer.sdp },
        )
        .then((stop) => {
          unsubscribe = stop;
          if (ended) stop();
        }, reject);
    });
    await answered;
  } catch (error) {
    ended = true;
    release();
    throw error.reason ? error : fail("failed", error);
  }
  return {
    stop() {
      finish(null);
    },
  };
}
