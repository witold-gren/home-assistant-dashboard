// The tour of the editor: one part of the editor at a time framed, the rest dimmed, and a bubble that says what it is
// and where its settings are. It starts by itself the first time the editor opens in a browser, after the quick start,
// and from ⚙ whenever asked. A step whose part is not on the screen (no dashboard yet, no preview) is left out.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { writeStored } from "../app/stored.js";

export const TOUR_KEY = "home-dashboard-editor-tour";
const BUBBLE_WIDTH = 360;
const GAP = 16;
const PAD = 8;

// Each step: its key (the texts are editor_tour_<key>_title, _text and, with `where`, _where), the parts it frames
// (one frame round all of them) and the side of the bubble.
export const TOUR_STEPS = [
  { key: "welcome", targets: [] },
  { key: "tree", targets: ["[data-tree]"], side: "right", where: true },
  { key: "preview", targets: ["[data-stage]"], side: "inside" },
  { key: "devices", targets: ["[data-device]", "[data-tablet-size]", "[data-phone-size]"], side: "below", where: true },
  { key: "props", targets: ["[data-props]"], side: "left" },
  { key: "undo", targets: ["[data-undo]", "[data-history]"], side: "below", where: true },
  { key: "publish", targets: ["[data-publish]"], side: "below-end" },
  { key: "help", targets: ["[data-docs]", "[data-editor-settings]"], side: "below-end" },
];

/**
 * Whether the tour has been seen (or skipped) in this browser. Without the storage of the browser (private browsing) it
 * could not remember being skipped and would come back every time, so it counts as seen; ⚙ still opens it.
 */
export function tourSeen() {
  try {
    return window.localStorage.getItem(TOUR_KEY) === "done";
  } catch {
    return true;
  }
}

/** The steps there is something on the screen for, with the frame of each. */
export function shownSteps(root) {
  return TOUR_STEPS.filter((step) => !step.targets.length || step.targets.some((selector) => root?.querySelector(selector)));
}

/** One rectangle round the parts of a step that are on the screen, a little larger; null for none. */
export function frameOf(root, step, width = window.innerWidth, height = window.innerHeight) {
  const boxes = step.targets
    .map((selector) => root?.querySelector(selector)?.getBoundingClientRect())
    .filter((box) => box && box.width && box.height);
  if (!boxes.length) return null;
  const left = Math.max(4, Math.min(...boxes.map((box) => box.left)) - PAD);
  const top = Math.max(4, Math.min(...boxes.map((box) => box.top)) - PAD);
  const right = Math.min(width - 4, Math.max(...boxes.map((box) => box.right)) + PAD);
  const bottom = Math.min(height - 4, Math.max(...boxes.map((box) => box.bottom)) + PAD);
  return { left, top, width: right - left, height: bottom - top };
}

/** Where the bubble stands: on the chosen side of the frame, kept inside the window. */
export function bubbleAt(frame, side, size, width = window.innerWidth, height = window.innerHeight) {
  const bubble = { width: Math.min(BUBBLE_WIDTH, width - 2 * GAP), height: size?.height ?? 220 };
  const clampX = (x) => Math.max(GAP, Math.min(width - bubble.width - GAP, x));
  const clampY = (y) => Math.max(GAP, Math.min(height - bubble.height - GAP, y));
  if (!frame) return { left: clampX((width - bubble.width) / 2), top: clampY(height * 0.28), width: bubble.width };
  const below = frame.top + frame.height + GAP;
  const places = {
    right: { left: frame.left + frame.width + GAP, top: frame.top + 40 },
    left: { left: frame.left - bubble.width - GAP, top: frame.top + 40 },
    below: { left: frame.left, top: below },
    "below-end": { left: frame.left + frame.width - bubble.width, top: below },
    inside: { left: frame.left + 24, top: frame.top + frame.height - bubble.height - 24 },
  };
  const place = places[side] ?? places.below;
  return { left: clampX(place.left), top: clampY(place.top), width: bubble.width };
}

export class HomeDashboardEditorTour extends LitElement {
  static properties = {
    root: { attribute: false },
    t: { attribute: false },
    _index: { state: true },
    _steps: { state: true },
  };

