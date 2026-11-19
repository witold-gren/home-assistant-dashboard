"""The lessons of the editor (⚙ → Lessons): tasks in three parts (to start with, next steps, set up once), each a short tour that goes where the task is done, frames one
part at a time and can wait for the framed button to be clicked; the list marks the ones gone through."""

from __future__ import annotations

from .test_editor_app import APP, STRATEGY, desktop, open_editor  # noqa: F401

TOUR = f"{APP} home-dashboard-editor-tour"
LIST = f"{APP} home-dashboard-editor-lessons"
LESSONS = "/custom_components/home_dashboard/www/editor/lessons.js"
I18N = "/custom_components/home_dashboard/www/app/i18n.js"
WITH_STATUS = {
    **STRATEGY,
    "shortcuts": [
        *STRATEGY.get("shortcuts", []),
        {"kind": "overview", "name": "Status", "sections": [{"title": "Uwaga", "alert": True, "items": []}]},
    ],
}


def open_lessons(page) -> None:
    page.locator(f"{APP} [data-editor-settings]").click()
    page.locator(f"{APP} [data-gear-lessons]").click()
    page.wait_for_selector(f"{LIST} [data-lessons-dialog]")


def start(page, key: str) -> None:
    open_lessons(page)
    page.locator(f"{LIST} [data-lesson='{key}']").click()
    page.wait_for_selector(f"{TOUR} [data-tour-bubble]")


def step(page) -> dict:
    return page.evaluate(f"""() => {{
        const root = document.querySelector('{APP}').shadowRoot.querySelector('home-dashboard-editor-tour').shadowRoot;
        const bubble = root.querySelector('[data-tour-bubble]');
        return {{ key: bubble.dataset.tourBubble, count: root.querySelector('[data-tour-count]').textContent.trim(),
                 title: bubble.querySelector('h3').textContent.trim(), frame: Boolean(root.querySelector('[data-tour-frame]')),
                 waits: Boolean(root.querySelector('[data-tour-try]')) }}; }}""")


def next_step(page) -> None:
    page.locator(f"{TOUR} [data-tour-next]").click()
    page.wait_for_timeout(250)


def test_the_list_has_its_lessons_in_three_parts_and_says_what_one_needs(desktop):  # noqa: F811
    open_editor(desktop)
    open_lessons(desktop)
    keys = desktop.locator(f"{LIST} [data-lesson]").evaluate_all(
        "(rows) => rows.map((row) => row.dataset.lesson)"
    )
    assert len(keys) == 27 and len(set(keys)) == 27
    assert keys[0] == "add_tile" and keys[10] == "tile_form" and keys[20] == "device_block"
    groups = desktop.locator(f"{LIST} [data-lessons-group]").all_inner_texts()
    assert [group.lower() for group in groups] == ["na początek", "następne kroki", "ustawiane raz"]
    assert "Dodaj urządzenie do pokoju" in desktop.locator(f"{LIST} [data-lesson='add_tile']").inner_text()
    # No Status block yet: the lesson on warnings says what it needs and cannot start
    warnings = desktop.locator(f"{LIST} [data-lesson='warnings']")
    assert warnings.is_disabled() and "blok Status" in warnings.inner_text()


def test_a_lesson_goes_where_the_task_is_and_waits_for_the_click(desktop):  # noqa: F811
    open_editor(desktop)
    start(desktop, "add_tile")
    first = step(desktop)
    assert first["count"] == "Dodaj urządzenie do pokoju · 1 z 6" and first["frame"]
    # It chose the first section of the first room
    assert desktop.evaluate("window.editor.app._selected?.key") == "layout/0/sections/0"
    next_step(desktop)
    assert step(desktop)["key"] == "type"
    next_step(desktop)
    pick = step(desktop)
    assert pick["key"] == "pick" and pick["waits"]
    # The framed button takes the click; the lesson goes on once the list is open
    desktop.locator(f"{APP} [data-action='pick']").click()
    desktop.wait_for_function(
        f"document.querySelector('{APP}').shadowRoot.querySelector('home-dashboard-editor-tour')"
        ".shadowRoot.querySelector('[data-tour-bubble]').dataset.tourBubble === 'list'"
    )
    assert step(desktop)["frame"]
    next_step(desktop)
    assert step(desktop)["key"] == "add"
    next_step(desktop)
    assert step(desktop)["key"] == "preview"
    desktop.locator(f"{TOUR} [data-tour-next]").click()
    desktop.wait_for_selector(TOUR, state="detached")
    open_lessons(desktop)
    assert desktop.locator(f"{LIST} [data-lesson='add_tile'] [data-lesson-done]").count() == 1


