"""Hiding an entry in the editor without removing it: the eye in the tree marks it `hidden: true`, the dashboard (and
the preview) leaves it out, and it comes back with the same eye — to see a window with and without it."""

from __future__ import annotations

from .test_editor_app import APP, desktop, open_editor  # noqa: F401
from .test_page import mount

STRATEGY = {
    "type": "custom:home-dashboard",
    "favorites": ["light.entity_0096"],
    "layout": [
        {
            "id": "living",
            "name": "Salon",
            "home": [{"entity": "light.entity_0096"}],
            "sections": [
                {"title": "Oświetlenie", "tiles": [{"entity": "light.entity_0096", "name": "Sofa"}]},
                {
                    "title": "Urządzenia",
                    "tiles": [
                        {
                            "kind": "panel",
                            "name": "Robot",
                            "actions": [
                                {"entity": "button.a", "name": "Do przodu"},
                                {"entity": "button.b", "name": "Stop"},
                            ],
                        }
                    ],
                },
            ],
        },
    ],
}
TILE = "layout/0/sections/0/tiles/0"
SECTION = "layout/0/sections/1"
ACTION = "layout/0/sections/1/tiles/0/actions/1"


def draft(page) -> dict:
    return page.evaluate("window.editor.app._strategy")


def eye(page, key: str):
    return page.locator(f"{APP} [data-node='{key}'] [data-hide]")


def test_the_eye_hides_an_entry_and_shows_it_again(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    eye(desktop, TILE).click()
    tile = draft(desktop)["layout"][0]["sections"][0]["tiles"][0]
    assert tile == {"entity": "light.entity_0096", "name": "Sofa", "hidden": True}
    node = desktop.locator(f"{APP} [data-node='{TILE}']")
    assert "hidden" in node.get_attribute("class")
    assert eye(desktop, TILE).get_attribute("aria-pressed") == "true"
    # Hiding does not choose the entry
    assert "sel" not in node.get_attribute("class")
    eye(desktop, TILE).click()
    assert draft(desktop)["layout"][0]["sections"][0]["tiles"][0] == {
        "entity": "light.entity_0096",
        "name": "Sofa",
    }
    assert "hidden" not in node.get_attribute("class")


def test_one_step_undoes_hiding(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    eye(desktop, ACTION).click()
    assert draft(desktop)["layout"][0]["sections"][1]["tiles"][0]["actions"][1]["hidden"] is True
    desktop.locator(f"{APP} [data-undo]").click()
    assert "hidden" not in draft(desktop)["layout"][0]["sections"][1]["tiles"][0]["actions"][1]


def test_what_is_inside_a_hidden_entry_is_greyed_too(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    eye(desktop, SECTION).click()
    assert "hidden" in desktop.locator(f"{APP} [data-node='{ACTION}']").get_attribute("class")
    # Its own eye stays open: only the section is hidden
    assert eye(desktop, ACTION).get_attribute("aria-pressed") == "false"


def test_only_entries_of_lists_have_an_eye(desktop) -> None:  # noqa: F811
    open_editor(desktop, STRATEGY)
    for key in ("layout/0", SECTION, TILE, ACTION, "layout/0/sections/1/tiles/0/actions"):
        assert desktop.locator(f"{APP} [data-node='{key}']").count() == 1, key
    assert eye(desktop, "layout/0").count() == 1
    # The list of buttons, the tiles of a room on Home and a favourite (only an entity id) have none
    assert eye(desktop, "layout/0/sections/1/tiles/0/actions").count() == 0
    assert eye(desktop, "layout/0/home").count() == 0
    assert eye(desktop, "favorites/0").count() == 0


def shown(page, config: dict) -> dict:
    return page.evaluate(
        """async (config) => {
            const { withoutHidden } = await import('/custom_components/home_dashboard/www/app/model.js');
            return withoutHidden(config);
        }""",
        config,
    )


def test_the_dashboard_leaves_hidden_entries_out_and_the_configuration_keeps_them(desktop) -> None:  # noqa: F811
    config = {
        "rooms": {"hidden": ["garage"]},
        "layout": [
            {**STRATEGY["layout"][0]},
            {"id": "attic", "name": "Strych", "areas": ["loft"], "hidden": True, "sections": []},
        ],
        "shortcuts": [
            {
                "kind": "panel",
                "name": "Robot",
                "groups": [
                    {
                        "title": "Jazda",
                        "rows": [{"entity": "number.a"}, {"entity": "number.b", "hidden": True}],
                    }
                ],
            },
            {"kind": "text", "name": "Słowo", "hidden": True},
        ],
    }
    config["layout"][0] = {
        **config["layout"][0],
        "sections": [
            {**config["layout"][0]["sections"][0], "tiles": [{"entity": "light.entity_0096", "hidden": True}]}
        ],
    }
    desktop.goto(desktop.url)
    result = shown(desktop, config)
    assert result["layout"][0]["sections"][0]["tiles"] == []
    assert result["shortcuts"] == [
        {"kind": "panel", "name": "Robot", "groups": [{"title": "Jazda", "rows": [{"entity": "number.a"}]}]}
    ]
    # A hidden room does not come back as a room of its area
    assert [room["id"] for room in result["layout"]] == ["living"]
    assert result["rooms"]["hidden"] == ["garage", "attic", "loft"]
    # The configuration itself is untouched
    assert config["layout"][1]["hidden"] is True and len(config["shortcuts"]) == 2


def test_a_hidden_tile_is_not_on_the_page(phone) -> None:
    mount(
        phone,
        {
            "favorites": [],
            "layout": [
                {
                    "id": "living",
                    "name": "Salon",
                    "home": [
                        {"entity": "light.entity_0096", "name": "Widać"},
                        {"entity": "light.entity_0097", "name": "Ukryta", "hidden": True},
                    ],
                }
            ],
        },
    )
    phone.wait_for_function("window.card.shadowRoot.textContent.includes('Widać')")
    assert "Ukryta" not in phone.evaluate("window.card.shadowRoot.textContent")
