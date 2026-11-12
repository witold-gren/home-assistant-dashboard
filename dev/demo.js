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
  // The plug of the coffee machine measures what it lets through; a leak sensor under the sink says its battery.
  add("sensor.coffee_power", null, "1240", { friendly_name: say("Coffee machine power", "Moc ekspresu"), unit_of_measurement: "W", device_class: "power" });
  add("sensor.coffee_energy", null, "86.42", { friendly_name: say("Coffee machine energy", "Energia ekspresu"), unit_of_measurement: "kWh", device_class: "energy" });
  for (const id of ["switch.coffee", "sensor.coffee_power", "sensor.coffee_energy"]) entities[id].device_id = "coffee_plug";
  add("select.coffee_drink", "kitchen", "none", { friendly_name: say("Drink", "Napój"),
    options: ["none", "Espresso", "Long Coffee", "Cappuccino", "Latte Macchiato", "Flat White", "Hot Milk", "Hot Water", "Tea"] });
  add("binary_sensor.sink_leak", "kitchen", "off", { friendly_name: say("Leak under the sink", "Zalanie pod zlewem"), device_class: "moisture" });
  add("sensor.sink_leak_battery", null, "87", { device_class: "battery", unit_of_measurement: "%" });
  for (const id of ["binary_sensor.sink_leak", "sensor.sink_leak_battery"]) entities[id].device_id = "sink_leak";
  // A home server and what its plug measures.
  for (const [id, value, unit] of [["cpu", "12", "%"], ["ram", "48", "%"], ["disk", "63", "%"], ["temperature", "51", "°C"]]) {
    add(`sensor.server_${id}`, null, value, { unit_of_measurement: unit });
  }
  add("sensor.server_power", null, "18.5", { unit_of_measurement: "W", device_class: "power" });
  add("sensor.server_voltage", null, "231.2", { unit_of_measurement: "V", device_class: "voltage" });
  add("sensor.server_current", null, "0.12", { unit_of_measurement: "A", device_class: "current" });
  add("sensor.server_energy", null, "412.7", { unit_of_measurement: "kWh", device_class: "energy" });
  add("switch.server_plug", null, "on", {});
  add("sensor.server_uptime", null, new Date(Date.now() - 41 * 86400000).toISOString(), { device_class: "timestamp" });
  for (const [id, cpu, ram] of [["home_assistant", "4", "71"], ["media", "1", "35"], ["backup", "0", "0"]]) {
    add(`binary_sensor.vm_${id}`, null, id === "backup" ? "off" : "on", {});
    add(`sensor.vm_${id}_cpu`, null, cpu, { unit_of_measurement: "%" });
    add(`sensor.vm_${id}_ram`, null, ram, { unit_of_measurement: "%" });
  }
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
  const article = (title, text, source, rating) => ({ title, text, source, rating, votes: 120, source_url: "https://example.org/", url: "https://example.org/" });
  add("sensor.news_home", null, "ok", {
    release: say("Edition of the day", "Wydanie dnia"),
    attribution: say("Sample news", "Przykładowe wiadomości"),
    news: [
      article(say("The new tram line opens on Monday", "Nowa linia tramwajowa rusza w poniedziałek"), say("The route links the station with the new housing estates and runs every ten minutes.", "Trasa połączy dworzec z nowymi osiedlami, a tramwaje pojadą co dziesięć minut."), say("City Daily", "Dziennik Miejski"), 4.4),
      article(say("A warm autumn helps the vineyards", "Ciepła jesień pomaga winnicom"), say("Growers expect the best harvest for years.", "Hodowcy spodziewają się najlepszych zbiorów od lat."), "Radio Demo", 3.9),
    ],
  });
  add("sensor.news_world", null, "ok", {
    news: [article(say("A new telescope sends its first pictures", "Nowy teleskop przysłał pierwsze zdjęcia"), say("Scientists say the images are sharper than expected.", "Naukowcy mówią, że zdjęcia są ostrzejsze, niż oczekiwano."), "Science Demo", 4.7)],
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
    add(`camera.${name}`, area, "recording", { friendly_name: title, entity_picture: `/dev/demo-pictures/${name}.jpg`, camera_name: name, client_id: "frigate" }, "frigate");
  });
  // The driveway's siren, floodlight and night vision, put on its camera by hand (cameras.quick below); no area, so
  // they stay out of the rooms.
  add("siren.driveway_alarm", null, "off", { friendly_name: say("Driveway siren", "Syrena podjazdu") });
  add("light.driveway_floodlight", null, "on", { friendly_name: say("Driveway floodlight", "Reflektor podjazdu") });
  add("select.driveway_night_vision", null, "Infrared", { friendly_name: say("Driveway night vision", "Noktowizja podjazdu"), options: ["Off", "Infrared", "Full Color"] });
  // Its pan and tilt, with the positions saved on it (cameras.ptz below, by hand).
  for (const direction of ["left", "right", "up", "down"]) {
    add(`button.driveway_pan_${direction}`, null, "unknown", { friendly_name: say(`Driveway ${direction}`, `Podjazd ${direction}`) });
  }
  add("select.driveway_position", null, say("Gate", "Brama"), {
    friendly_name: say("Driveway position", "Pozycja podjazdu"),
    options: [say("Gate", "Brama"), say("Drive", "Podjazd"), say("Garden", "Ogród")],
  });
  add("button.driveway_go_to_position", null, "unknown", { friendly_name: say("Driveway go to position", "Podjazd do pozycji") });
  // The garden camera runs on a battery and says when a stream of it is open: the red dot and its connections.
  entities["camera.garden"].device_id = "garden_camera";
  add("binary_sensor.garden_streaming", null, "on", { friendly_name: say("Garden streaming", "Ogród strumień") });
  entities["binary_sensor.garden_streaming"].device_id = "garden_camera";
  add("binary_sensor.balcony_door", null, "on", { friendly_name: say("Balcony door", "Drzwi balkonowe"), device_class: "door" });
  // The three phases of the grid meter, for the Energy page (energy.phases below).
  [[612, 230.8, 2.9, 0.94], [1460, 233.1, 6.4, 0.97], [228, 248.6, 1.2, 0.81]].forEach(([watts, volts, amps, factor], index) => {
    const phase = index + 1;
    add(`sensor.meter_l${phase}_power`, null, String(watts), { friendly_name: `L${phase}`, unit_of_measurement: "W", device_class: "power" });
    add(`sensor.meter_l${phase}_voltage`, null, String(volts), { friendly_name: `L${phase}`, unit_of_measurement: "V", device_class: "voltage" });
    add(`sensor.meter_l${phase}_current`, null, String(amps), { friendly_name: `L${phase}`, unit_of_measurement: "A", device_class: "current" });
    add(`sensor.meter_l${phase}_factor`, null, String(factor), { friendly_name: `L${phase}`, device_class: "power_factor" });
  });
  add("sensor.meter_frequency", null, "50.02", { friendly_name: say("Frequency", "Częstotliwość"), unit_of_measurement: "Hz" });
  add("sensor.heat_pump_power", null, "1180", { friendly_name: say("Heat pump", "Pompa ciepła"), unit_of_measurement: "W", device_class: "power" });
  add("sensor.computer_power", null, "164", { friendly_name: say("Computer", "Komputer"), unit_of_measurement: "W", device_class: "power" });
  // A bathroom scale and the body of two made-up people from BodyMiScale.
  add("sensor.scale_mass", "bathroom", "72.4", { friendly_name: say("Scale", "Waga"), unit_of_measurement: "kg" });
  const body = (name, weight, extra) => ({
    friendly_name: name, weight, ideal: 68, bmi: 23.6, bmi_label: "normal_or_healthy_weight", body_fat: 19.4, muscle_mass: 54.2,
    water: 56.1, bone_mass: 2.9, visceral_fat: 7, protein: 18.4, lean_body_mass: 58.3, basal_metabolism: 1612,
    metabolic_age: 34, body_score: 84, body_type: "balanced", fat_mass_to_lose: 0, ...extra,
  });
  add("bodymiscale.alex", null, "ok", body("Alex", 72.4, { last_measurement_time: new Date(Date.now() - 3600000).toISOString(), ideal: 70.2, fat_mass_to_lose: 1.2 }));
  add("bodymiscale.sam", null, "ok", body(say("Sam", "Kuba"), 31.5, { last_measurement_time: new Date(Date.now() - 5 * 86400000).toISOString(), ideal: 30, bmi: 17.2, bmi_label: "underweight", body_type: "skinny" }));
  add("sensor.alex_weight", null, "72.4", { unit_of_measurement: "kg" });
  add("sensor.sam_weight", null, "31.5", { unit_of_measurement: "kg" });
  // A washer and a dryer that work now, with what they offer.
  const machine = (kind, program, phase, left) => {
    add(`sensor.${kind}_state`, "laundry", "Running", { friendly_name: kind });
    add(`sensor.${kind}_program`, null, program, {});
    add(`sensor.${kind}_phase`, null, phase, {});
    add(`sensor.${kind}_left`, null, left, {});
    add(`sensor.${kind}_cycles`, null, kind === "washer" ? "642" : "418", {});
    for (const button of ["start", "pause", "resume", "stop"]) add(`button.${kind}_${button}`, null, "unknown", {});
    add(`binary_sensor.${kind}_door`, null, "off", { device_class: "door" });
  };
  machine("washer", say("Cottons", "Bawełna"), say("Spin", "Wirowanie"), "25 min");
  machine("dryer", say("Towels", "Ręczniki"), say("Drying", "Suszenie"), "1 h 10 min");
  add("select.washer_program", null, "cottons", { options: ["cottons", "synthetics", "wool", "quick"] });
  add("select.washer_temperature", null, "40", { options: ["90", "20", "40", "60", "30"] });
  add("select.washer_spin", null, "1200", { options: ["1400", "400", "800", "1200"] });
  for (const option of ["prewash", "stains", "night", "eco"]) add(`switch.washer_${option}`, null, option === "eco" ? "on" : "off", {});
  add("select.dryer_dryness", null, "cupboard", { options: ["iron", "cupboard", "extra"] });
  for (const option of ["eco", "night", "refresh"]) add(`switch.dryer_${option}`, null, option === "eco" ? "on" : "off", {});
  // A power station on a battery.
  add("sensor.station_battery", "garage", "76", { unit_of_measurement: "%", device_class: "battery" });
  add("sensor.station_state", null, "charging", {});
  add("sensor.station_in", null, "410", { unit_of_measurement: "W", device_class: "power" });
  add("sensor.station_out", null, "35", { unit_of_measurement: "W", device_class: "power" });
  add("sensor.station_left", null, "95", { unit_of_measurement: "min" });
  add("sensor.station_health", null, "99", { unit_of_measurement: "%" });
  add("sensor.station_cycles", null, "40", {});
  for (const output of ["ac", "usb", "dc"]) add(`switch.station_${output}`, null, output === "ac" ? "on" : "off", {});
  add("number.station_charge", null, "800", { min: 200, max: 1200, step: 100, unit_of_measurement: "W" });
  // The streaming box is an Apple TV with its remote, playing.
  Object.assign(states["media_player.streamer"], {
    state: "playing",
    attributes: { ...states["media_player.streamer"].attributes, app_name: "YouTube", media_title: say("Mountains from above", "Góry z lotu ptaka"),
      media_artist: say("Nature channel", "Kanał przyrodniczy"), entity_picture: "/dev/demo-pictures/garden.jpg",
      source_list: ["YouTube", "TV", say("Music", "Muzyka"), say("Photos", "Zdjęcia"), "Podcasts", "Arcade", "App Store", "Fitness"] },
  });
  Object.assign(entities["media_player.streamer"], { platform: "apple_tv", device_id: "apple_tv" });
  add("remote.streamer", null, "on", {}, "apple_tv");
  entities["remote.streamer"].device_id = "apple_tv";
  const areas = Object.fromEntries(
    [
      ["living", say("Living room", "Salon")],
      ["kitchen", say("Kitchen", "Kuchnia")],
      ["bedroom", say("Bedroom", "Sypialnia")],
      ["hall", say("Hall", "Korytarz")],
      ["bathroom", say("Bathroom", "Łazienka")],
      ["laundry", say("Utility room", "Pralnia")],
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
    config: { currency: say("EUR", "PLN") },
    // As Home Assistant: a state of its own when one is given (an option of a list), else the entity's.
    formatEntityState: (stateObj, given) => {
      const state = given ?? stateObj.state;
      const sensor = stateObj.entity_id.startsWith("binary_sensor.");
      if (sensor && stateObj.attributes?.device_class === "door") return { on: say("Open", "Otwarte"), off: say("Closed", "Zamknięte") }[state];
      if (sensor && stateObj.attributes?.device_class === "moisture") return { on: say("Wet", "Wykryto"), off: say("Dry", "Sucho") }[state];
      return ({ docked: say("Docked", "W stacji"), on: say("On", "Włączone"), off: say("Off", "Wyłączone"), open: say("Open", "Otwarte"), closed: say("Closed", "Zamknięte"), locked: say("Locked", "Zablokowane"), partlycloudy: say("Partly cloudy", "Częściowe zachmurzenie") })[state] ?? state;
    },
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
        "logbook/get_events": demoLogbook(say),
        "energy/get_prefs": {
          energy_sources: [{ type: "grid", stat_energy_from: "sensor.grid", stat_cost: "sensor.grid_cost" }],
          device_consumption: DEMO_DEVICES.map(([id, name]) => ({ stat_consumption: id, name })),
        },
        "energy/info": { cost_sensors: {} },
        "recorder/statistics_during_period": message.type === "recorder/statistics_during_period" ? demoStatistics(message) : null,
        "history/history_during_period": message.type === "history/history_during_period" ? demoHistory(message, states) : null,
        ...demoFrigate(message),
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

// Frigate's recordings of the last days: stretches with gaps, and a few people and cars on the line of time.
function demoFrigate(message) {
  if (!message.type?.startsWith("frigate/")) return {};
  const day = (offset) => {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  if (message.type === "frigate/recordings/summary") {
    return { [message.type]: JSON.stringify([0, 1, 2, 4].map((offset) => ({ day: day(offset), events: 3 }))) };
  }
  const now = Date.now() / 1000;
  const until = Math.min(message.before, now);
  const hours = [[0, 2.5], [6.2, 9.8], [11, 13.4], [15, 24]];
  const segments = hours
    .map(([from, to]) => ({ start_time: message.after + from * 3600, end_time: Math.min(message.after + to * 3600, until) }))
    .filter((segment) => segment.end_time > segment.start_time);
  if (message.type === "frigate/recordings/get") return { [message.type]: JSON.stringify(segments) };
  const labels = ["person", "car", "person", "person", "car"];
  const events = segments.flatMap((segment, index) => {
    const at = segment.start_time + (segment.end_time - segment.start_time) * 0.6;
    return at < until ? [{ id: `demo-${index}`, start_time: at, end_time: at + 40, label: labels[index % labels.length] }] : [];
  });
  return { [message.type]: JSON.stringify(events) };
}

// The history of the last hours: a wave around the state of a number, and for a stream the times it was open, one of
// them left open for long.
function demoHistory(message, states) {
  const start = Date.parse(message.start_time) / 1000;
  const end = Date.parse(message.end_time) / 1000;
  const rows = (id) => {
    if (id.startsWith("binary_sensor.")) {
      const sessions = [[0.18, 0.4], [0.31, 12.5], [0.52, 0.7], [0.71, 2.3], [0.9, 0.5]];
      return [
        { s: "off", lu: start },
        ...sessions.flatMap(([at, minutes]) => {
          const on = start + (end - start) * at;
          return [{ s: "on", lu: on }, { s: "off", lu: on + minutes * 60 }];
        }),
        ...(id.includes("leak") ? [] : [{ s: "on", lu: end - 95 }]),
      ];
    }
    const value = Number(states[id]?.state);
    if (!Number.isFinite(value)) return [];
    const steps = 96;
    const swing = id.includes("voltage") ? 0.012 : 0.35;
    return Array.from({ length: steps + 1 }, (_, index) => ({
      s: String(+(value * (1 + swing * Math.sin(index / 7) * Math.cos(index / 17))).toFixed(1)),
      lu: start + ((end - start) * index) / steps,
    }));
  };
  return Object.fromEntries(message.entity_ids.map((id) => [id, rows(id)]));
}

function demoLogbook(say) {
  const minutesAgo = (minutes) => Date.now() / 1000 - minutes * 60;
  return [
    { when: minutesAgo(2), entity_id: "light.sofa", state: "on", context_event_type: "automation_triggered", context_name: say("Evening lights", "Wieczorne światła") },
    { when: minutesAgo(6), entity_id: "light.counter", state: "on", context_entity_id: "light.sofa", context_state: "on" },
    { when: minutesAgo(11), entity_id: "cover.living", state: "closed" },
    { when: minutesAgo(18), entity_id: "light.ceiling", state: "off" },
    { when: minutesAgo(27), entity_id: "climate.living", state: "heat" },
    { when: minutesAgo(41), entity_id: "light.table", state: "off", context_event_type: "automation_triggered", context_name: say("Nobody in the kitchen", "Nikogo w kuchni") },
  ];
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
// The drinks of a coffee machine in the language of the home, in place of the names its integration gives.
const DEMO_DRINKS = say(
  { none: "None", "Long Coffee": "Long coffee", "Latte Macchiato": "Latte macchiato", "Flat White": "Flat white" },
  { none: "Brak", "Long Coffee": "Kawa Long", "Latte Macchiato": "Latte macchiato", "Flat White": "Flat white",
    "Hot Milk": "Gorące mleko", "Hot Water": "Gorąca woda", Tea: "Herbata" },
);

// The blocks of the washer and the dryer: state, numbers, buttons and groups of what they offer.
function demoMachine(kind) {
  const washer = kind === "washer";
  const states = { Running: say("Running", "Pracuje") };
  return {
    kind: "panel", name: washer ? say("Washer", "Pralka") : say("Dryer", "Suszarka"), icon: washer ? "mdi:washing-machine" : "mdi:tumble-dryer",
    entity: `sensor.${kind}_state`, labels: states, active: `sensor.${kind}_state`, active_state: "Running",
    stats: [
      { name: say("Program", "Program"), entity: `sensor.${kind}_program` },
      { name: say("Phase", "Faza"), entity: `sensor.${kind}_phase` },
      { name: say("Left", "Zostało"), entity: `sensor.${kind}_left` },
      { name: say("Cycles", "Cykli"), entity: `sensor.${kind}_cycles` },
    ],
    actions: [["start", "mdi:play", "Start"], ["pause", "mdi:pause", say("Pause", "Pauza")], ["resume", "mdi:play-pause", say("Resume", "Wznów")], ["stop", "mdi:stop", "Stop"]]
      .map(([button, icon, name]) => ({ name, icon, entity: `button.${kind}_${button}` })),
    groups: washer
      ? [
          { title: say("Programme", "Program"), rows: [{ entity: "select.washer_program", name: say("Programme", "Program"),
            labels: { cottons: say("Cottons", "Bawełna"), synthetics: say("Synthetics", "Syntetyki"), wool: say("Wool", "Wełna"), quick: say("Quick 20 min", "Szybki 20 min") } }] },
          { title: say("Options", "Opcje"), layout: "controls", rows: [
            { entity: "switch.washer_prewash", name: say("Prewash", "Pranie wstępne") }, { entity: "switch.washer_stains", name: say("Stains", "Plamy") },
            { entity: "switch.washer_night", name: say("Night", "Cykl nocny") }, { entity: "switch.washer_eco", name: "Eco" }] },
          { title: say("Washing", "Pranie"), layout: "controls", rows: [
            { entity: "select.washer_temperature", name: say("Temperature", "Temperatura"), order: ["20", "30", "40", "60", "90"], labels: { 20: "20°", 30: "30°", 40: "40°", 60: "60°", 90: "90°" } },
            { entity: "select.washer_spin", name: say("Spin", "Wirowanie"), order: ["400", "800", "1200", "1400"] }] },
          { title: say("State", "Stan"), rows: [{ entity: "binary_sensor.washer_door", name: say("Door", "Drzwi") }] },
        ]
      : [
          { title: say("Options", "Opcje"), layout: "controls", rows: [
            { entity: "switch.dryer_eco", name: "Eco" }, { entity: "switch.dryer_night", name: say("Night", "Cykl nocny") },
            { entity: "switch.dryer_refresh", name: say("Refresh", "Odświeżanie") }] },
          { title: say("Drying", "Suszenie"), layout: "controls", rows: [
            { entity: "select.dryer_dryness", name: say("Dryness", "Suchość"),
              labels: { iron: say("Iron dry", "Do prasowania"), cupboard: say("Cupboard dry", "Do szafy"), extra: say("Extra dry", "Extra suche") } }] },
          { title: say("State", "Stan"), rows: [{ entity: "binary_sensor.dryer_door", name: say("Door", "Drzwi") }] },
        ],
  };
}

const DEMO_STATION = {
  kind: "panel", name: say("Power station", "Stacja zasilania"), icon: "mdi:home-battery-outline", entity: "sensor.station_state",
  labels: { charging: say("Charging", "Ładuje się") }, active: "switch.station_ac",
  stats: [
    { name: say("Battery", "Bateria"), entity: "sensor.station_battery", unit: "%", digits: 0 },
    { name: say("In", "Wejście"), entity: "sensor.station_in", unit: "W", digits: 0 },
    { name: say("Out", "Wyjście"), entity: "sensor.station_out", unit: "W", digits: 0 },
  ],
  groups: [
    { title: say("Outputs", "Wyjścia"), layout: "controls", rows: [
      { entity: "switch.station_ac", name: say("AC sockets", "Gniazdka AC") }, { entity: "switch.station_usb", name: "USB" },
      { entity: "switch.station_dc", name: "DC 12 V" }] },
    { title: say("Charging", "Ładowanie"), layout: "controls", rows: [{ entity: "number.station_charge", name: say("AC charging (W)", "Ładowanie AC (W)") }] },
    { title: say("Battery", "Bateria"), rows: [
      { entity: "sensor.station_health", name: say("Health", "Kondycja") }, { entity: "sensor.station_cycles", name: say("Cycles", "Cykle") }] },
  ],
};

const DASHBOARD = {
  background: { light: "linear-gradient(160deg, #1d3b53, #4d7ea8)", dark: "linear-gradient(160deg, #1d3b53, #4d7ea8)" },
  scenes: [tile("scene.morning"), tile("scene.movie"), tile("scene.night")],
  scenes_layout: "row",
  music: { frame: `/dev/demo-music.html?language=${language}` },
  shortcuts: [
    {
      kind: "host",
      name: say("Machines", "Maszyny"),
      icon: "mdi:server",
      columns: [
        {
          title: say("Home server", "Serwer domowy"),
          icon: "mdi:server",
          subtitle: say("Mini PC · virtual machines", "Mini PC · maszyny wirtualne"),
          status: "switch.server_plug",
          bars: [
            { name: say("Processor", "Procesor"), entity: "sensor.server_cpu" },
            { name: "RAM", entity: "sensor.server_ram" },
            { name: say("Disk", "Dysk"), entity: "sensor.server_disk" },
            { name: say("Temperature", "Temperatura"), entity: "sensor.server_temperature", max: 100 },
          ],
          info: [{ name: say("Up for", "Działa od"), entity: "sensor.server_uptime", type: "since" }],
          machines: [
            { name: "Home Assistant", status: "binary_sensor.vm_home_assistant", cpu: "sensor.vm_home_assistant_cpu", ram: "sensor.vm_home_assistant_ram" },
            { name: say("Media", "Multimedia"), status: "binary_sensor.vm_media", cpu: "sensor.vm_media_cpu", ram: "sensor.vm_media_ram" },
            { name: say("Backups", "Kopie zapasowe"), status: "binary_sensor.vm_backup" },
          ],
          power: { entity: "sensor.server_power", voltage: "sensor.server_voltage", current: "sensor.server_current",
            energy: "sensor.server_energy", switch: "switch.server_plug" },
        },
      ],
    },
    { kind: "page", label: "Media", name: say("Sources", "Źródła"), icon: "mdi:play-box-multiple-outline", page: "media" },
    {
      kind: "panel",
      name: say("Vacuum", "Odkurzacz"),
      icon: "mdi:robot-vacuum",
      entity: "vacuum.robot",
      fullscreen: true,
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
            { name: say("Batteries", "Baterie"), icon: "mdi:battery-alert", auto: "battery", notify: true, below: 11 },
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
    {
      kind: "news",
      name: say("News", "Wiadomości"),
      icon: "mdi:newspaper-variant-outline",
      sections: [
        { title: say("Home", "Kraj"), entity: "sensor.news_home" },
        { title: say("World", "Świat"), entity: "sensor.news_world" },
      ],
    },
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
      { title: say("Other", "Inne"), tiles: [{ kind: "tv", entity: "media_player.streamer", name: "Apple TV", icon: "mdi:apple",
        shortcuts: [{ name: "YouTube", icon: "mdi:youtube" }, { name: "TV", icon: "mdi:apple" }, { name: say("Music", "Muzyka"), icon: "mdi:music" },
          { name: say("Photos", "Zdjęcia"), icon: "mdi:image-multiple-outline" }] }] },
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
  cameras: {
    snapshot_platforms: ["frigate"],
    ptz: {
      "camera.driveway": {
        mode: "manual",
        left: "button.driveway_pan_left",
        right: "button.driveway_pan_right",
        up: "button.driveway_pan_up",
        down: "button.driveway_pan_down",
        select: "select.driveway_position",
        button: "button.driveway_go_to_position",
      },
    },
    quick: { "camera.driveway": { siren: "siren.driveway_alarm", light: "light.driveway_floodlight", night: "select.driveway_night_vision" } },
  },
  intercom: { script: "script.announce", areas: ["hall", "living", "kitchen", "bedroom"], upload: "/api/intercom/message" },
  status_panel: {
    doors: ["lock.front", "binary_sensor.balcony_door"],
    now: [{ entity: "sensor.washer_phase", detail: "sensor.washer_program", remaining: "sensor.washer_left", icon: "mdi:washing-machine", name: say("Washer", "Pralka") }],
    power: [
      { entity: "sensor.heat_pump_power", name: say("Heat pump", "Pompa ciepła") },
      { entity: "sensor.computer_power", name: say("Computer", "Komputer") },
    ],
  },
  visibility: { "light.shelf": { only: ["kid"] }, "switch.coffee": { except: ["kid"] } },
  energy: {
    phases: [1, 2, 3].map((phase) => ({
      power: `sensor.meter_l${phase}_power`,
      voltage: `sensor.meter_l${phase}_voltage`,
      current: `sensor.meter_l${phase}_current`,
      factor: `sensor.meter_l${phase}_factor`,
    })),
    storage: [{ block: say("Power station", "Stacja zasilania"), name: say("Power station", "Stacja zasilania"), battery: "sensor.station_battery",
      state: "sensor.station_state", labels: { charging: say("Charging", "Ładuje się") }, input: "sensor.station_in", output: "sensor.station_out",
      remaining: "sensor.station_left" }],
  },
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
      sections: [
        { title: say("Devices", "Urządzenia"), tiles: [tile("light.counter"), tile("light.table"), tile("switch.coffee")] },
        { title: say("Coffee", "Kawa"), tiles: [tile("select.coffee_drink", say("Drink", "Napój"), { confirm: true, labels: DEMO_DRINKS })] },
        { title: say("Safety", "Bezpieczeństwo"), tiles: [tile("binary_sensor.sink_leak", say("Sink", "Zlew"))] },
      ],
    },
    {
      id: "bedroom",
      name: say("Bedroom", "Sypialnia"),
      areas: ["bedroom"],
      home: [tile("light.bedside"), tile("climate.bedroom"), tile("cover.bedroom")],
      sections: [{ title: say("Devices", "Urządzenia"), tiles: [tile("light.bedside"), tile("climate.bedroom"), tile("cover.bedroom")] }],
    },
    {
      id: "bathroom",
      name: say("Bathroom", "Łazienka"),
      areas: ["bathroom"],
      home: [],
      sections: [{ title: say("Devices", "Urządzenia"), tiles: [{ kind: "scale", name: say("Scale", "Waga"), icon: "mdi:scale-bathroom", entity: "sensor.scale_mass" }] }],
    },
    {
      id: "laundry",
      name: say("Utility room", "Pralnia"),
      areas: ["laundry"],
      home: [],
      sections: [
        { title: say("Washer and dryer", "Pralka i suszarka"), tiles: [demoMachine("washer"), demoMachine("dryer")] },
        { title: say("Devices", "Urządzenia"), tiles: [DEMO_STATION, { shortcut: say("Vacuum", "Odkurzacz"), entity: "vacuum.robot" },
          { shortcut: say("Machines", "Maszyny"), column: say("Home server", "Serwer domowy"), entity: "sensor.server_power", name: say("Home server", "Serwer domowy") }] },
      ],
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

// The statistics of a demo house for the Energy page: a usual day, more in the evening.
const DEMO_HOURS = [0.3, 0.2, 0.2, 0.2, 0.3, 0.6, 0.9, 0.7, 0.5, 0.4, 0.5, 0.6, 0.7, 0.5, 0.4, 0.5, 0.7, 1.0, 1.2, 1.1, 0.8, 0.6, 0.4, 0.3];
const DEMO_DEVICES = [
  ["sensor.heat_pump", say("Heat pump", "Pompa ciepła"), 0.32],
  ["sensor.dishwasher", say("Dishwasher", "Zmywarka"), 0.12],
  ["sensor.fridge", say("Fridge", "Lodówka"), 0.07],
  ["sensor.computer", say("Computer", "Komputer"), 0.05],
  ["sensor.router", say("Router and NAS", "Router i NAS"), 0.03],
];

function demoStatistics(message) {
  const start = Date.parse(message.start_time);
  const step = message.period === "hour" ? 3600000 : 86400000;
  const count = Math.round((Date.parse(message.end_time) - start) / step);
  const rows = (scale) =>
    Array.from({ length: count }, (_, index) => ({
      start: start + index * step,
      change: (message.period === "hour" ? DEMO_HOURS[index % 24] : 12 + (index % 5)) * scale,
    }));
  const weight = (id, from) =>
    message.statistic_ids?.includes(id)
      ? { [id]: Array.from({ length: count }, (_, index) => ({ start: start + index * step, mean: from - (index * 1.6) / count + Math.sin(index / 3) * 0.3 })) }
      : {};
  return {
    ...weight("sensor.alex_weight", 74),
    ...weight("sensor.sam_weight", 31),
    "sensor.grid": rows(1),
    "sensor.grid_cost": rows(0.25),
    "sensor.server_energy": rows(0.02),
    ...Object.fromEntries(DEMO_DEVICES.map(([id, , share]) => [id, rows(share)])),
  };
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
  "history-graph": () => {
    const graph = document.createElement("div");
    graph.innerHTML = `<svg viewBox="0 0 360 180" style="display: block; width: 100%">
      <polyline fill="none" stroke="#4d7ea8" stroke-width="3" points="0,120 40,110 80,126 120,96 160,88 200,60 240,72 280,48 320,66 360,54"/>
      <polyline fill="none" stroke="#cc6f00" stroke-width="3" points="0,150 40,146 80,150 120,140 160,136 200,120 240,126 280,116 320,122 360,118"/>
    </svg>`;
    return graph;
  },
  map: streetMap,
  // A live view of a camera: its picture.
  "picture-entity": (config) => {
    const picture = document.createElement("img");
    picture.src = `/dev/demo-pictures/${config.entity.split(".")[1]}.jpg`;
    picture.style.cssText = "display:block;width:100%;height:100%;object-fit:cover";
    return picture;
  },
  "demo-floor-plan": floorPlan,
};

window.loadCardHelpers = async () => ({
  createCardElement: (config) => DEMO_CARDS[config.type]?.(config) ?? document.createElement("div"),
});

// ?theme=apple shows the Apple Home theme that comes with Home Dashboard, with example backgrounds.
if (params.get("theme") === "apple") {
  const { BUILTIN_THEMES } = await import("/custom_components/home_dashboard/www/app/builtin-themes.js");
  const theme = BUILTIN_THEMES.find((item) => item.id === "apple_home");
  const picture = (name) => ({
    light: `/dev/demo-pictures/backgrounds/${name}_light.jpg`,
    dark: `/dev/demo-pictures/backgrounds/${name}_dark.jpg`,
    position: "top",
  });
  Object.assign(DASHBOARD, {
    appearance: theme.appearance,
    theme: theme.id,
    background: null,
    backgrounds: {
      ...theme.backgrounds,
      home: picture("home"),
      living: picture("living_room"),
      bedroom: picture("kids_room"),
      scenes: picture("office"),
    },
  });
  // In Home Assistant the view under the side bar of a tablet carries the background; here the page does.
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.style.background = theme.appearance.page[dark ? "background_dark" : "background_light"];
}

// ?status=1 turns on the status bar of a tablet on its side.
// Its hint about holding the button has been seen.
if (params.get("status")) {
  DASHBOARD.appearance = { ...DASHBOARD.appearance, status: { shown: true } };
  localStorage.setItem("home-dashboard-status-hint", "3");
}

if (params.get("room")) window.history.replaceState(null, "", `?${params}`);
const card = document.createElement("home-dashboard-page");
card.setConfig({ page: params.get("page") ?? "home", dashboard: DASHBOARD });
card.hass = buildHass();
document.body.append(card);
window.card = card;
await card.updateComplete;
window.demoReady = true;
