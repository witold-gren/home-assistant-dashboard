"""Every device window: the gear opens its settings, the pencil changes its name, area, labels and whether it is on."""

from __future__ import annotations

from .test_shortcuts import mount_admin

SHEET = "home-dashboard-sheet"

SETUP = """() => {
    const snapshot = window.dashboard.snapshot;
    const area = Object.keys(snapshot.areas)[0];
    snapshot.devices.lamp_device = { id: "lamp_device", name: "Lampa", name_by_user: null, area_id: area,
        labels: ["evening"], disabled_by: null };
    const add = (id, state, attributes = {}, category = null, device = "lamp_device") => {
        snapshot.entities[id] = { entity_id: id, device_id: device, entity_category: category, hidden: false };
        snapshot.states[id] = { entity_id: id, state, attributes: { friendly_name: `Lampa ${attributes.name ?? id}`, ...attributes } };
    };
    add("light.lamp", "on", { name: "", brightness: 200, supported_color_modes: ["brightness"], color_mode: "brightness" });
    add("select.lamp_power_on", "previous", { name: "Power on", options: ["on", "off", "previous"] }, "config");
    add("sensor.lamp_power", "12", { name: "Power", unit_of_measurement: "W" });
    add("button.lamp_identify", "unknown", { name: "Identify" }, "config");
    add("light.lonely", "off", { name: "Lonely", supported_color_modes: ["onoff"], color_mode: "onoff" }, null, null);
    add("light.pair", "on", { name: "Pair", entity_id: ["light.lamp", "light.lonely"], supported_color_modes: ["onoff"],
        color_mode: "onoff" }, null, null);
    window.asked = [];
    const original = window.dashboard.hass;
    window.dashboard.hass = (overrides) => original({ ...overrides, callWS: async (message) => {
        window.asked.push(message);
        if (message.type === "config/label_registry/list") return [
            { label_id: "evening", name: "Wieczór", icon: "mdi:weather-night" }, { label_id: "kids", name: "Dzieci", icon: null }];
        if (message.type === "config/entity_registry/get") return { entity_id: message.entity_id, name: null,
            original_name: "Lonely", area_id: null, labels: [], disabled_by: null };
        if (message.type.endsWith("/update")) { if (window.updateFails) throw { message: "Not allowed" }; return {}; }
        return null;
    } });
}"""


def open_sheet(page, entity_id="light.lamp", admin=True) -> None:
    page.evaluate(SETUP)
    mount_admin(page, {}, admin=admin)
    page.evaluate(f"""() => document.querySelector('home-dashboard-chrome')
        .open({{ type: 'sheet', sheet: {{ kind: 'light', entityId: '{entity_id}' }} }})""")
    page.wait_for_selector(f"{SHEET} header [data-details]")


def sheet_state(page, script: str):
    return page.evaluate(f"""() => {{ const sheet = document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('home-dashboard-sheet'); {script} }}""")


def updates(page) -> list[dict]:
    return page.evaluate("window.asked.filter((m) => m.type.endsWith('/update'))")


def test_the_gear_opens_the_settings_of_the_device(phone):
    open_sheet(phone)
    phone.locator(f"{SHEET} header [data-details]").click()
    phone.wait_for_function("document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet').sheet.kind === 'panel'")
    item = sheet_state(phone, "return sheet.sheet.item;")
    groups = {group["title"]: [row["entity"] for row in group["rows"]] for group in item["groups"]}
    assert groups == {
        "Ustawienia": ["select.lamp_power_on"],
        "Stan": ["sensor.lamp_power"],
        "Akcje": ["button.lamp_identify"],
    }
    assert item["name"] == "Lampa: ustawienia"
    # The window of Home Assistant is still one tap away.
    phone.evaluate("window.moreInfo = []; window.addEventListener('hass-more-info', (e) => window.moreInfo.push(e.detail.entityId))")
    phone.locator(f"{SHEET} header [data-details]").click()
    phone.wait_for_function("window.moreInfo.length === 1")
    assert phone.evaluate("window.moreInfo") == ["light.lamp"]


def open_settings(page, entity_id="light.lamp") -> None:
    open_sheet(page, entity_id)
    page.locator(f"{SHEET} header [data-details]").click()
    page.wait_for_selector(f"{SHEET} [data-settings-tabs]")


def tabs(page) -> list[str]:
    return page.evaluate("""() => [...document.querySelector('home-dashboard-chrome').shadowRoot
        .querySelector('home-dashboard-sheet').shadowRoot.querySelectorAll('[data-tab]')].map((b) => b.dataset.tab)""")


def test_the_settings_come_in_tabs_one_at_a_time(phone):
    open_settings(phone)
    assert tabs(phone) == ["settings", "state", "actions", "activity"]
    assert phone.locator(f"{SHEET} [data-field]").count() == 1
    assert phone.locator(f"{SHEET} [data-field='select.lamp_power_on']").count() == 1
    phone.locator(f"{SHEET} [data-tab='state']").click()
    assert phone.locator(f"{SHEET} [data-field='sensor.lamp_power']").count() == 1
    assert phone.locator(f"{SHEET} [data-field='select.lamp_power_on']").count() == 0


