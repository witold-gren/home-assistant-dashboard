// The tree of a dashboard for the editor: what is in its configuration, as nodes with a path into it. Pure
// functions, no elements: everything the editor changes goes through `getAt`, `setAt` and the moves here.

import { translate } from "../app/i18n.js";

const DOMAIN_ICONS = {
  light: "mdi:lightbulb",
  switch: "mdi:toggle-switch",
  cover: "mdi:blinds",
  climate: "mdi:thermostat",
  media_player: "mdi:speaker",
  lock: "mdi:lock",
  binary_sensor: "mdi:checkbox-blank-circle-outline",
  sensor: "mdi:gauge",
  select: "mdi:format-list-bulleted",
  automation: "mdi:robot",
  scene: "mdi:palette",
  script: "mdi:script-text",
  camera: "mdi:cctv",
  vacuum: "mdi:robot-vacuum",
  alarm_control_panel: "mdi:shield-home",
};
const KIND_ICONS = {
  panel: "mdi:view-dashboard-outline",
  scale: "mdi:scale-bathroom",
  tv: "mdi:television",
  host: "mdi:server",
  overview: "mdi:clipboard-pulse-outline",
  departures: "mdi:tram",
  news: "mdi:newspaper-variant-outline",
  school: "mdi:school",
  page: "mdi:play-box-multiple-outline",
  app: "mdi:application",
};

/** The value at a path (a list of keys and indexes) of a configuration, or undefined. */
export function getAt(value, path) {
  return path.reduce((current, key) => (current == null ? undefined : current[key]), value);
}

/** A copy of the configuration with the value at a path replaced; every object on the way is copied, nothing shared. */
export function setAt(value, path, next) {
  if (!path.length) return next;
  const [key, ...rest] = path;
  const container = Array.isArray(value) ? [...value] : { ...(value ?? {}) };
  container[key] = setAt(container[key], rest, next);
  return container;
}

/** A copy without the item at a path of a list. */
export function removeAt(value, path) {
  const list = getAt(value, path.slice(0, -1));
  if (!Array.isArray(list)) return value;
  const index = path.at(-1);
  return setAt(value, path.slice(0, -1), list.filter((_, at) => at !== index));
}

/** A copy with an item put into the list at `listPath`, at `index` (the end when missing). */
export function insertAt(value, listPath, index, item) {
  const list = [...(getAt(value, listPath) ?? [])];
  list.splice(index ?? list.length, 0, item);
  return setAt(value, listPath, list);
}

/**
 * A copy with the item at `from` moved into the list at `toList`, before what is at `toIndex` there. Moving within
 * one list counts the place as the list was before the move, as a dragged row is dropped above another.
 */
export function moveItem(value, from, toList, toIndex) {
  const fromList = from.slice(0, -1);
  const item = getAt(value, from);
  if (item === undefined) return value;
  const same = JSON.stringify(fromList) === JSON.stringify(toList);
  const without = removeAt(value, from);
  const index = same && toIndex > from.at(-1) ? toIndex - 1 : toIndex;
  return insertAt(without, toList, index, item);
}

const pathKey = (path) => path.join("/");

function entityName(hass, entity) {
  return hass?.states?.[entity]?.attributes?.friendly_name ?? entity;
}

/** What a tile is called in the tree: its own name, its block, or the name of its entity. */
export function tileLabel(hass, tile) {
  if (!tile || typeof tile !== "object") return String(tile ?? "");
  return tile.name ?? tile.shortcut ?? (tile.entity ? entityName(hass, tile.entity) : tile.kind ?? "?");
}

export function tileIcon(hass, tile) {
  if (!tile || typeof tile !== "object") return "mdi:help-circle-outline";
  if (tile.icon) return tile.icon;
  if (tile.kind && KIND_ICONS[tile.kind]) return KIND_ICONS[tile.kind];
  const entity = tile.entity ?? "";
  return hass?.states?.[entity]?.attributes?.icon ?? DOMAIN_ICONS[entity.split(".")[0]] ?? "mdi:shape-outline";
}

