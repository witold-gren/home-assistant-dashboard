"""Esc on a computer closes the window on top, as its ✕ does: a small window inside a window first, then the window."""

from __future__ import annotations

from .test_background_field import look, slot  # noqa: F401
from .test_camera_quick import open_camera
from .test_camera_settings import open_settings
from .test_editor_app import APP, desktop, open_editor  # noqa: F401
from .test_editor_generate import DIALOG as GENERATE, open_dialog as open_generate
from .test_editor_picker import HOME, PICKER, open_picker
from .test_editor_publish import DIALOG as PUBLISH, open_dialog as open_publish, rename_kitchen
from .test_page import mount
from .test_panels import add_entity, block, calls, open_block, room_with
from .test_sheets import CHROME, find_id, open_tile

SHEET_GONE = f"!{CHROME}.shadowRoot.querySelector('home-dashboard-sheet')"


def sheet_kind(page) -> str | None:
    return page.evaluate(f"{CHROME}._overlay?.sheet?.kind ?? null")


# The dashboard ---------------------------------------------------------------------------------------------------


def test_esc_closes_the_window_and_stays_on_the_page(phone):
    cover = find_id(phone, "cover.")
    mount(phone)
    url = phone.url
    open_tile(phone, cover)
    phone.keyboard.press("Escape")
    phone.wait_for_function(SHEET_GONE)
    assert phone.url == url


def test_esc_with_nothing_open_does_nothing(phone):
    mount(phone)
    phone.evaluate(
        "() => { window.backs = 0; const back = history.back.bind(history);"
        " history.back = () => { window.backs += 1; back(); }; }"
    )
    url = phone.url
    phone.keyboard.press("Escape")
    phone.wait_for_timeout(100)
    assert phone.evaluate("window.backs") == 0
    assert phone.url == url


def test_esc_closes_the_question_first_and_answers_nothing(phone):
    add_entity(phone, "sensor.machine", "ready")
    add_entity(phone, "button.climate", "unknown")
    action = {"name": "Klimatyzacja", "entity": "button.climate", "confirm": "Włączyć?"}
    open_block(phone, room_with(block(actions=[action])))
    phone.locator("[data-action='button.climate']").click()
    phone.wait_for_selector("[data-confirm]")
    phone.keyboard.press("Escape")
    assert phone.locator("[data-confirm]").count() == 0
    assert phone.locator("home-dashboard-sheet .panel").count() == 1
    assert calls(phone) == []
    phone.keyboard.press("Escape")
    phone.wait_for_function(SHEET_GONE)
    assert calls(phone) == []


def test_esc_closes_the_siren_question_and_leaves_the_camera_open(phone):
    open_camera(phone, things=("siren",))
    phone.locator("home-dashboard-sheet [data-quick='siren']").click()
    phone.wait_for_selector("home-dashboard-sheet [data-siren-ask]")
    phone.keyboard.press("Escape")
    assert phone.locator("home-dashboard-sheet [data-siren-ask]").count() == 0
    assert sheet_kind(phone) == "camera"


def test_esc_on_a_camera_opened_from_another_window_goes_back_to_it(phone):
    open_camera(phone, things=())
    phone.evaluate(f"""() => {CHROME}.open({{ type: 'sheet', sheet: {{ kind: 'camera', entityId: 'image.slup_last_screen',
        back: {{ kind: 'camera', entityId: 'image.slup_last_screen' }} }} }})""")
    phone.wait_for_selector("home-dashboard-sheet [data-back]")
    phone.keyboard.press("Escape")
    phone.wait_for_function(f"{CHROME}._overlay?.sheet && !{CHROME}._overlay.sheet.back")
    assert sheet_kind(phone) == "camera"
    assert phone.locator("home-dashboard-sheet [data-back]").count() == 0