def test_activity_shows_what_the_device_did(phone):
    open_settings(phone)
    phone.locator(f"{SHEET} [data-tab='activity']").click()
    phone.wait_for_function("window.asked.some((m) => m.type === 'logbook/get_events')")
    asked = phone.evaluate("window.asked.find((m) => m.type === 'logbook/get_events')")
    assert asked["entity_ids"][0] == "light.lamp"
    assert set(asked["entity_ids"]) == {"light.lamp", "select.lamp_power_on", "sensor.lamp_power", "button.lamp_identify"}


def test_an_entity_without_a_device_gets_the_same_window_with_its_activity(phone):
    open_settings(phone, "light.lonely")
    assert tabs(phone) == ["activity"]


def test_a_group_shows_its_members_with_switches(phone):
    open_settings(phone, "light.pair")
    assert tabs(phone) == ["members", "activity"]
    assert phone.locator(f"{SHEET} [data-toggle='light.lamp']").count() == 1
    phone.locator(f"{SHEET} [data-toggle='light.lonely']").click()
    phone.wait_for_function("window.hass.calls.some((c) => c.type === 'service')")
    call = phone.evaluate("window.hass.calls.find((c) => c.type === 'service')")
    assert [call["domain"], call["service"], call["data"]] == ["homeassistant", "toggle", {"entity_id": "light.lonely"}]


def test_the_pencil_is_only_for_administrators(phone):
    open_sheet(phone, admin=False)
    assert phone.locator(f"{SHEET} header [data-edit-device]").count() == 0


def test_the_pencil_changes_name_area_and_labels_of_the_device(phone):
    open_sheet(phone)
    phone.locator(f"{SHEET} header [data-edit-device]").click()
    phone.wait_for_selector(f"{SHEET} [data-device-edit]")
    assert phone.locator(f"{SHEET} [data-edit-name]").get_attribute("placeholder") == "Lampa"
    assert phone.locator(f"{SHEET} [data-edit-label='evening'].active").count() == 1
    phone.locator(f"{SHEET} [data-edit-name]").fill("Lampa przy kanapie")
    area = phone.evaluate("Object.keys(window.dashboard.snapshot.areas)[1]")
    phone.locator(f"{SHEET} [data-edit-area]").select_option(area)
    phone.locator(f"{SHEET} [data-edit-label='kids']").click()
    phone.locator(f"{SHEET} [data-edit-label='evening']").click()
    phone.locator(f"{SHEET} [data-edit-save]").click()
    phone.wait_for_function("window.asked.some((m) => m.type.endsWith('/update'))")
    assert updates(phone) == [{"type": "config/device_registry/update", "device_id": "lamp_device",
                               "name_by_user": "Lampa przy kanapie", "area_id": area, "labels": ["kids"]}]
    # Saved, the window of the lamp comes back.
    phone.wait_for_function("document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet').sheet.kind === 'light'")


def test_switching_a_device_off_warns_and_closes_its_window(phone):
    open_sheet(phone)
    phone.locator(f"{SHEET} header [data-edit-device]").click()
    phone.wait_for_selector(f"{SHEET} [data-device-edit]")
    phone.locator(f"{SHEET} [data-edit-enabled]").uncheck()
    assert phone.locator(f"{SHEET} [data-edit-warning]").count() == 1
    phone.locator(f"{SHEET} [data-edit-save]").click()
    phone.wait_for_function("window.asked.some((m) => m.type.endsWith('/update'))")
    assert updates(phone)[0]["disabled_by"] == "user"
    phone.wait_for_function("!document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')")


def test_an_entity_without_a_device_is_changed_itself(phone):
    open_sheet(phone, "light.lonely")
    phone.locator(f"{SHEET} header [data-edit-device]").click()
    phone.wait_for_selector(f"{SHEET} [data-device-edit]")
    phone.locator(f"{SHEET} [data-edit-name]").fill("Kinkiet")
    phone.locator(f"{SHEET} [data-edit-save]").click()
    phone.wait_for_function("window.asked.some((m) => m.type.endsWith('/update'))")
    assert updates(phone) == [{"type": "config/entity_registry/update", "entity_id": "light.lonely", "name": "Kinkiet",
                               "area_id": None, "labels": []}]


def test_a_refused_change_says_why_and_keeps_the_form(phone):
    open_sheet(phone)
    phone.evaluate("window.updateFails = true")
    phone.locator(f"{SHEET} header [data-edit-device]").click()
    phone.wait_for_selector(f"{SHEET} [data-device-edit]")
    phone.locator(f"{SHEET} [data-edit-save]").click()
    phone.wait_for_selector(f"{SHEET} [data-edit-problem]")
    assert "Not allowed" in phone.locator(f"{SHEET} [data-edit-problem]").inner_text()
    assert phone.locator(f"{SHEET} [data-device-edit]").count() == 1
