"""Folding the left and the right column (standard section 5): a button at the top of each, Ctrl/⌘+B and
Ctrl/⌘+Alt+B, a narrow rail with the button to unfold, the middle wider, the choice kept after a reload."""

from __future__ import annotations

from .test_editor_app import APP, STRATEGY, desktop, open_editor  # noqa: F401

FOLDED_KEY = "home-dashboard-editor-folded"


def middle_width(page) -> float:
    return page.locator(f"{APP} [data-stage]").bounding_box()["width"]


def test_the_buttons_fold_and_unfold_both_columns(desktop) -> None:  # noqa: F811
    desktop.evaluate(f"localStorage.removeItem('{FOLDED_KEY}')")
    open_editor(desktop)
    wide = middle_width(desktop)
    left_before = desktop.locator(f"{APP} [data-tree]").bounding_box()["width"]
    desktop.locator(f"{APP} [data-fold-column='left']").click()
    assert desktop.locator(f"{APP} [data-tree]").count() == 0
    rail = desktop.locator(f"{APP} [data-rail='left']")
    assert rail.is_visible() and rail.bounding_box()["width"] < 40
    assert "Ctrl/⌘+B" in desktop.locator(f"{APP} [data-unfold-column='left']").get_attribute("title")
    desktop.locator(f"{APP} [data-fold-column='right']").click()
    assert desktop.locator(f"{APP} [data-rail='right']").is_visible()
    assert middle_width(desktop) > wide + 300
    desktop.locator(f"{APP} [data-unfold-column='left']").click()
    desktop.locator(f"{APP} [data-unfold-column='right']").click()
    # The width from before folding comes back.
    assert abs(desktop.locator(f"{APP} [data-tree]").bounding_box()["width"] - left_before) < 2
    assert abs(middle_width(desktop) - wide) < 2


def test_the_keys_fold_the_columns_also_while_typing(desktop) -> None:  # noqa: F811
    desktop.evaluate(f"localStorage.removeItem('{FOLDED_KEY}')")
    open_editor(desktop)
    desktop.locator(f"{APP} [data-search]").focus()
    desktop.keyboard.press("Control+KeyB")
    assert desktop.locator(f"{APP} [data-rail='left']").is_visible()
    desktop.keyboard.press("Control+Alt+KeyB")
    assert desktop.locator(f"{APP} [data-rail='right']").is_visible()
    desktop.keyboard.press("Meta+KeyB")
    assert desktop.locator(f"{APP} [data-tree]").is_visible()


def test_the_folded_columns_stay_after_a_reload(desktop) -> None:  # noqa: F811
    desktop.evaluate(f"localStorage.removeItem('{FOLDED_KEY}')")
    open_editor(desktop)
    desktop.locator(f"{APP} [data-fold-column='left']").click()
    desktop.reload()
    desktop.wait_for_function("window.editorReady === true")
    desktop.evaluate("async (strategy) => window.editor.open(strategy)", STRATEGY)
    desktop.wait_for_selector(f"{APP} [data-rail='left']")
    assert desktop.locator(f"{APP} [data-tree]").count() == 0
    # The bar beside a folded column does not drag.
    assert (
        desktop.locator(f"{APP} [data-splitter='left']").evaluate(
            "(bar) => getComputedStyle(bar).pointerEvents"
        )
        == "none"
    )
    desktop.evaluate(f"localStorage.removeItem('{FOLDED_KEY}')")


def test_a_narrow_window_starts_with_the_right_column_folded(browser, base_url) -> None:
    page = browser.new_page(viewport={"width": 800, "height": 900}, reduced_motion="reduce")
    page.goto(f"{base_url}/tests/js/editor-harness.html")
    page.wait_for_function("window.editorReady === true")
    page.evaluate(f"localStorage.removeItem('{FOLDED_KEY}')")
    open_editor(page)
    assert page.locator(f"{APP} [data-rail='right']").is_visible()
    assert page.locator(f"{APP} [data-tree]").is_visible()
    page.close()
