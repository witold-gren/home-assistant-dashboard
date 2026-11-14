"""The background maker: a gradient, a pattern drawn by code and a photo if wanted, made upright and wide, sent to
Home Assistant as two pictures and put in the slots of the look chosen; on the tablet in the window Background of this
screen, on a computer in the backgrounds of pages."""

from __future__ import annotations

import pytest

from .test_editor_app import APP, desktop, open_editor, select  # noqa: F401
from .test_shortcuts import mount_admin, open_background, save_background, shared_saves

MAKER = "home-dashboard-background-maker"
MODULES = """
    const maker = await import('/custom_components/home_dashboard/www/app/background-maker.js');
    const motifs = await import('/custom_components/home_dashboard/www/app/background-motifs.js');
"""


def run(page, body: str, arg=None):
    return page.evaluate(f"async (arg) => {{ {MODULES} {body} }}", arg)


def test_colours_mix_and_numbers_repeat_for_a_seed(desktop) -> None:  # noqa: F811
    result = run(desktop, """
        const first = motifs.randomOf(5), again = motifs.randomOf(5), other = motifs.randomOf(6);
        const a = [first(), first()], b = [again(), again()], c = [other(), other()];
        return { mix: motifs.mix('#000000', '#ffffff', 0.5), rgb: motifs.rgbOf('#abc'),
                 same: a[0] === b[0] && a[1] === b[1], differ: a[0] !== c[0],
                 light: [motifs.lightness('#000000'), motifs.lightness('#ffffff')] };
    """)
    assert result == {"mix": "#808080", "rgb": [170, 187, 204], "same": True, "differ": True, "light": [0, 1]}


def test_the_geometry_of_a_gradient_and_of_a_covering_photo(desktop) -> None:  # noqa: F811
    result = run(desktop, """
        return { down: maker.gradientLine(100, 200, 180).map(Math.round),
                 side: maker.gradientLine(100, 200, 90).map(Math.round),
                 top: maker.coverRect(100, 200, 400, 400, 'top'), bottom: maker.coverRect(200, 100, 100, 100, 'bottom') };
    """)
    assert result["down"] == [50, 0, 50, 200]
    assert result["side"] == [0, 100, 100, 100]
    assert result["top"] == [-50, 0, 200, 200]
    assert result["bottom"] == [0, -100, 200, 200]


def test_a_recipe_is_brought_back_into_range(desktop) -> None:  # noqa: F811
    recipe = run(desktop, "return maker.recipeOf({ opacity: 4, grey: -1, blur: 'x', blend: 'odd', motif: 'nope', focus: 'side', seed: 2.5 });")
    assert (recipe["opacity"], recipe["grey"], recipe["blur"], recipe["blend"], recipe["motif"], recipe["focus"], recipe["seed"]) == (
        1, 0, 0, "normal", "", "center", 7)


def test_made_pictures_fill_the_slots_of_the_look(desktop) -> None:  # noqa: F811
    slots = run(desktop, "return [maker.madeSlots('dark', 't', 'w'), maker.madeSlots('both', 't', 'w')];")
    assert slots[0] == {"dark": "t", "dark_wide": "w"}
    assert slots[1] == {"light": "t", "light_wide": "w", "dark": "t", "dark_wide": "w"}


def test_there_are_dozens_of_gradients_and_a_ready_background_for_every_pattern(desktop) -> None:  # noqa: F811
    result = run(desktop, """
        return { groups: Object.keys(maker.MAKER_PALETTES), presets: maker.MAKER_PRESETS.length,
                 ready: motifs.READY_BACKGROUNDS.map((item) => item.motif), names: motifs.MOTIF_NAMES };
    """)
    assert result["groups"] == ["calm", "cool", "warm", "nature", "pastel", "night"]
    assert result["presets"] == 48
    assert sorted(result["ready"]) == sorted(result["names"]) and len(result["names"]) == 16


def test_every_pattern_draws_something_and_the_same_again_for_its_seed(desktop) -> None:  # noqa: F811
    result = run(desktop, """
        const pixels = (recipe) => {
            const canvas = document.createElement('canvas'); canvas.width = 60; canvas.height = 130;
            maker.drawBackground(canvas, recipe);
            return Array.from(canvas.getContext('2d').getImageData(0, 0, 60, 130).data);
        };
        const differ = (a, b) => a.some((value, at) => Math.abs(value - b[at]) > 2);
        const base = { top: '#1d3b53', bottom: '#7fa7c9' };
        const plain = pixels(base);
        return motifs.MOTIF_NAMES.map((motif) => {
            const one = pixels({ ...base, motif, seed: 3 });
            return [motif, differ(one, plain), !differ(one, pixels({ ...base, motif, seed: 3 }))];
        }).filter(([, drawn, same]) => !drawn || !same).map(([motif]) => motif);
    """)
    assert result == []


def test_a_photo_seen_at_nothing_leaves_the_gradient(desktop) -> None:  # noqa: F811
    result = run(desktop, """
        const source = document.createElement('canvas'); source.width = 40; source.height = 40;
        const context = source.getContext('2d'); context.fillStyle = '#ff0000'; context.fillRect(0, 0, 40, 40);
        const image = new Image(); image.src = source.toDataURL(); await image.decode();
        const pixel = (recipe, photo) => {
            const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 40;
            maker.drawBackground(canvas, recipe, photo);
            return Array.from(canvas.getContext('2d').getImageData(10, 5, 1, 1).data);
        };
        const base = { top: '#0000ff', bottom: '#0000ff', grey: 0, fade: 0 };
        return { hidden: pixel({ ...base, opacity: 0 }, image), shown: pixel({ ...base, opacity: 1 }, image),
                 grey: pixel({ ...base, opacity: 1, grey: 1 }, image) };
    """)
    assert result["hidden"][:3] == [0, 0, 255]
    assert result["shown"][:3] == [255, 0, 0]
    assert result["grey"][0] == result["grey"][1] == result["grey"][2]


