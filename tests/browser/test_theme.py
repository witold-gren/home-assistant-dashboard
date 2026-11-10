"""A theme: the shared look with its backgrounds in one file, exported and imported into another home."""

from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import expect

from .test_panels import add_entity
from .test_shortcuts import SHEET, mount_admin

THEME = "/custom_components/home_dashboard/www/app/theme.js"
PICTURE = "/custom_components/home_dashboard/brand/icon.png"
PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
ROOM = {"id": "salon", "name": "Salon", "areas": [], "home": [], "sections": []}


def run(page, body: str, arg=None):
    return page.evaluate(f"async (arg) => {{ const t = await import('{THEME}'); {body} }}", arg)


def theme_file(backgrounds: dict, appearance: dict | None = None) -> dict:
    return {"home_dashboard_theme": 1, "appearance": appearance or {}, "backgrounds": backgrounds}


def test_an_export_carries_the_pictures_inside(phone):
    theme = run(phone, """return t.buildTheme(arg.raw, { home: "Strona główna" },
        async (url) => (await fetch(url)).blob());""", {"raw": {
            "appearance": {"tiles": {"radius": 30}},
            "backgrounds": {"home": {"light": PICTURE, "dark": "#121316", "position": "top"}},
        }})
    home = theme["backgrounds"]["home"]
    assert theme["home_dashboard_theme"] == 1
    assert theme["appearance"] == {"tiles": {"radius": 30}}
    assert home["name"] == "Strona główna"
    assert home["light"].startswith("data:image/png;base64,")
    assert home["dark"] == "#121316"
    assert home["position"] == "top"


def test_a_picture_that_cannot_be_read_is_left_out(phone):
    theme = run(phone, """return t.buildTheme(arg, {}, async () => null);""",
                {"backgrounds": {"r": {"light": "/local/missing.jpg"}, "s": {"light": "#000000"}}})
    assert list(theme["backgrounds"]) == ["s"]


def test_an_import_keeps_only_what_a_theme_may_carry(phone):
    text = json.dumps(theme_file({
        "a": {"name": "A", "light": PIXEL, "dark": "https://example.com/x.jpg", "position": "left"},
        "b": {"name": "B", "light": "url(https://example.com/x.jpg)"},
        "c": {"name": "C", "light": "linear-gradient(#000, #fff)"},
    }))
    theme = run(phone, "return t.parseTheme(arg);", text)
    assert theme["backgrounds"] == {"a": {"name": "A", "light": PIXEL}, "c": {"name": "C", "light": "linear-gradient(#000, #fff)"}}
    assert run(phone, "return [t.parseTheme('nope'), t.parseTheme('{\"home_dashboard_theme\": 9}')];") == [None, None]


def test_backgrounds_go_to_the_same_page_or_a_room_of_the_same_name(phone):
    targets = run(phone, """return t.suggestTargets({ backgrounds: {
        home: { name: 'Home' }, living_room: { name: 'Salon' }, garage: { name: 'Garaż' }, x: { name: 'Łazienka' } } },
        [{ id: 'home', name: 'Strona główna' }, { id: 'salon', name: 'salon' }, { id: 'bath', name: 'Lazienka' }]);""")
    assert targets == {"home": "home", "living_room": "salon", "garage": None, "x": "bath"}


def test_an_imported_theme_gets_its_pictures_uploaded_and_its_pages_chosen(phone):
    result = run(phone, """const uploads = [];
        const theme = { appearance: { tiles: { radius: 8 }, icons: { 'light.here': 'mdi:led-strip', 'light.elsewhere': 'mdi:lamp' } },
                        backgrounds: { living_room: { name: 'Salon', light: arg, dark: '#000000', position: 'top' }, garage: { name: 'Garaż', light: arg } } };
        const entry = await t.materializeTheme(theme, 'Zima', { living_room: 'salon', garage: null },
            async (blob, name) => { uploads.push([blob.type, name]); return '/api/image/serve/1/original'; },
            (id) => id === 'light.here');
        return { entry, uploads };""", PIXEL)
    entry = result["entry"]
    assert result["uploads"] == [["image/png", "salon_light"]]
    assert entry["id"].startswith("zima_")
    assert entry["name"] == "Zima"
    assert entry["appearance"] == {"tiles": {"radius": 8}, "icons": {"light.here": "mdi:led-strip"}}
    assert entry["backgrounds"] == {"salon": {"light": "/api/image/serve/1/original", "dark": "#000000", "position": "top"}}


