// Design tokens. Everything is scoped to --hd-* so the page looks the same under any theme.
//
// All elements adopt this one stylesheet, so replacing its text recolours them together. "auto"
// follows the system, so a tablet that switches at dusk needs nothing from here.

import { unsafeCSS } from "../vendor/lit-all.min.js";

const MODE_KEY = "home_dashboard_color_mode";
const LIGHT_BACKGROUND = "#fbfaff";
const DARK_BACKGROUND = "#121316";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// A window over the page may bring its own colours (the look of windows): every element inside it,
// whatever shadow root it lives in, picks them up through the --hd-ov-* properties it inherits.
const LIGHT = `
    --hd-background: #fbfaff;
    --hd-surface: var(--hd-ov-surface, #ffffff);
    --hd-outline: var(--hd-ov-outline, #dfe2eb);
    --hd-text: var(--hd-ov-text, #1b1b1f);
    --hd-text-muted: var(--hd-ov-text-muted, #5b5e66);
    --hd-pill: var(--hd-ov-pill, #d3e3f2);
    --hd-player: #dbe2ea;
    --hd-off: var(--hd-ov-off, #ebebed);
    --hd-off-icon: var(--hd-ov-off-icon, #dcdcdf);
    --hd-off-ink: var(--hd-ov-off-ink, #45474d);
    --hd-climate: #ffe3c7;
    --hd-climate-icon: #cc6f00;
    --hd-climate-ink: #cc6f00;
    --hd-light: #fff5c4;
    --hd-light-icon: #ffdf3d;
    --hd-light-ink: #5c4a00;
    --hd-light-accent: #8a6d00;
    --hd-light-chip: #f6c700;
    --hd-security: #ffd9d7;
    --hd-security-icon: #b71c1c;
    --hd-security-ink: #b71c1c;
    --hd-cover: #e8dcf5;
    --hd-cover-icon: #d2c1e8;
    --hd-cover-ink: #5a3f8c;
    --hd-cover-accent: #5f3d8c;
    --hd-media: #c9eefb;
    --hd-media-icon: #9fe0f7;
    --hd-media-ink: #01579b;
    --hd-media-accent: #0b6a8c;
    --hd-media-chip: #0288d1;
    --hd-appliance: #c5ecd8;
    --hd-appliance-icon: #0c7c4f;
    --hd-appliance-ink: #0c7c4f;
    --hd-chip-green: #2e9e6b;
    --hd-chip-purple: #8e5fd0;
    --hd-chip-teal: #00958c;
    --hd-chip-pink: #d9498f;
    --hd-link: #0b57d0;
    --hd-star: #b98900;
    --hd-control: var(--hd-ov-control, #45474d);
    --hd-radius: 20px;
    --hd-rail-width: 88px;
    --hd-nav-height: 72px;
    --hd-safe-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
    --hd-safe-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
    /* The bar stays at the edge: the whole inset would leave an empty strip under it. */
    --hd-nav-safe: min(var(--hd-safe-bottom), 8px);
`;

const DARK = `
    --hd-background: #121316;
    --hd-surface: var(--hd-ov-surface, #1e1f24);
    --hd-outline: var(--hd-ov-outline, #3a3c43);
    --hd-text: var(--hd-ov-text, #e4e4ea);
    --hd-text-muted: var(--hd-ov-text-muted, #a3a6ae);
    --hd-pill: var(--hd-ov-pill, #2f3f52);
    --hd-player: #262a31;
    --hd-off: var(--hd-ov-off, #24262b);
    --hd-off-icon: var(--hd-ov-off-icon, #34363d);
    --hd-off-ink: var(--hd-ov-off-ink, #c8cad0);
    --hd-climate: #4a2f14;
    --hd-climate-icon: #cc6f00;
    --hd-climate-ink: #f0a24c;
    --hd-light: #443a10;
    --hd-light-icon: #e8c62e;
    --hd-light-ink: #3d3100;
    --hd-light-accent: #f0d24a;
    --hd-light-chip: #e8c62e;
    --hd-security: #4f1f1f;
    --hd-security-icon: #c62828;
    --hd-security-ink: #ff8a80;
    --hd-cover: #33284a;
    --hd-cover-icon: #4f3f70;
    --hd-cover-ink: #d9c8f5;
    --hd-cover-accent: #d9c8f5;
    --hd-media: #123c4b;
    --hd-media-icon: #1d5a70;
    --hd-media-ink: #b3ecff;
    --hd-media-accent: #8fdcf5;
    --hd-media-chip: #4fc3f7;
    --hd-appliance: #15392a;
    --hd-appliance-icon: #1f8a5e;
    --hd-appliance-ink: #5fd6a3;
    --hd-chip-green: #5fd6a3;
    --hd-chip-purple: #c3a6f5;
    --hd-chip-teal: #4dd0c4;
    --hd-chip-pink: #f48fb8;
    --hd-link: #a8c7fa;
    --hd-star: #f0d24a;
    --hd-control: var(--hd-ov-control, #c8cad0);
`;

