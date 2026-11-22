"""Variants of a page on the phone and the tablet: a device or person sees its own variant of Home or of a room
(with its background), the rest of the dashboard stays published; a look for this visit only; changes made on a
page with a variant go to the variant; an administrator picks, looks at and publishes a variant from the menu."""

from __future__ import annotations

import json
from pathlib import Path

from .test_layout import first_area, open_room
from .test_page import mount
from .test_shortcuts import SHEET, mount_admin

PAGE = "home-dashboard-page"
CHROME = "home-dashboard-chrome"
VARIANTS = "/custom_components/home_dashboard/www/app/variants.js"
CASES = json.loads((Path(__file__).parents[1] / "fixtures" / "variant_slices.json").read_text())
SECTIONS_HOME = {
    "page_layout": {"home": "sections", "rows": 4},
    "background": {"light": "/local/v.jpg", "dark": "/local/v.jpg"},
}


def variants(page, script: str, *args):
    return page.evaluate(
        f"async (args) => {{ const m = await import('{VARIANTS}'); return ({script})(m, ...args); }}",
        list(args),
    )


def home_slice(page, **changes) -> dict:
    part = variants(page, "(m) => m.sliceOf({}, 'home')")
    for key, value in changes.items():
        part[key] = value
    return part


def with_variants(dashboard: dict, pages: dict | None = None, choices: dict | None = None) -> dict:
    return {
        **dashboard,
        "_variants": {"device": "token-1", "device_name": None, "pages": pages or {}, "choices": choices},
    }


def item(variant_id: str, name: str, part: dict, devices=(), people=()) -> dict:
    return {"id": variant_id, "name": name, "slice": part, "devices": list(devices), "people": list(people)}


# The slices agree with the server's -------------------------------------------------------------------


def test_slices_are_the_same_as_on_the_server(phone):
    mount(phone)
    live = CASES["live"]
    assert variants(phone, "(m, c) => m.sliceOf(c, 'home')", live) == CASES["slice_home"]
    assert variants(phone, "(m, c) => m.sliceOf(c, 'room:living')", live) == CASES["slice_living"]
    assert variants(phone, "(m, c) => m.sliceOf(c, 'room:bedroom')", live) == CASES["slice_bedroom"]
    assert variants(phone, "(m, c) => m.sliceOf(c, 'room:gone')", live) is None
    assert (
        variants(phone, "(m, c, v) => m.withSlice(c, 'home', v)", live, CASES["variant_home"])
        == CASES["with_home"]
    )
    assert (
        variants(phone, "(m, c, v) => m.withSlice(c, 'room:living', v)", live, CASES["variant_living"])
        == CASES["with_living"]
    )
    assert (
        variants(phone, "(m, c, v) => m.withSlice(c, 'room:gone', v)", live, CASES["variant_living"])
        == CASES["with_gone"]
    )
    assert (
        variants(phone, "(m, c) => m.withSlice(c, 'home', m.sliceOf(c, 'home'))", live)
        == CASES["round_trip_home"]
    )


def test_page_keys_and_which_variant_a_page_shows(phone):
    mount(phone)
    assert variants(
        phone,
        "(m) => [m.pageKey('home'), m.pageKey('room', 'a'), m.pageKey('room', '__scenes'), m.pageKey('energy')]",
    ) == [
        "home",
        "room:a",
        None,
        None,
    ]
    raw = with_variants(
        {},
        pages={"home": {"id": "own", "name": "Own", "slice": {}}},
        choices={"home": {"live_name": None, "items": [item("other", "Other", {})]}},
    )
    assert variants(phone, "(m, raw) => m.shownVariant(raw, 'home', {})", raw)["id"] == "own"
    assert variants(phone, "(m, raw) => m.shownVariant(raw, 'home', { home: 'other' })", raw)["peek"] is True
    assert variants(phone, "(m, raw) => m.shownVariant(raw, 'home', { home: 'live' })", raw) is None
    assert variants(phone, "(m, raw) => m.shownVariant(raw, 'room:a', {})", raw) is None


def test_a_change_on_a_variant_goes_to_the_variant_and_the_rest_to_the_published_page(phone):
    mount(phone)
    live = CASES["live"]
    shown = variants(phone, "(m, c, v) => m.withSlice(c, 'room:living', v)", live, CASES["variant_living"])
    changed = {**shown, "menu": [{"path": "/energy"}]}
    changed["layout"] = [{**changed["layout"][0], "name": "Salon 2"}, changed["layout"][1]]
    split = variants(phone, "(m, changed, live) => m.splitSave(changed, live, 'room:living')", changed, live)
    assert split["part"]["room"]["name"] == "Salon 2"
    assert split["live"]["layout"][0]["name"] == "Living room"
    assert split["live"]["menu"] == [{"path": "/energy"}]


