// The colour of what is on or chosen in a window (a source, a sound mode, OK, the fill of a slider). By default a milky
// pane of the writing of the window, 90 % opaque, with the writing in the opposite tone: white glass with dark writing
// over a dark or coloured background, dark glass with white writing in a light window. It fits any background of a
// room, yellow, blue or purple, without a colour of its own. The look can set one (`appearance.sheets.accent`).

/** How opaque the milky pane of what is on is. */
export const ACCENT_OPACITY = 90;

let context;
const canvas = () =>
  (context ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", {
    willReadFrequently: true,
  }));

/** The red, green and blue (0–255) of any CSS colour, or null when it is none. */
export function rgbOf(colour) {
  if (!colour) return null;
  const paint = canvas();
  paint.clearRect(0, 0, 1, 1);
  paint.fillStyle = "#00000000";
  paint.fillStyle = colour;
  paint.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = paint.getImageData(0, 0, 1, 1).data;
  return alpha ? [red, green, blue] : null;
}

/** Relative luminance (WCAG), 0 for black to 1 for white. */
export function luminance(rgb) {
  const [r, g, b] = rgb.map((value) => {
    const share = value / 255;
    return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The writing on a colour: white on a dark one, near black on a light one. */
export const inkOn = (rgb) => (luminance(rgb) > 0.4 ? "#1d1d1f" : "#ffffff");

/** A chosen colour as it is, with its writing. */
export function accentFor(colour) {
  const rgb = rgbOf(colour);
  return rgb ? { fill: colour, ink: inkOn(rgb) } : null;
}

/** The milky pane of a window whose writing has this colour. */
export function milkyFor(text) {
  const rgb = rgbOf(text);
  return rgb ? { fill: `color-mix(in srgb, ${text.slice(0, 7)} ${ACCENT_OPACITY}%, transparent)`, ink: inkOn(rgb) } : null;
}
