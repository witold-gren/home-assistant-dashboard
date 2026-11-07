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
      const size = getComputedStyle(this).getPropertyValue("--mdc-icon-size").trim() || "24px";
      this.innerHTML = svg.replace("<svg", `<svg width="${size}" height="${size}" fill="currentColor" style="display:block"`);
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
  states["weather.home"] = {
    entity_id: "weather.home",
    state: "partlycloudy",
    attributes: {
      friendly_name: say("Home", "Dom"),
      temperature: 12.4,
      temperature_unit: "°C",
      apparent_temperature: 10.8,
      humidity: 64,
      pressure: 1018,
      pressure_unit: "hPa",
      wind_speed: 14,
      wind_speed_unit: "km/h",
      cloud_coverage: 40,
      dew_point: 5.9,
      uv_index: 2,
      supported_features: 3,
    },
  };
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
  const departures = (line, direction, ...times) =>
    add(`sensor.tram_${line}`, null, "ok", {
      friendly_name: `${line} ${direction}`,
      list: times.map(([departure, minutes, delay = 0]) => ({ line, direction, departure, time_to_departure: minutes, delay })),
    });
  departures("4", say("HARBOUR", "PORT"), ["09:46", 4], ["10:06", 24], ["10:26", 44]);
  departures("11", say("OLD TOWN", "STARE MIASTO"), ["09:53", 11, 120], ["10:13", 31], ["10:33", 51]);
  const lesson = (number, start, end, subject, teacher) => ({ type: "lesson", number, start, end, subject, teacher, classroom: "12" });
  const today = new Date();
  const isoDay = (offset) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
  };
  const schoolEvent = (title, offset, extra = {}) => ({ date: isoDay(offset), title, start: null, end: null, place: "", description: "", instead_of_lessons: false, important: true, ...extra });
  const trip = schoolEvent(say("School trip", "Wycieczka szkolna"), 0, { start: "08:00", end: "15:00", place: say("Museum", "Muzeum") });
  const formal = schoolEvent(say("Formal outfit", "Strój galowy"), 1);
  add("sensor.rodzinnik_librus", null, "0", {
    children: [
      { child: "Lena", events: [trip] },
      { child: "Kuba", events: [formal] },
    ],
  });
  add("sensor.rodzinnik_plan_lekcji", null, isoDay(0), {
    children: [
      {
        child: "Lena",
        days: [
          {
            date: isoDay(0),
            name: say("Today", "Dzisiaj"),
            is_today: true,
            events: [trip],
            lessons: [
              lesson(1, "08:00", "08:45", say("Maths", "Matematyka"), "Anna Nowak"),
              lesson(2, "08:55", "09:40", say("English", "Język angielski"), "Jan Kowalski"),
              lesson(3, "09:50", "10:35", say("Science", "Przyroda"), "Anna Nowak"),
            ],
          },
        ],
      },
      { child: "Kuba", days: [] },
    ],
  });
  add("sensor.bedroom_temperature", null, "17.5", { friendly_name: say("Bedroom", "Sypialnia"), unit_of_measurement: "°C" });
  add("sensor.car_range", null, "80", { friendly_name: say("Car range", "Zasięg auta"), unit_of_measurement: "km" });
  add("sensor.door_battery", null, "8", { friendly_name: say("Door sensor", "Czujnik drzwi"), unit_of_measurement: "%", device_class: "battery" });
  add("sensor.washer_state", null, "Running", { friendly_name: say("Washer", "Pralka") });
  add("sensor.washer_program", null, say("Cottons", "Bawełna"), {});
  add("sensor.washer_phase", null, say("Spin", "Wirowanie"), {});
  add("sensor.washer_left", null, "25 min", {});
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
  add("media_player.soundbar", "living", "on", { friendly_name: say("Soundbar", "Soundbar") });
  add("media_player.tv", "living", "off", { friendly_name: say("Television", "Telewizor"), device_class: "tv" });
  add("media_player.projector", "bedroom", "off", { friendly_name: say("Projector", "Projektor"), device_class: "tv" });
  add("media_player.streamer", "living", "idle", { friendly_name: say("Streaming box", "Odtwarzacz sieciowy") });
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
      ({ on: say("On", "Włączone"), off: say("Off", "Wyłączone"), open: say("Open", "Otwarte"), closed: say("Closed", "Zamknięte"), locked: say("Locked", "Zablokowane"), partlycloudy: say("Partly cloudy", "Częściowe zachmurzenie") })[stateObj.state] ?? stateObj.state,
    formatEntityAttributeValue: (stateObj, attribute) => stateObj.attributes[attribute],
    hassUrl: (path) => path,
    callService: async () => {},
    callWS: async (message) =>
      demoSupervisor(message) ??
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
    connection: {
      subscribeMessage: async (callback, message) => {
        if (message.type === "persistent_notification/subscribe") {
          callback({ type: "current", notifications: demoNotifications(say) });
          return () => {};
        }
        callback(message.type === "weather/subscribe_forecast" ? { forecast: demoForecast(message.forecast_type) } : { color_mode: "auto" });
        return () => {};
      },
    },
  };
}

