// Zooming into the picture of a camera window with two fingers: pinch to zoom around the point between them, one
// finger moves a zoomed picture, a double tap zooms in at that point or back out, and ctrl with the wheel (a trackpad
// pinch on a computer) does the same. Only the picture is scaled, by a transform; what lies over it stays as it is.
// A digital zoom: the camera does not move, the frames that came are enlarged.

export const MAX_ZOOM = 4;
export const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 30;
const TAP_SLOP_PX = 10;
const WHEEL_STEP = 0.01;

const NONE = { scale: 1, x: 0, y: 0 };

/**
 * A view kept within the picture: 1× to MAX_ZOOM, never showing anything past its edges. `rect` is where the
 * picture itself lies in the element (a video shown smaller than its element leaves bands); the whole element when
 * not given. The rectangle stays covered by the picture at any scale.
 */
export function clampView({ scale, x, y }, width, height, rect = { left: 0, top: 0, width, height }) {
  const s = Math.min(MAX_ZOOM, Math.max(1, scale));
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const round = (value) => Math.round(value * 1000) / 1000 || 0; // no -0 or 1e-14 left over from the measuring
  return {
    scale: s,
    x: round(Math.min(rect.left * (1 - s), Math.max(right * (1 - s), x))),
    y: round(Math.min(rect.top * (1 - s), Math.max(bottom * (1 - s), y))),
  };
}

/** The part of the element to show at a view, so the zoomed picture never spills past where it lay: a clip-path. */
export function clipFor({ scale, x, y }, width, height, rect = { left: 0, top: 0, width, height }) {
  if (scale <= 1) return "";
  const left = (rect.left - x) / scale;
  const top = (rect.top - y) / scale;
  const right = width - (rect.left + rect.width - x) / scale;
  const bottom = height - (rect.top + rect.height - y) / scale;
  const px = (value) => `${Math.max(0, Math.round(value * 10) / 10)}px`;
  return `inset(${px(top)} ${px(right)} ${px(bottom)} ${px(left)})`;
}

