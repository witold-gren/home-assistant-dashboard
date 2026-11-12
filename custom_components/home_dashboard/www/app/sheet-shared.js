// What the parts of the sheet share: timings, sizes, the kinds of windows and their keys.

import { domainOf } from "./model.js";

export const COMMIT_DELAY_MS = 500;
// How long a note on why talking through a camera does not work stays.
export const TALK_PROBLEM_MS = 6000;
export const COVER_SET_POSITION = 4;
export const COVER_STOP = 8;
export const COVER_TICK_MS = 250;
export const EVERYONE_ELSE = "__everyone_else";
export const VOLUME_STEP_MS = 250;
export const VOLUME_HOLD_MS = 1500;
export const SHEET_LEAVE_MS = 240;
export const SHEET_DRAG_START_PX = 8;
// Whatever handles a finger itself keeps it: a slider, a dial or a card with its own gestures.
// Places whose own gestures come first: a drag down there does not close the window. A zoomed camera picture is
// one of them, as the finger moves the picture; unzoomed, a drag down on it closes the window as before.
export const OWN_GESTURES =
  "[data-slider], .dial, .panel-card, .live, input, textarea, select, iframe, video, home-dashboard-timeline, .stage.zoomed, .cameras-open .thumbs";
export const LIVE_LIMIT_MS = 120000;
// How often a waking live view is checked for a moving video.
export const LIVE_WATCH_MS = 200;
// Turning a quick button's entity on or off: a siren by its own service, a script by running it, the rest generally.
export function onOff(entityId, on) {
  const domain = domainOf(entityId);
  if (domain === "siren") return { domain, service: on ? "turn_on" : "turn_off", data: { entity_id: entityId } };
  if (domain === "script") return { domain, service: on ? "turn_on" : "turn_off", data: { entity_id: entityId } };
  return { domain: "homeassistant", service: on ? "turn_on" : "turn_off", data: { entity_id: entityId } };
}

