"""The editor on a computer, stage 1: the tree of the dashboard, the YAML of what is chosen, a draft that is kept
on the server and changes nothing live, and publishing with the conflict of a change made elsewhere."""

from __future__ import annotations

from collections.abc import Iterator

from playwright.sync_api import Page
import pytest

APP = "home-dashboard-editor-app"
DESKTOP = {"width": 1600, "height": 900}
STRATEGY = {
    "type": "custom:home-dashboard",
    "favorites": ["light.entity_0096"],
    "layout": [
        {
            "id": "living",
            "name": "Salon",
            "sections": [
                {
                    "title": "Oświetlenie",
                    "tiles": [
                        {"entity": "light.entity_0096", "name": "Sofa"},
                        {"entity": "light.entity_0097"},
                    ],
                },
                {"title": "Inne", "tiles": [{"entity": "switch.missing", "name": "Zniknął"}]},
            ],
        },
        {
            "id": "kitchen",
            "name": "Kuchnia",
            "sections": [{"title": "Kawa", "tiles": [{"entity": "switch.entity_0235"}]}],
        },
    ],
    "shortcuts": [{"kind": "panel", "name": "Ekspres", "icon": "mdi:coffee-maker"}],
}


@pytest.fixture
def desktop(browser, base_url) -> Iterator[Page]:
    page = browser.new_page(viewport=DESKTOP, reduced_motion="reduce")
    page.errors = []
    page.on("pageerror", lambda error: page.errors.append(str(error)))
    page.goto(f"{base_url}/tests/js/editor-harness.html")
    page.wait_for_function("window.editorReady === true")
    yield page
    assert page.errors == []
    page.close()


def open_editor(page, strategy=STRATEGY, **options) -> None:
    page.evaluate("async ([strategy, options]) => window.editor.open(strategy, options)", [strategy, options])
    page.wait_for_selector(f"{APP} [data-tree]")


def sent(page, kind: str) -> list:
    return page.evaluate(
        f"window.editor.server.state.sent.filter((m) => m.type === 'home_dashboard/editor/{kind}')"
    )


def server(page) -> dict:
    return page.evaluate("window.editor.server.state")


def select(page, key: str) -> None:
    page.locator(f"{APP} [data-node='{key}']").click()


def yaml_tab(page) -> None:
    """The YAML of what is chosen; the whole dashboard has no other tab."""
    tab = page.locator(f"{APP} [data-tab='yaml']")
    if tab.count():
        tab.click()


def type_yaml(page, text: str) -> None:
    yaml_tab(page)
    page.locator(f"{APP} [data-yaml]").fill(text)


def publish_all(page) -> None:
    """Publish through the dialog, as a person does: open it, then publish for everyone."""
    page.locator(f"{APP} [data-publish]").click()
    page.locator(f"{APP} home-dashboard-editor-publish [data-publish-all]").click()


def wait_saved(page) -> None:
    page.wait_for_function(
        "document.querySelector('home-dashboard-editor-app').shadowRoot.querySelector('[data-draft-state]').textContent.includes('zapisany')"
    )


# The tree -------------------------------------------------------------------------------------------


def test_the_tree_shows_home_rooms_sections_tiles_and_blocks(desktop):
    open_editor(desktop)
    labels = desktop.locator(f"{APP} [data-node] .label").all_inner_texts()
    for label in (
        "Ulubione",
        "Sceny",
        "Salon",
        "Oświetlenie",
        "Sofa",
        "Entity 0097",
        "Kuchnia",
        "Kawa",
        "Ekspres",
        "Wygląd i motywy",
    ):
        assert label in labels
    groups = desktop.locator(f"{APP} [data-group] .group-name").all_inner_texts()
    assert groups == ["STRONA GŁÓWNA", "POKOJE", "BLOKI", "USTAWIENIA"]


def test_a_tile_of_a_missing_entity_and_its_room_are_marked(desktop):
    open_editor(desktop)
    assert "warn" in desktop.locator(f"{APP} [data-node='layout/0/sections/1/tiles/0']").get_attribute(
        "class"
    )
    assert "warn" in desktop.locator(f"{APP} [data-node='layout/0']").get_attribute("class")
    assert "warn" not in desktop.locator(f"{APP} [data-node='layout/1']").get_attribute("class")
    select(desktop, "layout/0/sections/1/tiles/0")
    assert desktop.locator(f"{APP} [data-problem='editor_problem_no_entity']").count() == 1


def test_search_keeps_what_matches_with_the_way_to_it(desktop):
    open_editor(desktop)
    desktop.locator(f"{APP} [data-search]").fill("0235")
    keys = desktop.locator(f"{APP} [data-node]").evaluate_all(
        "(nodes) => nodes.map((node) => node.dataset.node)"
    )
    assert keys == ["layout/1", "layout/1/sections/0", "layout/1/sections/0/tiles/0"]


