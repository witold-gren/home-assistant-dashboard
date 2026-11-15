"""The "?" of the editor's top bar: the guide to the editor on the documentation site, in a new tab."""

from __future__ import annotations

from .test_editor_app import APP, desktop, open_editor  # noqa: F401

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
    desktop.evaluate("() => { window.opened = []; window.open = (...args) => { window.opened.push(args); }; }")
    button = desktop.locator(f"{APP} [data-docs]")
    assert "Dokumentacja" in button.get_attribute("title")
    button.click()
    opened = desktop.evaluate("window.opened")
    assert opened == [["https://witold-gren.github.io/home-assistant-dashboard/pl/editor/", "_blank", "noopener"]]