function demoSupervisor({ type, endpoint }) {
  if (type !== "supervisor/api") return null;
  if (endpoint === "/ingress/session") return { session: "demo" };
  return endpoint.endsWith("/info") ? { ingress_url: "/dev/demo-app.html", state: "started" } : {};
}

function demoNotifications(say) {
  const hoursAgo = (hours) => new Date(Date.now() - hours * 3600000).toISOString();
  const items = [
    {
      notification_id: "update",
      title: say("New version", "Nowa wersja"),
      message: say("A new version is ready in **Settings**. See [what is new](/config).", "Nowa wersja czeka w **Ustawieniach**. Zobacz [co nowego](/config)."),
      created_at: hoursAgo(1),
    },
    {
      notification_id: "battery",
      title: say("Low battery", "Słaba bateria"),
      message: say("The door sensor has 8% left.", "Czujnik drzwi ma 8%."),
      created_at: hoursAgo(5),
    },
    {
      notification_id: "backup",
      title: say("Backup", "Kopia zapasowa"),
      message: say("The backup finished without problems.", "Kopia zakończyła się bez problemów."),
      created_at: hoursAgo(26),
    },
  ];
  return Object.fromEntries(items.map((item) => [item.notification_id, item]));
}

function demoForecast(type) {
  const now = Date.now();
  const conditions = ["partlycloudy", "partlycloudy", "cloudy", "rainy", "rainy", "cloudy", "sunny", "sunny"];
  if (type === "hourly") {
    return Array.from({ length: 24 }, (_, hour) => ({
      datetime: new Date(Math.ceil(now / 3600000) * 3600000 + hour * 3600000).toISOString(),
      condition: conditions[Math.floor(hour / 3)],
      temperature: 12 - Math.abs(hour - 4) / 3,
      precipitation: conditions[Math.floor(hour / 3)] === "rainy" ? 0.8 : 0,
    }));
  }
  return [13, 11, 9, 10, 14, 15, 12].map((temperature, day) => ({
    datetime: new Date(now + day * 86400000).toISOString(),
    condition: conditions[day + 1],
    temperature,
    templow: temperature - 6 - (day % 3),
    precipitation: conditions[day + 1] === "rainy" ? 3.5 : 0,
  }));
}

const tile = (entity, name, extra = {}) => ({ entity, ...(name ? { name } : {}), ...extra });

