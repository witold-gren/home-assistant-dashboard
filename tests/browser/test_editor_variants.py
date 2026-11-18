"""Variants of a page in the editor: the node "Variants" of Home and of every room, cards with what to do with each,
a preview of a card, editing a variant as the page itself (the draft waits), "Who sees it", and making a variant
the published page with the old one kept as a variant."""


# ruff: noqa: F811 (fixtures imported from another test module are its arguments)

from __future__ import annotations

from .test_editor_app import APP, STRATEGY, desktop, open_editor, select, server  # noqa: F401

PANEL = f"{APP} home-dashboard-editor-variants"
ACCESS = f"{APP} home-dashboard-editor-variant-access"
USERS = [{"id": "u-jan", "name": "Jan"}, {"id": "u-maria", "name": "Maria"}]


ASK = f"{APP} home-dashboard-editor-ask"


def answer(page, text: str | None = None, ok: bool = True) -> None:
    """Answer the editor's own question: type into its field (when given) and confirm, or cancel."""
    page.wait_for_selector(f"{ASK} [data-ask]")
    if text is not None:
        page.locator(f"{ASK} [data-ask-input]").fill(text)
    page.locator(f"{ASK} [data-ask-ok]" if ok else f"{ASK} [data-ask-cancel]").click()
    page.wait_for_selector(ASK, state="detached")


def sent(page, kind: str) -> list:
    return page.evaluate(
        f"window.editor.server.state.sent.filter((m) => m.type === 'home_dashboard/variants/{kind}')"
    )


def preview(page) -> dict:
    return page.evaluate("window.editor.app._source.strategy")


def cards(page) -> list[str]:
    return page.locator(f"{PANEL} [data-variant-card] b").all_inner_texts()


def new_variant(page, name: str) -> None:
    page.locator(f"{PANEL} [data-variant-new]").click()
    answer(page, name)
    page.wait_for_function(
        f"[...document.querySelector('{APP}').shadowRoot.querySelector('home-dashboard-editor-variants').shadowRoot.querySelectorAll('[data-variant-card] b')].some((b) => b.textContent === {name!r})"
    )


def test_home_and_every_room_have_variants(desktop):
    open_editor(desktop)
    keys = desktop.locator(f"{APP} [data-node^='variants/']").evaluate_all(
        "(all) => all.map((n) => n.dataset.node)"
    )
    assert keys == ["variants/home", "variants/room:living", "variants/room:kitchen"]
    select(desktop, "variants/home")
    desktop.wait_for_selector(f"{PANEL} [data-variant-card='live']")
    assert desktop.locator(f"{APP} [data-props-title]").inner_text() == "Warianty strony głównej"
    assert cards(desktop) == ["Obowiązujący"]


def test_a_new_variant_is_a_copy_and_changes_nothing_live(desktop):
    open_editor(desktop)
    select(desktop, "variants/room:living")
    new_variant(desktop, "Salon B")
    created = sent(desktop, "create")[0]
    assert created["page"] == "room:living" and created["name"] == "Salon B" and "from" not in created
    assert server(desktop)["live"]["strategy"] == STRATEGY
    assert server(desktop)["draft"] is None


def test_a_chosen_card_shows_in_the_preview(desktop):
    open_editor(desktop)
    select(desktop, "variants/room:living")
    new_variant(desktop, "Salon B")
    variant = desktop.evaluate("window.editor.server.state.variants['room:living'].items[0]")
    variant["slice"]["room"]["name"] = "Salon w wariancie"
    desktop.evaluate(
        "(slice) => { window.editor.server.state.variants['room:living'].items[0].slice = slice; }",
        variant["slice"],
    )
    # The panel reads the variants again, as after any change it makes.
    desktop.evaluate(
        f"document.querySelector('{APP}').shadowRoot.querySelector('home-dashboard-editor-variants').reload()"
    )
    desktop.locator(f"{PANEL} [data-variant-card='{variant['id']}'] .name b").click()
    assert preview(desktop)["layout"][0]["name"] == "Salon w wariancie"
    # Choosing something else in the tree shows the draft again.
    select(desktop, "favorites")
    assert preview(desktop)["layout"][0]["name"] == "Salon"


