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
      // What the household opens (usage.js) goes to a list of its own, so tests of calls see only theirs.
      if (message.type === "home_dashboard/activity/seen") {
        globalThis.seen = [...(globalThis.seen ?? []), message];
        return null;
      }
      return calls.push({ type: "ws", message });
    },
    // The calendars' events a test sets in `window.calendarEvents` (by calendar), as Home Assistant's REST API gives them.
    callApi: async (method, path) => {
      calls.push({ type: "api", method, path });
      const calendar = /^calendars\/([^?]+)/.exec(path)?.[1];
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
