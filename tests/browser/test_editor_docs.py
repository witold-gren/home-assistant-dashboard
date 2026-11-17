"""The "?" of the editor's top bar: the guide to the editor on the documentation site, in a new tab."""

from __future__ import annotations

from .test_editor_app import APP, desktop, open_editor  # noqa: F401
from .test_editor_publish import open_dialog, rename_kitchen

EDITOR = "/custom_components/home_dashboard/www/editor/editor-app.js"


def test_the_guide_is_in_the_language_of_home_assistant(desktop) -> None:  # noqa: F811
    urls = desktop.evaluate(
        f"async () => {{ const e = await import('{EDITOR}');"
        " return ['pl', 'pl-PL', 'en', undefined].map((language) => e.editorDocsUrl(language)); }"
    )
    site = "https://witold-gren.github.io/home-assistant-dashboard/"
    assert urls == [f"{site}pl/editor/", f"{site}pl/editor/", f"{site}editor/", f"{site}editor/"]


def test_the_question_mark_opens_the_guide_in_a_new_tab(desktop) -> None:  # noqa: F811
    open_editor(desktop)
    desktop.evaluate(
        "() => { window.opened = []; window.open = (...args) => { window.opened.push(args); }; }"
    )
    button = desktop.locator(f"{APP} [data-docs]")
    assert "Dokumentacja" in button.get_attribute("title")
    button.click()
    opened = desktop.evaluate("window.opened")
    assert opened == [
        ["https://witold-gren.github.io/home-assistant-dashboard/pl/editor/", "_blank", "noopener"]
    ]


def _help_of(page, part: str) -> dict:
    """Open the "?" of a part: its window, never a new tab."""
    page.evaluate("() => { window.opened = []; window.open = (...args) => { window.opened.push(args); }; }")
    page.locator(f"{APP} [data-help='{part}']").click()
    pop = page.locator(f"{APP} [data-help-pop='{part}']")
    pop.wait_for()
    return {
        "title": pop.locator("b").inner_text(),
        "text": pop.locator("p").inner_text(),
        "more": pop.locator("[data-help-more]").get_attribute("href"),
        "opened": page.evaluate("window.opened"),
    }


def test_the_question_mark_of_a_part_opens_a_window_with_what_it_does(desktop) -> None:  # noqa: F811
    open_editor(desktop)
    guide = "https://witold-gren.github.io/home-assistant-dashboard/pl/editor/"
    for part, title, anchor in [
        ("tree", "Drzewo", "a-tour-of-the-screen"),
        ("preview", "Podgląd", "the-preview"),
        ("props", "Ustawienia tego, co wybrane", "a-tour-of-the-screen"),
    ]:
        help_ = _help_of(desktop, part)
        assert help_["title"] == title
        assert len(help_["text"]) > 80
        assert help_["more"] == f"{guide}#{anchor}"
        assert help_["opened"] == []
        desktop.locator(f"{APP} [data-help-close]").click()
        assert desktop.locator(f"{APP} [data-help-pop]").count() == 0


def test_the_window_closes_with_escape_a_click_beside_it_or_its_question_mark(desktop) -> None:  # noqa: F811
    open_editor(desktop)
    pop = f"{APP} [data-help-pop]"
    _help_of(desktop, "tree")
    desktop.keyboard.press("Escape")
    assert desktop.locator(pop).count() == 0
    _help_of(desktop, "tree")
    desktop.locator(f"{APP} [data-help-shade]").click(position={"x": 5, "y": 400})
    assert desktop.locator(pop).count() == 0
    _help_of(desktop, "tree")
    desktop.locator(f"{APP} [data-help='tree']").click(force=True)
    assert desktop.locator(pop).count() == 0


