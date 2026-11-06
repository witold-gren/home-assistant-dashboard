// A made-up home for the README screenshots: every name and state here is invented, and the camera
// pictures are free photos of other homes (dev/demo-pictures/CREDITS.md).

import "/custom_components/home_dashboard/www/app/main.js";

const params = new URLSearchParams(window.location.search);
const language = params.get("language") ?? "en";
const pl = language === "pl";
const say = (english, polish) => (pl ? polish : english);

customElements.define(
  "ha-icon",
  class extends HTMLElement {
    static observedAttributes = ["icon"];

    set icon(value) {
      this._icon = value;
      this._draw();
    }

    get icon() {
      return this._icon;
    }

    attributeChangedCallback(_, __, value) {
      this.icon = value;
    }

    async _draw() {
      const name = this._icon?.replace("mdi:", "");
      if (!name) return;
      const svg = await (await fetch(`/mdi/${name}.svg`)).text();
      this.innerHTML = svg.replace("<svg", '<svg width="24" height="24" fill="currentColor" style="display:block"');
      this.style.display = "inline-block";
    }
  },
);

const stamp = () => new Date(Date.now() - 180000).toISOString();

function entity(states, entities, id, area, state, attributes = {}, platform = "demo") {
  states[id] = { entity_id: id, state, last_changed: stamp(), attributes };
  entities[id] = { entity_id: id, area_id: area, device_id: null, hidden: false, entity_category: null, platform };
}

function buildHass() {
  const states = {};
  const entities = {};
  const add = (...args) => entity(states, entities, ...args);
  const light = (id, area, name, state, extra = {}) =>
    add(`light.${id}`, area, state, {
      friendly_name: name,
      supported_color_modes: ["color_temp", "xy"],
      color_mode: "color_temp",
      brightness: state === "on" ? 180 : undefined,
      ...extra,
    });
  light("sofa", "living", say("Sofa lamp", "Lampa przy sofie"), "on");
  light("ceiling", "living", say("Ceiling", "Sufit"), "off");
  light("shelf", "living", say("Shelf", "Półka"), "on", { color_mode: "xy", rgb_color: [120, 90, 255] });
  light("counter", "kitchen", say("Counter", "Blat"), "on");
  light("table", "kitchen", say("Dining table", "Stół"), "off");
  light("bedside", "bedroom", say("Bedside", "Nocna"), "off");
  add("climate.living", "living", "heat", {
    friendly_name: say("Thermostat", "Termostat"),
    current_temperature: 21.5,
    temperature: 22,
    hvac_modes: ["off", "heat"],
    min_temp: 7,
    max_temp: 30,
    target_temp_step: 0.5,
    hvac_action: "heating",
  });
  add("climate.bedroom", "bedroom", "heat", {
    friendly_name: say("Thermostat", "Termostat"),
    current_temperature: 19.5,
    temperature: 19.5,
    hvac_modes: ["off", "heat"],
    min_temp: 7,
    max_temp: 30,
    target_temp_step: 0.5,
    hvac_action: "idle",
  });
  add("cover.living", "living", "open", {
    friendly_name: say("Blind", "Roleta"),
    current_position: 70,
    supported_features: 15,
    device_class: "blind",
  });
  add("cover.bedroom", "bedroom", "closed", {
    friendly_name: say("Blind", "Roleta"),
    current_position: 0,
    supported_features: 15,
    device_class: "blind",
  });
  add("lock.front", "hall", "locked", { friendly_name: say("Front door", "Drzwi wejściowe") });
  add("switch.coffee", "kitchen", "on", { friendly_name: say("Coffee machine", "Ekspres") });
  add("media_player.living", "living", "playing", {
    friendly_name: say("Living room speaker", "Głośnik w salonie"),
    media_title: say("Morning playlist", "Poranna lista"),
    media_artist: "Demo",
    supported_features: 152463,
    volume_level: 0.35,
  });
  add("scene.morning", null, stamp(), { friendly_name: say("Good morning", "Dzień dobry"), icon: "mdi:weather-sunny" });
  add("scene.movie", null, stamp(), { friendly_name: say("Movie", "Film"), icon: "mdi:movie-open-outline" });
  add("scene.night", null, stamp(), { friendly_name: say("Good night", "Dobranoc"), icon: "mdi:weather-night" });
  add("automation.blinds", "living", "on", { friendly_name: say("Morning blinds", "Poranne rolety") });
  const cameras = { driveway: "hall", garden: "living", living: "living", hall: "hall" };
  Object.entries(cameras).forEach(([name, area]) => {
    add(`camera.${name}`, area, "recording", { friendly_name: name, entity_picture: `/dev/demo-pictures/${name}.jpg` }, "frigate");
  });
  const areas = Object.fromEntries(
    [
      ["living", say("Living room", "Salon")],
      ["kitchen", say("Kitchen", "Kuchnia")],
      ["bedroom", say("Bedroom", "Sypialnia")],
      ["hall", say("Hall", "Korytarz")],
    ].map(([area_id, name]) => [area_id, { area_id, name, floor_id: null }]),
  );
  return {
    entities,
    states,
    areas,
    devices: {},
    floors: {},
    language,
    user: { id: "demo", name: "Alex", is_admin: true },
    themes: {},
    localize: (key) => key,
    formatEntityState: (stateObj) =>
      ({ on: say("On", "Włączone"), off: say("Off", "Wyłączone"), open: say("Open", "Otwarte"), closed: say("Closed", "Zamknięte"), locked: say("Locked", "Zablokowane") })[stateObj.state] ?? stateObj.state,
    formatEntityAttributeValue: (stateObj, attribute) => stateObj.attributes[attribute],
    hassUrl: (path) => path,
    callService: async () => {},
    callWS: async (message) =>
      message.type === "config/auth/list"
        ? [
            { id: "demo", name: "Alex", is_active: true },
            { id: "kid", name: say("Sam", "Kuba"), is_active: true },
          ]
        : null,
    connection: { subscribeMessage: async (callback) => callback({ color_mode: "auto" }) },
  };
}

