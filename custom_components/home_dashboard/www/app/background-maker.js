// The background maker: a gradient of two colours, a pattern drawn over it (background-motifs.js) and, if wanted, a
// photo laid on top, smaller and in a corner if wished, turned or mirrored, see-through, greyed, blurred and fading
// out from up to three of its edges, so the text of the dashboard stays readable. It is drawn in the browser, once
// upright for phones and once wide for tablets on their side, and sent to Home Assistant as pictures (or downloaded as files).

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { MOTIF_NAMES, READY_BACKGROUNDS, drawMotif } from "./background-motifs.js";
import { translate } from "./i18n.js";

// Gradients to start from, in groups: a colour at the top and one at the bottom.
export const MAKER_PALETTES = {
  calm: [
    ["#f5efe6", "#d9c8b4"], ["#fdfbfb", "#ebedee"], ["#eef2f3", "#c9d6df"], ["#e6dada", "#b8a9a9"],
    ["#ece9e6", "#c7c2bc"], ["#f3e7e9", "#d6c3c9"], ["#dfe6e0", "#aebfb2"], ["#d7d2cc", "#8e8a86"],
  ],
  cool: [
    ["#1d3b53", "#7fa7c9"], ["#0f2027", "#2c5364"], ["#2193b0", "#6dd5ed"], ["#3a6073", "#a7c4d4"],
    ["#4b6cb7", "#a3b8e8"], ["#134e5e", "#71b280"], ["#5f72bd", "#9b23ea"], ["#89f7fe", "#66a6ff"],
  ],
  warm: [
    ["#7a3e1d", "#f2c27b"], ["#ff7e5f", "#feb47b"], ["#f6d365", "#fda085"], ["#b24592", "#f15f79"],
    ["#c94b4b", "#f3a683"], ["#e65c00", "#f9d423"], ["#8e2de2", "#f07ea8"], ["#a1593d", "#e8c39e"],
  ],
  nature: [
    ["#2d5a3d", "#a8c69f"], ["#134e4a", "#5eead4"], ["#3e5151", "#decba4"], ["#56ab2f", "#c6e3a1"],
    ["#4e6a3a", "#d4c99a"], ["#1f4037", "#99f2c8"], ["#5a3f37", "#c9a77c"], ["#355c7d", "#c4d7b2"],
  ],
  pastel: [
    ["#fbc2eb", "#a6c1ee"], ["#fddb92", "#d1fdff"], ["#e0c3fc", "#8ec5fc"], ["#fad0c4", "#ffd1ff"],
    ["#d4fc79", "#96e6a1"], ["#a1c4fd", "#c2e9fb"], ["#ffecd2", "#fcb69f"], ["#cfd9df", "#e2ebf0"],
  ],
  night: [
    ["#0b0c10", "#1f2833"], ["#141e30", "#35577d"], ["#232526", "#5b5f66"], ["#1a1a2e", "#4a3f74"],
    ["#0f0c29", "#302b63"], ["#200122", "#6f0000"], ["#16222a", "#3a6073"], ["#121316", "#2b2d33"],
  ],
};
export const MAKER_PRESETS = Object.values(MAKER_PALETTES).flat();
export const MAKER_SIZES = { tall: [1290, 2796], wide: [2732, 2048] };
export const MAKER_DIRECTIONS = [180, 135, 225, 90];
// "tint": the photo takes the colours of the background under it, dark to light as it is (tintPixels)
export const MAKER_BLENDS = ["tint", "normal", "soft-light", "luminosity", "multiply", "screen"];
// How deep the darks and how light the lights of a tinted photo go, as shares of the background's colour
export const TINT_DARK = 0.3;
export const TINT_LIGHT = 0.55;
export const MAKER_FOCUS = ["top", "center", "bottom"];
// Where the photo lies on the screen, as shares of the room left beside it: a corner, a side or the middle.
export const MAKER_ANCHORS = {
  "top-left": [0, 0],
  top: [0.5, 0],
  "top-right": [1, 0],
  left: [0, 0.5],
  center: [0.5, 0.5],
  right: [1, 0.5],
  "bottom-left": [0, 1],
  bottom: [0.5, 1],
  "bottom-right": [1, 1],
};
export const MAKER_EDGES = ["top", "right", "bottom", "left"];
export const MAKER_EDGES_MAX = 3;
export const MAKER_ROTATIONS = [0, 90, 180, 270];
// The biggest side of a photo as it is turned and mirrored: enough for the wide picture, quick to redraw.
const SOURCE_MAX = 3000;
const ANCHOR_ICONS = {
  "top-left": "mdi:arrow-top-left",
  top: "mdi:arrow-up",
  "top-right": "mdi:arrow-top-right",
  left: "mdi:arrow-left",
  center: "mdi:circle-small",
  right: "mdi:arrow-right",
  "bottom-left": "mdi:arrow-bottom-left",
  bottom: "mdi:arrow-down",
  "bottom-right": "mdi:arrow-bottom-right",
};
const EDGE_ICONS = { top: "mdi:border-top-variant", right: "mdi:border-right-variant", bottom: "mdi:border-bottom-variant", left: "mdi:border-left-variant" };
export const DEFAULT_RECIPE = {
  top: MAKER_PRESETS[0][0],
  bottom: MAKER_PRESETS[0][1],
  angle: 180,
  opacity: 0.6,
  grey: 0.7,
  blur: 0,
  fade: 0.5,
  blend: "tint",
  focus: "center",
  size: 1,
  shift_x: 0,
  shift_y: 0,
  rotate: 0,
  flip_x: false,
  flip_y: false,
  edges: ["bottom"],
  motif: "",
  seed: 7,
};
const RECIPE_KEY = "home-dashboard-background-maker";
const PREVIEW_SCALE = 0.2;
const QUALITY = 0.88;