def test_the_link_of_the_settings_window_follows_what_is_chosen(desktop) -> None:  # noqa: F811
    open_editor(desktop)
    guide = "https://witold-gren.github.io/home-assistant-dashboard/pl/editor/"
    chosen = {
        "layout/0": "rooms",
        "layout/0/sections/0/tiles/0": "sections-and-tiles",
        "appearance": "look-themes-and-backgrounds",
        "access": "who-sees-what",
        "cameras": "cameras-energy-intercom-and-the-other",
    }
    for key, anchor in chosen.items():
        desktop.locator(f"{APP} [data-node='{key}']").click()
        assert _help_of(desktop, "props")["more"] == f"{guide}#{anchor}", key
        desktop.keyboard.press("Escape")


def _dialog_help(page, part: str) -> dict:
    page.evaluate("() => { window.opened = []; window.open = (...args) => { window.opened.push(args); }; }")
    page.locator(f"{APP} [data-help='{part}']").click()
    pop = page.locator(f"{APP} [data-help-pop='{part}']")
    pop.wait_for()
    return {
        "title": pop.locator("b").inner_text(),
        "text": pop.locator("p").inner_text(),
        "more": pop.locator("[data-help-more]").get_attribute("href"),
        "opened": page.evaluate("window.opened"),
    }


def test_the_history_and_the_settings_have_their_own_question_mark(desktop) -> None:  # noqa: F811
    open_editor(desktop)
    guide = "https://witold-gren.github.io/home-assistant-dashboard/pl/editor/"
    desktop.locator(f"{APP} [data-history]").click()
    help_ = _dialog_help(desktop, "history")
    assert help_["title"] == "Historia" and len(help_["text"]) > 80
    assert help_["more"] == f"{guide}#saving-publishing-and-history"
    assert help_["opened"] == []
    # Esc closes the window of the "?", not the dialog under it.
    desktop.keyboard.press("Escape")
    assert desktop.locator(f"{APP} [data-help-pop]").count() == 0
    assert desktop.locator(f"{APP} [data-history-dialog]").count() == 1
    desktop.locator(f"{APP} [data-history-dialog] [data-dialog-close]").click()
    desktop.locator(f"{APP} [data-editor-settings]").click()
    help_ = _dialog_help(desktop, "devices")
    assert help_["title"] == "Ustawienia edytora"
    assert help_["more"] == f"{guide}#editor-settings-your-own-phones-and"
    desktop.locator(f"{APP} [data-help-close]").click()
    assert desktop.locator(f"{APP} [data-help-pop]").count() == 0


def test_the_publish_dialog_has_its_own_question_mark(desktop) -> None:  # noqa: F811
    open_editor(desktop)
    rename_kitchen(desktop)
    open_dialog(desktop)
    help_ = _dialog_help(desktop, "publish")
    assert help_["title"] == "Publikowanie" and len(help_["text"]) > 80
    assert help_["opened"] == []


def test_a_question_home_assistant_never_answers_ends_in_a_message(desktop) -> None:  # noqa: F811
    open_editor(desktop)
    result = desktop.evaluate(
        """async () => { const { callWS, WsTimeout } = await import('/custom_components/home_dashboard/www/editor/ws.js');
        const hass = { language: 'pl', callWS: () => new Promise(() => {}) };
        try { await callWS(hass, { type: 'home_dashboard/editor/load' }, 1000); return 'answered'; }
        catch (error) { return [error instanceof WsTimeout, error.message]; } }"""
    )
    assert result[0] is True
    assert "nie odpowiedział w ciągu 1 s (home_dashboard/editor/load)" in result[1]


def test_an_answer_in_time_clears_the_timer(desktop) -> None:  # noqa: F811
    open_editor(desktop)
    result = desktop.evaluate(
        """async () => { const { callWS } = await import('/custom_components/home_dashboard/www/editor/ws.js');
        const cleared = []; const clear = window.clearTimeout;
        window.clearTimeout = (id) => { cleared.push(id); clear(id); };
        const answer = await callWS({ callWS: async () => 'ok' }, { type: 'x' });
        window.clearTimeout = clear; return [answer, cleared.length]; }"""
    )
    assert result == ["ok", 1]