def test_esc_closes_the_yaml_of_the_settings_first_then_the_settings(phone):
    open_settings(phone)
    phone.locator("home-dashboard-settings [data-editor]").click()
    phone.wait_for_selector("home-dashboard-settings [data-yaml]")
    phone.keyboard.press("Escape")
    phone.wait_for_selector("home-dashboard-settings [data-save]")
    assert phone.locator("home-dashboard-settings [data-yaml]").count() == 0
    phone.keyboard.press("Escape")
    phone.wait_for_function(f"!{CHROME}.shadowRoot.querySelector('home-dashboard-settings')")
    assert phone.evaluate("window.saved.filter((m) => m.type === 'lovelace/config/save').length") == 0


def test_esc_in_a_window_of_home_assistant_is_left_to_it(phone):
    cover = find_id(phone, "cover.")
    mount(phone)
    open_tile(phone, cover)
    phone.evaluate("""() => {
        const dialog = document.createElement('ha-more-info-dialog');
        const button = document.createElement('button');
        dialog.appendChild(button);
        document.body.appendChild(dialog);
        button.focus();
    }""")
    phone.keyboard.press("Escape")
    phone.wait_for_timeout(100)
    assert phone.locator("home-dashboard-sheet .panel").count() == 1


def test_esc_held_down_closes_one_thing_only(phone):
    add_entity(phone, "sensor.machine", "ready")
    add_entity(phone, "button.climate", "unknown")
    action = {"name": "Klimatyzacja", "entity": "button.climate", "confirm": "Włączyć?"}
    open_block(phone, room_with(block(actions=[action])))
    phone.locator("[data-action='button.climate']").click()
    phone.wait_for_selector("[data-confirm]")
    phone.evaluate(
        "() => { for (const repeat of [false, true, true]) window.dispatchEvent("
        "new KeyboardEvent('keydown', { key: 'Escape', repeat })); }"
    )
    assert phone.locator("[data-confirm]").count() == 0
    assert phone.locator("home-dashboard-sheet .panel").count() == 1


# The editor ------------------------------------------------------------------------------------------------------


def test_esc_closes_a_dialog_of_the_editor_as_its_cross(desktop):  # noqa: F811
    open_generate(desktop)
    desktop.keyboard.press("Escape")
    assert desktop.locator(f"{APP} {GENERATE}").count() == 0
    assert desktop.evaluate("window.homeDashboardPreview.strategy.layout.length") == 1


def test_esc_closes_the_publish_dialog_and_publishes_nothing(desktop):  # noqa: F811
    open_editor(desktop)
    rename_kitchen(desktop)
    open_publish(desktop)
    desktop.keyboard.press("Escape")
    assert desktop.locator(f"{APP} {PUBLISH}").count() == 0
    assert desktop.locator(f"{APP} [data-publish]").is_enabled()


def test_esc_closes_the_block_picker_and_adds_nothing(desktop):  # noqa: F811
    desktop.evaluate(HOME)
    open_picker(desktop)
    desktop.keyboard.press("Escape")
    assert desktop.locator(f"{APP} {PICKER}").count() == 0
    assert desktop.evaluate("window.homeDashboardPreview.strategy.layout[0].sections[0].tiles.length") == 1


def test_esc_closes_the_picture_first_then_the_window_of_pictures(look):  # noqa: F811
    field = slot(look, "light_wide")
    field.locator("[data-bg-open]").click()
    field.locator("[data-bg-file='/local/kuchnia.png'] [data-bg-file-peek]").click()
    field.locator("[data-bg-viewer]").wait_for()
    look.keyboard.press("Escape")
    assert field.locator("[data-bg-viewer]").count() == 0
    assert field.locator("[data-bg-dialog]").count() == 1
    look.keyboard.press("Escape")
    assert field.locator("[data-bg-dialog]").count() == 0
    assert "light_wide" not in look.evaluate("window.editor.app._strategy")["backgrounds"]["salon"]


def test_esc_closes_the_magnifier_of_a_picture(look):  # noqa: F811
    slot(look, "light").locator("[data-bg-peek]").click()
    slot(look, "light").locator("[data-bg-viewer]").wait_for()
    look.keyboard.press("Escape")
    assert slot(look, "light").locator("[data-bg-viewer]").count() == 0
