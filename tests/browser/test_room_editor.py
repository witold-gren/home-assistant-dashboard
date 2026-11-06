"""Editing a room by touch: nothing is saved before the user says so."""

from __future__ import annotations

import pytest

from .test_page import mount

CHROME = "document.querySelector('home-dashboard-chrome')"

MOUNT_ADMIN = """async ({ dashboard, room }) => {
    window.saved = [];
    window.history.replaceState(null, "", `?room=${room}`);
    const hass = window.dashboard.hass({
        user: { name: "Admin", is_admin: true },
        callWS: async (message) => {
            if (message.type === "lovelace/config") {
                return { strategy: { type: "custom:home-dashboard", ...dashboard }, title: "x" };
            }
            if (!["frontend/get_user_data", "config/auth/list"].includes(message.type)) window.saved.push(message);
            return null;
        },
    });
    window.hass = hass;
    window.card = await window.dashboard.mount(hass, dashboard, "room");
    document.querySelector("home-dashboard-chrome")._reload = () => {};
}"""


def ids(page, prefix: str, count: int) -> list[str]:
    return page.evaluate(
        """({ prefix, count }) => Object.keys(window.dashboard.snapshot.states)
            .filter((id) => id.startsWith(prefix)).slice(0, count)""",
        {"prefix": prefix, "count": count},
    )


def layout_with(page) -> dict:
    a, b, c = ids(page, "light.", 3)
    return {
        "layout": [
            {
                "id": "r",
                "name": "Pokój",
                "areas": [],
                "home": [{"entity": a, "name": "A"}],
                "sections": [
                    {"title": "Jeden", "tiles": [{"entity": a, "name": "A"}, {"entity": b, "name": "B"}]},
                    {"title": "Dwa", "tiles": [{"entity": c, "name": "C"}]},
                ],
            },
            {"id": "other", "name": "Inny", "areas": [], "home": [], "sections": []},
        ]
    }


def open_editor(page, dashboard: dict | None = None, room: str = "r") -> None:
    page.evaluate(MOUNT_ADMIN, {"dashboard": dashboard or layout_with(page), "room": room})
    page.locator("home-dashboard-page [data-rooms]").click()
    page.locator("[data-sheet-edit]").click()
    page.wait_for_selector("[data-edit-save]")


def names(page, list_index: int = 0) -> list[str]:
    return page.locator(f"[data-edit-list='{list_index}'] [data-edit-tile] strong").all_inner_texts()


def saved_room(page, room_id: str = "r") -> dict:
    page.locator("[data-edit-save]").click()
    page.wait_for_function("window.saved.length === 1")
    layout = page.evaluate("window.saved[0].config.strategy.layout")
    return next(room for room in layout if room["id"] == room_id)


def drag(page, name: str, target: str) -> None:
    grip = page.locator(f"[data-edit-tile='{name}'] [data-grip]").bounding_box()
    box = page.locator(target).bounding_box()
    page.mouse.move(grip["x"] + 10, grip["y"] + 10)
    page.mouse.down()
    page.mouse.move(box["x"] + 20, box["y"] + 20, steps=4)
    page.mouse.up()


def test_only_an_administrator_sees_the_pencil(phone):
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount(phone, layout_with(phone), "room")
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector("home-dashboard-sheet .panel")
    assert phone.locator("[data-sheet-edit]").count() == 0


def test_editing_shows_the_tiles_and_sends_nothing(phone):
    open_editor(phone)
    assert names(phone) == ["A", "B"]
    assert names(phone, 1) == ["C"]
    assert phone.evaluate("window.saved") == []


def test_a_tile_can_be_dragged_before_another(phone):
    open_editor(phone)
    drag(phone, "B", "[data-edit-tile='A']")
    assert names(phone) == ["B", "A"]


def test_a_tile_can_be_dragged_to_another_section(phone):
    open_editor(phone)
    drag(phone, "A", "[data-edit-tile='C']")
    assert names(phone) == ["B"]
    assert names(phone, 1) == ["A", "C"]