  constructor() {
    super();
    this._index = 0;
    this._onResize = () => this.requestUpdate();
    this._onKey = (event) => {
      if (event.key === "Escape") this._finish();
      else if (event.key === "ArrowRight" || event.key === "Enter") this._go(1);
      else if (event.key === "ArrowLeft") this._go(-1);
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("resize", this._onResize);
    window.addEventListener("keydown", this._onKey, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("keydown", this._onKey, true);
  }

  willUpdate(changed) {
    if (changed.has("root") || !this._steps) this._steps = shownSteps(this.root);
  }

  // The bubble's own height is known once it is drawn: it is placed again with it.
  updated() {
    const bubble = this.renderRoot.querySelector("[data-tour-bubble]");
    const height = bubble?.offsetHeight;
    if (height && height !== this._height) {
      this._height = height;
      this.requestUpdate();
    }
  }

  _go(by) {
    const next = this._index + by;
    if (next < 0) return;
    if (next >= this._steps.length) return this._finish();
    this._index = next;
  }

  _finish() {
    writeStored(TOUR_KEY, "done");
    this.dispatchEvent(new CustomEvent("tour-close", { bubbles: true, composed: true }));
  }

  render() {
    const t = this.t ?? ((key) => key);
    const steps = this._steps ?? [];
    const step = steps[this._index];
    if (!step) return nothing;
    const frame = frameOf(this.root, step);
    const at = bubbleAt(frame, step.side, { height: this._height });
    const last = this._index === steps.length - 1;
    return html`
      <div class="block" data-tour-block></div>
      ${frame
        ? html`<div class="frame" data-tour-frame=${step.key}
            style="left:${frame.left}px;top:${frame.top}px;width:${frame.width}px;height:${frame.height}px"></div>`
        : html`<div class="dim"></div>`}
      <section class="bubble" role="dialog" aria-label=${t(`editor_tour_${step.key}_title`)} data-tour-bubble=${step.key}
        style="left:${at.left}px;top:${at.top}px;width:${at.width}px">
        <div class="top">
          <span data-tour-count>${t("editor_tour_step", { step: this._index + 1, count: steps.length })}</span>
          <button class="close" data-tour-close aria-label=${t("close")} @click=${this._finish}>×</button>
        </div>
        <h3>${t(`editor_tour_${step.key}_title`)}</h3>
        <p>${t(`editor_tour_${step.key}_text`)}</p>
        ${step.where
          ? html`<div class="where"><strong>${t("editor_tour_where")}</strong> ${t(`editor_tour_${step.key}_where`)}</div>`
          : nothing}
        <div class="bottom">
          <div class="dots" aria-hidden="true">
            ${steps.map((_, index) => html`<i class=${index === this._index ? "on" : ""}></i>`)}
          </div>
          ${this._index
            ? html`<button class="ghost" data-tour-back @click=${() => this._go(-1)}>${t("editor_tour_back")}</button>`
            : html`<button class="link" data-tour-skip @click=${this._finish}>${t("editor_tour_skip")}</button>`}
          <button class="primary" data-tour-next @click=${() => this._go(1)}>
            ${last ? t("editor_tour_done") : t("editor_tour_next")}
          </button>
        </div>
      </section>
    `;
  }

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 40;
      font: 14px/1.45 -apple-system, "SF Pro Text", Roboto, system-ui, sans-serif;
    }
    .block {
      position: absolute;
      inset: 0;
    }
    .dim {
      position: absolute;
      inset: 0;
      background: rgba(8, 14, 24, 0.58);
    }
    .frame {
      position: absolute;
      border-radius: 14px;
      pointer-events: none;
      box-shadow:
        0 0 0 3px #fff,
        0 0 0 7px rgba(10, 132, 255, 0.55),
        0 0 0 9999px rgba(8, 14, 24, 0.58);
      transition:
        left 0.25s,
        top 0.25s,
        width 0.25s,
        height 0.25s;
    }
    .bubble {
      position: absolute;
      box-sizing: border-box;
      padding: 16px;
      border-radius: 16px;
      color: #1c2733;
      background: #fff;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
      transition:
        left 0.25s,
        top 0.25s;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #66727f;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    h3 {
      margin: 6px 0;
      font-size: 18px;
    }
    p {
      margin: 0 0 10px;
      color: #33404d;
    }
    .where {
      padding: 8px 10px;
      border-radius: 10px;
      color: #0a5ccc;
      background: #eef5ff;
      font-size: 13px;
    }
    .bottom {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 14px;
    }
    .dots {
      display: flex;
      flex: 1;
      gap: 4px;
    }
    .dots i {
      width: 6px;
      height: 6px;
      border-radius: 3px;
      background: #c9d2dc;
    }
    .dots i.on {
      width: 18px;
      background: #0a84ff;
    }
    button {
      font: inherit;
      cursor: pointer;
    }
    .close {
      border: 0;
      background: none;
      color: inherit;
      font-size: 20px;
      line-height: 1;
    }
    .ghost {
      padding: 7px 14px;
      border: 1px solid #dde3ea;
      border-radius: 10px;
      color: #1c2733;
      background: #fff;
    }
    .link {
      border: 0;
      background: none;
      color: #66727f;
    }
    .primary {
      padding: 7px 16px;
      border: 0;
      border-radius: 10px;
      color: #fff;
      background: #0a84ff;
      font-weight: 600;
    }
  `;
}

if (!customElements.get("home-dashboard-editor-tour")) customElements.define("home-dashboard-editor-tour", HomeDashboardEditorTour);
