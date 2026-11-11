"""Pinching into the picture of a camera window: zoom around the fingers, move a zoomed picture, double tap."""

from __future__ import annotations

from .test_camera_controls import open_slup

# A picture the size of a real camera's, 16:9.
WIDE = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#456"/></svg>'


def open_camera(page) -> None:
    page.route("**/api/*_proxy/**", lambda route: route.fulfill(body=WIDE, content_type="image/svg+xml"))
    open_slup(page)
    page.wait_for_function(f"{SHEET_JS}.shadowRoot.querySelector('.picture img')?.naturalWidth === 1600")

SHEET = "home-dashboard-sheet"
SHEET_JS = "document.querySelector('home-dashboard-chrome').shadowRoot.querySelector('home-dashboard-sheet')"

ZOOM = "async () => await import('/custom_components/home_dashboard/www/app/zoom.js')"


def zoom_module(page, body: str):
    return page.evaluate(f"async () => {{ const z = await import('/custom_components/home_dashboard/www/app/zoom.js'); {body} }}")


def test_a_view_never_shows_past_the_picture(phone):
    views = zoom_module(phone, """return [z.clampView({ scale: 9, x: 50, y: -5000 }, 400, 200),
        z.clampView({ scale: 0.5, x: -10, y: -10 }, 400, 200)];""")
    assert views == [{"scale": 4, "x": 0, "y": -600}, {"scale": 1, "x": 0, "y": 0}]


def test_zooming_keeps_the_point_under_the_fingers(phone):
    view = zoom_module(phone, "return z.zoomAround({ scale: 1, x: 0, y: 0 }, 2, { x: 100, y: 50 }, 400, 200);")
    # The point at 100, 50 is still at 100, 50: 100 - 100 * 2 = -100.
    assert view == {"scale": 2, "x": -100, "y": -50}


def box(page):
    return page.locator(f"{SHEET} .stage > .picture").bounding_box()


def pointer(page, kind: str, pointer_id: int, x: float, y: float) -> None:
    page.evaluate(f"""([kind, id, x, y]) => {SHEET_JS}.shadowRoot.querySelector('.stage').dispatchEvent(
        new PointerEvent(kind, {{ pointerId: id, clientX: x, clientY: y, bubbles: true, composed: true, isPrimary: id === 1 }}))""",
        [kind, pointer_id, x, y])


def transform(page) -> str:
    return page.evaluate(f"{SHEET_JS}.shadowRoot.querySelector('.stage > .picture').style.transform")


def pinch(page, spread: float) -> None:
    b = box(page)
    cx, cy = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    pointer(page, "pointerdown", 1, cx - 20, cy)
    pointer(page, "pointerdown", 2, cx + 20, cy)
    pointer(page, "pointermove", 1, cx - 20 * spread, cy)
    pointer(page, "pointermove", 2, cx + 20 * spread, cy)
    pointer(page, "pointerup", 1, cx - 20 * spread, cy)
    pointer(page, "pointerup", 2, cx + 20 * spread, cy)


def test_spreading_two_fingers_zooms_in_and_says_how_much(phone):
    open_camera(phone)
    pinch(phone, 2)
    assert "scale(2)" in transform(phone)
    phone.wait_for_selector(f"{SHEET} [data-zoom-reset]")
    assert phone.locator(f"{SHEET} [data-zoom-reset]").inner_text().strip() == "2\u00d7"
    assert "zoomed" in phone.locator(f"{SHEET} .stage").get_attribute("class")
    # The badge takes it back to the whole picture.
    phone.locator(f"{SHEET} [data-zoom-reset]").click()
    phone.wait_for_selector(f"{SHEET} [data-zoom-reset]", state="detached")
    assert transform(phone) == ""


def test_one_finger_moves_a_zoomed_picture_within_its_edges(phone):
    open_camera(phone)
    pinch(phone, 2)
    b = box(phone)
    pointer(phone, "pointerdown", 3, b["x"] + 50, b["y"] + 50)
    pointer(phone, "pointermove", 3, b["x"] + 2000, b["y"] + 50)
    pointer(phone, "pointerup", 3, b["x"] + 2000, b["y"] + 50)
    # Far to the right, but no further than the left edge of the picture.
    assert transform(phone).startswith("translate(0px")


def test_a_double_tap_zooms_in_and_another_zooms_out(phone):
    open_camera(phone)
    b = box(phone)
    x, y = b["x"] + 80, b["y"] + 60
    for _ in range(2):
        pointer(phone, "pointerdown", 1, x, y)
        pointer(phone, "pointerup", 1, x, y)
    assert "scale(2.5)" in transform(phone)
    for _ in range(2):
        pointer(phone, "pointerdown", 1, x, y)
        pointer(phone, "pointerup", 1, x, y)
    assert transform(phone) == ""


