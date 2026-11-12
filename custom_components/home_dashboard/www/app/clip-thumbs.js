// Pictures of recorded files, which come without one: a frame from the start of the file, taken in the browser. A
// video asks only for the parts it needs, two files at a time, and a picture once taken is kept on this device (in
// the cache of the browser where it has one, else until the page reloads), so the next look is at once.

const CACHE = "home-dashboard-clip-thumbs";
const CACHE_PREFIX = "/home-dashboard-clip-thumbs/";
const AT_SECONDS = 1;
const WIDTH = 320;
const QUALITY = 0.7;
const TIMEOUT_MS = 20_000;
const AT_ONCE = 2;

const known = new Map();
const waiting = [];
let running = 0;

const cacheKey = (id) => `${CACHE_PREFIX}${encodeURIComponent(id)}`;
const cacheOpen = () => (globalThis.caches ? caches.open(CACHE).catch(() => null) : Promise.resolve(null));

async function fromCache(id) {
  const cache = await cacheOpen();
  const hit = await cache?.match(cacheKey(id)).catch(() => null);
  return hit ? hit.text() : null;
}

async function toCache(id, picture) {
  const cache = await cacheOpen();
  await cache?.put(cacheKey(id), new Response(picture, { headers: { "content-type": "text/plain" } })).catch(() => {});
}

/** A frame of a video at `url`, as a JPEG data URL, or null when it does not load in time. */
export function frameOf(url, { at = AT_SECONDS, width = WIDTH, timeout = TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let done = false;
    const finish = (picture) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      resolve(picture);
    };
    const timer = setTimeout(() => finish(null), timeout);
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener("loadedmetadata", () => {
      // A file of a second or less: its middle.
      video.currentTime = Math.min(at, (video.duration || 0) / 2);
    });
    video.addEventListener("seeked", () => {
      try {
        const height = Math.round((width * video.videoHeight) / (video.videoWidth || width)) || Math.round(width * 0.5625);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(video, 0, 0, width, height);
        finish(canvas.toDataURL("image/jpeg", QUALITY));
      } catch {
        finish(null);
      }
    });
    video.addEventListener("error", () => finish(null));
    video.src = url;
  });
}

function next() {
  while (running < AT_ONCE && waiting.length) {
    const job = waiting.shift();
    running += 1;
    job()
      .catch(() => null)
      .finally(() => {
        running -= 1;
        next();
      });
  }
}

/**
 * The picture of a recorded file `id`: a promise of a data URL, or null. `url` gives the address to play it from,
 * asked only when the picture is not kept yet.
 */
export function clipThumbnail(id, url, take = frameOf) {
  if (known.has(id)) return known.get(id);
  const promise = new Promise((resolve) => {
    waiting.push(async () => {
      let picture = await fromCache(id);
      if (!picture) {
        picture = await take(await url());
        if (picture) await toCache(id, picture);
      }
      resolve(picture);
    });
    next();
  });
  known.set(id, promise);
  // A picture that did not come may come another time.
  promise.then((picture) => picture || known.delete(id));
  return promise;
}
