"""⚙ in the editor's top bar: a pop-up with the look and the language, not another view. The choice works at once and
the pop-up stays open; Esc, a click beside it or ⚙ again close it, and ☰ closes it too."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, open_editor  # noqa: F401

POP = f"{APP} [data-gear-pop]"


@pytest.fixture(autouse=True)
def clean_storage(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop)


def open_gear(page):
    page.locator(f"{APP} [data-editor-settings]").click()
    page.wait_for_selector(POP)


def test_the_pop_up_shows_the_look_and_the_language(desktop) -> None:  # noqa: F811
    url = desktop.url
    open_gear(desktop)
    pop = desktop.locator(POP)
    assert pop.locator(".pop-title").inner_text() == "Wygląd i język"
    assert pop.locator("[data-theme-choice]").all_inner_texts() == ["Jak HA", "Jasny", "Ciemny"]
    assert pop.locator("[data-language-choice]").all_inner_texts() == ["Jak w HA", "Polski", "English"]
    assert pop.locator("[data-theme-choice='auto']").get_attribute("aria-pressed") == "true"
    assert pop.locator("[data-language-choice='auto']").get_attribute("aria-pressed") == "true"
    assert desktop.locator(f"{APP} [data-editor-settings]").get_attribute("aria-expanded") == "true"
    # the middle stays as it was: no dialog, the same address
    assert desktop.locator(f"{APP} home-dashboard-editor-devices").count() == 0
    assert desktop.url == url
    # the labels of a choice stay on one line
    heights = pop.locator("[data-theme-choice], [data-language-choice]").evaluate_all(
        "(buttons) => buttons.map((b) => b.getBoundingClientRect().height)"
    )
    assert max(heights) < 40


def test_the_pop_up_stands_under_the_gear_at_its_right_edge(desktop) -> None:  # noqa: F811
    open_gear(desktop)
    gear = desktop.locator(f"{APP} [data-editor-settings]").bounding_box()
    pop = desktop.locator(POP).bounding_box()
    assert pop["y"] >= gear["y"] + gear["height"]
    assert abs((pop["x"] + pop["width"]) - (gear["x"] + gear["width"])) < 2


def test_a_theme_works_at_once_and_the_pop_up_stays(desktop) -> None:  # noqa: F811
    open_gear(desktop)
    desktop.locator(f"{POP} [data-theme-choice='dark']").click()
    desktop.wait_for_function("window.editor.app.dataset.theme === 'dark'")
    assert desktop.evaluate("() => localStorage.getItem('home-dashboard-editor-theme')") == "dark"
    assert desktop.locator(POP).count() == 1
    # the button on the bar shows the same choice and still switches on its own
    bar = desktop.locator(f"{APP} [data-theme-button]")
    assert bar.get_attribute("data-theme-button") == "dark"
    bar.click()  # a click beside the pop-up: it closes, and opened again it shows the bar's choice
    assert desktop.locator(POP).count() == 0
    open_gear(desktop)
    assert desktop.locator(f"{POP} [data-theme-choice='auto']").get_attribute("aria-pressed") == "true"


def test_a_language_redraws_the_editor_and_is_kept(desktop) -> None:  # noqa: F811
    open_gear(desktop)
    desktop.locator(f"{POP} [data-language-choice='en']").click()
    desktop.wait_for_function(
        "() => window.editor.app.renderRoot.querySelector('[data-gear-pop] .pop-title').textContent === 'Look and language'"
    )
    assert desktop.locator(f"{APP} [data-publish]").inner_text().strip() == "Publish"
    assert desktop.evaluate("() => localStorage.getItem('home-dashboard-editor-language')") == "en"
    assert desktop.evaluate("() => window.editor.app.hass.language") == "en"
    assert desktop.locator(POP).count() == 1
    # a new hass from Home Assistant keeps the chosen language
    desktop.evaluate("() => { window.editor.app.hass = { ...window.editor.app.hass, language: 'pl' }; }")
    assert desktop.evaluate("() => window.editor.app.hass.language") == "en"
    # as in Home Assistant again
    desktop.locator(f"{POP} [data-language-choice='auto']").click()
    desktop.wait_for_function(
        "() => window.editor.app.renderRoot.querySelector('[data-gear-pop] .pop-title').textContent === 'Wygląd i język'"
    )


def test_escape_closes_the_pop_up(desktop) -> None:  # noqa: F811
    open_gear(desktop)
    desktop.keyboard.press("Escape")
    assert desktop.locator(POP).count() == 0


def test_a_click_beside_closes_the_pop_up(desktop) -> None:  # noqa: F811
    open_gear(desktop)
    desktop.locator(f"{APP} h1").click()
    assert desktop.locator(POP).count() == 0


def test_the_gear_again_closes_the_pop_up(desktop) -> None:  # noqa: F811
    open_gear(desktop)
    desktop.locator(f"{APP} [data-editor-settings]").click()
    assert desktop.locator(POP).count() == 0


def test_the_menu_button_closes_the_pop_up(desktop) -> None:  # noqa: F811
    open_gear(desktop)
    desktop.locator(f"{APP} [data-ha-menu]").click()
    assert desktop.locator(POP).count() == 0


def test_the_preview_devices_are_one_step_on(desktop) -> None:  # noqa: F811
    open_gear(desktop)
    desktop.locator(f"{POP} [data-gear-devices]").click()
    assert desktop.locator(POP).count() == 0
    assert desktop.locator(f"{APP} home-dashboard-editor-devices").count() == 1