def test_outside_the_frame_nothing_takes_a_click_while_a_step_waits(desktop):  # noqa: F811
    open_editor(desktop)
    start(desktop, "add_tile")
    next_step(desktop)
    next_step(desktop)
    assert step(desktop)["waits"]
    desktop.mouse.click(5, 5)
    desktop.wait_for_timeout(500)
    assert step(desktop)["key"] == "pick"


def test_a_lesson_opens_the_part_of_the_settings_it_speaks_of(desktop):  # noqa: F811
    open_editor(desktop)
    start(desktop, "background")
    desktop.wait_for_timeout(500)
    opened = desktop.evaluate(
        """() => { const find = (root) => { const d = root.querySelector("[data-settings-section='themes']");
            if (d) return d; for (const e of root.querySelectorAll('*')) if (e.shadowRoot) { const f = find(e.shadowRoot); if (f) return f; }
            return null; };
            return find(document.querySelector('home-dashboard-editor-app').shadowRoot)?.open; }"""
    )
    assert opened is True
    assert desktop.evaluate("window.editor.app._selected?.key") == "appearance"
    assert step(desktop)["frame"]


def test_escape_stops_a_lesson_and_it_is_not_marked_done(desktop):  # noqa: F811
    open_editor(desktop)
    start(desktop, "order")
    desktop.keyboard.press("Escape")
    desktop.wait_for_selector(TOUR, state="detached")
    open_lessons(desktop)
    assert desktop.locator(f"{LIST} [data-lesson='order'] [data-lesson-done]").count() == 0


def test_every_lesson_goes_through_without_an_error(desktop):  # noqa: F811
    open_editor(desktop, WITH_STATUS)
    keys = desktop.evaluate(f"async () => (await import('{LESSONS}')).LESSONS.map((lesson) => lesson.key)")
    for key in keys:
        start(desktop, key)
        seen = 0
        while desktop.locator(TOUR).count():
            seen += 1
            assert seen < 10, key
            desktop.locator(f"{TOUR} [data-tour-next]").click()
            desktop.wait_for_timeout(150)
        desktop.keyboard.press("Escape")
        desktop.wait_for_timeout(150)
        # A window a lesson opened (the list of tiles, publishing) is closed for the next one
        desktop.evaluate(
            "() => { const app = window.editor.app; app._closePicker?.(); app._dialog = null; app._blockMenu = false;"
            " app._whole = false; app.requestUpdate(); }"
        )
        desktop.wait_for_timeout(150)


def test_every_text_of_the_lessons_is_there_in_both_languages(desktop):  # noqa: F811
    open_editor(desktop)
    missing = desktop.evaluate(
        f"""async () => {{ const {{ LESSONS, stepTextKey }} = await import('{LESSONS}'); const {{ translate }} = await import('{I18N}');
        const keys = LESSONS.flatMap((lesson) => [`lesson_${{lesson.key}}_name`, `lesson_${{lesson.key}}_about`,
            ...lesson.steps.flatMap((step) => [`${{stepTextKey(lesson, step)}}_title`, `${{stepTextKey(lesson, step)}}_text`])]);
        return ['en', 'pl'].flatMap((language) => keys.filter((key) => translate(language, key) === key).map((key) => `${{language}}:${{key}}`)); }}"""
    )
    assert missing == []
    english = desktop.evaluate(
        f"async () => (await import('{I18N}')).translate('en', 'lesson_add_tile_name')"
    )
    polish = desktop.evaluate(f"async () => (await import('{I18N}')).translate('pl', 'lesson_add_tile_name')")
    assert english == "Add a device to a room" and polish == "Dodaj urządzenie do pokoju"


def test_the_lesson_on_history_opens_it_with_the_click(desktop):  # noqa: F811
    open_editor(desktop)
    start(desktop, "history")
    next_step(desktop)
    assert step(desktop)["key"] == "open" and step(desktop)["waits"]
    desktop.locator(f"{APP} [data-history]").click()
    desktop.wait_for_function(
        f"document.querySelector('{APP}').shadowRoot.querySelector('home-dashboard-editor-tour')"
        ".shadowRoot.querySelector('[data-tour-bubble]').dataset.tourBubble === 'versions'"
    )
    assert desktop.locator(f"{APP} home-dashboard-editor-history").count() == 1