def test_a_room_folds_and_stays_folded(desktop):
    open_editor(desktop)
    desktop.locator(f"{APP} [data-fold='layout/0']").click()
    assert desktop.locator(f"{APP} [data-node='layout/0/sections/0']").count() == 0
    open_editor(desktop)
    assert desktop.locator(f"{APP} [data-node='layout/0/sections/0']").count() == 0
    desktop.locator(f"{APP} [data-fold='layout/0']").click()
    assert desktop.locator(f"{APP} [data-node='layout/0/sections/0']").count() == 1


# YAML and the draft ------------------------------------------------------------------------------------


def test_choosing_a_tile_shows_its_yaml(desktop):
    open_editor(desktop)
    select(desktop, "layout/0/sections/0/tiles/0")
    assert desktop.locator(f"{APP} [data-props-title]").inner_text() == "Sofa"
    yaml_tab(desktop)
    assert desktop.locator(f"{APP} [data-yaml]").input_value() == "entity: light.entity_0096\nname: Sofa\n"


def test_typing_yaml_changes_the_draft_and_nothing_live(desktop):
    open_editor(desktop)
    select(desktop, "layout/0/sections/0/tiles/0")
    type_yaml(desktop, "entity: light.entity_0096\nname: Kanapa\n")
    assert desktop.locator(f"{APP} [data-node='layout/0/sections/0/tiles/0'] .label").inner_text() == "Kanapa"
    assert desktop.locator(f"{APP} [data-props-title]").inner_text() == "Kanapa"
    wait_saved(desktop)
    state = server(desktop)
    assert state["draft"]["config"]["strategy"]["layout"][0]["sections"][0]["tiles"][0]["name"] == "Kanapa"
    assert state["live"]["strategy"]["layout"][0]["sections"][0]["tiles"][0]["name"] == "Sofa"
    assert state["draft"]["base"] == desktop.evaluate(
        "(strategy) => window.editor.configHash({ strategy })", STRATEGY
    )


def test_many_letters_are_saved_once(desktop):
    open_editor(desktop)
    select(desktop, "layout/0/sections/0/tiles/0")
    yaml_tab(desktop)
    field = desktop.locator(f"{APP} [data-yaml]")
    field.click()
    desktop.keyboard.press("End")
    desktop.keyboard.type("#abc")
    wait_saved(desktop)
    assert len(sent(desktop, "save_draft")) == 1


def test_yaml_that_does_not_read_is_kept_with_its_error_and_saves_nothing(desktop):
    open_editor(desktop)
    select(desktop, "layout/0/sections/0/tiles/0")
    type_yaml(desktop, "entity: [light.a\n")
    assert desktop.locator(f"{APP} [data-yaml-error]").count() == 1
    assert desktop.locator(f"{APP} [data-yaml]").input_value() == "entity: [light.a\n"
    desktop.wait_for_timeout(1000)
    assert sent(desktop, "save_draft") == []


def test_the_whole_dashboard_must_stay_a_mapping(desktop):
    open_editor(desktop)
    desktop.locator(f"{APP} [data-whole-yaml]").click()
    type_yaml(desktop, "- a\n- b\n")
    assert desktop.locator(f"{APP} [data-yaml-error]").count() == 1


def test_a_draft_comes_back_after_a_reload(desktop):
    open_editor(desktop)
    select(desktop, "layout/1")
    yaml_tab(desktop)
    desktop.locator(f"{APP} [data-yaml]").fill("id: kitchen\nname: Kuchnia i jadalnia\nsections: []\n")
    wait_saved(desktop)
    desktop.evaluate("""async () => { const app = window.editor.app; app.remove();
        const { mountEditor } = await import('/custom_components/home_dashboard/www/editor/editor-app.js');
        const host = document.createElement('div'); document.body.appendChild(host);
        window.editor.app = mountEditor(host, app.hass, {}); }""")
    desktop.wait_for_selector(f"{APP} [data-node='layout/1']")
    assert desktop.locator(f"{APP} [data-node='layout/1'] .label").inner_text() == "Kuchnia i jadalnia"
    assert desktop.locator(f"{APP} [data-draft-state]").get_attribute("data-draft-state") == "draft"


