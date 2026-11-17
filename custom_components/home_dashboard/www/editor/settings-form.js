// The forms of the settings of a dashboard (the nodes under Settings in the tree). A setting may live in several
// places of the configuration (the status bar: its look in `appearance.status`, its facts in `status_panel`), so a
// form is made of sections, each with the path it writes and the fields of the schema form (schema-form.js). A
// section left empty takes its key out, and a mapping left empty above it too, so the configuration stays as short
// as if written by hand.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { APPEARANCE_FIELDS, NAV_PAGES, NAV_RANGE, STATUS_PARTS, TILE_KINDS } from "../app/appearance.js";
import { BLOCK_KINDS, STATE_WORDS } from "../app/block-editor.js";
import { translate } from "../app/i18n.js";
import { getAt, setAt } from "./tree.js";
import "./schema-form.js";
import "./access-form.js";

const TAG = "home-dashboard-editor-settings";

const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && !value.length) ||
  (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length);

function withoutKey(value, path) {
  if (!path.length) return value;
  const parent = getAt(value, path.slice(0, -1));
  if (!parent || typeof parent !== "object") return value;
  const { [path.at(-1)]: dropped, ...rest } = parent;
  return path.length === 1 ? rest : setAt(value, path.slice(0, -1), rest);
}

// Keys of a section holding nothing (an empty list or mapping) go; what is deeper stays, as a camera just added with
// nothing set yet.
function pruned(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => !isEmpty(entry)));
}

/** The configuration with a section written at its path; an empty one goes, and the mappings it leaves empty. */
export function withSection(strategy, path, value, prune = true) {
  const clean = prune ? pruned(value) : value;
  let next = isEmpty(clean) ? withoutKey(strategy, path) : setAt(strategy, path, clean);
  for (let depth = path.length - 1; depth > 0; depth -= 1) {
    const parent = path.slice(0, depth);
    if (!isEmpty(getAt(next, parent))) break;
    next = withoutKey(next, parent);
  }
  return next;
}

/** The fields of the menu: an entry opens a block chosen from those there are (one written by hand stays listed). */
export function menuFields(strategy) {
  const written = (strategy?.menu?.groups ?? []).flatMap((group) => group?.items ?? []).map((item) => item?.shortcut);
  const options = [...new Set([...blockNames(strategy), ...written.filter(Boolean)])];
  const items = (field) =>
    field.fields.map((item) =>
      item.key === "shortcut" ? { ...item, type: "select", options, helpKey: "editor_menu_shortcut_hint" } : item,
    );
  return BLOCK_KINDS.menu.map((group) =>
    group.key !== "groups" ? group : { ...group, fields: group.fields.map((field) => (field.key === "items" ? { ...field, fields: items(field) } : field)) },
  );
}

const blockNames = (strategy) => (strategy?.shortcuts ?? []).map((block) => block?.name).filter(Boolean);

// The first of the keys the language knows (the look's own words on the tablet), else the editor's.
const known = (language, keys) => keys.find((key) => translate(language, key) !== key) ?? keys.at(-1);
// Words the tablet keeps under another key.
const SAME_WORDS = { blur: "look_nav_blur", paused_minutes: "look_player_paused" };
// Parts of the look with a form of their own: the status bar (its node) and the navigation bar (with the menu).
const OWN_NODES = ["status", "nav"];

