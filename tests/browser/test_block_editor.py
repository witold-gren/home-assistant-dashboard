"""The editor of blocks and shortcuts."""

from __future__ import annotations

from .test_panels import add_entity
from .test_shortcuts import SHEET, mount_admin

EDITOR = "home-dashboard-block-editor"
STATUS = {"kind": "overview", "name": "Status", "icon": "mdi:check", "extra_option": 7, "sections": [
    {"title": "Uwaga", "alert": True, "items": [
        {"name": "Zimno", "icon": "mdi:snowflake", "below": 19, "unit": "°", "entities": [{"entity": "climate.a", "name": "Salon"}]},
    ]},
]}
TRAMS = {"kind": "departures", "name": "Tramwaje", "icon": "mdi:tram", "entities": ["sensor.tram_4"]}
BOX = {"kind": "panel", "name": "Auto", "icon": "mdi:car", "stats": [{"name": "Paliwo", "entity": "sensor.fuel", "unit": "%"}],
       "groups": [{"rows": [{"entity": "lock.a", "labels": {"on": "Tak"}}]}], "card": {"type": "markdown", "content": "x"}}


def open_blocks(page, shortcuts: list, admin: bool = True) -> None:
    mount_admin(page, {"shortcuts": shortcuts, "access": {"kid": {"hide": ["block:Status"]}}}, admin=admin)
    page.locator("home-dashboard-page [data-rooms]").click()
    if admin:
        page.locator(f"{SHEET} [data-sheet-blocks]").click()
        page.wait_for_selector(f"{SHEET} section.panel[data-kind='blocks']")


def open_block(page, shortcuts: list, name: str) -> None:
    open_blocks(page, shortcuts)
    page.locator(f"{SHEET} [data-block='{name}'] [data-block-edit]").click()
    page.wait_for_selector(f"{EDITOR} [data-block-save]")


def field(page, key: str):
    return page.locator(f"{EDITOR} [data-block-field='{key}']").first


def fill(page, key: str, value: str) -> None:
    field(page, key).locator("input, textarea").first.fill(value)


def saved(page) -> dict:
    page.locator(f"{EDITOR} [data-block-save]").click()
    page.wait_for_function("window.saved.length > 0")
    return page.evaluate("window.saved.at(-1).config.strategy")


def test_only_an_administrator_has_blocks(phone):
    open_blocks(phone, [TRAMS], admin=False)
    phone.wait_for_selector(f"{SHEET} [data-sheet-personal]")
    assert phone.locator(f"{SHEET} [data-sheet-blocks]").count() == 0


def test_blocks_stay_out_of_the_menu_of_a_room(phone):
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": [{"id": "r", "name": "R", "areas": [], "home": [], "sections": []}]}, "room")
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} [data-sheet-access]")
    assert phone.locator(f"{SHEET} [data-sheet-blocks]").count() == 0


def test_a_changed_name_is_saved_and_the_rest_stays(phone):
    open_block(phone, [STATUS], "Status")
    fill(phone, "name", "Dom")
    strategy = saved(phone)
    block = strategy["shortcuts"][0]
    assert block["name"] == "Dom"
    assert block["extra_option"] == 7
    assert block["sections"] == STATUS["sections"]


def test_a_new_name_reaches_the_rules_of_access(phone):
    open_block(phone, [STATUS], "Status")
    fill(phone, "name", "Dom")
    assert saved(phone)["access"]["kid"]["hide"] == ["block:Dom"]


def test_a_block_cannot_be_saved_without_a_name(phone):
    open_block(phone, [TRAMS], "Tramwaje")
    fill(phone, "name", "")
    assert phone.locator(f"{EDITOR} [data-block-save]").is_disabled()


def test_departures_edit_their_entities(phone):
    add_entity(phone, "sensor.tram_11", "ok", {})
    open_block(phone, [TRAMS], "Tramwaje")
    phone.locator(f"{EDITOR} [data-block-add='entities']").click()
    phone.locator(f"{EDITOR} .entity input").nth(1).fill("sensor.tram_11")
    assert saved(phone)["shortcuts"][0]["entities"] == ["sensor.tram_4", "sensor.tram_11"]


def test_an_entity_can_be_removed(phone):
    open_block(phone, [TRAMS], "Tramwaje")
    phone.locator(f"{EDITOR} .entity [data-block-tool='remove']").click()
    assert saved(phone)["shortcuts"][0]["entities"] == []


