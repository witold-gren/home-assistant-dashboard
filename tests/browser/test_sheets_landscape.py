"""The windows of devices on a phone on its side: nothing lies over the header or the state under the controls."""

from __future__ import annotations

import pytest

from .test_page import mount

CHECK = """(kind) => {
    const sheet = document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet');
    const root = sheet.shadowRoot;
    const panel = root.querySelector('.panel');
    panel.scrollTop = 0;
    const header = root.querySelector('header').getBoundingClientRect();
    const body = root.querySelector('.center');
    const info = root.querySelector('.info');
    const parts = [...body.children].map((child) => child.getBoundingClientRect()).filter((box) => box.height);
    return {
        underHeader: parts.every((box) => box.top >= header.bottom - 1),
        aboveInfo: !info || parts.every((box) => box.bottom <= info.getBoundingClientRect().top + 1),
    };
}"""


@pytest.mark.parametrize("domain, kind", [("climate.", "climate"), ("cover.", "cover"), ("light.", "light"),
                                          ("alarm_control_panel.", "alarm")])
def test_a_window_on_its_side_keeps_its_parts_apart(phone, domain, kind):
    phone.set_viewport_size({"width": 874, "height": 402})
    phone.evaluate("""() => {
        const snapshot = window.dashboard.snapshot;
        snapshot.entities["alarm_control_panel.attic"] = { entity_id: "alarm_control_panel.attic", hidden: false };
        snapshot.states["alarm_control_panel.attic"] = { entity_id: "alarm_control_panel.attic", state: "armed_away",
            attributes: { friendly_name: "Poddasze", supported_features: 63 } };
    }""")
    mount(phone)
    entity = phone.evaluate("(prefix) => Object.keys(window.hass.states).find((id) => id.startsWith(prefix))", domain)
    if not entity:
        pytest.skip(f"no {domain} in the snapshot")
    phone.evaluate("""([entityId, kind]) => document.querySelector('home-dashboard-chrome')
        .open({ type: 'sheet', sheet: { kind, entityId } })""", [entity, kind])
    phone.wait_for_selector("home-dashboard-sheet .center")
    phone.wait_for_timeout(400)
    assert phone.evaluate(CHECK, kind) == {"underHeader": True, "aboveInfo": True}
