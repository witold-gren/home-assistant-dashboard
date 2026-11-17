"""Pictures of camera tiles in the size of the tile: a picture of 1920 x 1080 holds about 8 MB in the browser and the
tiles of Home take a new one every 30 s, which made Safari reload a dashboard open for hours."""

from __future__ import annotations

from .test_page import mount

MODEL = "/custom_components/home_dashboard/www/app/model.js"


def test_only_pictures_of_the_camera_proxy_are_scaled(phone):
    urls = phone.evaluate(f"""async () => {{
        const {{ scaledPicture, TILE_PICTURE }} = await import('{MODEL}');
        return [
          scaledPicture('/api/camera_proxy/camera.garage?token=abc', TILE_PICTURE.small),
          scaledPicture('/api/camera_proxy/camera.garage', TILE_PICTURE.big),
          scaledPicture('/api/image_proxy/image.garage?token=abc', TILE_PICTURE.small),
          scaledPicture(undefined, TILE_PICTURE.small),
        ];
    }}""")
    assert urls == [
        "/api/camera_proxy/camera.garage?token=abc&width=640&height=360",
        "/api/camera_proxy/camera.garage?width=1280&height=720",
        "/api/image_proxy/image.garage?token=abc",
        None,
    ]


def test_both_sides_are_asked_for(phone):
    # Home Assistant's camera proxy scales a picture only when it gets the width and the height.
    sizes = phone.evaluate(f"async () => (await import('{MODEL}')).TILE_PICTURE")
    assert all(len(size) == 2 and size[0] > size[1] > 0 for size in sizes.values())


def test_the_tiles_of_home_ask_for_pictures_in_their_size(phone):
    # The cameras of the made-up home answer with the camera proxy, as cameras of Home Assistant do.
    phone.evaluate("""() => { for (const state of Object.values(window.dashboard.snapshot.states)) {
        const picture = state.attributes?.entity_picture;
        if (state.entity_id.startsWith('camera.') && picture?.startsWith('/api/image_proxy/'))
            state.attributes.entity_picture = picture.replace('/api/image_proxy/', '/api/camera_proxy/') + '?token=t';
    } }""")
    mount(phone)
    phone.wait_for_selector("home-dashboard-page [data-camera] img", state="attached")
    sources = phone.locator("home-dashboard-page [data-camera] img").evaluate_all(
        "(all) => all.map((img) => img.getAttribute('src'))"
    )
    proxied = [src for src in sources if "/api/camera_proxy/" in src]
    assert proxied, sources
    assert all("width=" in src and "height=" in src for src in proxied)
    # pictures that are not of the camera proxy (image entities) stay as they are
    assert all("width=" not in src for src in sources if "/api/camera_proxy/" not in src)