WINTER = {"id": "winter", "name": "Zima", "appearance": {"tiles": {"radius": 8}}, "backgrounds": {"home": {"light": "#ffffff"}}}


def test_using_a_theme_replaces_the_look_and_its_pages_and_keeps_an_unsaved_look(phone):
    raw = run(phone, "return t.useTheme(arg.raw, arg.theme, 'Mój wygląd');", {
        "raw": {"title": "x", "appearance": {"tiles": {"radius": 12}}, "backgrounds": {"kitchen": {"light": "#111111"}},
                "themes": [WINTER]},
        "theme": WINTER,
    })
    assert raw["appearance"] == {"tiles": {"radius": 8}}
    # The theme sets the pages it has; the kitchen keeps its own background.
    assert raw["backgrounds"] == {"kitchen": {"light": "#111111"}, "home": {"light": "#ffffff"}}
    assert raw["theme"] == "winter"
    kept = raw["themes"][1]
    assert [kept["name"], kept["appearance"], kept["backgrounds"]] == ["Mój wygląd", {"tiles": {"radius": 12}},
                                                                     {"kitchen": {"light": "#111111"}}]


def test_a_look_already_in_the_library_is_not_kept_twice(phone):
    themes = run(phone, "return t.useTheme(arg.raw, null, 'Mój wygląd').themes.length;", {
        "raw": {"appearance": WINTER["appearance"], "backgrounds": WINTER["backgrounds"], "theme": "winter", "themes": [WINTER]},
    })
    assert themes == 1


def test_the_plain_look_has_nothing_of_a_theme_but_keeps_the_pages(phone):
    raw = run(phone, "return t.useTheme(arg, null, 'x');", {"title": "x", "appearance": WINTER["appearance"],
                                                          "backgrounds": WINTER["backgrounds"], "theme": "winter", "themes": [WINTER]})
    assert raw == {"title": "x", "backgrounds": WINTER["backgrounds"], "themes": [WINTER]}


def test_a_theme_knows_when_it_was_changed(phone):
    result = run(phone, """const raw = { appearance: arg.appearance, backgrounds: arg.backgrounds, theme: 'winter', themes: [arg] };
        return [t.themeChanged(raw), t.themeChanged({ ...raw, appearance: { bounce: false } }), t.themeChanged({})];""", WINTER)
    assert result == [False, True, False]


def test_removing_the_theme_in_use_keeps_the_look(phone):
    raw = run(phone, "return t.removeTheme(arg, 'winter');", {"appearance": {"bounce": False}, "theme": "winter", "themes": [WINTER]})
    assert raw == {"appearance": {"bounce": False}, "themes": []}


# The sheet ----------------------------------------------------------------------------------------

def open_look(page, dashboard: dict, admin: bool = True) -> None:
    mount_admin(page, dashboard, admin=admin)
    page.locator("home-dashboard-page [data-menu]").click()
    page.locator("[data-drawer] [data-look]").click()


def test_only_the_look_for_everyone_offers_themes(phone):
    open_look(phone, {}, admin=False)
    assert phone.locator(f"{SHEET} [data-tab='themes']").count() == 0
    assert phone.locator(f"{SHEET} [data-look-everyone]").count() == 0


def open_themes(page, dashboard: dict) -> None:
    open_look(page, dashboard)
    page.locator(f"{SHEET} [data-tab='themes']").click()


