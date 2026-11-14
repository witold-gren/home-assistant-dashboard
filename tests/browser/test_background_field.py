"""The field of a background in the editor: a sample of its colour or a magnifier for its picture at its end, and a
window to choose a picture already in Home Assistant, send one from the computer, or set a colour or a gradient."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401

LOOK = {
    "type": "custom:home-dashboard",
    "layout": [{"id": "salon", "name": "Salon", "sections": []}],
    "backgrounds": {"salon": {"light": "/local/backgrounds/salon.jpg", "dark": "linear-gradient(170deg, #3b4a6e 0%, #252d45 55%, #1b2033 100%)"}},
}
MODULE = "/custom_components/home_dashboard/www/app/background-field.js"


def draft(page) -> dict:
    return page.evaluate("window.editor.app._strategy")


def slot(page, look: str):
    return page.locator(f"{APP} [data-schema-field='.backgrounds.salon.{look}']")


@pytest.fixture
def look(desktop):  # noqa: F811
    open_editor(desktop, LOOK)
    desktop.evaluate("""() => { const state = window.editor.server.state;
        state.images = [{ id: 'old', name: 'stare.jpg' }, { id: 'new', name: 'nowe.jpg' }];
        state.pictures = [{ url: '/local/backgrounds/salon.jpg', size: 10, modified: 2 }, { url: '/local/kuchnia.png', size: 5, modified: 1 }];
        window.uploads = [];
        window.editor.app.hass.fetchWithAuth = async (url) => { window.uploads.push(url);
            return { ok: true, json: async () => ({ id: 'sent' }) }; }; }""")
    select(desktop, "appearance")
    part = desktop.locator(f"{APP} [data-settings-section='themes']")
    part.locator("summary").first.click()
    part.locator("[data-schema-entry='.backgrounds.salon'] summary").click()
    return desktop


def run(page, body: str):
    return page.evaluate(f"async () => {{ const f = await import('{MODULE}'); {body} }}")


def test_what_a_background_is(desktop) -> None:  # noqa: F811
    result = run(desktop, """return [f.readBackground('#ABC'), f.readBackground('/local/a.jpg'), f.readBackground(''),
        f.readBackground('linear-gradient(170deg, #3b4a6e 0%, #252d45 55%, #1b2033 100%)'),
        f.readBackground('linear-gradient(#fff, #eee)'), f.readBackground('radial-gradient(red, blue)'),
        f.gradientValue(90, [{ colour: '#000000', at: 0 }, { colour: '#ffffff', at: 100 }])];""")
    assert result[0] == {"kind": "solid", "colour": "#aabbcc"}
    assert [result[1]["kind"], result[2]["kind"], result[5]["kind"]] == ["picture", "empty", "other"]
    assert result[3] == {"kind": "gradient", "angle": 170, "stops": [
        {"colour": "#3b4a6e", "at": 0}, {"colour": "#252d45", "at": 55}, {"colour": "#1b2033", "at": 100}]}
    assert result[4]["stops"] == [{"colour": "#ffffff", "at": 0}, {"colour": "#eeeeee", "at": 100}]
    assert result[6] == "linear-gradient(90deg, #000000 0%, #ffffff 100%)"


def test_a_picture_has_a_magnifier_and_a_colour_its_sample(look) -> None:
    assert slot(look, "light").locator("[data-bg-peek]").count() == 1
    assert slot(look, "dark").locator("[data-bg-sample]").count() == 1
    assert "linear-gradient" in slot(look, "dark").locator("[data-bg-sample]").get_attribute("style")
    slot(look, "light").locator("[data-bg-peek]").click()
    viewer = slot(look, "light").locator("[data-bg-viewer]")
    assert viewer.locator("img").get_attribute("src").endswith("/local/backgrounds/salon.jpg")
    viewer.locator("[data-bg-viewer-close]").click()
    assert viewer.count() == 0


def test_a_picture_in_home_assistant_is_chosen_in_the_window(look) -> None:
    field = slot(look, "light_wide")
    field.locator("[data-bg-open]").click()
    dialog = field.locator("[data-bg-dialog]")
    dialog.locator("[data-bg-uploads] [data-bg-file]").first.wait_for()
    # newest sent first, then the folder
    assert [tile.get_attribute("data-bg-file") for tile in dialog.locator("[data-bg-uploads] [data-bg-file]").all()] == [
        "/api/image/serve/new/original", "/api/image/serve/old/original"]
    assert dialog.locator("[data-bg-www] [data-bg-file]").count() == 2
    dialog.locator("[data-bg-file='/local/kuchnia.png'] .pick").click()
    assert draft(look)["backgrounds"]["salon"]["light_wide"] == "/local/kuchnia.png"
    assert field.locator("[data-bg-dialog]").count() == 0


def test_a_tile_of_the_window_opens_its_picture_big(look) -> None:
    field = slot(look, "light_wide")
    field.locator("[data-bg-open]").click()
    field.locator("[data-bg-file='/local/kuchnia.png'] [data-bg-file-peek]").click()
    assert field.locator("[data-bg-viewer] img").get_attribute("src").endswith("/local/kuchnia.png")


def test_the_folder_waits_for_a_restart(look) -> None:
    look.evaluate("() => { window.editor.server.state.pictures = null; }")
    field = slot(look, "light_wide")
    field.locator("[data-bg-open]").click()
    field.locator("[data-bg-restart]").wait_for()
    assert field.locator("[data-bg-uploads] [data-bg-file]").count() == 2


def test_a_picture_from_the_computer_is_sent_and_used(look) -> None:
    field = slot(look, "dark_wide")
    field.locator("[data-bg-open]").click()
    field.locator("[data-bg-upload]").set_input_files({"name": "tlo.png", "mimeType": "image/png", "buffer": b"\x89PNG"})
    look.wait_for_function("() => window.uploads.length === 1")
    look.wait_for_function("() => window.editor.app._strategy.backgrounds.salon.dark_wide === '/api/image/serve/sent/original'")


def test_a_gradient_opens_on_its_colours_and_changes_on_the_palette(look) -> None:
    field = slot(look, "dark")
    field.locator("[data-bg-open]").click()
    dialog = field.locator("[data-bg-dialog]")
    assert dialog.locator("[data-bg-tab='colour']").get_attribute("class") == "on"
    assert dialog.locator("[data-bg-stop]").count() == 3
    assert dialog.locator("[data-bg-angle='170']").get_attribute("class") == "on"
    dialog.locator("[data-bg-angle='90']").click()
    assert "90deg" in dialog.locator("[data-bg-preview]").get_attribute("style")
    dialog.locator("[data-bg-preset='#0f2027,#2c5364']").click()
    dialog.locator("[data-bg-use]").click()
    assert draft(look)["backgrounds"]["salon"]["dark"] == "linear-gradient(90deg, #0f2027 0%, #2c5364 100%)"


def test_one_colour_from_the_palette(look) -> None:
    field = slot(look, "light_wide")
    field.locator("[data-bg-open]").click()
    dialog = field.locator("[data-bg-dialog]")
    dialog.locator("[data-bg-tab='colour']").click()
    dialog.locator("[data-bg-kind='solid']").click()
    dialog.locator("[data-bg-swatch='#2193b0']").click()
    dialog.locator("[data-bg-use]").click()
    assert draft(look)["backgrounds"]["salon"]["light_wide"] == "#2193b0"


def test_cancel_changes_nothing(look) -> None:
    field = slot(look, "dark")
    field.locator("[data-bg-open]").click()
    field.locator("[data-bg-angle='90']").click()
    field.locator("[data-bg-cancel]").click()
    assert draft(look)["backgrounds"]["salon"]["dark"].startswith("linear-gradient(170deg")


def test_any_text_holding_a_picture_has_a_magnifier(desktop) -> None:  # noqa: F811
    open_editor(desktop, LOOK)
    found = desktop.evaluate("""async () => {
        await import('/custom_components/home_dashboard/www/editor/schema-form.js');
        const form = document.createElement('home-dashboard-editor-schema');
        form.hass = window.editor.app.hass;
        form.fields = [{ key: 'picture', type: 'text' }, { key: 'name', type: 'text' }];
        form.value = { picture: '/local/a.png', name: 'Salon' };
        form.path = [];
        document.body.append(form);
        for (let tries = 0; tries < 100 && !form.shadowRoot?.querySelector('[data-schema-field]'); tries += 1)
            await new Promise((done) => setTimeout(done, 50));
        return [...form.shadowRoot.querySelectorAll('home-dashboard-picture-peek')].map((peek) => peek.src);
    }""")
    assert found == ["/local/a.png"]