/** Problems a node shows in the tree: an entity that does not exist. */
export function tileProblems(hass, tile) {
  if (!tile || typeof tile !== "object") return ["editor_problem_not_mapping"];
  if (tile.entity && hass?.states && !hass.states[tile.entity]) return ["editor_problem_no_entity"];
  return [];
}

function tileNode(hass, tile, path, language = "en") {
  return {
    key: pathKey(path),
    kind: "tile",
    path,
    label: tileLabel(hass, tile),
    icon: tileIcon(hass, tile),
    problems: tileProblems(hass, tile),
    // A tile that is a block of its own opens into its parts, as a block does.
    children: tile?.kind === "panel" ? blockChildren(hass, tile, path, language) : [],
  };
}

const missing = (hass, entity) => Boolean(entity && hass?.states && !hass.states[entity]);

/**
 * The parts of a block of several entities: its numbers, its buttons and its groups with their rows. Each a node
 * with a path into the block, for the forms and for dragging.
 */
export function blockChildren(hass, block, path, language = "en") {
  const t = (key) => translate(language, key);
  const part = (kind, item, at, list) => ({
    key: pathKey([...path, list, at]),
    kind,
    path: [...path, list, at],
    label: item?.name ?? item?.title ?? (item?.entity ? entityName(hass, item.entity) : t("editor_tree_untitled")),
    icon: item?.icon ?? (kind === "panel-group" ? "mdi:format-list-group" : kind === "stat" ? "mdi:numeric" : DOMAIN_ICONS[String(item?.entity).split(".")[0]] ?? "mdi:gesture-tap-button"),
    problems: missing(hass, item?.entity) ? ["editor_problem_no_entity"] : [],
    children: [],
  });
  const list = (list, kind, label, icon) => ({
    key: pathKey([...path, list]),
    kind: "block-list",
    list,
    path: [...path, list],
    label,
    icon,
    count: (block[list] ?? []).length,
    children: (block[list] ?? []).map((item, at) => {
      const node = part(kind, item, at, list);
      if (kind !== "panel-group") return node;
      const rows = (item.rows ?? []).map((row, index) => part("row", row, index, "rows"));
      return {
        ...node,
        children: rows.map((row) => ({ ...row, key: pathKey([...node.path, "rows", row.path.at(-1)]), path: [...node.path, "rows", row.path.at(-1)] })),
        count: rows.length,
        problems: rows.some((row) => row.problems.length) ? ["editor_problem_inside"] : [],
      };
    }),
  });
  return [
    list("stats", "stat", t("editor_block_stats"), "mdi:numeric"),
    list("actions", "action", t("editor_block_actions"), "mdi:gesture-tap-button"),
    list("groups", "panel-group", t("editor_block_groups"), "mdi:format-list-group"),
  ];
}

// A list of tiles: `path` is the node (a section), `tilesPath` the list itself (its `tiles`, or the node for a list
// that is only tiles, as the scenes).
function listNode(hass, kind, label, icon, path, tiles, tilesPath = path, language = "en") {
  return {
    key: pathKey(path),
    kind,
    path,
    label,
    icon,
    count: tiles.length,
    tilesPath,
    children: tiles.map((tile, index) => tileNode(hass, tile, [...tilesPath, index], language)),
  };
}

/**
 * The tree of the strategy of a dashboard: Home (favourites, scenes), every room with its sections and tiles,
 * the blocks, and the rest of the settings. Each node has a `path` into the strategy.
 */
