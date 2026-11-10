// The sound of a camera window: the live view and recordings play through one gain of the Web Audio API.
// A video's own volume is fixed on iPhone and iPad (only their buttons change it), so a slider that set it moved
// nothing there until it reached nought and muted. A gain turns smoothly everywhere. A live view's sound is taken
// from its stream and the video itself stays silent; a recording's is taken from the video. What cannot be taken
// (a stream played natively from a playlist on iPhone) falls back to the video's own volume and mute.

const routable = (video) => {
  const stream = video.srcObject;
  if (stream) return stream.getAudioTracks?.().length ? "stream" : null;
  return video.src && !/\.m3u8(\?|$)/.test(video.src) ? "element" : null;
};

/** Whether a video carries sound at all: a stream with a sound track, or a file whose sound is being decoded. */
export function hasSound(video) {
  const stream = video.srcObject;
  if (stream) return (stream.getAudioTracks?.() ?? []).some((track) => track.readyState !== "ended");
  if (video.audioTracks) return video.audioTracks.length > 0;
  if (typeof video.mozHasAudio === "boolean") return video.mozHasAudio;
  if (typeof video.webkitAudioDecodedByteCount === "number") return video.webkitAudioDecodedByteCount > 0;
  return true; // a browser that cannot tell: the button stays, as before
}

export function createSoundMixer(AudioContextImpl = globalThis.AudioContext ?? globalThis.webkitAudioContext) {
  let context = null;
  let gain = null;
  // video -> how its sound reaches the gain: "stream" (with the ids of the tracks taken) or "element"
  const routes = new WeakMap();

  function ready() {
    if (!context && AudioContextImpl) {
      try {
        context = new AudioContextImpl();
        gain = context.createGain();
        gain.connect(context.destination);
      } catch {
        context = null;
      }
    }
    return Boolean(context);
  }

  function route(video) {
    const kind = routable(video);
    if (!kind || !ready()) return null;
    const known = routes.get(video);
    if (kind === "element") {
      if (!known) {
        context.createMediaElementSource(video).connect(gain);
        routes.set(video, { kind });
      }
      return "element";
    }
    // A live view gets its sound track later than its picture, or a new one: take the tracks again then.
    const tracks = video.srcObject.getAudioTracks().map((track) => track.id).join(",");
    if (known?.tracks !== tracks) {
      known?.source?.disconnect();
      const source = context.createMediaStreamSource(video.srcObject);
      source.connect(gain);
      routes.set(video, { kind, tracks, source });
    }
    return "stream";
  }

  return {
    /** Whether the volume can be set at all: with Web Audio, everywhere. */
    get adjustable() {
      return Boolean(AudioContextImpl);
    },

    /** Play the sound of `videos` at `volume` (0–1), or not at all when `muted`. */
    apply(videos, { muted, volume }) {
      // Silent until someone turns the sound on: no audio is started without a tap.
      if (muted && !context) {
        for (const video of videos) video.muted = true;
        return;
      }
      const level = muted ? 0 : volume;
      if (gain) gain.gain.value = level;
      for (const video of videos) {
        const way = route(video);
        if (gain) gain.gain.value = level;
        if (way === "stream") video.muted = true; // heard through the gain, not twice
        else if (way === "element") video.muted = false; // a muted video gives the gain silence
        else {
          video.muted = muted;
          try {
            video.volume = volume;
          } catch {
            // Read-only on some systems: the mute above still works.
          }
        }
      }
    },

    /** Let the sound out: a browser starts audio only from a tap, so call this from one. */
    resume() {
      if (ready() && context.state === "suspended") context.resume().catch(() => {});
    },

    close() {
      context?.close().catch(() => {});
      context = null;
      gain = null;
    },
  };
}
