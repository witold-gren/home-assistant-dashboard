"""Every window of something that turns on and off has one power button, seen without scrolling: nothing to slide."""

from __future__ import annotations

import pytest

from .conftest import open_harness
from .test_panels import add_entity, calls
from .test_sensor_sheets import SHEET, add_plug, open_entity

SIZES = {
    "phone": {"width": 402, "height": 874},
    "small phone": {"width": 375, "height": 667},
    "phone on its side": {"width": 874, "height": 402},
    "tablet upright": {"width": 820, "height": 1180},
    "tablet on its side": {"width": 1180, "height": 820},
}
BUTTON = "[data-light-power], [data-switch-toggle]"
# The fullest window of a light: a slider, whites, colours and effects.
COLOUR_LIGHT = {
    "friendly_name": "Salon",
    "supported_color_modes": ["color_temp", "xy"],
    "color_mode": "xy",
    "brightness": 200,
    "rgb_color": [255, 180, 90],
    "effect_list": ["off", "candle", "fire", "sparkle"],
    "effect": "off",
}


def seen_without_scrolling(page) -> bool:
    return page.evaluate(f"""() => {{
        const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet');
        const button = sheet.shadowRoot.querySelector('{BUTTON}');
        const panel = sheet.shadowRoot.querySelector('.panel').getBoundingClientRect();
        const box = button.getBoundingClientRect();
        return box.top >= Math.max(panel.top, 0) && box.bottom <= Math.min(panel.bottom, innerHeight);
    }}""")


@pytest.mark.parametrize("size", SIZES)
@pytest.mark.parametrize(
    "thing",
    ["colour light", "light that only switches", "plug with its power", "switch of a lamp", "automation"],
)
def test_the_power_button_is_there_without_scrolling(browser, base_url, size, thing):
    page = open_harness(browser, base_url, SIZES[size])
    if thing == "colour light":
        entity = "light.salon"
        add_entity(page, entity, "on", COLOUR_LIGHT)
    elif thing == "light that only switches":
        entity = "light.mirror"
        add_entity(
            page,
            entity,
            "on",
            {"friendly_name": "Lustro", "supported_color_modes": ["onoff"], "color_mode": "onoff"},
        )
    elif thing == "plug with its power":
        entity = "switch.fridge"
        add_plug(page)
    elif thing == "switch of a lamp":
        entity = "switch.sconce"
        add_entity(page, entity, "on", {"friendly_name": "Kinkiet", "icon": "mdi:outdoor-lamp"})
    else:
        entity = "automation.lights"
        add_entity(page, entity, "on", {"friendly_name": "Światła wieczorem", "last_triggered": None})
    open_entity(page, entity)
    assert page.locator(f"{SHEET} {BUTTON}").count() == 1
    assert seen_without_scrolling(page), f"{thing} on {size}"
    assert page.errors == []
    page.close()


def test_one_tap_on_the_power_button_of_a_switch_turns_it_off(phone):
    add_plug(phone)
    open_entity(phone, "switch.fridge")
    phone.locator(f"{SHEET} [data-switch-toggle]").click()
    services = [
        (call["domain"], call["service"], call["data"]) for call in calls(phone) if call["type"] == "service"
    ]
    assert services == [("homeassistant", "toggle", {"entity_id": "switch.fridge"})]


def test_the_power_button_of_a_lamp_glows_as_a_light_and_of_a_plug_as_a_device(phone):
    add_entity(phone, "switch.sconce", "on", {"friendly_name": "Kinkiet", "icon": "mdi:outdoor-lamp"})
    open_entity(phone, "switch.sconce")
    assert phone.locator(f"{SHEET} [data-switch-toggle]").get_attribute("class") == "lit"


def test_the_power_button_of_a_plug_shows_it_is_on(phone):
    add_plug(phone)
    open_entity(phone, "switch.fridge")
    assert phone.locator(f"{SHEET} [data-switch-toggle]").get_attribute("class") == "on"


def test_a_switch_that_is_gone_cannot_be_switched(phone):
    add_entity(
        phone, "switch.sconce", "unavailable", {"friendly_name": "Kinkiet", "icon": "mdi:outdoor-lamp"}
    )
    open_entity(phone, "switch.sconce")
    assert phone.locator(f"{SHEET} [data-switch-toggle]").is_disabled()