/** A recipe with every key, out-of-range numbers brought back in. */
export function recipeOf(recipe) {
  const merged = { ...DEFAULT_RECIPE, ...recipe };
  const clamp = (value, low, high, fallback) => (Number.isFinite(Number(value)) ? Math.min(high, Math.max(low, Number(value))) : fallback);
  return {
    ...merged,
    opacity: clamp(merged.opacity, 0, 1, DEFAULT_RECIPE.opacity),
    grey: clamp(merged.grey, 0, 1, DEFAULT_RECIPE.grey),
    blur: clamp(merged.blur, 0, 20, 0),
    fade: clamp(merged.fade, 0, 1, DEFAULT_RECIPE.fade),
    angle: clamp(merged.angle, 0, 360, 180),
    blend: MAKER_BLENDS.includes(merged.blend) ? merged.blend : DEFAULT_RECIPE.blend,
    focus: MAKER_FOCUS.includes(merged.focus) ? merged.focus : "center",
    // A recipe from before the photo had a place keeps it where its focus was (top, middle, bottom)
    anchor: MAKER_ANCHORS[recipe?.anchor] ? recipe.anchor : MAKER_FOCUS.includes(merged.focus) ? merged.focus : "center",
    size: clamp(merged.size, 0.2, 1, 1),
    shift_x: clamp(merged.shift_x, -0.5, 0.5, 0),
    shift_y: clamp(merged.shift_y, -0.5, 0.5, 0),
    rotate: MAKER_ROTATIONS.includes(Number(merged.rotate)) ? Number(merged.rotate) : 0,
    flip_x: merged.flip_x === true,
    flip_y: merged.flip_y === true,
    edges: Array.isArray(merged.edges)
      ? [...new Set(merged.edges.filter((edge) => MAKER_EDGES.includes(edge)))].slice(-MAKER_EDGES_MAX)
      : [...DEFAULT_RECIPE.edges],
    motif: MOTIF_NAMES.includes(merged.motif) ? merged.motif : "",
    seed: Number.isInteger(merged.seed) ? merged.seed : 7,
  };
}

// The line of a CSS gradient of that angle across a box: 180 runs from the top down.
export function gradientLine(width, height, angle) {
  const radians = (angle * Math.PI) / 180;
  const [dx, dy] = [Math.sin(radians), -Math.cos(radians)];
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const [cx, cy] = [width / 2, height / 2];
  return [cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half];
}

