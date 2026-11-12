// The controls of the windows of entities and blocks: switches, lights, covers, choices, sliders. Styles of the sheet, in the order of the cascade: base, look, controls, camera.

import { css } from "../vendor/lit-all.min.js";

export const controlStyles = css`
  /* Room for the power of the plug under it. */
  .big-switch.short {
    width: 104px;
    height: min(220px, 28vh);
  }
  .switch-power {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 16px 16px;
  }
  .switch-power-facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
  }
  .switch-power-facts span {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    border-radius: 14px;
    background: var(--hd-off);
  }
  .switch-power-facts strong {
    font-size: 17px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .big-thumb {
    position: absolute;
    right: 6px;
    bottom: 6px;
    left: 6px;
    display: grid;
    place-items: center;
    height: calc(50% - 6px);
    border-radius: 30px;
    color: var(--hd-text-muted);
    background: var(--hd-surface);
    transition:
      bottom 200ms ease,
      color 200ms ease,
      background 200ms ease;
  }
  .big-switch.on .big-thumb {
    bottom: 50%;
    color: #ffffff;
    background: var(--hd-appliance-icon);
  }
  .alarm-modes {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    align-self: stretch;
    gap: 12px;
  }
  .alarm-mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 8px;
    border-radius: var(--hd-radius);
    text-align: center;
    background: var(--hd-off);
  }
  .alarm-mode.on {
    color: #ffffff;
    background: var(--hd-security-icon);
  }
  .alarm-mode.on.off {
    background: var(--hd-appliance-icon);
  }
  .big-toggles {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .big-toggle {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
    border-radius: var(--hd-radius);
    background: var(--hd-off);
  }
  .big-toggle ha-icon {
    margin-bottom: 8px;
  }
  .big-toggle strong {
    font-size: 15px;
    font-weight: 500;
  }
  .big-toggle small {
    font-size: 13px;
    color: var(--hd-text-muted);
  }
  .big-toggle.on {
    color: #ffffff;
    background: var(--hd-appliance-icon);
  }
  .big-toggle.on small {
    color: inherit;
    opacity: 0.8;
  }
  .choice-field h3,
  .range-field h3 {
    display: flex;
    justify-content: space-between;
    margin: 8px 0;
  }
  .range-field h3 span {
    font-weight: 400;
    color: var(--hd-text-muted);
  }
  .range-field input[type="range"] {
    width: 100%;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .choice {
    display: flex;
    flex: 1 1 calc(50% - 4px);
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-sizing: border-box;
    min-height: 48px;
    padding: 8px 10px;
    border-radius: 14px;
    font-size: 14px;
    text-align: center;
    background: var(--hd-off);
  }
  .choice.on {
    color: #ffffff;
    background: var(--hd-appliance-icon);
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .fact {
    display: flex;
    flex: 1 1 calc(50% - 4px);
    align-items: center;
    gap: 10px;
    box-sizing: border-box;
    min-width: 0;
    padding: 10px 12px;
    border-radius: 14px;
    background: var(--hd-off);
  }
  .fact ha-icon {
    flex: none;
    color: var(--hd-text-muted);
  }
  .fact span {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .fact small {
    font-size: 12px;
    line-height: 16px;
    color: var(--hd-text-muted);
  }
  .fact b {
    overflow: hidden;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .fact.alert {
    color: var(--hd-security-ink);
    background: var(--hd-security);
  }
  .fact.alert ha-icon,
  .fact.alert small {
    color: inherit;
  }
  .summary {
    border-radius: var(--hd-radius);
    background: var(--hd-off);
  }
  .summary summary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
    padding: 0 16px;
    list-style: none;
    cursor: pointer;
  }
  .summary summary::-webkit-details-marker {
    display: none;
  }
  .summary strong {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 500;
  }
  .summary small {
    font-size: 13px;
    color: var(--hd-text-muted);
  }
  .summary small.alert {
    font-weight: 500;
    color: var(--hd-security-ink);
  }
  .summary summary ha-icon {
    flex: none;
    transition: transform 200ms ease;
  }
  .summary[open] summary ha-icon {
    transform: rotate(180deg);
  }
  .summary .facts,
  .summary .choices {
    padding: 0 8px 8px;
  }
  .summary .fact,
  .summary .choice {
    background: var(--hd-surface);
  }
  .summary .fact.alert {
    background: var(--hd-security);
  }
  .summary .choice.on {
    background: var(--hd-appliance-icon);
  }
  .tv-now {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 18px;
    background: var(--hd-off);
  }
  .tv-now img,
  .tv-now-icon {
    flex: none;
    width: 88px;
    height: 50px;
    border-radius: 10px;
    object-fit: cover;
  }
  .tv-now-icon {
    display: grid;
    place-items: center;
    background: var(--hd-surface);
  }
  .tv-now-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }
  .tv-now-text strong,
  .tv-now-text small {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .tv-now-text small {
    color: var(--hd-text-muted);
  }
  .tv-now-play {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--hd-surface);
  }
  .keys.three {
    grid-template-columns: repeat(3, 1fr);
  }
  .dpad {
    display: grid;
    grid-template-areas:
      ". up ."
      "left ok right"
      ". down .";
    grid-template-columns: repeat(3, 72px);
    grid-template-rows: repeat(3, 72px);
    justify-content: center;
    padding: 8px 0;
  }
  .key {
    display: grid;
    place-items: center;
    border-radius: 18px;
    font-weight: 500;
    background: var(--hd-off);
  }
  .dpad .up {
    grid-area: up;
    border-radius: 22px 22px 0 0;
  }
  .dpad .down {
    grid-area: down;
    border-radius: 0 0 22px 22px;
  }
  .dpad .left {
    grid-area: left;
    border-radius: 22px 0 0 22px;
  }
  .dpad .right {
    grid-area: right;
    border-radius: 0 22px 22px 0;
  }
  .dpad .ok {
    grid-area: ok;
    border-radius: 0;
    color: #ffffff;
    background: var(--hd-appliance-icon);
  }
  .keys {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .keys .key {
    height: 56px;
  }
  hr {
    width: 100%;
    margin: 8px 0;
    border: 0;
    border-top: 1px solid var(--hd-outline);
  }
  .tv-status {
    margin: 0;
    text-align: center;
    color: var(--hd-text-muted);
  }
  .fill {
    flex: 1;
    min-height: 0;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .swatch {
    height: 72px;
    border-radius: 14px;
  }
  .swatch.selected {
    outline: 2px solid var(--hd-link);
    outline-offset: 2px;
  }
  .field input[type="color"] {
    width: 56px;
    height: 36px;
    padding: 0;
    border: 0;
    background: none;
  }
  .field input[type="file"] {
    max-width: 60%;
    font-size: 13px;
  }
  .search {
    box-sizing: border-box;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--hd-outline);
    border-radius: 12px;
    font: inherit;
    font-size: 16px;
    color: inherit;
    background: var(--hd-surface);
  }
  .frame {
    flex: 1;
    width: 100%;
    min-height: 60vh;
    border: 0;
  }
  .live.panel-card {
    min-height: 240px;
    max-height: none;
    /* A device's own card takes the colours of this window, not of Home Assistant's theme: its buttons, writing
       and choices as the window's own (a light theme of Home Assistant made white buttons in a dark window). */
    --primary-text-color: var(--hd-text);
    --secondary-text-color: var(--hd-text-muted);
    --secondary-background-color: var(--hd-off);
    --card-background-color: transparent;
    --divider-color: var(--hd-outline);
    --primary-color: var(--hd-appliance-icon);
    --text-primary-color: #ffffff;
  }
  .panel.whole .rows .panel-card {
    max-width: 760px;
    margin: 0 auto;
  }
  header {
    display: flex;
    flex: none;
    align-items: center;
    height: 64px;
    padding: 0 8px;
  }
  header button {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
  }
  h2 {
    flex: 1;
    min-width: 0;
    margin: 0 8px;
    overflow: hidden;
    font-size: 22px;
    font-weight: 400;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .body {
    flex: 1;
    min-height: 0;
  }
  /* Never smaller than what it holds: on a low screen the window scrolls instead of laying the controls over its
     header and the state under them. */
  .center {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 16px;
  }
  .info {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
  }
  .info span {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--hd-outline);
    border-radius: 10px;
    font-size: 14px;
    --mdc-icon-size: 18px;
  }
  .hint {
    margin: 0;
    padding: 0 16px;
    font-size: 14px;
    text-align: center;
    color: var(--hd-text-muted);
  }
  .dial {
    position: relative;
    width: min(280px, 76vw);
    aspect-ratio: 1;
  }
  .dial svg {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
  }
  .dial path {
    fill: none;
    stroke-width: 12;
    stroke-linecap: round;
  }
  .dial .track {
    stroke: var(--hd-outline);
  }
  .dial .value {
    stroke: var(--hd-climate-icon);
  }
  .reading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .reading small {
    font-size: 14px;
    color: var(--hd-climate-icon);
  }
  .reading strong {
    font-size: 60px;
    line-height: 72px;
    font-weight: 400;
  }
  .reading sup {
    font-size: 28px;
  }
  .stepper,
  .actions,
  .modes,
  .transport,
  .extras {
    display: flex;
    justify-content: center;
    gap: 16px;
  }
  .modes {
    flex-wrap: wrap;
    gap: 8px;
  }
  .modes button {
    padding: 8px 14px;
    border: 1px solid var(--hd-outline);
    border-radius: 12px;
    font-size: 14px;
  }
  /* Choices that can be several at once, as labels: neutral, in the colours of the window. */
  .choice-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .choice-chips button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid var(--hd-outline);
    border-radius: 18px;
    font-size: 14px;
    --mdc-icon-size: 18px;
  }
  .choice-chips button.active {
    border-color: transparent;
    color: var(--hd-surface);
    background: var(--hd-text);
  }
  .modes button.active {
    border-color: transparent;
    background: var(--hd-climate);
  }
  .stepper button,
  .actions button {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--hd-off);
  }
  .slider {
    position: relative;
    flex: none;
    box-sizing: border-box;
    width: 120px;
    height: min(340px, 46vh);
    overflow: hidden;
    border-radius: 36px;
    touch-action: none;
  }
  .cover-slider {
    background: var(--hd-cover);
  }
  .blind {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    background: #a7a9ad;
  }
  .moving .blind {
    transition: height 260ms linear;
  }
  .actions button.moving {
    color: var(--hd-cover-icon);
    background: var(--hd-cover);
    animation: pulse 1400ms ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.55;
    }
  }
  .lock-slider {
    background: var(--hd-security);
  }
  .lock-slider.disabled {
    opacity: 0.6;
  }
  .thumb {
    position: absolute;
    right: 6px;
    left: 6px;
    display: grid;
    place-items: center;
    height: 142px;
    border-radius: 30px;
    color: #ffffff;
    background: var(--hd-security-icon);
  }
`;
