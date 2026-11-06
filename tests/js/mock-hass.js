// A hass object built from the anonymised registry snapshot. Every outgoing call is recorded, so
// tests can prove what was NOT called.

export function createHass(snapshot, overrides = {}) {
  const calls = [];
  return {
    entities: snapshot.entities,
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
    // Every page reads the preferences of the user once, which says nothing about what a test did.
    callWS: async (message) => (message.type === "frontend/get_user_data" ? null : calls.push({ type: "ws", message })),
    connection: {
      subscribeMessage: async (callback) => {
        callback({ color_mode: snapshot.colorMode ?? "auto" });
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
