// The editor of a dashboard on a computer. Three columns: the tree of the dashboard, the preview and the properties
// of what is chosen. Every change goes to a draft kept on the server, which changes nothing on the devices of the
// home until it is published.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { PanelMenu } from "../app/ha-menu.js";
import { translate } from "../app/i18n.js";
import { renameBlockEverywhere } from "../app/model.js";
import { buildTree, dropPlan, filterTree, flatten, getAt, insertAt, isRoomSection, movedPath, moveItem, removeAt, setAt } from "./tree.js";
import { slugify } from "./props.js";
import "./picker.js";
import { SETTINGS_FORMS } from "./settings-form.js";
import "./publish.js";
import "./generate-dialog.js";
import { tourSeen } from "./tour.js";
import { LESSONS, lessonFor, lessonReady } from "./lessons.js";
import "./quick-start-dialog.js";
import { withQuickStart } from "./quick-start.js";

// The documentation site and the guide's address live in docs-anchors.js (the dialogs need them too).
export { DOCS_SITE, editorDocsUrl } from "./docs-anchors.js";
import { withGeneratedRooms } from "./generate.js";
import { roomAreas } from "./picker-model.js";
import {
  addBlockRow,
  blockPathOf,
  deviceLeftovers,
  groupIndexOf,
  tileAsBlock,
  withEntityCard,
  withNewBlock,
} from "./block-model.js";
import { NEW_BLOCK_ICONS } from "../app/block-editor.js";
import { highlightSpec } from "./highlight.js";
import { deviceCatalog, deviceList, readDevicePrefs, shownModel, writeDevicePrefs } from "./devices.js";
import "./devices.js";
import { mediaQuery } from "../app/media.js";
import { readStored, writeStored } from "../app/stored.js";
import { escapeInside, isEscape } from "../app/escape.js";
import { addressKey, writeAddress } from "./address.js";
import { RAIL, foldShortcut, readFolded, writeFolded } from "./columns.js";
import { DOCS_ANCHORS, docsAnchorFor, editorDocsUrl } from "./docs-anchors.js";
import { callWS } from "./ws.js";
import "./variants-panel.js";
import { ASK_EVENT } from "./ask-dialog.js";
import { sliceOf, withSlice } from "../app/variants.js";

// How long the window of a block gets to open and settle in a frame before it is measured.
const FIT_MEASURE_MS = 700;

// Steps that can be undone; typing in one field within this time is one step, not one per letter.
export const UNDO_LIMIT = 200;
const COALESCE_MS = 1500;

const APP_TAG = "home-dashboard-editor-app";
const DOMAIN = "home_dashboard";
// A draft is kept this long after the last change, so typing does not send every letter.
export const DRAFT_SAVE_MS = 800;
// Home Assistant hands the editor a new hass on every change of a state in the house, many times a second. The editor
// is drawn at once for what it lists (entities, devices, areas, the language, the look), and for states alone at most
// this often (ms). Tests set it to 0.
export const EDITOR_TIMING = { states: 5000 };
const HASS_KEYS = ["entities", "devices", "areas", "floors", "language", "locale", "user", "themes", "selectedTheme"];
const COLLAPSED_KEY = "home-dashboard-editor-collapsed";
const THEME_KEY = "home-dashboard-editor-theme";
// The look of the editor (not of the preview, which has its own Light and Dark): as Home Assistant, or chosen here.
export const THEMES = ["auto", "light", "dark"];
const THEME_ICONS = { auto: "mdi:theme-light-dark", light: "mdi:weather-sunny", dark: "mdi:weather-night" };
const LANGUAGE_KEY = "home-dashboard-editor-language";
// The language of the editor: as Home Assistant (the person's profile), or chosen under ⚙ for this browser.
export const EDITOR_LANGUAGES = ["auto", "pl", "en"];
const LANGUAGE_NAMES = { pl: "Polski", en: "English" };

/** Home Assistant's hass with the editor's own language, when one is chosen; the same object otherwise. */
export function withLanguage(hass, language) {
  if (!hass || !language || language === "auto" || hass.language === language) return hass;
  return { ...hass, language };
}

/** The look to show: the chosen one, or Home Assistant's (its dark mode, else the system's). */
export function editorTheme(chosen, hass, prefersDark = mediaQuery("(prefers-color-scheme: dark)").matches) {
  if (chosen === "light" || chosen === "dark") return chosen;
  return (hass?.themes?.darkMode ?? prefersDark) ? "dark" : "light";
}
const PREVIEW_KEY = "home-dashboard-editor-preview";
// The phones a preview can stand for: one entry for each size of screen in points (upright), with the models of
// that size; models of the same size look the same, so they share an entry.
export const PHONES = {
  se1: { width: 320, height: 568, label: "iPhone SE 1, 5s · 320 × 568" },
  "8": { width: 375, height: 667, label: "iPhone SE 2–3, 6, 7, 8 · 375 × 667" },
  "8plus": { width: 414, height: 736, label: "iPhone 6 Plus, 7 Plus, 8 Plus · 414 × 736" },
  x: { width: 375, height: 812, label: "iPhone X, XS, 11 Pro, 12 mini, 13 mini · 375 × 812" },
  "11": { width: 414, height: 896, label: "iPhone XR, XS Max, 11, 11 Pro Max · 414 × 896" },
  "12": { width: 390, height: 844, label: "iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e · 390 × 844" },
  "12promax": { width: 428, height: 926, label: "iPhone 12 Pro Max, 13 Pro Max, 14 Plus · 428 × 926" },
  "15": { width: 393, height: 852, label: "iPhone 14 Pro, 15, 15 Pro, 16 · 393 × 852" },
  "15plus": { width: 430, height: 932, label: "iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus · 430 × 932" },
  "16pro": { width: 402, height: 874, label: "iPhone 16 Pro, 17, 17 Pro · 402 × 874" },
  air: { width: 420, height: 912, label: "iPhone Air · 420 × 912" },
  "16promax": { width: 440, height: 956, label: "iPhone 16 Pro Max, 17 Pro Max · 440 × 956" },
};
// The tablets, the same way, on their side.
export const TABLETS = {
  ipad: { width: 1024, height: 768, label: "iPad 1–6, iPad mini 2–5, iPad Air 1–2, iPad Pro 9.7″ · 1024 × 768" },
  ipad102: { width: 1080, height: 810, label: "iPad 7–9 (10.2″) · 1080 × 810" },
  air3: { width: 1112, height: 834, label: "iPad Air 3, iPad Pro 10.5″ · 1112 × 834" },
  mini: { width: 1133, height: 744, label: "iPad mini 6–7 · 1133 × 744" },
  air: { width: 1180, height: 820, label: "iPad Air 4+ (11″), iPad 10–11 · 1180 × 820" },
  pro11: { width: 1194, height: 834, label: "iPad Pro 11″ 1–4 · 1194 × 834" },
  pro11m4: { width: 1210, height: 834, label: "iPad Pro 11″ M4+ · 1210 × 834" },
  pro129: { width: 1366, height: 1024, label: "iPad Pro 12.9″, iPad Air 13″ · 1366 × 1024" },
  pro13: { width: 1376, height: 1032, label: "iPad Pro 13″ M4+ · 1376 × 1032" },
};
// The screens the preview starts with, as the dashboard is built for them.
export const DEVICES = { phone: PHONES["16pro"], tablet: TABLETS.air };
// The zoom of a page in the Home Assistant app (Settings → Companion app → General → Zoom): at 85 % an iPad Air
// shows the dashboard as a page of 1388 × 965, so the preview does the same.
export const ZOOMS = [50, 67, 75, 80, 85, 90, 100, 110, 125, 150];

/**
 * The page a device shows, as the preview draws it: the screen of the device (the tablet chosen), made larger by a
 * zoom below 100 % and smaller above it, as the app does.
 */
export function deviceSize(key, model = undefined, zoom = 100, catalog = null) {
  // The devices a person keeps (see devices.js), else the built-in ones.
  const list = catalog?.[key] ?? (key === "tablet" ? TABLETS : PHONES);
  const screen = list[model] ?? list[key === "tablet" ? "air" : "16pro"] ?? Object.values(list)[0] ?? DEVICES[key];
  const factor = 100 / (ZOOMS.includes(zoom) ? zoom : 100);
  return {
    width: Math.round(screen.width * factor),
    height: Math.round(screen.height * factor),
    label: factor === 1 ? screen.label : `${screen.label} · ${zoom} % → ${Math.round(screen.width * factor)} × ${Math.round(screen.height * factor)}`,
  };
}
const WIDTHS_KEY = "home-dashboard-editor-widths";
const FOLDED_KEY = "home-dashboard-editor-folded";
// The page a block opens and the settings that hold what is on it.
const PAGE_SETTINGS = { media: "media", music: "music", map: "map", energy: "energy" };
// The side columns: their width when nothing was chosen, and how narrow and wide a drag can make them.
export const COLUMNS = { left: { start: 290, min: 220, max: 520 }, right: { start: 380, min: 300, max: 680 } };

/** A width a drag asked for, kept within what the column allows. */
export const columnWidth = (side, width) => Math.round(Math.min(COLUMNS[side].max, Math.max(COLUMNS[side].min, width)));
const STAGE_GAP = 28;
const STAGE_PADDING = 24;
const LABEL_HEIGHT = 28;
const FRAME_BORDER = 10;

/** Where a frame of the preview opens: the dashboard's own page, marked as the editor's preview. */
export function previewUrl(urlPath, page, { room, color, as } = {}) {
  const query = new URLSearchParams({ hd_preview: "1" });
  if (room) query.set("room", room);
  if (color && color !== "auto") query.set("hd_color", color);
  if (as) query.set("hd_as", as);
  return `/${urlPath}/${page}?${query}`;
}

/** The page of the preview for what is chosen in the tree: the room of a node in a room, else Home. */
export function previewPage(strategy, path) {
  if (path?.[0] === "layout" && Number.isInteger(path[1])) {
    const room = strategy.layout?.[path[1]];
    if (room) return { page: "room", room: room.id };
  }
  return { page: "home", room: null };
}

/** The scale that fits the chosen screens side by side into a stage of this size. */
export function stageScale(devices, width, height, tablet = "air", zoom = {}, phone = "16pro", catalog = null) {
  const shown = devices.map((key) => deviceSize(key, key === "tablet" ? tablet : phone, zoom[key], catalog));
  const wide = shown.reduce((sum, device) => sum + device.width + FRAME_BORDER * 2, 0) + STAGE_GAP * (shown.length - 1);
  const tall = Math.max(...shown.map((device) => device.height + FRAME_BORDER * 2)) + LABEL_HEIGHT;
  return Math.min(1, (width - STAGE_PADDING * 2) / wide, (height - STAGE_PADDING * 2) / tall);
}

/**
 * The node of the tree a touch in the preview chose: a tile by its section and entity (or name), a room, a block,
 * a section; a tile of Home is looked for in the rooms' Home lists, the favourites and the scenes.
 */
export function nodeForTarget(strategy, target) {
  const layout = strategy.layout ?? [];
  const roomIndex = layout.findIndex((room) => room.id === target.room);
  const sameTile = (tile) =>
    tile &&
    typeof tile === "object" &&
    ((target.entity && tile.entity === target.entity) || (target.name && (tile.name === target.name || tile.shortcut === target.name)));
  const inList = (path, list) => {
    const index = (list ?? []).findIndex(sameTile);
    return index >= 0 ? [...path, index] : null;
  };
  if (target.kind === "room") return roomIndex >= 0 ? ["layout", roomIndex] : null;
  if (target.kind === "block") {
    const index = (strategy.shortcuts ?? []).findIndex((block) => block.name === target.name);
    return index >= 0 ? ["shortcuts", index] : null;
  }
  const sectionIndex = /^section-(\d+)$/.exec(target.section ?? "")?.[1];
  if (roomIndex >= 0 && sectionIndex !== undefined) {
    const sectionPath = ["layout", roomIndex, "sections", Number(sectionIndex)];
    if (target.kind === "section" || target.kind === "status") return sectionPath;
    const found = inList([...sectionPath, "tiles"], layout[roomIndex].sections?.[sectionIndex]?.tiles);
    if (found) return found;
  }
  if (target.kind === "status" && roomIndex >= 0) return ["layout", roomIndex];
  if (target.kind !== "tile") return null;
  const rooms = roomIndex >= 0 ? [roomIndex, ...layout.keys()] : [...layout.keys()];
  for (const index of rooms) {
    const room = layout[index];
    const found =
      inList(["layout", index, "home"], room.home) ??
      (room.sections ?? []).map((section, at) => inList(["layout", index, "sections", at, "tiles"], section.tiles)).find(Boolean);
    if (found) return found;
  }
  const favorite = (strategy.favorites ?? []).indexOf(target.entity);
  if (favorite >= 0) return ["favorites", favorite];
  return inList(["scenes"], strategy.scenes);
}

/** The first element that matches, looking into every shadow root of a document. */
export function deepQuery(root, selector) {
  if (!root) return null;
  const found = root.querySelector(selector);
  if (found) return found;
  for (const element of root.querySelectorAll("*")) {
    const inner = element.shadowRoot && deepQuery(element.shadowRoot, selector);
    if (inner) return inner;
  }
  return null;
}

export function mountEditor(host, hass, panel, options = {}) {
  const app = document.createElement(APP_TAG);
  app.hass = hass;
  app.panel = panel;
  // Tests open the frames of the preview on a page of their own.
  if (options.previewUrl) app.previewUrl = options.previewUrl;
  host.appendChild(app);
  host._app = { updateHass: (next) => (app.hass = next) };
  return app;
}

// The dialogs of the editor: each closes on its own "dialog-close", as with its ✕.
const EDITOR_DIALOGS = [
  "home-dashboard-editor-devices",
  "home-dashboard-editor-publish",
  "home-dashboard-editor-generate",
  "home-dashboard-editor-history",
  "home-dashboard-editor-variant-access",
  "home-dashboard-editor-ask",
  "home-dashboard-editor-variant-overview",
].join(", ");