def test_an_administrator_exports_the_current_look_as_a_file(phone):
    open_themes(phone, {"appearance": {"background_strength": 70}, "backgrounds": {"home": {"light": "#123456"}}})
    phone.locator(f"{SHEET} [data-theme-name]").fill("Jesień")
    with phone.expect_download() as download:
        phone.locator(f"{SHEET} [data-theme-export]").click()
    saved = json.loads(Path(download.value.path()).read_text())
    assert download.value.suggested_filename == "jesien.home-dashboard-theme.json"
    assert saved["name"] == "Jesień"
    assert saved["appearance"] == {"background_strength": 70}
    assert saved["backgrounds"]["home"]["light"] == "#123456"


def test_an_administrator_imports_a_theme_and_chooses_where_backgrounds_go(phone, tmp_path):
    add_entity(phone, "light.strip", "on", {"friendly_name": "Taśma"})
    theme = theme_file(
        {"living_room": {"name": "Salon", "light": PIXEL}, "garage": {"name": "Garaż", "light": "#333333"}},
        {"tiles": {"fill": "icon"}, "icons": {"light.strip": "mdi:led-strip", "light.other": "mdi:lamp"}},
    )
    path = tmp_path / "theme.json"
    path.write_text(json.dumps(theme))
    open_themes(phone, {"layout": [ROOM]})
    phone.locator(f"{SHEET} [data-theme-import] input").set_input_files(str(path))
    expect(phone.locator(f"{SHEET} [data-theme-name]")).to_have_value("theme")
    assert phone.locator(f"{SHEET} [data-theme-icons]").inner_text().startswith("Własne ikony: 1 z 2")
    # The room of the same name is chosen already; the garage waits for a choice.
    assert phone.locator(f"{SHEET} [data-theme-background='living_room'] select").input_value() == "salon"
    assert phone.locator(f"{SHEET} [data-theme-background='garage'] select").input_value() == ""
    phone.locator(f"{SHEET} [data-theme-background='garage'] select").select_option("home")
    phone.locator(f"{SHEET} [data-theme-save]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'lovelace/config/save')")
    strategy = phone.evaluate("window.saved.find((m) => m.type === 'lovelace/config/save').config.strategy")
    assert strategy["appearance"] == {"tiles": {"fill": "icon"}, "icons": {"light.strip": "mdi:led-strip"}}
    assert strategy["backgrounds"] == {"salon": {"light": "/api/image/serve/abc/original"}, "home": {"light": "#333333"}}
    assert [theme["name"] for theme in strategy["themes"]] == ["theme"]
    assert strategy["theme"] == strategy["themes"][0]["id"]
    assert phone.evaluate("window.uploads") == ["/api/image/upload"]


def test_a_file_that_is_not_a_theme_is_refused(phone, tmp_path):
    path = tmp_path / "other.json"
    path.write_text('{"title": "x"}')
    open_themes(phone, {})
    phone.locator(f"{SHEET} [data-theme-import] input").set_input_files(str(path))
    assert phone.locator(f"{SHEET} [data-theme-problem]").inner_text() == "Ten plik nie jest motywem Home Dashboard."


def library_saved(page) -> dict:
    page.wait_for_function("window.saved.some((m) => m.type === 'lovelace/config/save')")
    return page.evaluate("window.saved.find((m) => m.type === 'lovelace/config/save').config.strategy")


def test_a_theme_of_the_library_is_used(phone):
    open_themes(phone, {"themes": [WINTER]})
    phone.locator(f"{SHEET} [data-theme='winter'] [data-theme-action='use']").click()
    strategy = library_saved(phone)
    assert strategy["theme"] == "winter"
    assert strategy["appearance"] == WINTER["appearance"]


def test_a_changed_theme_goes_back_to_how_it_was(phone):
    open_themes(phone, {"themes": [WINTER], "theme": "winter", "appearance": {"tiles": {"radius": 30}},
                        "backgrounds": WINTER["backgrounds"]})
    assert "zmieniony" in phone.locator(f"{SHEET} [data-theme-active]").inner_text()
    phone.locator(f"{SHEET} [data-theme-reset]").click()
    assert library_saved(phone)["appearance"] == WINTER["appearance"]


