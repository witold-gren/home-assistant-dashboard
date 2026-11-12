"""The status bar of a tablet on its side: the time, the weather and what is going on, in place of the narrow bar.
Folded on each tablet by its button, which opens the menu when held; what it shows and its colours are part of the look."""

from __future__ import annotations

from .test_appearance import open_look
from .test_panels import add_entity
from .test_shortcuts import SHEET, mount_admin

CHROME = "document.querySelector('home-dashboard-chrome')"
PANEL = "home-dashboard-status-panel"
MODULE = "/custom_components/home_dashboard/www/app/status-panel.js"
SHOWN = {"appearance": {"status": {"shown": True}}}
DEPARTURES = {"kind": "departures", "name": "Tramwaje", "icon": "mdi:tram", "entities": ["sensor.tram_8"],
              "colors": {"8": "#ff9f0a"}}


def run(page, body: str, arg=None):
    return page.evaluate(f"async (arg) => {{ const s = await import('{MODULE}'); {body} }}", arg)


def add_home(page) -> None:
    add_entity(page, "weather.home", "cloudy", {"friendly_name": "Dom", "temperature": 5.7, "humidity": 87})
    add_entity(page, "sensor.tram_8", "7", {"list": [
        {"line": "8", "direction": "KARŁOWICE", "departure": "20:16", "time_to_departure": 7},
        {"line": "8", "direction": "KARŁOWICE", "departure": "20:36", "time_to_departure": 27},
    ]})
    add_entity(page, "binary_sensor.balcony", "off", {"friendly_name": "Balkon", "device_class": "door"})
    add_entity(page, "binary_sensor.bathroom", "off", {"friendly_name": "Łazienka", "device_class": "door"})
    add_entity(page, "sensor.washer", "Off", {"friendly_name": "Pralka"})
    add_entity(page, "sensor.washer_left", "53 min", {"friendly_name": "Pozostało"})


def mount(page, extra: dict | None = None, folded: bool = False, hint_seen: bool = True, states: dict | None = None) -> None:
    page.evaluate(
        """({ folded, hintSeen }) => {
            localStorage.setItem('home-dashboard-status-open', folded ? '0' : '1');
            if (hintSeen) localStorage.setItem('home-dashboard-status-hint', '3');
            else localStorage.removeItem('home-dashboard-status-hint');
        }""",
        {"folded": folded, "hintSeen": hint_seen},
    )
    add_home(page)
    for entity_id, (state, attributes) in (states or {}).items():
        add_entity(page, entity_id, state, attributes)
    dashboard = {
        **SHOWN,
        "shortcuts": [DEPARTURES],
        "status_panel": {"doors": ["binary_sensor.balcony", {"entity": "binary_sensor.bathroom", "name": "Łazienka"}],
                         "now": [{"entity": "sensor.washer", "name": "Pralka", "remaining": "sensor.washer_left"}]},
        **(extra or {}),
    }
    mount_admin(page, dashboard)


def nav(page) -> dict:
    return page.evaluate(f"""() => {{ const nav = {CHROME}.shadowRoot.querySelector('nav');
        const panel = nav.querySelector('{PANEL}');
        return {{ open: nav.classList.contains('status-open'), width: Math.round(nav.getBoundingClientRect().width),
                 panel: Boolean(panel), fold: Boolean(nav.querySelector('[data-status-fold]')),
                 first: nav.firstElementChild?.matches('[data-status-fold]') ? 'fold'
                        : nav.firstElementChild?.matches('[data-menu]') ? 'menu' : nav.firstElementChild?.localName,
                 pages: [...nav.querySelectorAll('[data-page]')].map((b) => b.dataset.page) }}; }}""")


def widgets(page) -> list:
    return page.evaluate(f"""() => [...{CHROME}.shadowRoot.querySelector('{PANEL}').shadowRoot
        .querySelectorAll('[data-status-widget]')].map((w) => w.dataset.statusWidget)""")


def panel_text(page) -> str:
    return page.evaluate(f"() => {CHROME}.shadowRoot.querySelector('{PANEL}').shadowRoot.textContent.replace(/\\s+/g, ' ')")