const COMMON = `
  font-family: Roboto, -apple-system, system-ui, sans-serif;
  color: var(--hd-text);
  -webkit-tap-highlight-color: transparent;
`;

function tokensFor(mode) {
  if (mode === "dark") return `:host { ${LIGHT} ${DARK} ${COMMON} color-scheme: dark; }`;
  if (mode === "light") return `:host { ${LIGHT} ${COMMON} color-scheme: light; }`;
  return `:host { ${LIGHT} ${COMMON} color-scheme: light dark; } @media ${DARK_QUERY} { :host { ${DARK} } }`;
}

// Remembered so that a dark room is not lit up by the light colours while the page connects.
function storedMode() {
  try {
    return localStorage.getItem(MODE_KEY) ?? "auto";
  } catch {
    return "auto";
  }
}

let colorMode = storedMode();

export const tokens = unsafeCSS(tokensFor(colorMode));

export function applyColorMode(mode) {
  if (mode === colorMode) return;
  colorMode = mode;
  tokens.styleSheet?.replaceSync(tokensFor(mode));
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Private browsing: the choice still holds until the page closes.
  }
}

export const currentColorMode = () => colorMode;

export const DARK_SCHEME = DARK_QUERY;

export const isDark = () => colorMode === "dark" || (colorMode === "auto" && window.matchMedia(DARK_QUERY).matches);

export const pageColour = () => (isDark() ? DARK_BACKGROUND : LIGHT_BACKGROUND);

// A background is a colour, a gradient or the address of a picture. The value ends up in a style
// attribute, so anything that could end the declaration is removed.
export function backgroundStyle(value, position = "center") {
  const clean = String(value).replace(/[";{}<>]/g, "");
  const part = ["top", "bottom"].includes(position) ? position : "center";
  return /^(\/|https?:|data:image\/)/.test(clean)
    ? `background-image: url("${clean}"); background-position: center ${part}`
    : `background: ${clean}`;
}

// A phone or a tablet held upright is tall; a tablet on its side and a laptop are wide.
export const WIDE_QUERY = "(min-aspect-ratio: 1/1)";
export const screenShape = () => (window.matchMedia(WIDE_QUERY).matches ? "wide" : "tall");

const paint = (() => {
  let context;
  return () => (context ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true }));
})();

function channels(colour) {
  const context = paint();
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = colour;
  context.fillRect(0, 0, 1, 1);
  return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
}

// The share of the theme over a background, as in .backdrop::after on the page, unless the look
// of the page says otherwise.
const BACKGROUND_VEIL = 0.6;

export function veiled(colour, veil = pageColour(), share = BACKGROUND_VEIL) {
  const [top, over] = [channels(colour), channels(veil)];
  const mixed = top.map((value, index) => Math.round(value + (over[index] - value) * share));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function pictureTop(url) {
  return new Promise((resolve) => {
    const picture = new Image();
    picture.onload = () => {
      const context = paint();
      context.drawImage(picture, 0, 0, picture.width, picture.height * 0.1, 0, 0, 1, 1);
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
      resolve(`rgb(${red}, ${green}, ${blue})`);
    };
    picture.onerror = () => resolve(null);
    picture.src = url;
  });
}

// The colour along the top edge of a background, which the area over the page continues.
export async function backgroundTop(value, share = BACKGROUND_VEIL) {
  if (!value) return pageColour();
  const clean = String(value).trim();
  if (/^(\/|https?:)/.test(clean)) {
    const top = await pictureTop(clean);
    return top ? veiled(top, pageColour(), share) : pageColour();
  }
  const first = /gradient/.test(clean)
    ? clean.match(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/i)?.[0]
    : clean;
  return first ? veiled(first, pageColour(), share) : pageColour();
}

// A background painted on the view itself, under the same veil as on the page. The view scrolls, but
// its own background does not move: the page bounces over a background that stays where it is.
export function viewBackgroundFor(value, position = "center", share = BACKGROUND_VEIL) {
  const clean = String(value ?? "").replace(/[";{}<>]/g, "").trim();
  if (!clean) return null;
  const [red, green, blue] = channels(pageColour());
  const veil = `rgba(${red}, ${green}, ${blue}, ${share})`;
  const part = ["top", "bottom"].includes(position) ? position : "center";
  const layer = /^(\/|https?:|data:image\/)/.test(clean)
    ? `url("${clean}") center ${part} / cover no-repeat`
    : /gradient\(/.test(clean)
      ? clean
      : `linear-gradient(${clean}, ${clean})`;
  return `linear-gradient(${veil}, ${veil}), ${layer}, ${pageColour()}`;
}

// For Home Assistant's own view behind the page, which the tokens cannot reach.
export function viewBackground() {
  const rule = (colour) => `#view { background: ${colour} !important; }`;
  if (colorMode === "dark") return rule(DARK_BACKGROUND);
  if (colorMode === "light") return rule(LIGHT_BACKGROUND);
  return `${rule(LIGHT_BACKGROUND)} @media ${DARK_QUERY} { ${rule(DARK_BACKGROUND)} }`;
}
