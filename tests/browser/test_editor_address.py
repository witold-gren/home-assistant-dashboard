"""The chosen node in the address (#/...): a link or a reload opens the editor on it, once the dashboard has loaded,
and choosing another node changes the address without a new step of the browser's history (address.js)."""

from __future__ import annotations

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401

TILE = "layout/0/sections/0/tiles/0"


def address(page) -> str:
    return page.evaluate("window.location.hash")


def chosen(page) -> list[str]:
    return page.locator(f"{APP} .node.sel").evaluate_all("(nodes) => nodes.map((node) => node.dataset.node)")


def open_at(page, hash_: str) -> None:
    page.evaluate(
        "(hash) => history.replaceState(history.state, '', location.pathname + location.search + hash)", hash_
    )
    open_editor(page)


def test_choosing_a_node_puts_it_in_the_address(desktop):  # noqa: F811
    open_editor(desktop)
    desktop.evaluate("""() => { window.pushed = 0; const push = history.pushState.bind(history);
        history.pushState = (...args) => { window.pushed++; push(...args); }; }""")
    select(desktop, TILE)
    assert address(desktop) == f"#/{TILE}"
    assert desktop.evaluate("window.pushed") == 0


def test_the_editor_opens_on_the_node_in_the_address(desktop):  # noqa: F811
    open_at(desktop, f"#/{TILE}")
    desktop.wait_for_selector(f"{APP} .node.sel")
    assert chosen(desktop) == [TILE]
    assert address(desktop) == f"#/{TILE}"


def test_a_node_that_is_gone_opens_nothing_and_leaves_the_address(desktop):  # noqa: F811
    open_at(desktop, "#/layout/99/sections/0")
    assert chosen(desktop) == []
    assert address(desktop) == ""


def test_the_address_is_read_and_written_the_same_way(desktop):  # noqa: F811
    open_editor(desktop)
    keys = desktop.evaluate(
        """async () => { const m = await import('/custom_components/home_dashboard/www/editor/address.js');
        return [m.addressKey('#/rooms/Kuchnia%20mała/0'), m.addressHash('rooms/Kuchnia mała/0'), m.addressKey(''),
                m.addressKey('#/%E0%A4%A')]; }"""
    )
    assert keys == ["rooms/Kuchnia mała/0", "#/rooms/Kuchnia%20ma%C5%82a/0", None, None]
