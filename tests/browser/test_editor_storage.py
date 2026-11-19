"""The editor without the browser's own storage (a private window, blocked site data): it opens and works, its small
choices are simply not remembered (stored.js)."""

from __future__ import annotations

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401

BLOCK = """() => Object.defineProperty(window, 'localStorage', { configurable: true,
    get() { throw new DOMException('blocked', 'SecurityError'); } })"""


def test_the_editor_works_without_the_storage_of_the_browser(desktop):  # noqa: F811
    errors = []
    desktop.on("pageerror", lambda error: errors.append(str(error)))
    desktop.evaluate(BLOCK)
    open_editor(desktop)
    desktop.locator(f"{APP} [data-theme-button]").click()
    select(desktop, "layout/0/sections/0/tiles/0")
    assert desktop.locator(f"{APP} .node.sel").count() == 1
    assert errors == []


def test_without_the_storage_the_tour_does_not_come_back_every_time(desktop):  # noqa: F811
    desktop.evaluate(BLOCK)
    open_editor(desktop, tour=True)
    desktop.wait_for_timeout(300)
    assert desktop.locator(f"{APP} home-dashboard-editor-tour").count() == 0
    desktop.locator(f"{APP} [data-editor-settings]").click()
    desktop.locator(f"{APP} [data-gear-tour]").click()
    desktop.wait_for_selector(f"{APP} home-dashboard-editor-tour [data-tour-bubble='welcome']")
    desktop.keyboard.press("Escape")
    desktop.wait_for_selector(f"{APP} home-dashboard-editor-tour", state="detached")
