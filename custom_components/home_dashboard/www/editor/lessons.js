// The lessons of the editor: the tasks a person new to it asks about first, the ones that go deeper, and the ones set
// up once (intercom, map, school, departures, news), each a short tour (tour.js) that goes where
// the task is done and frames one part at a time. A step can choose a node of the tree or open a part of a settings
// form first (`prepare`), and wait for the framed button to be clicked (`advance: "click"`). The list (⚙ → Lessons)
// marks the ones gone through; a lesson that needs something the dashboard has not got yet says what.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "../app/i18n.js";
import { dialogStyles } from "./publish.js";
import { findTarget, lessonsDone } from "./tour.js";

const SETTLE_MS = 200;

const choose = (key) => (app) => app?._selectKey?.(key);

// A part of a settings form unfolded and scrolled to, once the form of the node is drawn.
const chooseAndOpen = (key, section) => (app) => {
  if (!app?._selectKey?.(key)) return;
  setTimeout(() => {
    const part = findTarget(app.renderRoot, `[data-settings-section='${section}']`);
    if (part && !part.open) part.open = true;
    part?.scrollIntoView({ block: "start" });
  }, SETTLE_MS);
};

const statusBlock = (app) => (app?._strategy?.shortcuts ?? []).findIndex((shortcut) => shortcut?.kind === "overview");

// The newest block of a kind (the one a lesson just made, or the last there is); -1 for none.
const blockOf = (app, kind) => (app?._strategy?.shortcuts ?? []).map((shortcut) => shortcut?.kind).lastIndexOf(kind);
const hasBlock = (kind) => (app) => blockOf(app, kind) >= 0;
const noBlock = (kind) => (app) => blockOf(app, kind) < 0;
const chooseBlock = (kind, part = "") => (app) => {
  const index = blockOf(app, kind);
  if (index >= 0) app?._selectKey?.(`shortcuts/${index}${part}`);
};

// The first steps of a lesson on a block the dashboard has not got yet: + of Blocks, then its kind.
const makeBlock = (kind) => [
  { key: "add", targets: ["[data-add-block]"], side: "right", advance: "click", when: noBlock(kind), shared: "block_add" },
  { key: "kind", targets: [`[data-block-new='${kind}']`], side: "right", advance: "click", when: noBlock(kind), shared: "block_kind" },
];

/** What a lesson needs on the dashboard, and whether it has it. */
const NEEDS = {
  rooms: (app) => Boolean(app?._strategy?.layout?.length && app._strategy.layout[0].sections?.length),
  status: (app) => statusBlock(app) >= 0,
  tiles: (app) => Boolean(app?._strategy?.layout?.[0]?.sections?.[0]?.tiles?.length),
};

