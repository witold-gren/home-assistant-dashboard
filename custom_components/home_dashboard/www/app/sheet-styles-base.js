// The frame of every window: the panel, its header, its rows and the parts most windows share. Styles of the sheet, in the order of the cascade: base, look, controls, camera.

import { css } from "../vendor/lit-all.min.js";

export const baseStyles = css`
  button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
  }
  button[disabled] {
    opacity: 0.3;
    pointer-events: none;
  }
  :host(.settling) .scrim,
  :host(.settling) .backdrop,
  :host(.settling) .panel {
    transition:
      transform 240ms cubic-bezier(0.3, 0, 0.2, 1),
      opacity 240ms ease;
  }
  .scrim {
    position: fixed;
    inset: -120px 0;
    z-index: 7;
    opacity: calc(1 - var(--hd-drag-fade, 0) * 2);
    touch-action: none;
    background: rgba(0, 0, 0, var(--hd-sheet-scrim, 0.45));
    animation: fade 240ms ease-out;
  }
  /* iOS draws the page under its bars, where a panel with inset: 0 does not reach. */
  .backdrop {
    position: fixed;
    inset: -120px 0;
    z-index: 7;
    transform: translateY(var(--hd-drag, 0px));
    background: color-mix(in srgb, var(--hd-sheet-bg, var(--hd-background)) var(--hd-sheet-opacity, 100%), transparent);
    -webkit-backdrop-filter: blur(var(--hd-sheet-blur, 0px));
    backdrop-filter: blur(var(--hd-sheet-blur, 0px));
    animation: rise 320ms cubic-bezier(0.2, 0.9, 0.25, 1);
  }
  .backdrop.dark {
    background: #17181a;
  }
  .backdrop.floating {
    background: rgba(0, 0, 0, 0.12);
    -webkit-backdrop-filter: blur(28px);
    backdrop-filter: blur(28px);
  }
  @media (max-width: 899px) {
    .panel.floating {
      inset: max(14dvh, calc(var(--hd-safe-top) + 24px)) 12px auto;
      padding: 0;
      overflow: visible;
      border-radius: 34px;
      background: var(--hd-sheet-bg, var(--hd-background));
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
    }
  }
  .panel.floating > .grip {
    display: none;
  }
  .panel {
    position: fixed;
    inset: 0;
    z-index: 8;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: var(--hd-safe-top) 0 calc(var(--hd-safe-bottom) + 16px);
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-x pan-y;
    transform: translateY(var(--hd-drag, 0px));
    /* The cover under it carries the background, so a see-through look is not laid on twice. */
    background: transparent;
    animation: rise 320ms cubic-bezier(0.2, 0.9, 0.25, 1);
  }
  /* The weather of a tablet on its side fills the window under its header, so its chart keeps one size. */
  .panel.whole[data-kind="weather"] home-dashboard-weather {
    flex: 1 1 auto;
    min-height: 0;
  }
  .grip {
    position: sticky;
    top: 0;
    z-index: 1;
    display: grid;
    flex: none;
    place-items: center;
    height: 20px;
    touch-action: none;
    cursor: grab;
  }
  .grip::before {
    content: "";
    width: 36px;
    height: 5px;
    border-radius: 3px;
    opacity: 0.35;
    background: currentcolor;
  }
  .panel.dark {
    color: #ffffff;
    background: #17181a;
  }
  @keyframes rise {
    from {
      transform: translateY(100%);
    }
  }
  @keyframes rise-centre {
    from {
      transform: translate(-50%, 50vh);
      opacity: 0;
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .scrim,
    .backdrop,
    .panel {
      animation: none !important;
    }
  }
  h3 {
    margin: 12px 0 0;
    font-size: 15px;
    font-weight: 500;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
    gap: 8px;
    padding: 12px;
    border-radius: var(--hd-radius);
    background: var(--hd-off);
  }
  .stats span {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .stats b {
    font-size: 17px;
    line-height: 24px;
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .stats small {
    font-size: 12px;
    line-height: 16px;
    color: var(--hd-text-muted);
  }
  /* Upright the parts keep the order of a panel: numbers, buttons, the card, then the rows. */
  .panel-split .side {
    display: contents;
  }
  .panel-split > .live {
    order: 1;
  }
  .panel-split .panel-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    order: 2;
  }
  /* On its side: a column of 360 px for the panel's parts, the card beside it on the rest of the screen. */
  .panel-split.split {
    display: grid;
    flex: 1;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 16px;
    min-height: 0;
    padding: 8px 16px 16px;
  }
  .panel-split.split .side {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    overflow-y: auto;
  }
  .panel-split.split .panel-group {
    order: 0;
  }
  .panel-split.split .stats {
    order: 1;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 0;
    background: none;
  }
  .panel-split.split .stats span {
    padding: 14px 16px;
    border-radius: var(--hd-radius);
    background: var(--hd-off);
  }
  .panel-split.split .stats b {
    font-size: 20px;
  }
  .room-picker {
    order: 2;
  }
  .room-picker h3 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 500;
  }
  .room-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .room-chip {
    padding: 8px 12px;
    border-radius: 16px;
    font-size: 14px;
    background: var(--hd-off);
    cursor: pointer;
  }
  .room-chip.on {
    color: var(--hd-accent-ink);
    background: var(--hd-accent);
  }
  .room-run {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .room-repeats,
  .room-go {
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
    height: 44px;
    padding: 0 14px;
    border-radius: 22px;
    background: var(--hd-off);
    cursor: pointer;
  }
  .room-go {
    flex: 1;
    color: var(--hd-accent-ink);
    background: var(--hd-accent);
  }
  .room-go[disabled],
  .room-repeats[disabled] {
    opacity: 0.4;
    cursor: default;
  }
  .share {
    display: block;
    height: 4px;
    margin-top: 10px;
    border-radius: 2px;
    background: color-mix(in srgb, currentColor 20%, transparent);
  }
  .share u {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: currentColor;
  }
  .panel-split.split .side-actions {
    order: 3;
    margin-top: auto;
  }
  .panel-split.split .block-actions {
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
    gap: 12px;
  }
  .panel-split.split .block-action {
    justify-content: center;
    min-height: 96px;
    font-size: 15px;
    --mdc-icon-size: 30px;
  }
  /* The card takes the whole column (a window on the whole screen keeps other cards narrow and centred), and the row
     is as tall as the card, so the buttons at the bottom of the column end with it. */
  .panel.whole .rows.panel-split.split {
    flex: none;
    align-items: stretch;
  }
  .panel.whole .rows.panel-split.split > .live {
    order: 0;
    justify-self: center;
    align-self: center;
    width: 100%;
    max-width: none;
    /* The map on the window's own background. */
    --map-card-zoomer-background: transparent;
    --ha-card-background: transparent;
    --ha-card-box-shadow: none;
    margin: 0;
    min-height: 0;
  }
  .panel.whole .rows.panel-split.split > .live > * {
    display: block;
    width: 100%;
  }
  .panel-split.split .side {
    overflow: visible;
  }
  .block-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
    gap: 8px;
  }
  /* Five buttons still fit one row of a phone. */
  .block-actions:has(> .block-action:nth-child(5)) {
    grid-template-columns: repeat(auto-fit, minmax(62px, 1fr));
    gap: 6px;
  }
  .variant-confirm {
    display: grid;
    gap: 6px;
    margin-top: 6px;
    padding: 14px;
    border-radius: 16px;
    background: var(--hd-card-off, rgba(127, 127, 127, 0.14));
  }
  .variant-confirm small,
  .variant-note {
    color: var(--hd-muted);
    line-height: 1.4;
  }
  .variant-confirm-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 6px;
  }
  .block-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 4px;
    border-radius: var(--hd-radius);
    font-size: 13px;
    text-align: center;
    background: var(--hd-off);
  }
  .block-action.on {
    color: var(--hd-accent-ink);
    background: var(--hd-accent);
  }
  /* A question before an action that cannot wait to be undone (turning a console off): the same dark glass in every
     look and theme, so it reads on light ones too; the action in red, the way back plain. */
  .confirm {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    border-radius: var(--hd-radius);
    color: #ffffff;
    background: rgba(28, 28, 32, 0.82);
    -webkit-backdrop-filter: blur(18px);
    backdrop-filter: blur(18px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 69, 58, 0.45);
    --mdc-icon-size: 26px;
  }
  .confirm ha-icon {
    flex: none;
    color: #ff453a;
  }
  .confirm span {
    flex: 1 1 calc(100% - 44px);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.35;
  }
  .confirm button {
    flex: 1 1 0;
    padding: 12px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    text-align: center;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.14);
  }
  .confirm .yes {
    background: #ff453a;
  }
  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 48px;
    padding: 4px 12px;
    border-radius: 12px;
    background: var(--hd-off);
  }
  .field > span {
    min-width: 0;
    font-size: 14px;
  }
  .field small {
    flex: none;
    max-width: 55%;
    font-size: 14px;
    text-align: right;
    color: var(--hd-text-muted);
  }
  .field select {
    max-width: 55%;
    padding: 8px;
    border: 1px solid var(--hd-outline);
    border-radius: 10px;
    font: inherit;
    color: inherit;
    background: var(--hd-surface);
  }
  .field input[type="text"] {
    box-sizing: border-box;
    width: 60%;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid var(--hd-outline);
    border-radius: 10px;
    font: inherit;
    color: inherit;
    background: var(--hd-surface);
  }
  .field input[type="range"] {
    flex: 1;
    min-width: 0;
    max-width: 55%;
  }
  .range-row {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    min-width: 0;
  }
  .range-row input[type="range"] {
    max-width: 100%;
  }
  .range-row output {
    flex: none;
    min-width: 56px;
    font-size: 14px;
    font-weight: 600;
    text-align: right;
  }
  /* − value +: big targets for a finger, the value between them as it will be set. */
  .stepper {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
  }
  .field .stepper button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    min-width: 44px;
    padding: 0;
    border-radius: 50%;
    color: var(--hd-text);
    background: color-mix(in srgb, currentColor 14%, transparent);
    touch-action: manipulation;
    -webkit-user-select: none;
    user-select: none;
    --mdc-icon-size: 22px;
  }
  .field .stepper button:disabled {
    opacity: 0.35;
  }
  .stepper output {
    min-width: 96px;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .slider-field output {
    flex: none;
    min-width: 48px;
    font-size: 14px;
    text-align: right;
    color: var(--hd-text-muted);
  }
  .look-colour > span {
    flex: 1;
  }
  .look-colour button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: inherit;
    background: transparent;
  }
  /* The list of what the status bar counts as on. */
  /* The same margin around its rows as the list of areas (.rows), so they do not touch the edges of the window. */
  .status-on {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 16px 16px;
  }
  .status-row {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 0;
  }
  .status-row.ignored {
    opacity: 0.6;
  }
  .status-main {
    display: flex;
    flex: 1;
    gap: 12px;
    align-items: center;
    min-width: 0;
    padding: 12px 14px;
    border: 0;
    border-radius: var(--hd-radius);
    color: inherit;
    text-align: left;
    background: var(--hd-off);
    font: inherit;
  }
  .status-main .row-text span {
    color: var(--hd-text-muted);
    font-size: 13px;
  }
  .status-ignored {
    margin: 12px 4px 0;
    font-size: 13px;
    color: var(--hd-text-muted);
  }
`;
