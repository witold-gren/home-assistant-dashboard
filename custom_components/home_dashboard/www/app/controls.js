// The arithmetic of the touch controls, kept apart from the DOM so it can be tested on its own.

export const DIAL_START = 135;
export const DIAL_SWEEP = 270;
// A lock moves only when the thumb reaches the far end of the track, so a stray swipe does nothing.
export const LOCK_COMMIT_RATIO = 0.85;

export const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

const roundToStep = (value, step) => Number((Math.round(value / step) * step).toFixed(2));

export function stepTemperature(value, delta, { min, max, step }) {
  return clamp(roundToStep(value + delta * step, step), min, max);
}

// 0 at the bottom of the track, 1 at the top.
export function sliderRatio(clientY, rect) {
  return clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
}

export function lockIntent(ratio, locked) {
  if (locked) return ratio >= LOCK_COMMIT_RATIO ? "unlock" : null;
  return ratio <= 1 - LOCK_COMMIT_RATIO ? "lock" : null;
}

export function dialAngle(value, min, max) {
  return DIAL_START + (clamp((value - min) / (max - min), 0, 1) || 0) * DIAL_SWEEP;
}

export function dialValue(x, y, centerX, centerY, { min, max, step }) {
  const angle = (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;
  const fromStart = (angle - DIAL_START + 720) % 360;
  // The gap at the bottom of the dial snaps to the nearer end.
  const swept = fromStart <= DIAL_SWEEP ? fromStart : fromStart < (DIAL_SWEEP + 360) / 2 ? DIAL_SWEEP : 0;
  return clamp(roundToStep(min + (swept / DIAL_SWEEP) * (max - min), step), min, max);
}

export function arcPath(center, radius, fromAngle, toAngle) {
  const point = (angle) => {
    const radians = (angle * Math.PI) / 180;
    return `${(center + radius * Math.cos(radians)).toFixed(2)} ${(center + radius * Math.sin(radians)).toFixed(2)}`;
  };
  const large = toAngle - fromAngle > 180 ? 1 : 0;
  return `M ${point(fromAngle)} A ${radius} ${radius} 0 ${large} 1 ${point(toAngle)}`;
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Most blinds report their position only when they stop, so the sheet estimates the way there.
// A full run in this house takes 30 to 46 seconds.
export const COVER_TRAVEL_MS = 35000;
const COVER_GRACE_MS = 10000;
const MOVING = { opening: 100, closing: 0 };

export function startCoverMotion(from, to, now, reported = from) {
  return { from, to, started: now, duration: (Math.abs(to - from) / 100) * COVER_TRAVEL_MS, reported };
}

export function coverEstimate(motion, now) {
  if (!motion.duration) return motion.to;
  return Math.round(motion.from + (motion.to - motion.from) * clamp((now - motion.started) / motion.duration, 0, 1));
}

// What the motion becomes after a look at the entity: null means the entity can be believed again.
// Some blinds never report opening or closing, so a new position or the time running out ends it too.
export function followCover(motion, stateObj, now) {
  const position = stateObj.attributes.current_position;
  const target = MOVING[stateObj.state];
  if (target !== undefined) {
    const known = position ?? 100 - target;
    if (!motion) return { ...startCoverMotion(known, target, Date.parse(stateObj.last_changed) || now, position), seen: true };
    const reversed = !motion.hold && (target > motion.from) !== (motion.to > motion.from) && motion.to !== motion.from;
    if (reversed) return { ...startCoverMotion(coverEstimate(motion, now), target, now, position), seen: true };
    return motion.seen ? motion : { ...motion, seen: true };
  }
  if (!motion || motion.seen || position !== motion.reported) return null;
  return now > motion.started + motion.duration + COVER_GRACE_MS ? null : motion;
}

// A sheet follows the finger and goes away after a long pull or a quick flick.
export const SHEET_DISMISS_RATIO = 0.3;
export const SHEET_DISMISS_SPEED = 0.6;

export function sheetDismissed(distance, height, speed) {
  return distance > Math.min(height * SHEET_DISMISS_RATIO, 200) || (distance > 24 && speed > SHEET_DISMISS_SPEED);
}
