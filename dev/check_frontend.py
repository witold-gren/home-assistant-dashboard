"""Open the dashboard in the real frontend of the `make ui` instance and report what happened.

    python dev/check_frontend.py <output folder>
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8124"
SCREENS = {"phone": (402, 874), "tablet": (1180, 820)}
PROBE = """() => {
    const find = (root, tag) => {
        if (!root) return null;
        for (const node of root.querySelectorAll("*")) {
            if (node.localName === tag) return node;
            const inner = node.shadowRoot && find(node.shadowRoot, tag);
            if (inner) return inner;
        }
        return null;
    };
    const root = find(document, "hui-root");
    const chrome = root?.shadowRoot?.querySelector("home-dashboard-chrome");
    const nav = chrome?.shadowRoot?.querySelector("nav")?.getBoundingClientRect();
    const card = find(root?.shadowRoot, "home-dashboard-page");
    const view = root?.shadowRoot?.querySelector("#view");
    return {
        root: Boolean(root),
        chrome: Boolean(chrome),
        nav: nav ? [nav.left, nav.top, nav.width, nav.height] : null,
        card: Boolean(card),
        header: root ? getComputedStyle(root.shadowRoot.querySelector(".header")).display : null,
        padding: view ? getComputedStyle(view).padding : null,
        title: card?.shadowRoot?.querySelector("h1")?.textContent,
        tiles: card?.shadowRoot?.querySelectorAll(".tile").length,
        rooms: [...(card?.shadowRoot?.querySelectorAll("section[data-room] h2") ?? [])].map((h) => h.textContent),
        iconsReady: Boolean(window.customElements.get("ha-icon")),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        path: location.pathname,
    };
}"""


FIND = """
    const find = (root, tag) => {
        for (const node of root.querySelectorAll("*")) {
            if (node.localName === tag) return node;
            const inner = node.shadowRoot && find(node.shadowRoot, tag);
            if (inner) return inner;
        }
        return null;
    };
    const huiRoot = find(document, "hui-root");
    const dashboardChrome = huiRoot.shadowRoot.querySelector("home-dashboard-chrome");
"""
INTERACT = f"""() => {{
    {FIND}
    window.dashboardChromeBefore = dashboardChrome;
    dashboardChrome.shadowRoot.querySelector('[data-page="energy"]').click();
    return location.pathname;
}}"""
SAME_CHROME = f"""() => {{ {FIND} return window.dashboardChromeBefore === dashboardChrome && dashboardChrome.page; }}"""
OPEN_DETAILS = f"""() => {{
    {FIND}
    find(huiRoot.shadowRoot, "home-dashboard-page").shadowRoot.querySelector(".tile.light .text").click();
}}"""


OPEN_SHEET = f"""(kind) => {{
    {FIND}
    find(huiRoot.shadowRoot, "home-dashboard-page").shadowRoot.querySelector(`.tile[data-entity^="${{kind}}."] .text`).click();
}}"""
SHEET_GONE = f"""() => {{ {FIND} return !dashboardChrome.shadowRoot.querySelector("home-dashboard-sheet"); }}"""
OPEN_DRAWER = f"""() => {{ {FIND} dashboardChrome.open({{ type: "drawer" }}); }}"""


def main(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    tokens = json.loads((ROOT / ".dev-config" / "tokens.json").read_text())
    stored = {**tokens, "hassUrl": BASE, "clientId": f"{BASE}/", "expires": 9999999999999}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        for name, (width, height) in SCREENS.items():
            context = browser.new_context(viewport={"width": width, "height": height})
            context.add_init_script(
                f"localStorage.setItem('hassTokens', {json.dumps(json.dumps(stored))});"
                "localStorage.setItem('selectedTheme', JSON.stringify({theme: 'busy_test_theme'}));"
            )
            page = context.new_page()
            problems: list[str] = []
            page.on("pageerror", lambda error, log=problems: log.append(f"pageerror: {error} {error.stack}"))
            page.on(
                "console",
                lambda message, log=problems: log.append(f"console: {message.text[:200]}")
                if message.type == "error"
                else None,
            )
            page.goto(f"{BASE}/home-dashboard/home", wait_until="domcontentloaded")
            page.wait_for_timeout(7000)
            confirm = page.get_by_role("button", name="Potwierdź")
            if confirm.count():  # the dev instance asks to accept its own HTTP port once
                confirm.first.click()
                page.wait_for_timeout(1500)
            print(name, json.dumps(page.evaluate(PROBE), ensure_ascii=False))
            page.screenshot(path=output / f"{name}-home.png")
            print("  ", json.dumps(page.evaluate(INTERACT), ensure_ascii=False))
            page.wait_for_timeout(1500)
            print("   after navigation:", json.dumps(page.evaluate(PROBE), ensure_ascii=False)[:160])
            print("   same chrome element:", page.evaluate(SAME_CHROME))
            page.screenshot(path=output / f"{name}-energy.png")
            page.go_back()
            page.wait_for_timeout(1500)
            print("   back:", page.evaluate("location.pathname"))
            page.evaluate(OPEN_DETAILS)
            page.wait_for_timeout(1500)
            page.screenshot(path=output / f"{name}-details.png")
            page.go_back()
            page.wait_for_timeout(800)
            for kind in ("climate", "cover"):
                page.evaluate(OPEN_SHEET, kind)
                page.wait_for_timeout(900)
                page.screenshot(path=output / f"{name}-{kind}.png")
                page.go_back()
                page.wait_for_timeout(800)
                print(f"   {kind} sheet closed by back:", page.evaluate(SHEET_GONE), page.evaluate("location.pathname"))
            page.evaluate(OPEN_DRAWER)
            page.wait_for_timeout(600)
            page.screenshot(path=output / f"{name}-drawer.png")
            page.go_back()
            page.wait_for_timeout(600)
            for view in ("media", "map"):
                page.goto(f"{BASE}/home-dashboard/{view}", wait_until="domcontentloaded")
                page.wait_for_timeout(6000)
                page.screenshot(path=output / f"{name}-{view}.png")
            for text in problems[:8]:
                print("  ", text)
            context.close()
        browser.close()


if __name__ == "__main__":
    main(Path(sys.argv[1]))
