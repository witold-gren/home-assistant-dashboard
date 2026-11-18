"""The editor's settings under the gear: the phones and tablets of the preview. Built-in ones can be hidden, renamed or
resized and set back; a person adds their own of any make. Kept in the browser."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, open_editor  # noqa: F401
from .test_editor_preview import open_preview

MODULE = "/custom_components/home_dashboard/www/editor/devices.js"
DIALOG = f"{APP} home-dashboard-editor-devices"


def run(page, body: str):
    return page.evaluate(
        f"async () => {{ const d = await import('{MODULE}'); const e = await import('/custom_components/home_dashboard/www/editor/editor-app.js'); {body} }}"
    )


@pytest.fixture(autouse=True)
def clean_storage(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")


def test_the_list_of_a_kind_with_changes_and_own_devices(desktop) -> None:  # noqa: F811
    result = run(
        desktop,
        """
        let prefs = { phone: {}, tablet: {} };
        prefs = d.withDevice(prefs, 'tablet', 'mini', { hidden: true }, e.TABLETS);
        prefs = d.withDevice(prefs, 'tablet', 'air', { name: 'Tablet w kuchni' }, e.TABLETS);
        const added = d.withNewDevice(prefs, 'tablet', 'Galaxy Tab S9', 800, 1280, e.TABLETS);
        const list = d.deviceList(e.TABLETS, added.prefs, 'tablet');
        const catalog = d.deviceCatalog(e.TABLETS, added.prefs, 'tablet');
        const back = d.withDevice(added.prefs, 'tablet', 'air', { name: undefined }, e.TABLETS);
        return { key: added.key, own: list.at(-1), air: catalog.air.label, mini: 'mini' in catalog, kept: added.prefs.tablet,
                 back: back.tablet.air, phone: d.screenOf('phone', 900, 400), tablet: d.screenOf('tablet', 10, 99999),
                 model: [d.shownModel(catalog, 'mini', 'air'), d.shownModel({ x: {} }, 'mini', 'air')] };
    """,
    )
    assert result["key"] == "custom1"
    # a tablet stands on its side whatever order its size was typed in
    assert result["own"] == {
        "key": "custom1",
        "name": "Galaxy Tab S9",
        "width": 1280,
        "height": 800,
        "label": "Galaxy Tab S9 · 1280 × 800",
        "hidden": False,
        "custom": True,
        "changed": False,
    }
    assert result["air"] == "Tablet w kuchni · 1180 × 820"
    assert result["mini"] is False
    assert result["kept"]["mini"] == {"hidden": True}
    assert result["back"] is None
    assert result["phone"] == {"width": 400, "height": 900}
    assert result["tablet"] == {"width": 3000, "height": 200}
    assert result["model"] == ["air", "x"]


def test_the_page_of_an_own_device_in_the_preview(desktop) -> None:  # noqa: F811
    size = run(
        desktop,
        """const catalog = { tablet: { tab: { width: 1280, height: 800, label: 'Tab · 1280 × 800' } }, phone: e.PHONES };
        return [e.deviceSize('tablet', 'tab', 100, catalog), e.deviceSize('tablet', 'gone', 100, catalog).width];""",
    )
    assert size[0] == {"width": 1280, "height": 800, "label": "Tab · 1280 × 800"}
    assert size[1] == 1280


def gear(page):
    """⚙ opens its pop-up; the preview's devices are one step on in it."""
    page.locator(f"{APP} [data-editor-settings]").click()
    page.locator(f"{APP} [data-gear-devices]").click()
    return page.locator(DIALOG)


def test_an_own_tablet_is_added_and_shown_in_the_preview(desktop) -> None:  # noqa: F811
    open_preview(desktop)
    dialog = gear(desktop)
    form = dialog.locator("[data-device-add='tablet']")
    form.locator("[name='name']").fill("Galaxy Tab S9")
    form.locator("[name='width']").fill("1280")
    form.locator("[name='height']").fill("800")
    form.locator("button").click()
    assert (
        dialog.locator("[data-device-row='tablet/custom1'] [data-device-name]").input_value()
        == "Galaxy Tab S9"
    )
    dialog.locator("[data-settings-close]").click()
    desktop.locator(f"{APP} [data-tablet-size]").select_option("custom1")
    desktop.wait_for_function("""() => { const f = document.querySelector('home-dashboard-editor-app').shadowRoot
        .querySelector("iframe[data-frame='tablet']"); return f && f.style.width.startsWith('1280'); }""")
    stored = desktop.evaluate("JSON.parse(localStorage.getItem('home-dashboard-editor-devices'))")
    assert stored["tablet"]["custom1"] == {
        "custom": True,
        "name": "Galaxy Tab S9",
        "width": 1280,
        "height": 800,
    }


def test_a_hidden_model_leaves_the_choice_and_the_last_one_stays(desktop) -> None:  # noqa: F811
    open_preview(desktop)
    dialog = gear(desktop)
    dialog.locator("[data-device-row='phone/se1'] [data-device-visible]").uncheck()
    options = desktop.locator(f"{APP} [data-phone-size] option").evaluate_all(
        "(items) => items.map((item) => item.value)"
    )
    assert "se1" not in options and "16pro" in options
    # all but one hidden: that one cannot be hidden
    for row in dialog.locator("[data-devices='phone'] [data-device-row]").all():
        box = row.locator("[data-device-visible]")
        if box.is_checked() and not box.is_disabled():
            box.uncheck()
    checked = dialog.locator("[data-devices='phone'] [data-device-visible]:checked")
    assert checked.count() == 1 and checked.is_disabled()


def test_a_built_in_model_is_resized_and_set_back(desktop) -> None:  # noqa: F811
    open_preview(desktop)
    dialog = gear(desktop)
    row = dialog.locator("[data-device-row='tablet/air']")
    width = row.locator("[data-device-width]")
    width.fill("1200")
    width.dispatch_event("change")
    assert "1200 × 820" in desktop.locator(f"{APP} [data-tablet-size] option[value='air']").inner_text()
    row.locator("[data-device-reset]").click()
    assert desktop.evaluate("JSON.parse(localStorage.getItem('home-dashboard-editor-devices')).tablet") == {}


def test_the_switches_say_phone_and_tablet(desktop) -> None:  # noqa: F811
    open_preview(desktop)
    assert desktop.locator(f"{APP} [data-device='phone']").inner_text().strip() == "Telefon"
    assert desktop.locator(f"{APP} [data-device='tablet']").inner_text().strip() == "Tablet"


def test_models_are_offered_smallest_screen_first(desktop) -> None:  # noqa: F811
    open_preview(desktop)
    options = desktop.locator(f"{APP} [data-phone-size] option").evaluate_all(
        "(items) => items.map((item) => item.value)"
    )
    assert options[:3] == ["se1", "8", "x"] and options[-1] == "16promax"