def test_a_new_block_lands_at_the_end(phone):
    open_blocks(phone, [TRAMS])
    phone.locator(f"{SHEET} [data-block-new='departures']").click()
    phone.wait_for_selector(f"{EDITOR} [data-block-save]")
    fill(phone, "name", "Autobusy")
    shortcuts = saved(phone)["shortcuts"]
    assert [item["name"] for item in shortcuts] == ["Tramwaje", "Autobusy"]
    assert shortcuts[1]["kind"] == "departures"


def test_a_block_is_removed_only_after_a_second_tap(phone):
    open_block(phone, [TRAMS, STATUS], "Tramwaje")
    remove = phone.locator(f"{EDITOR} [data-block-remove]")
    remove.click()
    assert phone.evaluate("window.saved.length") == 0
    remove.click()
    phone.wait_for_function("window.saved.length > 0")
    assert [item["name"] for item in phone.evaluate("window.saved.at(-1).config.strategy.shortcuts")] == ["Status"]


def test_the_order_of_blocks_changes_with_the_arrows(phone):
    open_blocks(phone, [TRAMS, STATUS])
    phone.locator(f"{SHEET} [data-block='Status'] button").nth(1).click()
    phone.wait_for_function("window.saved.length > 0")
    assert [item["name"] for item in phone.evaluate("window.saved.at(-1).config.strategy.shortcuts")] == ["Status", "Tramwaje"]


def test_a_status_item_changes_its_kind_and_keeps_its_name(phone):
    open_block(phone, [STATUS], "Status")
    phone.locator(f"{EDITOR} summary").first.click()
    phone.locator(f"{EDITOR} [data-block-field='items'] summary").first.click()
    phone.locator(f"{EDITOR} [data-block-field='kind'] select").select_option("text")
    fill(phone, "text", "8.00, 10.00")
    item = saved(phone)["shortcuts"][0]["sections"][0]["items"][0]
    assert item == {"name": "Zimno", "icon": "mdi:snowflake", "text": "8.00, 10.00"}


def test_days_are_saved_as_numbers(phone):
    open_block(phone, [STATUS], "Status")
    phone.locator(f"{EDITOR} summary").first.click()
    phone.locator(f"{EDITOR} [data-block-field='items'] summary").first.click()
    fill(phone, "weekdays", "6, 7")
    assert saved(phone)["shortcuts"][0]["sections"][0]["items"][0]["weekdays"] == [6, 7]


def test_a_new_section_opens_and_stays_open_while_its_title_is_typed(phone):
    open_block(phone, [STATUS], "Status")
    phone.locator(f"{EDITOR} [data-block-add='sections']").click()
    entry = phone.locator(f"{EDITOR} [data-block-entry]").last
    entry.locator("[data-block-field='title'] input").fill("Dom")
    assert entry.get_attribute("open") is not None
    assert saved(phone)["shortcuts"][0]["sections"][1]["title"] == "Dom"


def test_a_card_is_edited_as_yaml(phone):
    open_block(phone, [BOX], "Auto")
    fill(phone, "card", "type: entities\nentities: [sun.sun]")
    assert saved(phone)["shortcuts"][0]["card"] == {"type": "entities", "entities": ["sun.sun"]}


def test_broken_yaml_blocks_the_save_until_it_is_fixed(phone):
    open_block(phone, [BOX], "Auto")
    fill(phone, "card", "type: [")
    assert phone.locator(f"{EDITOR} [data-block-save]").is_disabled()
    fill(phone, "card", "type: entities")
    assert phone.locator(f"{EDITOR} [data-block-save]").is_enabled()


def test_a_row_keeps_the_options_the_form_does_not_know(phone):
    open_block(phone, [BOX], "Auto")
    fill(phone, "name", "Samochód")
    assert saved(phone)["shortcuts"][0]["groups"][0]["rows"][0]["labels"] == {"on": "Tak"}


def test_empty_options_are_not_saved(phone):
    open_block(phone, [{**TRAMS, "tone": "green"}], "Tramwaje")
    field(phone, "tone").locator("select").select_option("")
    assert "tone" not in saved(phone)["shortcuts"][0]


