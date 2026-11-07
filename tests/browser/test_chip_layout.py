"""Who sees which chips on Home, and in what order."""

from __future__ import annotations

from .test_entity_sheets import open_personal, user_data
from .test_shortcuts import SHEET, mount_admin

SHORTCUTS = {"shortcuts": [{"kind": "host", "name": "Host"}, {"kind": "host", "name": "Serwer", "entity": "sun.sun"}]}
ROW = "home-dashboard-page .chips .chip"


def arranged(page, raw: dict, prefs: dict | None = None, user: str = "kid") -> list:
    return page.evaluate(
        """({ raw, prefs, user }) => {
            const { model, hass } = window.dashboard;
            const instance = hass();
            return model.personalChoices(instance, raw, user, prefs).chips.map(({ id, hidden }) => [id, hidden]);
        }""",
        {"raw": raw, "prefs": prefs or {}, "user": user},
    )


def row(page) -> list:
    return [
        chip.get_attribute("data-chip") or chip.get_attribute("data-shortcut") or "weather"
        for chip in page.locator(ROW).all()
    ]


def mount_with_prefs(page, raw: dict, prefs: dict) -> None:
    page.evaluate(
        """(prefs) => {
            const original = window.dashboard.hass;
            window.dashboard.hass = (overrides) => {
                const instance = original(overrides);
                const answer = instance.callWS;
                instance.callWS = (message) => message.type === "frontend/get_user_data"
                    ? Promise.resolve({ value: prefs }) : answer(message);
                return instance;
            };
        }""",
        prefs,
    )
    mount_admin(page, raw)
    page.wait_for_selector(ROW)


def open_tab(page) -> None:
    page.locator(f"{SHEET} [data-tab='chips']").click()
    page.wait_for_selector(f"{SHEET} [data-order='chip:climate']")


def test_my_layout_lists_every_chip_and_shortcut(phone):
    ids = [chip for chip, _ in arranged(phone, SHORTCUTS)]
    assert {"chip:climate", "chip:lights", "chip:security", "chip:media", "block:Host", "block:Serwer"} <= set(ids)


def test_a_new_shortcut_lands_after_the_chosen_order(phone):
    ids = [chip for chip, _ in arranged(phone, SHORTCUTS, {"chips": ["block:Host", "chip:media"]})]
    assert ids[:2] == ["block:Host", "chip:media"]
    assert "block:Serwer" in ids[2:]


def test_what_someone_hid_stays_on_their_list(phone):
    choices = dict(arranged(phone, SHORTCUTS, {"hidden_chips": ["block:Host"]}))
    assert choices["block:Host"] is True
    assert choices["chip:media"] is False


def test_what_the_administrator_took_away_is_not_on_the_list(phone):
    raw = {**SHORTCUTS, "access": {"kid": {"hide": ["block:Host", "chip:lights"]}}}
    ids = [chip for chip, _ in arranged(phone, raw)]
    assert "block:Host" not in ids
    assert "chip:lights" not in ids
    assert "block:Host" in [chip for chip, _ in arranged(phone, raw, user="parent")]


def test_home_follows_the_personal_order(phone):
    mount_with_prefs(phone, SHORTCUTS, {"chips": ["block:Host", "chip:media", "chip:climate"]})
    phone.wait_for_function(
        """() => document.querySelector("home-dashboard-page").shadowRoot.querySelector(".chips .chip")
            .dataset.shortcut === "Host" """
    )
    assert row(phone)[:3] == ["Host", "media", "climate"]


def test_home_leaves_out_what_someone_hid(phone):
    mount_with_prefs(phone, SHORTCUTS, {"hidden_chips": ["chip:lights", "block:Host"]})
    phone.wait_for_function(
        """() => !document.querySelector("home-dashboard-page").shadowRoot.querySelector("[data-chip='lights']")"""
    )
    assert "Host" not in row(phone)
    assert "climate" in row(phone)


def test_a_chip_hidden_for_oneself_stays_in_the_menu(phone):
    result = phone.evaluate(
        """(raw) => {
            const { model, hass } = window.dashboard;
            const config = model.personalize(model.normalizeConfig(raw), "kid", { hidden_chips: ["block:Host"] });
            return model.shownShortcuts(hass(), config).map((item) => item.name);
        }""",
        SHORTCUTS,
    )
    assert "Host" in result


def test_a_chip_that_filters_the_page_stays_until_the_filter_is_off(phone):
    result = phone.evaluate("""() => {
        const { model } = window.dashboard;
        const config = model.personalize(model.normalizeConfig({}), "kid", { hidden_chips: ["chip:lights"] });
        const entries = [{ id: "chip:lights" }, { id: "chip:media" }];
        return [model.arrangeChips(entries, config, "chip:lights").length, model.arrangeChips(entries, config).length];
    }""")
    assert result == [2, 1]