export function buildTree(strategy, hass, language = "en") {
  const t = (key, values) => translate(language, key, values);
  const config = strategy ?? {};
  const home = {
    key: "home",
    kind: "group",
    label: t("editor_tree_home"),
    children: [
      {
        key: "favorites",
        kind: "list",
        path: ["favorites"],
        label: t("editor_tree_favorites"),
        icon: "mdi:star-outline",
        count: (config.favorites ?? []).length,
        children: (config.favorites ?? []).map((entity, index) => ({
          ...tileNode(hass, { entity }, ["favorites", index], language),
          kind: "favorite",
          label: entityName(hass, entity),
        })),
      },
      listNode(hass, "list", t("editor_tree_scenes"), "mdi:palette-outline", ["scenes"], config.scenes ?? [], ["scenes"], language),
    ],
  };
  const rooms = {
    key: "rooms",
    kind: "group",
    label: t("editor_tree_rooms"),
    children: (config.layout ?? []).map((room, roomIndex) => {
      const path = ["layout", roomIndex];
      const sections = (room.sections ?? []).map((section, sectionIndex) =>
        listNode(
          hass,
          "section",
          section.title ?? t("editor_tree_untitled"),
          "mdi:view-grid-outline",
          [...path, "sections", sectionIndex],
          section.tiles ?? [],
          [...path, "sections", sectionIndex, "tiles"],
          language,
        ),
      );
      const homeTiles = [
        listNode(hass, "section", t("editor_tree_room_home"), "mdi:home-outline", [...path, "home"], room.home ?? [], [...path, "home"], language),
      ];
      const roomScenes = room.scenes
        ? [listNode(hass, "section", t("editor_tree_room_scenes"), "mdi:palette-outline", [...path, "scenes"], room.scenes, [...path, "scenes"], language)]
        : [];
      const tiles = [...homeTiles, ...roomScenes, ...sections];
      return {
        key: pathKey(path),
        kind: "room",
        path,
        label: room.name ?? room.id,
        icon: room.icon ?? "mdi:door",
        count: sections.reduce((sum, section) => sum + section.count, 0),
        problems: tiles.some((section) => section.children.some((tile) => tile.problems.length)) ? ["editor_problem_inside"] : [],
        children: tiles,
      };
    }),
  };
  const blocks = {
    key: "blocks",
    kind: "group",
    label: t("editor_tree_blocks"),
    children: (config.shortcuts ?? []).map((block, index) => ({
      key: pathKey(["shortcuts", index]),
      kind: "block",
      path: ["shortcuts", index],
      label: block.name ?? block.kind,
      icon: block.icon ?? KIND_ICONS[block.kind] ?? "mdi:widgets-outline",
      children: block.kind === "panel" ? blockChildren(hass, block, ["shortcuts", index], language) : [],
    })),
  };
  const rest = {
    key: "rest",
    kind: "group",
    label: t("editor_tree_rest"),
    children: [
      ["appearance", "mdi:palette", "editor_tree_look"],
      ["access", "mdi:account-lock-outline", "editor_tree_access"],
      ["cameras", "mdi:cctv", "editor_tree_cameras"],
      ["energy", "mdi:lightning-bolt", "editor_tree_energy"],
      ["status_panel", "mdi:dock-left", "editor_tree_status_panel"],
      ["menu", "mdi:menu", "editor_tree_menu"],
      ["room_order", "mdi:sort", "editor_tree_rooms_order", ["rooms"]],
      ["entities", "mdi:format-list-checks", "editor_tree_entities"],
      ["lights", "mdi:lightbulb-group-outline", "editor_tree_lights"],
      ["home_settings", "mdi:tablet-dashboard", "editor_tree_home_settings", []],
      ["music", "mdi:music", "editor_tree_music"],
      ["media", "mdi:play-box-multiple-outline", "editor_tree_media"],
      ["map", "mdi:map-outline", "editor_tree_map"],
      ["nav", "mdi:dock-bottom", "editor_tree_nav", ["appearance", "nav"]],
      ["intercom", "mdi:waveform", "editor_tree_intercom"],
    ].map(([key, icon, label, path = [key]]) => ({ key, kind: "setting", path, label: t(label), icon, children: [] })),
  };
  return [home, rooms, blocks, rest];
}