// Where a picture lies to cover the box, kept at the top, the middle or the bottom.
export function coverRect(width, height, imageWidth, imageHeight, focus = "center") {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const [w, h] = [imageWidth * scale, imageHeight * scale];
  const share = { top: 0, center: 0.5, bottom: 1 }[focus] ?? 0.5;
  return [(width - w) / 2, (height - h) * share, w, h];
}

function canvasOf(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/**
 * Where the photo lies on a screen: it covers the screen at `size` 1 and is smaller below, put at its `anchor` (a
 * corner, a side, the middle) and moved by `shift_x`, `shift_y` (shares of the screen). `[x, y, width, height]`.
 */
export function photoRect(width, height, imageWidth, imageHeight, recipe) {
  const made = recipeOf(recipe);
  const scale = Math.max(width / imageWidth, height / imageHeight) * made.size;
  const [w, h] = [imageWidth * scale, imageHeight * scale];
  const [ax, ay] = MAKER_ANCHORS[made.anchor];
  return [(width - w) * ax + made.shift_x * width, (height - h) * ay + made.shift_y * height, w, h];
}

/** The ends of the fade of one edge of the photo: from clear at that edge to whole `fade` of the photo inwards. */
export function edgeLine([x, y, w, h], edge, fade) {
  const reach = Math.max(0.001, fade);
  if (edge === "top") return [x, y, x, y + h * reach];
  if (edge === "bottom") return [x, y + h, x, y + h - h * reach];
  if (edge === "left") return [x, y, x + w * reach, y];
  return [x + w, y, x + w - w * reach, y];
}

const oriented = new WeakMap();

// The photo turned and mirrored as the recipe says, no bigger than SOURCE_MAX on its longer side; kept per photo.
function orientedPhoto(image, { rotate, flip_x: flipX, flip_y: flipY }) {
  const key = `${rotate}|${flipX}|${flipY}`;
  const kept = oriented.get(image);
  if (kept?.key === key) return kept.canvas;
  const imageWidth = image.naturalWidth ?? image.width;
  const imageHeight = image.naturalHeight ?? image.height;
  const shrink = Math.min(1, SOURCE_MAX / Math.max(imageWidth, imageHeight));
  const [w, h] = [imageWidth * shrink, imageHeight * shrink];
  const turned = rotate === 90 || rotate === 270;
  const canvas = canvasOf(turned ? h : w, turned ? w : h);
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotate * Math.PI) / 180);
  context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  context.drawImage(image, -w / 2, -h / 2, w, h);
  oriented.set(image, { key, canvas });
  return canvas;
}

// The photo alone: turned, mirrored, sized and put in its place, blurred by drawing it small and large again, greyed,
// and fading out from the edges chosen.
function photoLayer(width, height, recipe, image) {
  const layer = canvasOf(width, height);
  const context = layer.getContext("2d");
  const source = orientedPhoto(image, recipe);
  const box = photoRect(width, height, source.width, source.height, recipe);
  const [x, y, w, h] = box;
  const shrink = 1 + recipe.blur * 1.5;
  const small = canvasOf(w / shrink, h / shrink);
  const smallContext = small.getContext("2d");
  smallContext.imageSmoothingQuality = "high";
  smallContext.drawImage(source, 0, 0, small.width, small.height);
  if (recipe.grey > 0) {
    const pixels = smallContext.getImageData(0, 0, small.width, small.height);
    const data = pixels.data;
    for (let at = 0; at < data.length; at += 4) {
      const light = 0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2];
      data[at] += (light - data[at]) * recipe.grey;
      data[at + 1] += (light - data[at + 1]) * recipe.grey;
      data[at + 2] += (light - data[at + 2]) * recipe.grey;
    }
    smallContext.putImageData(pixels, 0, 0);
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(small, x, y, w, h);
  if (recipe.fade > 0) {
    context.globalCompositeOperation = "destination-in";
    for (const edge of recipe.edges) {
      const mask = context.createLinearGradient(...edgeLine(box, edge, recipe.fade));
      mask.addColorStop(0, "rgba(0, 0, 0, 0)");
      mask.addColorStop(1, "rgba(0, 0, 0, 1)");
      context.fillStyle = mask;
      context.fillRect(0, 0, width, height);
    }
  }
  return layer;
}