export const LESSONS = [
  {
    key: "add_tile",
    icon: "mdi:plus-box-outline",
    needs: "rooms",
    steps: [
      { key: "section", targets: ["[data-node='layout/0/sections/0']"], side: "right", prepare: choose("layout/0/sections/0") },
      { key: "type", targets: ["[data-add-tile]"], side: "left" },
      { key: "pick", targets: ["[data-action='pick']"], side: "left", advance: "click" },
      { key: "list", targets: ["home-dashboard-editor-picker >>> [data-picker-list]"], side: "right" },
      { key: "add", targets: ["home-dashboard-editor-picker >>> [data-picker-add]"], side: "left", advance: "click" },
      { key: "preview", targets: ["[data-stage]"], side: "inside" },
    ],
  },
  {
    key: "add_room",
    icon: "mdi:floor-plan",
    steps: [
      { key: "add", targets: ["[data-add-room]"], side: "right" },
      { key: "areas", targets: ["[data-generate]"], side: "right" },
      { key: "form", targets: ["[data-props]"], side: "left", prepare: choose("layout/0") },
      { key: "section", targets: ["[data-action='add_section']"], side: "left" },
    ],
  },
  {
    key: "home_page",
    icon: "mdi:home-heart",
    steps: [
      { key: "favourites", targets: ["[data-node='favorites']"], side: "right", prepare: choose("favorites") },
      { key: "rooms", targets: ["[data-node='layout/0/home']"], side: "right", prepare: choose("layout/0/home") },
      { key: "scenes", targets: ["[data-node='scenes']"], side: "right", prepare: choose("scenes") },
      { key: "layout", targets: ["[data-settings-section='page_layout']"], side: "left", prepare: chooseAndOpen("home_settings", "page_layout") },
    ],
  },
  {
    key: "order",
    icon: "mdi:swap-vertical",
    needs: "rooms",
    steps: [
      { key: "drag", targets: ["[data-node='layout/0/sections/0/tiles/0']"], side: "right", prepare: choose("layout/0/sections/0/tiles/0") },
      { key: "buttons", targets: ["[data-action='up']", "[data-action='down']"], side: "left" },
      { key: "rooms", targets: ["[data-props]"], side: "left", prepare: choose("room_order") },
    ],
  },
  {
    key: "add_block",
    icon: "mdi:view-grid-plus-outline",
    steps: [
      { key: "add", targets: ["[data-add-block]"], side: "right", advance: "click" },
      { key: "kinds", targets: ["[data-block-kinds]"], side: "right" },
      { key: "look", targets: ["[data-settings-section='chips']"], side: "left", prepare: chooseAndOpen("appearance", "chips") },
    ],
  },
  {
    key: "lights",
    icon: "mdi:lightbulb-group-outline",
    steps: [
      { key: "groups", targets: ["[data-settings-section='lights']"], side: "left", prepare: chooseAndOpen("lights", "lights") },
      { key: "skip", targets: ["[data-props]"], side: "left", prepare: choose("entities") },
      { key: "ignore", targets: ["[data-schema-add='.ignore']"], side: "left", prepare: chooseAndOpen("status_panel", "facts") },
    ],
  },
  {
    key: "background",
    icon: "mdi:image-filter-hdr",
    steps: [
      { key: "themes", targets: ["[data-settings-section='themes']"], side: "left", prepare: chooseAndOpen("appearance", "themes") },
      { key: "page", targets: ["[data-schema-add='.backgrounds']"], side: "left" },
      { key: "maker", targets: ["[data-schema-maker]"], fallback: ["[data-schema-add='.backgrounds']"], side: "left" },
    ],
  },
  {
    key: "warnings",
    icon: "mdi:alert-decagram-outline",
    needs: "status",
    steps: [
      {
        key: "block",
        targets: (app) => [`[data-node='shortcuts/${statusBlock(app)}']`],
        side: "right",
        prepare: (app) => app?._selectKey?.(`shortcuts/${statusBlock(app)}`),
      },
      { key: "items", targets: ["[data-props]"], side: "left" },
      { key: "home", targets: ["[data-stage]"], side: "inside" },
    ],
  },
  {
    key: "status_bar",
    icon: "mdi:dock-left",
    steps: [
      { key: "parts", targets: ["[data-settings-section='look']"], side: "left", prepare: chooseAndOpen("status_panel", "look") },
      { key: "calendar", targets: ["[data-settings-section='calendar']"], side: "left", prepare: chooseAndOpen("status_panel", "calendar") },
      { key: "facts", targets: ["[data-settings-section='facts']"], side: "left", prepare: chooseAndOpen("status_panel", "facts") },
      { key: "battery", targets: ["[data-props]"], side: "left", prepare: choose("known_devices") },
    ],
  },
  {
    key: "publish",
    icon: "mdi:cloud-upload-outline",
    steps: [
      { key: "as", targets: ["[data-as]"], side: "below" },
      { key: "access", targets: ["[data-props]"], side: "left", prepare: choose("access") },
      { key: "publish", targets: ["[data-publish]"], side: "below-end", advance: "click" },
      { key: "review", targets: ["[data-publish-review]"], fallback: ["[data-publish]"], side: "below-end" },
    ],
  },
  {
    key: "tile_form",
    icon: "mdi:card-text-outline",
    needs: "tiles",
    steps: [
      { key: "name", targets: ["[data-field='name']", "[data-field='icon']"], side: "left", prepare: choose("layout/0/sections/0/tiles/0") },
      { key: "size", targets: ["[data-field='size']"], side: "left" },
      { key: "behaviour", targets: ["[data-field='calm']", "[data-field='tap_toggle']", "[data-field='active_only']", "[data-field='turn_on_only']"], side: "left" },
      { key: "window", targets: ["[data-device-window]"], side: "left" },
      { key: "block", targets: ["[data-tile-to-block]"], side: "left" },
    ],
  },
  {
    key: "tile_colours",
    icon: "mdi:palette-swatch-outline",
    steps: [
      { key: "tiles", targets: ["[data-settings-section='tiles']"], side: "left", prepare: chooseAndOpen("appearance", "tiles") },
      { key: "text", targets: ["[data-settings-section='text']"], side: "left", prepare: chooseAndOpen("appearance", "text") },
      { key: "badges", targets: ["[data-settings-section='badges']"], side: "left", prepare: chooseAndOpen("appearance", "badges") },
      { key: "preview", targets: ["[data-stage]"], side: "inside" },
    ],
  },
  {
    key: "entities",
    icon: "mdi:rename-outline",
    steps: [
      { key: "overrides", targets: ["[data-schema-field='.overrides']"], side: "left", prepare: chooseAndOpen("entities", "entities") },
      { key: "exclude", targets: ["[data-schema-field='.exclude']"], side: "left" },
      { key: "include", targets: ["[data-schema-field='.include']"], side: "left" },
    ],
  },
  {
    key: "variants",
    icon: "mdi:layers-outline",
    steps: [
      { key: "cards", targets: ["[data-variant-cards]"], side: "left", prepare: choose("variants/home") },
      { key: "new", targets: ["[data-variant-new]"], side: "left" },
      { key: "where", targets: ["[data-variants-overview]"], side: "left" },
      { key: "devices", targets: ["[data-props]"], side: "left", prepare: choose("known_devices") },
    ],
  },
  {
    key: "cameras",
    icon: "mdi:cctv",
    steps: [
      { key: "order", targets: ["[data-schema-field='.order']", "[data-schema-field='.hide']"], side: "left", prepare: chooseAndOpen("cameras", "shown") },
      { key: "hero", targets: ["[data-schema-field='.hero']", "[data-schema-field='.tiles']"], side: "left" },
      { key: "privacy", targets: ["[data-settings-section='privacy']"], side: "left", prepare: chooseAndOpen("cameras", "privacy") },
      { key: "single", targets: ["[data-settings-section='single']"], side: "left", prepare: chooseAndOpen("cameras", "single") },
    ],
  },
  {
    key: "media",
    icon: "mdi:speaker-multiple",
    steps: [
      { key: "speakers", targets: ["[data-schema-field='.group_patterns']"], side: "left", prepare: chooseAndOpen("media", "media") },
      { key: "sections", targets: ["[data-schema-field='.sections']"], side: "left" },
      { key: "music", targets: ["[data-props]"], side: "left", prepare: choose("music") },
    ],
  },
  {
    key: "energy",
    icon: "mdi:lightning-bolt-outline",
    steps: [
      { key: "phases", targets: ["[data-schema-field='.phases']"], side: "left", prepare: chooseAndOpen("energy", "energy") },
      { key: "storage", targets: ["[data-schema-field='.storage']"], side: "left" },
      { key: "power", targets: ["[data-schema-add='.power']"], side: "left", prepare: chooseAndOpen("status_panel", "facts") },
    ],
  },
  {
    key: "menu_nav",
    icon: "mdi:menu",
    steps: [
      { key: "menu", targets: ["[data-schema-field='.groups']"], side: "left", prepare: chooseAndOpen("menu", "menu") },
      { key: "items", targets: ["[data-schema-field='.items']"], side: "left", prepare: chooseAndOpen("nav", "nav") },
      { key: "style", targets: ["[data-schema-field='.style']"], side: "left" },
    ],
  },
  {
    key: "history",
    icon: "mdi:history",
    steps: [
      { key: "undo", targets: ["[data-undo]", "[data-redo]"], side: "below" },
      { key: "open", targets: ["[data-history]"], side: "below-end", advance: "click" },
      { key: "versions", targets: ["home-dashboard-editor-history >>> [data-versions]"], side: "right" },
      { key: "restore", targets: ["home-dashboard-editor-history >>> [data-restore]"], fallback: ["home-dashboard-editor-history >>> [data-versions]"], side: "right" },
    ],
  },
  {
    key: "yaml",
    icon: "mdi:code-braces",
    needs: "tiles",
    steps: [
      { key: "part", targets: ["[data-tab='yaml']"], side: "left", prepare: choose("layout/0/sections/0") },
      { key: "whole", targets: ["[data-whole-yaml]"], side: "below", advance: "click" },
      { key: "edit", targets: ["[data-yaml]"], side: "left" },
      { key: "search", targets: ["[data-search]"], side: "right", prepare: (app) => app?._whole && app.renderRoot.querySelector("[data-whole-yaml]")?.click() },
    ],
  },
  {
    key: "device_block",
    icon: "mdi:view-dashboard-edit-outline",
    steps: [
      ...makeBlock("panel"),
      { key: "main", targets: ["[data-field='entity']", "[data-field='status']"], side: "left", prepare: chooseBlock("panel") },
      { key: "lit", targets: ["[data-field='active']", "[data-field='active_state']", "[data-field='labels']"], side: "left" },
      { key: "stats", targets: ["[data-add-part]"], side: "left", prepare: chooseBlock("panel", "/stats") },
      { key: "actions", targets: ["[data-add-part]"], side: "left", prepare: chooseBlock("panel", "/actions") },
      { key: "groups", targets: ["[data-action='add_group']"], side: "left", prepare: chooseBlock("panel", "/groups") },
      { key: "tile", targets: ["[data-field='shortcut']"], fallback: ["[data-node='layout']", "[data-tree]"], side: "left", prepare: choose("layout/0/sections/0/tiles/0") },
    ],
  },
  {
    key: "intercom",
    icon: "mdi:account-voice",
    steps: [
      { key: "script", targets: ["[data-schema-field='.script']"], side: "left", prepare: chooseAndOpen("intercom", "intercom") },
      { key: "areas", targets: ["[data-schema-field='.areas']"], side: "left" },
      { key: "fields", targets: ["[data-schema-field='.areas_field']", "[data-schema-field='.text_field']", "[data-schema-field='.file_field']"], side: "left" },
      { key: "upload", targets: ["[data-schema-field='.upload']", "[data-schema-field='.media_folder']"], side: "left" },
    ],
  },
  {
    key: "map",
    icon: "mdi:map-outline",
    steps: [
      { key: "track", targets: ["[data-schema-field='.track']"], side: "left", prepare: chooseAndOpen("map", "map") },
      { key: "look", targets: ["[data-settings-section='map']"], side: "left", prepare: chooseAndOpen("appearance", "map") },
      { key: "bar", targets: ["[data-schema-field='.items']"], side: "left", prepare: chooseAndOpen("nav", "nav") },
    ],
  },
  {
    key: "school",
    icon: "mdi:school-outline",
    steps: [
      ...makeBlock("school"),
      { key: "children", targets: ["[data-schema-field='.children']"], side: "left", prepare: chooseBlock("school") },
      { key: "sources", targets: ["[data-schema-field='.sources']"], side: "left" },
      { key: "hidden", targets: ["[data-schema-field='.hidden_when']"], side: "left" },
    ],
  },
  {
    key: "departures",
    icon: "mdi:tram",
    steps: [
      ...makeBlock("departures"),
      { key: "entities", targets: ["[data-schema-field='.entities']"], side: "left", prepare: chooseBlock("departures") },
      { key: "colours", targets: ["[data-schema-field='.colors']"], side: "left" },
      { key: "news", targets: ["[data-schema-field='.news']"], side: "left" },
      { key: "tablet", targets: ["[data-settings-section='look']"], side: "left", prepare: chooseAndOpen("status_panel", "look") },
    ],
  },
  {
    key: "text",
    icon: "mdi:text-box-outline",
    steps: [
      ...makeBlock("text"),
      { key: "sections", targets: ["[data-schema-field='.sections']"], side: "left", prepare: chooseBlock("text") },
      { key: "heading", targets: ["[data-schema-field='.heading']", "[data-schema-field='.label_entity']"], side: "left" },
      { key: "speaker", targets: ["[data-schema-field='.speaker']", "[data-schema-field='.script']"], side: "left" },
      { key: "badge", targets: ["[data-stage]"], side: "inside" },
    ],
  },
  {
    key: "news",
    icon: "mdi:newspaper-variant-outline",
    steps: [
      ...makeBlock("news"),
      { key: "sections", targets: ["[data-schema-field='.sections']"], side: "left", prepare: chooseBlock("news") },
      { key: "label", targets: ["[data-schema-field='.label']", "[data-schema-field='.tone']"], side: "left" },
      { key: "hidden", targets: ["[data-schema-field='.hidden_when']"], side: "left" },
    ],
  },
];