export class HomeDashboardEditorApp extends LitElement {
  static properties = {
    // Its own accessor below: the editor sees hass with the language chosen under ⚙.
    hass: { attribute: false, noAccessor: true },
    _gear: { state: true },
    _language: { state: true },
    panel: { attribute: false },
    _dashboards: { state: true },
    _theme: { state: true },
    _urlPath: { state: true },
    _live: { state: true },
    _liveHash: { state: true },
    _draft: { state: true },
    _base: { state: true },
    _saved: { state: true },
    _saving: { state: true },
    _selected: { state: true },
    _search: { state: true },
    _collapsed: { state: true },
    _yamlText: { state: true },
    _yamlError: { state: true },
    _whole: { state: true },
    _devicePrefs: { state: true },
    _notice: { state: true },
    _publishing: { state: true },
    _review: { state: true },
    _history: { state: true },
    _preview: { state: true },
    _users: { state: true },
    _scale: { state: true },
    _widths: { state: true },
    _folded: { state: true },
    _tab: { state: true },
    _past: { state: true },
    _future: { state: true },
    _dropKey: { state: true },
    _dropMode: { state: true },
    _picker: { state: true },
    _fit: { state: true },
    _dialog: { state: true },
    _help: { state: true },
    _blockMenu: { state: true },
    _cardError: { state: true },
    // A variant of a page being edited: its page, id, name and slice; the draft waits meanwhile.
    _variantEdit: { state: true },
    _variantAccess: { state: true },
    // A question of a part of the editor (ask-dialog.js), shown in the editor's look.
    _ask: { state: true },
    _overview: { state: true },
    // The tour of the editor (tour.js) over everything, or one of its lessons (lessons.js).
    _tour: { state: true },
    _lesson: { state: true },
  };

  constructor() {
    super();
    this._dashboards = null;
    this._search = "";
    this._selected = null;
    this._folded = readFolded(FOLDED_KEY);
    // The node named by the address (#/...), chosen once the dashboard has loaded.
    this._wanted = addressKey();
    this._whole = false;
    this._users = [];
    this._theme = THEMES.includes(readStored(THEME_KEY)) ? readStored(THEME_KEY) : "auto";
    this._language = EDITOR_LANGUAGES.includes(readStored(LANGUAGE_KEY)) ? readStored(LANGUAGE_KEY) : "auto";
    this._gear = false;
    this._tab = "form";
    this._past = [];
    this._future = [];
    try {
      const saved = JSON.parse(readStored(WIDTHS_KEY) ?? "{}");
      this._widths = {
        left: columnWidth("left", saved.left ?? COLUMNS.left.start),
        right: columnWidth("right", saved.right ?? COLUMNS.right.start),
      };
    } catch {
      this._widths = { left: COLUMNS.left.start, right: COLUMNS.right.start };
    }
    this._scale = 0.5;
    this._devicePrefs = readDevicePrefs();
    try {
      const saved = JSON.parse(readStored(PREVIEW_KEY) ?? "{}");
      this._preview = { devices: ["phone", "tablet"], color: "auto", as: "", tablet: "air", phone: "16pro", ...saved, zoom: { phone: 100, tablet: 100, ...saved.zoom } };
    } catch {
      this._preview = { devices: ["phone", "tablet"], color: "auto", as: "", tablet: "air", phone: "16pro", zoom: { phone: 100, tablet: 100 } };
    }
    // What the frames of the preview read: the draft, those who listen to it, and what a touch in them chose.
    this._source = { strategy: null, listeners: new Set(), commands: new Set(), select: (target) => this._selectTarget(target) };
    this._fit = {};
    try {
      this._collapsed = new Set(JSON.parse(readStored(COLLAPSED_KEY) ?? "[]"));
    } catch {
      this._collapsed = new Set();
    }
  }

  set hass(value) {
    const old = this._shownHass;
    this._hassFromHa = value;
    this._shownHass = withLanguage(value, this._language);
    this.requestUpdate("hass", old);
  }

  get hass() {
    return this._shownHass;
  }

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  connectedCallback() {
    super.connectedCallback();
    window.homeDashboardPreview = this._source;
    window.addEventListener("keydown", this._onKey);
    window.addEventListener("click", this._onOutside);
    this.addEventListener(ASK_EVENT, this._onAsk);
    this._menu.connect();
  }

  _onAsk = (event) => {
    event.preventDefault();
    this._ask?.resolve(null);
    this._ask = event.detail;
  };

