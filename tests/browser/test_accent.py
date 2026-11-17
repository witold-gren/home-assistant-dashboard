"""What is on in a window is milky: the colour of the writing, 90 % opaque, fitting any background (accent.js)."""

from __future__ import annotations

import os

from .test_panels import ON_TV, add_entity, open_block, room_with, tv_item

MODULE = "/custom_components/home_dashboard/www/app/accent.js"
APPEARANCE = "/custom_components/home_dashboard/www/app/appearance.js"
SHEET = "document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')"


def run(page, body: str):
    return page.evaluate(f"async () => {{ const a = await import('{MODULE}'); {body} }}")


def colour_of(page, css: str) -> str:
    return page.evaluate(
        """(css) => { const probe = document.createElement('div'); probe.style.color = css;
        document.body.append(probe); const colour = getComputedStyle(probe).color; probe.remove(); return colour; }""",
        css,
    )


def open_tv_in(page, appearance: dict | None = None) -> None:
    add_entity(page, "media_player.tv", ON_TV["state"], ON_TV["attributes"])
    dashboard = {
        "entities": {"include": {}},
        **room_with(tv_item()),
        **({"appearance": appearance} if appearance else {}),
    }
    open_block(page, dashboard, "Telewizor")


def on_button(page) -> dict:
    return page.evaluate(f"""() => {{ const style = getComputedStyle({SHEET}.shadowRoot.querySelector('.block-action.on'));
        return {{ background: style.backgroundColor, color: style.color }}; }}""")


def test_white_writing_makes_a_milky_white_button_with_dark_writing(phone):
    assert run(phone, "return a.milkyFor('#ffffff');") == {
        "fill": "color-mix(in srgb, #ffffff 90%, transparent)",
        "ink": "#1d1d1f",
    }
    assert run(phone, "return a.milkyFor('#1d1d1f').ink;") == "#ffffff"
    assert run(phone, "return [a.milkyFor(null), a.accentFor('nonsense')];") == [None, None]


def test_a_colour_of_its_own_carries_writing_that_reads_on_it(phone):
    assert run(phone, "return [a.accentFor('#ffd60a').ink, a.accentFor('#0b57d0').ink];") == [
        "#1d1d1f",
        "#ffffff",
    ]


def test_the_look_decides_the_colour_and_the_writing_by_default(phone):
    styles = phone.evaluate(f"""async () => {{ const {{ sheetVariables }} = await import('{APPEARANCE}');
        return [sheetVariables({{ sheets: {{ text: '#ffffff' }} }}), sheetVariables({{ sheets: {{ text: '#ffffff', accent: '#ffd60a' }} }}),
                sheetVariables({{}})]; }}""")
    assert (
        "--hd-ov-accent: color-mix(in srgb, #ffffff 90%, transparent); --hd-ov-accent-ink: #1d1d1f"
        in styles[0]
    )
    assert "--hd-ov-accent: #ffd60a; --hd-ov-accent-ink: #1d1d1f" in styles[1]
    assert "--hd-ov-accent" not in styles[2]


def test_on_a_coloured_window_the_button_that_is_on_is_milky_white(phone):
    open_tv_in(phone, {"sheets": {"background": "#7a3fb0", "text": "#ffffff", "controls": "#ffffff33"}})
    button = on_button(phone)
    assert button["background"] == colour_of(phone, "color-mix(in srgb, #ffffff 90%, transparent)")
    assert button["color"] == colour_of(phone, "#1d1d1f")
    if os.environ.get("HD_SHOT"):
        phone.screenshot(path=os.environ["HD_SHOT"])


def test_in_a_light_window_it_is_the_dark_writing_with_white_on_it(phone):
    open_tv_in(phone)
    button = on_button(phone)
    assert button["color"] == colour_of(phone, "#ffffff")
    assert button["background"] != colour_of(phone, "#0c7c4f")
