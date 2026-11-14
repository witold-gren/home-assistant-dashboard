// What the editor knows about a block of several entities: which block a chosen node is in, the entities it shows,
// the entities of its devices it does not show yet, and where a new row goes. Pure functions.

import { getAt, insertAt, setAt } from "./tree.js";

/** The path of the block a path lies in (a block among the shortcuts or a block tile of a room), or null. */
export function blockPathOf(strategy, path) {
  for (let length = path?.length ?? 0; length >= 2; length -= 1) {
    const candidate = path.slice(0, length);
    const value = getAt(strategy, candidate);
    const atPlace = candidate[0] === "shortcuts" ? length === 2 : candidate.at(-2) === "tiles" || candidate.at(-2) === "home";
    if (atPlace && value?.kind === "panel") return candidate;
  }
  return null;
}

/** Every entity a block names: its own, its status, numbers, buttons and rows. */
export function blockEntities(block) {
  const rows = (block?.groups ?? []).flatMap((group) => group.rows ?? []);
  return new Set(
    [block?.entity, block?.status, block?.active, block?.details, ...[...(block?.stats ?? []), ...(block?.actions ?? []), ...rows].map((item) => item?.entity)].filter(
      Boolean,
    ),
  );
}

/**
 * The entities of the devices of a block that it does not show: a coffee machine's settings, counters and switches
 * its window leaves out. Hidden and disabled ones stay out; sorted by name.
 */
export function deviceLeftovers(hass, block) {
  const shown = blockEntities(block);
  const devices = new Set([...shown].map((entity) => hass.entities?.[entity]?.device_id).filter(Boolean));
  if (!devices.size) return [];
  const collator = new Intl.Collator(hass.language);
  return Object.keys(hass.entities ?? {})
    .filter((entity) => devices.has(hass.entities[entity].device_id) && !shown.has(entity) && hass.states[entity])
    .filter((entity) => !hass.entities[entity].hidden && !hass.entities[entity].disabled_by)
    .map((entity) => ({ entity, name: hass.states[entity].attributes?.friendly_name ?? entity, category: hass.entities[entity].entity_category ?? null }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * The strategy with a row of `entity` added to a block: to the group `groupIndex`, else to its last group; a block
 * without groups gets one named `title`. Returns the strategy and the path of the new row.
 */
export function addBlockRow(strategy, blockPath, entity, groupIndex, title) {
  const groups = getAt(strategy, [...blockPath, "groups"]) ?? [];
  if (!groups.length) {
    const next = setAt(strategy, [...blockPath, "groups"], [{ title, rows: [{ entity }] }]);
    return { strategy: next, path: [...blockPath, "groups", 0, "rows", 0] };
  }
  const group = groupIndex ?? groups.length - 1;
  const rows = [...blockPath, "groups", group, "rows"];
  const index = (getAt(strategy, rows) ?? []).length;
  return { strategy: insertAt(strategy, rows, index, { entity }), path: [...rows, index] };
}

/** The group a chosen node of a block points at: the group itself or the group of a row; else null. */
export function groupIndexOf(blockPath, path) {
  const rest = path.slice(blockPath.length);
  return rest[0] === "groups" && Number.isInteger(rest[1]) ? rest[1] : null;
}