# The bar --------------------------------------------------------------------------------------------
def test_a_tablet_shows_the_status_bar_in_place_of_the_narrow_one(tablet):
    mount(tablet)
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')")
    shown = nav(tablet)
    assert shown["open"] and shown["width"] == 320
    # The pages stay, in a row under the bar; the page makes room for the whole bar.
    assert shown["pages"] == ["home", "media", "energy", "map"]
    space = tablet.evaluate("""() => { const root = document.querySelector('home-dashboard-chrome').root;
        return getComputedStyle(root ?? document.documentElement).getPropertyValue('--hd-rail-space').trim(); }""")
    assert space == "320px"
    clock = tablet.locator(f"{PANEL} [data-status-clock]").inner_text()
    assert len(clock) == 5 and clock[2] == ":"


def test_without_the_choice_and_on_a_phone_the_bar_is_as_it_was(tablet, phone):
    add_home(tablet)
    mount_admin(tablet, {})
    assert nav(tablet)["first"] == "menu" and not nav(tablet)["panel"]
    mount(phone)
    phone.wait_for_selector("home-dashboard-chrome nav [data-page]", state="attached")
    assert not nav(phone)["panel"] and not nav(phone)["fold"]


def test_a_tap_folds_it_to_the_narrow_bar_and_the_tablet_remembers(tablet):
    mount(tablet)
    tablet.locator("[data-status-fold]").click()
    folded = nav(tablet)
    assert not folded["open"] and not folded["panel"] and folded["width"] == 88
    # Folded: the button on top, the menu and the assistant at the bottom, as in the narrow bar.
    assert folded["first"] == "fold"
    order = tablet.evaluate(f"""() => [...{CHROME}.shadowRoot.querySelector('nav').children]
        .map((c) => c.matches('[data-menu]') ? 'menu' : c.matches('[data-assist]') ? 'assist' : c.localName).slice(-2)""")
    assert order == ["menu", "assist"]
    assert tablet.evaluate("localStorage.getItem('home-dashboard-status-open')") == "0"
    tablet.locator("[data-status-fold]").click()
    assert nav(tablet)["open"]


def test_a_hold_opens_the_menu_and_its_arrow_comes_back(tablet):
    mount(tablet)
    fold = tablet.locator("[data-status-fold]").bounding_box()
    tablet.mouse.move(fold["x"] + 20, fold["y"] + 20)
    tablet.mouse.down()
    tablet.wait_for_timeout(150)
    assert "holding" in tablet.locator("[data-status-fold]").get_attribute("class")
    tablet.wait_for_timeout(600)
    tablet.mouse.up()
    tablet.wait_for_selector("[data-drawer]")
    # The hold does not fold the bar as well.
    assert nav(tablet)["open"]
    # The menu is as wide as the bar, with the name of Home Assistant at its top.
    drawer = tablet.locator("[data-drawer]")
    assert round(drawer.bounding_box()["width"]) == 320
    assert "Home Assistant" in tablet.locator("[data-drawer] .drawer-head").inner_text()
    tablet.locator("[data-drawer-back]").click()
    tablet.wait_for_selector("[data-drawer]", state="detached")


def test_the_hint_about_the_hold_shows_the_first_times_only(tablet):
    mount(tablet, hint_seen=False)
    tablet.wait_for_selector("[data-status-hint]")
    assert "Przytrzymaj" in tablet.locator("[data-status-hint]").inner_text()
    assert tablet.evaluate("localStorage.getItem('home-dashboard-status-hint')") == "1"


def test_no_hint_once_it_was_shown_enough_or_the_menu_was_held_open(tablet):
    mount(tablet)
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')")
    tablet.wait_for_timeout(200)
    assert tablet.locator("[data-status-hint]").count() == 0


# What it shows ---------------------------------------------------------------------------------------
def test_parts_with_nothing_to_say_are_left_out(tablet):
    mount(tablet)
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')?.shadowRoot.querySelector('[data-status-widget]')")
    # Doors closed, the washer off and no warnings: no Now and no Heads up.
    assert "now" not in widgets(tablet) and "alerts" not in widgets(tablet)
    assert widgets(tablet)[0] == "weather" and "departures" in widgets(tablet)
    text = panel_text(tablet)
    assert "5,7°" in text and "karłowice" in text.lower() and "7 min" in text and "20:16 · 20:36" in text


