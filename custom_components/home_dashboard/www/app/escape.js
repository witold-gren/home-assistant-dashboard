// Esc on a computer closes the window on top, as its ✕ (or its arrow back) does. One key closes one thing: a small
// window inside a window (a question, a menu, a picture shown big) goes first, the window itself with the next press.
//
// A part of the dashboard that opens such a small window gives itself a method hdEscape(): it closes what it has
// open and answers true, or answers false when nothing of it is open. escapeInside() asks the parts from the inside
// out, so the innermost window closes first.

/** Whether a key press is an Esc of ours to handle: not taken already, not held down, not from a dialog of Home Assistant. */
export function isEscape(event) {
  if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.repeat) return false;
  // A window of Home Assistant over the dashboard (more information about a device, a question) closes itself.
  return !event.composedPath().some((node) => isForeignDialog(node));
}

function isForeignDialog(node) {
  const name = node?.localName;
  if (!name || name.startsWith("home-dashboard")) return false;
  return name === "dialog" || /(^|-)dialog(-|$)/.test(name);
}

/** Every part with hdEscape() under a root, its own parts reached through their shadow roots, outer ones first. */
export function escapeParts(root) {
  const found = [];
  const walk = (node) => {
    for (const child of node?.children ?? []) {
      if (typeof child.hdEscape === "function") found.push(child);
      // Only our own parts are looked into: the cards of Home Assistant inside them have nothing of ours.
      if (child.shadowRoot && child.localName.startsWith("home-dashboard")) walk(child.shadowRoot);
      walk(child);
    }
  };
  walk(root);
  return found;
}

/** Closes the innermost small window under a root; false when none was open. */
export function escapeInside(root) {
  return escapeParts(root)
    .reverse()
    .some((part) => part.hdEscape() === true);
}
