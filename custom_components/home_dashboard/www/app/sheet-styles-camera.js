// The window of a camera, its recordings and all cameras. Styles of the sheet, in the order of the cascade: base, look, controls, camera.

import { css } from "../vendor/lit-all.min.js";

export const cameraStyles = css`
  .header-end {
    width: 48px;
  }
  .picture {
    position: relative;
    width: fit-content;
    max-width: 100%;
  }
  /* The age of the picture sits top left, where LIVE shows once the camera streams. */
  .age {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 13px;
    color: #fff;
    background: rgba(0, 0, 0, 0.5);
  }
  /* The picture or the live view, with the controls of turning lying over it. */
  /* Room for the controls even before the picture comes, so nothing jumps when it does. */
  .stage {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: fit-content;
    min-width: min(100%, 320px);
    max-width: 100%;
    min-height: 180px;
  }
  .stage:has(.live),
  .stage:has(.clip) {
    width: 100%;
  }
  .stage .live-pill {
    top: 8px;
    left: 8px;
    z-index: 1;
  }
  .ptz-overlay {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
  }
  /* Four quarters of a ring with a hole, turned so that the gaps between them run diagonally. */
  .ptz {
    display: grid;
    grid-template: 1fr 1fr / 1fr 1fr;
    gap: 3px;
    /* Smaller on a narrow phone, so it fits on the picture and never covers the buttons under it. */
    width: min(132px, 30vw);
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 50%;
    transform: rotate(45deg);
    -webkit-mask: radial-gradient(circle closest-side, transparent 40%, #000 41%);
    mask: radial-gradient(circle closest-side, transparent 40%, #000 41%);
  }
  .ptz button {
    display: grid;
    place-items: center;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.45);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    --mdc-icon-size: 26px;
  }
  .ptz button:active {
    background: rgba(255, 255, 255, 0.35);
  }
  .ptz button[disabled] {
    cursor: default;
    opacity: 0.4;
  }
  .ptz ha-icon {
    transform: rotate(-45deg);
  }
  /* Quick buttons upright: a row over the line of time, from the right, round like those on the picture. */
  .quick {
    display: flex;
    flex: none;
    flex-direction: row-reverse;
    gap: 10px;
    align-self: stretch;
    margin: 0 16px;
  }
  .quick-slot {
    position: relative;
    display: flex;
  }
  .quick-button {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.12);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    cursor: pointer;
  }
  .quick-button.on {
    color: #17181a;
    background: #ffd60a;
  }
  .quick-button.alarm {
    color: #ffffff;
    background: #d70015;
    animation: pulse 1400ms ease-in-out infinite;
  }
  /* A list next to its button: above it upright, beside it on a phone on its side. */
  .quick-menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    z-index: 6;
    display: grid;
    align-content: start;
    min-width: 150px;
    /* A long list (many positions) scrolls instead of leaving the screen. */
    max-height: 55dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px;
    border-radius: 16px;
    background: rgba(30, 31, 34, 0.94);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }
  .quick-menu button {
    padding: 10px 12px;
    border: 0;
    border-radius: 10px;
    font: inherit;
    font-size: 15px;
    text-align: left;
    color: #ffffff;
    background: none;
    cursor: pointer;
  }
  .quick-menu button.chosen {
    background: rgba(255, 255, 255, 0.14);
  }
  /* The siren asks first, in the middle of the window. */
  .siren-ask {
    position: fixed;
    inset: 0;
    z-index: 9;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.45);
  }
  .siren-card {
    display: grid;
    justify-items: center;
    gap: 8px;
    width: min(100%, 340px);
    padding: 20px;
    border-radius: 24px;
    text-align: center;
    color: #ffffff;
    background: #2c2c2e;
    --mdc-icon-size: 36px;
  }
  .siren-card ha-icon {
    color: #ff453a;
  }
  .siren-card strong {
    font-size: 18px;
  }
  .siren-card p {
    margin: 0 0 8px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.75);
  }
  .siren-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
  }
  .siren-actions button {
    padding: 12px;
    border: 0;
    border-radius: 14px;
    font: inherit;
    font-weight: 600;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.14);
    cursor: pointer;
  }
  .siren-actions .danger {
    background: #d70015;
  }
  header .ptz-toggle {
    border-radius: 50%;
  }
  .ptz-toggle.on {
    color: #1b1b1f;
    background: #ffffff;
  }
  /* The intercom lies on the picture, in the corner opposite its age. */
  .stage .voice.camera-talk.on.connecting {
    background: #8e8e93;
  }
  .stage .voice.camera-talk.blocked,
  .stage .voice.camera-talk.waiting {
    color: rgba(255, 255, 255, 0.55);
  }
  .stage .voice.camera-talk.on {
    color: #ffffff;
    background: #d70015;
    animation: pulse 1400ms ease-in-out infinite;
  }
  .stage .voice {
    position: absolute;
    right: 8px;
    bottom: 8px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: #fff;
    background: rgba(0, 0, 0, 0.5);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
  }
  .thumbs {
    display: flex;
    flex: none;
    gap: 6px;
    box-sizing: border-box;
    justify-content: safe center;
    width: 100%;
    padding: 4px 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .thumbs::-webkit-scrollbar {
    display: none;
  }
  .camera-thumb {
    flex: 0 0 112px;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 12px;
    background: #2a2c30;
  }
  .camera-thumb.current {
    outline: 2px solid #fff;
    outline-offset: 1px;
  }
  .thumbs .camera-thumb img {
    display: block;
    width: 100%;
    height: 100%;
    max-height: none;
    object-fit: cover;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 16px 16px;
  }
  /* The groups of a block, one under another as the rest of its rows. */
  .panel-groups,
  .panel-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: var(--hd-radius);
    background: var(--row-background, var(--hd-off));
  }
  .row-icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--row-icon, var(--hd-off-icon));
  }
  .row-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .row-text strong {
    font-weight: 500;
  }
  .row-text small {
    color: var(--hd-text-muted);
  }
  .row.light {
    --row-background: var(--hd-light);
    --row-icon: var(--hd-light-icon);
  }
  .row.climate {
    --row-background: var(--hd-climate);
    --row-icon: var(--hd-climate-icon);
  }
  .row.cover {
    --row-background: var(--hd-cover);
    --row-icon: var(--hd-cover-icon);
  }
  .row.security {
    --row-background: var(--hd-security);
    --row-icon: var(--hd-security-icon);
  }
  .row.media {
    --row-background: var(--hd-media);
    --row-icon: var(--hd-media-icon);
  }
  .row.appliance {
    --row-background: var(--hd-appliance);
    --row-icon: var(--hd-appliance-icon);
  }
  .camera-body {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  /* Room for the days, the line of time and the thumbnails, so a tall picture never pushes them over it. */
  .camera-body img,
  .live,
  .clip {
    display: block;
    width: 100%;
    max-height: clamp(180px, 100dvh - 440px, 60vh);
    object-fit: contain;
  }
  .clip {
    aspect-ratio: 16 / 9;
    background: #000000;
  }
  /* Days at the top and the line of time at the bottom; the picture stays between them. */
  .camera-body home-dashboard-recording-days {
    flex: none;
    margin-bottom: auto;
  }
  .camera-body home-dashboard-timeline {
    flex: none;
    margin-top: auto;
    margin-bottom: 8px;
  }
  .sound-level {
    position: absolute;
    top: 0;
    right: 12px;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 18px;
    color: #ffffff;
    background: rgba(40, 40, 44, 0.92);
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
  }
  .sound-level input {
    width: 160px;
    accent-color: #ffffff;
  }
  .picture img {
    width: auto;
    max-width: 100%;
  }
  /* While the camera wakes its last picture holds the place, and the player loads unseen behind it. */
  .live-wrap {
    position: relative;
    width: 100%;
  }
  /* The player and the picture standing in for it stay in the middle when they are narrower than the window. */
  .live-wrap .live,
  .live-wrap .poster {
    margin-inline: auto;
  }
  /* A quiet ring in the middle of the last picture while the camera wakes. */
  .waking {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 1;
    box-sizing: border-box;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    border: 3px solid rgba(255, 255, 255, 0.25);
    border-top-color: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.25);
    animation: waking 900ms linear infinite;
  }
  @keyframes waking {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .waking {
      animation-duration: 2400ms;
    }
  }
  /* Zooming: the picture is scaled from its top left corner within the stage, which cuts off what goes past it.
     A finger moves the page as before until the picture is zoomed, then it moves the picture. */
  .stage {
    overflow: hidden;
    touch-action: pan-y;
  }
  .stage.zoomed {
    touch-action: none;
  }
  .stage > .picture,
  .stage > .live-wrap,
  .stage > video.clip {
    transform-origin: 0 0;
  }
  .zoom-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 3;
    padding: 3px 10px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.55);
  }
  /* The list of cameras: big pictures one under another, two side by side on a tablet. */
  /* The window scrolls as a whole, its heading with it, as a room does: no box of its own that cuts the cards. */
  .camera-cards {
    display: grid;
    flex: none;
    grid-template-columns: 1fr;
    grid-auto-rows: max-content;
    gap: 12px;
    padding: 0 16px 8px;
  }
  .camera-cell {
    position: relative;
    min-width: 0;
  }
  /* The recordings on a camera's card: by day, newest first, small pictures in a grid. */
  .sd-status {
    margin: 0 16px 8px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
  }
  .sd-status.error {
    color: #ff6961;
  }
  .sd-days {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 0 16px 16px;
  }
  .sd-day {
    content-visibility: auto;
    contain-intrinsic-size: auto 400px;
  }
  .sd-day h3 {
    display: flex;
    gap: 8px;
    align-items: baseline;
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 500;
  }
  .sd-day h3::first-letter {
    text-transform: uppercase;
  }
  .sd-day h3 small {
    opacity: 0.6;
  }
  .remove-button {
    position: absolute;
    top: 6px;
    left: 6px;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.55);
    cursor: pointer;
    --mdc-icon-size: 18px;
  }
  .sd-clip {
    cursor: pointer;
  }
  .disk-more {
    padding: 16px;
    text-align: center;
  }
  button.sd-clip {
    cursor: pointer;
    color: #ffffff;
  }
  /* Upright the recordings button stands alone at the left end of the row over the line of time (last in a row laid
     from the right), the quick buttons stay at the right. */
  .quick .disk-button.upright {
    margin-right: auto;
  }
  .sd-day-action {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    margin-left: auto;
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 14px;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.14);
    --mdc-icon-size: 20px;
  }
  .sd-day-action.done {
    color: #30d158;
    background: none;
  }
  .sd-day-action.busy ha-icon {
    animation: sd-pulse 1.2s ease-in-out infinite;
  }
  .sd-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }
  .sd-clip {
    position: relative;
    display: grid;
    place-items: center;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    border-radius: 12px;
    background: #2c2c2e;
  }
  .sd-clip img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .sd-placeholder {
    opacity: 0.35;
    --mdc-icon-size: 32px;
  }
  .sd-text {
    position: absolute;
    inset: auto 0 0 0;
    display: grid;
    padding: 18px 8px 6px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  }
  .sd-text strong {
    font-size: 14px;
    font-weight: 600;
  }
  .sd-text small {
    overflow: hidden;
    font-size: 11px;
    white-space: nowrap;
    text-overflow: ellipsis;
    opacity: 0.85;
  }
  .sd-mark {
    position: absolute;
    top: 6px;
    right: 6px;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.55);
    --mdc-icon-size: 20px;
  }
  .sd-mark.local {
    background: #30d158;
  }
  .sd-mark.busy ha-icon {
    animation: sd-pulse 1.2s ease-in-out infinite;
  }
  @keyframes sd-pulse {
    50% {
      opacity: 0.3;
    }
  }
  /* The live view of the big camera lies over its last picture, unseen until its video moves. */
  .wall-live {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
  }
  .wall-live.shown {
    opacity: 1;
  }
  .wall-live > * {
    display: block;
    width: 100%;
    height: 100%;
    --ha-card-border-radius: 0;
    --ha-card-border-width: 0;
  }
  .wall-resume {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    transform: translate(-50%, -50%);
    --mdc-icon-size: 36px;
  }
  .camera-expand {
    position: absolute;
    right: 8px;
    bottom: 8px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.5);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    --mdc-icon-size: 22px;
  }
  .camera-card {
    position: relative;
    display: block;
    flex: none;
    width: 100%;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    padding: 0;
    border: 0;
    border-radius: 24px;
    color: #ffffff;
    background: #2c2c2e;
    cursor: pointer;
  }
  .camera-card img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .camera-card.off img {
    transform: scale(1.1);
    filter: blur(12px) brightness(0.5);
  }
  .camera-card-text {
    position: absolute;
    inset: auto 0 0 0;
    display: grid;
    gap: 2px;
    padding: 32px 16px 14px;
    text-align: left;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
  }
  .camera-card-text strong {
    font-size: 18px;
    font-weight: 600;
  }
  .camera-card-text small {
    font-size: 14px;
    opacity: 0.85;
  }
  /* A tablet: the cameras on the whole screen, black around them, in the chosen number of columns. */
  @media (min-width: 900px) {
    .panel.dark[data-kind="cameras"] {
      background: #000000;
    }
    .camera-cards {
      grid-template-columns: repeat(var(--camera-columns, 3), minmax(0, 1fr));
      gap: 10px;
      padding: 0 10px 10px;
    }
    .camera-card {
      border-radius: 14px;
    }
    .camera-card-text {
      inset: 0 0 auto 0;
      padding: 12px 14px 28px;
      background: linear-gradient(rgba(0, 0, 0, 0.55), transparent);
    }
    .camera-card-text strong {
      font-size: 16px;
    }
    .camera-card-text small {
      font-size: 13px;
    }
    /* One big camera over two rows and two columns, the rest small around it. */
    .camera-cards.featured .camera-cell.big {
      grid-row: span 2;
      grid-column: span 2;
    }
    .camera-cell.big .camera-card {
      height: 100%;
      aspect-ratio: auto;
    }
    header .columns {
      display: flex;
      gap: 4px;
      align-items: center;
      width: auto;
      padding: 0 12px;
      border-radius: 24px;
      font-size: 16px;
      font-weight: 600;
    }
  }
  /* A camera that went away: its last picture, dimmed, with the reason in the middle. */
  /* A still picture of a working camera: a tap in its middle starts the live view, as LIVE does. */
  /* Placed by its corner, not moved by a transform: the press of a finger scales it, and a transform it does not
     keep would throw it off the finger, and iOS would then drop the tap. */
  .play-live {
    position: absolute;
    z-index: 2;
    top: calc(50% - 38px);
    left: calc(50% - 38px);
    display: grid;
    place-items: center;
    width: 76px;
    height: 76px;
    border-radius: 50%;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.42);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    --mdc-icon-size: 46px;
    transition: opacity 150ms ease;
  }
  /* Out of sight on an enlarged picture, but still there: two fingers that began on it go on moving the picture. */
  .stage > .stream-dot {
    top: calc(var(--media-top, 0px) + 12px);
    right: calc(var(--media-right, 0px) + 12px);
  }
  .play-live.hidden {
    opacity: 0;
    pointer-events: none;
  }
  .camera-down {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: grid;
    place-items: center;
    padding: 16px;
    text-align: center;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.55);
  }
  .camera-down span {
    padding: 8px 16px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 500;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.45);
  }
  .no-picture {
    width: min(100vw, 640px);
    aspect-ratio: 16 / 9;
    background: #1c1c1e;
  }
  /* Always there for a camera on a battery, so the window does not jump; faint while a recording plays. */
  .battery-hint.faint {
    opacity: 0.35;
  }
  .live-wrap:not(.shown) .live {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
  }
  .camera-body home-dashboard-intercom {
    padding: 0 16px;
  }
  .camera-body .hint {
    color: #c4c7cc;
  }
  .live-pill.recording {
    background: #d70015;
  }
  /* Grey while the camera wakes and the last picture stands in; the colour comes with the video. */
  .live-pill.waiting {
    background: #636366;
  }
  .live-pill .rec {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 6px;
    border-radius: 50%;
    vertical-align: 1px;
    background: #ff3b30;
  }
  .live-pill .rec {
    background: #ffffff;
  }
  .live-pill {
    position: absolute;
    top: 0;
    padding: 3px 12px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    background: #cc6f00;
  }
  .start-live {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 24px;
    color: #1b1b1f;
    background: #ffdf3d;
  }
  .player {
    display: flex;
    flex-direction: column;
    padding: 8px 20px;
  }
  .art {
    display: grid;
    flex: none;
    place-items: center;
    width: min(100%, 44vh);
    aspect-ratio: 1;
    align-self: center;
    overflow: hidden;
    border-radius: 12px;
    background: var(--hd-off);
    --mdc-icon-size: 64px;
  }
  .art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .track-title {
    margin-top: 20px;
    font-size: 22px;
    font-weight: 400;
  }
  .artist {
    font-size: 15px;
    color: var(--hd-text-muted);
  }
  .progress {
    height: 6px;
    margin-top: 20px;
    overflow: hidden;
    border-radius: 3px;
    background: var(--hd-outline);
  }
  .progress span {
    display: block;
    height: 100%;
    background: var(--hd-control);
  }
  .times {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 12px;
    color: var(--hd-text-muted);
  }
  .transport {
    align-items: center;
    gap: 32px;
    margin-top: 16px;
    --mdc-icon-size: 36px;
  }
  .transport button {
    display: grid;
    place-items: center;
    min-width: 56px;
    min-height: 56px;
  }
  .volume {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
  }
  .volume input {
    flex: 1;
    accent-color: var(--hd-control);
  }
  .extras {
    margin-top: 8px;
  }
  .extras button {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
  }
  .extras button.active {
    background: var(--hd-pill);
  }
  .landscape-only,
  .corner-live {
    display: none;
  }
  @media (min-width: 900px) {
    .backdrop:not(.whole) {
      display: none;
    }
    .panel[data-kind="chart"] {
      width: min(760px, calc(100vw - 64px));
    }
    /* A block of several groups: wider, its groups in two balanced columns, so it fits without scrolling. */
    .panel.roomy {
      width: min(1080px, calc(100vw - 64px));
      max-height: calc(100vh - 32px);
    }
    /* Its numbers and its buttons side by side, its groups below in columns of about 300 px (three in the widest
       window). */
    .panel.roomy .rows:has(> .stats):has(> .block-actions) {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: stretch;
    }
    .panel.roomy .rows > :not(.stats):not(.block-actions) {
      grid-column: 1 / -1;
    }
    .panel.roomy .panel-groups {
      display: block;
      columns: 300px;
      column-gap: 16px;
    }
    .panel.roomy .panel-group {
      break-inside: avoid;
      padding-bottom: 8px;
    }
    /* Lower switches and choices four in a row, so a column holds more. */
    .panel.roomy .big-toggle {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      column-gap: 12px;
      row-gap: 0;
      padding: 10px 14px;
    }
    .panel.roomy .big-toggle ha-icon {
      grid-row: span 2;
      margin: 0;
    }
    .panel.roomy .choice {
      flex-basis: calc(25% - 6px);
      min-height: 40px;
    }
    .panel.roomy .choice-field h3,
    .panel.roomy .range-field h3 {
      margin: 4px 0;
    }
    /* The scale in a window of its own in the middle, wide enough for its two columns, not the whole screen. */
    .panel[data-kind="scale"] {
      width: min(860px, calc(100vw - 64px));
    }
    .panel {
      inset: 50% auto auto 50%;
      width: 520px;
      max-height: calc(100vh - 48px);
      padding-top: 0;
      border-radius: 28px;
      transform: translate(-50%, calc(-50% + var(--hd-drag, 0px)));
      animation-name: rise-centre;
      background: color-mix(in srgb, var(--hd-sheet-bg, var(--hd-background)) var(--hd-sheet-opacity, 100%), transparent);
      -webkit-backdrop-filter: blur(var(--hd-sheet-blur, 0px));
      backdrop-filter: blur(var(--hd-sheet-blur, 0px));
    }
    .panel.whole {
      inset: 0;
      width: auto;
      max-height: none;
      padding-top: var(--hd-safe-top);
      border-radius: 0;
      transform: translateY(var(--hd-drag, 0px));
      animation-name: rise;
      background: transparent;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }
  /* A phone or a tablet on its side: the camera on the whole screen, its name and buttons over it, the days
     hidden above, the line of time and the other cameras below, each brought out with its handle. LIVE stays in
     the corner. */
  @media (orientation: landscape) and (max-height: 500px), (orientation: landscape) and (min-width: 900px) {
    /* Clipped, not hidden: a hidden box can still be scrolled (a focused button, a list scrolled into view on
       iOS), which slid the header off the top and the put-away line of time into view. */
    .panel[data-kind="camera"] {
      padding: 0;
      overflow: clip;
    }
    .panel[data-kind="camera"] > .grip,
    .panel[data-kind="camera"] .hint,
    .panel[data-kind="camera"] .live-pill {
      display: none;
    }
    /* Why talking does not work stays: a note over the picture, at the top in the middle. */
    .panel[data-kind="camera"] .hint.talk-problem {
      position: absolute;
      top: 72px;
      left: 50%;
      z-index: 5;
      display: block;
      box-sizing: border-box;
      max-width: min(560px, calc(100% - 32px));
      margin: 0;
      padding: 10px 16px;
      border-radius: 14px;
      color: #ffffff;
      background: rgba(0, 0, 0, 0.72);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
      text-align: center;
      transform: translateX(-50%);
      pointer-events: none;
    }
    .panel[data-kind="camera"] header {
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      z-index: 4;
      /* Across the whole screen: close in the far left corner, the settings in the far right one (over the dark
         bands beside a narrower picture), the camera's own buttons set a little apart from the settings. What
         turns the camera stays on the picture. */
      /* Over a band above the picture (a tablet) the header fills the band, its buttons in its middle. */
      height: max(64px, var(--media-top, 0px));
      padding: 0 max(12px, env(safe-area-inset-right)) max(0px, calc(12px - var(--media-top, 0px)))
        max(12px, env(safe-area-inset-left));
      background: linear-gradient(rgba(0, 0, 0, 0.55), transparent);
    }
    .panel[data-kind="camera"] header > button:last-of-type {
      margin-left: 20px;
    }
    /* What stands at the bottom keeps to the picture's bottom edge, 16 px over it, when the picture leaves a band
       under it (a tablet); on a phone the picture reaches the bottom of the screen. */
    .camera-body {
      --media-foot: max(16px, calc(var(--media-bottom, 0px) + 12px));
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      gap: 0;
    }
    .camera-body .stage {
      position: absolute;
      inset: 0;
      width: auto;
      min-width: 0;
      min-height: 0;
    }
    .camera-body img,
    .camera-body .clip {
      max-height: 100dvh;
    }
    .camera-body .picture img {
      width: auto;
    }
    /* A camera away keeps the place of its picture, so the header and the buttons stay where they always are. */
    .camera-body .no-picture {
      width: min(100vw, 100dvh * 16 / 9);
    }
    .camera-body .clip {
      height: 100dvh;
      aspect-ratio: auto;
    }
    /* The player of Home Assistant keeps room for its own header, 97 px, unless told otherwise. */
    .camera-body .live {
      width: min(100%, 100dvh * 16 / 9);
      max-height: 100dvh;
      --video-max-height: 100dvh;
    }
    /* Under the header where it lies over the picture (a phone); in the corner where the header stands above it. */
    .camera-body .age,
    .camera-body .zoom-badge {
      top: max(8px, calc(64px - var(--media-top, 0px)));
      bottom: auto;
    }
    /* In the corner of the picture, not of the screen, when bands stand beside it (a wide window). */
    .camera-body .age {
      left: calc(var(--media-left, 0px) + 8px);
    }
    .camera-body .sound-level {
      top: 60px;
    }
    .camera-body home-dashboard-recording-days,
    .camera-body home-dashboard-timeline {
      position: absolute;
      left: 50%;
      z-index: 5;
      margin: 0;
      transition: transform 260ms cubic-bezier(0.2, 0.9, 0.25, 1);
    }
    /* Pinned near the top edge, over the header: whoever opens the days wants a date, not LIVE. */
    .camera-body home-dashboard-recording-days {
      top: 8px;
      width: min(70%, 520px);
      background: rgba(23, 24, 26, 0.85);
      transform: translate(-50%, calc(-100% - 16px));
    }
    .panel:has(.camera-body.days-open) header :is([data-open-days], [data-corner-live]),
    .camera-body.line-open .line-button {
      visibility: hidden;
    }
    .camera-body.days-open home-dashboard-recording-days {
      transform: translate(-50%, 0);
    }
    .camera-body home-dashboard-timeline {
      bottom: calc(var(--media-foot) - 8px);
      width: min(70%, 640px);
      box-sizing: border-box;
      padding: 4px 8px 8px;
      border-radius: 24px;
      background: rgba(23, 24, 26, 0.85);
      transform: translate(-50%, calc(100% + 16px + var(--media-bottom, 0px)));
    }
    .camera-body.line-open home-dashboard-timeline {
      transform: translate(-50%, 0);
    }
    header .landscape-only {
      display: grid;
      border-radius: 50%;
    }
    header .landscape-only.on {
      color: #17181a;
      background: #ffffff;
    }
    .line-button {
      position: absolute;
      right: max(16px, env(safe-area-inset-right));
      bottom: var(--media-foot);
      z-index: 4;
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      color: #ffffff;
      background: rgba(0, 0, 0, 0.5);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
    }
    /* The right column mirrors the left one: from the bottom the button of the line of time and the talk button,
       48 px with 12 px between. Both columns and the ring stand wholly on the picture, 12 px in from its edges:
       --media-left and --media-right are how far the picture's edges lie from the screen's (bands beside it). */
    .camera-body .stage .voice {
      right: max(16px, env(safe-area-inset-right), calc(var(--media-right, 0px) + 12px));
      bottom: calc(var(--media-foot) + 60px);
      width: 48px;
      height: 48px;
    }
    .line-button {
      right: max(16px, env(safe-area-inset-right), calc(var(--media-right, 0px) + 12px));
    }
    /* On its side the recordings button stands beside the button of the line of time, to its left; the one in
       the row of quick buttons, which stands in the left column here, is left out. */
    .quick .disk-button.upright {
      display: none;
    }
    .disk-button.side {
      position: absolute;
      right: calc(max(16px, env(safe-area-inset-right), calc(var(--media-right, 0px) + 12px)) + 60px);
      bottom: var(--media-foot);
      z-index: 4;
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      color: #ffffff;
      background: rgba(0, 0, 0, 0.5);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
    }
    .camera-body:is(.line-open, .cameras-open) .disk-button.side {
      visibility: hidden;
    }
    .camera-body .ptz-overlay {
      top: auto;
      right: max(16px, env(safe-area-inset-right), calc(var(--media-right, 0px) + 12px));
      bottom: calc(var(--media-foot) + 120px);
      transform: none;
    }
    /* On its side the quick buttons stand in a column in the bottom left corner, from the bottom, like the
       column on the right; they step aside for the line of time. */
    .camera-body .quick {
      position: absolute;
      bottom: var(--media-foot);
      left: max(16px, env(safe-area-inset-left), calc(var(--media-left, 0px) + 12px));
      z-index: 4;
      flex-direction: column-reverse;
      gap: 12px;
      margin: 0;
    }
    .camera-body .quick-button {
      width: 48px;
      height: 48px;
      background: rgba(0, 0, 0, 0.5);
    }
    .camera-body .quick-button.on {
      background: #ffd60a;
    }
    .camera-body .quick-button.alarm {
      background: #d70015;
    }
    /* On its side a list stands on the bottom of the column, whichever button opened it, and reaches at most
       up to under the header; a longer one scrolls. */
    .camera-body .quick-slot {
      position: static;
    }
    .camera-body .quick-menu {
      right: auto;
      bottom: 0;
      left: calc(100% + 10px);
      max-height: calc(100dvh - 120px);
    }
    .camera-body:is(.line-open, .cameras-open) .quick {
      visibility: hidden;
    }
    /* The other cameras come up from the bottom, like the line of time, and a drag down puts them away. */
    .camera-body .thumbs {
      position: absolute;
      bottom: calc(var(--media-foot) - 8px);
      left: 50%;
      z-index: 5;
      width: min(92%, 1100px);
      padding: 10px;
      border-radius: 24px;
      background: rgba(23, 24, 26, 0.85);
      visibility: hidden;
      transform: translate(-50%, calc(100% + 16px + var(--media-bottom, 0px)));
      transition:
        transform 260ms cubic-bezier(0.2, 0.9, 0.25, 1),
        visibility 260ms;
      touch-action: pan-x;
    }
    .camera-body.cameras-open .thumbs {
      visibility: visible;
      transform: translate(-50%, 0);
    }
    .camera-body.cameras-open .line-button {
      visibility: hidden;
    }
    .camera-body home-dashboard-recording-days {
      touch-action: none;
    }
    .camera-body home-dashboard-timeline {
      touch-action: pan-x;
    }
    /* LIVE sits in the header, by the sound, since the line of time with its own LIVE is hidden. */
    header .corner-live {
      display: block;
      width: auto;
      height: auto;
      margin-right: 4px;
      padding: 8px 14px;
      border-radius: 16px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: #ffffff;
      background: rgba(0, 0, 0, 0.5);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
    }
    .corner-live.on {
      color: #ff9f0a;
    }
  }
  /* A tablet on its side has more screen than a picture has pixels: the picture grows to the width of the screen,
     or to its height when it is the taller of the two, and never past either. */
  @media (orientation: landscape) and (min-width: 900px) {
    /* The other cameras come out in the middle of the band under the picture, kept off the screen's edge when
       there is no band; the line of time stays on the picture. */
    .camera-body .thumbs {
      bottom: max(40px, calc(var(--media-bottom, 0px) / 2));
      padding: 6px;
    }
    .camera-body.cameras-open .thumbs {
      transform: translate(-50%, 50%);
    }
    /* There they cover no button, so the buttons stay, the one of the line of time too, to put it away. */
    .camera-body:is(.line-open, .cameras-open) :is(.quick, .line-button) {
      visibility: visible;
    }
    /* The ring that turns the camera halfway down the picture, by its right edge. */
    .camera-body .ptz-overlay {
      top: calc((100% + var(--media-top, 0px) - var(--media-bottom, 0px)) / 2);
      bottom: auto;
      transform: translateY(-50%);
    }
    .camera-body .picture img,
    .camera-body .live-wrap .poster {
      width: 100vw;
      height: auto;
      max-width: 100vw;
      max-height: 100dvh;
      object-fit: contain;
    }
    .camera-body .no-picture {
      width: 100vw;
      max-height: 100dvh;
    }
  }
  /* A computer with a mouse: its window is wider than a tablet, so the picture would reach the top and the bottom
     and the header would lie on it. It keeps a band for the header above and one as tall below. */
  @media (orientation: landscape) and (min-width: 900px) and (hover: hover) and (pointer: fine) and (not (any-pointer: coarse)) {
    .camera-body .picture img,
    .camera-body .live-wrap .poster,
    .camera-body .no-picture {
      max-height: calc(100dvh - 144px);
    }
  }
`;