def test_an_open_door_and_a_running_washer_come_in(tablet):
    mount(tablet, states={"binary_sensor.balcony": ("on", {"friendly_name": "Balkon", "device_class": "door"}),
                          "sensor.washer": ("Running", {"friendly_name": "Pralka"})})
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')?.shadowRoot.querySelector('[data-status-now]')")
    text = panel_text(tablet)
    assert "1 balkon" in text and "Pralka" in text and "53 min" in text
    assert widgets(tablet).index("now") < widgets(tablet).index("departures")


def test_the_look_chooses_the_parts_and_their_order(tablet):
    mount(tablet, {"appearance": {"status": {"shown": True, "widgets": ["departures", "weather"]}}})
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')?.shadowRoot.querySelector('[data-status-widget]')")
    assert widgets(tablet) == ["departures", "weather"]


def test_the_colours_of_the_look_reach_the_bar(tablet):
    mount(tablet, {"appearance": {"status": {"shown": True, "background": "#102030", "text": "#ffeedd"}}})
    colours = tablet.evaluate(f"""() => {{ const nav = {CHROME}.shadowRoot.querySelector('nav');
        const style = getComputedStyle(nav); return [style.backgroundColor, style.color]; }}""")
    assert colours[0].startswith("color(srgb 0.0627") and colours[1] == "rgb(255, 238, 221)"


def test_without_colours_the_bar_is_glass_with_white_text_and_quiet_icons(tablet):
    mount(tablet)
    look = tablet.evaluate(f"""() => {{ const nav = {CHROME}.shadowRoot.querySelector('nav'); const style = getComputedStyle(nav);
        const badge = nav.querySelector('{PANEL}').shadowRoot.querySelector('.badge');
        return [style.color, style.backgroundColor, style.backdropFilter, getComputedStyle(badge).backgroundColor]; }}""")
    assert look == ["rgb(255, 255, 255)", "rgba(0, 0, 0, 0.26)", "blur(30px)", "rgba(0, 0, 0, 0)"]


def test_colours_can_be_turned_back_on(tablet):
    mount(tablet, {"appearance": {"status": {"shown": True, "colourful": True}}})
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')?.shadowRoot.querySelector('.badge')")
    badge = tablet.evaluate(f"""() => getComputedStyle({CHROME}.shadowRoot.querySelector('{PANEL}').shadowRoot
        .querySelector('.badge')).backgroundColor""")
    assert badge == "rgb(255, 159, 10)"


def test_the_look_editor_turns_it_on_and_orders_its_parts(phone):
    open_look(phone)
    phone.locator(f"{SHEET} [data-tab='nav']").click()
    phone.locator(f"{SHEET} [data-look-status-shown] input").check()
    phone.locator(f"{SHEET} [data-status-part='power'] [data-status-part-remove]").click()
    phone.locator(f"{SHEET} [data-status-part='departures'] [data-status-part-up]").click()
    phone.locator(f"{SHEET} [data-look-save]").click()
    phone.wait_for_function("window.saved.some((m) => m.type === 'lovelace/config/save')")
    saved = phone.evaluate("window.saved.find((m) => m.type === 'lovelace/config/save').config.strategy.appearance")
    assert saved == {"status": {"shown": True, "widgets": ["weather", "home", "alerts", "departures", "now"]}}