/** A field of the schema form for a field of the look (www/app/appearance.js says what each is). */
export function lookField(group, key, spec, language) {
  const labelKey = known(language, [
    group ? `look_${group}_${key}` : `look_${key}`,
    `look_${key}_short`,
    `look_${key}`,
    SAME_WORDS[key] ?? "",
    `editor_look_${group ? `${group}_` : ""}${key}`,
  ].filter(Boolean));
  const hint = `look_${group ? `${group}_` : ""}${key}_hint`;
  const helpKey = translate(language, hint) !== hint ? hint : undefined;
  const base = { key, labelKey, helpKey };
  if (spec.kind === "number") return { ...base, type: "number", min: spec.low, max: spec.high, placeholder: String(spec.fallback) };
  if (spec.kind === "colour" || spec.kind === "paint") return { ...base, type: "colour" };
  if (spec.kind === "flag") return { ...base, type: "boolean", default: spec.fallback };
  if (spec.kind === "choice") {
    const optionKey = `look_${group}`;
    const named = spec.values.every((value) => translate(language, `${optionKey}_${value}`) !== `${optionKey}_${value}`);
    return {
      ...base,
      type: "select",
      options: spec.values.map(String),
      numeric: spec.values.every((value) => typeof value === "number"),
      optionKey: named ? optionKey : undefined,
      emptyKey: "editor_look_default",
    };
  }
  return { ...base, type: "yaml" };
}

/** The look in sections, one per part of it, drawn from its fields; the status bar and the bar of pages have nodes of their own. */
// Pages with a background of their own: Home, Scenes, Map, Energy and every room.
const BACKGROUND_PAGES = ["home", "scenes", "map", "energy"];
const BACKGROUND_LOOKS = ["light", "dark", "light_wide", "dark_wide"];

/** The backgrounds of pages: a page each, unfolded to its picture or colour in each look. */
export function backgroundsField(strategy) {
  const rooms = (strategy?.layout ?? []).filter((room) => room?.id);
  return {
    key: "backgrounds",
    type: "keyed",
    labelKey: "editor_look_backgrounds",
    helpKey: "editor_look_backgrounds_hint",
    addKey: "editor_look_backgrounds_add",
    keyOptions: [...BACKGROUND_PAGES, ...rooms.map((room) => room.id)],
    keyLabels: Object.fromEntries(rooms.map((room) => [room.id, room.name ?? room.id])),
    valueField: {
      key: "background",
      type: "object",
      bothFromText: true,
      maker: true,
      labelKey: "editor_look_background",
      fields: [
        ...BACKGROUND_LOOKS.map((look) => ({
          key: look,
          type: "background",
          labelKey: `editor_look_background_${look}`,
          placeholder: look.startsWith("light") ? "#f3f1ec" : "#121316",
        })),
        { key: "position", type: "select", options: ["top", "bottom"], optionKey: "editor_look_background", labelKey: "editor_look_background_position", emptyKey: "editor_look_background_middle" },
      ],
    },
  };
}

export function lookSections(strategy, language) {
  const sections = Object.entries(APPEARANCE_FIELDS)
    .filter(([group]) => !OWN_NODES.includes(group))
    .map(([group, fields]) => ({
      key: group || "general",
      titleKey: known(language, [`look_group_${group}`, `editor_look_group_${group || "general"}`]),
      hintKey: known(language, [`look_${group}_hint`, ""]) || undefined,
      path: group ? ["appearance", group] : ["appearance"],
      fields: Object.entries(fields).map(([key, spec]) => lookField(group, key, spec, language)),
    }));
  const tiles = sections.find((section) => section.key === "tiles");
  tiles.fields.push({
    key: "colours",
    type: "object",
    labelKey: "editor_look_colours",
    helpKey: "look_colours_hint",
    fields: TILE_KINDS.map((kind) => ({ key: kind, type: "colour", labelKey: `look_kind_${kind}` })),
  });
  sections.find((section) => section.key === "general").fields.push({
    key: "icons",
    type: "map",
    labelKey: "editor_look_icons",
    helpKey: "editor_look_icons_hint",
    placeholder: "mdi:lamp",
    valueIcon: true,
    seed: "mdi:circle",
  });
  const themes = (strategy?.themes ?? []).map((theme) => theme?.id).filter(Boolean);
  sections.push({
    key: "themes",
    titleKey: "editor_look_group_themes",
    path: [],
    fields: [
      { key: "theme", type: "select", options: themes, labelKey: "editor_look_theme", helpKey: "editor_look_theme_hint", emptyKey: "editor_look_default" },
      { key: "themes", type: "yaml", labelKey: "editor_look_themes", helpKey: "editor_look_themes_hint" },
      backgroundsField(strategy),
    ],
  });
  return sections;
}