def test_the_current_look_is_kept_as_a_new_theme(phone):
    open_themes(phone, {"appearance": {"bounce": False}})
    phone.locator(f"{SHEET} [data-theme-name]").fill("Mój")
    phone.locator(f"{SHEET} [data-theme-save-current]").click()
    strategy = library_saved(phone)
    assert [(theme["name"], theme["appearance"]) for theme in strategy["themes"]] == [("Mój", {"bounce": False})]
    assert strategy["theme"] == strategy["themes"][0]["id"]


def test_a_theme_is_deleted_from_the_library(phone):
    open_themes(phone, {"themes": [WINTER]})
    phone.locator(f"{SHEET} [data-theme='winter'] [data-theme-action='delete']").click()
    assert library_saved(phone)["themes"] == []


# Themes that come with Home Dashboard ------------------------------------------------------------------

def test_two_themes_come_with_home_dashboard(phone):
    library = run(phone, "return t.themeLibrary({}).map((theme) => [theme.id, theme.name, theme.builtin, theme.own]);")
    assert library == [["home_dashboard", "Home Dashboard", True, False], ["apple_home", "Apple Home", True, False]]


def test_a_theme_that_came_carries_no_pictures(phone):
    looks = phone.evaluate("""async () => {
        const { BUILTIN_THEMES } = await import('/custom_components/home_dashboard/www/app/builtin-themes.js');
        const a = await import('/custom_components/home_dashboard/www/app/appearance.js');
        // Every value of a built-in theme survives the checks of the look, so none is lost on the way.
        return BUILTIN_THEMES.map((theme) => [JSON.stringify(theme).includes('url('), theme.backgrounds,
            theme.appearance, a.appearanceDiff(a.mergeAppearance(theme.appearance))]);
    }""")
    for pictures, backgrounds, appearance, kept in looks:
        assert pictures is False
        # Backgrounds of a theme that came are colours or gradients only.
        assert all(not value.startswith(("/", "http", "data:")) for page in backgrounds.values() for value in page.values())
        assert kept == appearance


def test_this_home_keeps_its_own_version_of_a_theme_that_came(phone):
    result = run(phone, """let raw = { appearance: { tiles: { radius: 8 } }, backgrounds: { home: { light: '#123456' } }, theme: 'apple_home' };
        const before = t.themeChanged(raw);
        raw = t.saveIntoTheme(raw, t.activeTheme(raw));
        const entry = t.themeLibrary(raw).find((theme) => theme.id === 'apple_home');
        const restored = t.removeTheme(raw, 'apple_home');
        return { before, after: t.themeChanged(raw), entry: [entry.name, entry.own, entry.appearance, entry.backgrounds],
                 count: t.themeLibrary(raw).length, restored: [restored.theme, t.activeTheme(restored).own] };""")
    assert result["before"] is True
    assert result["after"] is False
    assert result["entry"] == ["Apple Home", True, {"tiles": {"radius": 8}}, {"home": {"light": "#123456"}}]
    assert result["count"] == 2
    assert result["restored"] == ["apple_home", False]


def test_a_theme_that_came_is_restored_not_deleted(phone):
    open_themes(phone, {"themes": [{"id": "apple_home", "name": "Apple Home", "appearance": {}, "backgrounds": {}}]})
    assert phone.locator(f"{SHEET} [data-theme='home_dashboard'] [data-theme-action='delete']").count() == 0
    assert phone.locator(f"{SHEET} [data-theme='home_dashboard'] [data-theme-action='restore']").count() == 0
    phone.locator(f"{SHEET} [data-theme='apple_home'] [data-theme-action='restore']").click()
    assert library_saved(phone)["themes"] == []


def test_changes_are_saved_into_the_theme_in_use(phone):
    open_themes(phone, {"theme": "apple_home", "appearance": {"tiles": {"radius": 30}}})
    phone.locator(f"{SHEET} [data-theme-update]").click()
    strategy = library_saved(phone)
    assert strategy["theme"] == "apple_home"
    assert strategy["themes"] == [{"id": "apple_home", "name": "Apple Home", "appearance": {"tiles": {"radius": 30}}, "backgrounds": {}}]
