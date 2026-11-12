// The editors of the look, the colours and the copy of the tiles. Styles of the sheet, in the order of the cascade: base, look, controls, camera.

import { css } from "../vendor/lit-all.min.js";

export const lookStyles = css`
  /* A colour: its code, a small cross back to the default, and a round sample that opens the picker. */
  .look-colour .swatch-text {
    margin-left: auto;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--hd-text-muted);
  }
  .look-colour .swatch-clear {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    --mdc-icon-size: 18px;
    color: var(--hd-text-muted);
  }
  .swatch-pick {
    position: relative;
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    cursor: pointer;
    /* The colour over a checkerboard, so a see-through one shows how see-through it is. */
    background:
      linear-gradient(var(--swatch, transparent), var(--swatch, transparent)),
      repeating-conic-gradient(#c8c8c8 0% 25%, #ffffff 0% 50%) 50% / 10px 10px;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.25),
      0 0 0 3px rgba(255, 255, 255, 0.35);
  }
  /* A colour still to be chosen: every colour around the circle. */
  .swatch-pick.rainbow {
    background: conic-gradient(#ff3b30, #ffcc00, #34c759, #00c7be, #007aff, #af52de, #ff3b30);
  }
  .swatch-pick.unset {
    background: none;
    box-shadow: none;
    border: 2px dashed var(--hd-text-muted);
    box-sizing: border-box;
  }
  .swatch-pick input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
  /* A copy of the tiles of the page, only what the look changes. */
  .theme-background > span:nth-child(2) {
    flex: 1;
    min-width: 0;
  }
  .theme-thumb {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-size: cover;
  }
  .tile-preview {
    display: grid;
    flex: none;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px;
    border-radius: 16px;
    background: linear-gradient(160deg, #6a8fd0, #3b2f7a);
  }
  .paint-swatch {
    flex: none;
    width: 28px;
    height: 28px;
    border: 1px solid var(--hd-outline);
    border-radius: 8px;
  }
  .look-colour input[type="text"] {
    width: 45%;
    padding: 6px 8px;
    border: 1px solid var(--hd-outline);
    border-radius: 8px;
    font: inherit;
    font-size: 13px;
    color: inherit;
    background: var(--hd-surface);
  }
  .look-group {
    margin: 12px 4px 0;
    font-size: 15px;
    font-weight: 500;
  }
  .look-tile {
    --tile-background: var(--hd-look-tile-bg, var(--hd-off));
    --tile-icon: var(--hd-look-tile-icon-bg, var(--hd-off-icon));
    --tile-ink: var(--hd-look-tile-icon, var(--hd-off-ink));
    --tile-fill: var(--tile-background);
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: 60px;
    padding: 6px 10px;
    border-radius: var(--hd-tile-radius, var(--hd-radius));
    color: var(--hd-look-tile-text, var(--hd-text));
    background: color-mix(in srgb, var(--tile-fill) var(--hd-tile-opacity, 100%), transparent);
  }
  .look-tile.tone-light,
  .look-tile.tone-cover {
    color: var(--hd-text);
  }
  .tile-preview.fill-icon .look-tile {
    color: var(--hd-look-tile-text, var(--hd-text));
  }
  .look-tile.tone-light {
    --tile-background: var(--hd-light);
    --tile-icon: var(--hd-light-icon);
    --tile-ink: var(--hd-light-ink);
  }
  .look-tile.tone-cover {
    --tile-background: var(--hd-cover);
    --tile-icon: var(--hd-cover-icon);
    --tile-ink: var(--hd-cover-ink);
  }
  .tile-preview.fill-icon .look-tile {
    --tile-fill: var(--hd-look-tile-bg, var(--hd-off));
  }
  .look-icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    color: var(--tile-ink);
    background: var(--tile-icon);
    --mdc-icon-size: 20px;
  }
  .look-tile small {
    display: block;
    font-size: 12px;
    color: var(--hd-look-tile-muted, var(--hd-text-muted));
  }
  .look-tile.tone-light small,
  .look-tile.tone-cover small {
    color: var(--hd-text-muted);
  }
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 6px;
  }
  .icon-grid .choice {
    min-height: 52px;
  }
  .switch {
    position: relative;
    flex: none;
    width: 48px;
    height: 28px;
    border-radius: 14px;
    background: var(--hd-off-icon);
    transition: background-color 180ms ease;
  }
  .switch::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ffffff;
    transition: transform 180ms ease;
  }
  .switch.on {
    background: var(--hd-appliance-icon);
  }
  .switch.on::after {
    transform: translateX(20px);
  }
  .press {
    display: grid;
    flex: none;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--hd-off-icon);
  }
  .remotes {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .remote {
    display: grid;
    place-items: center;
    height: 64px;
    border-radius: var(--hd-radius);
    background: var(--hd-off);
  }
  .remote.on {
    color: #ffffff;
    background: var(--hd-appliance-icon);
  }
  .order-row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 52px;
    padding: 2px 4px 2px 14px;
    border-radius: 14px;
    background: var(--hd-off);
  }
  .order-row span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 14px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .order-row button {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
  }
  .order-row.muted span {
    opacity: 0.5;
  }
  .choice.on.except {
    background: var(--hd-security-icon);
  }
  .rule-users {
    margin-top: 8px;
  }
  .choices.sheet-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .sheet-tabs .choice {
    flex: 1 0 auto;
    padding: 8px 16px;
  }
  [data-color-modes],
  .choices.even {
    flex-wrap: nowrap;
  }
  .look-preview.borrowed {
    opacity: 0.55;
  }
  [data-color-modes] .choice,
  .choices.even .choice {
    flex: 1 1 0;
    min-width: 0;
  }
  .view-section {
    margin-top: 8px;
  }
  .view-tile {
    margin-left: 16px;
  }
  .looks {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .look {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border: 2px solid transparent;
    border-radius: var(--hd-radius);
    background: var(--hd-off);
  }
  .look.on {
    border-color: var(--hd-appliance-icon);
  }
  .look strong {
    font-size: 14px;
    font-weight: 500;
  }
  .look-preview {
    display: grid;
    place-items: center;
    height: 96px;
    border-radius: 12px;
    background-position: center;
    background-size: cover;
    background-color: var(--hd-surface);
  }
  .look-scope {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .search {
    box-sizing: border-box;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--hd-outline);
    border-radius: 12px;
    font: inherit;
    color: inherit;
    background: var(--hd-surface);
  }
  .pin-message {
    margin: 0;
    color: var(--hd-text-muted);
  }
  .pin-message.wrong {
    font-weight: 500;
    color: var(--hd-security-ink);
  }
  .pin-dots {
    display: flex;
    gap: 12px;
    height: 16px;
  }
  .pin-dots span {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: currentcolor;
  }
  .pin-keys {
    display: grid;
    grid-template-columns: repeat(3, 76px);
    gap: 14px;
  }
  .pin-keys button {
    display: grid;
    place-items: center;
    height: 76px;
    border-radius: 50%;
    font-size: 26px;
    background: var(--hd-off);
  }
  .pin-keys .ok {
    font-size: 18px;
    font-weight: 500;
    color: #ffffff;
    background: var(--hd-appliance-icon);
  }
  .light-slider {
    background: var(--hd-off);
  }
  .light-slider.disabled {
    opacity: 0.5;
  }
  .level {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    transition: height 200ms ease-out;
  }
  .actions button.lit {
    color: var(--hd-light-ink);
    background: var(--hd-light-icon);
  }
  .light-presets {
    display: grid;
    grid-template-columns: repeat(4, 44px);
    gap: 16px;
  }
  .light-preset {
    width: 44px;
    height: 44px;
    box-sizing: border-box;
    border: 1px solid var(--hd-outline);
    border-radius: 50%;
  }
  .field.effect {
    align-self: stretch;
  }
  .state-body {
    gap: 12px;
    padding: 12px 16px 4px;
  }
  .state-badge {
    display: grid;
    place-items: center;
    width: 96px;
    height: 96px;
    border-radius: 50%;
    color: var(--hd-off-ink, var(--hd-text));
    background: var(--hd-off);
    --mdc-icon-size: 44px;
  }
  .state-badge.security {
    color: #ffffff;
    background: var(--hd-security-icon);
  }
  .state-badge.climate {
    color: #ffffff;
    background: var(--hd-climate-icon);
  }
  .state-badge.appliance {
    color: #ffffff;
    background: var(--hd-appliance-icon);
  }
  .state-text {
    font-size: 24px;
    font-weight: 500;
    text-align: center;
  }
  .state-text::first-letter {
    text-transform: uppercase;
  }
  .sheet-history {
    padding: 8px 16px 16px;
  }
  .select-body .choice {
    flex-basis: calc(33.33% - 6px);
  }
  .select-run {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 52px;
    margin-top: 12px;
    border-radius: 16px;
    font-size: 16px;
    font-weight: 500;
    color: #ffffff;
    background: var(--hd-appliance-icon);
  }
  .big-switch {
    position: relative;
    width: 120px;
    height: min(340px, 46vh);
    box-sizing: border-box;
    padding: 6px;
    border-radius: 36px;
    background: var(--hd-off);
    transition: background 200ms ease;
  }
  .big-switch.on {
    background: var(--hd-appliance);
  }
`;