/** The sections of each setting's form: a title, the path it writes and its fields. */
/** The bar of pages: its places (pages, the scenes, the menu, rooms) in order, and its look. */
export function navSections(strategy, language) {
  const rooms = (strategy?.layout ?? []).filter((room) => room?.id);
  const labels = {
    scenes: translate(language, "personal_scenes"),
    menu: translate(language, "menu"),
    ...Object.fromEntries(rooms.map((room) => [`room:${room.id}`, `${translate(language, "nav_room")}: ${room.name ?? room.id}`])),
  };
  const look = Object.entries(APPEARANCE_FIELDS.nav)
    .filter(([key]) => key !== "items")
    .map(([key, spec]) => lookField("nav", key, spec, language));
  return [
    {
      key: "nav",
      titleKey: "editor_tree_nav",
      path: ["appearance", "nav"],
      fields: [
        {
          key: "items",
          type: "order",
          options: [...NAV_PAGES, ...rooms.map((room) => `room:${room.id}`)],
          optionKey: "nav",
          labels,
          defaults: ["home", strategy?.music ? "music" : "media", "energy", "map"],
          min: NAV_RANGE[0],
          max: NAV_RANGE[1],
          labelKey: "editor_nav_items",
          helpKey: "editor_nav_items_hint",
        },
        ...look,
      ],
    },
  ];
}

const E = (key, labelKey, extra = {}) => ({ key, type: "entity", labelKey, ...extra });
const ES = (key, labelKey, extra = {}) => ({ key, type: "entities", labelKey, ...extra });

