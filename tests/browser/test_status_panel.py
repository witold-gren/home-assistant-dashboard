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
    assert saved == {"status": {"shown": True, "widgets": ["weather", "calendar", "home", "alerts", "departures", "now"]}}


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
    assert facts == [["2 światła", "1 drzwi wejściowe"], ["2 światła", "2 otwarte drzwi"]]


def test_windows_have_their_own_badge_and_doors_theirs(phone):
    facts = run(phone, """
        const hass = { language: 'pl', states: {
            'binary_sensor.door': { state: 'on', attributes: { friendly_name: 'Drzwi do toalety' } },
            'binary_sensor.w1': { state: 'on', attributes: { friendly_name: 'Salon okno' } },
            'binary_sensor.w2': { state: 'on', attributes: {} }, 'binary_sensor.w3': { state: 'off', attributes: {} } } };
        return s.statusHome(hass, { entityIds: [] }, { status_panel: {
            doors: ['binary_sensor.door'], windows: ['binary_sensor.w1', 'binary_sensor.w2', 'binary_sensor.w3'] } })
            .map((fact) => [fact.key, fact.icon, fact.label, fact.group]);""")
    assert facts == [["doors", "mdi:door-open", "1 drzwi do toalety", "doors"],
                     ["windows", "mdi:window-open-variant", "2 otwarte okna", "windows"]]


def test_a_flag_shows_while_its_helper_is_on(phone):
    facts = run(phone, """
        const flags = [{ entity: 'input_boolean.mail', name: 'Poczta', icon: 'mdi:mailbox-up' }];
        const of = (state) => s.statusHome({ language: 'pl', states: { 'input_boolean.mail': { state, attributes: {} } } },
            { entityIds: [] }, { status_panel: { flags } }).map((fact) => [fact.label, fact.icon, fact.entity]);
        return [of('on'), of('off')];""")
    assert facts == [[["Poczta", "mdi:mailbox-up", "input_boolean.mail"]], []]


DOORS = {"status_panel": {"doors": [{"entity": "binary_sensor.front", "name": "Drzwi wejściowe"},
                                    {"entity": "binary_sensor.wc", "name": "Drzwi do toalety"},
                                    {"entity": "binary_sensor.balcony", "name": "Balkon"}]}}


def open_doors(tablet) -> None:
    add_entity(tablet, "binary_sensor.front", "on", {"device_class": "door"})
    add_entity(tablet, "binary_sensor.wc", "on", {"device_class": "door"})
    add_entity(tablet, "binary_sensor.balcony", "off", {"device_class": "door"})
    mount(tablet, DOORS)
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')?.shadowRoot.querySelector('[data-status-fact=\\'doors\\']')")


def test_a_tap_on_the_doors_lists_the_open_ones_by_their_names(tablet):
    open_doors(tablet)
    tap(tablet, "[data-status-fact='doors']")
    tablet.wait_for_selector(f"{SHEET} [data-status-on='doors']")
    assert sorted(rows(tablet)) == ["binary_sensor.front", "binary_sensor.wc"]
    assert "Drzwi do toalety" in tablet.locator(f"{SHEET} [data-status-row='binary_sensor.wc']").inner_text()


def test_the_badges_of_at_home_are_all_in_the_same_weight(tablet):
    open_doors(tablet)
    weights = tablet.locator(f"{PANEL} .fact").evaluate_all("(facts) => facts.map((f) => getComputedStyle(f).fontWeight)")
    assert len(set(weights)) == 1


def test_a_lock_that_is_not_locked_counts_as_an_open_door(phone):
    facts = run(phone, """
        const hass = { language: 'pl', states: {
            'lock.front': { state: 'unlocked', attributes: { friendly_name: 'Drzwi wejściowe' } },
            'lock.back': { state: 'locked', attributes: { friendly_name: 'Taras' } } } };
        return s.statusHome(hass, { entityIds: [] }, { status_panel: { doors: ['lock.front', 'lock.back'] } })
            .map((fact) => fact.label);""")
    assert facts == ["1 drzwi wejściowe"]


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
    assert sheet_kind(tablet) == "status-on"
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


def test_a_twelve_hour_clock_keeps_its_time_on_one_line(phone):
    parts = phone.evaluate(f"""async () => {{ const s = await import('{MODULE}');
        const at = new Date(2026, 10, 12, 14, 2);
        return [s.clockParts(at, 'en-US'), s.clockParts(at, 'pl'), s.clockParts(new Date(2026, 10, 12, 9, 5), 'pl')]; }}""")
    assert parts[0] == {"time": "2:02", "period": "PM"}
    assert parts[1] == {"time": "14:02", "period": ""}
    assert parts[2] == {"time": "09:05", "period": ""}


