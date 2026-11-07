// Home Dashboard loader: defines the dashboard strategy and nothing else.
//
// Home Assistant waits only 5 seconds for a strategy element, so this file stays tiny and the app
// is imported inside generate(). Extra modules run before the frontend installs its scoped custom
// element registry polyfill, which replaces window.customElements and window.HTMLElement: an
// element defined right away lands in the old registry and is never found. So wait for
// <home-assistant>, which proves the polyfill is in place, and only then create the class.

const STRATEGY_TAG = "ll-strategy-dashboard-home-dashboard";
const START_KEY = "home_dashboard_start";
const STARTED_KEY = "home_dashboard_started";
const PREFS_KEY = "home_dashboard";
const DEFAULT_PATHS = /^\/(lovelace(\/.*)?|home)?$/;
const POLL_INTERVAL_MS = 50;
const MAX_POLLS = 600;

// Where this device opens, once per app start and only from a default page, so a link keeps working.
// The query stays: the Companion app signs in through it.
export function startTarget(location, local, session) {
  const target = local.getItem(START_KEY);
  if (!target || session.getItem(STARTED_KEY)) return null;
  session.setItem(STARTED_KEY, "1");
  return DEFAULT_PATHS.test(location.pathname) ? `${target}${location.search}` : null;
}

// A person can choose to start here on all of their devices. The account says so only once the
// frontend is connected; a device learns it then and remembers it for the next start.
export function accountStart(value, location, local, session) {
  if (value === false) {
    local.removeItem(START_KEY);
    return null;
  }
  if (typeof value !== "string") return null;
  local.setItem(START_KEY, value);
  if (session.getItem(STARTED_KEY)) return null;
  session.setItem(STARTED_KEY, "1");
  return DEFAULT_PATHS.test(location.pathname) ? `${value}${location.search}` : null;
}

async function followAccountStart(attempt) {
  const hass = document.querySelector("home-assistant")?.hass;
  if (!hass?.connection) {
    if (attempt < MAX_POLLS) setTimeout(() => followAccountStart(attempt + 1), POLL_INTERVAL_MS);
    return;
  }
  try {
    const answer = await hass.callWS({ type: "frontend/get_user_data", key: PREFS_KEY });
    const target = accountStart(answer?.value?.start, window.location, window.localStorage, window.sessionStorage);
    if (!target) return;
    window.history.replaceState(null, "", target);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: true } }));
  } catch {
    // No account data or no storage: the device keeps its own choice.
  }
}

function openStartPage() {
  try {
    const target = startTarget(window.location, window.localStorage, window.sessionStorage);
    if (target) window.history.replaceState(null, "", target);
  } catch {
    // Storage can be blocked: the device simply opens its usual page.
  }
}

function appUrl() {
  const loader = new URL(import.meta.url);
  const url = new URL("./app/main.js", loader);
  url.search = loader.search;
  return url.href;
}

function createStrategyClass() {
  return class HomeDashboardStrategy extends HTMLElement {
    // Pages read the registries from hass themselves, so a registry change never rebuilds views.
    static registryDependencies = [];

    static async generate(config, hass) {
      const { generateDashboard } = await import(appUrl());
      return generateDashboard(config, hass);
    }
  };
}

function registerStrategy() {
  if (window.customElements.get(STRATEGY_TAG)) return;
  window.customElements.define(STRATEGY_TAG, createStrategyClass());
  window.customStrategies = window.customStrategies || [];
  window.customStrategies.push({
    type: "home-dashboard",
    strategyType: "dashboard",
    name: "Home Dashboard",
    description: "Touch-first dashboard for phones and wall tablets.",
  });
}

openStartPage();
followAccountStart(0);

(function waitForFrontend(attempt) {
  if (window.customElements.get("home-assistant") || attempt >= MAX_POLLS) {
    registerStrategy();
    return;
  }
  setTimeout(() => waitForFrontend(attempt + 1), POLL_INTERVAL_MS);
})(0);
