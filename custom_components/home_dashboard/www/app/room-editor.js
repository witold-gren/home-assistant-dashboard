// Changes to one room of the layout. Every function returns a new room, so a cancelled edit leaves
// the configuration as it was and nothing reaches the server before the user saves.

import { buildHomeModel, buildRoomModel, buildTile, effectiveArea, isPrimary, layoutEntry } from "./model.js";

const MAX_CANDIDATES = 60;
const COMMON_DOMAINS = [
  "light",
  "switch",
  "climate",
  "cover",
  "lock",
  "media_player",
  "fan",
  "scene",
  "script",
  "button",
  "select",
  "sensor",
  "binary_sensor",
];

function domainRank(entityId) {
  const rank = COMMON_DOMAINS.indexOf(entityId.split(".")[0]);
  return rank < 0 ? COMMON_DOMAINS.length : rank;
}

// Home and the scenes of a room are single lists; the room page is a list of sections.
const SINGLE_LISTS = { home: "home", scenes: "scenes" };

const listsOf = (room, tab) => (SINGLE_LISTS[tab] ? [{ tiles: room[SINGLE_LISTS[tab]] ?? [] }] : room.sections);

function withLists(room, tab, lists) {
  return SINGLE_LISTS[tab] ? { ...room, [SINGLE_LISTS[tab]]: lists[0].tiles } : { ...room, sections: lists };
}

function changeLists(room, tab, change) {
  const lists = listsOf(room, tab).map((list) => ({ ...list, tiles: [...list.tiles] }));
  change(lists);
  return withLists(room, tab, lists);
}

export const editableLists = listsOf;

// A room from the areas has no entry yet: the first edit writes down what the page shows.
export function roomDraft(hass, config, selection, roomId) {
  const entry = layoutEntry(config, roomId);
  if (entry) return { home: [], sections: [], ...structuredClone(entry) };
  const model = buildRoomModel(hass, config, selection, roomId);
  const shown = buildHomeModel(hass, config, selection).rooms.find((room) => room.id === roomId);
  return {
    id: roomId,
    name: model.title,
    areas: model.areas,
    home: (shown?.tiles ?? []).map((tile) => ({ entity: tile.entityId })),
    sections: model.sections.map((section) => ({
      title: section.title,
      tiles: section.tiles.map((tile) => ({ entity: tile.entityId })),
    })),
    status: [],
  };
}

export function moveTile(room, tab, from, to) {
  return changeLists(room, tab, (lists) => {
    const [item] = lists[from.list].tiles.splice(from.index, 1);
    const shifted = from.list === to.list && from.index < to.index ? to.index - 1 : to.index;
    lists[to.list].tiles.splice(shifted, 0, item);
  });
}

export function removeTile(room, tab, at) {
  return changeLists(room, tab, (lists) => {
    lists[at.list].tiles.splice(at.index, 1);
  });
}

export function renameTile(room, tab, at, name) {
  return changeLists(room, tab, (lists) => {
    const { name: previous, ...item } = lists[at.list].tiles[at.index];
    lists[at.list].tiles[at.index] = name.trim() ? { ...item, name: name.trim() } : item;
  });
}

// A tile flat (one row, the default) or tall (two rows).
export function resizeTile(room, tab, at, size) {
  return changeLists(room, tab, (lists) => {
    const { size: previous, ...item } = lists[at.list].tiles[at.index];
    lists[at.list].tiles[at.index] = size === "tall" ? { ...item, size } : item;
  });
}

export function replaceTile(room, tab, at, item) {
  return changeLists(room, tab, (lists) => {
    lists[at.list].tiles[at.index] = item;
  });
}

export function addTile(room, tab, list, entity) {
  return changeLists(room, tab, (lists) => {
    lists[list].tiles.push({ entity });
  });
}

export function addSection(room, title) {
  return { ...room, sections: [...room.sections, { title, tiles: [] }] };
}

export function renameSection(room, index, title) {
  return { ...room, sections: room.sections.map((item, at) => (at === index ? { ...item, title } : item)) };
}

export function removeSection(room, index) {
  return { ...room, sections: room.sections.filter((_, at) => at !== index) };
}

// A section lays its tiles out in a grid, or in one row that scrolls sideways.
export function toggleSectionRow(room, index) {
  return {
    ...room,
    sections: room.sections.map((item, at) => {
      if (at !== index) return item;
      const { layout, ...rest } = item;
      return layout === "row" ? rest : { ...rest, layout: "row" };
    }),
  };
}

export function moveSection(room, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= room.sections.length) return room;
  const sections = [...room.sections];
  [sections[index], sections[target]] = [sections[target], sections[index]];
  return { ...room, sections };
}

// The scenes on Home are edited as one list, the same way as a room.
export const SCENE_DOMAINS = ["scene", "script"];

export function scenesDraft(config, name) {
  return { id: "scenes", name, areas: [], home: structuredClone(config.scenes), sections: [] };
}

export function applyRoom(raw, room) {
  const layout = raw.layout ?? [];
  const known = layout.some((entry) => entry.id === room.id);
  return {
    ...raw,
    layout: known ? layout.map((entry) => (entry.id === room.id ? room : entry)) : [...layout, room],
  };
}

// With nothing typed: what belongs to this room and has no tile yet. A search looks everywhere.
export function tileCandidates(hass, config, room, tab, query, domains = null) {
  const wanted = query.trim().toLowerCase();
  const used = new Set(listsOf(room, tab).flatMap((list) => list.tiles.map((item) => item.entity)));
  const inRoom = (id) => (room.areas ?? []).includes(effectiveArea(hass, id, config));
  const matches = (id) => {
    if (used.has(id)) return false;
    if (domains && !domains.includes(id.split(".")[0])) return false;
    if (!wanted) return Boolean(domains) || (inRoom(id) && isPrimary(hass.entities[id]));
    const name = hass.states[id].attributes?.friendly_name ?? "";
    return id.includes(wanted) || name.toLowerCase().includes(wanted);
  };
  return Object.keys(hass.states)
    .filter(matches)
    .sort((a, b) => Number(inRoom(b)) - Number(inRoom(a)) || domainRank(a) - domainRank(b) || a.localeCompare(b))
    .slice(0, MAX_CANDIDATES)
    .map((id) => buildTile(hass, id, null, config))
    .filter(Boolean);
}