def test_the_lesson_on_a_tile_chooses_one_and_frames_its_fields(desktop):  # noqa: F811
    open_editor(desktop)
    start(desktop, "tile_form")
    assert desktop.evaluate("window.editor.app._selected?.key") == "layout/0/sections/0/tiles/0"
    # The frame follows the form of the tile once it is drawn
    desktop.wait_for_function(
        f"document.querySelector('{APP}').shadowRoot.querySelector('home-dashboard-editor-tour')"
        ".shadowRoot.querySelector('[data-tour-frame]')"
    )
    for key in ("size", "behaviour", "window", "block"):
        next_step(desktop)
        current = step(desktop)
        assert current["key"] == key and current["frame"], key


def test_a_lesson_on_a_block_the_dashboard_has_not_got_makes_it_first(desktop):  # noqa: F811
    open_editor(desktop)
    start(desktop, "school")
    first = step(desktop)
    assert first["key"] == "add" and first["waits"] and first["title"] == "Nowy blok"
    desktop.locator(f"{APP} [data-add-block]").click()
    desktop.wait_for_function(
        f"document.querySelector('{APP}').shadowRoot.querySelector('home-dashboard-editor-tour')"
        ".shadowRoot.querySelector('[data-tour-bubble]').dataset.tourBubble === 'kind'"
    )
    desktop.locator(f"{APP} [data-block-new='school']").click()
    desktop.wait_for_function(
        f"document.querySelector('{APP}').shadowRoot.querySelector('home-dashboard-editor-tour')"
        ".shadowRoot.querySelector('[data-tour-bubble]').dataset.tourBubble === 'children'"
    )
    strategy = desktop.evaluate("window.editor.app._strategy")
    assert strategy["shortcuts"][-1]["kind"] == "school"
    assert (
        desktop.evaluate("window.editor.app._selected?.key") == f"shortcuts/{len(strategy['shortcuts']) - 1}"
    )


def test_a_lesson_on_a_block_there_is_goes_straight_to_its_form(desktop):  # noqa: F811
    open_editor(desktop, WITH_STATUS)
    start(desktop, "device_block")
    assert step(desktop)["key"] == "main"
    assert desktop.evaluate("window.editor.app._selected?.key") == "shortcuts/0"


def test_the_question_mark_of_a_form_starts_its_lesson(desktop):  # noqa: F811
    open_editor(desktop)
    desktop.locator(f"{APP} [data-node='cameras']").click()
    desktop.locator(f"{APP} [data-help='props']").click()
    button = desktop.locator(f"{APP} [data-help-lesson]")
    assert button.get_attribute("data-help-lesson") == "cameras"
    assert "Pokaż krok po kroku: Kamery" in button.inner_text()
    button.click()
    desktop.wait_for_selector(f"{TOUR} [data-tour-bubble='order']")
    assert desktop.locator(f"{APP} [data-help-pop]").count() == 0


def test_every_part_of_the_tree_has_its_lesson(desktop):  # noqa: F811
    open_editor(desktop, WITH_STATUS)
    found = desktop.evaluate(
        f"""async () => {{ const {{ lessonFor }} = await import('{LESSONS}');
        const app = window.editor.app;
        const keys = [...app.renderRoot.querySelectorAll('[data-node]')].map((node) => node.dataset.node);
        return Object.fromEntries(keys.map((key) => [key, lessonFor(key, app._strategy)?.key ?? null])); }}"""
    )
    assert found["layout/0/sections/0/tiles/0"] == "tile_form" and found["layout/0/sections/0"] == "add_tile"
    assert found["shortcuts/0"] == "device_block" and found["shortcuts/0/stats"] == "device_block"
    assert found["intercom"] == "intercom" and found["map"] == "map" and found["access"] == "publish"
    # Every setting of the tree has a lesson
    settings = [
        "appearance",
        "lights",
        "status_panel",
        "cameras",
        "media",
        "music",
        "energy",
        "menu",
        "nav",
        "entities",
    ]
    assert all(found[key] for key in settings), {key: found[key] for key in settings}