// The list in three parts: the first ten lessons are the start, the next ten go further, the rest is set up once.
export const FIRST_LESSONS = 10;
export const MORE_LESSONS = 20;

/** The text keys of a lesson's step: its own, or those it shares with other lessons. */
export const stepTextKey = (lesson, step) => (step.shared ? `lesson_${step.shared}` : `lesson_${lesson.key}_${step.key}`);

// The lesson for a part of the editor: by the node chosen in the tree (a block by its kind), for the "?" of the form.
const NODE_LESSONS = [
  [/^layout\/\d+\/sections\/\d+\/tiles\/\d+$/, "tile_form"],
  [/^layout\/\d+\/sections\/\d+$/, "add_tile"],
  [/^layout\/\d+\/home/, "home_page"],
  [/^layout\/\d+$/, "add_room"],
  [/^(favorites|scenes|home_settings)(\/|$)/, "home_page"],
  [/^room_order$/, "order"],
  [/^appearance$/, "background"],
  [/^lights$/, "lights"],
  [/^status_panel$/, "status_bar"],
  [/^cameras$/, "cameras"],
  [/^(media|music)$/, "media"],
  [/^energy$/, "energy"],
  [/^(menu|nav)$/, "menu_nav"],
  [/^entities$/, "entities"],
  [/^access$/, "publish"],
  [/^(variants\/|known_devices$)/, "variants"],
  [/^intercom$/, "intercom"],
  [/^map$/, "map"],
];
const BLOCK_LESSONS = { panel: "device_block", overview: "warnings", school: "school", departures: "departures", news: "news", text: "text" };