# The facts --------------------------------------------------------------------------------------------
def test_now_skips_what_rests_and_shows_what_is_left(phone):
    shown = run(phone, """
        const hass = { language: 'pl', formatEntityState: (s) => s.state, states: {
            'sensor.mass': { state: '—', attributes: { friendly_name: 'Msze' } },
            'vacuum.robot': { state: 'cleaning', attributes: { friendly_name: 'Odkurzacz' } },
            'sensor.dryer': { state: 'Off', attributes: {} },
            'sensor.washer': { state: 'Rinse', attributes: {} },
            'sensor.programme': { state: 'Cottons', attributes: {} },
            'sensor.left': { state: '—', attributes: {} } } };
        return s.statusNow(hass, ['sensor.mass', 'vacuum.robot', 'sensor.dryer',
            { entity: 'sensor.washer', name: 'Pralka', detail: 'sensor.programme', remaining: 'sensor.left' }, 'sensor.gone']);""")
    assert [(item["name"], item["icon"], item["detail"], item["value"]) for item in shown] == [
        ("Odkurzacz", "mdi:robot-vacuum", "cleaning", ""), ("Pralka", "mdi:information-outline", "Rinse · Cottons", "")]


def test_home_counts_only_what_is_on_or_open(phone):
    facts = run(phone, """
        const hass = { language: 'pl', states: {
            'light.a': { state: 'on' }, 'light.b': { state: 'on' }, 'light.c': { state: 'off' }, 'switch.s': { state: 'off' },
            'binary_sensor.d': { state: 'on', attributes: { friendly_name: 'Drzwi wejściowe' } },
            'binary_sensor.e': { state: 'on', attributes: { friendly_name: 'Balkon' } } } };
        const selection = { entityIds: ['light.a', 'light.b', 'light.c', 'switch.s'] };
        const one = s.statusHome(hass, selection, { status_panel: { doors: ['binary_sensor.d'] } });
        const two = s.statusHome(hass, selection, { status_panel: { doors: ['binary_sensor.d', 'binary_sensor.e'] } });
        return [one.map((f) => f.label), two.map((f) => f.label)];""")
    assert facts == [["2 światła", "1 drzwi wejściowe"], ["2 światła", "otwarte: 2"]]


def test_the_next_rain_and_the_line_of_power(phone):
    result = run(phone, """
        const now = new Date('2026-11-15T10:00:00');
        const hourly = [
            { datetime: '2026-11-15T11:00:00', precipitation: 0 },
            { datetime: '2026-11-15T13:00:00', precipitation: 0.4, condition: 'rainy' },
            { datetime: '2026-11-16T03:00:00', precipitation: 2 } ];
        const late = [{ datetime: '2026-11-16T03:00:00', precipitation: 2 }];
        return [s.nextPrecipitation(hourly, now)?.datetime, s.nextPrecipitation(late, now),
                s.sparkPath([{ time: 0, value: 10 }, { time: 50, value: 20 }, { time: 100, value: 10 }], { width: 100, height: 40 }),
                s.sparkPath([{ time: 0, value: 1 }])];""")
    assert result == ["2026-11-15T13:00:00", None, "M0.0,38.0 L50.0,2.0 L100.0,38.0", ""]


def test_a_dense_history_is_averaged_in_slices(phone):
    slices = run(phone, """return s.bucketed([{ time: 0, value: 2 }, { time: 10, value: 4 }, { time: 60, value: 9 },
        { time: 70, value: NaN }, { time: 500, value: 1 }], 4, 0, 100);""")
    assert slices == [{"time": 12.5, "value": 3}, {"time": 62.5, "value": 9}]


def test_departures_come_from_the_first_block_or_their_own_list(phone):
    result = run(phone, """
        const hass = { language: 'pl', states: { 'sensor.t': { state: '3', attributes: { list: [
            { line: '16', direction: 'Osobowice', departure: '20:24', time_to_departure: 15 }] } } } };
        const block = { kind: 'departures', name: 'MPK', entities: ['sensor.t'] };
        return [s.statusDepartures(hass, { shortcuts: [block], status_panel: {} }),
                s.statusDepartures(hass, { shortcuts: [], status_panel: { departures: ['sensor.t'] } })?.title,
                s.statusDepartures(hass, { shortcuts: [], status_panel: {} })];""")
    first, own, none = result
    assert first["title"] == "MPK"
    assert first["lines"][0] | {"colour": None} == {
        "key": "16|Osobowice", "line": "16", "direction": "Osobowice", "colour": None, "minutes": 15, "times": ["20:24"]}
    assert own == "Odjazdy" and none is None


