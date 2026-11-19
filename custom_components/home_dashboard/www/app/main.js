// Entry point, imported by the strategy once a Home Dashboard dashboard is opened.

import { HomeDashboardChrome } from "./chrome.js";
import { translate } from "./i18n.js";
import { HomeDashboardHost } from "./host.js";
import { previewMode } from "./preview.js";
import { browserModName, dashboardDeviceId, deviceLabel } from "./usage.js";
import { HomeDashboardIntercom } from "./intercom.js";
import { HomeDashboardPage } from "./page.js";
import { HomeDashboardScale } from "./scale.js";
import { HomeDashboardSchool } from "./school.js";
import { HomeDashboardSettings } from "./settings.js";
import { HomeDashboardSheet } from "./sheet.js";
import { HomeDashboardHistory, HomeDashboardLogbook } from "./activity.js";
import { HomeDashboardApp } from "./app-frame.js";
import { HomeDashboardBlockEditor } from "./block-editor.js";
import { HomeDashboardDepartures } from "./departures.js";
import { HomeDashboardEnergy } from "./energy.js";
import { HomeDashboardRecordingDays, HomeDashboardTimeline } from "./recordings.js";
import { HomeDashboardNews } from "./news.js";
import { HomeDashboardTextBlock } from "./text-block.js";
import { HomeDashboardNotifications } from "./notifications.js";
import { HomeDashboardOverview } from "./overview.js";
import { HomeDashboardWeather } from "./weather.js";
import { HomeDashboardStatusPanel } from "./status-panel.js";
import { HomeDashboardHistoryChart } from "./history-chart.js";
import { HomeDashboardStateHistory } from "./state-history.js";
import { HomeDashboardConnections } from "./connections.js";

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
define("home-dashboard-scale", HomeDashboardScale);
define("home-dashboard-weather", HomeDashboardWeather);
define("home-dashboard-departures", HomeDashboardDepartures);
define("home-dashboard-overview", HomeDashboardOverview);
define("home-dashboard-block-editor", HomeDashboardBlockEditor);
define("home-dashboard-app", HomeDashboardApp);
define("home-dashboard-news", HomeDashboardNews);
define("home-dashboard-text-block", HomeDashboardTextBlock);
define("home-dashboard-history", HomeDashboardHistory);
define("home-dashboard-logbook", HomeDashboardLogbook);
define("home-dashboard-notifications", HomeDashboardNotifications);
define("home-dashboard-host", HomeDashboardHost);
define("home-dashboard-energy", HomeDashboardEnergy);
define("home-dashboard-recording-days", HomeDashboardRecordingDays);
define("home-dashboard-timeline", HomeDashboardTimeline);
define("home-dashboard-status-panel", HomeDashboardStatusPanel);
define("home-dashboard-history-chart", HomeDashboardHistoryChart);
define("home-dashboard-state-history", HomeDashboardStateHistory);
define("home-dashboard-connections", HomeDashboardConnections);

// The person asked to check a new version gets it instead of the published one, marked so, until they leave it
// for this visit or the check ends (which reloads every page). A preview of the editor shows its own draft.
export const SKIP_REVIEW_KEY = "home-dashboard-skip-review";

export function dashboardUrlPath(pathname = window.location.pathname) {
  return pathname.split("/").filter(Boolean)[0] ?? "";
}

export async function generateForPerson(config, hass) {
  if (!previewMode()) {
    try {
      const review = await hass.callWS({ type: "home_dashboard/review/get", url_path: dashboardUrlPath() });
      const skipped = sessionStorage.getItem(SKIP_REVIEW_KEY);
      if (review?.config?.strategy && skipped !== review.published_at) {
        return generateDashboard({ ...review.config.strategy, _review: { published_at: review.published_at } }, hass);
      }
    } catch {
      // An older integration without the editor, or no connection yet: the published version.
    }
    const variants = await variantsOfDevice(hass);
    if (variants) return generateDashboard({ ...config, _variants: variants }, hass);
  }
  return generateDashboard(config, hass);
}

/**
 * The variants of pages this device sees (and, for an administrator, all there are to choose from); the device
 * says what it is, so that the editor can tell the phones and tablets apart. Nothing without any variants or battery.
 */
export async function variantsOfDevice(hass) {
  try {
    const mine = await hass.callWS({
      type: "home_dashboard/variants/mine",
      url_path: dashboardUrlPath(),
      device_label: deviceLabel(),
      device_id: dashboardDeviceId(),
      browser_mod: browserModName(),
    });
    // The battery of a tablet comes with them, even without a variant.
    const any = Object.keys(mine?.pages ?? {}).length || Object.keys(mine?.choices ?? {}).length || mine?.device_battery;
    return any ? mine : null;
  } catch {
    // An older integration without variants: the published pages.
    return null;
  }
}

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
