"""What each person arranges for themselves: scenes, favorites, the menu, rooms and the start."""

from __future__ import annotations

from .test_panels import add_entity
from .test_shortcuts import SHEET, mount_admin

SCENES = [{"entity": "scene.a", "name": "Rano"}, {"entity": "scene.b", "name": "Wieczór"}, {"entity": "scene.c", "name": "Noc"}]
ROOM = {
    "id": "r",
    "name": "Pokój",
    "areas": [],
    "home": [{"entity": "light.one", "name": "Jeden"}],
    "sections": [
        {"title": "Światła", "tiles": [{"entity": "light.one", "name": "Jeden"}, {"entity": "light.two", "name": "Dwa"}]},
        {"title": "Automatyzacje", "tiles": [{"entity": "switch.auto", "name": "Auto"}]},
    ],
}


def add_things(page) -> None:
    for entity_id, name in (("scene.a", "Rano"), ("scene.b", "Wieczór"), ("scene.c", "Noc"), ("light.one", "Jeden"),
                            ("light.two", "Dwa"), ("switch.auto", "Auto")):
        add_entity(page, entity_id, "off", {"friendly_name": name})


def with_prefs(page, prefs: dict) -> None:
    page.evaluate(
        """(prefs) => {
            const original = window.dashboard.hass;
            window.dashboard.hass = (overrides) => {
                const instance = original(overrides);
                const answer = instance.callWS;
                instance.callWS = (message) => message.type === "frontend/get_user_data"
                    ? Promise.resolve({ value: prefs }) : answer(message);
                return instance;
            };
        }""",
        prefs,
    )


def model(page, raw: dict, prefs: dict, user: str = "kid") -> dict:
    return page.evaluate(
        """({ raw, prefs, user }) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            const config = model.personalize(model.normalizeConfig(raw), user, prefs);
            const home = model.buildHomeModel(instance, config, model.selectEntities(instance, config));
            const room = model.buildRoomModel(instance, config, model.selectEntities(instance, config), "r");
            return {
                scenes: home.scenes.map((tile) => tile.name),
                favorites: home.favorites.map((tile) => tile.entityId),
                sections: room.sections.map((section) => [section.title, section.tiles.map((tile) => tile.name)]),
                home: (home.rooms.find((item) => item.id === "r")?.tiles ?? []).map((tile) => tile.name),
            };
        }""",
        {"raw": raw, "prefs": prefs, "user": user},
    )


def open_personal(page, tab: str, dashboard: dict | None = None) -> None:
    mount_admin(page, dashboard or {"scenes": SCENES})
    page.locator("home-dashboard-page [data-rooms]").click()
    page.locator(f"{SHEET} [data-sheet-personal]").click()
    page.locator(f"{SHEET} [data-tab='{tab}']").click()


def saved_prefs(page) -> dict:
    return page.evaluate("window.saved.filter((m) => m.type === 'frontend/set_user_data').at(-1).value")


# Scenes ------------------------------------------------------------------------------------------

def test_scenes_follow_the_personal_order_and_leave_out_what_was_hidden(phone):
    add_things(phone)
    result = model(phone, {"scenes": SCENES}, {"scenes": ["scene.c", "scene.a"], "hidden_scenes": ["scene.b"]})
    assert result["scenes"] == ["Noc", "Rano"]


def test_my_layout_moves_and_hides_a_scene(phone):
    add_things(phone)
    open_personal(phone, "scenes")
    phone.locator(f"{SHEET} [data-order='scene.b'] [data-personal='up']").click()
    assert saved_prefs(phone)["scenes"][:2] == ["scene.b", "scene.a"]
    phone.locator(f"{SHEET} [data-order='scene.c'] [data-personal='hide']").click()
    assert saved_prefs(phone)["hidden_scenes"] == ["scene.c"]


def test_the_scenes_editor_still_shows_every_scene_to_an_administrator(phone):
    add_things(phone)
    with_prefs(phone, {"hidden_scenes": ["scene.b"]})
    phone.evaluate("window.history.replaceState(null, '', '?room=__scenes')")
    mount_admin(phone, {"scenes": SCENES}, "room")
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.locator(f"{SHEET} [data-sheet-edit]").click()
    phone.wait_for_selector("[data-edit-save]")
    assert phone.locator("[data-edit-tile]").count() == 3


# Favorites ---------------------------------------------------------------------------------------

def test_own_favorites_replace_the_shared_ones(phone):
    add_things(phone)
    raw = {"favorites": ["light.one"]}
    assert model(phone, raw, {})["favorites"] == ["light.one"]
    assert model(phone, raw, {"favorites": ["light.two", "switch.auto"]})["favorites"] == ["light.two", "switch.auto"]


def test_a_favorite_is_added_by_search_and_starts_from_the_shared_ones(phone):
    add_things(phone)
    open_personal(phone, "favorites", {"favorites": ["light.one"]})
    phone.locator(f"{SHEET} [data-favorite-search]").fill("Dwa")
    phone.locator(f"{SHEET} [data-favorite-match='light.two']").click()
    assert saved_prefs(phone)["favorites"] == ["light.one", "light.two"]