/** The cameras: which are shown and in what order, the rules of privacy, and the settings of single cameras. */
export const cameraSections = () => [
  {
    key: "shown",
    titleKey: "editor_cameras_shown",
    path: ["cameras"],
    fields: [
      { key: "snapshot_platforms", type: "strings", labelKey: "editor_cameras_snapshot_platforms", helpKey: "editor_cameras_snapshot_platforms_hint", placeholder: "frigate" },
      { key: "battery_platforms", type: "strings", labelKey: "editor_cameras_battery_platforms", helpKey: "editor_cameras_battery_platforms_hint" },
      ES("order", "editor_cameras_order"),
      ES("hide", "editor_cameras_hide"),
      E("hero", "editor_cameras_hero", { helpKey: "editor_cameras_hero_hint" }),
      ES("tiles", "editor_cameras_tiles"),
      { key: "columns", type: "number", min: 2, max: 5, placeholder: "3", labelKey: "editor_cameras_columns" },
      { key: "layout", type: "select", options: ["grid", "featured"], optionKey: "editor_cameras_layout", labelKey: "editor_cameras_layout", emptyKey: "editor_look_default" },
      { key: "recordings_folder", type: "text", labelKey: "editor_cameras_recordings_folder", helpKey: "editor_cameras_recordings_folder_hint" },
    ],
  },
  {
    key: "privacy",
    titleKey: "editor_cameras_privacy",
    path: ["cameras"],
    fields: [
      {
        key: "private",
        type: "list",
        labelKey: "editor_cameras_private",
        helpKey: "editor_cameras_private_hint",
        fields: [
          E("entity", "editor_cameras_rule_entity"),
          ES("hide", "editor_cameras_rule_hide"),
          { key: "users", type: "users", labelKey: "editor_cameras_rule_users" },
          { key: "except", type: "users", labelKey: "editor_cameras_rule_except" },
        ],
      },
      {
        key: "guest",
        type: "object",
        labelKey: "editor_cameras_guest",
        helpKey: "editor_cameras_guest_hint",
        fields: [
          E("entity", "editor_cameras_rule_entity"),
          ES("hide", "editor_cameras_rule_hide"),
          { key: "users", type: "users", labelKey: "editor_cameras_rule_users" },
        ],
      },
    ],
  },
  {
    key: "single",
    titleKey: "editor_cameras_single",
    path: ["cameras"],
    fields: [
      { key: "live", type: "map", valueList: "entities", labelKey: "editor_cameras_live", helpKey: "editor_cameras_live_hint", placeholder: "camera.…" },
      { key: "controls", type: "map", valueList: "entities", labelKey: "editor_cameras_controls", helpKey: "editor_cameras_controls_hint", placeholder: "camera.…" },
      { key: "talk", type: "select", options: ["intercom", "camera"], optionKey: "editor_cameras_talk", labelKey: "editor_cameras_talk", emptyKey: "editor_look_default" },
      { key: "talk_with", type: "map", labelKey: "editor_cameras_talk_with", helpKey: "editor_cameras_talk_with_hint", placeholder: "auto, go2rtc, intercom, none" },
      { key: "clip_picker", type: "select", options: ["bar", "zoom"], optionKey: "editor_cameras_clip_picker", labelKey: "editor_cameras_clip_picker", emptyKey: "editor_look_default" },
      { key: "clip_picker_with", type: "map", labelKey: "editor_cameras_clip_picker_with", helpKey: "editor_cameras_clip_picker_with_hint", placeholder: "bar, zoom" },
      {
        key: "quick",
        type: "keyed",
        labelKey: "editor_cameras_quick",
        helpKey: "editor_cameras_quick_hint",
        valueField: { key: "buttons", type: "object", labelKey: "editor_cameras_quick", fields: [E("siren", "editor_cameras_siren"), E("light", "editor_cameras_light"), E("night", "editor_cameras_night")] },
      },
      {
        key: "ptz",
        type: "keyed",
        labelKey: "editor_cameras_ptz",
        helpKey: "editor_cameras_ptz_hint",
        seed: { mode: "auto" },
        valueField: {
          key: "turning",
          type: "object",
          labelKey: "editor_cameras_ptz",
          fields: [
            { key: "mode", type: "select", options: ["auto", "eufy", "onvif", "manual", "none"], labelKey: "editor_cameras_ptz_mode" },
            E("left", "editor_cameras_left"),
            E("right", "editor_cameras_right"),
            E("up", "editor_cameras_up"),
            E("down", "editor_cameras_down"),
            E("select", "editor_cameras_ptz_select"),
            E("button", "editor_cameras_ptz_button"),
            { key: "presets", type: "strings", labelKey: "editor_cameras_presets" },
          ],
        },
      },
      {
        key: "settings",
        type: "keyed",
        seed: [],
        labelKey: "editor_cameras_settings",
        helpKey: "editor_cameras_settings_hint",
        valueField: ES("entities", "editor_cameras_settings_entities"),
      },
    ],
  },
];

export const intercomSections = () => [
  {
    key: "intercom",
    titleKey: "editor_tree_intercom",
    hintKey: "editor_intercom_hint",
    path: ["intercom"],
    fields: [
      { key: "script", type: "text", placeholder: "script.komunikat", labelKey: "editor_intercom_script", helpKey: "editor_intercom_script_hint" },
      { key: "areas", type: "areas", labelKey: "editor_intercom_areas", helpKey: "editor_intercom_areas_hint" },
      { key: "areas_field", type: "text", placeholder: "areas", labelKey: "editor_intercom_areas_field" },
      { key: "text_field", type: "text", placeholder: "text", labelKey: "editor_intercom_text_field" },
      { key: "file_field", type: "text", placeholder: "file", labelKey: "editor_intercom_file_field" },
      { key: "played_field", type: "text", labelKey: "editor_intercom_played_field" },
      { key: "upload", type: "text", labelKey: "editor_intercom_upload", helpKey: "editor_intercom_upload_hint" },
      { key: "media_folder", type: "text", labelKey: "editor_intercom_media_folder", helpKey: "editor_intercom_media_folder_hint" },
    ],
  },
];