/** Every node of a tree, depth first, for searching and for finding one by its key. */
export function flatten(nodes) {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}

/** The nodes whose label, entity or path matches a text, with the rooms and sections that lead to them. */
export function filterTree(nodes, text, strategy) {
  const wanted = text.trim().toLowerCase();
  if (!wanted) return nodes;
  const matches = (node) => {
    const value = node.path ? getAt(strategy, node.path) : null;
    const entity = typeof value === "string" ? value : value?.entity ?? "";
    return node.label.toLowerCase().includes(wanted) || entity.toLowerCase().includes(wanted);
  };
  const keep = (node) => {
    const children = (node.children ?? []).map(keep).filter(Boolean);
    return matches(node) || children.length ? { ...node, children } : null;
  };
  return nodes.map(keep).filter(Boolean);
}

/** Whether a node is a section of a room's page (not its Home list or its scenes). */
export const isRoomSection = (node) => node?.kind === "section" && node.path.at(-2) === "sections";

/**
 * Where a dragged node lands when dropped on another: the list and the place in it, or null when it cannot go
 * there. A tile goes before a tile, or to the end of a section (and of a room's Home list or scenes); a favourite
 * stays among the favourites; a section goes before a section, or to the end of a room; a room before a room.
 */
export function dropPlan(strategy, dragged, target) {
  if (!dragged || !target || dragged.key === target.key) return null;
  const lengthOf = (path) => (getAt(strategy, path) ?? []).length;
  if (dragged.kind === "tile") {
    if (target.kind === "tile") return { list: target.path.slice(0, -1), index: target.path.at(-1) };
    if (target.tilesPath && target.key !== "favorites") return { list: target.tilesPath, index: lengthOf(target.tilesPath) };
    return null;
  }
  if (dragged.kind === "favorite") {
    if (target.kind === "favorite") return { list: ["favorites"], index: target.path.at(-1) };
    if (target.key === "favorites") return { list: ["favorites"], index: lengthOf(["favorites"]) };
    return null;
  }
  if (isRoomSection(dragged)) {
    if (isRoomSection(target)) return { list: target.path.slice(0, -1), index: target.path.at(-1) };
    if (target.kind === "room") return { list: [...target.path, "sections"], index: lengthOf([...target.path, "sections"]) };
    return null;
  }
  if (dragged.kind === "room" && target.kind === "room") return { list: ["layout"], index: target.path.at(-1) };
  // Parts of a block stay in their block: a row goes before a row or to the end of a group; a group, a number or a
  // button before another of its kind or to the end of its list.
  const blockOf = (node) => JSON.stringify(node.path.slice(0, node.kind === "row" ? -4 : -2));
  if (dragged.kind === "row") {
    const sameBlock = (node) => JSON.stringify(node.path.slice(0, node.kind === "row" ? -4 : -2)) === blockOf(dragged);
    if (target.kind === "row" && sameBlock(target)) return { list: target.path.slice(0, -1), index: target.path.at(-1) };
    if (target.kind === "panel-group" && sameBlock(target)) {
      return { list: [...target.path, "rows"], index: lengthOf([...target.path, "rows"]) };
    }
    return null;
  }
  if (["stat", "action", "panel-group"].includes(dragged.kind)) {
    if (target.kind === dragged.kind && blockOf(target) === blockOf(dragged)) return { list: target.path.slice(0, -1), index: target.path.at(-1) };
    if (target.kind === "block-list" && JSON.stringify(target.path) === JSON.stringify(dragged.path.slice(0, -1))) {
      return { list: target.path, index: lengthOf(target.path) };
    }
  }
  return null;
}

/** The path a moved item has after `moveItem`: in its new list, its place counted after it left the old one. */
export function movedPath(from, list, index) {
  const sameList = JSON.stringify(from.slice(0, -1)) === JSON.stringify(list);
  return [...list, sameList && index > from.at(-1) ? index - 1 : index];
}
