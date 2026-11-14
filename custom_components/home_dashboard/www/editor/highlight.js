// What the preview outlines for what is chosen in the tree: the tile, the section or the room on the page, the window
// of a block, or a part of that window (a number, a button, a group, a row). The frame looks for elements by their
// data attributes (see www/app/preview-highlight.js); nothing is outlined for the settings.

import { blockPathOf } from "./block-model.js";

const at = (value, path) => path.reduce((inside, key) => inside?.[key], value);

/** Elements with any of these attributes at these values, the first match per attribute list. */
const tileMatch = (tile) => {
  if (!tile || typeof tile !== "object") return null;
  const pairs = [];
  if (tile.entity) pairs.push(["data-entity", tile.entity]);
  for (const name of [tile.shortcut, tile.name].filter(Boolean)) pairs.push(["data-tile", name], ["data-shortcut", name]);
  return pairs.length ? pairs : null;
};

/**
 * The outline of a path of the strategy, or null: `{ scope: "page" | "sheet", within, attrs, whole }`. `within` narrows
 * the search to the first element found of a list of places (a section on a room's page, else the room on Home; a
 * group of a window), `attrs` are pairs of an attribute and a value of which any matches, `whole` outlines the window.
 */
export function highlightSpec(strategy, path) {
  if (!strategy || !Array.isArray(path) || !path.length) return null;
  const blockPath = blockPathOf(strategy, path);
  if (blockPath || (path[0] === "shortcuts" && path.length >= 2)) {
    const base = blockPath ?? path.slice(0, 2);
    const rest = path.slice(base.length);
    const block = at(strategy, base);
    if (!rest.length) return { scope: "sheet", whole: true };
    const [list, index, inner, row] = rest;
    const item = block?.[list]?.[index];
    if (list === "stats" && rest.length === 2) return { scope: "sheet", attrs: [["data-stat", String(index)]] };
    if (list === "actions" && rest.length === 2 && item?.entity) return { scope: "sheet", attrs: [["data-action", item.entity]] };
    if (list === "groups" && rest.length === 2) return { scope: "sheet", attrs: [["data-panel-group", String(index)]] };
    if (list === "groups" && inner === "rows" && rest.length === 4) {
      const entity = item?.rows?.[row]?.entity;
      return entity ? { scope: "sheet", within: [["data-panel-group", String(index)]], any: entity } : null;
    }
    if (["stats", "actions", "groups"].includes(list) && rest.length === 1) {
      const attribute = { stats: "data-panel-stats", actions: "data-block-actions", groups: "data-panel-groups" }[list];
      return { scope: "sheet", attrs: [[attribute, ""]] };
    }
    return { scope: "sheet", whole: true };
  }
  const [root, roomIndex, part, sectionIndex, tiles, tileIndex] = path;
  if (root === "favorites" && path.length === 2) {
    const entity = at(strategy, path);
    return entity ? { scope: "page", attrs: [["data-entity", entity]] } : null;
  }
  if (root === "scenes" && path.length === 2) {
    const attrs = tileMatch(at(strategy, path));
    return attrs ? { scope: "page", attrs } : null;
  }
  if (root !== "layout") return null;
  const room = strategy.layout?.[roomIndex];
  if (!room) return null;
  if (path.length === 2) return { scope: "page", attrs: [["data-room", room.id], ["data-room-link", room.id]] };
  const section = ["data-section", `section-${sectionIndex}`];
  const onHome = ["data-room", room.id];
  if (part === "sections" && path.length === 4) return { scope: "page", attrs: [section] };
  if (part === "sections" && tiles === "tiles" && path.length === 6) {
    const attrs = tileMatch(room.sections?.[sectionIndex]?.tiles?.[tileIndex]);
    return attrs ? { scope: "page", within: [section, onHome], attrs } : null;
  }
  if (part === "home" && path.length === 4) {
    const attrs = tileMatch(room.home?.[sectionIndex]);
    return attrs ? { scope: "page", within: [onHome], attrs } : null;
  }
  return null;
}