export const energySections = (strategy) => [
  {
    key: "energy",
    titleKey: "editor_tree_energy",
    path: ["energy"],
    fields: [
      {
        key: "phases",
        type: "list",
        labelKey: "editor_energy_phases",
        helpKey: "editor_energy_phases_hint",
        fields: [E("power", "editor_energy_power"), E("voltage", "editor_energy_voltage"), E("current", "editor_energy_current"), E("factor", "editor_energy_factor")],
      },
      { key: "voltage_range", type: "numbers", placeholder: "207, 253", labelKey: "editor_energy_voltage_range" },
      {
        key: "storage",
        type: "list",
        labelKey: "editor_energy_storage",
        helpKey: "editor_energy_storage_hint",
        fields: [
          { key: "block", type: "select", options: blockNames(strategy), labelKey: "editor_status_block" },
          { key: "name", type: "text" },
          { key: "icon", type: "icon" },
          E("battery", "editor_energy_battery"),
          E("state", "editor_energy_state"),
          { key: "labels", ...STATE_WORDS, labelKey: "editor_energy_labels" },
          E("input", "editor_energy_input"),
          E("output", "editor_energy_output"),
          E("remaining", "editor_energy_remaining"),
        ],
      },
    ],
  },
];

/** What each person does not see (`access`), and who sees a tile or a block (`visibility`). */
export const accessSections = (strategy) => {
  const blocks = blockNames(strategy);
  const entities = Object.keys(strategy?.visibility ?? {});
  return [
    { key: "people", titleKey: "access_title", hintKey: "editor_access_section_hint", path: ["access"], custom: "access", fields: [] },
    {
      key: "visibility",
      titleKey: "editor_visibility",
      path: [],
      fields: [
        {
          key: "visibility",
          type: "keyed",
          labelKey: "editor_visibility_rules",
          helpKey: "editor_visibility_hint",
          addKey: "editor_visibility_add",
          keyOptions: [...new Set([...blocks.flatMap((name) => [`block:${name}`, `shortcut:${name}`]), ...entities])],
          valueField: {
            key: "rule",
            type: "object",
            labelKey: "editor_visibility_rule",
            fields: [
              { key: "only", type: "users", labelKey: "editor_visibility_only" },
              { key: "except", type: "users", labelKey: "editor_visibility_except" },
            ],
          },
        },
      ],
    },
  ];
};

/** The rooms of the dashboard and the areas of Home Assistant, by id, with their names. */
function roomChoices(strategy, hass) {
  const names = {};
  for (const area of Object.values(hass?.areas ?? {})) names[area.area_id] = area.name;
  for (const room of strategy?.layout ?? []) if (room?.id) names[room.id] = room.name ?? room.id;
  return names;
}

export const roomOrderSections = (strategy, language, hass) => {
  const names = roomChoices(strategy, hass);
  const options = Object.keys(names);
  return [
    {
      key: "rooms",
      titleKey: "editor_tree_rooms_order",
      path: ["rooms"],
      fields: [
        { key: "order", type: "order", options, labels: names, labelKey: "editor_rooms_order", helpKey: "editor_rooms_order_hint" },
        { key: "hidden", type: "choices", options, labels: names, labelKey: "editor_rooms_hidden", helpKey: "editor_rooms_hidden_hint" },
      ],
    },
  ];
};

export const entitySections = (strategy, language, hass) => {
  const names = roomChoices(strategy, hass);
  return [
    {
      key: "entities",
      titleKey: "editor_tree_entities",
      path: ["entities"],
      fields: [
        {
          key: "include",
          type: "keyed",
          labelKey: "editor_entities_include",
          helpKey: "editor_entities_include_hint",
          addKey: "editor_entities_add_room",
          keyOptions: Object.keys(names),
          seed: [],
          valueField: { key: "entities", type: "entities", labelKey: "editor_cameras_settings_entities" },
        },
        { key: "exclude", type: "entities", labelKey: "editor_entities_exclude", helpKey: "editor_entities_exclude_hint" },
        {
          key: "overrides",
          type: "keyed",
          labelKey: "editor_entities_overrides",
          helpKey: "editor_entities_overrides_hint",
          valueField: {
            key: "override",
            type: "object",
            labelKey: "editor_entities_overrides",
            fields: [
              { key: "area", type: "select", options: Object.keys(names), labelKey: "editor_entities_area" },
              { key: "name", type: "text" },
              { key: "icon", type: "icon" },
              { key: "light", type: "boolean", labelKey: "editor_entities_light", helpKey: "editor_entities_light_hint" },
              { key: "card", type: "yaml", labelKey: "editor_entities_card" },
            ],
          },
        },
      ],
    },
  ];
};