def test_a_tile_can_be_dragged_to_the_end_of_a_section(phone):
    open_editor(phone)
    drag(phone, "A", "[data-edit-list='1'] [data-add-tile]")
    assert names(phone, 1) == ["C", "A"]


def test_dropping_outside_the_tiles_changes_nothing(phone):
    open_editor(phone)
    grip = phone.locator("[data-edit-tile='A'] [data-grip]").bounding_box()
    phone.mouse.move(grip["x"] + 10, grip["y"] + 10)
    phone.mouse.down()
    phone.mouse.up()
    assert names(phone) == ["A", "B"]


def test_a_move_is_saved_with_the_rest_of_the_room(phone):
    open_editor(phone)
    drag(phone, "B", "[data-edit-tile='A']")
    room = saved_room(phone)
    assert [tile["name"] for tile in room["sections"][0]["tiles"]] == ["B", "A"]


def test_the_strategy_keeps_its_type_and_other_rooms(phone):
    open_editor(phone)
    saved_room(phone)
    strategy = phone.evaluate("window.saved[0].config.strategy")
    assert strategy["type"] == "custom:home-dashboard"
    assert [room["id"] for room in strategy["layout"]] == ["r", "other"]


def test_cancel_leaves_the_configuration_alone(phone):
    open_editor(phone)
    drag(phone, "B", "[data-edit-tile='A']")
    phone.locator("[data-edit-cancel]").click()
    assert phone.locator("[data-edit-save]").count() == 0
    assert phone.evaluate("window.saved") == []
    assert phone.locator("home-dashboard-page .tile strong").first.inner_text() == "A"


def test_a_tile_can_be_renamed_and_the_name_cleared(phone):
    open_editor(phone)
    phone.locator("[data-edit-tile='A']").click()
    phone.locator("[data-tile-name]").fill("Nowa")
    phone.locator("[data-tile-save]").click()
    assert names(phone)[0] == "Nowa"
    phone.locator("[data-edit-tile='Nowa']").click()
    phone.locator("[data-tile-name]").fill("  ")
    phone.locator("[data-tile-save]").click()
    assert "name" not in saved_room(phone)["sections"][0]["tiles"][0]


def test_a_tile_can_be_removed(phone):
    open_editor(phone)
    phone.locator("[data-edit-tile='A']").click()
    phone.locator("[data-tile-remove]").click()
    assert names(phone) == ["B"]


def test_a_tile_can_be_added_by_search(phone):
    open_editor(phone)
    (switch,) = ids(phone, "switch.", 1)
    phone.locator("[data-edit-list='1'] [data-add-tile]").click()
    phone.locator("[data-pick-search]").fill(switch)
    phone.locator(f"[data-pick='{switch}']").click()
    assert saved_room(phone)["sections"][1]["tiles"][-1] == {"entity": switch}


def test_the_picker_leaves_out_what_is_already_there(phone):
    open_editor(phone)
    a = phone.evaluate("window.card._edit.room.sections[0].tiles[0].entity")
    phone.locator("[data-edit-list='0'] [data-add-tile]").click()
    phone.locator("[data-pick-search]").fill(a)
    assert phone.locator(f"[data-pick='{a}']").count() == 0


def test_the_picker_starts_with_what_belongs_to_the_room(phone):
    candidates = phone.evaluate("""async () => {
        const { tileCandidates } = await import("/custom_components/home_dashboard/www/app/room-editor.js");
        const { model, hass } = window.dashboard;
        const instance = hass();
        const config = model.normalizeConfig({});
        const id = Object.keys(instance.entities).find((key) => key.startsWith("light.")
            && instance.states[key] && model.isPrimary(instance.entities[key])
            && model.effectiveArea(instance, key, config));
        const area = model.effectiveArea(instance, id, config);
        const room = { areas: [area], home: [], sections: [] };
        return tileCandidates(instance, config, room, "room", "")
            .map((tile) => model.effectiveArea(instance, tile.entityId, config) === area);
    }""")
    assert candidates
    assert all(candidates)


