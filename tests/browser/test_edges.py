"""The background stays where it is while the page bounces: on the dashboard it lies on the view."""

from __future__ import annotations

STYLES = "/custom_components/home_dashboard/www/app/styles.js"

MOUNT_IN_ROOT = """async (dashboard) => {
    const root = document.createElement("hui-root");
    const shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML = '<div class="header">x</div><div id="view"><hui-view-background></hui-view-background></div>';
    document.body.appendChild(root);
    window.view = shadow.querySelector("#view");
    window.card = await window.dashboard.mount(window.dashboard.hass(), dashboard, "home", window.view);
    await window.card.updateComplete;
}"""


def run(page, body: str, arg=None):
    return page.evaluate(f"async (arg) => {{ const s = await import('{STYLES}'); {body} }}", arg)


def test_a_picture_on_the_view_keeps_its_part_and_its_veil(phone):
    value = run(phone, "return s.viewBackgroundFor('/local/home.jpg', 'top', 0.25);")
    assert value == ('linear-gradient(rgba(251, 250, 255, 0.25), rgba(251, 250, 255, 0.25)), '
                     'url("/local/home.jpg") center top / cover no-repeat, #fbfaff')


def test_colours_and_gradients_go_on_the_view_too(phone):
    gradient = run(phone, "return s.viewBackgroundFor('linear-gradient(#111111, #222222)', 'center', 0);")
    colour = run(phone, "return s.viewBackgroundFor('#123456', 'center', 0);")
    assert ", linear-gradient(#111111, #222222), " in gradient
    assert ", linear-gradient(#123456, #123456), " in colour
    assert run(phone, "return s.viewBackgroundFor(null);") is None


def test_nothing_can_end_the_declaration(phone):
    value = run(phone, """return s.viewBackgroundFor('/local/a.jpg"); color: red; {x}');""")
    assert '";' not in value and "{" not in value


def test_on_the_dashboard_the_view_carries_the_background(phone):
    phone.evaluate(MOUNT_IN_ROOT, {"backgrounds": {"home": {"light": "linear-gradient(#111111, #222222)"}}})
    result = phone.evaluate("""() => ({
        view: window.view.style.getPropertyValue("background-image"),
        priority: window.view.style.getPropertyPriority("background"),
        backdrop: window.card.shadowRoot.querySelectorAll(".backdrop").length,
        host: getComputedStyle(window.card).backgroundColor,
        haBackground: getComputedStyle(window.view.querySelector("hui-view-background")).display,
    })""")
    assert "linear-gradient(rgb(17, 17, 17), rgb(34, 34, 34))" in result["view"]
    assert result["priority"] == "important"
    assert result["backdrop"] == 0
    assert result["host"] == "rgba(0, 0, 0, 0)"
    assert result["haBackground"] == "none"


def test_a_page_without_a_background_leaves_the_view_plain(phone):
    phone.evaluate(MOUNT_IN_ROOT, {})
    assert phone.evaluate("window.view.style.getPropertyValue('background-image')") == ""
    assert phone.evaluate("getComputedStyle(window.card).backgroundColor") != "rgba(0, 0, 0, 0)"


def test_a_short_page_still_scrolls_a_little_so_it_can_bounce(phone):
    phone.evaluate(MOUNT_IN_ROOT, {})
    sizes = phone.evaluate("""() => {
        window.view.style.height = '874px';
        window.view.style.overflowY = 'auto';
        return [window.view.scrollHeight, window.view.clientHeight, window.card.hasAttribute('bounce')];
    }""")
    assert sizes[2] is True
    assert sizes[0] > sizes[1]


def test_without_the_bounce_a_short_page_keeps_its_height(phone):
    phone.evaluate("""() => {
        const original = window.dashboard.hass;
        window.dashboard.hass = (overrides) => {
            const instance = original(overrides);
            const answer = instance.callWS;
            instance.callWS = (message) => message.type === "frontend/get_user_data"
                ? Promise.resolve({ value: { appearance: { bounce: false } } }) : answer(message);
            return instance;
        };
    }""")
    phone.evaluate(MOUNT_IN_ROOT, {})
    phone.wait_for_function("!window.card.hasAttribute('bounce')")


def test_a_page_shown_again_brings_its_own_background_back(phone):
    result = phone.evaluate("""async () => {
        const root = document.createElement("hui-root");
        const shadow = root.attachShadow({ mode: "open" });
        shadow.innerHTML = '<div class="header">x</div><div id="view"></div>';
        document.body.appendChild(root);
        const view = shadow.querySelector("#view");
        const dashboard = { layout: [{ id: "r", name: "Pralnia", areas: [], home: [], sections: [] }],
            backgrounds: { home: { light: "#111111" }, r: { light: "#222222" } } };
        const hass = window.dashboard.hass();
        const home = await window.dashboard.mount(hass, dashboard, "home", view);
        const shown = () => view.style.getPropertyValue("background-image");
        const first = shown();
        // Home Assistant keeps the element of a view and puts it back, as when going back to Home.
        home.remove();
        window.history.replaceState(null, "", "?room=r");
        const room = await window.dashboard.mount(hass, dashboard, "room", view);
        await new Promise((resolve) => setTimeout(resolve, 100));
        const second = shown();
        room.remove();
        view.appendChild(home);
        await home.updateComplete;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [first, second, shown()];
    }""")
    assert "rgb(17, 17, 17)" in result[0]
    assert "rgb(34, 34, 34)" in result[1]
    assert result[2] == result[0]


def test_the_map_and_energy_have_backgrounds_of_their_own(phone):
    for name in ("map", "energy"):
        phone.evaluate("() => document.body.replaceChildren()")
        phone.evaluate(MOUNT_IN_ROOT.replace('"home", window.view', f'"{name}", window.view'),
                       {"backgrounds": {name: {"light": "#123456"}, "home": {"light": "#654321"}}})
        assert "rgb(18, 52, 86)" in phone.evaluate("window.view.style.getPropertyValue('background-image')")
