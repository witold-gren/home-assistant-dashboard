// A hass object built from the anonymised registry snapshot. Every outgoing call is recorded, so
// tests can prove what was NOT called.

// Home Assistant hands a new registry object whenever the registry changes, and the same one otherwise; the
// dashboard keeps what it works out from a registry by that object (model.js entitiesOfDevice). Tests change the
// snapshot's registry in place, so a changed one is handed over as a new object here, as Home Assistant would.
const REGISTRY_COPIES = new WeakMap();

function registryOf(entities) {
  const copy = REGISTRY_COPIES.get(entities);
  const keys = Object.keys(entities);
  if (copy && keys.length === Object.keys(copy).length && keys.every((key) => copy[key] === entities[key])) return copy;
  const fresh = { ...entities };
  REGISTRY_COPIES.set(entities, fresh);
  return fresh;
}

/** An engine of text-to-speech with two Polish voices; null for a message about something else. */
export function ttsAnswer(message) {
  if (message.type === "tts/engine/get") {
    return { provider: { engine_id: message.engine_id, supported_languages: ["en_US", "pl_PL"] } };
  }
  if (message.type === "tts/engine/voices") {
    globalThis.voicesAsked = message;
    const voices = [
      { voice_id: "pl_PL-gosia-medium", name: "gosia (medium)" },
      { voice_id: "pl_PL-jan_wg_glos-medium", name: "pl_PL-jan_wg_glos-medium (medium)" },
    ];
    return { voices: message.language === "pl_PL" ? voices : null };
  }
  return null;
}

export function createHass(snapshot, overrides = {}) {
  const calls = [];
  return {
    entities: registryOf(snapshot.entities),
    devices: snapshot.devices,
    areas: snapshot.areas,
    floors: snapshot.floors,
    states: snapshot.states,
    language: "pl",
    user: { name: "Test User" },
    calls,
    formatEntityState: (stateObj) => stateObj.state,
    formatEntityAttributeValue: (stateObj, attribute) => stateObj.attributes[attribute],
    hassUrl: (path) => path,
    callService: async (domain, service, data) => calls.push({ type: "service", domain, service, data }),
    // Every page reads the preferences of the user once, and a camera window the registry entries of its buttons,
    // which says nothing about what a test did.
    callWS: async (message) => {
      if (message.type === "frontend/get_user_data") return null;
      if (message.type === "config/entity_registry/get_entries") return {};
      const tts = ttsAnswer(message);
      if (tts) return tts;
      // What the household opens (usage.js) goes to a list of its own, so tests of calls see only theirs.
      if (message.type === "home_dashboard/activity/seen") {
        globalThis.seen = [...(globalThis.seen ?? []), message];
        return null;
      }
      return calls.push({ type: "ws", message });
    },
    // The calendars' events a test sets in `window.calendarEvents` (by calendar), as Home Assistant's REST API gives them.
    callApi: async (method, path, data) => {
      calls.push({ type: "api", method, path, data });
      // A recording of text-to-speech; a test sets `window.ttsFails` and the engine fails.
      if (path === "tts_get_url") {
        if (globalThis.ttsFails) throw new Error("TTS failed");
        return { url: "http://10.0.0.2:8123/api/tts_proxy/internal.mp3", path: "/api/tts_proxy/test.mp3" };
      }
      const calendar = /^calendars\/([^?]+)/.exec(path)?.[1];
      // Home Assistant still starting: a test sets `window.calendarFails` and reading a calendar fails.
      if (calendar && globalThis.calendarFails) throw new Error("Calendar not ready");
      return calendar ? structuredClone(globalThis.calendarEvents?.[calendar] ?? []) : null;
    },
    connection: {
      subscribeMessage: async (callback, message) => {
        // A camera to show (home_dashboard.show_camera): a test sends it with window.showCamera({...}).
        if (message?.type === "home_dashboard/camera/subscribe") {
          globalThis.cameraSubscriptions = [...(globalThis.cameraSubscriptions ?? []), { callback, message }];
          globalThis.showCamera = (camera) => globalThis.cameraSubscriptions.forEach((each) => each.callback(camera));
          return () => {};
        }
        callback({
          color_mode: snapshot.colorMode ?? "auto",
          activity_record: snapshot.activityRecord ?? true,
          activity_viewer: snapshot.activityViewer ?? false,
        });
        return () => {};
      },
      sendMessagePromise: async (message) => {
        calls.push({ type: "message", message });
        return { response: { played: [{ area: "x" }] } };
      },
    },
    ...overrides,
  };
}

export function withState(hass, entityId, change) {
  const current = hass.states[entityId];
  return { ...hass, states: { ...hass.states, [entityId]: { ...current, ...change } } };
}
