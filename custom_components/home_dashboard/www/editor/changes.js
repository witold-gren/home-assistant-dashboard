// What a draft changes, said as a person would: rooms added, renamed or moved, tiles added and removed in a room,
// blocks changed, settings changed; and the lines of YAML that differ. Pure functions.

import { translate } from "../app/i18n.js";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const tileKeyOf = (tile) => (typeof tile === "string" ? tile : (tile?.entity ?? tile?.shortcut ?? tile?.name ?? JSON.stringify(tile)));

function tileName(hass, tile) {
  if (typeof tile === "string") return hass?.states?.[tile]?.attributes?.friendly_name ?? tile;
  return tile?.name ?? tile?.shortcut ?? hass?.states?.[tile?.entity]?.attributes?.friendly_name ?? tile?.entity ?? "?";
}

/** The tiles of a room, wherever in it they are: its Home list, its scenes and its sections. */
function roomTiles(room) {
  return [
    ...(room.home ?? []).map((tile) => ({ tile, where: "home" })),
    ...(room.scenes ?? []).map((tile) => ({ tile, where: "scenes" })),
    ...(room.sections ?? []).flatMap((section, index) => (section.tiles ?? []).map((tile) => ({ tile, where: section.title ?? `#${index + 1}` }))),
  ];
}

/** Added and removed entries of two lists, matched by a key; entries in both but different are changed. */
function compareLists(before = [], after = [], keyOf) {
  const old = new Map(before.map((item) => [keyOf(item), item]));
  const now = new Map(after.map((item) => [keyOf(item), item]));
  return {
    added: [...now.keys()].filter((key) => !old.has(key)).map((key) => now.get(key)),
    removed: [...old.keys()].filter((key) => !now.has(key)).map((key) => old.get(key)),
    changed: [...now.keys()].filter((key) => old.has(key) && !same(old.get(key), now.get(key))).map((key) => [old.get(key), now.get(key)]),
    reordered: same([...old.keys()].filter((key) => now.has(key)), [...now.keys()].filter((key) => old.has(key))) === false,
  };
}

/**
 * The changes from one strategy to another, each `{ kind, text }` in the person's language: `added`, `removed`,
 * `changed` or `moved`. Empty when nothing differs.
 */
export function describeChanges(before = {}, after = {}, hass = null, language = "en") {
  const t = (key, values) => translate(language, key, values);
  const changes = [];
  const say = (kind, key, values) => changes.push({ kind, text: t(key, values) });

  const rooms = compareLists(before.layout, after.layout, (room) => room.id);
  for (const room of rooms.added) say("added", "editor_change_room_added", { room: room.name ?? room.id });
  for (const room of rooms.removed) say("removed", "editor_change_room_removed", { room: room.name ?? room.id });
  if (rooms.reordered) say("moved", "editor_change_rooms_order", {});
  for (const [old, now] of rooms.changed) {
    const room = now.name ?? now.id;
    if ((old.name ?? old.id) !== room) say("changed", "editor_change_room_renamed", { from: old.name ?? old.id, room });
    if (!same(old.areas ?? [], now.areas ?? [])) say("changed", "editor_change_room_areas", { room });
    const sections = compareLists(old.sections, now.sections, (section) => section.title ?? "");
    for (const section of sections.added) say("added", "editor_change_section_added", { room, section: section.title ?? "" });
    for (const section of sections.removed) say("removed", "editor_change_section_removed", { room, section: section.title ?? "" });
    if (sections.reordered) say("moved", "editor_change_sections_order", { room });
    for (const [was, is] of sections.changed) {
      if ((was.layout ?? "") !== (is.layout ?? "")) say("changed", "editor_change_section_layout", { room, section: is.title ?? "" });
    }
    const tiles = compareLists(roomTiles(old), roomTiles(now), (entry) => `${tileKeyOf(entry.tile)}`);
    for (const { tile, where } of tiles.added) say("added", "editor_change_tile_added", { room, where, tile: tileName(hass, tile) });
    for (const { tile, where } of tiles.removed) say("removed", "editor_change_tile_removed", { room, where, tile: tileName(hass, tile) });
    for (const [was, is] of tiles.changed) {
      if (was.where !== is.where) say("moved", "editor_change_tile_moved", { room, from: was.where, where: is.where, tile: tileName(hass, is.tile) });
      if (!same(was.tile, is.tile)) say("changed", "editor_change_tile_changed", { room, tile: tileName(hass, is.tile) });
    }
    if (!tiles.changed.length && !tiles.added.length && !tiles.removed.length && tiles.reordered) say("moved", "editor_change_tiles_order", { room });
  }

  const favorites = compareLists(before.favorites, after.favorites, (entity) => entity);
  for (const entity of favorites.added) say("added", "editor_change_favorite_added", { tile: tileName(hass, entity) });
  for (const entity of favorites.removed) say("removed", "editor_change_favorite_removed", { tile: tileName(hass, entity) });
  if (favorites.reordered) say("moved", "editor_change_favorites_order", {});

  const scenes = compareLists(before.scenes, after.scenes, tileKeyOf);
  for (const tile of scenes.added) say("added", "editor_change_scene_added", { tile: tileName(hass, tile) });
  for (const tile of scenes.removed) say("removed", "editor_change_scene_removed", { tile: tileName(hass, tile) });

  const blocks = compareLists(before.shortcuts, after.shortcuts, (block) => block.name ?? block.kind);
  for (const block of blocks.added) say("added", "editor_change_block_added", { block: block.name ?? block.kind });
  for (const block of blocks.removed) say("removed", "editor_change_block_removed", { block: block.name ?? block.kind });
  for (const [, block] of blocks.changed) say("changed", "editor_change_block_changed", { block: block.name ?? block.kind });
  if (blocks.reordered) say("moved", "editor_change_blocks_order", {});

  const handled = new Set(["layout", "favorites", "scenes", "shortcuts"]);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !handled.has(key));
  for (const key of keys.sort()) {
    if (!same(before[key], after[key])) say("changed", "editor_change_setting", { setting: key });
  }
  return changes;
}

