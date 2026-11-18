// Where the "?" of each part of the editor opens the guide (docs/editor.md and docs/editor.pl.md share these anchors;
// tests/test_docs.py checks every one is there in both languages).

// The documentation site (GitHub Pages): the guide to this editor, in Polish under /pl/.
export const DOCS_SITE = "https://witold-gren.github.io/home-assistant-dashboard/";

/** The page of the editor's guide on the documentation site, in the language of Home Assistant, at a chapter. */
export function editorDocsUrl(language, anchor = "") {
  const polish = String(language ?? "").split("-")[0] === "pl";
  return `${DOCS_SITE}${polish ? "pl/" : ""}editor/${anchor ? `#${anchor}` : ""}`;
}

export const DOCS_ANCHORS = {
  screen: "a-tour-of-the-screen",
  preview: "the-preview",
  home: "the-home-page",
  rooms: "rooms",
  tiles: "sections-and-tiles",
  blocks: "blocks-machines-appliances-screens-of-their",
  look: "look-themes-and-backgrounds",
  status: "the-status-bar-of-a-tablet",
  menu: "menu-and-bar-of-pages",
  access: "who-sees-what",
  other: "cameras-energy-intercom-and-the-other",
  saving: "saving-publishing-and-history",
  devices: "editor-settings-your-own-phones-and",
  variants: "page-variants",
};

const SETTING_ANCHORS = {
  appearance: "look",
  nav: "look",
  status_panel: "status",
  menu: "menu",
  access: "access",
  room_order: "rooms",
};

/** The anchor of the chapter about a node of the tree (nothing chosen: the tour of the screen). */
export function docsAnchorFor(node) {
  if (node?.kind === "variants" || node?.kind === "devices") return DOCS_ANCHORS.variants;
  if (!node?.path) return DOCS_ANCHORS.screen;
  const [first] = node.path;
  if (node.kind === "setting") return DOCS_ANCHORS[SETTING_ANCHORS[node.key] ?? "other"];
  if (first === "favorites" || first === "scenes") return DOCS_ANCHORS.home;
  if (first === "shortcuts") return DOCS_ANCHORS.blocks;
  if (first === "layout") return node.path.length > 2 ? DOCS_ANCHORS.tiles : DOCS_ANCHORS.rooms;
  return DOCS_ANCHORS.screen;
}
