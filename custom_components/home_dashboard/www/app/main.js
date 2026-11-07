// Entry point, imported by the strategy once a Home Dashboard dashboard is opened.

import { HomeDashboardChrome } from "./chrome.js";
import { translate } from "./i18n.js";
import { HomeDashboardHost } from "./host.js";
import { HomeDashboardIntercom } from "./intercom.js";
import { HomeDashboardPage } from "./page.js";
import { HomeDashboardSchool } from "./school.js";
import { HomeDashboardSettings } from "./settings.js";
import { HomeDashboardSheet } from "./sheet.js";
import { HomeDashboardApp } from "./app-frame.js";
import { HomeDashboardBlockEditor } from "./block-editor.js";
import { HomeDashboardDepartures } from "./departures.js";
import { HomeDashboardNotifications } from "./notifications.js";
import { HomeDashboardOverview } from "./overview.js";
import { HomeDashboardWeather } from "./weather.js";

const PAGES = ["home", "room", "media", "music", "energy", "map"];

function define(tag, element) {
  if (!window.customElements.get(tag)) window.customElements.define(tag, element);
}

define("home-dashboard-page", HomeDashboardPage);
define("home-dashboard-chrome", HomeDashboardChrome);
define("home-dashboard-sheet", HomeDashboardSheet);
define("home-dashboard-settings", HomeDashboardSettings);
define("home-dashboard-intercom", HomeDashboardIntercom);
define("home-dashboard-school", HomeDashboardSchool);
define("home-dashboard-weather", HomeDashboardWeather);
define("home-dashboard-departures", HomeDashboardDepartures);
define("home-dashboard-overview", HomeDashboardOverview);
define("home-dashboard-block-editor", HomeDashboardBlockEditor);
define("home-dashboard-app", HomeDashboardApp);
define("home-dashboard-notifications", HomeDashboardNotifications);
define("home-dashboard-host", HomeDashboardHost);

export function generateDashboard(config, hass) {
  return {
    title: "Home Dashboard",
    views: PAGES.map((page) => ({
      title: translate(hass.language, `nav_${page}`),
      path: page,
      type: "panel",
      cards: [{ type: "custom:home-dashboard-page", page, dashboard: config }],
    })),
  };
}