  _closeAsk() {
    this._ask?.resolve(null);
    this._ask = null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._statesTimer);
    this._statesTimer = null;
    window.removeEventListener("keydown", this._onKey);
    window.removeEventListener("click", this._onOutside);
    this._menu.disconnect();
    this._stageWatch?.disconnect();
    if (window.homeDashboardPreview === this._source) delete window.homeDashboardPreview;
  }

  async firstUpdated() {
    this._yaml = await import("../vendor/js-yaml.js");
    callWS(this.hass, { type: "config/auth/list" })
      .then((users) => {
        this._users = (users ?? []).filter((user) => user.is_active !== false && !user.system_generated);
      })
      .catch(() => {});
    const { dashboards } = await callWS(this.hass, { type: `${DOMAIN}/editor/dashboards` });
    this._dashboards = dashboards;
    const wanted = new URLSearchParams(window.location.search).get("dashboard");
    const first = dashboards.find((item) => item.url_path === wanted) ?? dashboards[0];
    if (first) await this._load(first.url_path);
    // The first time the editor opens in this browser it shows itself round, once there is a dashboard to show.
    if (first && !tourSeen() && !this._dialog) this._tour = true;
  }

  async _load(urlPath) {
    const loaded = await callWS(this.hass, { type: `${DOMAIN}/editor/load`, url_path: urlPath });
    this._urlPath = urlPath;
    this._live = loaded.live;
    this._liveHash = loaded.live_hash;
    this._draft = loaded.draft?.config ?? null;
    this._base = loaded.draft?.base ?? loaded.live_hash;
    this._saved = loaded.draft?.updated_at ?? null;
    this._review = loaded.review;
    this._history = loaded.history;
    this._variantEdit = null;
    this._select(null);
    this._publishDraft();
    this._followAddress();
  }

  /** Choose a node of the tree by its key (unfolded on the way and scrolled to); false when there is none. */
  _selectKey(key) {
    const node = flatten(buildTree(this._strategy, this.hass, this.hass.language)).find((item) => item.key === key);
    if (!node) return false;
    if (node.path) this._unfoldTo(node.path);
    this._select(node);
    this.updateComplete.then(() =>
      this.renderRoot.querySelector(`[data-node="${CSS.escape(key)}"]`)?.scrollIntoView({ block: "nearest" }),
    );
    return true;
  }

  /** Choose the node the address named when the editor opened, now that its state is here. */
  _followAddress() {
    const key = this._wanted;
    this._wanted = null;
    if (!key) return;
    const node = flatten(buildTree(this._strategy, this.hass, this.hass.language)).find((item) => item.key === key);
    // A node that is gone: the address names nothing any more.
    if (!node) return writeAddress(this._selected?.key ?? null);
    if (node.path) this._unfoldTo(node.path);
    this._select(node);
  }

  /**
   * Start from nothing: a dashboard of this strategy is made in Home Assistant (as Settings → Dashboards would) and
   * the generator of rooms opens on it.
   */
  async _createDashboard() {
    this._creating = true;
    this.requestUpdate();
    try {
      const taken = new Set((await callWS(this.hass, { type: "lovelace/dashboards/list" }).catch(() => [])).map((item) => item.url_path));
      let urlPath = "home-dashboard";
      for (let n = 2; taken.has(urlPath); n += 1) urlPath = `home-dashboard-${n}`;
      await callWS(this.hass, {
        type: "lovelace/dashboards/create",
        url_path: urlPath,
        title: "Home Dashboard",
        icon: "mdi:home",
        mode: "storage",
        show_in_sidebar: true,
        require_admin: false,
      });
      await callWS(this.hass, { type: "lovelace/config/save", url_path: urlPath, config: { strategy: { type: "custom:home-dashboard" } } });
      const { dashboards } = await callWS(this.hass, { type: `${DOMAIN}/editor/dashboards` });
      this._dashboards = dashboards;
      await this._load(urlPath);
      this._dialog = "quick";
    } catch (error) {
      this._notice = { kind: "error", text: error?.message ?? String(error) };
    } finally {
      this._creating = false;
      this.requestUpdate();
    }
  }

  /** The frames follow the draft at once, before it is saved. */
  _publishDraft() {
    this._source.strategy = this._strategy;
    for (const listener of this._source.listeners) listener(this._strategy);
  }

  /** What is edited: the draft, or the live configuration until the first change. */
  get _config() {
    // A variant is the published configuration with its page's part from the variant: what its devices show.
    if (this._variantEdit) {
      const { page, slice } = this._variantEdit;
      const base = this._draft ?? this._live ?? {};
      return { ...base, strategy: withSlice(base.strategy ?? {}, page, slice) };
    }
    return this._draft ?? this._live ?? {};
  }

  get _strategy() {
    return this._config.strategy ?? {};
  }

  // Changes -----------------------------------------------------------------------------------------

  /**
   * Change the strategy as one step that can be undone; changes with the same `coalesce` key in quick succession
   * (letters typed in one field) are one step. The draft is saved a moment after the last change.
   */
  _change(strategy, coalesce = null) {
    const now = Date.now();
    const joined = coalesce && this._lastStep?.coalesce === coalesce && now - this._lastStep.at < COALESCE_MS;
    if (!joined) this._past = [...this._past, this._strategy].slice(-UNDO_LIMIT);
    this._future = [];
    this._lastStep = { coalesce, at: now };
    this._apply(strategy);
  }

  _apply(strategy) {
    if (this._variantEdit) return this._applyVariant(strategy);
    this._draft = { ...this._config, strategy };
    this._publishDraft();
    this._saving = true;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveDraft(), DRAFT_SAVE_MS);
  }

  _undo() {
    if (!this._past.length) return;
    const previous = this._past.at(-1);
    this._past = this._past.slice(0, -1);
    this._future = [this._strategy, ...this._future];
    this._lastStep = null;
    this._apply(previous);
    this._keepSelection();
  }

  _redo() {
    if (!this._future.length) return;
    const [next, ...rest] = this._future;
    this._future = rest;
    this._past = [...this._past, this._strategy];
    this._lastStep = null;
    this._apply(next);
    this._keepSelection();
  }

  /** After an undo the chosen node may be gone: then nothing is chosen. */
  _keepSelection() {
    this._yamlText = null;
    if (this._selected?.path && getAt(this._strategy, this._selected.path) === undefined) this._select(null);
  }

  // ⌘Z / Ctrl+Z undoes, ⇧⌘Z / Ctrl+Y redoes; inside a field the field keeps its own undo.
  _onKey = (event) => {
    if (event.key === "Escape" && this._gear) {
      this._gear = false;
      return;
    }
    if (event.key === "Escape" && this._help) {
      this._help = null;
      return;
    }
    if (isEscape(event) && this._escape()) {
      event.preventDefault();
      return;
    }
    // Ctrl/⌘+B folds the left column, Ctrl/⌘+Alt+B the right one, also while typing in a field.
    const column = foldShortcut(event);
    if (column) {
      event.preventDefault();
      this._toggleColumn(column);
      return;
    }
    const field = event.composedPath()[0];
    if (field?.matches?.("input, textarea, select")) return;
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) this._undo();
    else if ((key === "z" && event.shiftKey) || key === "y") this._redo();
    else return;
    event.preventDefault();
  };

  /** Esc closes one thing, the innermost first: a picture shown big, the block picker, an open dialog (as its ✕). */
  _escape() {
    if (escapeInside(this.renderRoot)) return true;
    if (this._picker) {
      this._closePicker();
      return true;
    }
    const dialog = this.renderRoot.querySelector(EDITOR_DIALOGS);
    if (!dialog) return false;
    dialog.dispatchEvent(new CustomEvent("dialog-close"));
    return true;
  }

  // Structure ---------------------------------------------------------------------------------------

  /** The tree unfolded on the way to a node: its parents and the group it is in. */
  _unfoldTo(path) {
    const key = path.join("/");
    const groups = buildTree(this._strategy, this.hass, this.hass.language);
    const unfolded = new Set(this._collapsed);
    for (let length = 1; length < path.length; length += 1) unfolded.delete(path.slice(0, length).join("/"));
    const group = groups.find((item) => flatten(item.children ?? []).some((node) => node.key === key));
    if (group) unfolded.delete(group.key);
    this._collapsed = unfolded;
  }

  /** Choose the node at a path, as the tree has it after a change. */
  _selectPath(path) {
    const key = path.join("/");
    const node = flatten(buildTree(this._strategy, this.hass, this.hass.language)).find((item) => item.key === key);
    this._unfoldTo(path);
    if (node) this._select(node);
  }

  _addRoom() {
    const used = new Set((this._strategy.layout ?? []).map((room) => room.id));
    const name = this._t("editor_new_room");
    let id = slugify(name);
    for (let n = 2; used.has(id); n += 1) id = `${slugify(name)}_${n}`;
    const layout = this._strategy.layout ?? [];
    this._change(insertAt(this._strategy, ["layout"], layout.length, { id, name, sections: [] }));
    this._selectPath(["layout", layout.length]);
  }

  /** A new block of a kind among the blocks, chosen at once to be filled in. */
  _addBlock(kind) {
    const added = withNewBlock(this._strategy, kind, this._t(`block_kind_${kind}`), NEW_BLOCK_ICONS[kind]);
    this._blockMenu = false;
    this._change(added.strategy);
    this._selectPath(added.path);
  }

  _addSection(roomPath) {
    const list = [...roomPath, "sections"];
    const index = (getAt(this._strategy, list) ?? []).length;
    this._change(insertAt(this._strategy, list, index, { title: this._t("editor_new_section"), tiles: [] }));
    this._selectPath([...list, index]);
  }

  _addTile(listPath, entity) {
    const id = entity.trim();
    if (!id) return;
    const index = (getAt(this._strategy, listPath) ?? []).length;
    this._change(insertAt(this._strategy, listPath, index, listPath[0] === "favorites" ? id : { entity: id }));
    this._selectPath([...listPath, index]);
  }

  _duplicate(node) {
    const index = node.path.at(-1) + 1;
    const copy = structuredClone(getAt(this._strategy, node.path));
    this._change(insertAt(this._strategy, node.path.slice(0, -1), index, copy));
    this._selectPath([...node.path.slice(0, -1), index]);
  }

  /** An entry of a list (a room, a section, a tile, a block, a number, a button, a group, a row) can be hidden. */
  _hideable(node) {
    if (!node?.path?.length || node.kind === "variants") return false;
    const value = getAt(this._strategy, node.path);
    return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Array.isArray(getAt(this._strategy, node.path.slice(0, -1)));
  }

  /** Hides an entry without removing it (`hidden: true`): the preview and the dashboard show the page without it. */
  _toggleHidden(node) {
    const value = getAt(this._strategy, node.path);
    const { hidden, ...shown } = value;
    this._change(setAt(this._strategy, node.path, hidden === true ? shown : { ...value, hidden: true }));
  }

  _remove(node) {
    const value = getAt(this._strategy, node.path);
    const inside = node.kind === "room" ? (value?.sections ?? []).length : (value?.tiles ?? []).length;
    if (inside && !window.confirm(this._t("editor_remove_ask", { name: node.label }))) return;
    this._change(removeAt(this._strategy, node.path));
    this._select(null);
  }

  _shift(node, delta) {
    const list = node.path.slice(0, -1);
    const index = node.path.at(-1);
    const length = (getAt(this._strategy, list) ?? []).length;
    const target = index + delta;
    if (target < 0 || target >= length) return;
    this._change(moveItem(this._strategy, node.path, list, delta > 0 ? target + 1 : target));
    this._selectPath([...list, target]);
  }

  // Blocks ---------------------------------------------------------------------------------------------

  _addPart(listPath, item) {
    const index = (getAt(this._strategy, listPath) ?? []).length;
    this._change(insertAt(this._strategy, listPath, index, item));
    this._selectPath([...listPath, index]);
  }

  /** A field to add a number, a button or a row of a block by its entity. */
  _renderPartAdder(node) {
    const target =
      node.kind === "block-list" && node.list !== "groups"
        ? { list: node.path, make: (entity) => (node.list === "actions" ? { name: this.hass.states[entity]?.attributes?.friendly_name ?? entity, entity } : { entity }) }
        : node.kind === "panel-group"
          ? { list: [...node.path, "rows"], make: (entity) => ({ entity }) }
          : null;
    if (!target) return nothing;
    return html`<form
      class="add-tile"
      data-add-part
      @submit=${(event) => {
        event.preventDefault();
        const input = event.target.querySelector("input");
        const entity = input.value.trim();
        input.value = "";
        if (entity) this._addPart(target.list, target.make(entity));
      }}
    >
      <input list="hd-add-entities" placeholder=${this._t("editor_add_entity")} />
      <datalist id="hd-add-entities">
        ${Object.keys(this.hass.states)
          .sort()
          .map((id) => html`<option value=${id}>${this.hass.states[id].attributes?.friendly_name ?? id}</option>`)}
      </datalist>
      <button type="submit"><ha-icon icon="mdi:plus"></ha-icon>${this._t("editor_action_add_tile")}</button>
    </form>`;
  }

  /** The entities of the block's devices it does not show yet, each added as a row with one click. */
  _renderLeftovers(node) {
    const blockPath = blockPathOf(this._strategy, node.path);
    if (!blockPath) return nothing;
    const block = getAt(this._strategy, blockPath);
    const leftovers = deviceLeftovers(this.hass, block);
    if (!leftovers.length) return nothing;
    const groups = block.groups ?? [];
    const groupIndex = groupIndexOf(blockPath, node.path) ?? (groups.length ? groups.length - 1 : null);
    const groupName = groupIndex === null ? this._t("editor_new_group") : (groups[groupIndex]?.title ?? this._t("editor_tree_untitled"));
    return html`<details class="leftovers" data-leftovers open>
      <summary>${this._t("editor_leftovers_title", { count: leftovers.length })}</summary>
      <small class="hint">${this._t("editor_leftovers_to", { group: groupName })}</small>
      ${leftovers.map(
        (item) => html`<button class="leftover" data-leftover=${item.entity} @click=${() => {
          const added = addBlockRow(this._strategy, blockPath, item.entity, groupIndex, this._t("editor_new_group"));
          this._change(added.strategy);
          this._selectPath(added.path);
        }}>
          <ha-icon icon="mdi:plus-circle-outline"></ha-icon>
          <span>${item.name}<small>${item.entity}${item.category ? ` · ${item.category}` : ""}</small></span>
        </button>`,
      )}
    </details>`;
  }

  // The picker of tiles ------------------------------------------------------------------------------

  /** Open the picker for a list of tiles; a list of a room starts on the room's areas. */
  _openPicker(node, listPath) {
    const room = listPath[0] === "layout" ? this._strategy.layout?.[listPath[1]] : null;
    const place = room && node.kind !== "room" ? `${room.name ?? room.id} › ${node.label}` : node.label;
    this._picker = { listPath, title: place, areas: room ? roomAreas(room) : [] };
  }

  /** What is ticked shows in the frames at once, without touching the draft. */
  /** A strategy shown in the frames only, as long as a dialog asks what to add. */
  _previewStrategy(strategy) {
    this._source.strategy = strategy;
    for (const listener of this._source.listeners) listener(strategy);
  }

  _previewPicked(tiles) {
    const list = this._picker.listPath;
    const length = (getAt(this._strategy, list) ?? []).length;
    const shown = tiles.reduce((strategy, tile, index) => insertAt(strategy, list, length + index, tile), this._strategy);
    this._source.strategy = shown;
    for (const listener of this._source.listeners) listener(shown);
  }

  _closePicker() {
    this._picker = null;
    this._publishDraft();
  }

  _addPicked(tiles) {
    const list = this._picker.listPath;
    const length = (getAt(this._strategy, list) ?? []).length;
    this._picker = null;
    if (!tiles.length) return this._publishDraft();
    this._change(tiles.reduce((strategy, tile, index) => insertAt(strategy, list, length + index, tile), this._strategy));
    this._selectPath([...list, length]);
  }

  // Dragging in the tree ------------------------------------------------------------------------------

  _dragStart(event, item) {
    this._dragged = item;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.key);
  }

  _dragOver(event, item) {
    const plan = dropPlan(this._strategy, this._dragged, item);
    if (!plan) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const into = JSON.stringify(plan.list) !== JSON.stringify(item.path.slice(0, -1));
    if (this._dropKey !== item.key || this._dropMode !== (into ? "into" : "before")) {
      this._dropKey = item.key;
      this._dropMode = into ? "into" : "before";
    }
  }

  _drop(event, item) {
    event.preventDefault();
    const dragged = this._dragged;
    const plan = dropPlan(this._strategy, dragged, item);
    this._dragEnd();
    if (!plan) return;
    this._change(moveItem(this._strategy, dragged.path, plan.list, plan.index));
    this._selectPath(movedPath(dragged.path, plan.list, plan.index));
  }

  _dragEnd() {
    this._dragged = null;
    this._dropKey = null;
    this._dropMode = null;
  }

  // Variants ------------------------------------------------------------------------------------------

  /** A change while a variant is edited: only its page's part is kept, in the variant, a moment after the last. */
  _applyVariant(strategy) {
    const { page } = this._variantEdit;
    this._variantEdit = { ...this._variantEdit, slice: sliceOf(strategy, page) };
    // What is not of this page (a block, the menu, another room) goes to the draft, published as always.
    const base = this._draft ?? this._live ?? {};
    const outside = withSlice(strategy, page, sliceOf(base.strategy ?? {}, page));
    if (JSON.stringify(outside) !== JSON.stringify(base.strategy ?? {})) {
      this._draft = { ...base, strategy: outside };
      this._draftChanged = true;
    }
    this._publishDraft();
    this._saving = true;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveVariant(), DRAFT_SAVE_MS);
  }

  async _saveVariant() {
    clearTimeout(this._saveTimer);
    const edit = this._variantEdit;
    if (!edit) return;
    try {
      await callWS(this.hass, { type: `${DOMAIN}/variants/update`, url_path: this._urlPath, page: edit.page, variant: edit.id, slice: edit.slice });
      if (this._draftChanged) {
        this._draftChanged = false;
        await this._saveDraft();
      }
      this._saved = new Date().toISOString();
    } catch (error) {
      this._notice = { kind: "error", text: this._t("editor_draft_not_saved", { error: error.message ?? String(error) }) };
    } finally {
      this._saving = false;
    }
  }

  /** Edit a variant in the tree and the forms as the page itself; the preview shows it. */
  async _editVariant(page, item) {
    await this._saveDraft();
    this._variantEdit = { page, id: item.id, name: item.name, slice: item.slice };
    this._past = [];
    this._future = [];
    this._publishDraft();
    this._notice = { kind: "ok", text: this._t("editor_variant_editing_notice", { name: item.name || this._t("variant_unnamed") }) };
  }

  async _endVariant() {
    if (this._saving) await this._saveVariant();
    this._variantEdit = null;
    this._past = [];
    this._future = [];
    this._publishDraft();
    this.renderRoot.querySelector("home-dashboard-editor-variants")?.reload();
  }

  /** A card chosen among the variants: the preview shows that page as its devices would. */
  _previewVariant(page, slice) {
    this._previewingVariant = Boolean(slice);
    if (!slice) return this._publishDraft();
    this._previewStrategy(withSlice(this._live?.strategy ?? {}, page, slice));
  }

  _renderKnownDevices() {
    return html`
      <aside class="props" data-props data-known-devices-panel>
        <div class="phead">
          <ha-icon icon="mdi:tablet-cellphone"></ha-icon>
          <div>
            <b data-props-title>${this._t("editor_tree_known_devices")}</b>
            <small>${this._t("editor_devices_sub")}</small>
          </div>
          <span class="grow"></span>
          ${this._helpButton("props", DOCS_ANCHORS.variants)} ${this._foldButton("right")}
        </div>
        <home-dashboard-editor-known-devices .hass=${this.hass} .urlPath=${this._urlPath} .rooms=${this._strategy.layout ?? []}></home-dashboard-editor-known-devices>
      </aside>
    `;
  }

  _openOverview = async () => {
    try {
      this._overview = await callWS(this.hass, { type: `${DOMAIN}/variants/list`, url_path: this._urlPath });
      this._dialog = "variant-overview";
    } catch (error) {
      this._notice = { kind: "error", text: error?.message ?? String(error) };
    }
  };

  _renderVariants(node) {
    const room = node.variantPage === "home" ? null : (this._strategy.layout ?? []).find((item) => `room:${item.id}` === node.variantPage);
    const title = room ? this._t("editor_variants_of_room", { name: room.name ?? room.id }) : this._t("editor_variants_of_home");
    return html`
      <aside class="props" data-props data-variants-panel=${node.variantPage}>
        <div class="phead">
          <ha-icon icon="mdi:layers-triple-outline"></ha-icon>
          <div>
            <b data-props-title>${title}</b>
            <small>${this._t("editor_variants_sub")}</small>
          </div>
          <span class="grow"></span>
          <button class="ghost" data-variants-overview title=${this._t("editor_variants_overview")} aria-label=${this._t("editor_variants_overview")}
            @click=${this._openOverview}>
            <ha-icon icon="mdi:magnify"></ha-icon>
          </button>
          ${this._helpButton("props", DOCS_ANCHORS.variants)} ${this._foldButton("right")}
        </div>
        <home-dashboard-editor-variants
          .hass=${this.hass}
          .urlPath=${this._urlPath}
          .page=${node.variantPage}
          .editing=${this._variantEdit?.page === node.variantPage ? this._variantEdit.id : null}
          .users=${this._users}
          @variant-preview=${(event) => this._previewVariant(event.detail.page, event.detail.slice)}
          @variant-edit=${(event) => this._editVariant(event.detail.page, event.detail.item)}
          @variant-access=${(event) => {
            this._variantAccess = event.detail;
            this._dialog = "variant-access";
          }}
          @variant-deployed=${async (event) => {
            this._notice = { kind: "ok", text: this._t("editor_variant_deployed", { name: event.detail.name }) };
            const selected = this._selected;
            await this._load(this._urlPath);
            this._select(selected);
          }}
        ></home-dashboard-editor-variants>
      </aside>
    `;
  }

  /**
   * Save the draft on the server: one save at a time (a slow Home Assistant gets fewer saves, not a queue of them);
   * changes made while one is on its way are saved right after it. A failed save says so and is tried again with
   * the next change.
   */
  async _saveDraft() {
    clearTimeout(this._saveTimer);
    if (!this._draft) return;
    if (this._draftInFlight) {
      this._draftAgain = true;
      return;
    }
    this._draftInFlight = true;
    try {
      const saved = await callWS(this.hass, {
        type: `${DOMAIN}/editor/save_draft`,
        url_path: this._urlPath,
        config: this._draft,
        base: this._base,
      });
      this._saved = saved.updated_at;
      this._base = saved.base;
    } catch (error) {
      this._notice = { kind: "error", text: this._t("editor_draft_not_saved", { error: error.message ?? String(error) }) };
    } finally {
      this._draftInFlight = false;
      this._saving = false;
      if (this._draftAgain) {
        this._draftAgain = false;
        this._saveDraft();
      }
    }
  }

  async _discard() {
    if (!window.confirm(this._t("editor_discard_ask"))) return;
    clearTimeout(this._saveTimer);
    await callWS(this.hass, { type: `${DOMAIN}/editor/discard`, url_path: this._urlPath });
    await this._load(this._urlPath);
  }

  async _publish(force = false, note = this._note ?? "") {
    if (!this._draft) return;
    await this._saveDraft();
    this._publishing = true;
    this._note = note;
    try {
      await callWS(this.hass, { type: `${DOMAIN}/editor/publish`, url_path: this._urlPath, base: this._base, force, note });
      this._notice = { kind: "ok", text: this._t("editor_published") };
      this._dialog = null;
      this._note = "";
      this._past = [];
      this._future = [];
      await this._load(this._urlPath);
    } catch (error) {
      this._dialog = null;
      if (error?.code === "conflict") this._notice = { kind: "conflict", text: this._t("editor_conflict") };
      else this._notice = { kind: "error", text: error?.message ?? String(error) };
    } finally {
      this._publishing = false;
    }
  }

  /** The draft goes to one person, who sees it on their own devices; nobody else does. */
  async _publishReview(userId) {
    await this._saveDraft();
    this._publishing = true;
    try {
      await callWS(this.hass, { type: `${DOMAIN}/editor/publish_review`, url_path: this._urlPath, user_id: userId });
      this._dialog = null;
      this._notice = { kind: "ok", text: this._t("editor_review_sent", { name: this._userName(userId) }) };
      await this._reloadKeepingSelection();
    } catch (error) {
      this._notice = { kind: "error", text: error?.message ?? String(error) };
    } finally {
      this._publishing = false;
    }
  }

  async _endReview() {
    await callWS(this.hass, { type: `${DOMAIN}/editor/end_review`, url_path: this._urlPath });
    this._notice = { kind: "ok", text: this._t("editor_review_ended") };
    await this._reloadKeepingSelection();
  }

  async _restore(version) {
    const restored = await callWS(this.hass, { type: `${DOMAIN}/editor/restore`, url_path: this._urlPath, version });
    this._dialog = null;
    this._past = [...this._past, this._strategy];
    this._future = [];
    this._draft = restored.draft.config;
    this._base = restored.draft.base;
    this._saved = restored.draft.updated_at;
    this._publishDraft();
    this._select(null);
    this._notice = { kind: "ok", text: this._t("editor_restored") };
  }

  /** Load again what the server holds (the review, the history) and keep what is chosen. */
  async _reloadKeepingSelection() {
    const chosen = this._selected?.path;
    await this._load(this._urlPath);
    if (chosen && getAt(this._strategy, chosen) !== undefined) this._selectPath(chosen);
  }

  _userName(id) {
    return this._users.find((user) => user.id === id)?.name ?? id;
  }

  // Selection and YAML ------------------------------------------------------------------------------

  _select(node) {
    // An address or a touch in the preview may still name a setting Home Assistant cannot have now.
    if (node?.unavailable) node = null;
    if (this._previewingVariant && node?.kind !== "variants") {
      this._previewingVariant = false;
      this._publishDraft();
    }
    this._selected = node;
    this._yamlError = null;
    // The text of the YAML follows the value until someone types in it.
    this._yamlText = null;
  }

  _dump(value) {
    return value === undefined ? "" : this._yaml.dump(value, { lineWidth: 120, noRefs: true });
  }

  /** YAML typed in the properties: applied to the draft as soon as it reads, kept with its error while it does not. */
  _typeYaml(text) {
    this._yamlText = text;
    let value;
    try {
      value = this._yaml.load(text);
    } catch (error) {
      this._yamlError = error.reason ?? error.message;
      return;
    }
    const path = this._whole || !this._selected?.path ? [] : this._selected.path;
    if (!path.length && (typeof value !== "object" || value === null || Array.isArray(value))) {
      this._yamlError = this._t("editor_yaml_not_mapping");
      return;
    }
    this._yamlError = null;
    this._change(path.length ? setAt(this._strategy, path, value) : value, `yaml:${path.join("/")}`);
  }

  /** A touch in the preview: its node is chosen, the way to it unfolded and scrolled into sight. */
  _selectTarget(target) {
    const path = nodeForTarget(this._strategy, target);
    if (!path) return;
    const key = path.join("/");
    const node = flatten(buildTree(this._strategy, this.hass, this.hass.language)).find((item) => item.key === key);
    if (!node) return;
    this._unfoldTo(path);
    this._search = "";
    this._fromPreview = true;
    this._select(node);
    this.updateComplete.then(() =>
      this.renderRoot.querySelector(`[data-node="${CSS.escape(key)}"]`)?.scrollIntoView({ block: "nearest" }),
    );
  }

  /** Fold every node that has children, or unfold them all; the groups stay open, each folds by its own arrow. */
  _foldAll(fold) {
    const keys = flatten(buildTree(this._strategy, this.hass, this.hass.language))
      .filter((node) => node.kind !== "group" && node.children?.length)
      .map((node) => node.key);
    this._collapsed = new Set(fold ? keys : []);
    writeStored(COLLAPSED_KEY, JSON.stringify([...this._collapsed]));
  }

  // The menu of Home Assistant: hidden while the editor is open, the menu button shows and hides it (ha-menu.js).
  _menu = new PanelMenu(this);

  _toggleMenu() {
    this._gear = false;
    this._menu.toggle();
  }

  /** A click outside ⚙ and its pop-up closes the pop-up. */
  _onOutside = (event) => {
    if (!this._gear) return;
    if (event.composedPath().some((node) => node.classList?.contains("menu-wrap"))) return;
    this._gear = false;
  };

  /** A bar between columns: dragged, it sets the width of its side column; a double click gives the first back. */
  /** Fold or unfold a column; its width stays as it was, for when it unfolds. */
  _toggleColumn(side) {
    this._folded = { ...this._folded, [side]: !this._folded[side] };
    writeFolded(FOLDED_KEY, this._folded);
  }

  /** The button that folds a column, at its top. */
  _foldButton(side) {
    const label = this._t(`editor_fold_${side}`);
    return html`<button class="ghost fold-column" data-fold-column=${side} title=${label} aria-label=${label}
      @click=${() => this._toggleColumn(side)}>
      <ha-icon icon=${side === "left" ? "mdi:chevron-left" : "mdi:chevron-right"}></ha-icon>
    </button>`;
  }

  /** A folded column: a narrow rail with the button that unfolds it. */
  _renderRail(side) {
    const label = this._t(`editor_unfold_${side}`);
    return html`<aside class="rail" data-rail=${side}>
      <button class="ghost" data-unfold-column=${side} title=${label} aria-label=${label} @click=${() => this._toggleColumn(side)}>
        <ha-icon icon=${side === "left" ? "mdi:chevron-right" : "mdi:chevron-left"}></ha-icon>
      </button>
    </aside>`;
  }

  _renderSplitter(side) {
    // The bar beside a folded column does not drag.
    if (this._folded[side]) return html`<div class="splitter off" data-splitter=${side}></div>`;
    const move = (event) => {
      const box = this.getBoundingClientRect();
      const width = side === "left" ? event.clientX - box.left : box.right - event.clientX;
      this._widths = { ...this._widths, [side]: columnWidth(side, width) };
    };
    const start = (event) => {
      event.preventDefault();
      const bar = event.currentTarget;
      bar.setPointerCapture?.(event.pointerId);
      bar.classList.add("dragging");
      const stop = () => {
        bar.classList.remove("dragging");
        bar.removeEventListener("pointermove", move);
        bar.removeEventListener("pointerup", stop);
        bar.removeEventListener("pointercancel", stop);
        writeStored(WIDTHS_KEY, JSON.stringify(this._widths));
      };
      bar.addEventListener("pointermove", move);
      bar.addEventListener("pointerup", stop);
      bar.addEventListener("pointercancel", stop);
    };
    const reset = () => {
      this._widths = { ...this._widths, [side]: COLUMNS[side].start };
      writeStored(WIDTHS_KEY, JSON.stringify(this._widths));
    };
    return html`<div
      class="splitter"
      role="separator"
      aria-orientation="vertical"
      title=${this._t("editor_resize")}
      data-splitter=${side}
      @pointerdown=${start}
      @dblclick=${reset}
    ></div>`;
  }

  _setPreview(change) {
    // A new colour or person loads the frames again, on the page of what is chosen now.
    if ("color" in change || "as" in change) this._frameStart = null;
    this._preview = { ...this._preview, ...change };
    writeStored(PREVIEW_KEY, JSON.stringify(this._preview));
  }

  /**
   * What the button of a group folds: the parts inside it that unfold (rooms, blocks…), or, in a group of single
   * items, the group itself; and whether any of them is open now.
   */
  _groupFolding(group) {
    const inside = flatten(group.children ?? [])
      .filter((node) => node.children?.length)
      .map((node) => node.key);
    const keys = inside.length ? inside : [group.key];
    const open = !this._collapsed.has(group.key) && keys.some((key) => !this._collapsed.has(key));
    return { keys, open };
  }

  _foldGroup(group) {
    const { keys, open } = this._groupFolding(group);
    const next = new Set(this._collapsed);
    if (open) keys.forEach((key) => next.add(key));
    else [...keys, group.key].forEach((key) => next.delete(key));
    this._collapsed = next;
    writeStored(COLLAPSED_KEY, JSON.stringify([...next]));
  }

  _toggle(node) {
    const next = new Set(this._collapsed);
    if (next.has(node.key)) next.delete(node.key);
    else next.add(node.key);
    this._collapsed = next;
    writeStored(COLLAPSED_KEY, JSON.stringify([...next]));
  }

  // Rendering ---------------------------------------------------------------------------------------

  render() {
    if (!this.hass) return nothing;
    if (this._dashboards === null) return html`<p class="empty">${this._t("chart_loading")}</p>`;
    if (!this._dashboards.length) {
      return html`<div class="empty" data-no-dashboards>
        <p>${this._t("editor_no_dashboards")}</p>
        <button class="primary" data-create-dashboard ?disabled=${this._creating} @click=${this._createDashboard}>
          <ha-icon icon="mdi:plus"></ha-icon>${this._t("editor_create_dashboard")}
        </button>
      </div>`;
    }
    return html`
      ${this._renderTop()}
      ${this._notice
        ? html`<div class="notice ${this._notice.kind}" data-notice=${this._notice.kind}>
            <span>${this._notice.text}</span>
            ${this._notice.kind === "conflict"
              ? html`<button data-publish-force @click=${() => this._publish(true)}>${this._t("editor_publish_anyway")}</button>`
              : nothing}
            <button class="ghost" @click=${() => (this._notice = null)}><ha-icon icon="mdi:close"></ha-icon></button>
          </div>`
        : nothing}
      ${this._tour || this._lesson
        ? html`<home-dashboard-editor-tour
            .root=${this.renderRoot}
            .t=${(key, values) => this._t(key, values)}
            .lesson=${this._lesson}
            .host=${this}
            @tour-close=${() => {
              // A list of tiles a lesson opened does not stay over the editor after it.
              if (this._lesson && this._picker) this._closePicker();
              this._tour = false;
              this._lesson = null;
            }}
          ></home-dashboard-editor-tour>`
        : nothing}
      ${this._dialog === "lessons"
        ? html`<home-dashboard-editor-lessons
            .hass=${this.hass}
            .app=${this}
            @dialog-close=${() => (this._dialog = null)}
            @lesson-start=${(event) => {
              this._dialog = null;
              this._tour = false;
              this._lesson = LESSONS.find((lesson) => lesson.key === event.detail.key) ?? null;
            }}
          ></home-dashboard-editor-lessons>`
        : nothing}
      ${this._dialog === "settings"
        ? html`<home-dashboard-editor-devices
            .hass=${this.hass}
            .prefs=${this._devicePrefs}
            .builtIn=${{ phone: PHONES, tablet: TABLETS }}
            @devices-change=${(event) => {
              this._devicePrefs = event.detail.prefs;
              writeDevicePrefs(this._devicePrefs);
            }}
            @dialog-close=${() => (this._dialog = null)}
          ></home-dashboard-editor-devices>`
        : nothing}
      ${this._dialog === "publish"
        ? html`<home-dashboard-editor-publish
            .hass=${this.hass}
            .yaml=${this._yaml}
            .live=${this._live?.strategy ?? {}}
            .draft=${this._strategy}
            .users=${this._users}
            .review=${this._review}
            ?busy=${this._publishing}
            @dialog-close=${() => (this._dialog = null)}
            @publish-all=${(event) => this._publish(false, event.detail.note)}
            @publish-review=${(event) => this._publishReview(event.detail.user_id)}
          ></home-dashboard-editor-publish>`
        : nothing}
      ${this._dialog === "quick"
        ? html`<home-dashboard-editor-quick-start
            .hass=${this.hass}
            .strategy=${this._strategy}
            @dialog-close=${() => {
              this._dialog = null;
              this._publishDraft();
            }}
            @quick-preview=${(event) => this._previewStrategy(withQuickStart(this.hass, this._strategy, event.detail.answers))}
            @quick-apply=${(event) => {
              const before = this._strategy;
              const after = withQuickStart(this.hass, before, event.detail.answers);
              this._dialog = null;
              if (after !== before) this._change(after);
              else this._publishDraft();
              this._notice = { kind: "ok", text: this._t(after !== before ? "quick_done" : "quick_summary_nothing") };
              if (event.detail.tour) this._tour = true;
            }}
          ></home-dashboard-editor-quick-start>`
        : nothing}
      ${this._dialog === "generate"
        ? html`<home-dashboard-editor-generate
            .hass=${this.hass}
            .strategy=${this._strategy}
            @dialog-close=${() => {
              this._dialog = null;
              this._publishDraft();
            }}
            @generate-preview=${(event) => this._previewStrategy(withGeneratedRooms(this.hass, this._strategy, event.detail.areas, event.detail.options))}
            @generate-add=${(event) => {
              const before = (this._strategy.layout ?? []).length;
              this._dialog = null;
              this._change(withGeneratedRooms(this.hass, this._strategy, event.detail.areas, event.detail.options));
              this._notice = { kind: "ok", text: this._t("editor_generated", { count: (this._strategy.layout ?? []).length - before }) };
              if ((this._strategy.layout ?? []).length > before) this._selectPath(["layout", before]);
            }}
          ></home-dashboard-editor-generate>`
        : nothing}
      ${this._ask
        ? html`<home-dashboard-editor-ask .hass=${this.hass} .question=${this._ask} @dialog-close=${() => this._closeAsk()}></home-dashboard-editor-ask>`
        : nothing}
      ${this._dialog === "variant-overview" && this._overview
        ? html`<home-dashboard-editor-variant-overview
            .hass=${this.hass}
            .data=${this._overview}
            .rooms=${this._strategy.layout ?? []}
            .users=${this._users}
            @dialog-close=${() => (this._dialog = null)}
          ></home-dashboard-editor-variant-overview>`
        : nothing}
      ${this._dialog === "variant-access" && this._variantAccess
        ? html`<home-dashboard-editor-variant-access
            .hass=${this.hass}
            .urlPath=${this._urlPath}
            .page=${this._variantAccess.page}
            .item=${this._variantAccess.item}
            .data=${this._variantAccess.data}
            @dialog-close=${() => (this._dialog = null)}
            @variant-access-saved=${() => {
              this._dialog = null;
              this._notice = { kind: "ok", text: this._t("editor_variant_access_saved") };
              this.renderRoot.querySelector("home-dashboard-editor-variants")?.reload();
            }}
          ></home-dashboard-editor-variant-access>`
        : nothing}
      ${this._dialog === "history"
        ? html`<home-dashboard-editor-history
            .hass=${this.hass}
            .yaml=${this._yaml}
            .urlPath=${this._urlPath}
            .history=${this._history}
            .current=${this._strategy}
            .users=${this._users}
            @dialog-close=${() => (this._dialog = null)}
            @history-restore=${(event) => this._restore(event.detail.version)}
          ></home-dashboard-editor-history>`
        : nothing}
      ${this._picker
        ? html`<home-dashboard-editor-picker
            .hass=${this.hass}
            .strategy=${this._strategy}
            .target=${this._picker}
            @picker-close=${this._closePicker}
            @picker-preview=${(event) => this._previewPicked(event.detail.tiles)}
            @picker-add=${(event) => this._addPicked(event.detail.tiles)}
          ></home-dashboard-editor-picker>`
        : nothing}
      <div
        class="cols"
        style="--left: ${this._folded.left ? RAIL : this._widths.left}px; --right: ${this._folded.right ? RAIL : this._widths.right}px"
      >
        ${this._folded.left ? this._renderRail("left") : this._renderTree()} ${this._renderSplitter("left")}
        ${this._renderStage()} ${this._renderSplitter("right")}
        ${this._folded.right ? this._renderRail("right") : this._renderProps()}
      </div>
      ${this._renderHelp()}
    `;
  }

  /** The "?" of a part of the editor: what the part is for, and the chapter of the guide about it in a new tab. */
  _helpButton(part, anchor) {
    const label = `${this._t("editor_help_what")} ${this._t(`editor_help_${part}_title`)}`;
    return html`<button
      class="ghost help ${this._help?.part === part ? "on" : ""}"
      data-help=${part}
      data-anchor=${anchor}
      title=${label}
      aria-label=${label}
      aria-expanded=${this._help?.part === part ? "true" : "false"}
      @click=${(event) => this._toggleHelp(part, anchor, event.currentTarget)}
    >
      <ha-icon icon="mdi:help-circle-outline"></ha-icon>
    </button>`;
  }

  /** The window of a part's "?": opens under its button (inside the screen), a second click or Esc closes it. */
  _toggleHelp(part, anchor, button) {
    if (this._help?.part === part) {
      this._help = null;
      return;
    }
    const box = button.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 16);
    const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8));
    this._help = { part, anchor, top: box.bottom + 6, left, width };
  }

  _renderHelp() {
    const help = this._help;
    if (!help) return nothing;
    return html`<div class="help-shade" data-help-shade @click=${() => (this._help = null)}></div>
      <div
        class="help-pop"
        role="dialog"
        aria-label=${this._t(`editor_help_${help.part}_title`)}
        data-help-pop=${help.part}
        style="top: ${help.top}px; left: ${help.left}px; width: ${help.width}px"
      >
        <div class="help-head">
          <b>${this._t(`editor_help_${help.part}_title`)}</b>
          <button class="ghost" data-help-close aria-label=${this._t("close")} @click=${() => (this._help = null)}>
            <ha-icon icon="mdi:close"></ha-icon>
          </button>
        </div>
        <p>${this._t(`editor_help_${help.part}`)}</p>
        <a data-help-more href=${editorDocsUrl(this.hass?.language, help.anchor)} target="_blank" rel="noopener"
          >${this._t("editor_help_more")} <ha-icon icon="mdi:open-in-new"></ha-icon
        ></a>
        ${this._renderHelpLesson(help)}
      </div>`;
  }

  // The lesson of what the "?" is about: the chosen part of the form, the tree (rooms) or the preview (who sees what).
  _renderHelpLesson(help) {
    const lesson =
      help.part === "props"
        ? lessonFor(this._selected?.key, this._strategy)
        : LESSONS.find((item) => item.key === { tree: "add_room", preview: "publish" }[help.part]);
    if (!lesson) return nothing;
    const ready = lessonReady(lesson, this);
    return html`<button class="help-lesson" data-help-lesson=${lesson.key} ?disabled=${!ready}
      title=${ready ? "" : this._t(`lessons_needs_${lesson.needs}`)}
      @click=${() => {
        this._help = null;
        this._tour = false;
        this._lesson = lesson;
      }}>
      <ha-icon icon="mdi:school-outline"></ha-icon>${this._t("lessons_show", { name: this._t(`lesson_${lesson.key}_name`) })}
    </button>`;
  }

  _renderTop() {
    const state = this._saving
      ? this._t("editor_saving")
      : this._draft
        ? this._t("editor_draft_saved")
        : this._t("editor_no_changes");
    return html`
      <header class="top">
        <button class="ghost menu" data-ha-menu aria-label=${this._t("editor_menu")} title=${this._t("editor_menu")}
          @click=${this._toggleMenu}>
          <ha-icon icon="mdi:menu"></ha-icon>
        </button>
        <ha-icon class="app-icon" icon="mdi:pencil-ruler" data-app-icon></ha-icon>
        <h1>${this._t("editor_title")}</h1>
        ${this._dashboards.length > 1
          ? html`<select data-dashboard @change=${(event) => this._load(event.target.value)}>
              ${this._dashboards.map(
                (item) => html`<option value=${item.url_path} ?selected=${item.url_path === this._urlPath}>${item.title}</option>`,
              )}
            </select>`
          : html`<span class="board">${this._dashboards[0].title}</span>`}
        <span class="grow"></span>
        ${this._variantEdit
          ? html`<span class="pill variant" data-variant-state>
              <ha-icon icon="mdi:layers-triple-outline"></ha-icon>${this._t("editor_variant_editing_pill", {
                name: this._variantEdit.name || this._t("variant_unnamed"),
              })}
              <span class="sub">${this._saving ? this._t("editor_saving") : this._t("editor_variant_saved")}</span>
              <button class="ghost" data-variant-end @click=${this._endVariant}>${this._t("editor_variant_end")}</button>
            </span>`
          : html`<span class="pill ${this._draft ? "draft" : ""}" data-draft-state=${this._draft ? "draft" : "live"}>
              <ha-icon .icon=${this._draft ? "mdi:pencil" : "mdi:check"}></ha-icon>${state}
            </span>`}
        <button class="ghost" data-undo title=${this._t("editor_undo")} ?disabled=${!this._past.length} @click=${this._undo}>
          <ha-icon icon="mdi:undo"></ha-icon>
        </button>
        <button class="ghost" data-redo title=${this._t("editor_redo")} ?disabled=${!this._future.length} @click=${this._redo}>
          <ha-icon icon="mdi:redo"></ha-icon>
        </button>
        ${this._draft && !this._variantEdit
          ? html`<button class="ghost" data-discard @click=${this._discard}>${this._t("editor_discard")}</button>`
          : nothing}
        <button
          class="ghost"
          data-theme-button=${this._theme}
          title=${this._t(`editor_theme_${this._theme}`)}
          aria-label=${this._t(`editor_theme_${this._theme}`)}
          @click=${this._nextTheme}
        >
          <ha-icon .icon=${THEME_ICONS[this._theme]}></ha-icon>
        </button>
        <button
          class=${this._whole ? "on" : ""}
          data-whole-yaml
          @click=${() => {
            this._whole = !this._whole;
            this._yamlError = null;
            this._yamlText = null;
          }}
        >
          <ha-icon icon="mdi:code-braces"></ha-icon>YAML
        </button>
        ${this._review
          ? html`<span class="pill review" data-review-state>
              <ha-icon icon="mdi:account-eye"></ha-icon>${this._t("editor_review_with", { name: this._userName(this._review.user_id) })}
              <button class="ghost" data-end-review @click=${this._endReview}>${this._t("editor_review_end")}</button>
            </span>`
          : nothing}
        <button class="ghost" data-docs title=${this._t("editor_docs")} aria-label=${this._t("editor_docs")}
          @click=${() => window.open(editorDocsUrl(this.hass?.language), "_blank", "noopener")}>
          <ha-icon icon="mdi:help-circle-outline"></ha-icon>
        </button>
        ${this._renderGear()}
        <button class="ghost" data-history title=${this._t("editor_history_title")} @click=${() => (this._dialog = "history")}>
          <ha-icon icon="mdi:history"></ha-icon>${this._t("editor_history_title")}
        </button>
        <button class="primary" data-publish ?disabled=${!this._draft || this._publishing || this._variantEdit} @click=${async () => {
          await this._saveDraft();
          this._dialog = "publish";
        }}>
          <ha-icon icon="mdi:cloud-upload"></ha-icon>${this._t("editor_publish")}
        </button>
      </header>
    `;
  }

  _renderTree() {
    const tree = filterTree(buildTree(this._strategy, this.hass, this.hass.language), this._search, this._strategy);
    const searching = Boolean(this._search.trim());
    const node = (item, depth, hiddenAbove = false) => {
      const open = searching || !this._collapsed.has(item.key);
      const selected = this._selected?.key === item.key;
      if (item.kind === "group") {
        const folding = this._groupFolding(item);
        return html`
          <div class="group" data-group=${item.key}>
            <button class="fold" aria-expanded=${open} data-group-fold=${item.key} title=${this._t("editor_fold")} @click=${() => this._toggle(item)}>
              <ha-icon .icon=${open ? "mdi:chevron-down" : "mdi:chevron-right"}></ha-icon>
            </button>
            <span class="group-name" @click=${() => this._toggle(item)}>${item.label}</span>
            ${item.key === "rooms"
              ? html`<span>
                  <button class="ghost add" data-generate title=${this._t("editor_generate_title")} @click=${() => (this._dialog = "generate")}>
                    <ha-icon icon="mdi:auto-fix"></ha-icon>
                  </button>
                  <button class="ghost add" data-add-room title=${this._t("editor_add_room")} @click=${this._addRoom}>
                    <ha-icon icon="mdi:plus"></ha-icon>
                  </button>
                </span>`
              : nothing}
            ${item.key === "blocks"
              ? html`<button class="ghost add" data-add-block title=${this._t("editor_add_block")}
                  aria-expanded=${this._blockMenu ? "true" : "false"} @click=${() => (this._blockMenu = !this._blockMenu)}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>`
              : nothing}
            ${item.children.length
              ? html`<button
                  class="ghost add"
                  data-group-fold-all=${item.key}
                  data-open=${folding.open}
                  title=${this._t(folding.open ? "editor_group_fold_all" : "editor_group_unfold_all")}
                  @click=${() => this._foldGroup(item)}
                >
                  <ha-icon .icon=${folding.open ? "mdi:unfold-less-horizontal" : "mdi:unfold-more-horizontal"}></ha-icon>
                </button>`
              : nothing}
          </div>
          ${item.key === "blocks" && this._blockMenu
            ? html`<div class="block-kinds" data-block-kinds>
                <small class="hint">${this._t("editor_add_block_hint")}</small>
                ${Object.entries(NEW_BLOCK_ICONS).map(
                  ([kind, icon]) => html`<button class="start" data-block-new=${kind} @click=${() => this._addBlock(kind)}>
                    <ha-icon .icon=${icon}></ha-icon>${this._t(`block_kind_${kind}`)}
                  </button>`,
                )}
              </div>`
            : nothing}
          ${item.key === "rooms" && !item.children.length && !searching
            ? html`<button class="start" data-quick-start @click=${() => (this._dialog = "quick")}>
                <ha-icon icon="mdi:rocket-launch-outline"></ha-icon>${this._t("quick_start_button")}
              </button>`
            : nothing}
          ${item.key === "rooms" && !item.children.length && !searching
            ? html`<button class="start" data-generate-start @click=${() => (this._dialog = "generate")}>
                <ha-icon icon="mdi:auto-fix"></ha-icon>${this._t("editor_generate_start")}
              </button>`
            : nothing}
          ${open ? item.children.map((child) => node(child, depth)) : nothing}
        `;
      }
      const draggable = ["tile", "favorite", "room", "stat", "action", "panel-group", "row"].includes(item.kind) || isRoomSection(item);
      const hideable = this._hideable(item);
      const hidden = hideable && getAt(this._strategy, item.path).hidden === true;
      const drop = this._dropKey === item.key ? `drop-${this._dropMode}` : "";
      // A setting whose part Home Assistant lacks: shown greyed with what to install, not opened.
      if (item.unavailable) {
        return html`
          <div class="node unavailable" style="padding-left: ${8 + depth * 16}px" data-node=${item.key} data-unavailable=${item.unavailable}
            aria-disabled="true" title=${this._t(item.unavailable)}>
            <span class="fold"></span>
            <ha-icon class="icon" .icon=${item.icon}></ha-icon>
            <span class="label">${item.label}<small>${this._t(item.unavailable)}</small></span>
            <ha-icon class="needs" icon="mdi:puzzle-plus-outline"></ha-icon>
          </div>
        `;
      }
      return html`
        <div
          class="node ${selected ? "sel" : ""} ${item.problems?.length ? "warn" : ""} ${hidden || hiddenAbove ? "hidden" : ""} ${drop}"
          style="padding-left: ${8 + depth * 16}px"
          data-node=${item.key}
          draggable=${draggable ? "true" : "false"}
          @click=${() => this._select(item)}
          @dragstart=${(event) => this._dragStart(event, item)}
          @dragover=${(event) => this._dragOver(event, item)}
          @dragleave=${() => {
            if (this._dropKey === item.key) this._dropKey = null;
          }}
          @drop=${(event) => this._drop(event, item)}
          @dragend=${() => this._dragEnd()}
        >
          ${item.children?.length
            ? html`<button class="fold" data-fold=${item.key} @click=${(event) => (event.stopPropagation(), this._toggle(item))}>
                <ha-icon .icon=${open ? "mdi:chevron-down" : "mdi:chevron-right"}></ha-icon>
              </button>`
            : html`<span class="fold"></span>`}
          <ha-icon class="icon" .icon=${item.problems?.length ? "mdi:alert" : item.icon}></ha-icon>
          <span class="label">${item.label}</span>
          ${item.count !== undefined ? html`<span class="count">${item.count}</span>` : nothing}
          ${hideable
            ? html`<button
                class="eye ${hidden ? "on" : ""}"
                data-hide=${item.key}
                aria-pressed=${hidden ? "true" : "false"}
                title=${this._t(hidden ? "editor_show_entry" : "editor_hide_entry")}
                @click=${(event) => (event.stopPropagation(), this._toggleHidden(item))}
              >
                <ha-icon .icon=${hidden ? "mdi:eye-off-outline" : "mdi:eye-outline"}></ha-icon>
              </button>`
            : nothing}
        </div>
        ${open ? (item.children ?? []).map((child) => node(child, depth + 1, hidden || hiddenAbove)) : nothing}
      `;
    };
    return html`
      <aside class="tree" data-tree>
        <div class="tree-tools">
          <button class="ghost" data-fold-all title=${this._t("editor_fold_all")} @click=${() => this._foldAll(true)}>
            <ha-icon icon="mdi:unfold-less-horizontal"></ha-icon>${this._t("editor_fold_all")}
          </button>
          <button class="ghost" data-unfold-all title=${this._t("editor_unfold_all")} @click=${() => this._foldAll(false)}>
            <ha-icon icon="mdi:unfold-more-horizontal"></ha-icon>${this._t("editor_unfold_all")}
          </button>
          <span class="grow"></span>
          ${this._helpButton("tree", DOCS_ANCHORS.screen)} ${this._foldButton("left")}
        </div>
        <label class="search">
          <ha-icon icon="mdi:magnify"></ha-icon>
          <input
            data-search
            .value=${this._search}
            placeholder=${this._t("editor_search")}
            @input=${(event) => (this._search = event.target.value)}
          />
        </label>
        ${tree.map((item) => node(item, 0))}
      </aside>
    `;
  }

  /** The phones and tablets the preview offers: the built-in ones as a person changed them, and their own. */
  get _catalog() {
    return { phone: deviceCatalog(PHONES, this._devicePrefs, "phone"), tablet: deviceCatalog(TABLETS, this._devicePrefs, "tablet") };
  }

  /** The devices of a kind to choose from, smallest screen first. */
  _shownDevices(kind) {
    return deviceList(kind === "tablet" ? TABLETS : PHONES, this._devicePrefs, kind).filter((item) => !item.hidden);
  }

  _nextTheme() {
    this._setTheme(THEMES[(THEMES.indexOf(this._theme) + 1) % THEMES.length]);
  }

  _setTheme(theme) {
    this._theme = theme;
    writeStored(THEME_KEY, theme);
  }

  /** The editor's language: kept in this browser, the editor is drawn again in it at once. */
  _setLanguage(language) {
    this._language = language;
    writeStored(LANGUAGE_KEY, language);
    this.hass = this._hassFromHa;
  }

  /** ⚙: a pop-up under the button with the quick settings (look and language); the preview's devices one step on. */
  _renderGear() {
    return html`<span class="menu-wrap gear-wrap">
      <button class="ghost ${this._gear ? "on" : ""}" data-editor-settings title=${this._t("editor_settings")}
        aria-label=${this._t("editor_settings")} aria-expanded=${this._gear ? "true" : "false"}
        @click=${() => (this._gear = !this._gear)}>
        <ha-icon icon="mdi:cog-outline"></ha-icon>
      </button>
      ${this._gear
        ? html`<div class="gear-pop" data-gear-pop>
            <strong class="pop-title">${this._t("editor_gear_title")}</strong>
            <span class="pop-label">${this._t("editor_theme_label")}</span>
            <div class="seg" data-theme-seg>
              ${THEMES.map(
                (theme) =>
                  html`<button class=${theme === this._theme ? "on" : ""} data-theme-choice=${theme}
                    aria-pressed=${theme === this._theme ? "true" : "false"} @click=${() => this._setTheme(theme)}>
                    ${this._t(`editor_theme_choice_${theme}`)}
                  </button>`,
              )}
            </div>
            <span class="pop-label">${this._t("editor_language_label")}</span>
            <div class="seg" data-language-seg>
              ${EDITOR_LANGUAGES.map(
                (code) =>
                  html`<button class=${code === this._language ? "on" : ""} data-language-choice=${code}
                    aria-pressed=${code === this._language ? "true" : "false"} @click=${() => this._setLanguage(code)}>
                    ${LANGUAGE_NAMES[code] ?? this._t("editor_language_auto")}
                  </button>`,
              )}
            </div>
            <button class="pop-link" data-gear-quick ?disabled=${!this._urlPath} @click=${() => {
              this._gear = false;
              this._dialog = "quick";
            }}>
              <ha-icon icon="mdi:auto-fix"></ha-icon>${this._t("quick_title")}
            </button>
            <button class="pop-link" data-gear-tour @click=${() => {
              this._gear = false;
              this._lesson = null;
              this._tour = true;
            }}>
              <ha-icon icon="mdi:map-marker-path"></ha-icon>${this._t("editor_tour_open")}
            </button>
            <button class="pop-link" data-gear-lessons ?disabled=${!this._urlPath} @click=${() => {
              this._gear = false;
              this._dialog = "lessons";
            }}>
              <ha-icon icon="mdi:school-outline"></ha-icon>${this._t("lessons_title")}
            </button>
            <button class="pop-link" data-gear-devices @click=${() => {
              this._gear = false;
              this._dialog = "settings";
            }}>
              <ha-icon icon="mdi:cellphone-link"></ha-icon>${this._t("editor_gear_devices")}
            </button>
          </div>`
        : nothing}
    </span>`;
  }

  shouldUpdate(changed) {
    if (changed.size !== 1 || !changed.has("hass")) return true;
    const previous = changed.get("hass");
    if (!previous || HASS_KEYS.some((key) => previous[key] !== this.hass?.[key])) return true;
    const wait = (this._drawnAt ?? 0) + EDITOR_TIMING.states - Date.now();
    if (wait <= 0) return true;
    this._statesTimer ??= setTimeout(() => {
      this._statesTimer = null;
      this.requestUpdate();
    }, wait);
    return false;
  }

  updated(changed) {
    // The address follows the chosen node; it is left alone while the node it names waits for the first state.
    if (changed.has("_selected") && this._wanted === null) writeAddress(this._selected?.key ?? null);
    this._drawnAt = Date.now();
    clearTimeout(this._statesTimer);
    this._statesTimer = null;
    const theme = editorTheme(this._theme, this.hass);
    if (this.dataset.theme !== theme) this.dataset.theme = theme;
    const stage = this.renderRoot.querySelector("[data-stage]");
    if (stage && stage !== this._watchedStage) {
      this._stageWatch?.disconnect();
      this._watchedStage = stage;
      this._stageWatch = new ResizeObserver(() => this._fitStage());
      this._stageWatch.observe(stage);
    }
    this._fitStage();
    this._followSelection();
    this._syncBlockWindow();
    this._syncHighlight();
  }

  /** What is chosen is outlined in red in the frames, so it is clear what the form edits. */
  _syncHighlight() {
    const spec = this._whole ? null : highlightSpec(this._strategy, this._selected?.path);
    const sent = JSON.stringify(spec);
    if (sent === this._highlightSent) return;
    this._highlightSent = sent;
    this._source.highlight = spec;
    for (const listener of this._source.commands) listener({ type: "highlight", spec });
  }

  /** The block that is edited opens its window in the frames, follows every change and is measured. */
  _syncBlockWindow() {
    const path = this._selected?.path;
    const blockPath = path ? blockPathOf(this._strategy, path) : null;
    const item = blockPath ? getAt(this._strategy, blockPath) : null;
    // Another kind of block opens its own window, and the menu its drawer, without measuring.
    const shortcut = !item && path?.length === 2 && path[0] === "shortcuts" ? getAt(this._strategy, path) : null;
    const menu = !item && !shortcut && this._selected?.key === "menu";
    const command = item
      ? { type: "open-block", item }
      : shortcut?.kind
        ? { type: "open-shortcut", item: shortcut }
        : menu
          ? { type: "open-menu", menu: getAt(this._strategy, ["menu"]) ?? null }
          : { type: "close" };
    const sent = JSON.stringify(command);
    if (sent === this._blockSent) return;
    this._blockSent = sent;
    for (const listener of this._source.commands) listener(command);
    clearTimeout(this._fitTimer);
    if (!item) {
      if (Object.keys(this._fit).length) this._fit = {};
      return;
    }
    this._fitTimer = setTimeout(() => this._measureFit(), FIT_MEASURE_MS);
  }

  /** How much the window of the block in each frame would scroll: 0 when it fits. */
  _measureFit() {
    const fit = {};
    for (const frame of this.renderRoot.querySelectorAll("iframe[data-frame]")) {
      let documentOfFrame;
      try {
        documentOfFrame = frame.contentDocument;
      } catch {
        continue;
      }
      const sheet = deepQuery(documentOfFrame, "home-dashboard-sheet");
      const panel = sheet?.shadowRoot?.querySelector(".panel");
      if (panel) fit[frame.dataset.frame] = Math.max(0, panel.scrollHeight - panel.clientHeight);
    }
    this._fit = fit;
  }

  _fitStage() {
    const stage = this.renderRoot.querySelector("[data-stage-frames]");
    if (!stage) return;
    const catalog = this._catalog;
    const scale = stageScale(this._preview.devices, stage.clientWidth, stage.clientHeight, shownModel(catalog.tablet, this._preview.tablet, "air"),
      this._preview.zoom, shownModel(catalog.phone, this._preview.phone, "16pro"), catalog);
    if (Number.isFinite(scale) && Math.abs(scale - this._scale) > 0.005) this._scale = scale;
  }

  /** The frames go to the room of what is chosen, without loading Home Assistant again. */
  _followSelection() {
    const { page, room } = previewPage(this._strategy, this._selected?.path);
    for (const frame of this.renderRoot.querySelectorAll("iframe[data-frame]")) {
      const view = frame.contentWindow;
      if (!view?.location || frame.dataset.loaded !== "1") continue;
      const wanted = (this.previewUrl ?? previewUrl)(this._urlPath, page, { room, color: this._preview.color, as: this._preview.as });
      let current;
      try {
        current = `${view.location.pathname}${view.location.search}`;
      } catch {
        continue;
      }
      if (current === wanted) continue;
      view.history.pushState(null, "", wanted);
      view.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    }
  }

  _renderStage() {
    const { devices, color, as, zoom } = this._preview;
    const catalog = this._catalog;
    const tablet = shownModel(catalog.tablet, this._preview.tablet, "air");
    const phone = shownModel(catalog.phone, this._preview.phone, "16pro");
    const size = (key) => deviceSize(key, key === "tablet" ? tablet : phone, zoom[key], catalog);
    // The frames open on the page of the first choice; later choices move them inside (see _followSelection),
    // and only a change of colour or person loads them again.
    this._frameStart ??= previewPage(this._strategy, this._selected?.path);
    const source = (key) =>
      (this.previewUrl ?? previewUrl)(this._urlPath, this._frameStart.page, { room: this._frameStart.room, color, as, device: key });
    const deviceButton = (key, icon, label) => html`<button
      class=${devices.length === 1 && devices[0] === key ? "on" : ""}
      data-device=${key}
      @click=${() => this._setPreview({ devices: [key] })}
    >
      <ha-icon .icon=${icon}></ha-icon>${label}
    </button>`;
    return html`
      <main class="stage" data-stage>
        <div class="stage-tools">
          ${this._helpButton("preview", DOCS_ANCHORS.preview)}
          <div class="seg">
            ${deviceButton("phone", "mdi:cellphone", this._t("editor_device_phone"))} ${deviceButton("tablet", "mdi:tablet", this._t("editor_device_tablet"))}
            <button class=${devices.length === 2 ? "on" : ""} data-device="both" @click=${() => this._setPreview({ devices: ["phone", "tablet"] })}>
              <ha-icon icon="mdi:view-split-vertical"></ha-icon>${this._t("editor_both")}
            </button>
          </div>
          <div class="seg">
            ${["auto", "light", "dark"].map(
              (mode) => html`<button class=${color === mode ? "on" : ""} data-color=${mode} @click=${() => this._setPreview({ color: mode })}>
                ${this._t(`editor_color_${mode}`)}
              </button>`,
            )}
          </div>
          <label class="as" title=${this._t("editor_phone_model")}>
            <ha-icon icon="mdi:cellphone"></ha-icon>
            <select data-phone-size @change=${(event) => this._setPreview({ phone: event.target.value })}>
              ${this._shownDevices("phone").map(
                (item) => html`<option value=${item.key} ?selected=${item.key === phone}>${item.label}</option>`,
              )}
            </select>
          </label>
          <label class="as" title=${this._t("editor_tablet_model")}>
            <ha-icon icon="mdi:tablet"></ha-icon>
            <select data-tablet-size @change=${(event) => this._setPreview({ tablet: event.target.value })}>
              ${this._shownDevices("tablet").map(
                (item) => html`<option value=${item.key} ?selected=${item.key === tablet}>${item.label}</option>`,
              )}
            </select>
          </label>
          ${["phone", "tablet"].map(
            (key) => html`<label class="as" title=${this._t("editor_zoom_help")}>
              <ha-icon icon="mdi:magnify-plus-outline"></ha-icon>
              <span>${this._t(`editor_device_${key}`)}</span>
              <select data-zoom=${key} @change=${(event) => this._setPreview({ zoom: { ...zoom, [key]: Number(event.target.value) } })}>
                ${ZOOMS.map((value) => html`<option value=${value} ?selected=${value === zoom[key]}>${value} %</option>`)}
              </select>
            </label>`,
          )}
          <label class="as">
            <ha-icon icon="mdi:account"></ha-icon>
            <select data-as @change=${(event) => this._setPreview({ as: event.target.value })}>
              <option value="" ?selected=${!as}>${this._t("editor_as_me")}</option>
              ${this._users.map((user) => html`<option value=${user.id} ?selected=${user.id === as}>${user.name}</option>`)}
            </select>
          </label>
        </div>
        <div class="frames" data-stage-frames style="--scale: ${this._scale}">
          ${devices.map(
            (key) => html`
              <figure class="device ${key}" data-device-frame=${key}
                style="width: ${(size(key).width + FRAME_BORDER * 2) * this._scale}px">
                <div class="bezel" style="width: ${size(key).width * this._scale}px; height: ${size(key).height * this._scale}px">
                  <iframe
                    data-frame=${key}
                    title=${size(key).label}
                    src=${source(key)}
                    style="width: ${size(key).width}px; height: ${size(key).height}px; transform: scale(${this._scale})"
                    @load=${(event) => {
                      event.target.dataset.loaded = "1";
                      this._followSelection();
                    }}
                  ></iframe>
                </div>
                <figcaption>${size(key).label}</figcaption>
                ${this._fit[key] !== undefined
                  ? html`<div class="fit ${this._fit[key] > 2 ? (key === "phone" ? "phone" : "scrolls") : "fits"}" data-fit=${key}>
                      ${this._fit[key] > 2
                        ? this._t(key === "phone" ? "editor_fit_phone" : "editor_fit_scroll", { px: this._fit[key] })
                        : this._t("editor_fit_ok")}
                    </div>`
                  : nothing}
              </figure>
            `,
          )}
        </div>
      </main>
    `;
  }

  _renderProps() {
    if (!this._whole && this._selected?.kind === "variants") return this._renderVariants(this._selected);
    if (!this._whole && this._selected?.kind === "devices") return this._renderKnownDevices();
    // The node as the tree is now: a renamed tile shows its new name.
    const node = this._selected
      ? (flatten(buildTree(this._strategy, this.hass, this.hass.language)).find((item) => item.key === this._selected.key) ??
        this._selected)
      : null;
    const whole = this._whole || !node?.path;
    const problems = node?.problems ?? [];
    const value = whole ? this._strategy : getAt(this._strategy, node.path);
    const tab = whole ? "yaml" : this._tab;
    return html`
      <aside class="props" data-props>
        <div class="phead">
          <ha-icon .icon=${whole ? "mdi:code-braces" : node.icon ?? "mdi:shape-outline"}></ha-icon>
          <div>
            <b data-props-title>${whole ? this._t("editor_whole") : node.label}</b>
            <small>${whole ? "strategy" : node.path.join(" › ")}</small>
          </div>
          <span class="grow"></span>
          ${this._helpButton("props", whole ? DOCS_ANCHORS.screen : docsAnchorFor(node))} ${this._foldButton("right")}
        </div>
        ${whole ? nothing : this._renderActions(node)}
        ${problems.map((key) => html`<div class="problem" data-problem=${key}>${this._t(key)}</div>`)}
        ${whole
          ? nothing
          : html`<div class="tabs">
              ${["form", "yaml"].map(
                (key) => html`<button class=${tab === key ? "on" : ""} data-tab=${key} @click=${() => {
                  this._tab = key;
                  this._yamlText = null;
                }}>${this._t(`editor_tab_${key}`)}</button>`,
              )}
            </div>`}
        ${whole ? nothing : this._renderLeftovers(node)}
        ${tab === "form" && node.kind === "setting" && SETTINGS_FORMS[node.key]
          ? html`<home-dashboard-editor-settings
              data-form="setting-${node.key}"
              .hass=${this.hass}
              .strategy=${this._strategy}
              .node=${node}
              .users=${this._users}
              @settings-change=${(event) => {
                this._yamlText = null;
                this._change(event.detail.strategy, null);
              }}
            ></home-dashboard-editor-settings>`
          : tab === "form"
          ? html`<home-dashboard-editor-props
              .hass=${this.hass}
              .node=${node}
              .value=${value}
              .strategy=${this._strategy}
              .users=${this._users}
              @props-change=${(event) => {
                this._yamlText = null;
                let next = setAt(this._strategy, node.path, event.detail.value);
                // A block's name is the key its tiles, menu entries and rules refer to it by.
                if (node.kind === "block") next = renameBlockEverywhere(next, value?.name, event.detail.value?.name);
                this._change(next, null);
              }}
            ></home-dashboard-editor-props>
            ${this._renderPageLink(node, value)}
            ${this._renderDeviceWindow(node, value)}
            ${this._renderPartList(node)}`
          : html`<textarea
                data-yaml
                wrap="off"
                spellcheck="false"
                .value=${this._yamlText ?? this._dump(value)}
                @input=${(event) => this._typeYaml(event.target.value)}
              ></textarea>
              ${this._yamlError ? html`<div class="problem" data-yaml-error>${this._yamlError}</div>` : nothing}`}
      </aside>
    `;
  }

  /**
   * What a list holds (the tiles of a section or of a room's Home, the favourites, the parts of a block): a row each,
   * a click opens it in its form, with buttons to move and remove it in place.
   */
  /**
   * What a tile of a room opens: the dashboard's own window, a card of Home Assistant in its place (for this entity
   * everywhere), or a block built from the tile. A tile that is a block, or opens one, has its own forms.
   */
  _renderDeviceWindow(node, value) {
    if (node.kind !== "tile" || !value?.entity || value.kind || value.shortcut) return nothing;
    const entity = value.entity;
    const card = this._strategy.entities?.overrides?.[entity]?.card;
    const setCard = (text) => {
      let parsed;
      try {
        parsed = text.trim() ? this._yaml.load(text) : null;
      } catch (error) {
        this._cardError = error.reason ?? error.message;
        return;
      }
      if (parsed !== null && (typeof parsed !== "object" || Array.isArray(parsed) || !parsed.type)) {
        this._cardError = this._t("editor_device_card_type");
        return;
      }
      this._cardError = null;
      this._change(withEntityCard(this._strategy, entity, parsed), `card:${entity}`);
    };
    const toBlock = () => {
      this._change(setAt(this._strategy, node.path, tileAsBlock(this.hass, value)));
      this._selectPath(node.path);
    };
    return html`<div class="device-window" data-device-window>
      <h4>${this._t("editor_device_window")}</h4>
      <p class="hint">${this._t("editor_device_window_hint")}</p>
      <label class="device-card">
        <span>${this._t("editor_entities_card")} <code>entities.overrides.${entity}.card</code></span>
        <textarea
          data-device-card
          rows="4"
          spellcheck="false"
          placeholder=${`type: custom:lamp-card
entity: ${entity}`}
          .value=${card ? this._dump(card) : ""}
          @change=${(event) => setCard(event.target.value)}
        ></textarea>
      </label>
      ${this._cardError ? html`<p class="hint problem" data-device-card-error>${this._cardError}</p>` : nothing}
      <small class="hint">${this._t("editor_device_card_hint")}</small>
      <button class="open" data-tile-to-block @click=${toBlock}>
        <ha-icon icon="mdi:view-dashboard-edit-outline"></ha-icon><span>${this._t("editor_tile_to_block")}</span>
      </button>
      <small class="hint">${this._t("editor_tile_to_block_hint")}</small>
    </div>`;
  }

  /** A block that opens a page (Media, Music, Map, Energy): what is on that page is edited in its settings. */
  _renderPageLink(node, value) {
    const key = node.kind === "block" ? PAGE_SETTINGS[value?.page] : null;
    if (!key) return nothing;
    const page = this._t(`editor_tree_${key}`);
    return html`<div class="page-link" data-page-link=${key}>
      <p class="hint">${this._t("editor_page_link_hint", { page })}</p>
      <button class="open" data-page-link-open @click=${() => this._selectPath([key])}>
        <ha-icon icon="mdi:arrow-right"></ha-icon><span>${this._t("editor_page_link_open", { page })}</span>
      </button>
    </div>`;
  }

  _renderPartList(node) {
    const listPath = node.tilesPath ?? (node.kind === "block-list" || node.key === "favorites" ? node.path : null);
    if (!listPath) return nothing;
    const parts = (node.children ?? []).filter((child) => child.path.slice(0, -1).join("/") === listPath.join("/"));
    const move = (child, delta) => {
      const index = child.path.at(-1);
      const target = index + delta;
      if (target < 0 || target >= parts.length) return;
      this._change(moveItem(this._strategy, child.path, listPath, delta > 0 ? target + 1 : target));
      this._selectPath(node.path);
    };
    const remove = (child) => {
      this._change(removeAt(this._strategy, child.path));
      this._selectPath(node.path);
    };
    return html`<div class="part-list" data-part-list>
      <p class="hint">${this._t(parts.length ? "editor_parts_hint" : "editor_parts_empty")}</p>
      ${parts.map(
        (child, index) => html`<div class="part ${child.problems?.length ? "problem-row" : ""}" data-part=${child.key}>
          <button class="open" data-part-open @click=${() => this._selectPath(child.path)}>
            <ha-icon .icon=${child.icon ?? "mdi:shape-outline"}></ha-icon>
            <span>${child.label}</span>
            ${child.kind === "tile" && getAt(this._strategy, child.path)?.entity
              ? html`<code>${getAt(this._strategy, child.path).entity}</code>`
              : nothing}
          </button>
          <button class="icon" data-part-up title=${this._t("editor_action_up")} ?disabled=${index === 0} @click=${() => move(child, -1)}>
            <ha-icon icon="mdi:arrow-up"></ha-icon>
          </button>
          <button class="icon" data-part-down title=${this._t("editor_action_down")} ?disabled=${index === parts.length - 1}
            @click=${() => move(child, 1)}><ha-icon icon="mdi:arrow-down"></ha-icon></button>
          <button class="icon" data-part-remove title=${this._t("editor_action_remove")} @click=${() => remove(child)}>
            <ha-icon icon="mdi:delete-outline"></ha-icon>
          </button>
        </div>`,
      )}
    </div>`;
  }

  /** The buttons for what is chosen: add inside it, duplicate, move, remove. */
  _renderActions(node) {
    const list = node.path.slice(0, -1);
    const index = node.path.at(-1);
    const movable = ["tile", "favorite", "room", "stat", "action", "panel-group", "row"].includes(node.kind) || isRoomSection(node);
    const length = movable ? (getAt(this._strategy, list) ?? []).length : 0;
    const button = (name, icon, action, disabled = false) => html`<button
      class="ghost"
      data-action=${name}
      title=${this._t(`editor_action_${name}`)}
      ?disabled=${disabled}
      @click=${action}
    >
      <ha-icon .icon=${icon}></ha-icon>${this._t(`editor_action_${name}`)}
    </button>`;
    const tiles = node.tilesPath ?? (node.key === "favorites" ? ["favorites"] : null);
    return html`
      <div class="actions" data-actions>
        ${node.kind === "room" ? button("add_section", "mdi:plus-box-outline", () => this._addSection(node.path)) : nothing}
        ${["tile", "stat", "action", "row"].includes(node.kind) ? button("duplicate", "mdi:content-copy", () => this._duplicate(node)) : nothing}
        ${node.kind === "block-list" && node.list === "groups"
          ? button("add_group", "mdi:plus-box-outline", () => this._addPart([...node.path], { title: this._t("editor_new_group"), rows: [] }))
          : nothing}
        ${movable
          ? html`${button("up", "mdi:arrow-up", () => this._shift(node, -1), index === 0)}
            ${button("down", "mdi:arrow-down", () => this._shift(node, 1), index >= length - 1)}
            ${button("remove", "mdi:delete-outline", () => this._remove(node))}`
          : nothing}
      </div>
      ${this._renderPartAdder(node)}
      ${tiles
        ? html`<form
            class="add-tile"
            data-add-tile
            @submit=${(event) => {
              event.preventDefault();
              const input = event.target.querySelector("input");
              this._addTile(tiles, input.value);
              input.value = "";
            }}
          >
            <input list="hd-add-entities" placeholder=${this._t("editor_add_tile_entity")} />
            <datalist id="hd-add-entities">
              ${Object.keys(this.hass.states)
                .sort()
                .map((id) => html`<option value=${id}>${this.hass.states[id].attributes?.friendly_name ?? id}</option>`)}
            </datalist>
            <button type="submit"><ha-icon icon="mdi:plus"></ha-icon>${this._t("editor_action_add_tile")}</button>
          </form>
          <button class="pick" data-action="pick" @click=${() => this._openPicker(node, tiles)}>
            <ha-icon icon="mdi:format-list-checks"></ha-icon>${this._t("editor_action_pick")}
          </button>`
        : nothing}
    `;
  }

  static styles = css`
    /* The dark look; the light one (data-theme="light") changes the same colours below. */
    :host {
      color-scheme: dark;
      --bg: #111318;
      --panel: #1b1e24;
      --panel2: #23272e;
      --line: #2f343c;
      --text: #e8eaed;
      --muted: #9aa0a6;
      --accent: #4f8cff;
      --amber: #ffb340;
      --red: #ff453a;
      --green: #30d158;
      --field: #0d1117;
      --on: #3a3f48;
      --hover: rgba(255, 255, 255, 0.04);
      --faint: #7d8590;
      --added: #7ee2a8;
      --removed: #ff9a92;
      --accent-text: #cfe0ff;
      --link: #7fb2ff;
      --warn-text: #ffd99a;
      --scrim: rgba(0, 0, 0, 0.5);
      --shadow: rgba(0, 0, 0, 0.6);
      --stage-top: #1e2633;
      --stage-bottom: #0e1014;
      display: flex;
      flex-direction: column;
      height: 100vh;
      color: var(--text);
      background: var(--bg);
      font: 14px/1.4 -apple-system, "SF Pro Text", Roboto, system-ui, sans-serif;
      --mdc-icon-size: 18px;
    }
    :host([data-theme="light"]) {
      color-scheme: light;
      --bg: #f2f3f7;
      --panel: #ffffff;
      --panel2: #eceef3;
      --line: #d5d9e0;
      --text: #1d2026;
      --muted: #5f6670;
      --accent: #2f6fe4;
      --amber: #a15c00;
      --red: #d0021b;
      --green: #1c7f37;
      --field: #ffffff;
      --on: #ffffff;
      --hover: rgba(0, 0, 0, 0.04);
      --faint: #8a9099;
      --added: #1c7f37;
      --removed: #c62828;
      --accent-text: #1f4fb0;
      --link: #2f6fe4;
      --warn-text: #8a5a00;
      --scrim: rgba(0, 0, 0, 0.3);
      --shadow: rgba(0, 0, 0, 0.18);
      --stage-top: #e9edf5;
      --stage-bottom: #d9dee8;
    }
    button,
    select {
      font: inherit;
      color: inherit;
      border: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border-radius: 9px;
      background: var(--panel2);
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    button.primary {
      background: var(--accent);
      color: #fff;
      font-weight: 600;
    }
    button.ghost {
      background: transparent;
      color: var(--muted);
    }
    button.on {
      background: var(--on);
    }
    .top {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: var(--panel);
      border-bottom: 1px solid var(--line);
    }
    button.menu {
      padding: 6px;
      --mdc-icon-size: 22px;
    }
    /* ⚙: the pop-up under the button, its right edge at the button's. */
    .gear-wrap {
      position: relative;
      display: inline-flex;
    }
    .gear-pop {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: 30;
      min-width: 280px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      border-radius: 12px;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: 0 10px 30px var(--shadow);
    }
    .gear-pop .pop-title {
      font-size: 14px;
      padding: 2px 4px 4px;
    }
    .gear-pop .pop-label {
      color: var(--muted);
      font-size: 12px;
      padding: 0 4px;
    }
    .gear-pop .seg button {
      flex: 1;
      justify-content: center;
      white-space: nowrap;
    }
    .gear-pop .pop-link {
      justify-content: flex-start;
      margin-top: 4px;
      background: transparent;
      border-top: 1px solid var(--line);
      border-radius: 0 0 8px 8px;
    }
    .app-icon {
      --mdc-icon-size: 22px;
      color: var(--accent);
      flex: none;
    }
    h1 {
      margin: 0 8px 0 0;
      font-size: 16px;
    }
    .board {
      color: var(--muted);
    }
    .grow {
      flex: 1;
    }
    .pill {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      color: var(--muted);
      background: var(--panel2);
    }
    .pill.review {
      color: var(--accent-text);
      background: rgba(79, 140, 255, 0.18);
    }
    .pill.review button {
      padding: 0 4px;
      font-size: 12px;
    }
    .pill.draft {
      color: var(--amber);
      background: rgba(255, 179, 64, 0.15);
    }
    .node.unavailable {
      cursor: default;
      opacity: 0.5;
    }
    .node.unavailable .label small {
      display: block;
      font-size: 11px;
      color: var(--muted);
      white-space: normal;
    }
    .node.unavailable .needs {
      --mdc-icon-size: 16px;
      color: var(--muted);
    }
    .pill.variant {
      color: var(--accent-text);
      background: rgba(79, 140, 255, 0.18);
      font-weight: 600;
    }
    .pill.variant .sub {
      font-weight: 400;
      opacity: 0.8;
    }
    .pill.variant button {
      padding: 0 6px;
      font-size: 12px;
    }
    .notice {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 8px 16px;
      background: rgba(79, 140, 255, 0.15);
    }
    .notice.conflict,
    .notice.error {
      background: rgba(255, 69, 58, 0.15);
    }
    .notice span {
      flex: 1;
    }
    .cols {
      flex: 1;
      display: grid;
      grid-template-columns: var(--left) 6px minmax(0, 1fr) 6px var(--right);
      min-height: 0;
    }
    .tree,
    .props {
      overflow: auto;
      background: var(--panel);
    }
    .tree {
      padding: 10px 8px;
    }
    .props {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 16px;
    }
    .search {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 0 4px 6px;
      padding: 6px 10px;
      border-radius: 9px;
      color: var(--muted);
      background: var(--panel2);
    }
    .search input {
      flex: 1;
      border: 0;
      outline: none;
      color: var(--text);
      background: transparent;
      font: inherit;
    }
    .group {
      display: flex;
      gap: 4px;
      align-items: center;
      margin: 14px 8px 6px 0;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .group-name {
      flex: 1;
      cursor: pointer;
      user-select: none;
    }
    .node {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      border-radius: 8px;
      cursor: pointer;
    }
    .node:hover {
      background: var(--hover);
    }
    .node.sel {
      background: rgba(79, 140, 255, 0.18);
      outline: 1px solid rgba(79, 140, 255, 0.5);
    }
    ha-icon {
      display: inline-flex;
      min-width: 18px;
      min-height: 18px;
    }
    .node .icon {
      color: var(--muted);
    }
    .node.warn .icon {
      color: var(--amber);
    }
    .node .label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .node .count {
      font-size: 12px;
      color: var(--muted);
    }
    /* Hidden in the editor: still in the configuration, greyed here, not on the page. */
    .node.hidden .icon,
    .node.hidden .label,
    .node.hidden .count {
      opacity: 0.45;
    }
    .node .eye {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      /* As high as the fold arrow: the rows of the tree keep their height. */
      width: 20px;
      height: 18px;
      padding: 0;
      border-radius: 6px;
      background: none;
      color: var(--muted);
      opacity: 0;
      --mdc-icon-size: 16px;
    }
    .node:hover .eye,
    .node.sel .eye,
    .node .eye.on,
    .node .eye:focus-visible {
      opacity: 1;
    }
    .node .eye.on {
      color: var(--amber);
    }
    @media (hover: none) {
      .node .eye {
        opacity: 1;
      }
    }
    .fold {
      flex: none;
      justify-content: center;
      width: 18px;
      height: 18px;
      padding: 0;
      background: none;
      color: var(--muted);
    }
    .stage {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      background: radial-gradient(1200px 600px at 50% -10%, var(--stage-top), var(--stage-bottom));
    }
    .stage-tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 10px 16px;
    }
    .seg {
      display: flex;
      gap: 2px;
      padding: 3px;
      border-radius: 9px;
      background: var(--panel2);
    }
    .seg button {
      padding: 4px 10px;
      background: transparent;
      color: var(--muted);
    }
    .seg button.on {
      background: var(--on);
      color: var(--text);
    }
    .as {
      display: flex;
      gap: 6px;
      align-items: center;
      color: var(--muted);
    }
    /* The lists of phones and tablets name every model of a size; shut, they keep to a width, open they show all. */
    [data-phone-size],
    [data-tablet-size] {
      max-width: 210px;
      text-overflow: ellipsis;
    }
    .frames {
      flex: 1;
      display: flex;
      gap: ${STAGE_GAP}px;
      align-items: flex-start;
      justify-content: center;
      min-height: 0;
      padding: 8px ${STAGE_PADDING}px ${STAGE_PADDING}px;
    }
    .device {
      flex: none;
      margin: 0;
    }
    .bezel {
      overflow: hidden;
      margin: 0 auto;
      border: ${FRAME_BORDER}px solid #000;
      border-radius: 28px;
      background: #000;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
      box-sizing: content-box;
    }
    .device.tablet .bezel {
      border-radius: 22px;
    }
    iframe {
      display: block;
      border: 0;
      transform-origin: 0 0;
      background: #fff;
    }
    figcaption {
      margin-top: 8px;
      text-align: center;
      font-size: 12px;
      color: var(--muted);
    }
    .splitter {
      cursor: col-resize;
      background: var(--line);
      touch-action: none;
      transition: background 120ms;
    }
    .splitter:hover,
    .splitter.dragging {
      background: var(--accent);
    }
    .group .add {
      padding: 0 4px;
    }
    .start {
      justify-content: center;
      width: calc(100% - 8px);
      margin: 4px;
      color: var(--accent-text);
      background: rgba(79, 140, 255, 0.18);
    }
    .empty button {
      margin-top: 12px;
    }
    .node.drop-before {
      box-shadow: inset 0 2px 0 var(--accent);
    }
    .node.drop-into {
      outline: 2px dashed var(--accent);
    }
    .node[draggable="true"] {
      cursor: grab;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .actions button {
      padding: 4px 8px;
      font-size: 12px;
    }
    .tabs {
      display: flex;
      gap: 2px;
      border-bottom: 1px solid var(--line);
    }
    .tabs button {
      padding: 6px 10px;
      border-radius: 0;
      background: transparent;
      color: var(--muted);
      border-bottom: 2px solid transparent;
    }
    .tabs button.on {
      color: var(--text);
      border-color: var(--accent);
    }
    .add-tile {
      display: flex;
      gap: 6px;
    }
    .pick {
      justify-content: center;
    }
    .device-window {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 4px 0 14px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 11px;
    }
    .device-window h4 {
      margin: 0;
      font-size: 13px;
    }
    .device-window .device-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .device-window .device-card code {
      display: block;
      color: var(--muted);
      font-size: 11px;
      overflow-wrap: anywhere;
    }
    .device-window textarea {
      min-height: 72px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel2);
      color: var(--text);
      font: 12px/1.4 ui-monospace, Menlo, monospace;
      resize: vertical;
    }
    .device-window .open {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: var(--panel2);
      color: var(--text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .block-kinds {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 2px 8px 8px;
    }
    .block-kinds .start {
      justify-content: flex-start;
      gap: 8px;
    }
    .page-link {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    .page-link .open {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: var(--panel2);
      color: var(--text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .part-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .part {
      display: flex;
      align-items: center;
      gap: 2px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: var(--panel2);
    }
    .part.problem-row {
      border-color: var(--amber);
    }
    .part .open {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 7px 10px;
      border: 0;
      background: none;
      color: var(--text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .part .open span {
      flex: none;
      max-width: 50%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .part .open code {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 11px;
      color: var(--muted);
    }
    .part .icon {
      padding: 6px;
      border: 0;
      background: none;
      color: var(--muted);
      cursor: pointer;
      --mdc-icon-size: 18px;
    }
    .part .icon:disabled {
      opacity: 0.3;
      cursor: default;
    }
    .fit {
      margin-top: 6px;
      text-align: center;
      font-size: 12px;
    }
    .fit.fits {
      color: var(--added);
    }
    .fit.scrolls {
      color: var(--amber);
    }
    .fit.phone {
      color: var(--muted);
    }
    .leftovers {
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: 10px;
    }
    .leftovers summary {
      cursor: pointer;
      font-size: 13px;
    }
    .leftover {
      display: flex;
      width: 100%;
      margin-top: 4px;
      text-align: left;
      background: transparent;
    }
    .leftover span {
      display: flex;
      flex-direction: column;
    }
    .leftover small {
      font-size: 11px;
      color: var(--muted);
    }
    .add-tile input {
      flex: 1;
      min-width: 0;
      padding: 7px 10px;
      border: 1px solid var(--line);
      border-radius: 9px;
      font: inherit;
      color: var(--text);
      background: var(--panel2);
    }
    .help {
      flex: none;
      padding: 4px;
      color: var(--muted);
    }
    .help ha-icon {
      --mdc-icon-size: 18px;
    }
    .help.on {
      color: var(--accent);
    }
    .fold-column {
      flex: none;
      padding: 4px;
    }
    .rail {
      display: flex;
      justify-content: center;
      padding-top: 8px;
      min-width: 0;
      overflow: hidden;
      background: var(--panel);
    }
    .rail button {
      padding: 4px 2px;
    }
    .splitter.off {
      cursor: default;
      pointer-events: none;
    }
    .help-shade {
      position: fixed;
      inset: 0;
      z-index: 20;
    }
    .help-pop {
      position: fixed;
      z-index: 21;
      box-sizing: border-box;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--panel);
      color: var(--text);
      box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
      font-size: 13px;
      line-height: 1.45;
    }
    .help-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .help-head button {
      padding: 2px;
    }
    .help-pop p {
      margin: 6px 0 10px;
    }
    .help-pop a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--accent);
      text-decoration: none;
    }
    .help-pop a ha-icon {
      --mdc-icon-size: 14px;
    }
    .help-pop .help-lesson {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      margin-top: 10px;
      padding: 8px 10px;
      border: 0;
      border-radius: 10px;
      color: #fff;
      background: var(--accent);
      font: inherit;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
    }
    .help-pop .help-lesson[disabled] {
      opacity: 0.5;
      cursor: default;
    }
    .help-pop .help-lesson ha-icon {
      --mdc-icon-size: 16px;
    }
    .tree-tools {
      display: flex;
      gap: 4px;
      margin: 0 4px 6px;
    }
    .tree-tools button {
      padding: 4px 8px;
      font-size: 12px;
    }
    .phead {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .phead small {
      display: block;
      color: var(--muted);
      font-size: 12px;
    }
    textarea {
      flex: 1;
      min-height: 320px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 10px;
      color: var(--text);
      background: var(--field);
      font: 12px/1.6 ui-monospace, Menlo, monospace;
      white-space: pre;
      overflow: auto;
      resize: none;
    }
    .problem {
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 12px;
      color: var(--warn-text);
      background: rgba(255, 179, 64, 0.12);
    }
    .hint,
    .empty {
      color: var(--muted);
      font-size: 12px;
    }
    .empty {
      padding: 40px;
    }
  `;
}

if (!customElements.get(APP_TAG)) customElements.define(APP_TAG, HomeDashboardEditorApp);
