"""The tour of the editor: the first time the editor opens in a browser it frames its parts one at a time with a bubble
that says what each is and where it is set; it is skipped, closed and opened again from ⚙."""

from __future__ import annotations

from .test_editor_app import APP, desktop, open_editor  # noqa: F401

TOUR = f"{APP} home-dashboard-editor-tour"
MODULE = "/custom_components/home_dashboard/www/editor/tour.js"


def bubble(page) -> dict:
    return page.evaluate(f"""() => {{
        const tour = document.querySelector('{APP}').shadowRoot.querySelector('home-dashboard-editor-tour');
        const root = tour.shadowRoot;
        const bubble = root.querySelector('[data-tour-bubble]');
        const frame = root.querySelector('[data-tour-frame]');
        const b = bubble.getBoundingClientRect();
        return {{ step: bubble.dataset.tourBubble, count: root.querySelector('[data-tour-count]').textContent.trim(),
                 title: bubble.querySelector('h3').textContent.trim(), next: root.querySelector('[data-tour-next]').textContent.trim(),
                 frame: frame ? (({{ left, top, right, bottom }}) => ({{ left, top, right, bottom }}))(frame.getBoundingClientRect()) : null,
                 bubble: {{ left: b.left, top: b.top, right: b.right, bottom: b.bottom }}, width: innerWidth, height: innerHeight }}; }}""")


def box(page, selector: str) -> dict:
    return page.evaluate(
        f"""() => (({{ left, top, right, bottom }}) => ({{ left, top, right, bottom }}))(
            document.querySelector('{APP}').shadowRoot.querySelector("{selector}").getBoundingClientRect())"""
    )


def next_step(page) -> None:
    page.locator(f"{TOUR} [data-tour-next]").click()


def test_the_first_time_the_editor_shows_itself_round(desktop):  # noqa: F811
    open_editor(desktop, tour=True)
    desktop.wait_for_selector(f"{TOUR} [data-tour-bubble='welcome']")
    first = bubble(desktop)
    assert first["title"] == "Witaj w edytorze" and first["count"] == "Przewodnik · 1 z 8"
    assert first["frame"] is None
    next_step(desktop)
    tree = bubble(desktop)
    assert tree["step"] == "tree" and tree["title"] == "Drzewo dashboardu"
    # The frame is round the tree, and the bubble beside it, inside the window
    part = box(desktop, "[data-tree]")
    # (kept 4 px inside the window at its edge)
    assert tree["frame"]["left"] <= max(part["left"], 4) + 1 and tree["frame"]["right"] >= part["right"] - 1
    assert tree["bubble"]["left"] >= tree["frame"]["right"]
    assert tree["bubble"]["right"] <= tree["width"] and tree["bubble"]["bottom"] <= tree["height"]
    assert "Gdzie to zmienić" in desktop.locator(f"{TOUR} .where").inner_text()


def test_every_step_frames_its_part_and_the_last_one_ends_it(desktop):  # noqa: F811
    open_editor(desktop, tour=True)
    desktop.wait_for_selector(f"{TOUR} [data-tour-bubble]")
    seen = []
    for _ in range(8):
        step = bubble(desktop)
        seen.append(step["step"])
        if step["step"] != "welcome":
            assert step["frame"], step["step"]
        if step["step"] == "help":
            assert step["next"] == "Gotowe"
        next_step(desktop)
    assert seen == ["welcome", "tree", "preview", "devices", "props", "undo", "publish", "help"]
    desktop.wait_for_selector(TOUR, state="detached")
    assert desktop.evaluate("localStorage.getItem('home-dashboard-editor-tour')") == "done"


def test_skipped_once_it_stays_away_and_comes_back_from_the_gear(desktop):  # noqa: F811
    open_editor(desktop, tour=True)
    desktop.locator(f"{TOUR} [data-tour-skip]").click()
    desktop.wait_for_selector(TOUR, state="detached")
    # Opened again in the same browser: no tour
    desktop.evaluate(
        "async () => { const s = window.editor.server; await window.editor.app.firstUpdated(); }"
    )
    desktop.wait_for_timeout(200)
    assert desktop.locator(TOUR).count() == 0
    desktop.locator(f"{APP} [data-editor-settings]").click()
    desktop.locator(f"{APP} [data-gear-tour]").click()
    desktop.wait_for_selector(f"{TOUR} [data-tour-bubble='welcome']")


def test_the_keyboard_moves_through_it_and_escape_closes_it(desktop):  # noqa: F811
    open_editor(desktop, tour=True)
    desktop.wait_for_selector(f"{TOUR} [data-tour-bubble='welcome']")
    desktop.keyboard.press("ArrowRight")
    desktop.keyboard.press("ArrowRight")
    assert bubble(desktop)["step"] == "preview"
    desktop.keyboard.press("ArrowLeft")
    assert bubble(desktop)["step"] == "tree"
    desktop.locator(f"{TOUR} [data-tour-back]").click()
    assert bubble(desktop)["step"] == "welcome"
    desktop.keyboard.press("Escape")
    desktop.wait_for_selector(TOUR, state="detached")
    # Escape belonged to the tour: nothing else of the editor closed or changed
    assert desktop.evaluate("localStorage.getItem('home-dashboard-editor-tour')") == "done"


def test_a_step_whose_part_is_not_there_is_left_out_and_the_bubble_stays_in_the_window(desktop):  # noqa: F811
    open_editor(desktop)
    result = desktop.evaluate(
        f"""async () => {{
        const t = await import('{MODULE}');
        const only = {{ querySelector: (s) => (s === '[data-tree]' ? document.body : null) }};
        const keys = t.shownSteps(only).map((step) => step.key);
        const corner = t.bubbleAt({{ left: 1500, top: 850, width: 90, height: 40 }}, 'right', {{ height: 200 }}, 1600, 900);
        const middle = t.bubbleAt(null, null, {{ height: 200 }}, 1600, 900);
        return {{ keys, corner, middle }};
    }}"""
    )
    assert result["keys"] == ["welcome", "tree"]
    assert result["corner"]["left"] + result["corner"]["width"] <= 1600 - 16
    assert result["corner"]["top"] + 200 <= 900 - 16
    assert result["middle"]["left"] == (1600 - 360) / 2


def test_the_tour_speaks_english_too(desktop):  # noqa: F811
    open_editor(desktop, tour=True, language="en")
    desktop.wait_for_selector(f"{TOUR} [data-tour-bubble='welcome']")
    assert bubble(desktop)["title"] == "Welcome to the editor"
    assert bubble(desktop)["count"] == "Tour · 1 of 8"
