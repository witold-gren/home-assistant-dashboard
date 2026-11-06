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

// A neutral spot on the map: no one's address.
const HOME = [52.3702, 4.8952];
const ZOOM = 14;

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
  add("media_player.living_homepod", "living", "playing", {
    friendly_name: say("Living room speaker", "Głośnik w salonie"),
    media_title: say("Morning playlist", "Poranna lista"),
    media_artist: say("Home Band", "Domowy Zespół"),
    media_album_name: say("Sunday", "Niedziela"),
    media_duration: 214,
    media_position: 71,
    media_position_updated_at: new Date().toISOString(),
    entity_picture: "/dev/demo-pictures/garden.jpg",
    supported_features: 152463,
    volume_level: 0.35,
  });
  add("scene.morning", null, stamp(), { friendly_name: say("Good morning", "Dzień dobry"), icon: "mdi:weather-sunny" });
  add("scene.movie", null, stamp(), { friendly_name: say("Movie", "Film"), icon: "mdi:movie-open-outline" });
  add("scene.night", null, stamp(), { friendly_name: say("Good night", "Dobranoc"), icon: "mdi:weather-night" });
  add("automation.blinds", "living", "on", { friendly_name: say("Morning blinds", "Poranne rolety") });
  add("zone.home", null, "1", { latitude: HOME[0], longitude: HOME[1], friendly_name: say("Home", "Dom") });
  add("person.alex", null, "home", { friendly_name: "Alex", latitude: HOME[0], longitude: HOME[1] });
  add("person.sam", null, "not_home", { friendly_name: say("Sam", "Kuba"), latitude: HOME[0] + 0.012, longitude: HOME[1] + 0.02 });
  add("vacuum.robot", "living", "docked", { friendly_name: say("Vacuum", "Odkurzacz"), battery_level: 96 });
  add("sensor.vacuum_area", null, "42", { friendly_name: say("Last clean", "Ostatnie sprzątanie"), unit_of_measurement: "m²" });
  add("sensor.vacuum_filter", null, "71", { friendly_name: say("Filter", "Filtr"), unit_of_measurement: "%" });
  add("sensor.vacuum_brush", null, "64", { friendly_name: say("Main brush", "Szczotka główna"), unit_of_measurement: "%" });
  add("select.vacuum_power", null, "balanced", { friendly_name: say("Power", "Moc"), options: ["quiet", "balanced", "turbo"] });
  add("media_player.kitchen_homepod", "kitchen", "idle", { friendly_name: say("Kitchen speaker", "Głośnik w kuchni") });
  add("media_player.bedroom_homepod", "bedroom", "idle", { friendly_name: say("Bedroom speaker", "Głośnik w sypialni") });
  const cameras = {
    driveway: ["hall", say("Driveway", "Podjazd")],
    garden: ["living", say("Garden", "Ogród")],
    living: ["living", say("Living room", "Salon")],
    hall: ["hall", say("Lounge", "Pokój dzienny")],
  };
  Object.entries(cameras).forEach(([name, [area, title]]) => {
    add(`camera.${name}`, area, "recording", { friendly_name: title, entity_picture: `/dev/demo-pictures/${name}.jpg` }, "frigate");
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
      ({
        "config/auth/list": [
          { id: "demo", name: "Alex", is_active: true },
          { id: "kid", name: say("Sam", "Kuba"), is_active: true },
        ],
        "energy/get_prefs": { energy_sources: [{ type: "grid" }], device_consumption: [{ stat_consumption: "a" }] },
        "media_source/browse_media": {
          children: [
            { title: say("Radio", "Radio"), thumbnail: null },
            { title: say("My music", "Moja muzyka"), thumbnail: null },
            { title: say("Podcasts", "Podcasty"), thumbnail: null },
          ],
        },
      })[message.type] ?? null,
    connection: { subscribeMessage: async (callback) => callback({ color_mode: "auto" }) },
  };
}

const tile = (entity, name, extra = {}) => ({ entity, ...(name ? { name } : {}), ...extra });