def test_music_assistant_on_the_whole_page_has_no_bar_and_no_room_for_it(tablet):
    mount(tablet, {"appearance": {"status": {"shown": True}, "nav": {"style": "floating"}},
                   "music": {"frame": "/music", "fullscreen": True}})
    tablet.evaluate(f"() => {{ const chrome = {CHROME}; chrome.page = 'music'; chrome.navTucked = true; }}")
    tablet.wait_for_timeout(400)
    shown = tablet.evaluate(f"""() => {{ const chrome = {CHROME}; const nav = chrome.shadowRoot.querySelector('nav');
        return {{ panel: Boolean(nav.querySelector('{PANEL}')), right: nav.getBoundingClientRect().right,
                 space: getComputedStyle(chrome.root ?? document.documentElement).getPropertyValue('--hd-rail-space').trim() }}; }}""")
    assert shown == {"panel": False, "right": 0, "space": "0px"}
    # Back on Home the bar is there again, with its room.
    tablet.evaluate(f"() => {{ const chrome = {CHROME}; chrome.page = 'home'; chrome.navTucked = false; }}")
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('nav {PANEL}')")


# What a tap opens ------------------------------------------------------------------------------------
STATUS_SCREEN = {"kind": "overview", "name": "Status", "icon": "mdi:check", "sections": []}


def sheet_kind(page) -> str | None:
    return page.evaluate(f"() => {CHROME}._overlay?.sheet?.kind ?? null")


def tap(page, selector: str) -> None:
    page.locator(f"{PANEL} {selector}").first.click()


def test_a_tap_opens_the_window_of_its_part(tablet):
    mount(tablet, {"shortcuts": [DEPARTURES, STATUS_SCREEN]})
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')?.shadowRoot.querySelector('[data-status-line]')")
    tap(tablet, "[data-status-widget='weather']")
    assert sheet_kind(tablet) == "weather"
    tablet.evaluate(f"{CHROME}.close()")
    tap(tablet, "[data-status-fact='lights']")
    assert sheet_kind(tablet) == "overview"
    assert tablet.evaluate(f"{CHROME}._overlay.sheet.item.name") == "Status"
    tablet.evaluate(f"{CHROME}.close()")
    tap(tablet, "[data-status-line]")
    assert sheet_kind(tablet) == "departures"
    assert tablet.evaluate(f"{CHROME}._overlay.sheet.item.name") == "Tramwaje"


def test_the_power_opens_the_energy_page(tablet):
    mount(tablet, {"status_panel": {"power": [{"entity": "sensor.server_power", "name": "Serwer"}]}},
          states={"sensor.server_power": ("25", {"unit_of_measurement": "W"})})
    tablet.evaluate("window.went = []; window.addEventListener('location-changed', () => window.went.push(location.pathname))")
    tap(tablet, "[data-status-power]")
    assert tablet.evaluate("location.pathname").endswith("/energy")


def test_a_departure_past_an_hour_shows_its_hour(tablet):
    mount(tablet, states={"sensor.tram_8": ("299", {"list": [
        {"line": "8", "direction": "Karłowice", "departure": "04:59", "time_to_departure": 299}]})})
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')?.shadowRoot.querySelector('[data-status-line]')")
    shown = tablet.locator(f"{PANEL} [data-status-line] strong").inner_text()
    assert shown == "04:59"


def test_the_fold_button_and_the_assistant_stand_in_the_middle_of_the_clock_and_the_date(tablet):
    mount(tablet)
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')?.shadowRoot.querySelector('.top')")
    top = tablet.locator(f"{PANEL} .top > div").first.bounding_box()
    actions = tablet.locator("home-dashboard-chrome .status-actions").bounding_box()
    def middle(b):
        return b["y"] + b["height"] / 2

    assert abs(middle(actions) - middle(top)) <= 2


def test_a_tram_leaving_now_says_so(tablet):
    mount(tablet, states={"sensor.tram_8": ("-1", {"list": [
        {"line": "8", "direction": "Karłowice", "departure": "11:01", "time_to_departure": -1}]})})
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')?.shadowRoot.querySelector('[data-status-line]')")
    assert tablet.locator(f"{PANEL} [data-status-line] strong").inner_text() == "teraz"
