"""The sliders of the dashboard: a thick rounded bar filled up to its knob, the same everywhere."""

from __future__ import annotations

import os

from .test_panels import ON_TV, open_tv

MODULE = "/custom_components/home_dashboard/www/app/range.js"


def share(page, selector: str) -> str:
    return page.locator(selector).evaluate("(input) => input.style.getPropertyValue('--hd-range')")


def test_a_slider_is_filled_up_to_its_value_when_drawn_and_while_it_moves(phone):
    open_tv(phone, ON_TV)
    volume = round(ON_TV["attributes"]["volume_level"] * 100) / 100
    assert float(share(phone, "[data-tv-volume]")) == volume
    phone.locator("[data-tv-volume]").fill("35")
    assert share(phone, "[data-tv-volume]") == "0.35"
    if os.environ.get("HD_SHOT"):
        phone.screenshot(path=os.environ["HD_SHOT"])


def test_a_slider_is_a_thick_bar_and_not_the_line_of_the_browser(phone):
    open_tv(phone, ON_TV)
    look = phone.locator("[data-tv-volume]").evaluate(
        "(input) => { const style = getComputedStyle(input); return [style.appearance, style.height, style.borderRadius]; }"
    )
    assert look == ["none", "30px", "15px"]


def test_the_share_stays_between_nothing_and_all(phone):
    shares = phone.evaluate(f"""async () => {{
        const {{ rangeShare }} = await import('{MODULE}');
        const input = (min, max, value) => Object.assign(document.createElement('input'), {{ type: 'range', step: 'any', min, max, value }});
        const odd = document.createElement('input'); odd.type = 'range'; odd.min = '5'; odd.max = '5';
        return [rangeShare(input('0', '1', '0.25')), rangeShare(input('10', '30', '20')), rangeShare(odd)];
    }}""")
    assert shares == [0.25, 0.5, 0]