const DASHBOARD = {
  background: { light: "linear-gradient(160deg, #1d3b53, #4d7ea8)", dark: "linear-gradient(160deg, #1d3b53, #4d7ea8)" },
  scenes: [tile("scene.morning"), tile("scene.movie"), tile("scene.night")],
  scenes_layout: "row",
  music: { frame: `/dev/demo-music.html?language=${language}` },
  shortcuts: [
    { kind: "page", name: say("Media", "Media"), icon: "mdi:play-box-multiple-outline", page: "media" },
    {
      kind: "panel",
      name: say("Vacuum", "Odkurzacz"),
      icon: "mdi:robot-vacuum",
      entity: "vacuum.robot",
      stats: [
        { name: say("Last clean", "Ostatnie sprzątanie"), entity: "sensor.vacuum_area", unit: "m²", digits: 0 },
        { name: say("Filter", "Filtr"), entity: "sensor.vacuum_filter", unit: "%", digits: 0 },
        { name: say("Main brush", "Szczotka główna"), entity: "sensor.vacuum_brush", unit: "%", digits: 0 },
      ],
      actions: [
        { name: say("Start", "Start"), icon: "mdi:play", entity: "vacuum.robot", service: "vacuum.start" },
        { name: say("Pause", "Pauza"), icon: "mdi:pause", entity: "vacuum.robot", service: "vacuum.pause" },
        { name: say("Dock", "Do bazy"), icon: "mdi:home-import-outline", entity: "vacuum.robot", service: "vacuum.return_to_base" },
      ],
      card: { type: "demo-floor-plan" },
      card_open: true,
      groups: [
        {
          layout: "controls",
          rows: [
            {
              entity: "select.vacuum_power",
              name: say("Power", "Moc"),
              labels: { quiet: say("Quiet", "Cicho"), balanced: say("Balanced", "Normalnie"), turbo: "Turbo" },
            },
          ],
        },
      ],
    },
  ],
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

const panel = (html) => {
  const card = document.createElement("div");
  card.style.cssText =
    "box-sizing:border-box;margin-bottom:12px;padding:16px;border-radius:16px;background:var(--hd-surface,#fff);font:14px Roboto,Arial,sans-serif";
  card.innerHTML = html;
  return card;
};

function energyGraph() {
  const bars = [3, 2, 2, 2, 3, 6, 9, 7, 5, 4, 5, 6, 7, 5, 4, 5, 7, 10, 12, 11, 8, 6, 4, 3];
  const columns = bars
    .map((value) => `<rect x="0" y="${130 - value * 10}" width="10" height="${value * 10}" rx="2" fill="#4d7ea8"></rect>`)
    .map((bar, index) => `<g transform="translate(${index * 14} 0)">${bar}</g>`)
    .join("");
  return panel(`<strong>${say("Energy usage", "Zużycie energii")}</strong>
    <svg viewBox="0 0 336 134" style="display:block;width:100%;margin-top:12px">${columns}</svg>`);
}

function energyDevices() {
  const devices = [
    [say("Heat pump", "Pompa ciepła"), 9.4],
    [say("Dishwasher", "Zmywarka"), 3.2],
    [say("Fridge", "Lodówka"), 1.8],
    [say("Computer", "Komputer"), 1.4],
    [say("Router and NAS", "Router i NAS"), 0.9],
  ];
  const rows = devices
    .map(
      ([name, value]) => `<div style="display:flex;align-items:center;gap:8px;margin-top:10px">
        <span style="flex:0 0 112px">${name}</span>
        <span style="height:12px;border-radius:6px;background:#8fbf7f;width:${value * 14}px"></span>
        <small>${value} kWh</small></div>`,
    )
    .join("");
  return panel(`<strong>${say("Devices", "Urządzenia")}</strong>${rows}`);
}

function energyTable() {
  return panel(`<strong>${say("Sources", "Źródła")}</strong>
    <div style="display:flex;justify-content:space-between;margin-top:12px"><span>${say("Grid", "Sieć")}</span><span>21.4 kWh</span></div>
    <div style="display:flex;justify-content:space-between;margin-top:8px"><span>${say("Cost", "Koszt")}</span><span>6.10 €</span></div>`);
}

function floorPlan() {
  const rooms = [
    [10, 10, 150, 110, "#dfe9f3"],
    [164, 10, 126, 70, "#e9f0df"],
    [164, 84, 126, 96, "#f3e8df"],
    [10, 124, 150, 56, "#ece4f3"],
  ];
  const shapes = rooms.map(([x, y, w, h, fill]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}"></rect>`);
  return panel(`<svg viewBox="0 0 300 190" style="display:block;width:100%">${shapes.join("")}
    <path d="M60 60 L120 60 L120 95 L210 95 L210 140" fill="none" stroke="#4d7ea8" stroke-width="3" stroke-dasharray="6 5"></path>
    <circle cx="60" cy="60" r="8" fill="#0c7c4f"></circle></svg>`);
}

// OpenStreetMap tiles around a neutral point, with the two made-up people on top.
function streetMap() {
  const scale = 2 ** ZOOM;
  const x = Math.floor(((HOME[1] + 180) / 360) * scale);
  const radians = (HOME[0] * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale);
  const card = document.createElement("div");
  card.style.cssText = "position:relative;height:100%;overflow:hidden;background:#dde";
  const tiles = [];
  for (let row = -2; row <= 2; row += 1) {
    for (let column = -2; column <= 2; column += 1) {
      const left = `calc(50% + ${column * 256 - 128}px)`;
      const top = `calc(50% + ${row * 256 - 128}px)`;
      tiles.push(`<img src="/osm/${ZOOM}/${x + column}/${y + row}.png" alt="" style="position:absolute;left:${left};top:${top};width:256px;height:256px" />`);
    }
  }
  const pin = (left, top, letter, colour) =>
    `<span style="position:absolute;left:${left};top:${top};display:grid;place-items:center;width:44px;height:44px;border:3px solid #fff;border-radius:50%;font:700 18px Roboto,Arial;color:#fff;background:${colour}">${letter}</span>`;
  card.innerHTML = `${tiles.join("")}${pin("46%", "46%", "A", "#0c7c4f")}${pin("66%", "30%", say("S", "K"), "#4d7ea8")}
    <small style="position:absolute;right:6px;bottom:4px;padding:1px 6px;background:#fffc">© OpenStreetMap contributors</small>`;
  return card;
}

const DEMO_CARDS = {
  map: streetMap,
  "demo-floor-plan": floorPlan,
  "energy-usage-graph": energyGraph,
  "energy-sources-table": energyTable,
  "energy-devices-graph": energyDevices,
};

window.loadCardHelpers = async () => ({
  createCardElement: (config) => DEMO_CARDS[config.type]?.() ?? document.createElement("div"),
});

if (params.get("room")) window.history.replaceState(null, "", `?${params}`);
const card = document.createElement("home-dashboard-page");
card.setConfig({ page: params.get("page") ?? "home", dashboard: DASHBOARD });
card.hass = buildHass();
document.body.append(card);
window.card = card;
await card.updateComplete;
window.demoReady = true;