export function lessonFor(key, strategy) {
  if (!key) return null;
  const block = key.match(/^shortcuts\/(\d+)/);
  const found = block
    ? BLOCK_LESSONS[strategy?.shortcuts?.[Number(block[1])]?.kind]
    : NODE_LESSONS.find(([pattern]) => pattern.test(key))?.[1];
  return LESSONS.find((lesson) => lesson.key === found) ?? null;
}

/** Whether a lesson can run on this dashboard: what it needs is there. */
export const lessonReady = (lesson, app) => !lesson.needs || NEEDS[lesson.needs](app);

export class HomeDashboardEditorLessons extends LitElement {
  static properties = {
    hass: { attribute: false },
    app: { attribute: false },
  };

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  render() {
    if (!this.hass) return nothing;
    const done = lessonsDone();
    return html`
      <div class="scrim" @click=${() => this.dispatchEvent(new CustomEvent("dialog-close"))}></div>
      <section class="dialog lessons" role="dialog" aria-label=${this._t("lessons_title")} data-lessons-dialog>
        <header>
          <ha-icon icon="mdi:school-outline"></ha-icon>
          <h2>${this._t("lessons_title")}</h2>
          <span class="grow"></span>
          <button class="ghost" data-dialog-close aria-label=${this._t("close")}
            @click=${() => this.dispatchEvent(new CustomEvent("dialog-close"))}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </header>
        <p class="lead">${this._t("lessons_lead")}</p>
        ${[
          ["lessons_start", LESSONS.slice(0, FIRST_LESSONS)],
          ["lessons_more", LESSONS.slice(FIRST_LESSONS, MORE_LESSONS)],
          ["lessons_once", LESSONS.slice(MORE_LESSONS)],
        ].map(
          ([heading, lessons]) => html`<h3 class="group" data-lessons-group=${heading}>${this._t(heading)}</h3>
        <div class="grid">
          ${lessons.map((lesson) => {
            const ready = lessonReady(lesson, this.app);
            return html`<button class="lesson ${done.includes(lesson.key) ? "done" : ""}" data-lesson=${lesson.key}
              ?disabled=${!ready}
              @click=${() => this.dispatchEvent(new CustomEvent("lesson-start", { detail: { key: lesson.key } }))}>
              <ha-icon .icon=${lesson.icon}></ha-icon>
              <span class="text">
                <strong>${this._t(`lesson_${lesson.key}_name`)}</strong>
                <small>${ready ? this._t(`lesson_${lesson.key}_about`) : this._t(`lessons_needs_${lesson.needs}`)}</small>
              </span>
              <span class="meta">${done.includes(lesson.key)
                ? html`<ha-icon class="tick" icon="mdi:check-circle" data-lesson-done></ha-icon>`
                : this._t("lessons_steps", { count: lesson.steps.length })}</span>
            </button>`;
          })}
        </div>`,
        )}
        <footer>
          <span class="hint">${this._t("lessons_hint")}</span>
        </footer>
      </section>
    `;
  }