export const homeSections = () => [
  {
    key: "weather",
    titleKey: "editor_home_weather",
    path: ["weather"],
    fields: [E("entity", "editor_home_weather_entity", { helpKey: "editor_home_weather_hint" }), E("forecast", "editor_home_forecast")],
  },
  {
    key: "security",
    titleKey: "editor_home_security",
    path: ["security"],
    fields: [
      { key: "unlock_on_tablet", type: "boolean", labelKey: "editor_home_unlock", helpKey: "editor_home_unlock_hint" },
      {
        key: "group",
        type: "object",
        labelKey: "editor_home_security_group",
        helpKey: "editor_home_security_group_hint",
        fields: [{ key: "name", type: "text" }, ES("entities", "editor_cameras_settings_entities")],
      },
    ],
  },
  {
    key: "idle",
    titleKey: "editor_home_idle",
    path: ["idle"],
    fields: [{ key: "return_after", type: "number", min: 0, placeholder: "180", labelKey: "editor_home_return_after", helpKey: "editor_home_return_after_hint" }],
  },
  {
    key: "scenes",
    titleKey: "editor_home_scenes",
    path: [],
    fields: [{ key: "scenes_layout", type: "select", options: ["row"], optionKey: "editor_home_scenes_layout", labelKey: "editor_home_scenes_layout", emptyKey: "editor_look_default" }],
  },
];