// A picture narrower than this is not one yet (still loading, or none): the buttons keep to the screen's edges.
export const MEDIA_MIN_PX = 100;
// How often the pictures of the list of cameras are asked for again.
export const CAMERA_CARDS_REFRESH_MS = 30_000;
// A tablet: the cameras fill a black screen, in as many columns as chosen, on this device or in the settings.
export const TABLET = "(min-width: 900px)";
export const CAMERA_COLUMNS_KEY = "home-dashboard-camera-columns";
export const CAMERA_LAYOUT_KEY = "home-dashboard-camera-layout";
// The recordings on a camera's own card: asked for again this often while their window is open (what is on the disk,
// what is coming down, new pictures), and at most this many pictures asked for at once, each waking the camera.
export const SD_POLL_MS = 3000;
// A copy asked for that has not started by then was turned down by the camera.
export const SD_GIVE_UP_MS = 20_000;
export const SD_THUMBNAILS_AT_ONCE = 24;
// The recordings on the disk are read a few days at a time, newest first, as the list is scrolled to its end.
export const DISK_MIN_CLIPS = 24;
export const DISK_DAYS_AT_ONCE = 7;
// A panel with a card beside its own parts: a wide screen on its side, a tablet's.
export const SPLIT_PANEL = "(orientation: landscape) and (min-width: 900px) and (min-height: 501px)";
// How often a camera's picture that did not load is asked for again.
export const PICTURE_RETRY_MS = 5000;
// How long, and how often, a starting live view is made to take the sound before its stream connects.
export const LIVE_HEAR_MS = 10000;
export const LIVE_HEAR_TICK_MS = 50;
// A long press on the sound button opens its slider.
export const SOUND_HOLD_MS = 500;
// A phone on its side: the camera fills the screen and the days and the line of time wait at its edges.
// The camera on the whole screen: a phone on its side, and a tablet or a computer with a wide window.
export const LANDSCAPE_PHONE = "(orientation: landscape) and (max-height: 500px), (orientation: landscape) and (min-width: 900px)";
export const SWIPE_AWAY_PX = 40;
export const PLAYER_TICK_MS = 1000;
export const DIAL_SIZE = 280;
export const DIAL_RADIUS = 124;
export const TILE_SHEETS = {
  alarm_control_panel: "alarm",
  automation: "switch",
  binary_sensor: "binary",
  climate: "climate",
  cover: "cover",
  input_boolean: "switch",
  light: "light",
  lock: "lock",
  media_player: "player",
  input_select: "select",
  select: "select",
  sensor: "sensor",
  switch: "switch",
};
export const CHOICE_LIMIT = 12;
export const PIN_LENGTH = 8;
export const PIN_SETTLE_MS = 400;
export const TV_ALERT_CLASSES = new Set(["door", "window", "problem"]);
export const WEBOS_ARROWS = [
  { key: "tv_key_up", button: "UP", icon: "mdi:chevron-up", place: "up" },
  { key: "tv_key_left", button: "LEFT", icon: "mdi:chevron-left", place: "left" },
  { key: "tv_key_ok", button: "ENTER", label: "OK", place: "ok" },
  { key: "tv_key_right", button: "RIGHT", icon: "mdi:chevron-right", place: "right" },
  { key: "tv_key_down", button: "DOWN", icon: "mdi:chevron-down", place: "down" },
];
export const WEBOS_KEYS = [
  { key: "tv_key_back", button: "BACK", icon: "mdi:arrow-left" },
  { key: "tv_key_home", button: "HOME", icon: "mdi:home" },
  { key: "tv_key_menu", button: "MENU", icon: "mdi:cog-outline" },
  { key: "tv_key_exit", button: "EXIT", icon: "mdi:exit-to-app" },
  { key: "tv_key_channel_down", button: "CHANNELDOWN", icon: "mdi:minus-box-outline" },
  { key: "tv_key_play", button: "PLAY", icon: "mdi:play" },
  { key: "tv_key_pause", button: "PAUSE", icon: "mdi:pause" },
  { key: "tv_key_channel_up", button: "CHANNELUP", icon: "mdi:plus-box-outline" },
];
// An Apple TV's remote: the commands of `remote.send_command` on the remote entity of its device.
export const APPLE_ARROWS = [
  { key: "tv_key_up", button: "up", icon: "mdi:chevron-up", place: "up" },
  { key: "tv_key_left", button: "left", icon: "mdi:chevron-left", place: "left" },
  { key: "tv_key_ok", button: "select", label: "OK", place: "ok" },
  { key: "tv_key_right", button: "right", icon: "mdi:chevron-right", place: "right" },
  { key: "tv_key_down", button: "down", icon: "mdi:chevron-down", place: "down" },
];
export const APPLE_KEYS = [
  { key: "tv_key_back", button: "menu", icon: "mdi:arrow-left" },
  { key: "tv_key_home", button: "home", icon: "mdi:television-guide" },
  { key: "tv_key_top_menu", button: "top_menu", icon: "mdi:menu" },
  { key: "tv_key_play_pause", button: "play_pause", icon: "mdi:play-pause" },
  { key: "tv_key_skip_backward", button: "skip_backward", icon: "mdi:rewind-10" },
  { key: "tv_key_skip_forward", button: "skip_forward", icon: "mdi:fast-forward-10" },
];
export const LIGHT_HOLD_MS = 2000;
export const COLOUR_MODES = new Set(["hs", "xy", "rgb", "rgbw", "rgbww"]);
export const WHITE_PRESETS = [
  { kelvin: 2200, colour: "#ff9a3c" },
  { kelvin: 2700, colour: "#ffc48f" },
  { kelvin: 4000, colour: "#ffe6d2" },
  { kelvin: 6500, colour: "#fdfcf6" },
];
export const COLOUR_PRESETS = [
  [122, 167, 255],
  [199, 146, 255],
  [255, 155, 232],
  [255, 106, 77],
];
// Bits of supported_features; disarming needs none.
export const ALARM_MODES = [
  { state: "armed_home", service: "alarm_arm_home", feature: 1, icon: "mdi:home" },
  { state: "armed_away", service: "alarm_arm_away", feature: 2, icon: "mdi:lock" },
  { state: "armed_night", service: "alarm_arm_night", feature: 4, icon: "mdi:weather-night" },
  { state: "armed_vacation", service: "alarm_arm_vacation", feature: 32, icon: "mdi:airplane" },
  { state: "armed_custom_bypass", service: "alarm_arm_custom_bypass", feature: 16, icon: "mdi:shield" },
  { state: "disarmed", service: "alarm_disarm", feature: 0, icon: "mdi:shield-off" },
];
export const BACKGROUNDS = [
  "linear-gradient(160deg, #1d3b53, #4d7ea8)",
  "linear-gradient(160deg, #2d5a3d, #8fbf7f)",
  "linear-gradient(160deg, #7a3e1d, #e0a458)",
  "linear-gradient(160deg, #4a2f6b, #b08bd6)",
  "linear-gradient(160deg, #7a1f3d, #e07a8f)",
  "linear-gradient(160deg, #2b2d33, #6b6f7a)",
];
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
export const ENTITY_FREE_KINDS = new Set([
  "access",
  "chart",
  "sd",
  "disk",
  "app",
  "background",
  "block-edit",
  "cameras",
  "blocks",
  "departures",
  "group",
  "history",
  "host",
  "intercom",
  "logbook",
  "news",
  "notifications",
  "page",
  "panel",
  "personal",
  "look",
  "pin",
  "room-view",
  "rooms",
  "scale",
  "school",
  "overview",
  "tile-edit",
  "tile-picker",
]);
