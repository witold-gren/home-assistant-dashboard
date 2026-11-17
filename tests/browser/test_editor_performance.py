"""The editor never hangs (standard section 9a): on a big dashboard, going through every part of it leaves no task of
the page longer than 500 ms, and a question Home Assistant does not answer ends in a message (test_editor_docs.py)."""

from __future__ import annotations

from .test_editor_app import APP, desktop  # noqa: F401

LONGEST_MS = 500
SETTINGS = ["appearance", "access", "cameras", "energy", "status_panel", "menu", "room_order", "entities", "lights",
            "home_settings", "music", "media", "map", "nav", "intercom"]  # fmt: skip

OPEN_BIG = """async ([rooms, sections, tiles]) => {
    const ids = Object.keys(window.editor.snapshot.states ?? window.editor.snapshot.entities ?? {})
        .filter((id) => /^(light|switch|sensor|binary_sensor|climate|cover|media_player)\\./.test(id));
    const pick = (n) => ids[n % ids.length];
    let n = 0;
    const layout = Array.from({ length: rooms }, (_, room) => ({
        id: `room_${room}`, name: `Pokój ${room}`,
        sections: Array.from({ length: sections }, (_, section) => ({
            title: `Sekcja ${section}`,
            tiles: Array.from({ length: tiles }, () => ({ entity: pick(n++) })),
        })),
    }));
    const strategy = { type: "custom:home-dashboard", favorites: ids.slice(0, 20), layout,
        shortcuts: [{ kind: "panel", name: "Ekspres", icon: "mdi:coffee-maker" }] };
    window.longTasks = [];
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.longTasks.push(entry.duration); })
        .observe({ type: "longtask", buffered: true });
    await window.editor.open(strategy);
    return ids.length;
}"""


def test_going_through_a_big_dashboard_never_blocks_the_page(desktop) -> None:  # noqa: F811
    entities = desktop.evaluate(OPEN_BIG, [30, 4, 10])
    assert entities > 50
    desktop.wait_for_selector(f"{APP} [data-tree]")
    desktop.evaluate("window.longTasks = []")
    for key in SETTINGS:
        desktop.locator(f"{APP} [data-node='{key}']").click()
    for room in (0, 9, 19, 29):
        desktop.locator(f"{APP} [data-node='layout/{room}']").click()
        desktop.locator(f"{APP} [data-node='layout/{room}/sections/2/tiles/5']").click()
    desktop.locator(f"{APP} [data-fold-all]").click()
    desktop.locator(f"{APP} [data-unfold-all]").click()
    desktop.locator(f"{APP} [data-search]").fill("Sekcja 3")
    desktop.locator(f"{APP} [data-search]").fill("")
    desktop.wait_for_timeout(300)
    tasks = desktop.evaluate("window.longTasks")
    assert max(tasks, default=0) < LONGEST_MS, sorted(tasks)[-5:]


def test_the_measure_sees_a_page_that_blocks(desktop) -> None:  # noqa: F811
    """The test above means something: a busy loop of 700 ms is seen as a long task."""
    desktop.evaluate(OPEN_BIG, [1, 1, 1])
    desktop.evaluate(
        "() => setTimeout(() => { const end = performance.now() + 700; while (performance.now() < end); })"
    )
    desktop.wait_for_timeout(900)
    desktop.wait_for_timeout(200)
    assert max(desktop.evaluate("window.longTasks"), default=0) >= LONGEST_MS


SLOW_SERVER = """(kind) => { const app = window.editor.app; const real = app.hass.callWS.bind(app.hass);
    window.inFlight = 0; window.mostInFlight = 0; window.saves = [];
    app.hass = { ...app.hass, callWS: async (message) => {
        if (message.type !== kind) return real(message);
        window.inFlight++; window.mostInFlight = Math.max(window.mostInFlight, window.inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try { return await real(message); } finally { window.inFlight--; window.saves.push(message); } } }; }"""


def test_a_slow_home_assistant_gets_one_save_of_the_draft_at_a_time(desktop) -> None:  # noqa: F811
    from .test_editor_app import STRATEGY, open_editor

    open_editor(desktop)
    desktop.evaluate(SLOW_SERVER, "home_dashboard/editor/save_draft")
    for name in ("Salon 1", "Salon 2", "Salon 3", "Salon 4"):
        desktop.evaluate(
            """(name) => { const app = window.editor.app; const s = structuredClone(app._strategy);
            s.layout[0].name = name; app._change(s); }""",
            name,
        )
        desktop.wait_for_timeout(900)
    desktop.wait_for_function("window.inFlight === 0 && window.saves.length > 0", timeout=15000)
    desktop.wait_for_timeout(2500)
    assert desktop.evaluate("window.mostInFlight") == 1
    saves = desktop.evaluate("window.saves")
    assert saves[-1]["config"]["strategy"]["layout"][0]["name"] == "Salon 4"
    assert len(saves) < 4
    assert STRATEGY["layout"][0]["name"] == "Salon"


def test_a_save_of_the_draft_that_fails_says_so_and_does_not_hang(desktop) -> None:  # noqa: F811
    from .test_editor_app import open_editor

    open_editor(desktop)
    desktop.evaluate(
        """() => { const app = window.editor.app; const real = app.hass.callWS.bind(app.hass);
        app.hass = { ...app.hass, callWS: (m) => m.type === 'home_dashboard/editor/save_draft'
            ? Promise.reject(new Error('Connection lost.')) : real(m) };
        const s = structuredClone(app._strategy); s.layout[0].name = 'Salon X'; app._change(s); }"""
    )
    desktop.wait_for_selector(f"{APP} [data-notice='error'], {APP} .notice.error", timeout=5000)
    assert (
        "Szkic nie został zapisany"
        in desktop.locator(f"{APP} .notice.error, {APP} [data-notice='error']").first.inner_text()
    )
    assert desktop.evaluate("window.editor.app._saving") is False