# What a device sees -----------------------------------------------------------------------------------


def test_a_home_variant_shows_its_layout_and_background(tablet):
    mount(
        tablet,
        with_variants(
            {}, pages={"home": {"id": "v", "name": "Sekcje", "slice": home_slice(tablet, **SECTIONS_HOME)}}
        ),
    )
    tablet.wait_for_selector(f"{PAGE} .page.sections-view")
    background = tablet.evaluate(
        f"() => JSON.stringify(document.querySelector('{CHROME}').pageBackground ?? '')"
    )
    assert "/local/v.jpg" in background


def test_without_a_variant_the_published_page_shows(tablet):
    mount(tablet, with_variants({}, pages={}))
    assert tablet.locator(f"{PAGE} .page.sections-view").count() == 0
    assert tablet.locator("[data-variant-peek]").count() == 0


def test_a_room_variant_shows_only_in_that_room(phone):
    area = first_area(phone)
    room = {"id": area, "name": "Published", "areas": [area]}
    part = {"room": {**room, "name": "Variant"}, "background": None}
    dashboard = with_variants(
        {"layout": [room]}, pages={f"room:{area}": {"id": "v", "name": "B", "slice": part}}
    )
    open_room(phone, dashboard, area)
    phone.wait_for_function(f"document.querySelector('{PAGE}').shadowRoot.textContent.includes('Variant')")
    assert phone.evaluate(f"() => document.querySelector('{CHROME}').raw._variant.id") == "v"


def test_a_look_says_so_and_goes_back(phone):
    choices = {
        "home": {"live_name": "Klasyczna", "items": [item("v", "Sekcje", home_slice(phone, **SECTIONS_HOME))]}
    }
    phone.evaluate("sessionStorage.setItem('home-dashboard-variant-peek', JSON.stringify({ home: 'v' }))")
    mount_admin(phone, with_variants({}, choices=choices))
    banner = phone.locator("[data-variant-peek]")
    banner.wait_for()
    assert "Sekcje" in banner.inner_text()
    phone.locator("[data-variant-peek-leave]").click()
    assert phone.evaluate("sessionStorage.getItem('home-dashboard-variant-peek')") == "{}"


# Saving on a page with a variant -----------------------------------------------------------------------


def test_saving_a_room_on_a_variant_keeps_the_published_room(phone):
    area = first_area(phone)
    room = {"id": area, "name": "Published", "areas": [area]}
    part = {"room": {**room, "name": "Variant"}, "background": None}
    dashboard = with_variants(
        {"layout": [room]}, pages={f"room:{area}": {"id": "v", "name": "B", "slice": part}}
    )
    phone.evaluate(f"window.history.replaceState(null, '', '?room={area}')")
    mount_admin(phone, dashboard, "room")
    phone.evaluate(f"""async () => {{
        const chrome = document.querySelector('{CHROME}');
        const raw = chrome.raw;
        const changed = {{ ...raw, layout: raw.layout.map((r) => ({{ ...r, name: 'Changed' }})), menu: [{{ path: '/energy' }}] }};
        await chrome._saveSettings({{ detail: {{ dashboard: changed }} }});
    }}""")
    saved = phone.evaluate("window.saved")
    update = next(message for message in saved if message["type"] == "home_dashboard/variants/update")
    assert update["variant"] == "v" and update["page"] == f"room:{area}"
    assert update["slice"]["room"]["name"] == "Changed"
    live = next(message for message in saved if message["type"] == "lovelace/config/save")["config"][
        "strategy"
    ]
    assert live["layout"][0]["name"] == "Published"
    assert live["menu"] == [{"path": "/energy"}]
    assert not any(key.startswith("_") for key in live)


def test_saving_without_a_variant_never_keeps_what_was_only_loaded(phone):
    mount_admin(phone, with_variants({}, pages={}))
    phone.evaluate(f"""async () => {{
        const chrome = document.querySelector('{CHROME}');
        await chrome._saveSettings({{ detail: {{ dashboard: {{ ...chrome.raw, menu: [] }} }} }});
    }}""")
    live = next(
        message for message in phone.evaluate("window.saved") if message["type"] == "lovelace/config/save"
    )
    assert not any(key.startswith("_") for key in live["config"]["strategy"])


# Choosing on the phone ---------------------------------------------------------------------------------


def open_variants(page) -> None:
    page.locator(f"{PAGE} [data-rooms]").first.click()
    page.locator(f"{SHEET} [data-sheet-variants]").click()
    page.wait_for_selector(f"{SHEET} [data-variant-option]")


def choices_of(page, **extra) -> dict:
    return {
        "home": {
            "live_name": "Klasyczna",
            "items": [
                item("v", "Sekcje", home_slice(page, **SECTIONS_HOME), devices=["tablet"]),
                item("old", "", home_slice(page)),
            ],
            **extra,
        }
    }