# On the tablet: the window Background of this screen opens the maker and keeps what it makes until saved.


def test_the_tablet_makes_a_background_and_saves_it_for_everyone(phone):
    mount_admin(phone, {"favorites": []})
    open_background(phone)
    phone.locator("[data-background-maker]").click()
    maker = phone.locator(MAKER)
    maker.locator("[data-maker-ready='1']").click()
    assert maker.locator("[data-maker-choices='motif'] .on").get_attribute("data-maker-choice") == "mountains"
    maker.locator("[data-maker-choices='look'] [data-maker-choice='both']").click()
    maker.locator("[data-maker-use]").click()
    phone.wait_for_selector("[data-background-save]")
    assert phone.evaluate("window.uploads") == ["/api/image/upload", "/api/image/upload"]
    save_background(phone)
    phone.wait_for_function("window.saved.some((message) => message.type === 'lovelace/config/save')")
    shared = shared_saves(phone)[0]["config"]["strategy"]["backgrounds"]["home"]
    picture = "/api/image/serve/abc/original"
    assert shared == {"light": picture, "light_wide": picture, "dark": picture, "dark_wide": picture}


def test_a_failed_upload_keeps_the_maker_open_and_says_so(phone):
    mount_admin(phone, {"favorites": []})
    phone.evaluate("window.uploadFails = true")
    open_background(phone)
    phone.locator("[data-background-maker]").click()
    maker = phone.locator(MAKER)
    maker.locator("[data-maker-use]").click()
    maker.locator("[data-maker-problem]").wait_for()
    assert phone.locator("[data-background-save]").count() == 0


def test_cancel_goes_back_to_the_window_without_changes(phone):
    mount_admin(phone, {"favorites": []})
    open_background(phone)
    phone.locator("[data-background-maker]").click()
    phone.locator(MAKER).locator("[data-maker-cancel]").click()
    phone.wait_for_selector("[data-background-save]")
    assert phone.evaluate("window.uploads") == []


def test_the_recipe_is_remembered_for_the_next_time(phone):
    mount_admin(phone, {"favorites": []})
    open_background(phone)
    phone.locator("[data-background-maker]").click()
    phone.locator(MAKER).locator("[data-maker-preset='#ff7e5f,#feb47b']").click()
    phone.locator(MAKER).locator("[data-maker-swap]").click()
    stored = phone.evaluate("JSON.parse(localStorage.getItem('home-dashboard-background-maker'))")
    assert (stored["top"], stored["bottom"]) == ("#feb47b", "#ff7e5f")


# On a computer: an entry of the backgrounds of pages has the maker, wide, over the editor.

LOOK = {
    "type": "custom:home-dashboard",
    "layout": [{"id": "salon", "name": "Salon", "sections": []}],
    "backgrounds": {"salon": "#223344"},
}


@pytest.fixture
def look(desktop):  # noqa: F811
    desktop.evaluate("() => localStorage.clear()")
    open_editor(desktop, LOOK)
    desktop.evaluate("""() => { window.uploads = []; window.editor.app.hass.fetchWithAuth = async (url) => {
        window.uploads.push(url); return { ok: true, json: async () => ({ id: `p${window.uploads.length}` }) }; }; }""")
    select(desktop, "appearance")
    desktop.locator(f"{APP} [data-form='setting-appearance'] [data-schema-form]").first.wait_for()
    part = desktop.locator(f"{APP} [data-settings-section='themes']")
    part.locator("summary").first.click()
    part.locator("[data-schema-entry='.backgrounds.salon'] summary").click()
    return desktop


def test_the_editor_makes_the_light_background_of_a_room(look) -> None:
    look.locator(f"{APP} [data-schema-maker='.backgrounds.salon']").click()
    dialog = look.locator(f"{APP} [data-schema-maker-dialog]")
    assert "Salon" in dialog.locator("h3").inner_text()
    maker = dialog.locator(MAKER)
    assert maker.get_attribute("layout") == "wide"
    assert maker.locator("canvas[data-maker-preview]").count() == 2
    maker.locator("[data-maker-choices='motif'] [data-maker-choice='waves']").click()
    maker.locator("[data-maker-use]").click()
    # Two full-size pictures are drawn and encoded first, which takes a while on a busy machine.
    look.wait_for_function("window.uploads.length === 2", timeout=90_000)
    dialog.wait_for(state="detached", timeout=90_000)
    strategy = look.evaluate("window.editor.app._strategy")
    assert strategy["backgrounds"]["salon"] == {
        "light": "/api/image/serve/p1/original",
        "light_wide": "/api/image/serve/p2/original",
        "dark": "#223344",
    }


def test_the_editor_maker_closes_without_a_change(look) -> None:
    look.locator(f"{APP} [data-schema-maker='.backgrounds.salon']").click()
    look.locator(f"{APP} [data-schema-maker-dialog] {MAKER} [data-maker-cancel]").click()
    assert look.locator(f"{APP} [data-schema-maker-dialog]").count() == 0
    assert look.evaluate("window.editor.app._strategy")["backgrounds"] == {"salon": "#223344"}
