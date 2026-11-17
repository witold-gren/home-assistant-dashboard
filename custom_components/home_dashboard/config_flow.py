"""Config flow: one confirmation, then the options; rooms and tiles live in the strategy block."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    BooleanSelector,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)
import voluptuous as vol

from .const import (
    COLOR_MODE_AUTO,
    COLOR_MODES,
    CONF_ACTIVITY_IN_SIDEBAR,
    CONF_ACTIVITY_RECORD,
    CONF_COLOR_MODE,
    CONF_EDITOR_IN_SIDEBAR,
    DEFAULT_ACTIVITY_IN_SIDEBAR,
    DEFAULT_ACTIVITY_RECORD,
    DEFAULT_EDITOR_IN_SIDEBAR,
    DOMAIN,
)


class HomeDashboardConfigFlow(ConfigFlow, domain=DOMAIN):
    """Add Home Dashboard."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> HomeDashboardOptionsFlow:
        """Return the options flow."""
        return HomeDashboardOptionsFlow()

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Confirm the installation."""
        if user_input is None:
            return self.async_show_form(step_id="user")
        return self.async_create_entry(title="Home Dashboard", data={})


class HomeDashboardOptionsFlow(OptionsFlow):
    """Options that apply to every dashboard and device."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Choose the colours, which panels are in the sidebar and whether the activity is written down."""
        if user_input is not None:
            # Options not in this window (e.g. who sees the activity) are kept.
            return self.async_create_entry(data={**self.config_entry.options, **user_input})
        current = self.config_entry.options.get(CONF_COLOR_MODE, COLOR_MODE_AUTO)
        selector = SelectSelector(
            SelectSelectorConfig(
                options=COLOR_MODES, mode=SelectSelectorMode.LIST, translation_key=CONF_COLOR_MODE
            )
        )
        options = self.config_entry.options
        in_sidebar = options.get(CONF_EDITOR_IN_SIDEBAR, DEFAULT_EDITOR_IN_SIDEBAR)
        activity_in_sidebar = options.get(CONF_ACTIVITY_IN_SIDEBAR, DEFAULT_ACTIVITY_IN_SIDEBAR)
        activity_record = options.get(CONF_ACTIVITY_RECORD, DEFAULT_ACTIVITY_RECORD)
        schema = vol.Schema(
            {
                vol.Required(CONF_COLOR_MODE, default=current): selector,
                vol.Required(CONF_EDITOR_IN_SIDEBAR, default=in_sidebar): BooleanSelector(),
                vol.Required(CONF_ACTIVITY_IN_SIDEBAR, default=activity_in_sidebar): BooleanSelector(),
                vol.Required(CONF_ACTIVITY_RECORD, default=activity_record): BooleanSelector(),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