def test_editing_a_variant_saves_its_page_into_it(desktop):
    open_editor(desktop)
    select(desktop, "variants/room:living")
    new_variant(desktop, "Salon B")
    variant_id = desktop.evaluate("window.editor.server.state.variants['room:living'].items[0].id")
    desktop.locator(f"{PANEL} [data-variant-card='{variant_id}'] .name b").click()
    desktop.locator(f"{PANEL} [data-variant-action='edit']").click()
    desktop.wait_for_selector(f"{APP} [data-variant-state]")
    assert "Salon B" in desktop.locator(f"{APP} [data-variant-state]").inner_text()
    assert desktop.locator(f"{APP} [data-publish]").is_disabled()
    # A change of the room goes to the variant, not to a draft.
    desktop.evaluate(
        "() => { const app = window.editor.app; const s = structuredClone(app._strategy); s.layout[0].name = 'Salon zmieniony'; s.menu = [{ path: '/x' }]; app._change(s); }"
    )
    desktop.wait_for_function(
        "window.editor.server.state.sent.some((m) => m.type === 'home_dashboard/variants/update' && m.slice)"
    )
    update = [m for m in sent(desktop, "update") if "slice" in m][-1]
    assert update["slice"]["room"]["name"] == "Salon zmieniony"
    assert "menu" not in update["slice"]
    # The menu is not of this page: it went to the draft, with the room as it is published.
    draft = server(desktop)["draft"]["config"]["strategy"]
    assert draft["menu"] == [{"path": "/x"}]
    assert draft["layout"][0]["name"] == "Salon"
    assert preview(desktop)["layout"][0]["name"] == "Salon zmieniony"
    # Done: back to the draft and the published page.
    desktop.locator(f"{APP} [data-variant-end]").click()
    assert desktop.locator(f"{APP} [data-variant-state]").count() == 0
    assert preview(desktop)["layout"][0]["name"] == "Salon"
    assert server(desktop)["live"]["strategy"] == STRATEGY


def test_who_sees_a_variant(desktop):
    open_editor(desktop, users=USERS)
    desktop.evaluate(
        "window.editor.server.state.devices.push({ id: 'tok-ipad', name: null, label: 'iPad (app)', user_id: 'u-family', user_name: 'Rodzina', seen: '2026-11-18T10:00:00Z' })"
    )
    select(desktop, "variants/home")
    new_variant(desktop, "Sekcje")
    variant_id = desktop.evaluate("window.editor.server.state.variants.home.items[0].id")
    desktop.locator(f"{PANEL} [data-variant-card='{variant_id}'] .name b").click()
    desktop.locator(f"{PANEL} [data-variant-action='who']").click()
    desktop.wait_for_selector(f"{ACCESS} [data-variant-access]")
    desktop.locator(f"{ACCESS} [data-device-name='tok-ipad']").fill("iPad w holu")
    desktop.locator(f"{ACCESS} [data-variant-for='devices:tok-ipad']").select_option(variant_id)
    desktop.locator(f"{ACCESS} [data-variant-for='people:u-jan']").select_option(variant_id)
    desktop.locator(f"{ACCESS} [data-variant-access-save]").click()
    desktop.wait_for_selector(f"{ACCESS}", state="detached")
    assign = sent(desktop, "assign")[-1]
    assert assign["devices"] == {"tok-ipad": variant_id}
    assert assign["people"] == {"u-jan": variant_id, "u-maria": None}
    assert desktop.evaluate("window.editor.server.state.devices[0].name") == "iPad w holu"
    # The card says who sees it.
    desktop.wait_for_function(
        f"document.querySelector('{APP}').shadowRoot.querySelector('home-dashboard-editor-variants').shadowRoot.textContent.includes('iPad w holu')"
    )
    badges = desktop.locator(f"{PANEL} [data-variant-card='{variant_id}'] .badge").all_inner_texts()
    assert "iPad w holu" in badges and "Jan" in badges


def test_making_a_variant_the_published_page_keeps_the_old_one(desktop):
    open_editor(desktop)
    select(desktop, "variants/room:living")
    new_variant(desktop, "Salon B")
    state = "window.editor.server.state.variants['room:living']"
    desktop.evaluate(f"{state}.items[0].slice.room.name = 'Nowy salon'")
    variant_id = desktop.evaluate(f"{state}.items[0].id")
    desktop.locator(f"{PANEL} [data-variant-card='{variant_id}'] .name b").click()
    desktop.locator(f"{PANEL} [data-variant-action='deploy']").click()
    assert "Salon B" in desktop.locator(f"{ASK} [data-ask-title]").inner_text()
    answer(desktop)
    desktop.wait_for_function("window.editor.server.state.live.strategy.layout[0].name === 'Nowy salon'")
    live = server(desktop)["live"]["strategy"]
    assert live["layout"][1] == STRATEGY["layout"][1]
    assert live["favorites"] == STRATEGY["favorites"]
    # The old page is a variant now, the new one is published, and the editor shows it.
    desktop.wait_for_function(
        f"document.querySelector('{APP}').shadowRoot.querySelector('home-dashboard-editor-variants')?.shadowRoot.querySelectorAll('[data-variant-card]').length === 2"
    )
    assert cards(desktop) == ["Salon B", "Poprzednia wersja"]
    assert desktop.evaluate("window.editor.app._strategy.layout[0].name") == "Nowy salon"