const tile = (entity, name, extra = {}) => ({ entity, ...(name ? { name } : {}), ...extra });

const DASHBOARD = {
  background: { light: "linear-gradient(160deg, #1d3b53, #4d7ea8)", dark: "linear-gradient(160deg, #1d3b53, #4d7ea8)" },
  scenes: [tile("scene.morning"), tile("scene.movie"), tile("scene.night")],
  scenes_layout: "row",
  cameras: { snapshot_platforms: ["frigate"] },
  visibility: { "light.shelf": { only: ["kid"] }, "switch.coffee": { except: ["kid"] } },
  layout: [
    {
      id: "living",
      name: say("Living room", "Salon"),
      areas: ["living"],
      home: [tile("light.sofa"), tile("light.ceiling"), tile("climate.living"), tile("cover.living")],
      sections: [
        { title: say("Lights", "Oświetlenie"), tiles: [tile("light.sofa"), tile("light.ceiling"), tile("light.shelf")] },
        { title: say("Climate and blinds", "Klimat i rolety"), tiles: [tile("climate.living"), tile("cover.living")] },
        { title: say("Automations", "Automatyzacje"), layout: "row", tiles: [tile("automation.blinds", null, { calm: true, tap_toggle: true })] },
      ],
    },
    {
      id: "kitchen",
      name: say("Kitchen", "Kuchnia"),
      areas: ["kitchen"],
      home: [tile("light.counter"), tile("light.table"), tile("switch.coffee")],
      sections: [{ title: say("Devices", "Urządzenia"), tiles: [tile("light.counter"), tile("light.table"), tile("switch.coffee")] }],
    },
    {
      id: "bedroom",
      name: say("Bedroom", "Sypialnia"),
      areas: ["bedroom"],
      home: [tile("light.bedside"), tile("climate.bedroom"), tile("cover.bedroom")],
      sections: [{ title: say("Devices", "Urządzenia"), tiles: [tile("light.bedside"), tile("climate.bedroom"), tile("cover.bedroom")] }],
    },
  ],
};

window.loadCardHelpers = async () => ({
  createCardElement: () => document.createElement("div"),
});

if (params.get("room")) window.history.replaceState(null, "", `?${params}`);
const card = document.createElement("home-dashboard-page");
card.setConfig({ page: params.get("page") ?? "home", dashboard: DASHBOARD });
card.hass = buildHass();
document.body.append(card);
window.card = card;
await card.updateComplete;
window.demoReady = true;