def test_the_whole_picture_comes_back_with_the_live_view(phone):
    open_camera(phone)
    pinch(phone, 2)
    phone.wait_for_selector(f"{SHEET} [data-zoom-reset]")
    phone.evaluate(f"async () => {{ const sheet = {SHEET_JS}; sheet._live = true; await sheet.updateComplete; await sheet.updateComplete; }}")
    phone.wait_for_selector(f"{SHEET} [data-zoom-reset]", state="detached")


def test_a_pinch_is_not_a_tap_on_the_picture(phone):
    open_camera(phone)
    pinch(phone, 1.5)
    assert phone.evaluate(f"{SHEET_JS}._zoomer.takeGesture()") is True
    assert phone.evaluate(f"{SHEET_JS}._zoomer.takeGesture()") is False


def test_a_real_two_finger_pinch_on_a_touch_screen(moving_phone):
    page = moving_phone
    open_camera(page)
    page.wait_for_timeout(800)  # the window slides in first
    b = box(page)
    cx, cy = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    session = page.context.new_cdp_session(page)
    def send(kind, points):
        session.send("Input.dispatchTouchEvent", {
            "type": kind, "touchPoints": [{"x": x, "y": y, "id": index} for index, (x, y) in enumerate(points)]})
    send("touchStart", [(cx - 30, cy), (cx + 30, cy)])
    for step in range(1, 11):
        send("touchMove", [(cx - 30 - 3 * step, cy), (cx + 30 + 3 * step, cy)])
    send("touchEnd", [])
    page.wait_for_selector(f"{SHEET} [data-zoom-reset]")
    assert "scale(2)" in transform(page)


def test_a_finger_whose_lifting_was_lost_does_not_turn_one_finger_into_a_pinch(phone):
    open_camera(phone)
    pinch(phone, 2)
    b = box(phone)
    cx, cy = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    # A second pinch whose first finger's lifting never arrives (as iOS sometimes does).
    pointer(phone, "pointerdown", 4, cx - 20, cy)
    pointer(phone, "pointerdown", 5, cx + 20, cy)
    pointer(phone, "pointerup", 5, cx + 20, cy)
    before = transform(phone)
    # A new touch with one finger only moves the picture: its scale stays.
    phone.evaluate(f"""([x, y]) => {{ const stage = {SHEET_JS}.shadowRoot.querySelector('.stage');
        const send = (kind, px) => stage.dispatchEvent(new PointerEvent(kind, {{ pointerId: 6, isPrimary: true, clientX: px, clientY: y, bubbles: true, composed: true }}));
        send('pointerdown', x); send('pointermove', x + 30); send('pointermove', x + 60); send('pointerup', x + 60); }}""", [cx, cy])
    after = transform(phone)
    assert after.split("scale(")[1] == before.split("scale(")[1]


# Touch events as a phone sends them, each listing the fingers still on the screen. (Chrome's touch emulation
# cannot lift one finger of two, so the lifting is sent this way.)
TOUCH = f"""([kind, fingers, changed]) => {{
    const stage = {SHEET_JS}.shadowRoot.querySelector('.stage');
    const touch = ([id, x, y]) => new Touch({{ identifier: id, target: stage, clientX: x, clientY: y }});
    stage.dispatchEvent(new TouchEvent(kind, {{ touches: fingers.map(touch), changedTouches: changed.map(touch),
        bubbles: true, composed: true, cancelable: true }}));
}}"""


def test_after_a_pinch_the_finger_left_only_moves_the_picture(phone):
    open_camera(phone)
    b = box(phone)
    cx, cy = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2

    def send(kind: str, fingers: list, changed: list) -> None:
        phone.evaluate(TOUCH, [kind, fingers, changed])

    send("touchstart", [[0, cx - 30, cy]], [[0, cx - 30, cy]])
    send("touchstart", [[0, cx - 30, cy], [1, cx + 30, cy]], [[1, cx + 30, cy]])
    send("touchmove", [[0, cx - 60, cy], [1, cx + 60, cy]], [[0, cx - 60, cy], [1, cx + 60, cy]])
    zoomed = transform(phone).split("scale(")[1]
    assert zoomed == "2)"
    # One finger lifts; the other one stays and moves on its own.
    send("touchend", [[1, cx + 60, cy]], [[0, cx - 60, cy]])
    for step in range(1, 6):
        send("touchmove", [[1, cx + 60 - 8 * step, cy + 3 * step]], [[1, cx + 60 - 8 * step, cy + 3 * step]])
    assert transform(phone).split("scale(")[1] == zoomed
    send("touchend", [], [[1, cx + 20, cy + 15]])
    # A new touch with one finger moves the picture too, still at the same scale.
    before = transform(phone)
    send("touchstart", [[2, cx, cy]], [[2, cx, cy]])
    send("touchmove", [[2, cx - 40, cy]], [[2, cx - 40, cy]])
    send("touchend", [], [[2, cx - 40, cy]])
    assert transform(phone).split("scale(")[1] == zoomed
    assert transform(phone) != before


