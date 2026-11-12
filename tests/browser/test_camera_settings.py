"""Turning and talking of each camera, chosen in the dashboard settings."""

from __future__ import annotations

from .test_camera_controls import ADD_DEVICE
from .test_shortcuts import mount_admin

SETTINGS = "home-dashboard-settings"
ROW = f"{SETTINGS} [data-camera-control='image.slup_last_screen']"


def open_settings(page, cameras: dict | None = None) -> None:
    page.evaluate(ADD_DEVICE)
    page.evaluate("() => { window.dashboard.snapshot.entities['script.turn_left'] = { entity_id: 'script.turn_left', hidden: false };"
                  " window.dashboard.snapshot.states['script.turn_left'] = { entity_id: 'script.turn_left', state: 'off',"
                  " attributes: { friendly_name: 'Turn left' } }; }")
    mount_admin(page, {"cameras": {"tiles": ["image.slup_last_screen"], **(cameras or {})}})
    page.evaluate("() => document.querySelector('home-dashboard-chrome').open({ type: 'settings' })")
    page.wait_for_selector(ROW)


def saved_cameras(page) -> dict:
    page.locator(f"{SETTINGS} [data-save]").click()
    page.wait_for_function("window.saved.some((message) => message.type === 'lovelace/config/save')")
    return page.evaluate("window.saved.filter((m) => m.type === 'lovelace/config/save').at(-1).config.strategy.cameras")


def test_each_camera_says_what_was_found_for_turning(phone):
    open_settings(phone)
    summary = phone.locator(f"{ROW} .camera-row small").inner_text()
    assert summary.startswith("Wykryto: ")
    assert "Obróć w lewo" in summary and "pozycje: 2" in summary


def test_turning_chosen_by_hand_is_saved_for_the_camera(phone):
    open_settings(phone)
    phone.locator(f"{ROW} .camera-row").click()
    phone.locator(f"{ROW} [data-ptz-mode]").select_option("manual")
    phone.locator(f"{ROW} [data-ptz-field='left']").select_option("script.turn_left")
    phone.locator(f"{ROW} [data-ptz-field='right']").select_option("button.slup_pan_right")
    assert "Obróć w lewo" in phone.locator(f"{ROW} .camera-row small").inner_text()
    cameras = saved_cameras(phone)
    assert cameras["ptz"] == {"image.slup_last_screen": {"mode": "manual", "left": "script.turn_left", "right": "button.slup_pan_right"}}


def test_back_to_automatic_takes_the_setting_away(phone):
    open_settings(phone, {"ptz": {"image.slup_last_screen": {"mode": "none"}}})
    assert phone.locator(f"{ROW} .camera-row small").inner_text() == "Nic nie wykryto"
    phone.locator(f"{ROW} .camera-row").click()
    phone.locator(f"{ROW} [data-ptz-mode]").select_option("auto")
    assert saved_cameras(phone)["ptz"] == {}


def test_onvif_positions_are_typed_as_tokens(phone):
    open_settings(phone)
    phone.locator(f"{ROW} .camera-row").click()
    phone.locator(f"{ROW} [data-ptz-mode]").select_option("onvif")
    phone.locator(f"{ROW} [data-ptz-presets]").fill("1, 2 ,3")
    phone.locator(f"{ROW} [data-ptz-presets]").dispatch_event("change")
    assert saved_cameras(phone)["ptz"] == {"image.slup_last_screen": {"mode": "onvif", "presets": ["1", "2", "3"]}}


def test_talking_is_chosen_for_the_camera(phone):
    open_settings(phone)
    phone.locator(f"{ROW} .camera-row").click()
    phone.locator(f"{ROW} [data-talk-with]").select_option("go2rtc")
    assert saved_cameras(phone)["talk_with"] == {"image.slup_last_screen": "go2rtc"}


def test_the_columns_of_all_cameras_are_saved(phone):
    open_settings(phone)
    phone.locator("home-dashboard-settings [data-camera-columns]").select_option("4")
    assert saved_cameras(phone)["columns"] == 4


def test_the_layout_of_all_cameras_is_saved(phone):
    open_settings(phone)
    phone.locator("home-dashboard-settings select[data-camera-layout]").select_option("featured")
    assert saved_cameras(phone)["layout"] == "featured"