def test_a_favorite_is_removed_and_moved(phone):
    add_things(phone)
    open_personal(phone, "favorites", {"favorites": ["light.one", "light.two"]})
    phone.locator(f"{SHEET} [data-order='light.two'] [data-personal='up']").click()
    assert saved_prefs(phone)["favorites"] == ["light.two", "light.one"]
    phone.locator(f"{SHEET} [data-order='light.one'] [data-personal='remove']").click()
    assert saved_prefs(phone)["favorites"] == ["light.two"]


def shared_save(page) -> dict:
    page.evaluate("document.querySelector('home-dashboard-chrome')._reload = () => {}")
    page.locator(f"{SHEET} [data-layout-save]").click()
    page.wait_for_function("window.saved.some((m) => m.type === 'lovelace/config/save')")
    return page.evaluate("window.saved.filter((m) => m.type === 'lovelace/config/save').at(-1).config.strategy")


def test_an_administrator_arranges_rooms_for_everyone(phone):
    add_things(phone)
    open_personal(phone, "rooms", {"layout": [ROOM, {**ROOM, "id": "s", "name": "Drugi"}], "rooms": {"hidden": ["s"]}})
    phone.locator(f"{SHEET} [data-layout-everyone] input").check()
    assert phone.locator(f"{SHEET} [data-order='s'].muted").count() == 1
    phone.locator(f"{SHEET} [data-order='s'] [data-personal='up']").click()
    phone.locator(f"{SHEET} [data-order='s'] [data-personal='hide']").click()
    phone.locator(f"{SHEET} [data-order='r'] [data-personal='hide']").click()
    assert phone.locator(f"{SHEET} [data-personal-reset]").count() == 0
    strategy = shared_save(phone)
    assert strategy["rooms"]["order"][:2] == ["s", "r"]
    assert strategy["rooms"]["hidden"] == ["r"]
    assert not phone.evaluate("window.saved.some((m) => m.type === 'frontend/set_user_data')")


def test_an_administrator_chooses_favorites_for_everyone(phone):
    add_things(phone)
    open_personal(phone, "favorites", {"favorites": ["light.one"]})
    phone.locator(f"{SHEET} [data-layout-everyone] input").check()
    phone.locator(f"{SHEET} [data-favorite-search]").fill("Dwa")
    phone.locator(f"{SHEET} [data-favorite-match='light.two']").click()
    phone.locator(f"{SHEET} [data-order='light.two'] [data-personal='up']").click()
    assert shared_save(phone)["favorites"] == ["light.two", "light.one"]


def test_only_an_administrator_arranges_for_everyone(phone):
    add_things(phone)
    open_personal(phone, "rooms")
    assert phone.locator(f"{SHEET} [data-layout-everyone]").count() == 1
    phone.locator(f"{SHEET} [data-tab='menu']").click()
    assert phone.locator(f"{SHEET} [data-layout-everyone]").count() == 0


def test_a_person_only_arranges_for_themselves(phone):
    add_things(phone)
    mount_admin(phone, {"scenes": SCENES}, admin=False)
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.locator(f"{SHEET} [data-sheet-personal]").click()
    phone.locator(f"{SHEET} [data-tab='rooms']").click()
    assert phone.locator(f"{SHEET} [data-layout-everyone]").count() == 0


def test_a_denied_device_cannot_become_a_favorite(phone):
    add_things(phone)
    result = phone.evaluate("""() => {
        const { model, hass } = window.dashboard;
        const raw = { access: { kid: { hide: ["light.two"] } } };
        return [model.favoriteCandidates(hass(), raw, "kid", [], "Dwa").length, model.favoriteCandidates(hass(), raw, "mum", [], "Dwa").length];
    }""")
    assert result == [0, 1]


# Menu --------------------------------------------------------------------------------------------

def test_an_entry_of_the_menu_can_be_hidden_for_oneself(phone):
    menu = {"menu": {"groups": [{"items": [{"name": "A", "path": "/a"}, {"name": "B", "path": "/b"}]}]}}
    open_personal(phone, "menu", menu)
    assert phone.locator(f"{SHEET} [data-order] [data-personal='up']").count() == 0
    phone.locator(f"{SHEET} [data-order='path:/a'] [data-personal='hide']").click()
    assert saved_prefs(phone)["hidden_menu"] == ["path:/a"]
    phone.locator(f"{SHEET} header button").first.click()
    phone.wait_for_timeout(300)
    phone.locator("home-dashboard-page [data-menu]").first.click()
    phone.wait_for_selector("[data-drawer]")
    assert phone.locator("[data-link='/a']").count() == 0
    assert phone.locator("[data-link='/b']").count() == 1


# My view of a room --------------------------------------------------------------------------------