const DASHBOARD = {
  background: { light: "linear-gradient(160deg, #1d3b53, #4d7ea8)", dark: "linear-gradient(160deg, #1d3b53, #4d7ea8)" },
  scenes: [tile("scene.morning"), tile("scene.movie"), tile("scene.night")],
  scenes_layout: "row",
  music: { frame: `/dev/demo-music.html?language=${language}` },
  shortcuts: [
    { kind: "page", label: "Media", name: say("Sources", "Źródła"), icon: "mdi:play-box-multiple-outline", page: "media" },
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
    {
      kind: "overview",
      name: "Status",
      icon: "mdi:clipboard-pulse-outline",
      sections: [
        {
          title: say("Needs a look", "Wymaga uwagi"),
          alert: true,
          items: [
            { name: say("Cold room", "Zimno w pokoju"), icon: "mdi:snowflake", entities: ["sensor.bedroom_temperature"], below: 19, unit: "°" },
            { name: say("Low fuel", "Mało paliwa"), icon: "mdi:gas-station", entities: ["sensor.car_range"], below: 100 },
            { name: say("Batteries", "Baterie"), icon: "mdi:battery-alert", auto: "battery", below: 11 },
          ],
        },
        {
          title: say("At home", "W domu"),
          items: [{ name: say("Lights on", "Włączone światła"), icon: "mdi:lightbulb-on", entities: ["light.sofa", "light.shelf", "light.counter"] }],
        },
        {
          title: say("Working", "W pracy"),
          items: [
            {
              name: say("Washer", "Pralka"),
              icon: "mdi:washing-machine",
              entity: "sensor.washer_state",
              state: ["Running"],
              labels: { Running: say("Washing", "Pierze") },
              facts: [
                { name: say("Program", "Program"), entity: "sensor.washer_program" },
                { name: say("Phase", "Faza"), entity: "sensor.washer_phase" },
                { name: say("Left", "Zostało"), entity: "sensor.washer_left" },
              ],
            },
          ],
        },
      ],
    },
    { kind: "departures", name: say("Trams", "Tramwaje"), icon: "mdi:tram", entities: ["sensor.tram_4", "sensor.tram_11"] },
    { kind: "school", name: say("School year", "Rok szkolny"), icon: "mdi:school-outline" },
  ],
  media: {
    sections: [
      {
        title: say("Speakers", "Głośniki"),
        tiles: [
          { entity: "media_player.kitchen_homepod", name: say("Kitchen", "Kuchnia") },
          { entity: "media_player.bedroom_homepod", name: say("Bedroom", "Sypialnia") },
          { entity: "media_player.soundbar", name: "Soundbar", icon: "mdi:soundbar" },
        ],
      },
      { title: say("Televisions", "Telewizory"), tiles: [{ entity: "media_player.tv", name: say("Television", "Telewizor"), icon: "mdi:television" }] },
      { title: say("Projectors", "Projektory"), tiles: [{ entity: "media_player.projector", name: say("Projector", "Projektor"), icon: "mdi:projector" }] },
      { title: say("Other", "Inne"), tiles: [{ entity: "media_player.streamer", name: say("Streaming box", "Odtwarzacz sieciowy") }] },
    ],
  },
  menu: {
    groups: [
      {
        items: [
          { shortcut: say("Sources", "Źródła"), name: say("Media sources", "Media (Źródła)") },
          { shortcut: say("Vacuum", "Odkurzacz") },
          { shortcut: "Status" },
          { shortcut: say("Trams", "Tramwaje") },
          { shortcut: say("School year", "Rok szkolny") },
          { name: "Camera Manager", icon: "mdi:cctv", addon: "demo_camera_manager", hide_for_guests: true },
          { name: say("Notifications", "Powiadomienia"), icon: "mdi:bell-outline", action: "notifications" },
        ],
      },
      {
        items: [
          { name: say("History", "Historia"), icon: "mdi:chart-box-outline", path: "/history" },
          { name: say("Logbook", "Dziennik"), icon: "mdi:format-list-bulleted", path: "/logbook" },
          { name: say("Settings", "Ustawienia"), icon: "mdi:cog-outline", path: "/config", admin: true },
        ],
      },
    ],
  },
  cameras: { snapshot_platforms: ["frigate"] },
  intercom: { script: "script.announce", areas: ["hall", "living", "kitchen", "bedroom"] },
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