export const SETTINGS_FORMS = {
  room_order: roomOrderSections,
  entities: entitySections,
  lights: () => [
    {
      key: "lights",
      titleKey: "editor_tree_lights",
      path: ["lights"],
      fields: [{ key: "prefer_groups", type: "boolean", default: true, labelKey: "editor_lights_prefer_groups", helpKey: "editor_lights_prefer_groups_hint" }],
    },
  ],
  home_settings: homeSections,
  music: () => [
    {
      key: "music",
      titleKey: "editor_tree_music",
      hintKey: "editor_music_hint",
      path: ["music"],
      fields: [
        { key: "addon", type: "text", list: "addons", labelKey: "editor_music_addon" },
        { key: "frame", type: "text", labelKey: "editor_music_frame" },
        { key: "card", type: "yaml", labelKey: "editor_music_card" },
        { key: "admin_card", type: "boolean", labelKey: "editor_music_admin_card" },
        { key: "fullscreen", type: "boolean", labelKey: "editor_music_fullscreen" },
      ],
    },
  ],
  media: () => [
    {
      key: "media",
      titleKey: "editor_tree_media",
      path: ["media"],
      fields: [
        { key: "group_patterns", type: "lines", placeholder: "^(.+)_homepod(_muzyka)?$", labelKey: "editor_media_group_patterns", helpKey: "editor_media_group_patterns_hint" },
        ...BLOCK_KINDS.media,
      ],
    },
  ],
  map: () => [
    {
      key: "map",
      titleKey: "editor_tree_map",
      path: ["map"],
      fields: [ES("track", "editor_map_track", { helpKey: "editor_map_track_hint" })],
    },
  ],
  access: accessSections,
  cameras: cameraSections,
  intercom: intercomSections,
  energy: energySections,
  appearance: lookSections,
  nav: navSections,
  menu: (strategy) => [
    { key: "menu", titleKey: "editor_tree_menu", hintKey: "editor_menu_hint", path: ["menu"], fields: menuFields(strategy) },
  ],
  status_panel: (strategy) => [
    {
      key: "look",
      titleKey: "look_status_title",
      path: ["appearance", "status"],
      fields: [
        { key: "shown", type: "boolean", labelKey: "look_status_shown", helpKey: "editor_status_shown_hint" },
        {
          key: "widgets",
          type: "order",
          options: STATUS_PARTS,
          optionKey: "status_part",
          allByDefault: true,
          labelKey: "editor_status_widgets",
          helpKey: "look_status_widgets_hint",
        },
        { key: "colourful", type: "boolean", labelKey: "look_status_colourful" },
        { key: "background", type: "colour", labelKey: "look_status_background" },
        { key: "text", type: "colour", labelKey: "look_status_text" },
        { key: "opacity", type: "number", min: 20, max: 100, placeholder: "100", labelKey: "look_opacity_short" },
        { key: "blur", type: "number", min: 0, max: 30, placeholder: "30", labelKey: "look_nav_blur" },
      ],
    },
    {
      key: "calendar",
      titleKey: "calendar_group",
      path: ["status_panel"],
      fields: [
        { key: "calendars", type: "entities", domain: "calendar", labelKey: "editor_status_calendars", helpKey: "editor_status_calendars_hint" },
        { key: "calendar_limit", type: "number", min: 1, max: 8, placeholder: "3", labelKey: "editor_status_calendar_limit" },
        {
          key: "calendar_hide",
          type: "select",
          options: ["start"],
          optionKey: "editor_status_calendar_hide",
          emptyKey: "editor_status_calendar_hide_end",
          labelKey: "editor_status_calendar_hide",
        },
        {
          key: "calendar_colors",
          type: "map",
          dropEmpty: true,
          placeholder: "#34c759",
          labelKey: "editor_status_calendar_colors",
          helpKey: "editor_status_calendar_colors_hint",
        },
      ],
    },
    {
      key: "facts",
      titleKey: "editor_status_facts",
      path: ["status_panel"],
      fields: [
        {
          key: "doors",
          type: "list",
          scalar: "entity",
          labelKey: "editor_status_doors",
          helpKey: "editor_status_doors_hint",
          fields: [{ key: "entity", type: "entity" }, { key: "name", type: "text" }],
        },
        {
          key: "windows",
          type: "list",
          scalar: "entity",
          labelKey: "editor_status_windows",
          helpKey: "editor_status_windows_hint",
          fields: [{ key: "entity", type: "entity" }, { key: "name", type: "text" }],
        },
        {
          key: "flags",
          type: "list",
          scalar: "entity",
          labelKey: "editor_status_flags",
          helpKey: "editor_status_flags_hint",
          fields: [{ key: "entity", type: "entity" }, { key: "name", type: "text" }, { key: "icon", type: "icon" }],
        },
        {
          key: "ignore",
          type: "entities",
          labelKey: "editor_status_ignore",
          helpKey: "editor_status_ignore_hint",
        },
        {
          key: "now",
          type: "list",
          scalar: "entity",
          labelKey: "editor_status_now",
          helpKey: "editor_status_now_hint",
          fields: [
            { key: "entity", type: "entity" },
            { key: "name", type: "text" },
            { key: "icon", type: "icon" },
            { key: "detail", type: "entity", labelKey: "editor_status_detail" },
            { key: "remaining", type: "entity", labelKey: "editor_status_remaining" },
            { key: "resting", type: "strings", labelKey: "editor_status_resting", helpKey: "editor_status_resting_hint" },
            { key: "block", type: "select", options: blockNames(strategy), labelKey: "editor_status_block" },
          ],
        },
        {
          key: "power",
          type: "list",
          scalar: "entity",
          labelKey: "editor_status_power",
          fields: [
            { key: "entity", type: "entity" },
            { key: "name", type: "text" },
            { key: "color", type: "colour", labelKey: "editor_status_colour" },
            { key: "switch", type: "entity", labelKey: "editor_status_power_switch", helpKey: "editor_status_power_switch_hint" },
          ],
        },
        {
          key: "departures",
          type: "entities",
          labelKey: "editor_status_departures",
          helpKey: "editor_status_departures_hint",
        },
      ],
    },
  ],
};