def test_moving_a_chip_saves_it_with_the_account(phone):
    open_personal(phone)
    open_tab(phone)
    phone.locator(f"{SHEET} [data-order='chip:media'] [data-personal='up']").click()
    order = user_data(phone)[-1]["value"]["chips"]
    assert order.index("chip:media") < order.index("chip:security")
    assert user_data(phone)[-1]["key"] == "home_dashboard"


def test_hiding_a_chip_saves_it_and_can_be_undone(phone):
    open_personal(phone)
    open_tab(phone)
    button = phone.locator(f"{SHEET} [data-order='chip:media'] [data-personal='hide']")
    button.click()
    assert user_data(phone)[-1]["value"]["hidden_chips"] == ["chip:media"]
    button.click()
    assert user_data(phone)[-1]["value"]["hidden_chips"] == []


def test_my_layout_opens_from_home_only(phone):
    phone.evaluate("window.history.replaceState(null, '', '?room=r')")
    mount_admin(phone, {"layout": [{"id": "r", "name": "R", "areas": [], "home": [], "sections": []}]}, "room")
    phone.locator("home-dashboard-page [data-rooms]").click()
    phone.wait_for_selector(f"{SHEET} [data-home-link]")
    assert phone.locator(f"{SHEET} [data-sheet-personal]").count() == 0
    assert phone.locator(f"{SHEET} [data-sheet-access]").count() == 1


# Access ------------------------------------------------------------------------------------------

def open_access(page, raw: dict) -> None:
    mount_admin(page, raw)
    page.evaluate(
        """() => {
            const hass = document.querySelector("home-dashboard-chrome").hass;
            const original = hass.callWS;
            hass.callWS = (message) => message.type === "config/auth/list"
                ? Promise.resolve([
                    { id: hass.user.id, name: "Ja", is_active: true, is_owner: true },
                    { id: "kid", name: "Dziecko", is_active: true },
                    { id: "mum", name: "Mama", is_active: true },
                ])
                : original(message);
        }"""
    )
    page.locator("home-dashboard-page [data-rooms]").click()
    page.locator(f"{SHEET} [data-sheet-access]").click()
    page.wait_for_selector(f"{SHEET} [data-access-user] option[value='kid']", state="attached")
    page.locator(f"{SHEET} [data-tab='chips']").click()
    page.wait_for_selector(f"{SHEET} [data-access='block:Host']")


def saved_access(page) -> dict:
    page.locator(f"{SHEET} [data-access-save]").click()
    page.wait_for_function("window.saved.length > 0")
    return page.evaluate("window.saved.at(-1).config.strategy.access")


def everyone_else(page) -> None:
    page.locator(f"{SHEET} [data-access-user]").select_option("__everyone_else")


def test_access_hides_a_shortcut_from_one_person(phone):
    open_access(phone, SHORTCUTS)
    phone.locator(f"{SHEET} [data-access-user]").select_option("kid")
    phone.locator(f"{SHEET} [data-access='block:Host'] button").click()
    access = saved_access(phone)
    assert access["kid"]["hide"] == ["block:Host"]
    assert "mum" not in access


def test_a_shortcut_with_an_entity_can_be_taken_away_too(phone):
    open_access(phone, SHORTCUTS)
    assert phone.locator(f"{SHEET} [data-access='block:Serwer']").count() == 1


def test_everyone_but_me_hides_a_block_from_all_the_others(phone):
    open_access(phone, SHORTCUTS)
    everyone_else(phone)
    phone.locator(f"{SHEET} [data-access='block:Host'] button").click()
    access = saved_access(phone)
    assert access["kid"]["hide"] == ["block:Host"]
    assert access["mum"]["hide"] == ["block:Host"]
    assert phone.evaluate("window.hass.user.id") not in access


def test_everyone_but_me_shows_as_hidden_only_when_all_have_it_hidden(phone):
    open_access(phone, {**SHORTCUTS, "access": {"kid": {"hide": ["block:Host"]}}})
    everyone_else(phone)
    row_of_host = phone.locator(f"{SHEET} [data-access='block:Host']")
    assert "muted" not in row_of_host.get_attribute("class")
    row_of_host.locator("button").click()
    assert "muted" in phone.locator(f"{SHEET} [data-access='block:Host']").get_attribute("class")
    phone.locator(f"{SHEET} [data-access='block:Host'] button").click()
    access = saved_access(phone)
    assert access["kid"]["hide"] == []
    assert access["mum"]["hide"] == []


def test_a_person_can_lose_a_chip_like_the_weather(phone):
    result = phone.evaluate("""() => {
        const { model } = window.dashboard;
        const shared = model.normalizeConfig({ access: { kid: { hide: ["chip:weather"] } } });
        const entries = [{ id: "chip:weather" }, { id: "chip:media" }];
        const ids = (user) => model.arrangeChips(entries, model.personalize(shared, user)).map(({ id }) => id);
        return [ids("kid"), ids("parent")];
    }""")
    assert result == [["chip:media"], ["chip:weather", "chip:media"]]