/**
 * The lines of two texts, marked: `same`, `added` or `removed`, from their longest common part. Texts too long to
 * compare line by line show as all removed and all added.
 */
export function diffLines(before, after, limit = 4_000_000) {
  const a = before ? before.split("\n") : [];
  const b = after ? after.split("\n") : [];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const head = a.slice(0, start).map((text) => ({ kind: "same", text }));
  const tail = a.slice(endA).map((text) => ({ kind: "same", text }));
  const middleA = a.slice(start, endA);
  const middleB = b.slice(start, endB);
  if (middleA.length * middleB.length > limit) {
    return [...head, ...middleA.map((text) => ({ kind: "removed", text })), ...middleB.map((text) => ({ kind: "added", text })), ...tail];
  }
  const rows = middleA.length + 1;
  const cols = middleB.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = middleA.length - 1; i >= 0; i -= 1) {
    for (let j = middleB.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] = middleA[i] === middleB[j] ? table[(i + 1) * cols + j + 1] + 1 : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }
  const middle = [];
  let i = 0;
  let j = 0;
  while (i < middleA.length && j < middleB.length) {
    if (middleA[i] === middleB[j]) {
      middle.push({ kind: "same", text: middleA[i] });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
      middle.push({ kind: "removed", text: middleA[i] });
      i += 1;
    } else {
      middle.push({ kind: "added", text: middleB[j] });
      j += 1;
    }
  }
  for (; i < middleA.length; i += 1) middle.push({ kind: "removed", text: middleA[i] });
  for (; j < middleB.length; j += 1) middle.push({ kind: "added", text: middleB[j] });
  return [...head, ...middle, ...tail];
}

/** Only the changed lines with a few around them, and the number of lines left out between them. */
export function diffHunks(lines, context = 3) {
  const keep = new Set();
  lines.forEach((line, index) => {
    if (line.kind === "same") return;
    for (let near = index - context; near <= index + context; near += 1) keep.add(near);
  });
  const out = [];
  let skipped = 0;
  lines.forEach((line, index) => {
    if (keep.has(index)) {
      if (skipped) out.push({ kind: "skip", count: skipped });
      skipped = 0;
      out.push(line);
    } else skipped += 1;
  });
  if (skipped && out.length) out.push({ kind: "skip", count: skipped });
  return out;
}

/** The entities a strategy names that Home Assistant does not have: tiles, favourites, rows, numbers, buttons. */
export function missingEntities(strategy, hass) {
  const found = new Set();
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (key === "entity" && typeof item === "string" && item.includes(".") && !hass?.states?.[item]) found.add(item);
      else walk(item);
    }
  };
  walk(strategy.layout);
  walk(strategy.shortcuts);
  walk(strategy.scenes);
  for (const entity of strategy.favorites ?? []) if (!hass?.states?.[entity]) found.add(entity);
  return [...found].sort();
}
