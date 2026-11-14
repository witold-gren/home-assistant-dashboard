"""The editor on a computer, stages L1 and on: the settings in forms. The status bar of a tablet takes its look from
`appearance.status` and its facts from `status_panel`; one form writes both, and a part left empty leaves the
configuration as short as if written by hand."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401

STRATEGY = {
    "type": "custom:home-dashboard",
    "shortcuts": [{"kind": "panel", "name": "Pralka", "entity": "sensor.washer"}],
    "appearance": {"tiles": {"radius": 16}},
    "status_panel": {"doors": ["binary_sensor.front"], "now": [{"entity": "sensor.washer", "block": "Pralka"}]},
}


def draft(page) -> dict:
    return page.evaluate("window.editor.app._strategy")


def section(page, key: str):
    return page.locator(f"{APP} [data-settings-section='{key}']")


def field(page, section_key: str, path: str):
    """A field of a part of the form, the part unfolded first as a person would."""
    part = section(page, section_key)
    if not part.evaluate("(details) => details.open"):
        part.locator("summary").first.click()
    return part.locator(f"[data-schema-field='{path}']")


def change(page, section_key: str, path: str, text: str) -> None:
    control = field(page, section_key, path).locator("input, select, textarea").last
    control.fill(text)
    control.dispatch_event("change")


@pytest.fixture
def editor(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop, STRATEGY)
    select(desktop, "status_panel")
    desktop.locator(f"{APP} [data-form='setting-status_panel']").wait_for()
    desktop.locator(f"{APP} [data-form='setting-status_panel'] [data-schema-form]").first.wait_for()
    return desktop


def test_the_status_bar_is_turned_on_and_off_again_leaving_nothing(editor) -> None:
    field(editor, "look", ".shown").locator("button").click()
    assert draft(editor)["appearance"] == {"tiles": {"radius": 16}, "status": {"shown": True}}
    field(editor, "look", ".shown").locator("button").click()
    assert draft(editor)["appearance"] == {"tiles": {"radius": 16}}


def test_the_parts_start_as_all_and_keep_an_order(editor) -> None:
    rows = field(editor, "look", ".widgets").locator("[data-schema-option]")
    rows.first.wait_for()
    assert rows.count() == 7
    field(editor, "look", ".widgets").locator("[data-schema-down]").first.click()
    widgets = draft(editor)["appearance"]["status"]["widgets"]
    assert widgets[:2] == ["calendar", "weather"] and len(widgets) == 7
    field(editor, "look", ".widgets").locator("[data-schema-remove]").last.click()
    assert "power" not in draft(editor)["appearance"]["status"]["widgets"]
    field(editor, "look", ".widgets").locator("[data-schema-option-add='power']").click()
    assert draft(editor)["appearance"]["status"]["widgets"][-1] == "power"


def test_colours_and_numbers_of_the_look(editor) -> None:
    change(editor, "look", ".background", "#203040")
    change(editor, "look", ".opacity", "80")
    status = draft(editor)["appearance"]["status"]
    assert (status["background"], status["opacity"]) == ("#203040", 80)
    field(editor, "look", ".background").locator("[data-schema-clear]").click()
    assert "background" not in draft(editor)["appearance"]["status"]


def test_a_door_is_added_as_its_entity_alone_and_gets_a_name(editor) -> None:
    add = field(editor, "facts", ".doors").locator("[data-schema-add='.doors']")
    add.click()  # a new entry opens by itself
    change(editor, "facts", ".doors.1.entity", "binary_sensor.balcony")
    assert draft(editor)["status_panel"]["doors"] == ["binary_sensor.front", "binary_sensor.balcony"]
    change(editor, "facts", ".doors.1.name", "Balkon")
    assert draft(editor)["status_panel"]["doors"][1] == {"entity": "binary_sensor.balcony", "name": "Balkon"}


def test_entities_not_counted(editor) -> None:
    add = field(editor, "facts", ".ignore").locator("[data-schema-add]")
    add.fill("light.skylight")
    add.dispatch_event("change")
    assert draft(editor)["status_panel"]["ignore"] == ["light.skylight"]


def test_an_entry_of_now_opens_a_block_chosen_by_name(editor) -> None:
    editor.locator(f"{APP} [data-schema-entry='.now.0'] > summary").click()
    options = field(editor, "facts", ".now.0.block").locator("option").evaluate_all("(items) => items.map((o) => o.value)")
    assert options == ["", "Pralka"]
    change(editor, "facts", ".now.0.resting", "off, Gotowe")
    assert draft(editor)["status_panel"]["now"][0]["resting"] == ["off", "Gotowe"]


def test_the_status_panel_emptied_leaves_the_configuration(editor) -> None:
    field(editor, "facts", ".doors").locator("[data-schema-remove]").first.click()
    editor.locator(f"{APP} [data-schema-entry='.now.0'] > summary [data-schema-remove]").click()
    assert "status_panel" not in draft(editor)


def test_one_change_is_one_step_to_undo(editor) -> None:
    field(editor, "look", ".colourful").locator("button").click()
    assert draft(editor)["appearance"]["status"]["colourful"] is True
    editor.locator(f"{APP} [data-undo]").click()
    assert "status" not in draft(editor)["appearance"]


def test_the_form_speaks_english(desktop) -> None:  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop, STRATEGY, language="en")
    select(desktop, "status_panel")
    assert "Show the status bar" in field(desktop, "look", ".shown").inner_text()


LOOK = {
    "type": "custom:home-dashboard",
    "appearance": {"tiles": {"radius": 16}},
    "themes": [{"id": "apple", "name": "Apple Home"}, {"id": "glass", "name": "Szkło"}],
    "backgrounds": {"home": {"light": "#ffffff"}},
}


@pytest.fixture
def look(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop, LOOK)
    select(desktop, "appearance")
    desktop.locator(f"{APP} [data-form='setting-appearance']").wait_for()
    desktop.locator(f"{APP} [data-form='setting-appearance'] [data-schema-form]").first.wait_for()
    return desktop


def test_the_look_has_a_part_for_each_of_its_groups(look) -> None:
    keys = look.locator(f"{APP} [data-settings-section]").evaluate_all(
        "(items) => items.map((item) => [item.dataset.settingsSection, item.open])")
    assert [key for key, _ in keys] == ["general", "page", "tiles", "text", "chips", "buttons", "badges", "sheets", "map", "player", "themes"]
    # a long form starts folded but for its first part
    assert [key for key, opened in keys if opened] == ["general"]


def test_a_number_of_the_tiles_and_a_colour_by_kind(look) -> None:
    change(look, "tiles", ".radius", "24")
    change(look, "tiles", ".colours.light", "#ffcc00")
    assert draft(look)["appearance"]["tiles"] == {"radius": 24, "colours": {"light": "#ffcc00"}}


def test_a_switch_on_by_default_is_written_only_when_off(look) -> None:
    switch = field(look, "general", ".bounce").locator("button")
    assert switch.get_attribute("aria-checked") == "true"
    switch.click()
    assert draft(look)["appearance"]["bounce"] is False
    switch.click()
    assert "bounce" not in draft(look)["appearance"]


def test_a_choice_of_numbers_is_saved_as_a_number(look) -> None:
    field(look, "map", ".hours").locator("select").select_option("72")
    field(look, "map", ".theme").locator("select").select_option("dark")
    assert draft(look)["appearance"]["map"] == {"hours": 72, "theme": "dark"}


def test_the_theme_is_chosen_from_the_library(look) -> None:
    options = field(look, "themes", ".theme").locator("option").evaluate_all("(items) => items.map((o) => o.value)")
    assert options == ["", "apple", "glass"]
    field(look, "themes", ".theme").locator("select").select_option("glass")
    assert draft(look)["theme"] == "glass"
    assert draft(look)["themes"][0]["id"] == "apple"  # the other keys of the top stay


def set_background(scope, value: str) -> None:
    """A background typed as CSS in the window of its field, then used."""
    scope.locator("[data-bg-open]").click()
    scope.locator("[data-bg-tab='colour']").click()
    css = scope.locator("[data-bg-css]")
    css.fill(value)
    css.dispatch_event("change")
    scope.locator("[data-bg-use]").click()


def test_a_background_of_a_page_has_a_field_per_look(look) -> None:
    field(look, "themes", ".backgrounds").locator("[data-schema-entry='.backgrounds.home'] summary").click()
    set_background(field(look, "themes", ".backgrounds.home.dark"), "#121316")
    field(look, "themes", ".backgrounds.home.position").locator("select").select_option("top")
    assert draft(look)["backgrounds"] == {"home": {"light": "#ffffff", "dark": "#121316", "position": "top"}}
    add = field(look, "themes", ".backgrounds").locator("[data-schema-add='.backgrounds']")
    add.fill("energy")
    add.dispatch_event("change")
    assert field(look, "themes", ".backgrounds").locator("[data-schema-entry='.backgrounds.energy']").get_attribute("open") is not None
    set_background(field(look, "themes", ".backgrounds.energy.light"), "linear-gradient(#fff, #eee)")
    assert draft(look)["backgrounds"]["energy"] == {"light": "linear-gradient(#fff, #eee)"}


def test_a_background_written_as_one_text_is_shown_in_both_looks(desktop) -> None:  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop, {**LOOK, "backgrounds": {"map": "#223344"}})
    select(desktop, "appearance")
    desktop.locator(f"{APP} [data-form='setting-appearance'] [data-schema-form]").first.wait_for()
    part = section(desktop, "themes")
    part.locator("summary").first.click()
    part.locator("[data-schema-entry='.backgrounds.map'] summary").click()
    dark = part.locator("[data-schema-field='.backgrounds.map.dark']")
    assert dark.locator("[data-bg-open]").inner_text() == "#223344"
    set_background(dark, "#000000")
    assert draft(desktop)["backgrounds"] == {"map": {"light": "#223344", "dark": "#000000"}}


def test_an_own_icon_of_a_device(look) -> None:
    add = field(look, "general", ".icons").locator("[data-schema-add]")
    add.fill("light.desk")
    add.dispatch_event("change")
    assert draft(look)["appearance"]["icons"] == {"light.desk": "mdi:circle"}
    row = field(look, "general", ".icons").locator("[data-schema-map='light.desk'] input").nth(1)
    row.fill("mdi:desk-lamp")
    row.dispatch_event("change")
    assert draft(look)["appearance"]["icons"] == {"light.desk": "mdi:desk-lamp"}


def test_every_field_of_the_look_has_a_name(desktop) -> None:  # noqa: F811
    missing = desktop.evaluate("""async () => {
        const { lookSections } = await import('/custom_components/home_dashboard/www/editor/settings-form.js');
        const { translate } = await import('/custom_components/home_dashboard/www/app/i18n.js');
        const out = [];
        for (const language of ['en', 'pl']) {
            for (const section of lookSections({}, language)) {
                if (translate(language, section.titleKey) === section.titleKey) out.push(section.titleKey);
                for (const field of section.fields) if (translate(language, field.labelKey) === field.labelKey) out.push(`${language}:${field.labelKey}`);
            }
        }
        return out;
    }""")
    assert missing == []


SIDE = {
    "type": "custom:home-dashboard",
    "shortcuts": [{"kind": "overview", "name": "Status"}],
    "layout": [{"id": "kitchen", "name": "Kuchnia", "sections": []}],
    "appearance": {"tiles": {"radius": 16}},
}


@pytest.fixture
def side(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop, SIDE)
    return desktop


def test_the_menu_and_the_bar_of_pages_are_in_the_tree(side) -> None:
    keys = side.locator(f"{APP} [data-node]").evaluate_all("(nodes) => nodes.map((node) => node.dataset.node)")
    assert "menu" in keys and "nav" in keys


def test_the_menu_gets_a_group_with_an_entry_for_some_people(side) -> None:
    select(side, "menu")
    side.locator(f"{APP} [data-form='setting-menu']").wait_for()
    side.locator(f"{APP} [data-form='setting-menu'] [data-schema-form]").first.wait_for()
    side.locator(f"{APP} [data-schema-add='.groups']").click()
    change(side, "menu", ".groups.0.title", "System")
    side.locator(f"{APP} [data-schema-add='.groups.0.items']").click()
    change(side, "menu", ".groups.0.items.0.name", "Ustawienia")
    change(side, "menu", ".groups.0.items.0.path", "/config")
    field(side, "menu", ".groups.0.items.0.admin").locator("button").click()
    assert draft(side)["menu"] == {
        "groups": [{"title": "System", "items": [{"name": "Ustawienia", "path": "/config", "admin": True}]}]
    }


def test_choosing_the_menu_opens_it_in_the_preview(side) -> None:
    side.evaluate("""() => { window.commands = []; window.editor.app._source.commands.add((command) => command.type !== "highlight" && window.commands.push(command.type)); }""")
    select(side, "menu")
    select(side, "shortcuts/0")
    assert side.evaluate("window.commands") == ["open-menu", "open-shortcut"]


def test_the_bar_of_pages_starts_with_its_pages_and_takes_a_room(side) -> None:
    select(side, "nav")
    side.locator(f"{APP} [data-form='setting-nav']").wait_for()
    side.locator(f"{APP} [data-form='setting-nav'] [data-schema-form]").first.wait_for()
    rows = field(side, "nav", ".items").locator("[data-schema-option]")
    rows.first.wait_for()
    assert rows.evaluate_all("(items) => items.map((item) => item.dataset.schemaOption)") == ["home", "media", "energy", "map"]
    field(side, "nav", ".items").locator("[data-schema-option-add='room:kitchen']").click()
    assert draft(side)["appearance"]["nav"]["items"] == ["home", "media", "energy", "map", "room:kitchen"]
    # five is the most the bar takes
    assert field(side, "nav", ".items").locator("[data-schema-option-add]").count() == 0
    assert draft(side)["appearance"]["tiles"] == {"radius": 16}


def test_the_bar_keeps_at_least_two_places(side) -> None:
    select(side, "nav")
    side.locator(f"{APP} [data-form='setting-nav']").wait_for()
    side.locator(f"{APP} [data-form='setting-nav'] [data-schema-form]").first.wait_for()
    items = field(side, "nav", ".items")
    items.locator("[data-schema-remove]").first.click()
    items.locator("[data-schema-remove]").first.click()
    assert draft(side)["appearance"]["nav"]["items"] == ["energy", "map"]
    assert items.locator("[data-schema-remove]").count() == 0


def test_every_field_of_the_menu_and_the_bar_has_a_name(desktop) -> None:  # noqa: F811
    missing = desktop.evaluate("""async () => {
        const { navSections, SETTINGS_FORMS } = await import('/custom_components/home_dashboard/www/editor/settings-form.js');
        const { translate } = await import('/custom_components/home_dashboard/www/app/i18n.js');
        const out = [];
        for (const language of ['en', 'pl']) {
            for (const section of [...navSections({}, language), ...SETTINGS_FORMS.menu({}, language)]) {
                for (const field of section.fields) {
                    const key = field.labelKey ?? `block_${field.label ?? field.key}`;
                    if (translate(language, key) === key) out.push(`${language}:${key}`);
                }
            }
        }
        return out;
    }""")
    assert missing == []


HOME = {
    "type": "custom:home-dashboard",
    "shortcuts": [{"kind": "panel", "name": "Stacja", "entity": "sensor.station"}],
    "cameras": {"hide": ["camera.garage"], "ptz": {"camera.hall": {"mode": "onvif", "presets": ["door"]}}},
    "intercom": {"script": "script.komunikat"},
}


@pytest.fixture
def home(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop, HOME)
    return desktop


def open_setting(page, key: str) -> None:
    select(page, key)
    page.locator(f"{APP} [data-form='setting-{key}']").wait_for()
    page.locator(f"{APP} [data-form='setting-{key}'] [data-schema-form]").first.wait_for()


def test_cameras_shown_and_hidden(home) -> None:
    open_setting(home, "cameras")
    change(home, "shown", ".columns", "4")
    field(home, "shown", ".layout").locator("select").select_option("featured")
    cameras = draft(home)["cameras"]
    assert (cameras["columns"], cameras["layout"], cameras["hide"]) == (4, "featured", ["camera.garage"])
    assert cameras["ptz"] == {"camera.hall": {"mode": "onvif", "presets": ["door"]}}  # other parts stay


def test_a_private_rule_for_some_people(home) -> None:
    open_setting(home, "cameras")
    field(home, "privacy", ".private").locator("[data-schema-add='.private']").click()
    change(home, "privacy", ".private.0.entity", "switch.bedroom_privacy")
    add = field(home, "privacy", ".private.0.hide").locator("[data-schema-add]")
    add.fill("camera.bedroom")
    add.dispatch_event("change")
    assert draft(home)["cameras"]["private"] == [{"entity": "switch.bedroom_privacy", "hide": ["camera.bedroom"]}]


def test_turning_of_a_single_camera(home) -> None:
    open_setting(home, "cameras")
    home.locator(f"{APP} [data-schema-entry='.ptz.camera.hall'] > summary").click()
    field(home, "single", ".ptz.camera.hall.mode").locator("select").select_option("manual")
    change(home, "single", ".ptz.camera.hall.left", "button.hall_left")
    assert draft(home)["cameras"]["ptz"]["camera.hall"] == {"mode": "manual", "presets": ["door"], "left": "button.hall_left"}
    add = field(home, "single", ".quick").locator("[data-schema-add]")
    add.fill("camera.garden")
    add.dispatch_event("change")
    change(home, "single", ".quick.camera.garden.siren", "switch.garden_siren")
    assert draft(home)["cameras"]["quick"] == {"camera.garden": {"siren": "switch.garden_siren"}}


def test_a_picture_gets_its_live_camera_once_both_are_given(home) -> None:
    open_setting(home, "cameras")
    new = field(home, "single", ".live").locator("[data-schema-new]")
    new.locator("[data-schema-add]").fill("image.hall")
    new.locator("[data-schema-add]").dispatch_event("change")
    assert "live" not in draft(home)["cameras"]
    new.locator("[data-schema-add-value]").fill("camera.hall")
    new.locator("[data-schema-add-value]").dispatch_event("change")
    assert draft(home)["cameras"]["live"] == {"image.hall": "camera.hall"}


def test_the_intercom_speaks_to_rooms_ticked(home) -> None:
    open_setting(home, "intercom")
    area = field(home, "intercom", ".areas").locator("[data-schema-area]").first
    area_id = area.get_attribute("data-schema-area")
    area.click()
    assert draft(home)["intercom"] == {"script": "script.komunikat", "areas": [area_id]}


def test_energy_storage_opens_a_block(home) -> None:
    open_setting(home, "energy")
    change(home, "energy", ".voltage_range", "210, 250")
    field(home, "energy", ".storage").locator("[data-schema-add='.storage']").click()
    field(home, "energy", ".storage.0.block").locator("select").select_option("Stacja")
    change(home, "energy", ".storage.0.battery", "sensor.station_battery")
    assert draft(home)["energy"] == {"voltage_range": [210, 250], "storage": [{"block": "Stacja", "battery": "sensor.station_battery"}]}


def test_every_field_of_the_settings_has_a_name(desktop) -> None:  # noqa: F811
    missing = desktop.evaluate("""async () => {
        const { SETTINGS_FORMS } = await import('/custom_components/home_dashboard/www/editor/settings-form.js');
        const { translate } = await import('/custom_components/home_dashboard/www/app/i18n.js');
        const out = [];
        const check = (language, fields) => {
            for (const field of fields ?? []) {
                const key = field.labelKey ?? `block_${field.label ?? field.key}`;
                if (translate(language, key) === key) out.push(`${language}:${key}`);
                if (field.helpKey && translate(language, field.helpKey) === field.helpKey) out.push(`${language}:${field.helpKey}`);
                if (field.optionKey && field.options) for (const option of field.options)
                    if (translate(language, `${field.optionKey}_${option}`) === `${field.optionKey}_${option}` && !field.optionKey.startsWith('look_') && field.optionKey !== 'nav' && field.optionKey !== 'status_part') out.push(`${language}:${field.optionKey}_${option}`);
                check(language, field.fields);
                if (field.valueField) check(language, [field.valueField]);
            }
        };
        for (const language of ['en', 'pl']) {
            for (const form of Object.values(SETTINGS_FORMS)) {
                for (const section of form({ shortcuts: [] }, language)) {
                    if (translate(language, section.titleKey) === section.titleKey) out.push(`${language}:${section.titleKey}`);
                    check(language, section.fields);
                }
            }
        }
        return [...new Set(out)];
    }""")
    assert missing == []


PEOPLE = [
    {"id": "u_owner", "name": "Witek", "is_owner": True, "is_active": True},
    {"id": "u_ola", "name": "Ola", "is_owner": False, "is_active": True},
    {"id": "u_kuba", "name": "Kuba", "is_owner": False, "is_active": True},
]
ROOMS = {
    "type": "custom:home-dashboard",
    "shortcuts": [{"kind": "overview", "name": "Status"}],
    "layout": [{"id": "garage", "name": "Garaż", "areas": [], "sections": [{"title": "Brama", "tiles": []}]}],
    "access": {"u_kuba": {"rooms": ["garage"]}},
}


@pytest.fixture
def people(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop, ROOMS, users=PEOPLE)
    select(desktop, "access")
    desktop.locator(f"{APP} [data-form='setting-access']").wait_for()
    desktop.locator(f"{APP} [data-form='setting-access'] [data-schema-form]").first.wait_for()
    return desktop


def access_form(page):
    return page.locator(f"{APP} home-dashboard-editor-access")


def test_a_person_loses_a_section_and_gets_it_back(people) -> None:
    form = access_form(people)
    form.locator("[data-access-user]").select_option("u_ola")
    form.locator("[data-access-kind='sections'] summary").click()
    form.locator("[data-access-item='garage|title:Brama'] button").click()
    assert draft(people)["access"] == {"u_kuba": {"rooms": ["garage"]}, "u_ola": {"sections": ["garage|title:Brama"]}}
    form.locator("[data-access-item='garage|title:Brama'] button").click()
    assert draft(people)["access"] == {"u_kuba": {"rooms": ["garage"]}}


def test_the_owner_is_not_offered_and_a_rule_is_marked(people) -> None:
    options = access_form(people).locator("[data-access-user] option").evaluate_all("(items) => items.map((o) => o.value)")
    assert options == ["u_ola", "u_kuba"]
    access_form(people).locator("[data-access-user]").select_option("u_kuba")
    assert access_form(people).locator("[data-access-kind='rooms']").evaluate("(d) => d.open")
    access_form(people).locator("[data-access-item='garage'] button").click()
    assert "access" not in draft(people)


def test_a_block_is_seen_only_by_some(people) -> None:
    add = field(people, "visibility", ".visibility").locator("[data-schema-add]")
    keys = add.evaluate("(input) => [...input.list.options].map((o) => o.value)")
    assert "block:Status" in keys and "shortcut:Status" in keys
    add.fill("block:Status")
    add.dispatch_event("change")
    field(people, "visibility", ".visibility.block:Status.only").locator("[data-schema-user='u_ola']").click()
    assert draft(people)["visibility"] == {"block:Status": {"only": ["u_ola"]}}


REST = {
    "type": "custom:home-dashboard",
    "layout": [{"id": "garage", "name": "Garaż", "sections": []}, {"id": "hall", "name": "Korytarz", "sections": []}],
    "lights": {"prefer_groups": True},
}


@pytest.fixture
def rest(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop, REST)
    return desktop


def test_rooms_ordered_and_hidden(rest) -> None:
    open_setting(rest, "room_order")
    field(rest, "rooms", ".order").locator("[data-schema-option-add='hall']").click()
    field(rest, "rooms", ".hidden").locator("[data-schema-choice='garage']").click()
    assert draft(rest)["rooms"] == {"order": ["hall"], "hidden": ["garage"]}


def test_an_entity_added_to_a_room_and_one_of_its_own(rest) -> None:
    open_setting(rest, "entities")
    add = field(rest, "entities", ".include").locator("[data-schema-add]")
    add.fill("hall")
    add.dispatch_event("change")
    more = field(rest, "entities", ".include.hall").locator("[data-schema-add]")
    more.fill("sensor.hall_temperature")
    more.dispatch_event("change")
    own = field(rest, "entities", ".overrides").locator("[data-schema-add]").last
    own.fill("light.desk")
    own.dispatch_event("change")
    change(rest, "entities", ".overrides.light.desk.name", "Biurko")
    assert draft(rest)["entities"] == {"include": {"hall": ["sensor.hall_temperature"]}, "overrides": {"light.desk": {"name": "Biurko"}}}


def test_lights_on_by_default_are_written_only_when_off(rest) -> None:
    open_setting(rest, "lights")
    switch = field(rest, "lights", ".prefer_groups").locator("button")
    switch.click()
    assert draft(rest)["lights"] == {"prefer_groups": False}
    switch.click()
    assert "lights" not in draft(rest)


def test_home_and_tablet(rest) -> None:
    open_setting(rest, "home_settings")
    change(rest, "idle", ".return_after", "300")
    field(rest, "security", ".unlock_on_tablet").locator("button").click()
    field(rest, "scenes", ".scenes_layout").locator("select").select_option("row")
    strategy = draft(rest)
    assert (strategy["idle"], strategy["security"], strategy["scenes_layout"]) == (
        {"return_after": 300},
        {"unlock_on_tablet": True},
        "row",
    )


def test_music_media_and_map_pages(rest) -> None:
    open_setting(rest, "music")
    change(rest, "music", ".addon", "music_assistant")
    open_setting(rest, "map")
    add = field(rest, "map", ".track").locator("[data-schema-add]")
    add.fill("device_tracker.car")
    add.dispatch_event("change")
    open_setting(rest, "media")
    field(rest, "media", ".sections").locator("[data-schema-add='.sections']").click()
    change(rest, "media", ".sections.0.title", "Telewizory")
    strategy = draft(rest)
    assert strategy["music"] == {"addon": "music_assistant"}
    assert strategy["map"] == {"track": ["device_tracker.car"]}
    assert strategy["media"] == {"sections": [{"title": "Telewizory"}]}


def test_patterns_of_speakers_are_lines_and_a_tile_turns_on_with_a_service(rest) -> None:
    open_setting(rest, "media")
    patterns = field(rest, "media", ".group_patterns").locator("textarea")
    patterns.fill("^(.+)_homepod$\n\n^(.+)_sonos{1,2}$")
    patterns.dispatch_event("change")
    assert draft(rest)["media"]["group_patterns"] == ["^(.+)_homepod$", "^(.+)_sonos{1,2}$"]
    field(rest, "media", ".sections").locator("[data-schema-add='.sections']").click()
    rest.locator(f"{APP} [data-schema-add='.sections.0.tiles']").click()
    change(rest, "media", ".sections.0.tiles.0.on.service", "script.tv_on")
    change(rest, "media", ".sections.0.tiles.0.on.target", "media_player.tv")
    assert draft(rest)["media"]["sections"][0]["tiles"][0]["on"] == {"service": "script.tv_on", "target": "media_player.tv"}
    change(rest, "media", ".sections.0.tiles.0.on.service", "")
    change(rest, "media", ".sections.0.tiles.0.on.target", "")
    assert "on" not in draft(rest)["media"]["sections"][0]["tiles"][0]
    patterns.fill("")
    patterns.dispatch_event("change")
    assert "group_patterns" not in draft(rest).get("media", {})


def test_every_setting_of_the_tree_has_a_form(rest) -> None:
    keys = rest.locator(f"{APP} [data-node]").evaluate_all("(nodes) => nodes.map((node) => node.dataset.node)")
    settings = [key for key in keys if "/" not in key and key not in ("favorites", "scenes") and not key.startswith("layout")]
    without = []
    for key in settings:
        select(rest, key)
        if not rest.locator(f"{APP} [data-form='setting-{key}']").count():
            without.append(key)
    assert without == []


def test_the_calendars_of_the_home_and_how_they_show(editor) -> None:
    editor.evaluate("""() => { const hass = window.editor.app.hass;
        window.editor.app.hass = { ...hass, states: { ...hass.states, 'calendar.family': { entity_id: 'calendar.family', state: 'off', attributes: { friendly_name: 'Family' } } } }; }""")
    calendars = field(editor, "calendar", ".calendars")
    options = calendars.locator("datalist option").evaluate_all("(items) => items.map((item) => item.value)")
    assert options == ["calendar.family"]
    add = calendars.locator("[data-schema-add]")
    add.fill("calendar.family")
    add.dispatch_event("change")
    change(editor, "calendar", ".calendar_limit", "2")
    field(editor, "calendar", ".calendar_hide").locator("select").select_option("start")
    panel = draft(editor)["status_panel"]
    assert (panel["calendars"], panel["calendar_limit"], panel["calendar_hide"]) == (["calendar.family"], 2, "start")
