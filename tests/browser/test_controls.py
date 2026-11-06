"""The arithmetic behind the touch controls."""

from __future__ import annotations

import pytest


def controls(page, body: str):
    return page.evaluate(f"""async () => {{
        const c = await import("/custom_components/home_dashboard/www/app/controls.js");
        return {body};
    }}""")


RANGE = "{ min: 10, max: 30, step: 0.5 }"


def test_temperature_steps_stay_in_range(phone):
    assert controls(
        phone,
        f"[c.stepTemperature(20, 1, {RANGE}), c.stepTemperature(30, 1, {RANGE}), c.stepTemperature(10, -1, {RANGE})]",
    ) == [20.5, 30, 10]


def test_slider_ratio(phone):
    rect = "{ top: 100, height: 200 }"
    assert controls(
        phone,
        f"[c.sliderRatio(300, {rect}), c.sliderRatio(100, {rect}), c.sliderRatio(200, {rect}), c.sliderRatio(0, {rect})]",
    ) == [0, 1, 0.5, 1]


@pytest.mark.parametrize(
    ("ratio", "locked", "intent"),
    [(0.5, True, None), (0.84, True, None), (0.9, True, "unlock"), (0.5, False, None), (0.1, False, "lock")],
)
def test_lock_moves_only_at_the_far_end(phone, ratio, locked, intent):
    assert controls(phone, f"c.lockIntent({ratio}, {str(locked).lower()})") == intent


def test_dial_maps_positions_to_temperatures(phone):
    # 100 is the centre: straight up is the middle of the range, the gap at the bottom snaps to an end
    values = controls(
        phone,
        f"""[c.dialValue(100, 0, 100, 100, {RANGE}),
             c.dialValue(30, 170, 100, 100, {RANGE}),
             c.dialValue(170, 170, 100, 100, {RANGE}),
             c.dialValue(95, 190, 100, 100, {RANGE}),
             c.dialValue(105, 190, 100, 100, {RANGE})]""",
    )
    assert values == [20, 10, 30, 10, 30]


def test_dial_angle_matches_the_value(phone):
    assert controls(phone, "[c.dialAngle(10, 10, 30), c.dialAngle(30, 10, 30), c.dialAngle(20, 10, 30)]") == [
        135,
        405,
        270,
    ]


def test_time_format(phone):
    assert controls(phone, "[c.formatTime(80), c.formatTime(0), c.formatTime(undefined), c.formatTime(3599)]") == [
        "1:20",
        "0:00",
        "0:00",
        "59:59",
    ]