def test_the_picker_offers_lights_before_automations(phone):
    domains = phone.evaluate("""async () => {
        const { tileCandidates } = await import("/custom_components/home_dashboard/www/app/room-editor.js");
        const { model, hass } = window.dashboard;
        const instance = hass();
        instance.states["automation.a"] = { entity_id: "automation.a", state: "on", attributes: {} };
        instance.states["light.z"] = { entity_id: "light.z", state: "on", attributes: {} };
        const room = { areas: [], home: [], sections: [] };
        return tileCandidates(instance, model.normalizeConfig({}), room, "room", ".")
            .map((tile) => tile.domain);
    }""")
    assert domains[0] == "light"


def test_a_long_name_stays_on_one_line_while_editing(phone):
    open_editor(phone)
    heights = phone.locator("[data-edit-tile] strong").evaluate_all(
        "(names) => names.map((name) => name.getClientRects().length)"
    )
    assert set(heights) == {1}


def test_sections_can_be_added_renamed_moved_and_removed(phone):
    open_editor(phone)
    phone.locator("[data-add-section]").click()
    field = phone.locator("[data-edit-list='2'] [data-section-name]")
    field.fill("Trzy")
    field.blur()
    phone.locator("[data-edit-list='2'] [data-section-up]").click()
    phone.locator("[data-edit-list='0'] [data-section-remove]").click()
    room = saved_room(phone)
    assert [section["title"] for section in room["sections"]] == ["Trzy", "Dwa"]


def test_the_home_tab_edits_the_tiles_on_home_only(phone):
    open_editor(phone)
    phone.locator("[data-edit-tab='home']").click()
    assert names(phone) == ["A"]
    assert phone.locator("[data-section-name]").count() == 0
    phone.locator("[data-edit-tile='A']").click()
    phone.locator("[data-tile-remove]").click()
    room = saved_room(phone)
    assert room["home"] == []
    assert len(room["sections"][0]["tiles"]) == 2


def test_a_room_from_the_areas_gets_its_own_entry(phone):
    area = phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const instance = hass();
        const config = model.normalizeConfig({});
        return model.buildHomeModel(instance, config, model.selectEntities(instance, config)).rooms[0].id;
    }""")
    open_editor(phone, {"rooms": {"hidden": []}}, area)
    room = saved_room(phone, area)
    assert room["id"] == area
    assert room["areas"] == [area]
    assert room["sections"]
    assert room["home"]


def test_a_tile_hidden_on_the_page_can_still_be_edited(phone):
    open_editor(
        phone,
        {"layout": [{"id": "r", "name": "R", "areas": [], "home": [], "sections": [
            {"title": "S", "tiles": [{"entity": "light.gone", "name": "Zniknął"}]}
        ]}]},
    )
    assert names(phone) == ["Zniknął"]


def test_a_block_can_be_moved_like_any_tile(phone):
    dashboard = layout_with(phone)
    block = {"kind": "panel", "name": "Blok", "frame": "about:blank"}
    dashboard["layout"][0]["sections"][0]["tiles"].append(block)
    open_editor(phone, dashboard)
    drag(phone, "Blok", "[data-edit-tile='A']")
    assert names(phone) == ["Blok", "A", "B"]


def test_a_tablet_left_alone_does_not_drop_an_edit(tablet):
    open_editor(tablet)
    tablet.evaluate(f"{CHROME}._returnHome()")
    tablet.wait_for_timeout(100)
    assert tablet.locator("[data-edit-save]").count() == 1


def test_switching_rooms_leaves_the_editor(phone):
    open_editor(phone)
    phone.evaluate("""() => {
        window.history.pushState(null, "", "?room=other");
        window.dispatchEvent(new CustomEvent("location-changed"));
    }""")
    phone.wait_for_selector("[data-edit-save]", state="detached")


def test_the_previous_version_can_be_loaded_in_the_yaml_editor(phone):
    open_editor(phone)
    saved_room(phone)
    assert "Jeden" in phone.evaluate("localStorage.getItem('home_dashboard_previous_config')")


@pytest.mark.parametrize("device", ["phone", "tablet"])
def test_the_page_does_not_scroll_sideways_while_editing(device, request):
    page = request.getfixturevalue(device)
    open_editor(page)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