def test_throwing_the_draft_away_brings_the_live_version_back(desktop):
    open_editor(desktop)
    select(desktop, "layout/1")
    type_yaml(desktop, "id: kitchen\nname: Inna\n")
    wait_saved(desktop)
    desktop.once("dialog", lambda dialog: dialog.accept())
    desktop.locator(f"{APP} [data-discard]").click()
    desktop.wait_for_function(
        "document.querySelector('home-dashboard-editor-app').shadowRoot.querySelector('[data-draft-state]').dataset.draftState === 'live'"
    )
    assert desktop.locator(f"{APP} [data-node='layout/1'] .label").inner_text() == "Kuchnia"
    assert server(desktop)["draft"] is None


# Publishing ---------------------------------------------------------------------------------------------


def test_nothing_to_publish_without_a_draft(desktop):
    open_editor(desktop)
    assert desktop.locator(f"{APP} [data-publish]").is_disabled()


def test_publishing_makes_the_draft_live_and_keeps_the_old_version(desktop):
    open_editor(desktop)
    select(desktop, "layout/1")
    type_yaml(desktop, "id: kitchen\nname: Kuchnia i jadalnia\n")
    publish_all(desktop)
    desktop.wait_for_selector(f"{APP} [data-notice='ok']")
    state = server(desktop)
    assert state["live"]["strategy"]["layout"][1]["name"] == "Kuchnia i jadalnia"
    assert state["draft"] is None
    assert len(state["history"]) == 1
    assert desktop.locator(f"{APP} [data-publish]").is_disabled()


def test_a_change_made_elsewhere_is_shown_and_can_be_overruled(desktop):
    open_editor(desktop)
    select(desktop, "layout/1")
    type_yaml(desktop, "id: kitchen\nname: Moja\n")
    wait_saved(desktop)
    desktop.evaluate("() => { window.editor.server.state.live.strategy.layout[1].name = 'Z telefonu'; }")
    publish_all(desktop)
    desktop.wait_for_selector(f"{APP} [data-notice='conflict']")
    assert server(desktop)["live"]["strategy"]["layout"][1]["name"] == "Z telefonu"
    desktop.locator(f"{APP} [data-publish-force]").click()
    desktop.wait_for_selector(f"{APP} [data-notice='ok']")
    assert server(desktop)["live"]["strategy"]["layout"][1]["name"] == "Moja"


def test_the_columns_reach_the_bottom_of_the_window(desktop):
    open_editor(desktop)
    bottom = desktop.locator(f"{APP} [data-tree]").bounding_box()
    assert abs(bottom["y"] + bottom["height"] - 900) <= 1


def test_without_a_dashboard_of_the_strategy_it_says_what_to_do(desktop):
    desktop.evaluate("async () => window.editor.open({}, { dashboards: [] })")
    desktop.wait_for_selector(f"{APP} [data-no-dashboards]")


# The tree's pure functions ------------------------------------------------------------------------------


def run(page, body: str, arg=None):
    return page.evaluate(f"(arg) => {{ const t = window.editor.tree; {body} }}", arg)


def test_set_at_copies_the_way_and_shares_nothing(desktop):
    result = run(
        desktop,
        """const before = { a: [{ b: 1 }, { b: 2 }], c: { d: 1 } };
        const after = t.setAt(before, ['a', 1, 'b'], 5);
        return [before.a[1].b, after.a[1].b, after.c === before.c, after.a[0] === before.a[0], after.a === before.a];""",
    )
    assert result == [2, 5, True, True, False]


@pytest.mark.parametrize(
    ("source", "target", "index", "expected"),
    [
        (["x", 0], ["x"], 2, {"x": ["b", "a", "c"], "y": ["z"]}),
        (["x", 2], ["x"], 0, {"x": ["c", "a", "b"], "y": ["z"]}),
        (["x", 1], ["y"], 0, {"x": ["a", "c"], "y": ["b", "z"]}),
        (["x", 0], ["y"], 1, {"x": ["b", "c"], "y": ["z", "a"]}),
        (["x", 9], ["y"], 0, {"x": ["a", "b", "c"], "y": ["z"]}),
    ],
)
def test_moving_an_item_within_or_between_lists(desktop, source, target, index, expected):
    result = run(
        desktop,
        "return t.moveItem({ x: ['a', 'b', 'c'], y: ['z'] }, arg[0], arg[1], arg[2]);",
        [source, target, index],
    )
    assert result == expected


def test_insert_and_remove(desktop):
    result = run(
        desktop,
        """const value = { x: ['a', 'b'] };
        return [t.insertAt(value, ['x'], 1, 'n'), t.insertAt(value, ['new'], undefined, 'n'), t.removeAt(value, ['x', 0]), value];""",
    )
    assert result == [
        {"x": ["a", "n", "b"]},
        {"x": ["a", "b"], "new": ["n"]},
        {"x": ["b"]},
        {"x": ["a", "b"]},
    ]


