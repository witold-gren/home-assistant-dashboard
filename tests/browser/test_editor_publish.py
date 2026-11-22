"""The editor on a computer, stage 6: publishing. What changes in plain words and in YAML, the checks, publishing
for one person to check and for everyone, the history with taking a version back as a draft; and on the side of
the person checking, the version to check with its banner and a way back to the usual one."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, STRATEGY, desktop, open_editor, select, type_yaml, wait_saved  # noqa: F401

DIALOG = "home-dashboard-editor-publish"
HISTORY = "home-dashboard-editor-history"
USERS = [
    {"id": "admin", "name": "Admin", "is_active": True},
    {"id": "kid", "name": "Kuba", "is_active": True},
]


@pytest.fixture(autouse=True)
def clean(desktop):  # noqa: F811
    desktop.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")


def server(page) -> dict:
    return page.evaluate("window.editor.server.state")


def rename_kitchen(page, name="Kuchnia i jadalnia") -> None:
    select(page, "layout/1")
    type_yaml(
        page,
        f"id: kitchen\nname: {name}\nsections:\n  - title: Kawa\n    tiles:\n      - entity: switch.entity_0235\n",
    )
    wait_saved(page)


def open_dialog(page) -> None:
    page.locator(f"{APP} [data-publish]").click()
    page.wait_for_selector(f"{APP} {DIALOG} [data-publish-dialog]")


def changes(page) -> list[str]:
    return page.locator(f"{APP} {DIALOG} [data-change]").all_inner_texts()


# The dialog --------------------------------------------------------------------------------------------------


def test_the_dialog_says_what_changes_and_publishes_nothing_by_itself(desktop):  # noqa: F811
    open_editor(desktop, users=USERS)
    rename_kitchen(desktop)
    open_dialog(desktop)
    assert [text.strip() for text in changes(desktop)] == [
        "Pokój „Kuchnia” nazywa się teraz „Kuchnia i jadalnia”"
    ]
    diff = desktop.locator(f"{APP} {DIALOG} [data-diff]").inner_text()
    assert "-     name: Kuchnia" in diff and "+     name: Kuchnia i jadalnia" in diff
    assert server(desktop)["live"]["strategy"]["layout"][1]["name"] == "Kuchnia"


def test_publishing_for_everyone_keeps_the_note_in_the_history(desktop):  # noqa: F811
    open_editor(desktop, users=USERS)
    rename_kitchen(desktop)
    open_dialog(desktop)
    desktop.locator(f"{APP} {DIALOG} [data-note]").fill("Jadalnia doszła")
    desktop.locator(f"{APP} {DIALOG} [data-publish-all]").click()
    desktop.wait_for_selector(f"{APP} [data-notice='ok']")
    state = server(desktop)
    assert state["live"]["strategy"]["layout"][1]["name"] == "Kuchnia i jadalnia"
    assert state["history"][0]["note"] == "Jadalnia doszła"
    assert desktop.locator(f"{APP} {DIALOG}").count() == 0
    assert desktop.locator(f"{APP} [data-undo]").is_disabled()


def test_a_missing_entity_is_said_before_publishing(desktop):  # noqa: F811
    open_editor(desktop, users=USERS)
    rename_kitchen(desktop)
    open_dialog(desktop)
    assert "switch.missing" in desktop.locator(f"{APP} {DIALOG} [data-missing]").inner_text()


def test_a_draft_that_came_back_to_the_published_one_has_nothing_to_publish(desktop):  # noqa: F811
    open_editor(desktop, users=USERS)
    rename_kitchen(desktop)
    rename_kitchen(desktop, "Kuchnia")
    open_dialog(desktop)
    assert desktop.locator(f"{APP} {DIALOG} [data-no-changes]").count() == 1
    assert desktop.locator(f"{APP} {DIALOG} [data-publish-all]").is_disabled()


def test_a_change_made_elsewhere_stops_the_dialog_and_can_be_overruled(desktop):  # noqa: F811
    open_editor(desktop, users=USERS)
    rename_kitchen(desktop)
    desktop.evaluate("() => { window.editor.server.state.live.strategy.layout[0].name = 'Z telefonu'; }")
    open_dialog(desktop)
    desktop.locator(f"{APP} {DIALOG} [data-publish-all]").click()
    desktop.wait_for_selector(f"{APP} [data-notice='conflict']")
    assert desktop.locator(f"{APP} {DIALOG}").count() == 0
    desktop.locator(f"{APP} [data-publish-force]").click()
    desktop.wait_for_selector(f"{APP} [data-notice='ok']")


# Checking by one person -----------------------------------------------------------------------------------------


def test_a_version_goes_to_one_person_to_check_and_the_check_ends(desktop):  # noqa: F811
    open_editor(desktop, users=USERS)
    rename_kitchen(desktop)
    open_dialog(desktop)
    assert desktop.locator(f"{APP} {DIALOG} [data-publish-review]").is_disabled()
    desktop.locator(f"{APP} {DIALOG} [data-reviewer]").select_option("kid")
    desktop.locator(f"{APP} {DIALOG} [data-publish-review]").click()
    desktop.wait_for_selector(f"{APP} [data-review-state]")
    state = server(desktop)
    assert state["review"]["user_id"] == "kid"
    assert state["review"]["config"]["strategy"]["layout"][1]["name"] == "Kuchnia i jadalnia"
    assert state["live"]["strategy"]["layout"][1]["name"] == "Kuchnia"
    assert "Kuba" in desktop.locator(f"{APP} [data-review-state]").inner_text()
    assert "sel" in desktop.locator(f"{APP} [data-node='layout/1']").get_attribute("class")
    desktop.locator(f"{APP} [data-end-review]").click()
    desktop.wait_for_selector(f"{APP} [data-review-state]", state="detached")
    assert server(desktop)["review"] is None


# The history ----------------------------------------------------------------------------------------------------


def test_the_history_shows_a_version_and_takes_it_back_as_a_draft(desktop):  # noqa: F811
    open_editor(desktop, users=USERS)
    rename_kitchen(desktop)
    open_dialog(desktop)
    desktop.locator(f"{APP} {DIALOG} [data-note]").fill("Pierwsza")
    desktop.locator(f"{APP} {DIALOG} [data-publish-all]").click()
    desktop.wait_for_selector(f"{APP} [data-notice='ok']")
    desktop.locator(f"{APP} [data-history]").click()
    version = desktop.locator(f"{APP} {HISTORY} [data-version]")
    assert version.count() == 1 and "Pierwsza" in version.inner_text() and "Admin" in version.inner_text()
    version.click()
    diff = desktop.locator(f"{APP} {HISTORY} [data-diff]").inner_text()
    assert "+     name: Kuchnia" in diff
    desktop.locator(f"{APP} {HISTORY} [data-restore]").click()
    desktop.wait_for_selector(f"{APP} [data-notice='ok']")
    assert desktop.locator(f"{APP} [data-node='layout/1'] .label").inner_text() == "Kuchnia"
    state = server(desktop)
    assert state["draft"]["config"]["strategy"]["layout"][1]["name"] == "Kuchnia"
    assert state["live"]["strategy"]["layout"][1]["name"] == "Kuchnia i jadalnia"
    desktop.locator(f"{APP} [data-undo]").click()
    assert desktop.locator(f"{APP} [data-node='layout/1'] .label").inner_text() == "Kuchnia i jadalnia"


def test_an_empty_history_says_so(desktop):  # noqa: F811
    open_editor(desktop, users=USERS)
    desktop.locator(f"{APP} [data-history]").click()
    assert desktop.locator(f"{APP} {HISTORY} [data-no-history]").count() == 1


# The words and lines of a change --------------------------------------------------------------------------------


def changes_of(page, before, after):
    return page.evaluate(
        """async ([before, after]) => (await import('/custom_components/home_dashboard/www/editor/changes.js'))
            .describeChanges(before, after, null, 'pl').map((change) => [change.kind, change.text])""",
        [before, after],
    )


ROOM = {
    "id": "k",
    "name": "Kuchnia",
    "sections": [
        {"title": "Kawa", "tiles": [{"entity": "light.a"}, {"entity": "light.b"}]},
        {"title": "Inne", "tiles": []},
    ],
}


def test_rooms_added_removed_and_in_another_order(desktop):  # noqa: F811
    two = {"layout": [ROOM, {"id": "s", "name": "Salon"}]}
    assert changes_of(desktop, {"layout": [ROOM]}, two) == [["added", "Nowy pokój „Salon”"]]
    assert changes_of(desktop, two, {"layout": [ROOM]}) == [["removed", "Usunięty pokój „Salon”"]]
    swapped = {"layout": [two["layout"][1], ROOM]}
    assert changes_of(desktop, two, swapped) == [["moved", "Kolejność pokoi"]]


def test_tiles_added_removed_moved_and_changed_in_a_room(desktop):  # noqa: F811
    after = {
        **ROOM,
        "sections": [
            {"title": "Kawa", "tiles": [{"entity": "light.a", "name": "Blat"}, {"entity": "light.c"}]},
            {"title": "Inne", "tiles": [{"entity": "light.b"}]},
        ],
    }
    found = changes_of(desktop, {"layout": [ROOM]}, {"layout": [after]})
    assert ["added", "Kuchnia \u203a Kawa: dodany light.c"] in found
    assert ["moved", "Kuchnia: light.b przeniesiony z Kawa do Inne"] in found
    assert ["changed", "Kuchnia: zmieniony Blat"] in found


def test_sections_favourites_blocks_and_settings(desktop):  # noqa: F811
    before = {
        "layout": [ROOM],
        "favorites": ["light.a"],
        "shortcuts": [{"kind": "panel", "name": "Ekspres"}],
        "appearance": {},
    }
    after = {
        "layout": [{**ROOM, "sections": [*ROOM["sections"], {"title": "Nowa", "tiles": []}]}],
        "favorites": ["light.b"],
        "shortcuts": [{"kind": "panel", "name": "Ekspres", "icon": "mdi:coffee"}],
        "appearance": {"tiles": {}},
    }
    found = changes_of(desktop, before, after)
    assert found == [
        ["added", "Kuchnia: nowa sekcja „Nowa”"],
        ["added", "Ulubione: dodany light.b"],
        ["removed", "Ulubione: usunięty light.a"],
        ["changed", "Zmieniony blok „Ekspres”"],
        ["changed", "Zmienione ustawienie „appearance”"],
    ]


def test_nothing_changed_says_nothing(desktop):  # noqa: F811
    assert changes_of(desktop, {"layout": [ROOM]}, {"layout": [ROOM]}) == []


def test_lines_of_a_diff_and_its_hunks(desktop):  # noqa: F811
    result = desktop.evaluate("""async () => { const c = await import('/custom_components/home_dashboard/www/editor/changes.js');
        const lines = c.diffLines('a\\nb\\nc\\nd', 'a\\nB\\nc\\nd\\ne');
        const long = Array.from({ length: 20 }, (_, n) => `l${n}`);
        const hunks = c.diffHunks(c.diffLines(long.join('\\n'), [...long.slice(0, 10), 'x', ...long.slice(11)].join('\\n')), 2);
        return [lines.map((l) => l.kind[0] + l.text), hunks.map((h) => h.kind === 'skip' ? `…${h.count}` : h.kind[0] + h.text),
            c.diffLines('', 'x').map((l) => l.kind), c.diffLines('a\\nb', 'c\\nd', 1).map((l) => l.kind)]; }""")
    assert result[0] == ["sa", "rb", "aB", "sc", "sd", "ae"]
    assert result[1] == ["…8", "sl8", "sl9", "rl10", "ax", "sl11", "sl12", "…7"]
    assert result[2] == ["added"]
    assert result[3] == ["removed", "removed", "added", "added"]


def test_missing_entities_anywhere(desktop):  # noqa: F811
    open_editor(desktop)
    missing = desktop.evaluate("""async () => (await import('/custom_components/home_dashboard/www/editor/changes.js')).missingEntities({
        favorites: ['light.entity_0096', 'light.gone'], layout: [{ sections: [{ tiles: [{ entity: 'switch.none' }] }] }],
        shortcuts: [{ kind: 'panel', groups: [{ rows: [{ entity: 'sensor.none' }] }] }] }, window.editor.app.hass)""")
    assert missing == ["light.gone", "sensor.none", "switch.none"]


# On the side of the person checking -----------------------------------------------------------------------------


REVIEWED = """async ({ review, skip }) => {
    const main = await import('/custom_components/home_dashboard/www/app/main.js');
    if (skip) sessionStorage.setItem(main.SKIP_REVIEW_KEY, skip); else sessionStorage.removeItem(main.SKIP_REVIEW_KEY);
    const hass = window.dashboard.hass({ callWS: async (message) => {
        if (message.type === 'home_dashboard/review/get') { if (review === 'fail') throw new Error('unknown command'); return review; }
        return null; } });
    const made = await main.generateForPerson({ type: 'custom:home-dashboard', layout: [{ id: 'live' }] }, hass);
    return made.views[0].cards[0].dashboard;
}"""


@pytest.mark.parametrize(
    ("review", "skip", "expected_room", "marked"),
    [
        (
            {"config": {"strategy": {"layout": [{"id": "checked"}]}}, "published_at": "2026-11-13T10:00:00Z"},
            None,
            "checked",
            True,
        ),
        (None, None, "live", False),
        (
            {"config": {"strategy": {"layout": [{"id": "checked"}]}}, "published_at": "2026-11-13T10:00:00Z"},
            "2026-11-13T10:00:00Z",
            "live",
            False,
        ),
        (
            {"config": {"strategy": {"layout": [{"id": "checked"}]}}, "published_at": "2026-11-13T11:00:00Z"},
            "2026-11-13T10:00:00Z",
            "checked",
            True,
        ),
        ("fail", None, "live", False),
    ],
)
def test_the_person_checking_gets_the_version_to_check(phone, review, skip, expected_room, marked):
    dashboard = phone.evaluate(REVIEWED, {"review": review, "skip": skip})
    assert dashboard["layout"][0]["id"] == expected_room
    assert ("_review" in dashboard) is marked


def test_the_banner_of_a_version_to_check_and_no_saving_from_the_app(phone):
    from .test_page import mount

    mount(phone, {"_review": {"published_at": "2026-11-13T10:00:00Z"}, "layout": []})
    banner = phone.locator("home-dashboard-chrome [data-review-banner]")
    assert "Wersja do sprawdzenia" in banner.inner_text()
    phone.on("dialog", lambda dialog: (_ for _ in ()).throw(AssertionError("a browser dialog")))
    phone.evaluate("() => { window.hass.calls.length = 0; }")
    # Not awaited: the save waits until the message is closed.
    phone.evaluate(
        "() => { document.querySelector('home-dashboard-chrome')._saveSettings({ detail: { dashboard: {} } }); }"
    )
    message = "home-dashboard-chrome home-dashboard-message"
    phone.wait_for_selector(f"{message} [data-message]")
    assert phone.locator(f"{message} [role='alertdialog'][aria-modal='true']").count() == 1
    assert "wersja do sprawdzenia" in phone.locator(f"{message} [data-message-text]").inner_text()
    assert phone.locator(f"{message} [data-message-ok]").inner_text() == "Zamknij"
    # Esc closes it, and only it.
    phone.keyboard.press("Escape")
    phone.wait_for_selector(message, state="detached")
    assert (
        phone.evaluate("window.hass.calls.filter((call) => call.message?.type === 'lovelace/config/save')")
        == []
    )
    with phone.expect_navigation():
        phone.locator("home-dashboard-chrome [data-review-leave]").click()
    assert phone.evaluate("sessionStorage.getItem('home-dashboard-skip-review')") == "2026-11-13T10:00:00Z"
