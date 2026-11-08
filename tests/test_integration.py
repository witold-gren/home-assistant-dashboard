"""Setup, config flow and serving of the frontend modules."""

from __future__ import annotations

import json
from pathlib import Path

from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL
from homeassistant.config_entries import SOURCE_USER
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType, InvalidData
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_dashboard.const import COLOR_MODES, DOMAIN, LOADER_FILENAME, STATIC_URL
from custom_components.home_dashboard.frontend import WWW_DIR, resolve_static_file


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Enable custom_components in tests."""


@pytest.fixture
async def entry(hass: HomeAssistant) -> MockConfigEntry:
    assert await async_setup_component(hass, "http", {})
    assert await async_setup_component(hass, "frontend", {})
    config_entry = MockConfigEntry(domain=DOMAIN)
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    return config_entry


def loader_urls(hass: HomeAssistant) -> list[str]:
    return [url for url in hass.data[DATA_EXTRA_MODULE_URL].urls if url.startswith(STATIC_URL)]


async def test_config_flow_creates_one_entry(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Home Dashboard"


async def test_second_entry_is_refused(hass: HomeAssistant) -> None:
    MockConfigEntry(domain=DOMAIN).add_to_hass(hass)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"


async def test_colours_default_to_the_system_setting(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    assert result["data_schema"]({}) == {"color_mode": "auto"}


async def test_chosen_colours_are_saved_and_shown_again(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"color_mode": "dark"})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options == {"color_mode": "dark"}
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["data_schema"]({}) == {"color_mode": "dark"}


async def test_an_unknown_colour_mode_is_refused(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    with pytest.raises(InvalidData):
        await hass.config_entries.options.async_configure(result["flow_id"], {"color_mode": "pink"})


async def test_open_pages_get_the_settings_and_every_change(
    hass: HomeAssistant, entry: MockConfigEntry, hass_ws_client
) -> None:
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/settings/subscribe"})
    assert (await client.receive_json())["success"]
    assert (await client.receive_json())["event"] == {"color_mode": "auto"}
    hass.config_entries.async_update_entry(entry, options={"color_mode": "light"})
    await hass.async_block_till_done()
    assert (await client.receive_json())["event"] == {"color_mode": "light"}


@pytest.mark.parametrize("language", ["en", "pl"])
def test_every_colour_mode_has_a_name(language: str) -> None:
    translations = json.loads((WWW_DIR.parent / "translations" / f"{language}.json").read_text("utf-8"))
    assert set(translations["selector"]["color_mode"]["options"]) == set(COLOR_MODES)


async def test_loader_is_added_with_the_version(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    assert loader_urls(hass) == [f"{STATIC_URL}/{LOADER_FILENAME}?v=0.1.6"]


async def test_unload_removes_and_reload_restores_the_loader(
    hass: HomeAssistant, entry: MockConfigEntry
) -> None:
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert loader_urls(hass) == []
    assert await hass.config_entries.async_setup(entry.entry_id)
    assert len(loader_urls(hass)) == 1


async def test_modules_are_public_and_not_cached(hass: HomeAssistant, entry, hass_client_no_auth) -> None:
    client = await hass_client_no_auth()
    response = await client.get(f"{STATIC_URL}/app/model.js")
    assert response.status == 200
    assert response.headers["Cache-Control"] == "no-cache"
    assert "javascript" in response.headers["Content-Type"]


async def test_missing_module_is_not_found(hass: HomeAssistant, entry, hass_client_no_auth) -> None:
    client = await hass_client_no_auth()
    assert (await client.get(f"{STATIC_URL}/app/missing.js")).status == 404


@pytest.mark.parametrize(
    "path", ["../__init__.py", "../manifest.json", "../../../etc/passwd", "app/../../const.py"]
)
def test_paths_outside_the_folder_are_refused(path: str) -> None:
    assert resolve_static_file(WWW_DIR, path) is None


def test_the_yaml_parser_is_shipped_with_its_licence() -> None:
    assert (WWW_DIR / "vendor" / "js-yaml.js").is_file()
    assert "Permission is hereby granted" in (WWW_DIR / "vendor" / "js-yaml.LICENSE").read_text("utf-8")


def test_only_modules_are_served(tmp_path: Path) -> None:
    (tmp_path / "notes.txt").write_text("private")
    (tmp_path / "ok.js").write_text("")
    assert resolve_static_file(tmp_path, "notes.txt") is None
    assert resolve_static_file(tmp_path, "ok.js") == (tmp_path / "ok.js").resolve()
    assert resolve_static_file(tmp_path, ".") is None