export class HomeDashboardEditorSettings extends LitElement {
  static properties = {
    hass: { attribute: false },
    strategy: { attribute: false },
    // The node of the tree: its key names the form.
    node: { attribute: false },
    users: { attribute: false },
    _open: { state: true },
  };

  // A long form (the look) shows its parts folded, the first open; a short one shows them all.
  willUpdate(changed) {
    if (changed.has("node") && changed.get("node")?.key !== this.node?.key) this._open = null;
  }

  _isOpen(sections, section) {
    if (sections.length <= 3) return true;
    return (this._open ?? new Set([sections[0].key])).has(section.key);
  }

  _toggle(sections, section, open) {
    const next = new Set(this._open ?? [sections[0].key]);
    if (open) next.add(section.key);
    else next.delete(section.key);
    this._open = next;
  }

  _t(key, values) {
    return translate(this.hass?.language, key, values);
  }

  // A section at the top of the configuration writes only its own keys; any other writes its whole path.
  _write(section, value) {
    if (section.path.length) return withSection(this.strategy, section.path, value);
    let next = this.strategy;
    // A key of the top is one value of its own (the rules of visibility): only it being empty takes it out.
    for (const field of section.fields) next = withSection(next, [field.key], value?.[field.key], false);
    return next;
  }

  render() {
    const form = SETTINGS_FORMS[this.node?.key];
    if (!this.hass || !form) return nothing;
    const sections = form(this.strategy, this.hass.language, this.hass);
    return html`${sections.map(
      (section) => html`<details
        data-settings-section=${section.key}
        ?open=${this._isOpen(sections, section)}
        @toggle=${(event) => event.target === event.currentTarget && this._toggle(sections, section, event.target.open)}
      >
        <summary>
          <h3>${this._t(section.titleKey)}<code>${section.path.join(".") || section.fields.map((field) => field.key).join(", ")}</code></h3>
        </summary>
        ${section.hintKey ? html`<p class="hint">${this._t(section.hintKey)}</p>` : nothing}
        ${section.custom === "access"
          ? html`<home-dashboard-editor-access
              .hass=${this.hass}
              .strategy=${this.strategy}
              .users=${this.users}
              @access-change=${(event) =>
                this.dispatchEvent(
                  new CustomEvent("settings-change", { detail: { strategy: withSection(this.strategy, ["access"], event.detail.access) } }),
                )}
            ></home-dashboard-editor-access>`
          : html`<home-dashboard-editor-schema
          .hass=${this.hass}
          .value=${section.path.length ? getAt(this.strategy, section.path) : this.strategy}
          .path=${[this.node.key, section.key]}
          .fields=${section.fields}
          .users=${this.users}
          .shortcuts=${blockNames(this.strategy)}
          @schema-change=${(event) =>
            this.dispatchEvent(new CustomEvent("settings-change", { detail: { strategy: this._write(section, event.detail.value) } }))}
        ></home-dashboard-editor-schema>`}
      </details>`,
    )}`;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    details {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    details[open] > summary {
      margin-bottom: 10px;
    }
    summary {
      cursor: pointer;
      list-style: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary h3::before {
      content: "▸ ";
    }
    details[open] > summary h3::before {
      content: "▾ ";
    }
    h3 {
      display: flex;
      justify-content: flex-start;
      align-items: baseline;
      gap: 8px;
      margin: 0;
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted, #9aa0a6);
    }
    .hint {
      margin: 0;
      font-size: 12px;
      color: var(--muted, #9aa0a6);
    }
    h3 code {
      margin-left: auto;
      font-size: 11px;
      text-transform: none;
      color: var(--faint);
    }
  `;
}

if (!customElements.get(TAG)) customElements.define(TAG, HomeDashboardEditorSettings);