def test_a_washer_in_now_opens_the_window_of_its_block(tablet):
    found = tablet.evaluate("""async () => { const { blockFor } = await import('/custom_components/home_dashboard/www/app/model.js');
        const washer = { kind: 'panel', name: 'Pralka', entity: 'sensor.washer_state', stats: [{ name: 'Faza', entity: 'sensor.washer_phase' }] };
        const config = { shortcuts: [], layout: [{ id: 'r', sections: [{ tiles: [{ entity: 'light.a' }, washer] }] }] };
        return [blockFor(config, ['sensor.washer_phase'])?.name, blockFor(config, ['sensor.other']), blockFor(config, [], 'Pralka')?.name]; }""")
    assert found == ["Pralka", None, "Pralka"]


def test_a_count_leaves_out_what_it_is_told_to(phone):
    facts = run(phone, """
        const hass = { language: 'pl', states: {
            'light.a': { state: 'on', attributes: {} }, 'light.sky': { state: 'on', attributes: {} },
            'switch.s': { state: 'on', attributes: {} } } };
        const selection = { entityIds: ['light.a', 'light.sky', 'switch.s'] };
        const counted = s.statusHome(hass, selection, { status_panel: { ignore: ['light.sky', 'switch.s'] } });
        return counted.map((f) => [f.key, f.label, f.ids]);""")
    assert facts == [["lights", "1 światło", ["light.a"]]]


SKY = {"friendly_name": "Skylight", "icon": "mdi:weather-sunset"}


def add_light(page, entity_id: str, attributes: dict) -> None:
    """A light that is on, in the room of a light of the test home, so the dashboard shows it."""
    add_entity(page, entity_id, "on", attributes)
    page.evaluate(
        """(id) => {
            const snapshot = window.dashboard.snapshot;
            snapshot.states[id].last_changed = new Date().toISOString();
            // light.entity_0162 is one the dashboard shows: a light of a room, not a group member nor a setting.
            snapshot.entities[id] = { ...snapshot.entities['light.entity_0162'], entity_id: id, name: null };
        }""",
        entity_id,
    )


def open_lights(tablet, extra: dict | None = None, admin: bool = True) -> None:
    add_light(tablet, "light.sky", SKY)
    add_light(tablet, "light.desk", {"friendly_name": "Biurko"})
    states = {}
    mount(tablet, extra, states=states)
    if not admin:
        tablet.evaluate(f"{CHROME}.hass = {{ ...{CHROME}.hass, user: {{ ...{CHROME}.hass.user, is_admin: false }} }}")
    tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')?.shadowRoot.querySelector('[data-status-fact=\\'lights\\']')")
    tap(tablet, "[data-status-fact='lights']")
    tablet.wait_for_selector(f"{SHEET} [data-status-on='lights']")


def rows(page) -> list[str]:
    return page.locator(f"{SHEET} [data-status-row]").evaluate_all("(rows) => rows.map((row) => row.dataset.statusRow)")


def test_a_tap_on_the_lights_lists_them_with_their_room_and_time(tablet):
    open_lights(tablet)
    shown = rows(tablet)
    assert "light.sky" in shown and "light.desk" in shown
    text = tablet.locator(f"{SHEET} [data-status-row='light.sky']").inner_text()
    assert "Skylight" in text and "od " in text


def test_a_light_not_counted_is_listed_apart_with_where_to_change_it(tablet):
    open_lights(tablet, {"status_panel": {"ignore": ["light.sky"]}})
    assert "light.sky" in tablet.locator(f"{SHEET} .status-ignored ~ [data-status-row]").evaluate_all(
        "(rows) => rows.map((row) => row.dataset.statusRow)")
    assert "Pasek statusu" in tablet.locator(f"{SHEET} [data-status-on] .hint").last.inner_text()


def test_the_list_has_no_button_to_leave_a_light_out_it_is_configuration(tablet):
    open_lights(tablet)
    assert tablet.locator(f"{SHEET} [data-status-ignore]").count() == 0
    assert tablet.locator(f"{SHEET} [data-status-on] .hint").count() == 0
    assert "light.sky" in rows(tablet)


