"""The editor on a computer, stage U1: every kind of block has a form, the same fields as the block form of the tablet
(Status screens with their sections and entries, departures, news, a host's columns, the school year, apps, pages, a
TV and a scale). A block renamed is renamed in every place that names it."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401

FORM = "home-dashboard-editor-schema"
BLOCKS = [
    {
        "kind": "overview",
        "name": "Status",
        "icon": "mdi:clipboard-pulse-outline",
        "sections": [{"title": "Uwaga", "items": []}],
    },
    {"kind": "departures", "name": "MPK", "entities": ["sensor.tram_8"]},
    {"kind": "news", "name": "Infopiguła", "sections": []},
    {"kind": "host", "name": "Host", "columns": [{"title": "NUC"}]},
    {"kind": "school", "name": "Rok szkolny", "sources": {"plan": "sensor.plan"}},
    {"kind": "app", "name": "Źródła", "addon": "music"},
    {"kind": "page", "name": "Media", "page": "media"},
    {"kind": "tv", "name": "Telewizor", "entity": "media_player.tv"},
    {"kind": "scale", "name": "Waga", "people": ["sensor.weight_ola"]},
]
STRATEGY = {
    "type": "custom:home-dashboard",
    "shortcuts": BLOCKS,
    "layout": [{"id": "hall", "name": "Korytarz", "home": [{"shortcut": "MPK"}], "sections": []}],
    "menu": {"groups": [{"items": [{"shortcut": "MPK"}, {"shortcut": "Status"}]}]},
    "visibility": {"block:MPK": {"only": ["u1"]}},
    "status_panel": {"now": [{"entity": "sensor.washer", "block": "MPK"}]},
}


def draft(page) -> dict:
    return page.evaluate("window.editor.app._strategy")


def block(page, index: int) -> dict:
    return draft(page)["shortcuts"][index]


def field(page, path: str):
    return page.locator(f"{APP} {FORM} [data-schema-field='{path}']")


def change(page, path: str, text: str) -> None:
    control = field(page, path).locator("input, select, textarea").first
    control.fill(text)
    control.dispatch_event("change")


@pytest.fixture
def editor(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop, STRATEGY)
    return desktop


@pytest.mark.parametrize(("index", "kind"), [(index, item["kind"]) for index, item in enumerate(BLOCKS)])
def test_every_kind_of_block_opens_its_form(editor, index: int, kind: str) -> None:
    select(editor, f"shortcuts/{index}")
    form = editor.locator(f"{APP} [data-form='block-{kind}']")
    form.wait_for()
    assert editor.locator(f"{APP} [data-no-form]").count() == 0
    assert field(editor, ".name").locator("input").input_value() == BLOCKS[index]["name"]
    assert field(editor, ".hidden_when").count() == 1


def test_a_plain_field_changes_the_draft_and_one_step_undoes_it(editor) -> None:
    select(editor, "shortcuts/1")
    change(editor, ".label", "Tramwaje")
    assert block(editor, 1)["label"] == "Tramwaje"
    change(editor, ".label", "")
    assert "label" not in block(editor, 1)
    editor.locator(f"{APP} [data-undo]").click()
    assert block(editor, 1)["label"] == "Tramwaje"


def test_entities_of_departures_are_added_moved_and_removed(editor) -> None:
    select(editor, "shortcuts/1")
    add = field(editor, ".entities").locator("[data-schema-add]")
    add.fill("sensor.tram_16")
    add.dispatch_event("change")
    assert block(editor, 1)["entities"] == ["sensor.tram_8", "sensor.tram_16"]
    field(editor, ".entities").locator("[data-schema-up]").nth(1).click()
    assert block(editor, 1)["entities"] == ["sensor.tram_16", "sensor.tram_8"]
    field(editor, ".entities").locator("[data-schema-remove]").first.click()
    assert block(editor, 1)["entities"] == ["sensor.tram_8"]


def test_a_status_screen_gets_an_entry_of_a_kind(editor) -> None:
    select(editor, "shortcuts/0")
    editor.locator(f"{APP} [data-schema-entry='.sections.0'] summary").click()
    editor.locator(f"{APP} [data-schema-add='.sections.0.items']").click()
    kind = field(editor, ".sections.0.items.0.kind").locator("select")
    kind.select_option("battery")
    item = block(editor, 0)["sections"][0]["items"][0]
    assert item == {"auto": "battery", "below": 11}
    change(editor, ".sections.0.items.0.name", "Baterie")
    assert block(editor, 0)["sections"][0]["items"][0]["name"] == "Baterie"


def test_a_host_gets_a_column(editor) -> None:
    select(editor, "shortcuts/3")
    editor.locator(f"{APP} [data-schema-add='.columns']").click()
    change(editor, ".columns.1.title", "Serwer")
    assert [column.get("title") for column in block(editor, 3)["columns"]] == ["NUC", "Serwer"]


def test_yaml_of_a_field_waits_until_it_reads(editor) -> None:
    select(editor, "shortcuts/3")
    editor.locator(f"{APP} [data-schema-entry='.columns.0'] summary").click()
    area = field(editor, ".columns.0.graph").locator("textarea")
    area.fill("type: [history-graph")
    assert field(editor, ".columns.0.graph").locator(".problem").count() == 1
    assert "graph" not in block(editor, 3)["columns"][0]
    area.fill("type: history-graph")
    assert block(editor, 3)["columns"][0]["graph"] == {"type": "history-graph"}


def test_a_host_column_gets_bars_machines_and_power(editor) -> None:
    select(editor, "shortcuts/3")
    editor.locator(f"{APP} [data-schema-entry='.columns.0'] summary").click()
    editor.locator(f"{APP} [data-schema-add='.columns.0.bars']").click()
    change(editor, ".columns.0.bars.0.entity", "sensor.nuc_cpu")
    change(editor, ".columns.0.bars.0.warn", "60")
    change(editor, ".columns.0.bars.0.alert", "85")
    assert field(editor, ".columns.0.bars.0.max").locator("input").get_attribute("placeholder") == "100"
    editor.locator(f"{APP} [data-schema-add='.columns.0.machines']").click()
    change(editor, ".columns.0.machines.0.name", "Home Assistant")
    change(editor, ".columns.0.machines.0.cpu", "sensor.ha_cpu")
    change(editor, ".columns.0.power.entity", "sensor.nuc_power")
    change(editor, ".columns.0.power.switch", "switch.nuc")
    column = block(editor, 3)["columns"][0]
    assert column["bars"] == [{"entity": "sensor.nuc_cpu", "warn": 60, "alert": 85}]
    assert column["machines"] == [{"name": "Home Assistant", "cpu": "sensor.ha_cpu"}]
    assert column["power"] == {"entity": "sensor.nuc_power", "switch": "switch.nuc"}


def test_a_detail_of_a_host_has_a_type_to_choose(editor) -> None:
    select(editor, "shortcuts/3")
    editor.locator(f"{APP} [data-schema-entry='.columns.0'] summary").click()
    editor.locator(f"{APP} [data-schema-add='.columns.0.info']").click()
    field(editor, ".columns.0.info.0.type").locator("select").select_option("since")
    assert block(editor, 3)["columns"][0]["info"] == [{"type": "since"}]


def test_the_school_year_names_each_sensor_and_shows_the_default(editor) -> None:
    select(editor, "shortcuts/4")
    grades = field(editor, ".sources.grades").locator("input")
    assert grades.get_attribute("placeholder") == "sensor.rodzinnik_oceny"
    change(editor, ".sources.grades", "sensor.grades_ola")
    assert block(editor, 4)["sources"] == {"plan": "sensor.plan", "grades": "sensor.grades_ola"}
    change(editor, ".sources.plan", "")
    change(editor, ".sources.grades", "")
    assert "sources" not in block(editor, 4)


def test_departures_get_a_colour_per_line(editor) -> None:
    select(editor, "shortcuts/1")
    colours = field(editor, ".colors")
    colours.locator("[data-schema-add]").fill("8")
    colours.locator("[data-schema-add-value]").fill("#e53935")
    colours.locator("[data-schema-add-value]").dispatch_event("change")
    assert block(editor, 1)["colors"] == {"8": "#e53935"}
    colours.locator("[data-schema-remove]").click()
    assert "colors" not in block(editor, 1)


def test_an_entry_of_a_status_screen_can_be_an_alarm(editor) -> None:
    select(editor, "shortcuts/0")
    editor.locator(f"{APP} [data-schema-entry='.sections.0'] summary").click()
    editor.locator(f"{APP} [data-schema-add='.sections.0.items']").click()
    field(editor, ".sections.0.items.0.alarm").locator("button").click()
    assert block(editor, 0)["sections"][0]["items"][0]["alarm"] is True
    field(editor, ".sections.0.items.0.kind").locator("select").select_option("text")
    assert block(editor, 0)["sections"][0]["items"][0]["alarm"] is True


def test_a_tv_and_a_scale_have_their_own_fields(editor) -> None:
    select(editor, "shortcuts/7")
    field(editor, ".sound_mode").locator("button").click()
    assert block(editor, 7)["sound_mode"] is True
    change(editor, ".source_script.service", "script.tv_source")
    assert block(editor, 7)["source_script"] == {"service": "script.tv_source"}
    select(editor, "shortcuts/8")
    editor.locator(f"{APP} [data-schema-entry='.people.0'] summary").click()
    change(editor, ".people.0.name", "Ola")
    assert block(editor, 8)["people"] == [{"entity": "sensor.weight_ola", "name": "Ola"}]


def test_a_device_entry_names_its_states_in_pairs(editor) -> None:
    select(editor, "shortcuts/0")
    editor.locator(f"{APP} [data-schema-entry='.sections.0'] summary").click()
    editor.locator(f"{APP} [data-schema-add='.sections.0.items']").click()
    field(editor, ".sections.0.items.0.kind").locator("select").select_option("device")
    assert block(editor, 0)["sections"][0]["items"][0] == {"state": []}
    field(editor, ".sections.0.items.0.kind").locator("select").select_option("below")
    assert block(editor, 0)["sections"][0]["items"][0] == {"entities": [], "below": 20}
    field(editor, ".sections.0.items.0.kind").locator("select").select_option("device")
    labels = field(editor, ".sections.0.items.0.labels")
    labels.locator("[data-schema-add]").fill("running")
    labels.locator("[data-schema-add-value]").fill("Pierze")
    labels.locator("[data-schema-add-value]").dispatch_event("change")
    assert block(editor, 0)["sections"][0]["items"][0]["labels"] == {"running": "Pierze"}
    change(editor, ".sections.0.items.0.state_words", "OB")
    assert block(editor, 0)["sections"][0]["items"][0]["state_words"] == ["OB"]
    facts = field(editor, ".sections.0.items.0.facts")
    facts.locator("[data-schema-add='.sections.0.items.0.facts']").click()
    field(editor, ".sections.0.items.0.facts.0.format").locator("select").select_option("hours")
    assert block(editor, 0)["sections"][0]["items"][0]["facts"] == [{"format": "hours"}]


def test_a_tv_turns_on_with_its_own_service(editor) -> None:
    select(editor, "shortcuts/7")
    assert (
        field(editor, ".on.service").locator("input").get_attribute("placeholder") == "media_player.turn_on"
    )
    change(editor, ".off.service", "script.tv_off")
    assert block(editor, 7)["off"] == {"service": "script.tv_off"}


def test_a_renamed_block_is_renamed_where_it_is_named(editor) -> None:
    select(editor, "shortcuts/1")
    change(editor, ".name", "Tramwaje")
    strategy = draft(editor)
    assert strategy["layout"][0]["home"] == [{"shortcut": "Tramwaje"}]
    assert strategy["menu"]["groups"][0]["items"] == [{"shortcut": "Tramwaje"}, {"shortcut": "Status"}]
    assert strategy["visibility"] == {"block:Tramwaje": {"only": ["u1"]}}
    assert strategy["status_panel"]["now"][0]["block"] == "Tramwaje"


def test_a_name_emptied_keeps_the_references(editor) -> None:
    select(editor, "shortcuts/1")
    change(editor, ".name", "")
    strategy = draft(editor)
    assert "name" not in strategy["shortcuts"][1]
    assert strategy["layout"][0]["home"] == [{"shortcut": "MPK"}]


def test_the_kind_stays_whatever_the_form_sends(editor) -> None:
    select(editor, "shortcuts/2")
    change(editor, ".icon", "mdi:newspaper")
    assert block(editor, 2)["kind"] == "news" and block(editor, 2)["icon"] == "mdi:newspaper"
