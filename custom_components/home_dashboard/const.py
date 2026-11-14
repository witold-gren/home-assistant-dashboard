"""Constants for Home Dashboard."""

from __future__ import annotations

DOMAIN = "home_dashboard"
STATIC_URL = "/home_dashboard_static"
LOADER_FILENAME = "loader.js"
CONF_COLOR_MODE = "color_mode"
COLOR_MODE_AUTO = "auto"
COLOR_MODES = [COLOR_MODE_AUTO, "light", "dark"]
# The editor's panel in the sidebar; hidden, it still opens at /home-dashboard-editor.
CONF_EDITOR_IN_SIDEBAR = "editor_in_sidebar"
DEFAULT_EDITOR_IN_SIDEBAR = True
SIGNAL_SETTINGS_UPDATED = f"{DOMAIN}_settings_updated"