def test_deleting_and_naming(desktop):
    open_editor(desktop)
    select(desktop, "variants/home")
    new_variant(desktop, "Sekcje")
    variant_id = desktop.evaluate("window.editor.server.state.variants.home.items[0].id")
    desktop.locator(f"{PANEL} [data-variant-rename='live']").click()
    answer(desktop, "Klasyczna")
    desktop.wait_for_function("window.editor.server.state.variants.home.live_name === 'Klasyczna'")
    desktop.locator(f"{PANEL} [data-variant-delete='{variant_id}']").click()
    answer(desktop)
    desktop.wait_for_function("window.editor.server.state.variants.home.items.length === 0")
    assert cards(desktop) == ["Klasyczna"]


def test_the_help_of_variants_opens_its_chapter(desktop):
    open_editor(desktop)
    select(desktop, "variants/home")
    assert (
        desktop.locator(f"{APP} [data-props] [data-help='props']").get_attribute("data-anchor")
        == "page-variants"
    )


def test_the_questions_are_the_editors_own_and_can_be_cancelled(desktop):
    open_editor(desktop)
    select(desktop, "variants/home")
    desktop.on("dialog", lambda dialog: (_ for _ in ()).throw(AssertionError("a browser dialog")))
    desktop.locator(f"{PANEL} [data-variant-new]").click()
    desktop.wait_for_selector(f"{ASK} [data-ask]")
    assert desktop.locator(f"{ASK} [data-ask-input]").input_value() == "Nowy wariant"
    # An empty name cannot be confirmed; Escape cancels and nothing is made.
    desktop.locator(f"{ASK} [data-ask-input]").fill("")
    assert desktop.locator(f"{ASK} [data-ask-ok]").is_disabled()
    desktop.keyboard.press("Escape")
    desktop.wait_for_selector(ASK, state="detached")
    assert sent(desktop, "create") == []
    # Enter confirms.
    desktop.locator(f"{PANEL} [data-variant-new]").click()
    desktop.locator(f"{ASK} [data-ask-input]").fill("Wieczór")
    desktop.locator(f"{ASK} [data-ask-input]").press("Enter")
    desktop.wait_for_function(
        "window.editor.server.state.sent.some((m) => m.type === 'home_dashboard/variants/create')"
    )
    assert sent(desktop, "create")[0]["name"] == "Wieczór"


def test_cancelling_a_deletion_keeps_the_variant(desktop):
    open_editor(desktop)
    select(desktop, "variants/home")
    new_variant(desktop, "Sekcje")
    variant_id = desktop.evaluate("window.editor.server.state.variants.home.items[0].id")
    desktop.locator(f"{PANEL} [data-variant-delete='{variant_id}']").click()
    answer(desktop, ok=False)
    assert sent(desktop, "delete") == []


# Devices -------------------------------------------------------------------------------------------------

DEVICES = f"{APP} home-dashboard-editor-known-devices"


def add_devices(page) -> None:
    page.evaluate(
        """() => window.editor.server.state.devices.push(
            { id: 'tok-ipad', name: null, label: 'iPad (app)', user_id: 'u-family', user_name: 'Rodzina', seen: '2026-11-18T10:00:00Z' },
            { id: 'tok-phone', name: 'iPhone Jana', label: 'iPhone (app)', user_id: 'u-jan', user_name: 'Jan', seen: '2026-11-18T11:00:00Z' })"""
    )


def test_the_devices_of_the_home_are_a_setting(desktop):
    open_editor(desktop, users=USERS)
    add_devices(desktop)
    select(desktop, "variants/home")
    new_variant(desktop, "Sekcje")
    variant_id = desktop.evaluate("window.editor.server.state.variants.home.items[0].id")
    desktop.evaluate(f"window.editor.server.state.variants.home.devices['tok-ipad'] = '{variant_id}'")
    select(desktop, "known_devices")
    desktop.wait_for_selector(f"{DEVICES} [data-known-device='tok-ipad']")
    assert desktop.locator(f"{APP} [data-props-title]").inner_text() == "Urządzenia"
    ipad = desktop.locator(f"{DEVICES} [data-known-device='tok-ipad']")
    assert "Rodzina" in ipad.inner_text() and "iPad (app)" in ipad.inner_text()
    assert ipad.locator("[data-shows='home']").inner_text().endswith("Strona główna: Sekcje")
    phone = desktop.locator(f"{DEVICES} [data-known-device='tok-phone']")
    assert phone.locator("[data-known-device-name]").input_value() == "iPhone Jana"
    assert "obowiązujące strony" in phone.inner_text()