  static styles = [
    dialogStyles,
    css`
      .dialog.lessons {
        width: min(860px, calc(100vw - 48px));
      }
      header ha-icon {
        --mdc-icon-size: 20px;
      }
      .lead {
        margin: 14px 18px 4px;
        color: var(--muted);
      }
      .dialog.lessons {
        overflow: auto;
      }
      .group {
        margin: 12px 18px 0;
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 10px;
        padding: 8px 18px 12px;
      }
      .lesson {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border: 1px solid var(--line);
        border-radius: 12px;
        cursor: pointer;
      }
      .lesson:hover:not([disabled]) {
        border-color: var(--accent);
      }
      .lesson[disabled] {
        opacity: 0.55;
        cursor: default;
      }
      .lesson > ha-icon {
        --mdc-icon-size: 22px;
        flex: none;
        color: var(--accent);
      }
      .lesson.done > ha-icon {
        color: #1f9d55;
      }
      .text {
        flex: 1;
        min-width: 0;
      }
      .text strong {
        display: block;
      }
      .text small {
        display: block;
        color: var(--muted);
      }
      .meta {
        flex: none;
        color: var(--muted);
        font-size: 12px;
      }
      .tick {
        --mdc-icon-size: 20px;
        color: #1f9d55;
      }
    `,
  ];
}

if (!customElements.get("home-dashboard-editor-lessons")) customElements.define("home-dashboard-editor-lessons", HomeDashboardEditorLessons);