def test_a_row_opens_the_window_of_its_light(tablet):
    open_lights(tablet)
    tablet.locator(f"{SHEET} [data-status-open='light.desk']").click()
    tablet.wait_for_function(f"{CHROME}._overlay?.sheet?.entityId === 'light.desk'")


def test_since_says_the_hour_today_and_the_day_before(phone):
    result = run(phone, """
        const st = await import('/custom_components/home_dashboard/www/app/sheet-status.js');
        const now = new Date('2026-11-13T15:00:00');
        return [st.sinceText('2026-11-13T09:45:00', 'pl', now), st.sinceText('2026-11-12T22:05:00', 'pl', now), st.sinceText('x', 'pl', now)];""")
    assert result[0] == "09:45"
    assert result[1].endswith("22:05") and result[1] != "22:05"
    assert result[2] == ""


def test_the_lines_of_power_stay_when_a_read_of_the_history_fails(phone):
    result = run(phone, """
        const now = Date.now() / 1000;
        const rows = [{ s: '20', lu: now - 3600 }, { s: '30', lu: now - 1800 }, { s: '25', lu: now - 60 }];
        let fail = false;
        const hass = { language: 'pl', states: { 'sensor.jetson': { state: '25', attributes: {} } },
            callWS: async () => { if (fail) throw new Error('connection lost'); return { 'sensor.jetson': rows }; } };
        const panel = document.createElement('home-dashboard-status-panel');
        panel.hass = hass;
        panel.config = { status_panel: { power: ['sensor.jetson'] } };
        await panel._loadPower();
        const first = s.sparkPath(panel._history['sensor.jetson']);
        fail = true;
        await panel._loadPower();
        const kept = s.sparkPath(panel._history['sensor.jetson']);
        const retry = Boolean(panel._powerRetry);
        clearTimeout(panel._powerRetry);
        // A read without numbers for the sensor keeps its line too
        fail = false; rows.length = 0;
        await panel._loadPower();
        return { first, kept, retry, empty: s.sparkPath(panel._history['sensor.jetson']), wait: s.POWER_RETRY_MS };""")
    assert result["first"] != ""
    assert result["kept"] == result["first"]
    assert result["retry"] is True
    assert result["empty"] == result["first"]
    assert result["wait"] == 30_000


def test_back_on_the_page_the_power_is_read_again(phone):
    again = run(phone, """
        const panel = document.createElement('home-dashboard-status-panel');
        panel._powerKey = 'sensor.jetson';
        panel.disconnectedCallback();
        return panel._powerKey;""")
    assert again is None


def test_the_lists_of_at_home_keep_the_margin_of_the_list_of_areas(tablet):
    open_doors(tablet)
    tap(tablet, "[data-status-fact='doors']")
    tablet.wait_for_selector(f"{SHEET} [data-status-on='doors']")
    padding = tablet.locator(f"{SHEET} [data-status-on]").evaluate(
        "(list) => { const style = getComputedStyle(list); return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]; }")
    assert padding == ["8px", "16px", "16px", "16px"]


def test_a_line_of_power_with_a_switch_shows_only_while_it_is_on(tablet):
    mount(tablet, {"status_panel": {"power": [
        {"entity": "sensor.charger_power", "name": "iPad", "switch": "switch.charger"},
        {"entity": "sensor.server_power", "name": "Serwer"},
    ]}}, states={"sensor.charger_power": ("9", {"unit_of_measurement": "W"}), "switch.charger": ("off", {}),
                 "sensor.server_power": ("25", {"unit_of_measurement": "W"})})

    def shown():
        tablet.wait_for_function(f"{CHROME}.shadowRoot.querySelector('{PANEL}')?.shadowRoot.querySelector('[data-status-power]')")
        return tablet.evaluate(f"""() => [...{CHROME}.shadowRoot.querySelector('{PANEL}').shadowRoot
            .querySelectorAll('[data-status-power]')].map((row) => row.dataset.statusPower)""")

    assert shown() == ["sensor.server_power"]
    tablet.evaluate(f"""async () => {{ const chrome = {CHROME};
        chrome.hass = {{ ...chrome.hass, states: {{ ...chrome.hass.states,
            'switch.charger': {{ ...chrome.hass.states['switch.charger'], state: 'on' }} }} }};
        await chrome.shadowRoot.querySelector('{PANEL}').updateComplete; }}""")
    assert shown() == ["sensor.charger_power", "sensor.server_power"]