/**
 * The photo tinted by the background under it, in place on the background's pixels: each pixel of the photo takes the
 * colour beneath, from deep (its darks) to light (its lights) as bright as it is, seen as much as its alpha and the
 * `opacity` let. So a room keeps its details and wears the colours of the gradient.
 */
export function tintPixels(back, photo, opacity = 1) {
  for (let at = 0; at < back.length; at += 4) {
    const seen = (photo[at + 3] / 255) * opacity;
    if (!seen) continue;
    const light = (0.2126 * photo[at] + 0.7152 * photo[at + 1] + 0.0722 * photo[at + 2]) / 255;
    for (let channel = 0; channel < 3; channel += 1) {
      const under = back[at + channel];
      const deep = under * TINT_DARK;
      const bright = under + (255 - under) * TINT_LIGHT;
      back[at + channel] = under + (deep + (bright - deep) * light - under) * seen;
    }
  }
  return back;
}

/** Draws the background on the canvas, at its size: the gradient, then the photo (if any) over it. */
export function drawBackground(canvas, recipe, image = null) {
  const made = recipeOf(recipe);
  const { width, height } = canvas;
  const context = canvas.getContext("2d");
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
  const gradient = context.createLinearGradient(...gradientLine(width, height, made.angle));
  gradient.addColorStop(0, made.top);
  gradient.addColorStop(1, made.bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  drawMotif(context, width, height, made.motif, made, made.seed);
  if (!image) return canvas;
  const photo = photoLayer(width, height, made, image);
  if (made.blend === "tint") {
    const back = context.getImageData(0, 0, width, height);
    tintPixels(back.data, photo.getContext("2d").getImageData(0, 0, width, height).data, made.opacity);
    context.putImageData(back, 0, 0);
    return canvas;
  }
  context.globalAlpha = made.opacity;
  context.globalCompositeOperation = made.blend === "normal" ? "source-over" : made.blend;
  context.drawImage(photo, 0, 0);
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
  return canvas;
}

/** The background as a JPEG picture of one shape, at its full size. */
export function renderBackground(shape, recipe, image) {
  const [width, height] = MAKER_SIZES[shape];
  const canvas = drawBackground(canvasOf(width, height), recipe, image);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no picture"))), "image/jpeg", QUALITY),
  );
}

/** Sends a picture to Home Assistant's image store; its address to use as a background. */
export async function uploadPicture(hass, blob, name) {
  const body = new FormData();
  body.append("file", blob, name);
  const response = await hass.fetchWithAuth("/api/image/upload", { method: "POST", body });
  if (!response.ok) throw new Error(String(response.status));
  const { id } = await response.json();
  return `/api/image/serve/${id}/original`;
}

function rememberedRecipe() {
  try {
    return recipeOf(JSON.parse(localStorage.getItem(RECIPE_KEY) ?? "{}"));
  } catch {
    return recipeOf({});
  }
}

export const MAKER_LOOKS = ["light", "dark", "both"];
const SAMPLE_TILES = [
  ["mdi:ceiling-light", true],
  ["mdi:floor-lamp-outline", false],
  ["mdi:television", false],
  ["mdi:thermostat", true],
];

/** The slots of a page's background a made picture goes to: each look chosen, upright and wide. */
export function madeSlots(look, tall, wide) {
  const looks = look === "both" ? ["light", "dark"] : [look];
  return Object.fromEntries(looks.flatMap((mode) => [[mode, tall], [`${mode}_wide`, wide]]));
}

export class HomeDashboardBackgroundMaker extends LitElement {
  static properties = {
    hass: { attribute: false },
    heading: { type: String },
    look: { type: String },
    layout: { type: String, reflect: true },
    _recipe: { state: true },
    _image: { state: true },
    _shape: { state: true },
    _chosenLook: { state: true },
    _busy: { state: true },
    _problem: { state: true },
  };

  constructor() {
    super();
    this._recipe = rememberedRecipe();
    this._image = null;
    this._shape = "tall";
    this._busy = false;
    this._problem = "";
  }