def test_the_look_of_the_editor_follows_home_assistant_and_can_be_chosen(desktop):
    desktop.evaluate("() => localStorage.removeItem('home-dashboard-editor-theme')")
    open_editor(desktop)
    app = desktop.locator(APP)
    desktop.evaluate(
        "() => { window.editor.app.hass = { ...window.editor.app.hass, themes: { darkMode: true } }; }"
    )
    desktop.wait_for_function("window.editor.app.dataset.theme === 'dark'")
    desktop.evaluate(
        "() => { window.editor.app.hass = { ...window.editor.app.hass, themes: { darkMode: false } }; }"
    )
    desktop.wait_for_function("window.editor.app.dataset.theme === 'light'")
    button = desktop.locator(f"{APP} [data-theme-button]")
    button.click()  # auto → light
    assert button.get_attribute("data-theme-button") == "light"
    button.click()  # light → dark, whatever Home Assistant says
    desktop.wait_for_function("window.editor.app.dataset.theme === 'dark'")
    assert desktop.evaluate("() => localStorage.getItem('home-dashboard-editor-theme')") == "dark"
    dark = desktop.evaluate("() => getComputedStyle(window.editor.app).backgroundColor")
    button.click()  # dark → as Home Assistant (light now)
    desktop.wait_for_function("window.editor.app.dataset.theme === 'light'")
    assert desktop.evaluate("() => getComputedStyle(window.editor.app).backgroundColor") != dark
    assert app.count() == 1


def test_the_look_of_the_system_when_home_assistant_says_nothing(desktop):
    themes = desktop.evaluate("""async () => {
        const { editorTheme } = await import('/custom_components/home_dashboard/www/editor/editor-app.js');
        return [editorTheme('auto', {}, true), editorTheme('auto', {}, false), editorTheme('auto', { themes: { darkMode: false } }, true),
                editorTheme('dark', {}, false), editorTheme('light', {}, true)];
    }""")
    assert themes == ["dark", "light", "light", "dark", "light"]


def tree_keys(page) -> list[str]:
    return page.locator(f"{APP} [data-node]").evaluate_all(
        "(nodes) => nodes.map((node) => node.dataset.node)"
    )


def test_a_group_of_the_tree_folds_and_remembers_it(desktop):
    desktop.evaluate("() => localStorage.removeItem('home-dashboard-editor-collapsed')")
    open_editor(desktop)
    assert "layout/0" in tree_keys(desktop)
    desktop.locator(f"{APP} [data-group-fold='rooms']").click()
    assert "layout/0" not in tree_keys(desktop)
    assert "favorites" in tree_keys(desktop)  # the other groups stay open
    assert "rooms" in desktop.evaluate(
        "() => JSON.parse(localStorage.getItem('home-dashboard-editor-collapsed'))"
    )
    desktop.locator(f"{APP} [data-group='rooms'] .group-name").click()
    assert "layout/0" in tree_keys(desktop)


def test_the_button_of_a_group_folds_everything_inside_it(desktop):
    desktop.evaluate("() => localStorage.removeItem('home-dashboard-editor-collapsed')")
    open_editor(desktop)
    inside = [key for key in tree_keys(desktop) if key.startswith("layout/0/")]
    assert inside
    fold = desktop.locator(f"{APP} [data-group-fold-all='rooms']")
    assert fold.get_attribute("data-open") == "true"
    fold.click()
    keys = tree_keys(desktop)
    assert "layout/0" in keys and not any(key.startswith("layout/0/") for key in keys)
    fold.click()
    assert [key for key in tree_keys(desktop) if key.startswith("layout/0/")] == inside
    # a group of single items folds itself
    desktop.locator(f"{APP} [data-group-fold-all='rest']").click()
    assert "appearance" not in tree_keys(desktop)
    desktop.locator(f"{APP} [data-group-fold-all='rest']").click()
    assert "appearance" in tree_keys(desktop)


def test_fold_all_keeps_the_groups_open_and_a_folded_group_opens_for_what_is_chosen(desktop):
    desktop.evaluate("() => localStorage.removeItem('home-dashboard-editor-collapsed')")
    open_editor(desktop)
    desktop.locator(f"{APP} [data-fold-all]").click()
    keys = tree_keys(desktop)
    assert "layout/0" in keys and not any(key.startswith("layout/0/") for key in keys)
    desktop.locator(f"{APP} [data-group-fold='rooms']").click()
    assert "layout/0" not in tree_keys(desktop)
    desktop.evaluate("() => window.editor.app._selectPath(['layout', 0, 'sections', 0])")
    assert "layout/0/sections/0" in tree_keys(desktop)