/** The view at `scale` that keeps the point `at` (on the picture as it lies on screen) where it is. */
export function zoomAround(view, scale, at, width, height, rect) {
  const px = (at.x - view.x) / view.scale;
  const py = (at.y - view.y) / view.scale;
  return clampView({ scale, x: at.x - px * scale, y: at.y - py * scale }, width, height, rect);
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const middle = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export class PictureZoom {
  /** `target()` gives the picture element to scale, `onChange(view)` shows a new view. */
  constructor(target, onChange, content = () => null) {
    this.target = target;
    this.onChange = onChange;
    // Where the picture lies in its element, measured while it is not zoomed (a zoomed one has moved).
    this.content = content;
    this.rect = null;
    this.view = NONE;
    this.pointers = new Map();
    this.start = null;
    this.moved = false;
    this.lastTap = null;
  }

  // The picture's own box: where it lies and how big it is, before it is scaled.
  _box() {
    const element = this.target();
    if (!element) return null;
    const parent = element.parentElement.getBoundingClientRect();
    const box = { left: parent.left + element.offsetLeft, top: parent.top + element.offsetTop, width: element.offsetWidth, height: element.offsetHeight };
    if (this.view.scale <= 1) this.rect = this.content(element, box);
    return { ...box, rect: this.rect ?? undefined };
  }

  _local(event, box) {
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  _set(view) {
    this.view = view;
    this.onChange(view);
  }

  reset() {
    this.rect = null;
    this.pointers.clear();
    this.fingers = "";
    this.start = null;
    this._set(NONE);
  }

  /** Whether the last tap was part of a gesture, so it is not also taken as a tap on the picture. */
  takeGesture() {
    const moved = this.moved;
    this.moved = false;
    return moved;
  }

  _begin(box) {
    const points = [...this.pointers.values()];
    this.start =
      points.length >= 2
        ? { distance: distance(points[0], points[1]) || 1, middle: middle(points[0], points[1]), view: this.view, box }
        : { point: points[0], view: this.view, box };
  }

  down(event) {
    const box = this._box();
    if (!box) return;
    // The first finger of a new touch: any finger still remembered lost its lifting on the way (iOS does that),
    // and kept, it would turn one finger into a pinch.
    if (event.isPrimary) this.pointers.clear();
    this.pointers.set(event.pointerId, this._local(event, box));
    // Two fingers pinch; a third one replaces the oldest.
    while (this.pointers.size > 2) this.pointers.delete(this.pointers.keys().next().value);
    if (this.pointers.size === 1) this.moved = false;
    this._begin(box);
  }

  move(event) {
    if (!this.pointers.has(event.pointerId) || !this.start) return;
    this.pointers.set(event.pointerId, this._local(event, this.start.box));
    this._apply();
  }

  // The fingers as they are now, against where they were when the gesture (or its last change) began.
  _apply() {
    const { box } = this.start;
    const points = [...this.pointers.values()];
    if (points.length >= 2 && this.start.distance) {
      // The point of the picture that was between the fingers stays between them, at the new scale.
      const now = middle(points[0], points[1]);
      const { view, middle: then } = this.start;
      const scale = (view.scale * distance(points[0], points[1])) / this.start.distance;
      const px = (then.x - view.x) / view.scale;
      const py = (then.y - view.y) / view.scale;
      this.moved = true;
      this._set(clampView({ scale, x: now.x - px * scale, y: now.y - py * scale }, box.width, box.height, box.rect));
    } else if (points.length === 1 && this.start.point) {
      const dx = points[0].x - this.start.point.x;
      const dy = points[0].y - this.start.point.y;
      if (Math.hypot(dx, dy) > TAP_SLOP_PX) this.moved = true;
      if (this.view.scale > 1) {
        const { view } = this.start;
        this._set(clampView({ scale: view.scale, x: view.x + dx, y: view.y + dy }, box.width, box.height, box.rect));
      }
    }
  }

  up(event, now = Date.now()) {
    const point = this.pointers.get(event.pointerId);
    if (!point) return;
    this.pointers.delete(event.pointerId);
    const box = this.start?.box;
    if (this.pointers.size) {
      // One finger of a pinch lifted: the other one goes on moving the picture from where it is.
      this._begin(box);
      return;
    }
    this.start = null;
    this._lifted(point, box, now);
  }

  // The last finger lifted at `point`: a tap, or the second tap of a double tap, unless the fingers moved.
  _lifted(point, box, now) {
    if (this.moved || !box) {
      this.lastTap = null;
      return;
    }
    const tap = this.lastTap;
    if (tap && now - tap.time < DOUBLE_TAP_MS && distance(tap, point) < DOUBLE_TAP_PX) {
      this.lastTap = null;
      this.moved = true; // a double tap is not also a tap on the picture
      this._set(this.view.scale > 1 ? NONE : zoomAround(this.view, DOUBLE_TAP_ZOOM, point, box.width, box.height, box.rect));
      return;
    }
    this.lastTap = { time: now, x: point.x, y: point.y };
  }

  /**
   * Touch events, which list the fingers on the screen at every step: nothing is remembered between them, so a
   * finger whose lifting a browser reports late (pointer events do on iOS and in Chrome) cannot turn one finger
   * into a pinch.
   */
  touch(event, now = Date.now()) {
    const box = this.start?.box ?? this._box();
    if (!box) return;
    const fingers = [...event.touches].slice(0, 2).map((touch) => [touch.identifier, this._local(touch, box)]);
    const key = fingers.map(([id]) => id).join(",");
    if (key !== this.fingers) {
      // Fingers came or went: the gesture goes on from here, with those on the screen now.
      if (event.type === "touchstart" && event.touches.length === event.changedTouches.length) this.moved = false;
      this.fingers = key;
      this.pointers = new Map(fingers);
      if (fingers.length) {
        this._begin(box);
      } else {
        this.start = null;
        const last = event.changedTouches?.[0];
        if (event.type === "touchend" && last) this._lifted(this._local(last, box), box, now);
      }
      return;
    }
    if (!this.start) return;
    this.pointers = new Map(fingers);
    this._apply();
  }

  cancel(event) {
    if (!this.pointers.delete(event.pointerId)) return;
    if (this.pointers.size) this._begin(this.start?.box ?? this._box());
    else this.start = null;
  }

  /** Ctrl with the wheel, which is also what a trackpad pinch sends on a computer. */
  wheel(event) {
    if (!event.ctrlKey) return false;
    const box = this._box();
    if (!box) return false;
    const scale = this.view.scale * Math.exp(-event.deltaY * WHEEL_STEP);
    this._set(zoomAround(this.view, scale, this._local(event, box), box.width, box.height, box.rect));
    return true;
  }
}