def test_only_an_administrator_gets_the_choice(phone):
    mount_admin(phone, with_variants({}, choices=choices_of(phone)), admin=False)
    phone.locator(f"{PAGE} [data-rooms]").first.click()
    phone.wait_for_selector(f"{SHEET} [data-home-link]")
    assert phone.locator(f"{SHEET} [data-sheet-variants]").count() == 0


def test_a_page_without_variants_offers_no_choice(phone):
    mount_admin(phone, with_variants({}, choices=None))
    phone.locator(f"{PAGE} [data-rooms]").first.click()
    phone.wait_for_selector(f"{SHEET} [data-home-link]")
    assert phone.locator(f"{SHEET} [data-sheet-variants]").count() == 0


def test_the_choice_lists_the_published_page_and_every_variant(phone):
    mount_admin(phone, with_variants({}, choices=choices_of(phone)))
    phone.locator(f"{PAGE} [data-rooms]").first.click()
    assert "Klasyczna" in phone.locator(f"{SHEET} [data-sheet-variants]").inner_text()
    phone.locator(f"{SHEET} [data-sheet-variants]").click()
    options = phone.locator(f"{SHEET} [data-variant-option]")
    options.first.wait_for()
    texts = options.all_inner_texts()
    assert "Klasyczna" in texts[0]
    assert "Sekcje" in texts[1] and "1" in texts[1]
    assert "Poprzednia wersja" in texts[2] or "Previous version" in texts[2]
    # Nothing new is picked yet: nothing to do for this device.
    assert phone.locator(f"{SHEET} [data-variant-device]").is_disabled()
    assert phone.locator(f"{SHEET} [data-variant-deploy]").is_disabled()


def test_a_variant_is_chosen_for_this_device(phone):
    mount_admin(phone, with_variants({}, choices=choices_of(phone)))
    open_variants(phone)
    phone.locator(f"{SHEET} [data-variant-option='v']").click()
    phone.locator(f"{SHEET} [data-variant-device]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'home_dashboard/variants/assign')")
    assign = next(m for m in phone.evaluate("window.saved") if m["type"] == "home_dashboard/variants/assign")
    assert assign["page"] == "home"
    assert assign["devices"] == {"token-1": "v"}


def test_a_failed_change_is_said_in_the_dashboards_own_window(phone):
    mount_admin(phone, with_variants({}, choices=choices_of(phone)))
    phone.on("dialog", lambda dialog: (_ for _ in ()).throw(AssertionError("a browser dialog")))
    phone.evaluate(
        """() => {
            const call = window.hass.callWS;
            window.hass.callWS = async (message) => {
                if (message.type === 'home_dashboard/variants/assign') throw new Error('The server said no');
                return call(message);
            };
        }"""
    )
    open_variants(phone)
    phone.locator(f"{SHEET} [data-variant-option='v']").click()
    phone.locator(f"{SHEET} [data-variant-device]").click()
    message = f"{SHEET} home-dashboard-message"
    phone.wait_for_selector(f"{message} [data-message]")
    assert phone.locator(f"{message} [role='alertdialog'][aria-modal='true']").count() == 1
    assert phone.locator(f"{message} [data-message-text]").inner_text() == "The server said no"
    assert phone.locator(f"{message} [data-message-title]").inner_text() == "Wariant nie został zmieniony"
    phone.locator(f"{message} [data-message-ok]").click()
    phone.wait_for_selector(message, state="detached")
    # The sheet stays open, ready to try again.
    assert phone.locator(f"{SHEET} [data-variant-device]").is_enabled()


def test_a_look_needs_no_server(phone):
    mount_admin(phone, with_variants({}, choices=choices_of(phone)))
    open_variants(phone)
    phone.locator(f"{SHEET} [data-variant-option='v']").click()
    phone.locator(f"{SHEET} [data-variant-peek]").click()
    assert json.loads(phone.evaluate("sessionStorage.getItem('home-dashboard-variant-peek')")) == {
        "home": "v"
    }
    assert not any(m["type"].startswith("home_dashboard/variants") for m in phone.evaluate("window.saved"))


def test_publishing_for_everyone_asks_first(phone):
    mount_admin(phone, with_variants({}, choices=choices_of(phone)))
    open_variants(phone)
    phone.on("dialog", lambda dialog: (_ for _ in ()).throw(AssertionError("a browser dialog")))
    phone.locator(f"{SHEET} [data-variant-option='v']").click()
    phone.locator(f"{SHEET} [data-variant-deploy]").click()
    confirm = phone.locator(f"{SHEET} [data-variant-confirm]")
    assert "Sekcje" in confirm.inner_text() and "Klasyczna" in confirm.inner_text()
    phone.locator(f"{SHEET} [data-variant-deploy-cancel]").click()
    assert phone.locator(f"{SHEET} [data-variant-confirm]").count() == 0
    assert not any(m["type"] == "home_dashboard/variants/deploy" for m in phone.evaluate("window.saved"))
    phone.locator(f"{SHEET} [data-variant-deploy]").click()
    phone.locator(f"{SHEET} [data-variant-deploy-ok]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'home_dashboard/variants/deploy')")
    deploy = next(m for m in phone.evaluate("window.saved") if m["type"] == "home_dashboard/variants/deploy")
    assert deploy["variant"] == "v" and deploy["page"] == "home"


