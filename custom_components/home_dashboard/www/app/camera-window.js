// The window of a camera opened from outside: by an automation (home_dashboard.show_camera, e.g. motion seen) or by
// an address (a tap on a notification: ?camera=camera.iwiny_slup&live=1). It is the dashboard's own camera window,
// with the picture of the event, closing by itself after a while unless somebody starts the live view or touches it.

import { buildCameras, liveCameraFor } from "./model.js";

const BROWSER_MOD_KEY = "browser_mod-browser-id";

/** The id Browser Mod gave this device (e.g. "hall_ipad"), or null without Browser Mod. */
export function browserModId() {
  try {
    const id = globalThis.localStorage?.getItem(BROWSER_MOD_KEY);
    return id && !["undefined", "null"].includes(id.trim()) ? id.trim() : null;
  } catch {
    return null;
  }
}

/**
 * The camera of the dashboard for an entity asked for: the same entity, the camera whose live view it is, a camera
 * of the same device, or the camera whose turning and talking it gives (`cameras.controls`: a Frigate camera of a
 * room with the eufy camera of that room behind it). Null when the dashboard does not show it to this person
 * (hidden, private, a guest).
 */
export function cameraTileFor(hass, config, entityId) {
  const cameras = buildCameras(hass, config).map((camera) => camera.entityId);
  const found = (wanted) => {
    if (cameras.includes(wanted)) return wanted;
    const live = cameras.find((id) => liveCameraFor(hass, id, config) === wanted);
    if (live) return live;
    const device = hass.entities?.[wanted]?.device_id;
    return (device && cameras.find((id) => hass.entities?.[id]?.device_id === device)) ?? null;
  };
  const direct = found(entityId);
  if (direct) return direct;
  // A camera the dashboard shows through another one: the same room, the window of the one it shows.
  const device = hass.entities?.[entityId]?.device_id;
  const behind = Object.entries(config.cameras?.controls ?? {}).find(
    ([, controls]) => controls === entityId || (device && hass.entities?.[controls]?.device_id === device),
  );
  return behind ? found(behind[0]) : null;
}

/** Why a camera asked for is not shown: not in the dashboard for this person, or not in Home Assistant at all. */
export const missingReason = (hass, entityId) => (hass.states?.[entityId] ? "hidden" : "unknown_camera");

/** A camera asked for by the address of the page, once: { entityId, live } or null. */
export function cameraFromAddress(search = window.location.search) {
  const params = new URLSearchParams(search);
  const entityId = params.get("camera");
  if (!entityId) return null;
  return { entityId, live: ["1", "true", "yes"].includes(params.get("live") ?? "") };
}

/** The address without the camera asked for, so a reload or the back button does not open it again. */
export function addressWithoutCamera(href = window.location.href) {
  const url = new URL(href);
  url.searchParams.delete("camera");
  url.searchParams.delete("live");
  return `${url.pathname}${url.search}${url.hash}`;
}