def test_a_block_in_a_room_opens_from_its_tile_and_saves_with_the_room(phone):
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": [{"id": "r", "name": "R", "areas": [], "home": [], "sections": [{"tiles": [BOX]}]}]}, "room")
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.locator(f"{SHEET} [data-sheet-edit]").click()
    phone.wait_for_selector("[data-edit-save]")
    phone.locator("[data-edit-tile='Auto'] .text").click()
    phone.locator(f"{SHEET} [data-tile-block]").click()
    phone.wait_for_selector(f"{EDITOR} [data-block-save]")
    fill(phone, "name", "Samochód")
    phone.locator(f"{EDITOR} [data-block-save]").click()
    phone.wait_for_selector(f"{EDITOR}", state="detached")
    phone.locator("[data-edit-save]").click()
    phone.wait_for_function("window.saved.length > 0")
    tile = phone.evaluate("window.saved.at(-1).config.strategy.layout[0].sections[0].tiles[0]")
    assert tile["name"] == "Samochód"
    assert tile["card"] == BOX["card"]


def test_a_shortcut_shows_its_label_above_the_name(phone):
    mount_admin(phone, {"shortcuts": [{**TRAMS, "name": "Źródła", "label": "Media"}]})
    chip = phone.locator("home-dashboard-page [data-shortcut='Źródła']")
    assert chip.locator("small").inner_text() == "Media"
    assert chip.locator("strong").inner_text() == "Źródła"


def test_a_shortcut_without_a_label_has_one_line(phone):
    mount_admin(phone, {"shortcuts": [TRAMS]})
    assert phone.locator("home-dashboard-page [data-shortcut='Tramwaje'] small").count() == 0


def open_media(page, media: dict) -> None:
    mount_admin(page, {"media": media})
    page.locator("home-dashboard-page [data-rooms]").click()
    page.locator(f"{SHEET} [data-sheet-blocks]").click()
    page.locator(f"{SHEET} [data-block-media]").click()
    page.wait_for_selector(f"{EDITOR} [data-block-save]")


def saved_media(page) -> dict:
    page.locator(f"{EDITOR} [data-block-save]").click()
    page.wait_for_function("window.saved.length > 0")
    return page.evaluate("window.saved.at(-1).config.strategy.media")


def test_media_categories_are_edited_and_the_rest_of_media_stays(phone):
    tv = {"kind": "tv", "entity": "media_player.tv", "name": "TV", "shortcuts": [{"name": "HDMI"}]}
    open_media(phone, {"group_patterns": ["x"], "sections": [{"title": "Telewizory", "tiles": [tv]}]})
    phone.locator(f"{EDITOR} [data-block-add='sections']").click()
    section = phone.locator(f"{EDITOR} [data-block-field='sections'] > details").last
    section.locator("[data-block-field='title'] input").fill("Inne")
    section.locator("[data-block-add='tiles']").click()
    tile = section.locator("[data-block-entry]").last
    tile.locator("[data-block-field='entity'] input").fill("media_player.apple")
    tile.locator("[data-block-field='name'] input").fill("Apple TV")
    media = saved_media(phone)
    assert media["group_patterns"] == ["x"]
    assert media["sections"][0]["tiles"] == [tv]
    assert media["sections"][1] == {"title": "Inne", "tiles": [{"entity": "media_player.apple", "name": "Apple TV"}]}


def test_media_categories_save_without_a_name(phone):
    open_media(phone, {})
    assert phone.locator(f"{EDITOR} [data-block-save]").is_enabled()


def test_english_day_names_and_dates_find_the_weekend(phone):
    result = phone.evaluate("""async () => {
        const { shownDays } = await import("/custom_components/home_dashboard/www/app/school.js");
        const named = [{ name: "Saturday", lessons: [] }, { name: "Monday", lessons: [] }];
        const dated = [{ name: "Samedi", date: "2026-11-07", lessons: [] }, { name: "Lundi", date: "2026-11-09", lessons: [] }];
        return [shownDays(named).map((day) => day.name), shownDays(dated).map((day) => day.name)];
    }""")
    assert result == [["Monday"], ["Lundi"]]


def test_a_battery_item_is_set_up_as_a_warning_on_home_in_the_editor(phone):
    open_block(phone, [STATUS], "Status")
    phone.locator(f"{EDITOR} summary").first.click()
    phone.locator(f"{EDITOR} [data-block-field='items'] summary").first.click()
    phone.locator(f"{EDITOR} [data-block-field='kind'] select").select_option("battery")
    fill(phone, "below", "20")
    fill(phone, "platforms", "eufy_sdk, neolink")
    fill(phone, "device_has", "camera")
    field(phone, "notify").locator("input").check()
    item = saved(phone)["shortcuts"][0]["sections"][0]["items"][0]
    assert item["auto"] == "battery" and item["below"] == 20 and item["notify"] is True
    assert item["platforms"] == ["eufy_sdk", "neolink"] and item["device_has"] == "camera"