def test_a_drag_down_on_a_zoomed_picture_moves_it_and_does_not_close_the_window(phone):
    open_camera(phone)
    b = box(phone)
    cx, cy = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2

    def send(kind: str, fingers: list, changed: list) -> None:
        phone.evaluate(TOUCH, [kind, fingers, changed])

    def can_close() -> bool:
        return phone.evaluate(f"""([x, y]) => {{ const sheet = {SHEET_JS};
            const stage = sheet.shadowRoot.querySelector('.stage');
            let path = []; let node = stage.querySelector('.picture img');
            while (node) {{ path.push(node); node = node.parentNode ?? node.host; }}
            return sheet._canDrag(path); }}""", [cx, cy])

    # Not zoomed: the picture is part of the window, and a drag down closes it as before.
    assert can_close() is True
    send("touchstart", [[0, cx - 30, cy]], [[0, cx - 30, cy]])
    send("touchstart", [[0, cx - 30, cy], [1, cx + 30, cy]], [[1, cx + 30, cy]])
    send("touchmove", [[0, cx - 60, cy], [1, cx + 60, cy]], [[0, cx - 60, cy], [1, cx + 60, cy]])
    send("touchend", [], [[0, cx - 60, cy], [1, cx + 60, cy]])
    phone.wait_for_selector(f"{SHEET} .stage.zoomed")
    # Zoomed: the finger moves the picture, also downwards, and the window stays.
    assert can_close() is False
    before = transform(phone)
    send("touchstart", [[2, cx, cy - 40]], [[2, cx, cy - 40]])
    send("touchmove", [[2, cx, cy + 40]], [[2, cx, cy + 40]])
    send("touchend", [], [[2, cx, cy + 40]])
    assert transform(phone) != before
    assert phone.locator(f"{SHEET} .panel").count() == 1


def test_a_real_drag_down_on_a_zoomed_picture_keeps_the_window(moving_phone):
    page = moving_phone
    open_camera(page)
    page.wait_for_timeout(800)  # the window slides in first
    b = box(page)
    cx, cy = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    session = page.context.new_cdp_session(page)

    def send(kind, points):
        session.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y} for x, y in points]})

    send("touchStart", [(cx - 30, cy), (cx + 30, cy)])
    for step in range(1, 11):
        send("touchMove", [(cx - 30 - 4 * step, cy), (cx + 30 + 4 * step, cy)])
    send("touchEnd", [])
    page.wait_for_selector(f"{SHEET} .stage.zoomed")
    before = transform(page)
    send("touchStart", [(cx, cy - 60)])
    for step in range(1, 11):
        send("touchMove", [(cx, cy - 60 + 20 * step)])
    send("touchEnd", [])
    page.wait_for_timeout(600)
    assert page.locator(f"{SHEET} .panel").count() == 1
    assert transform(page) != before


def test_the_clip_keeps_a_zoomed_picture_where_it_lay(phone):
    clips = zoom_module(phone, """return [z.clipFor({ scale: 1, x: 0, y: 0 }, 400, 200),
        z.clipFor({ scale: 2, x: -100, y: -50 }, 400, 200),
        z.clipFor({ scale: 2, x: -100, y: -50 }, 400, 200, { left: 50, top: 0, width: 300, height: 200 })];""")
    # At 2x moved by -100, -50 the element's own 50..250 x 25..125 covers the 400 x 200 it lay on.
    assert clips == ["", "inset(25px 150px 75px 50px)", "inset(25px 175px 75px 75px)"]


def test_a_picture_with_bands_moves_only_within_the_picture(phone):
    views = zoom_module(phone, """const rect = { left: 50, top: 0, width: 300, height: 200 };
        return [z.clampView({ scale: 2, x: 0, y: 0 }, 400, 200, rect), z.clampView({ scale: 2, x: -1000, y: 0 }, 400, 200, rect)];""")
    # The picture's left edge (50) stays at 50 or further left: x <= 50 * (1 - 2); its right edge (350) at 350 or right.
    assert views == [{"scale": 2, "x": -50, "y": 0}, {"scale": 2, "x": -350, "y": 0}]


def test_on_its_side_a_zoomed_picture_does_not_spill_over_the_screen(phone):
    phone.set_viewport_size({"width": 874, "height": 402})
    open_camera(phone)
    b = box(phone)
    assert b["x"] > 20, "the picture is narrower than the screen, with room on both sides"
    pinch(phone, 2)
    phone.wait_for_selector(f"{SHEET} .stage.zoomed")
    # Just left of where the picture lay nothing of it shows: the clip keeps it in its own place.
    hit = phone.evaluate(f"""([x, y]) => {SHEET_JS}.shadowRoot.elementFromPoint(x, y)?.localName""", [b["x"] - 10, b["y"] + b["height"] / 2])
    assert hit != "img"
    inside = phone.evaluate(f"""([x, y]) => {SHEET_JS}.shadowRoot.elementFromPoint(x, y)?.localName""", [b["x"] + 10, b["y"] + b["height"] / 2])
    assert inside == "img"