def test_a_hidden_section_and_tile_leave_the_room_and_home(phone):
    add_things(phone)
    prefs = {"hidden_sections": {"r": ["title:Automatyzacje"]}, "hidden_tiles": {"r": ["light.one"]}}
    result = model(phone, {"layout": [ROOM]}, prefs)
    assert result["sections"] == [["Światła", ["Dwa"]]]
    assert result["home"] == []


def test_an_administrator_takes_a_section_away_from_one_person(phone):
    add_things(phone)
    raw = {"layout": [ROOM], "access": {"kid": {"sections": ["r|title:Automatyzacje"]}}}
    assert [title for title, _ in model(phone, raw, {})["sections"]] == ["Światła"]
    assert [title for title, _ in model(phone, raw, {}, user="mum")["sections"]] == ["Światła", "Automatyzacje"]


def open_room_view(page) -> None:
    add_things(page)
    page.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(page, {"layout": [ROOM]}, "room")
    page.locator("home-dashboard-page [data-rooms]").click()
    page.locator(f"{SHEET} [data-sheet-room-view]").click()
    page.wait_for_selector(f"{SHEET} section.panel[data-kind='room-view']")


def test_my_view_hides_a_section_of_the_room(phone):
    open_room_view(phone)
    phone.locator(f"{SHEET} [data-view-section='title:Automatyzacje'] [data-view='section']").click()
    assert saved_prefs(phone)["hidden_sections"] == {"r": ["title:Automatyzacje"]}
    assert phone.locator(f"{SHEET} [data-view-tile='switch.auto']").count() == 0


def test_my_view_hides_a_tile_and_brings_everything_back(phone):
    open_room_view(phone)
    phone.locator(f"{SHEET} [data-view-tile='light.two'] [data-view='tile']").click()
    assert saved_prefs(phone)["hidden_tiles"] == {"r": ["light.two"]}
    assert "muted" in phone.locator(f"{SHEET} [data-view-tile='light.two']").get_attribute("class")
    phone.locator(f"{SHEET} [data-view-restore]").click()
    assert saved_prefs(phone)["hidden_tiles"] == {}


def test_my_view_is_only_in_a_room(phone):
    mount_admin(phone, {})
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} [data-sheet-personal]")
    assert phone.locator(f"{SHEET} [data-sheet-room-view]").count() == 0


def test_the_access_of_a_person_lists_the_sections(phone):
    add_things(phone)
    result = phone.evaluate("""(room) => {
        const { model, hass } = window.dashboard;
        return model.accessChoices(hass(), { layout: [room] }).sections.map((item) => item.id);
    }""", ROOM)
    assert result == ["r|title:Światła", "r|title:Automatyzacje"]


# Start ---------------------------------------------------------------------------------------------

def test_the_start_is_kept_with_the_account(phone):
    open_personal(phone, "scenes")
    phone.locator(f"{SHEET} [data-start-mine] input").check()
    assert saved_prefs(phone)["start"].endswith("/home")
    assert phone.evaluate("localStorage.getItem('home_dashboard_start')").endswith("/home")
    phone.locator(f"{SHEET} [data-start-mine] input").uncheck()
    assert saved_prefs(phone)["start"] is False
    assert phone.evaluate("localStorage.getItem('home_dashboard_start')") is None


def account_start(page, value, pathname: str = "/", started: bool = False) -> dict:
    return page.evaluate(
        """async ({ value, pathname, started }) => {
            const { accountStart } = await import("/custom_components/home_dashboard/www/loader.js");
            const store = (values) => ({
                getItem: (key) => values[key] ?? null,
                setItem: (key, item) => { values[key] = item; },
                removeItem: (key) => { delete values[key]; },
            });
            const local = { home_dashboard_start: "/old/home" };
            const session = started ? { home_dashboard_started: "1" } : {};
            const target = accountStart(value, { pathname, search: "" }, store(local), store(session));
            return { target, local };
        }""",
        {"value": value, "pathname": pathname, "started": started},
    )


def test_a_new_device_follows_the_start_of_the_account(phone):
    result = account_start(phone, "/home-dashboard/home")
    assert result["target"] == "/home-dashboard/home"
    assert result["local"] == {"home_dashboard_start": "/home-dashboard/home"}


def test_the_account_start_waits_for_the_next_launch_when_already_started(phone):
    result = account_start(phone, "/home-dashboard/home", started=True)
    assert result["target"] is None
    assert result["local"]["home_dashboard_start"] == "/home-dashboard/home"


def test_switching_the_start_off_reaches_every_device(phone):
    result = account_start(phone, False)
    assert result["target"] is None
    assert result["local"] == {}


def test_without_an_account_choice_the_device_keeps_its_own(phone):
    assert account_start(phone, None)["local"] == {"home_dashboard_start": "/old/home"}


def test_a_link_to_another_page_is_not_taken_over(phone):
    assert account_start(phone, "/home-dashboard/home", pathname="/config")["target"] is None