def test_a_device_is_named_and_forgotten(desktop):
    open_editor(desktop, users=USERS)
    add_devices(desktop)
    select(desktop, "known_devices")
    field = desktop.locator(f"{DEVICES} [data-known-device-name='tok-ipad']")
    field.fill("iPad w holu")
    field.press("Enter")
    desktop.wait_for_function("window.editor.server.state.devices[0].name === 'iPad w holu'")
    desktop.locator(f"{DEVICES} [data-known-device-forget='tok-phone']").click()
    assert "iPhone Jana" in desktop.locator(f"{ASK} [data-ask-title]").inner_text()
    answer(desktop)
    desktop.wait_for_function("window.editor.server.state.devices.length === 1")
    desktop.wait_for_selector(f"{DEVICES} [data-known-device='tok-phone']", state="detached")


# Shared with the household, where the variants run ----------------------------------------------------


def test_a_variant_is_shared_with_the_household(desktop):
    open_editor(desktop)
    select(desktop, "variants/home")
    new_variant(desktop, "Sekcje")
    variant_id = desktop.evaluate("window.editor.server.state.variants.home.items[0].id")
    desktop.locator(f"{PANEL} [data-variant-card='{variant_id}'] .name b").click()
    desktop.locator(f"{PANEL} [data-variant-action='share']").click()
    desktop.wait_for_selector(f"{PANEL} [data-variant-card='{variant_id}'] [data-variant-shared]")
    assert [m for m in sent(desktop, "update") if "shared" in m][-1]["shared"] is True
    desktop.locator(f"{PANEL} [data-variant-action='unshare']").click()
    desktop.wait_for_selector(
        f"{PANEL} [data-variant-card='{variant_id}'] [data-variant-shared]", state="detached"
    )


def test_the_magnifier_shows_where_every_variant_runs(desktop):
    open_editor(desktop, users=USERS)
    add_devices(desktop)
    select(desktop, "variants/home")
    new_variant(desktop, "Sekcje")
    variant_id = desktop.evaluate("window.editor.server.state.variants.home.items[0].id")
    desktop.evaluate(
        f"""() => {{ const home = window.editor.server.state.variants.home;
            home.items[0].shared = true; home.devices['tok-ipad'] = '{variant_id}';
            home.people['u-maria'] = '{variant_id}'; home.self = ['u-maria']; home.live_name = 'Klasyczna'; }}"""
    )
    desktop.locator(f"{APP} [data-variants-overview]").click()
    overview = desktop.locator(f"{APP} home-dashboard-editor-variant-overview [data-variant-overview]")
    overview.wait_for()
    page = overview.locator("[data-overview-page='home']")
    assert "Strona główna" in page.locator("h3").inner_text()
    assert "Klasyczna" in page.locator("[data-overview-variant='live']").inner_text()
    variant = page.locator(f"[data-overview-variant='{variant_id}']")
    text = variant.inner_text()
    assert "Sekcje" in text and "Udostępniony" in text
    assert "iPad (app) · Rodzina" in variant.locator("[data-overview-device='tok-ipad']").inner_text()
    assert "wybrał sam" in variant.locator("[data-overview-person='u-maria']").inner_text()
    # One known device sees the published page.
    assert "1" in page.locator("[data-overview-variant='live'] small").inner_text()
    desktop.keyboard.press("Escape")
    desktop.wait_for_selector(f"{APP} home-dashboard-editor-variant-overview", state="detached")


def test_a_change_outside_the_page_goes_to_the_draft_while_a_variant_is_edited(desktop):
    open_editor(desktop)
    select(desktop, "variants/room:living")
    new_variant(desktop, "Salon B")
    variant_id = desktop.evaluate("window.editor.server.state.variants['room:living'].items[0].id")
    desktop.locator(f"{PANEL} [data-variant-card='{variant_id}'] .name b").click()
    desktop.locator(f"{PANEL} [data-variant-action='edit']").click()
    desktop.wait_for_selector(f"{APP} [data-variant-state]")
    desktop.evaluate(
        """() => { const app = window.editor.app; const s = structuredClone(app._strategy);
            s.layout[0].name = 'Salon w wariancie'; s.layout[1].name = 'Kuchnia nowa';
            s.shortcuts = [...s.shortcuts, { kind: 'panel', name: 'Nowy blok' }]; app._change(s); }"""
    )
    desktop.wait_for_function("window.editor.server.state.draft !== null")
    draft = desktop.evaluate("window.editor.server.state.draft.config.strategy")
    assert draft["layout"][0]["name"] == "Salon"
    assert draft["layout"][1]["name"] == "Kuchnia nowa"
    assert draft["shortcuts"][-1]["name"] == "Nowy blok"
    update = [m for m in sent(desktop, "update") if "slice" in m][-1]
    assert update["slice"]["room"]["name"] == "Salon w wariancie"
    # The variant is shown with the draft's other changes; the published page is untouched.
    assert desktop.evaluate("window.editor.app._strategy.layout[1].name") == "Kuchnia nowa"
    assert server(desktop)["live"]["strategy"] == STRATEGY