# Shared with the household ---------------------------------------------------------------------------------


def shared_choices(page, own=None) -> dict:
    part = home_slice(page, **SECTIONS_HOME)
    return {
        "home": {
            "live_name": "Klasyczna",
            "items": [{"id": "v", "name": "Sekcje", "slice": part, "shared": True}],
            "own": own,
        }
    }


def test_a_person_chooses_a_shared_variant_for_themselves(phone):
    mount_admin(phone, with_variants({}, choices=shared_choices(phone)), admin=False)
    open_variants(phone)
    assert phone.locator(f"{SHEET} [data-variant-device]").count() == 0
    assert phone.locator(f"{SHEET} [data-variant-deploy]").count() == 0
    texts = phone.locator(f"{SHEET} [data-variant-option]").all_inner_texts()
    assert "Klasyczna" in texts[0] and "Sekcje" in texts[1]
    phone.locator(f"{SHEET} [data-variant-option='v']").click()
    phone.locator(f"{SHEET} [data-variant-self]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'home_dashboard/variants/choose')")
    choose = next(m for m in phone.evaluate("window.saved") if m["type"] == "home_dashboard/variants/choose")
    assert choose["page"] == "home" and choose["variant"] == "v"


def test_a_person_goes_back_to_the_published_page(phone):
    mount_admin(phone, with_variants({}, choices=shared_choices(phone, own="v")), admin=False)
    open_variants(phone)
    assert phone.locator(f"{SHEET} [data-variant-option='v'].on").count() == 1
    phone.locator(f"{SHEET} [data-variant-option='live']").click()
    phone.locator(f"{SHEET} [data-variant-self]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'home_dashboard/variants/choose')")
    choose = next(m for m in phone.evaluate("window.saved") if m["type"] == "home_dashboard/variants/choose")
    assert choose["variant"] is None


# Loading the app afresh ------------------------------------------------------------------------------------


def test_everyone_but_an_administrator_loads_the_app_afresh_from_the_menu(phone):
    mount_admin(phone, {}, admin=False)
    phone.evaluate(
        "document.querySelector('home-dashboard-chrome').reloadApp = async () => { window.reloaded = true; }"
    )
    phone.locator(f"{PAGE} [data-menu]").click()
    phone.locator("[data-menu-reload-app]").click()
    phone.wait_for_function("window.reloaded === true")
    assert phone.locator("[data-settings]").count() == 0


def test_an_administrator_has_it_in_the_settings(phone):
    mount_admin(phone, {})
    phone.locator(f"{PAGE} [data-menu]").click()
    phone.wait_for_selector("[data-settings]")
    assert phone.locator("[data-menu-reload-app]").count() == 0


# The device's own id ---------------------------------------------------------------------------------------


def test_the_device_keeps_an_id_of_its_own(phone):
    mount(phone)
    first, second = phone.evaluate(
        """async () => { const u = await import('/custom_components/home_dashboard/www/app/usage.js');
            localStorage.removeItem('home-dashboard-device-id');
            return [u.dashboardDeviceId(), u.dashboardDeviceId()]; }"""
    )
    assert first and first == second and len(first) >= 8
    # A browser that keeps nothing: no id, the sign-in tells the device apart.
    assert (
        phone.evaluate(
            """async () => { const u = await import('/custom_components/home_dashboard/www/app/usage.js');
            return u.dashboardDeviceId({ getItem: () => null, setItem: () => { throw new Error('private'); } }); }"""
        )
        is None
    )


def test_the_dashboard_says_its_id_and_browser_mod_name_when_asking_for_variants(phone):
    mount(phone)
    message = phone.evaluate(
        """async () => { localStorage.setItem('browser_mod-browser-id', 'hall_tablet');
            localStorage.setItem('home-dashboard-device-id', 'abcdef12-3456');
            const { variantsOfDevice } = await import('/custom_components/home_dashboard/www/app/main.js');
            let sent; await variantsOfDevice({ callWS: async (m) => { sent = m; return { pages: {}, choices: null }; } });
            localStorage.removeItem('browser_mod-browser-id'); return sent; }"""
    )
    assert message["device_id"] == "abcdef12-3456"
    assert message["browser_mod"] == "hall_tablet"
