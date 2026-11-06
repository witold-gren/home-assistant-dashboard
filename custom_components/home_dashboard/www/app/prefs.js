// What each person arranges for themselves. It lives in the user's data on the server, so it follows
// them to every device, and needs no administrator: children can arrange their own page too.

const KEY = "home_dashboard";
export const PREFS_EVENT = "home-dashboard-prefs";

let prefs = {};
let loaded = false;

export const personalPrefs = () => prefs;

function publish(value) {
  prefs = value ?? {};
  window.dispatchEvent(new CustomEvent(PREFS_EVENT));
}

export async function loadPrefs(hass) {
  if (loaded) return;
  loaded = true;
  try {
    const answer = await hass.callWS({ type: "frontend/get_user_data", key: KEY });
    if (answer?.value) publish(answer.value);
  } catch {
    // An older server simply keeps the shared order.
  }
}

export function savePrefs(hass, value) {
  publish(value);
  return hass.callWS({ type: "frontend/set_user_data", key: KEY, value });
}