  _t(key, values) {
    return translate(this.hass?.language, `maker_${key}`, values);
  }

  get _look() {
    return this._chosenLook ?? (MAKER_LOOKS.includes(this.look) ? this.look : "light");
  }

  updated() {
    this.renderRoot.querySelectorAll("canvas[data-maker-preview]").forEach((canvas) => {
      const [width, height] = MAKER_SIZES[canvas.dataset.makerPreview];
      canvas.width = Math.round(width * PREVIEW_SCALE);
      canvas.height = Math.round(height * PREVIEW_SCALE);
      drawBackground(canvas, this._recipe, this._image);
    });
    this.renderRoot.querySelectorAll("canvas[data-maker-ready]:not([data-drawn])").forEach((canvas) => {
      canvas.width = 129;
      canvas.height = 280;
      drawBackground(canvas, READY_BACKGROUNDS[Number(canvas.dataset.makerReady)]);
      canvas.dataset.drawn = "1";
    });
  }

  _set(change) {
    this._recipe = recipeOf({ ...this._recipe, ...change });
    try {
      localStorage.setItem(RECIPE_KEY, JSON.stringify(this._recipe));
    } catch {
      // a private window keeps nothing; the recipe still works now
    }
  }

  async _choose(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) return;
    const image = new Image();
    image.src = URL.createObjectURL(file);
    try {
      await image.decode();
      this._image = image;
      this._problem = "";
    } catch {
      this._problem = "photo_failed";
    }
  }

  async _use() {
    this._busy = true;
    this._problem = "";
    try {
      const [tall, wide] = await Promise.all(
        ["tall", "wide"].map(async (shape) =>
          uploadPicture(this.hass, await renderBackground(shape, this._recipe, this._image), `background-${shape}.jpg`),
        ),
      );
      const detail = { look: this._look, tall, wide, slots: madeSlots(this._look, tall, wide) };
      this.dispatchEvent(new CustomEvent("maker-done", { detail, bubbles: true, composed: true }));
    } catch {
      this._problem = "upload_failed";
    } finally {
      this._busy = false;
    }
  }

  async _download() {
    const blob = await renderBackground(this._shape, this._recipe, this._image);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `background-${this._shape}.jpg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  _cancel() {
    this.dispatchEvent(new CustomEvent("maker-cancel", { bubbles: true, composed: true }));
  }

  _chips(data, options, current, pick, label) {
    return html`<div class="chips" data-maker-choices=${data}>
      ${options.map(
        (option) => html`<button class=${String(current) === String(option) ? "on" : ""} data-maker-choice=${option}
          @click=${() => pick(option)}>${label(option)}</button>`,
      )}
    </div>`;
  }

  _slider(key, max, step = 0.05, min = 0) {
    const value = this._recipe[key];
    const shown = max <= 1 ? `${Math.round(value * 100)} %` : String(value);
    return html`<label class="slider" data-maker-slider=${key}>
      <span>${this._t(key)}<b>${shown}</b></span>
      <input type="range" min=${min} max=${max} step=${step} .value=${String(value)}
        @input=${(event) => this._set({ [key]: Number(event.target.value) })} />
    </label>`;
  }

  // A screen with the background and a few tiles over it, to see whether the dashboard stays readable.
  _screen(shape) {
    return html`<figure class="device ${shape}">
      <div class="screen">
        <canvas data-maker-preview=${shape}></canvas>
        <div class="sample">
          <strong>${this.heading || this._t("sample_title")}</strong>
          <div class="tiles">
            ${SAMPLE_TILES.map(
              ([icon, on], index) => html`<span class="tile ${on ? "on" : ""}"><ha-icon .icon=${icon}></ha-icon>${this._t(`sample_${index + 1}`)}</span>`,
            )}
          </div>
        </div>
      </div>
      <figcaption>${this._t(`size_${shape}`, { size: MAKER_SIZES[shape].join(" × ") })}</figcaption>
    </figure>`;
  }

  _renderPreview() {
    if (this.layout === "wide") return html`<div class="screens">${this._screen("tall")}${this._screen("wide")}</div>`;
    return html`
      <div class="screens">${this._screen(this._shape)}</div>
      ${this._chips("shape", ["tall", "wide"], this._shape, (shape) => (this._shape = shape), (shape) => this._t(`shape_${shape}`))}
    `;
  }

  // The place of the photo: its size, a corner, a side or the middle, a move from there, a turn, mirrors, and the
  // edges it fades out from (three at most: a fourth one lets the first chosen go).
  _renderPlacement(recipe) {
    const edges = recipe.edges;
    const toggleEdge = (edge) =>
      this._set({ edges: edges.includes(edge) ? edges.filter((e) => e !== edge) : [...edges, edge].slice(-MAKER_EDGES_MAX) });
    return html`
      <h5>${this._t("place")}</h5>
      ${this._slider("size", 1, 0.05, 0.2)}
      <div class="anchors" data-maker-anchors>
        ${Object.keys(MAKER_ANCHORS).map(
          (anchor) => html`<button class=${recipe.anchor === anchor ? "on" : ""} data-maker-anchor=${anchor}
            title=${this._t(`anchor_${anchor.replace("-", "_")}`)} aria-label=${this._t(`anchor_${anchor.replace("-", "_")}`)}
            @click=${() => this._set({ anchor, focus: MAKER_FOCUS.includes(anchor) ? anchor : recipe.focus })}>
            <ha-icon .icon=${ANCHOR_ICONS[anchor]}></ha-icon></button>`,
        )}
      </div>
      ${this._slider("shift_x", 0.5, 0.01, -0.5)} ${this._slider("shift_y", 0.5, 0.01, -0.5)}
      <h5>${this._t("turn")}</h5>
      ${this._chips("rotate", MAKER_ROTATIONS, recipe.rotate, (rotate) => this._set({ rotate }), (rotate) => `${rotate}°`)}
      <div class="chips" data-maker-flips>
        <button class=${recipe.flip_x ? "on" : ""} data-maker-flip="x" @click=${() => this._set({ flip_x: !recipe.flip_x })}>
          <ha-icon icon="mdi:flip-horizontal"></ha-icon>${this._t("flip_x")}</button>
        <button class=${recipe.flip_y ? "on" : ""} data-maker-flip="y" @click=${() => this._set({ flip_y: !recipe.flip_y })}>
          <ha-icon icon="mdi:flip-vertical"></ha-icon>${this._t("flip_y")}</button>
      </div>
      <h5>${this._t("edges")}</h5>
      <div class="chips" data-maker-edges>
        ${MAKER_EDGES.map(
          (edge) => html`<button class=${edges.includes(edge) ? "on" : ""} data-maker-edge=${edge} @click=${() => toggleEdge(edge)}>
            <ha-icon .icon=${EDGE_ICONS[edge]}></ha-icon>${this._t(`edge_${edge}`)}</button>`,
        )}
      </div>
      <p class="hint">${this._t("edges_hint")}</p>
      ${this._slider("fade", 1)}
    `;
  }

  _renderControls() {
    const recipe = this._recipe;
    const same = (item) => item.motif === recipe.motif && item.top === recipe.top && item.bottom === recipe.bottom;
    return html`
      <section>
        <h4>${this._t("for_look")}</h4>
        ${this._chips("look", MAKER_LOOKS, this._look, (look) => (this._chosenLook = look), (look) => this._t(`look_${look}`))}
      </section>
      <section>
        <h4>${this._t("ready")}</h4>
        <div class="ready">
          ${READY_BACKGROUNDS.map(
            (item, index) => html`<canvas class=${same(item) ? "on" : ""} data-maker-ready=${index} title=${this._t(`motif_${item.motif}`)}
              @click=${() => this._set({ ...item, seed: DEFAULT_RECIPE.seed })}></canvas>`,
          )}
        </div>
      </section>
      <section>
        <h4>${this._t("motif")}</h4>
        ${this._chips("motif", ["", ...MOTIF_NAMES], recipe.motif, (motif) => this._set({ motif }), (motif) => this._t(`motif_${motif || "none"}`))}
        <button class="plain" data-maker-reseed ?disabled=${!recipe.motif} @click=${() => this._set({ seed: recipe.seed + 1 })}>
          <ha-icon icon="mdi:dice-5-outline"></ha-icon>${this._t("reseed")}
        </button>
      </section>
      <section>
        <h4>${this._t("photo")}</h4>
        <label class="file">
          <span>${this._t(this._image ? "photo_other" : "photo_add")}</span>
          <input type="file" accept="image/*" data-maker-photo @change=${this._choose} />
        </label>
        ${this._image
          ? html`
              <button class="plain" data-maker-photo-clear @click=${() => (this._image = null)}>${this._t("photo_none")}</button>
              ${this._slider("opacity", 1)} ${this._slider("grey", 1)} ${this._slider("blur", 20, 1)}
              ${this._chips("blend", MAKER_BLENDS, recipe.blend, (blend) => this._set({ blend }), (blend) => this._t(`blend_${blend}`))}
              ${this._renderPlacement(recipe)}
            `
          : html`<p class="hint">${this._t("photo_hint")}</p>`}
      </section>
      <section>
        <h4>${this._t("gradient")}</h4>
        ${Object.entries(MAKER_PALETTES).map(
          ([group, pairs]) => html`<small class="group">${this._t(`group_${group}`)}</small>
            <div class="presets" data-maker-group=${group}>
              ${pairs.map(
                ([top, bottom]) => html`<button
                  class="preset ${recipe.top === top && recipe.bottom === bottom ? "on" : ""}"
                  style="background: linear-gradient(180deg, ${top}, ${bottom})"
                  data-maker-preset=${`${top},${bottom}`}
                  aria-label=${`${top} → ${bottom}`}
                  @click=${() => this._set({ top, bottom })}
                ></button>`,
              )}
            </div>`,
        )}
        <div class="colours">
          <label><span>${this._t("top")}</span><input type="color" data-maker-colour="top" .value=${recipe.top}
            @input=${(event) => this._set({ top: event.target.value })} /></label>
          <button class="plain swap" data-maker-swap aria-label=${this._t("swap")}
            @click=${() => this._set({ top: recipe.bottom, bottom: recipe.top })}>⇅</button>
          <label><span>${this._t("bottom")}</span><input type="color" data-maker-colour="bottom" .value=${recipe.bottom}
            @input=${(event) => this._set({ bottom: event.target.value })} /></label>
        </div>
        ${this._chips("angle", MAKER_DIRECTIONS, recipe.angle, (angle) => this._set({ angle }), (angle) => this._t(`angle_${angle}`))}
      </section>
      ${this._problem ? html`<p class="problem" data-maker-problem>${this._t(this._problem)}</p>` : nothing}
      <div class="actions">
        <button class="plain" data-maker-cancel @click=${this._cancel}>${this._t("cancel")}</button>
        <button class="plain" data-maker-download @click=${this._download}>
          <ha-icon icon="mdi:download"></ha-icon>${this._t("download")}
        </button>
        <button class="main" data-maker-use ?disabled=${this._busy} @click=${this._use}>${this._t(this._busy ? "making" : "use")}</button>
      </div>
    `;
  }

  render() {
    return html`<div class="maker">
      <div class="preview">
        ${this._renderPreview()}
        <p class="hint" data-maker-slots>${this._t(`slots_${this._look}`)}</p>
      </div>
      <div class="controls">${this._renderControls()}</div>
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
      --mdc-icon-size: 18px;
      color: var(--hd-text, var(--text, #e8eaed));
    }
    .maker {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    :host([layout="wide"]) .maker {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 380px;
      gap: 20px;
      height: 100%;
    }
    :host([layout="wide"]) .preview {
      overflow: auto;
    }
    :host([layout="wide"]) .controls {
      overflow: auto;
      padding-right: 6px;
    }
    .preview {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .screens {
      display: flex;
      flex-wrap: wrap;
      gap: 22px;
      justify-content: center;
      align-items: flex-start;
    }
    .device {
      margin: 0;
      padding: 8px;
      border-radius: 28px;
      background: #000;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .screen {
      position: relative;
      overflow: hidden;
      border-radius: 20px;
    }
    .device.tall .screen {
      width: 220px;
      height: 477px;
    }
    .device.wide .screen {
      width: 520px;
      height: 390px;
    }
    :host(:not([layout="wide"])) .device.wide .screen {
      width: min(100%, 420px);
      height: auto;
      aspect-ratio: 4 / 3;
    }
    canvas[data-maker-preview] {
      display: block;
      width: 100%;
      height: 100%;
    }
    figcaption {
      margin-top: 6px;
      text-align: center;
      font-size: 12px;
      color: #9aa0a6;
    }
    .sample {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 26px 14px;
      color: #fff;
    }
    .sample strong {
      font-size: 22px;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 7px;
      max-width: 280px;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 56px;
      padding: 9px 10px;
      border-radius: 14px;
      font-size: 12px;
      color: #fff;
      background: rgba(40, 40, 46, 0.55);
      backdrop-filter: blur(12px);
    }
    .tile.on {
      color: #1c1c1e;
      background: rgba(255, 255, 255, 0.82);
    }
    .tile.on ha-icon {
      color: #ffb340;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--hd-outline, var(--line, #2f343c));
    }
    h4 {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--hd-text-muted, var(--muted, #9aa0a6));
    }
    h5 {
      margin: 6px 0 0;
      font-size: 13px;
      font-weight: 600;
    }
    .anchors {
      display: grid;
      grid-template-columns: repeat(3, 40px);
      gap: 4px;
    }
    .anchors button {
      display: grid;
      place-items: center;
      height: 34px;
      border: 1px solid var(--hd-outline, var(--line, #2f343c));
      border-radius: 9px;
      background: transparent;
    }
    .anchors button ha-icon {
      --mdc-icon-size: 18px;
    }
    .chips ha-icon {
      --mdc-icon-size: 16px;
    }
    .group {
      font-size: 11px;
      color: var(--hd-text-muted, var(--muted, #9aa0a6));
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chips button,
    .plain {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 34px;
      padding: 5px 11px;
      border: 1px solid var(--hd-outline, var(--line, #2f343c));
      border-radius: 17px;
      background: transparent;
      font-size: 13px;
    }
    section > .plain {
      align-self: flex-start;
    }
    .plain[disabled] {
      opacity: 0.45;
      cursor: default;
    }
    .chips button.on,
    .anchors button.on {
      border-color: var(--hd-link, var(--accent, #4f8cff));
      background: var(--hd-link, var(--accent, #4f8cff));
      color: #fff;
    }
    .ready {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 6px;
    }
    .ready canvas {
      display: block;
      width: 100%;
      aspect-ratio: 129 / 280;
      border-radius: 8px;
      cursor: pointer;
    }
    .ready canvas.on,
    .preset.on {
      outline: 2px solid var(--hd-link, var(--accent, #4f8cff));
      outline-offset: 2px;
    }
    .presets {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 6px;
    }
    .preset {
      aspect-ratio: 1;
      border: 0;
      border-radius: 9px;
    }
    .colours {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      gap: 8px;
    }
    .colours label,
    .file,
    .slider {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      color: var(--hd-text-muted, var(--muted, #9aa0a6));
    }
    .colours input {
      width: 100%;
      height: 36px;
      padding: 0;
      border: 0;
      border-radius: 9px;
      background: none;
    }
    .slider span {
      display: flex;
      justify-content: space-between;
    }
    .slider b {
      font-weight: 500;
      color: var(--hd-text, var(--text, #e8eaed));
    }
    .slider input {
      accent-color: var(--hd-link, var(--accent, #4f8cff));
    }
    .hint,
    .problem {
      margin: 0;
      font-size: 13px;
      color: var(--hd-text-muted, var(--muted, #9aa0a6));
    }
    .problem {
      color: var(--hd-security-ink, #f28b82);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .main {
      min-height: 38px;
      padding: 8px 18px;
      border: 0;
      border-radius: 19px;
      background: var(--hd-link, var(--accent, #4f8cff));
      color: #fff;
      font-weight: 600;
    }
    .main[disabled] {
      opacity: 0.6;
    }
  `;
}

if (!customElements.get("home-dashboard-background-maker")) customElements.define("home-dashboard-background-maker", HomeDashboardBackgroundMaker);
