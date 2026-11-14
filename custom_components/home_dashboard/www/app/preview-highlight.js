// The outline of what is chosen in the editor, over the preview: a red dashed frame around each element that matches
// what the editor asks for (see www/editor/highlight.js), kept in place while the page scrolls or redraws. Only in the
// editor's preview; nothing here touches the page itself.

const REFRESH_MS = 300;
const PAD = 3;

/** Every element under a root, looking into shadow roots too. */
function deepElements(root, found = []) {
  if (!root) return found;
  for (const element of root.querySelectorAll("*")) {
    found.push(element);
    if (element.shadowRoot) deepElements(element.shadowRoot, found);
  }
  return found;
}

const hasValue = (element, [attribute, value]) =>
  value === "" ? element.hasAttribute(attribute) : element.getAttribute(attribute) === value;

const anyData = (element, value) => [...element.attributes].some((attribute) => attribute.name.startsWith("data-") && attribute.value === value);

/** Outermost only: an element inside another match is the same thing again. */
function outermost(elements) {
  return elements.filter((element) => !elements.some((other) => other !== element && containsDeep(other, element)));
}

function containsDeep(outer, inner) {
  for (let node = inner; node; node = node.parentNode ?? node.host) {
    if (node === outer) return true;
  }
  return false;
}

/** The elements a spec names, under the page's root and the window's. */
export function findHighlighted(spec, { page, sheet }, folded = false) {
  if (!spec) return [];
  const panel = sheet?.shadowRoot?.querySelector(".panel");
  if (spec.scope === "sheet" && spec.whole) return panel ? [panel] : [];
  let scope = spec.scope === "sheet" ? sheet?.shadowRoot : page;
  if (!scope) return [];
  let elements = deepElements(scope);
  if (spec.within) {
    const holder = spec.within.map((place) => elements.find((element) => hasValue(element, place))).find(Boolean);
    if (!holder) return [];
    elements = [holder, ...deepElements(holder), ...deepElements(holder.shadowRoot)];
  }
  const matches = spec.any
    ? elements.filter((element) => anyData(element, spec.any))
    : elements.filter((element) => (spec.attrs ?? []).some((pair) => hasValue(element, pair)));
  // Folded parts are found too when asked, to open them; else only what is drawn.
  return outermost(matches).filter((element) => folded || element.getClientRects().length);
}

// A layer per page: two pages may be in the document at once (Home stays behind a room), each outlines its own.
const scrolls = (node) => {
  if (!(node instanceof Element) || node === document.documentElement || node === document.body) return false;
  const { overflowY } = getComputedStyle(node);
  return ["auto", "scroll"].includes(overflowY) && node.scrollHeight > node.clientHeight;
};

/**
 * Scrolls the nearest box that scrolls (the window of a block, the page) so the element shows, and nothing else: the
 * browser's own scrollIntoView also moved the document of the frame, which slid the whole screen up.
 */
export function bringIntoSight(element) {
  let box = element.parentNode ?? element.host;
  while (box && !scrolls(box)) box = box.parentNode ?? box.host;
  if (!box) return;
  const outer = box.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  if (inner.top < outer.top) box.scrollTop -= outer.top - inner.top + 12;
  else if (inner.bottom > outer.bottom) box.scrollTop += Math.min(inner.bottom - outer.bottom + 12, inner.top - outer.top - 12);
}

/**
 * Opens every folded part (a `<details>`, as a group of a window summed up in one line) that holds an element, so the
 * element shows instead of standing, measured but unseen, under the fold.
 */
export function revealHighlighted(elements) {
  for (const element of elements) {
    for (let node = element.parentNode ?? element.host; node; node = node.parentNode ?? node.host) {
      if (node.tagName === "DETAILS") node.open = true;
    }
  }
}

function newLayer() {
  const layer = document.createElement("div");
  layer.setAttribute("data-preview-highlight", "");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "2147483647" });
  return layer;
}

function draw(host, elements) {
  if (!host.isConnected) document.body.append(host);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const boxes = elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width && rect.height && rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width);
  while (host.children.length > boxes.length) host.lastChild.remove();
  while (host.children.length < boxes.length) {
    const box = document.createElement("div");
    box.setAttribute("data-highlight-box", "");
    Object.assign(box.style, {
      position: "fixed",
      boxSizing: "border-box",
      border: "2px dashed #ff3b30",
      borderRadius: "10px",
      background: "rgba(255, 59, 48, 0.07)",
      boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.35)",
    });
    host.append(box);
  }
  boxes.forEach((rect, index) => {
    const left = Math.max(0, rect.left - PAD);
    const top = Math.max(0, rect.top - PAD);
    Object.assign(host.children[index].style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${Math.min(width, rect.right + PAD) - left}px`,
      height: `${Math.min(height, rect.bottom + PAD) - top}px`,
    });
  });
}

/**
 * Outlines what `spec` names until it changes; `roots()` gives `{ page, sheet }` each time, as the page and its window
 * are drawn again. The first element is scrolled into sight once per spec.
 */
export function createHighlighter(roots) {
  let spec = null;
  let elements = [];
  let timer = null;
  let frame = 0;
  let shown = false;
  const host = newLayer();
  const refresh = () => {
    // The editor shows what it edits: a part folded away is opened first, then found again where it now stands.
    revealHighlighted(findHighlighted(spec, roots(), true));
    elements = findHighlighted(spec, roots());
    if (elements.length && !shown) {
      shown = true;
      bringIntoSight(elements[0]);
    }
    draw(host, elements);
  };
  const follow = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => draw(host, elements));
  };
  return {
    set(next) {
      const same = JSON.stringify(next ?? null) === JSON.stringify(spec);
      if (same) return;
      spec = next ?? null;
      shown = false;
      clearInterval(timer);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      if (!spec) {
        elements = [];
        cancelAnimationFrame(frame);
        host.remove();
        return;
      }
      refresh();
      timer = setInterval(refresh, REFRESH_MS);
      window.addEventListener("scroll", follow, true);
      window.addEventListener("resize", follow);
    },
    stop() {
      this.set(null);
    },
  };
}
