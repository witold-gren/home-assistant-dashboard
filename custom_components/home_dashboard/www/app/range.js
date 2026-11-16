// The sliders of the dashboard (`<input type="range">`): a thick rounded bar filled up to a round knob, in the
// colour of the buttons that are on (accent.js), instead of the thin line of the browser. The browser cannot colour the part
// before the knob, so each slider carries its share as `--hd-range` (0 to 1) and the bar is a gradient up to it.
import { css } from "../vendor/lit-all.min.js";

/** The share of a slider between its min and max, 0 to 1. */
export function rangeShare(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const share = max > min ? (Number(input.value) - min) / (max - min) : 0;
  return Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0));
}

/** Gives a slider its share, for the bar to fill up to its knob. */
export function syncRange(input) {
  input.style.setProperty("--hd-range", String(rangeShare(input)));
}

/** Every slider under a root, after it is drawn (a value set by the page, not by a finger). */
export function syncRanges(root) {
  root?.querySelectorAll('input[type="range"]').forEach(syncRange);
}

/** Follows a finger moving any slider under a root. */
export function followRanges(root) {
  root?.addEventListener("input", (event) => {
    if (event.target?.type === "range") syncRange(event.target);
  });
}

export const rangeStyles = css`
  input[type="range"] {
    --hd-range-size: 30px;
    -webkit-appearance: none;
    appearance: none;
    box-sizing: border-box;
    height: var(--hd-range-size);
    margin: 0;
    padding: 0;
    border-radius: calc(var(--hd-range-size) / 2);
    cursor: pointer;
    background: linear-gradient(
      to right,
      var(--hd-range-fill, var(--hd-accent)) 0
        calc(var(--hd-range-size) / 2 + (100% - var(--hd-range-size)) * var(--hd-range, 0)),
      var(--hd-range-track, color-mix(in srgb, currentColor 16%, transparent)) 0
    );
    accent-color: auto;
  }
  input[type="range"]:disabled {
    cursor: default;
    opacity: 0.45;
  }
  input[type="range"]:focus-visible {
    outline: 2px solid var(--hd-range-fill, var(--hd-accent));
    outline-offset: 2px;
  }
  input[type="range"]::-webkit-slider-runnable-track {
    height: var(--hd-range-size);
    border-radius: inherit;
    background: transparent;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    box-sizing: border-box;
    width: var(--hd-range-size);
    height: var(--hd-range-size);
    border: 3px solid var(--hd-range-fill, var(--hd-accent));
    border-radius: 50%;
    background: var(--hd-range-knob, var(--hd-accent-ink));
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  input[type="range"]::-moz-range-track {
    height: var(--hd-range-size);
    border-radius: inherit;
    background: transparent;
  }
  input[type="range"]::-moz-range-thumb {
    box-sizing: border-box;
    width: var(--hd-range-size);
    height: var(--hd-range-size);
    border: 3px solid var(--hd-range-fill, var(--hd-accent));
    border-radius: 50%;
    background: var(--hd-range-knob, var(--hd-accent-ink));
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
`;
