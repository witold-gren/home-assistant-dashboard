// The answer to a touch, for everything at once. The buttons here have their styles reset, and iOS
// shows nothing on them, so a tap that worked looks like one that did not. Animations reach into
// every shadow root, which a stylesheet would not.

const PRESSABLE = 'button:not([disabled]), a[href], summary, [role="button"], .edit-tile';
// A slider follows the finger already, and a card of Home Assistant answers by itself.
const OWN_FEEDBACK = "[data-slider], [data-grip], .panel-card, .live, iframe";
const DASHBOARD = /^home-dashboard-/;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
// A finger that starts to scroll is cancelled within this time, so nothing flashes under it.
const PRESS_DELAY_MS = 60;
const PRESS_MS = 90;
const RELEASE_MS = 260;
const PRESSED = { transform: "scale(0.93)", opacity: 0.65 };
const RESTING = { transform: "scale(1)", opacity: 1 };

let press = null;

export function pressTarget(path) {
  const nodes = path.filter((node) => node instanceof Element);
  if (!nodes.some((node) => DASHBOARD.test(node.localName))) return null;
  if (nodes.some((node) => node.matches(OWN_FEEDBACK))) return null;
  return nodes.find((node) => node.matches(PRESSABLE)) ?? null;
}

function sink() {
  press.held = press.element.animate([RESTING, PRESSED], { duration: PRESS_MS, easing: "ease-out", fill: "forwards" });
}

function rise({ element, held }) {
  const frames = held ? [PRESSED, RESTING] : [RESTING, PRESSED, RESTING];
  element.animate(frames, { duration: RELEASE_MS, easing: "ease-out" });
  held?.cancel();
}

function onDown(event) {
  if (window.matchMedia(REDUCED_MOTION).matches) return;
  const element = pressTarget(event.composedPath());
  if (!element) return;
  press = { element, held: null, timer: setTimeout(sink, PRESS_DELAY_MS) };
}

function onUp() {
  if (!press) return;
  clearTimeout(press.timer);
  rise(press);
  press = null;
}

function onCancel() {
  if (!press) return;
  clearTimeout(press.timer);
  press.held?.cancel();
  press = null;
}

export function watchPresses() {
  window.addEventListener("pointerdown", onDown, { capture: true, passive: true });
  window.addEventListener("pointerup", onUp, { capture: true, passive: true });
  window.addEventListener("pointercancel", onCancel, { capture: true, passive: true });
}

export function stopWatchingPresses() {
  window.removeEventListener("pointerdown", onDown, { capture: true });
  window.removeEventListener("pointerup", onUp, { capture: true });
  window.removeEventListener("pointercancel", onCancel, { capture: true });
}
