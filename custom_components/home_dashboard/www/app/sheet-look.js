// The look of the page and its themes. A part of the sheet (sheet.js), as a mixin of its methods.

import { html, nothing } from "../vendor/lit-all.min.js";
import {
  appearanceDiff,
  loadIconList,
  mergeAppearance,
  NAV_PAGES,
  NAV_RANGE,
  NAV_STYLES,
  searchIcons,
  STATUS_PARTS,
  TILE_FILLS,
  TILE_KINDS,
  TILE_RADIUS_RANGE,
  tileColour,
  tileColourStyle,
  tileVariables,
} from "./appearance.js";
import { NEW_BLOCK_ICONS } from "./block-editor.js";
import { entityIcon } from "./model.js";
import { personalPrefs, savePrefs } from "./prefs.js";
import { backgroundStyle } from "./styles.js";
import {
  activeTheme,
  addTheme,
  buildTheme,
  currentAsTheme,
  importableIcons,
  materializeTheme,
  parseTheme,
  removeTheme,
  saveIntoTheme,
  suggestTargets,
  themeChanged,
  themeId,
  themeLibrary,
  useTheme,
} from "./theme.js";

export const LookSheets = (Base) =>
  class extends Base {
    // Look of the page ------------------------------------------------------------------------

    // An administrator edits the shared look; everyone else, and an administrator who unticks it,
    // edits their own on top of it.
    _startLook(everyone = Boolean(this.hass.user?.is_admin)) {
      const shared = mergeAppearance(this.raw?.appearance);
      this._lookEveryone = everyone;
      this._look = everyone ? shared : mergeAppearance(this.raw?.appearance, personalPrefs().appearance);
      this._lookEntity = null;
      this._lookIcons = [];
      this._query = "";
    }

    _setLook(change) {
      this._look = { ...this._look, ...change };
    }

    _setLookTiles(change) {
      this._look = { ...this._look, tiles: { ...this._look.tiles, ...change } };
    }

    _setKindColour(kind, colour) {
      const { [kind]: dropped, ...colours } = this._look.tiles.colours;
      this._setLookTiles({ colours: colour ? { ...colours, [kind]: colour } : colours });
    }

    _setIcon(entityId, icon) {
      const { [entityId]: dropped, ...icons } = this._look.icons;
      this._setLook({ icons: icon ? { ...icons, [entityId]: icon } : icons });
    }

    async _searchIcons(query) {
      this._iconQuery = query;
      const list = await loadIconList((url) => this.hass.fetchWithAuth(url));
      if (this._iconQuery === query) this._lookIcons = searchIcons(list, query);
    }

    _saveLook() {
      const prefs = personalPrefs();
      if (this._lookEveryone) {
        this.dispatchEvent(new CustomEvent("sheet-appearance", { detail: { appearance: appearanceDiff(this._look) } }));
        return;
      }
      const own = appearanceDiff(this._look, mergeAppearance(this.raw?.appearance));
      const { appearance: dropped, ...rest } = prefs;
      savePrefs(this.hass, Object.keys(own).length ? { ...rest, appearance: own } : rest);
      this._close();
    }

    _resetOwnLook() {
      const { appearance: dropped, ...rest } = personalPrefs();
      savePrefs(this.hass, rest);
      this._startLook(false);
    }

    _renderSlider(data, label, value, [low, high], unit, onInput) {
      return html`
        <label class="field slider-field" data-look=${data}>
          <span>${label}</span>
          <input type="range" min=${low} max=${high} .value=${String(value)} @input=${(event) => onInput(Number(event.target.value))} />
          <output>${value}${unit}</output>
        </label>
      `;
    }

    // A few tiles drawn with the draft, so a change shows before it is saved.
    _renderLookPreview() {
      const { tiles } = this._look;
      const samples = [
        { kind: "light", tone: "light", icon: "mdi:lightbulb", name: this._t("look_kind_light"), state: "80%" },
        { kind: "cover", tone: "cover", icon: "mdi:blinds", name: this._t("look_kind_cover"), state: this._t("open_percent", { value: 100 }) },
        { kind: "scene", tone: "off", icon: "mdi:palette", name: this._t("look_kind_scene"), state: this._t("run") },
        { kind: "switch", tone: "off", icon: "mdi:toggle-switch-off-outline", name: this._t("look_kind_switch"), state: this._t("look_off") },
      ];
      return html`
        <div class="tile-preview ${tiles.fill === "icon" ? "fill-icon" : ""}" style=${tileVariables(this._look)} data-look-preview>
          ${samples.map(
            (sample) => html`
              <div class="look-tile tone-${sample.tone}" style=${tileColourStyle(tileColour(sample, this._look)) ?? nothing}>
                <span class="look-icon"><ha-icon .icon=${sample.icon}></ha-icon></span>
                <span class="row-text"><strong>${sample.name}</strong><small>${sample.state}</small></span>
              </div>
            `,
          )}
        </div>
      `;
    }

    // A colour or a gradient for the pages without a background of their own, one per look.
    _renderPaintField(key) {
      const value = this._look.page[key];
      return html`
        <div class="field look-colour" data-look-field="page.${key}">
          <span class="paint-swatch" style=${value ? `background: ${value}` : nothing}></span>
          <span>${this._t(`look_page_${key}`)}</span>
          ${value
            ? html`<button aria-label=${this._t("look_colour_clear")} data-look-field-clear @click=${() => this._setLookGroup("page", { [key]: null })}>
                <ha-icon icon="mdi:close"></ha-icon>
              </button>`
            : nothing}
          <input
            type="text"
            placeholder=${this._t("look_paint_placeholder")}
            .value=${value ?? ""}
            @change=${(event) => this._setLookGroup("page", { [key]: event.target.value.trim() || null })}
          />
        </div>
      `;
    }

    _renderLookBackground() {
      return html`
        ${this._renderSlider("strength", this._t("look_strength"), this._look.background_strength, [0, 100], "%", (value) =>
          this._setLook({ background_strength: value }),
        )}
        <p class="hint">${this._t("look_strength_hint")}</p>
        <label class="field" data-look="bounce">
          <span>${this._t("look_bounce")}</span>
          <input type="checkbox" .checked=${this._look.bounce} @change=${(event) => this._setLook({ bounce: event.target.checked })} />
        </label>
        <p class="hint">${this._t("look_bounce_hint")}</p>
        <p class="hint">${this._t("look_page_hint")}</p>
        ${this._renderPaintField("background_light")} ${this._renderPaintField("background_dark")}
        <h3 class="look-group">${this._t("look_tab_map")}</h3>
        <p class="hint">${this._t("look_map_theme_hint")}</p>
        ${this._renderBackgroundChoices(
          "map-theme",
          ["auto", "light", "dark"].map((theme) => [theme, this._t(`look_map_${theme}`)]),
          this._look.map.theme,
          (theme) => this._setLookGroup("map", { theme }),
        )}
        <p class="hint">${this._t("look_map_hours_hint")}</p>
        ${this._renderBackgroundChoices(
          "map-hours",
          [6, 24, 72, 168].map((hours) => [hours, this._t(`map_hours_${hours}`)]),
          this._look.map.hours,
          (hours) => this._setLookGroup("map", { hours }),
        )}
      `;
    }

    _setLookGroup(group, change) {
      this._look = { ...this._look, [group]: { ...this._look[group], ...change } };
    }

    _renderColourField(group, key) {
      const value = this._look[group][key];
      return html`
        <div class="field look-colour" data-look-field="${group}.${key}">
          <span>${this._t(`look_${group}_${key}`)}</span>
          ${this._renderSwatch(value, {
            pick: (colour) => this._setLookGroup(group, { [key]: colour + (value?.slice(7) ?? "") }),
            clear: () => this._setLookGroup(group, { [key]: null }),
            clearData: "data-look-field-clear",
          })}
        </div>
      `;
    }

    // A chosen colour as a round sample on a checkerboard (a see-through colour shows as such) with its code next to
    // it; no colour as an empty dashed ring, "Default". A tap on the sample opens the colour picker of the system.
    _renderSwatch(value, { pick, clear = null, clearData = "data-swatch-clear" }) {
      const hex = value?.slice(0, 7).toUpperCase();
      const alpha = value?.length === 9 ? Math.round((parseInt(value.slice(7), 16) / 255) * 100) : null;
      return html`
        <small class="swatch-text">${value ? `${hex}${alpha === null ? "" : ` · ${alpha}%`}` : this._t("look_colour_default")}</small>
        ${value && clear
          ? html`<button
              class="swatch-clear"
              aria-label=${this._t("look_colour_clear")}
              ?data-look-field-clear=${clearData === "data-look-field-clear"}
              ?data-look-colour-clear=${clearData === "data-look-colour-clear"}
              @click=${clear}
            >
              <ha-icon icon="mdi:close"></ha-icon>
            </button>`
          : nothing}
        <label class="swatch-pick ${value ? "" : "unset"}" style=${value ? `--swatch: ${value}` : ""}>
          <input type="color" .value=${value?.slice(0, 7) ?? "#808080"} @change=${(event) => pick(event.target.value)} />
        </label>
      `;
    }

    // Colours of everything around the tiles: writing, the blocks at the top, the round buttons.
    _renderLookColours() {
      const { chips, buttons, badges } = this._look;
      const heading = (key) => html`<h3 class="look-group">${this._t(key)}</h3>`;
      return html`
        ${this._renderLookPreview()}
        <p class="hint">${this._t("look_colours_page_hint")}</p>
        ${heading("look_group_text")} ${this._renderColourField("text", "title")} ${this._renderColourField("text", "headings")}
        ${heading("look_group_tiles")} ${this._renderColourField("tiles", "background")} ${this._renderColourField("tiles", "text")}
        ${this._renderColourField("tiles", "icon")} ${this._renderColourField("tiles", "icon_background")}
        ${heading("look_group_chips")} ${this._renderColourField("chips", "background")} ${this._renderColourField("chips", "text")}
        ${this._renderSlider("chip-opacity", this._t("look_opacity_short"), chips.opacity, [20, 100], "%", (value) =>
          this._setLookGroup("chips", { opacity: value }),
        )}
        ${this._renderSlider("chip-radius", this._t("look_radius"), chips.radius, [0, 30], " px", (value) =>
          this._setLookGroup("chips", { radius: value }),
        )}
        ${heading("look_group_buttons")} ${this._renderColourField("buttons", "background")} ${this._renderColourField("buttons", "icon")}
        ${this._renderSlider("button-opacity", this._t("look_opacity_short"), buttons.opacity, [20, 100], "%", (value) =>
          this._setLookGroup("buttons", { opacity: value }),
        )}
        ${heading("look_group_badges")} ${this._renderColourField("badges", "text")} ${this._renderColourField("badges", "icon")}
        <label class="field" data-look-badge-fill>
          <span>${this._t("look_badge_fill")}</span>
          <input type="checkbox" .checked=${badges.fill} @change=${(event) => this._setLookGroup("badges", { fill: event.target.checked })} />
        </label>
        <label class="field" data-look-badge-kinds>
          <span>${this._t("look_badge_kinds")}</span>
          <input type="checkbox" .checked=${badges.kinds} @change=${(event) => this._setLookGroup("badges", { kinds: event.target.checked })} />
        </label>
      `;
    }

    // What the bar may hold here: the pages, Scenes, the menu and each room.
    get _navChoices() {
      const music = Boolean(this.config?.music);
      const pages = NAV_PAGES.filter((key) => key !== (music ? "media" : "music"));
      const name = (key) => this._t({ scenes: "personal_scenes", menu: "menu" }[key] ?? `nav_${key}`);
      return [
        ...pages.map((key) => ({ key, name: name(key) })),
        ...(this.sheet.rooms ?? []).map((room) => ({ key: `room:${room.id}`, name: room.name })),
      ];
    }

    get _navItems() {
      const music = Boolean(this.config?.music);
      return this._look.nav.items ?? ["home", music ? "music" : "media", "energy", "map"];
    }

    _setNavItems(items) {
      this._setLookGroup("nav", { items });
    }

    _renderLookNav() {
      const { nav } = this._look;
      const items = this._navItems;
      const choices = this._navChoices;
      const name = (key) => choices.find((choice) => choice.key === key)?.name ?? key;
      const [low, high] = NAV_RANGE;
      const move = (index, delta) => {
        const next = [...items];
        const [moved] = next.splice(index, 1);
        next.splice(index + delta, 0, moved);
        this._setNavItems(next);
      };
      return html`
        <p class="hint">${this._t("look_nav_items_hint", { low, high })}</p>
        ${items.map(
          (key, index) => html`
            <div class="order-row" data-nav-item=${key}>
              <span>${name(key)}</span>
              <button aria-label=${this._t("personal_remove")} data-nav-remove ?disabled=${items.length <= low}
                @click=${() => this._setNavItems(items.filter((item) => item !== key))}>
                <ha-icon icon="mdi:close"></ha-icon>
              </button>
              <button aria-label=${this._t("personal_up")} data-nav-up ?disabled=${index === 0} @click=${() => move(index, -1)}>
                <ha-icon icon="mdi:arrow-up"></ha-icon>
              </button>
              <button aria-label=${this._t("personal_down")} data-nav-down ?disabled=${index === items.length - 1} @click=${() => move(index, 1)}>
                <ha-icon icon="mdi:arrow-down"></ha-icon>
              </button>
            </div>
          `,
        )}
        ${items.length < high
          ? html`<label class="field" data-nav-add>
              <span>${this._t("look_nav_add")}</span>
              <select @change=${(event) => event.target.value && this._setNavItems([...items, event.target.value])}>
                <option value="">—</option>
                ${choices.filter((choice) => !items.includes(choice.key)).map((choice) => html`<option value=${choice.key}>${choice.name}</option>`)}
              </select>
            </label>`
          : nothing}
        <p class="hint">${this._t("look_nav_style_hint")}</p>
        ${this._renderBackgroundChoices(
          "nav-style",
          NAV_STYLES.map((style) => [style, this._t(`look_nav_${style}`)]),
          nav.style,
          (style) => this._setLookGroup("nav", { style }),
        )}
        ${this._renderColourField("nav", "background")} ${this._renderColourField("nav", "icon")}
        ${this._renderColourField("nav", "active")}
        ${this._renderSlider("nav-opacity", this._t("look_opacity_short"), nav.opacity, [20, 100], "%", (value) =>
          this._setLookGroup("nav", { opacity: value }),
        )}
        ${this._renderSlider("nav-blur", this._t("look_nav_blur"), nav.blur, [0, 30], " px", (value) =>
          this._setLookGroup("nav", { blur: value }),
        )}
        <p class="hint">${this._t("look_nav_blur_hint")}</p>
        ${this._renderLookStatus()} ${this._renderLookPlayer()}
      `;
    }

    _renderLookSheets() {
      const { sheets } = this._look;
      const set = (change) => this._setLookGroup("sheets", change);
      return html`
        <p class="hint">${this._t("look_sheets_hint")}</p>
        ${this._renderColourField("sheets", "background")} ${this._renderColourField("sheets", "text")}
        ${this._renderColourField("sheets", "controls")} ${this._renderColourField("sheets", "cards")}
        <p class="hint">${this._t("look_sheets_cards_hint")}</p>
        ${this._renderSlider("sheet-opacity", this._t("look_opacity_short"), sheets.opacity, [20, 100], "%", (value) => set({ opacity: value }))}
        ${this._renderSlider("sheet-blur", this._t("look_nav_blur"), sheets.blur, [0, 40], " px", (value) => set({ blur: value }))}
        ${this._renderSlider("sheet-scrim", this._t("look_sheets_scrim"), sheets.scrim, [0, 80], "%", (value) => set({ scrim: value }))}
        <p class="hint">${this._t("look_sheets_scrim_hint")}</p>
      `;
    }

    // The status bar of a tablet: on or off, its parts in order and its colours.
    _renderLookStatus() {
      const { status } = this._look;
      const set = (change) => this._setLookGroup("status", change);
      const parts = status.widgets ?? STATUS_PARTS;
      const setParts = (widgets) => set({ widgets });
      const move = (index, delta) => {
        const next = [...parts];
        const [moved] = next.splice(index, 1);
        next.splice(index + delta, 0, moved);
        setParts(next);
      };
      const name = (key) => this._t(`status_part_${key}`);
      return html`
        <h3 class="look-group">${this._t("look_status_title")}</h3>
        <label class="field" data-look-status-shown>
          <span>${this._t("look_status_shown")}</span>
          <input type="checkbox" .checked=${status.shown} @change=${(event) => set({ shown: event.target.checked })} />
        </label>
        <p class="hint">${this._t("look_status_hint")}</p>
        ${status.shown
          ? html`
              <p class="hint">${this._t("look_status_widgets_hint")}</p>
              ${parts.map(
                (key, index) => html`
                  <div class="order-row" data-status-part=${key}>
                    <span>${name(key)}</span>
                    <button aria-label=${this._t("personal_remove")} data-status-part-remove ?disabled=${parts.length <= 1}
                      @click=${() => setParts(parts.filter((part) => part !== key))}>
                      <ha-icon icon="mdi:close"></ha-icon>
                    </button>
                    <button aria-label=${this._t("personal_up")} data-status-part-up ?disabled=${index === 0} @click=${() => move(index, -1)}>
                      <ha-icon icon="mdi:arrow-up"></ha-icon>
                    </button>
                    <button aria-label=${this._t("personal_down")} data-status-part-down ?disabled=${index === parts.length - 1}
                      @click=${() => move(index, 1)}>
                      <ha-icon icon="mdi:arrow-down"></ha-icon>
                    </button>
                  </div>
                `,
              )}
              ${parts.length < STATUS_PARTS.length
                ? html`<label class="field" data-status-part-add>
                    <span>${this._t("look_status_add")}</span>
                    <select @change=${(event) => event.target.value && setParts([...parts, event.target.value])}>
                      <option value="">—</option>
                      ${STATUS_PARTS.filter((key) => !parts.includes(key)).map((key) => html`<option value=${key}>${name(key)}</option>`)}
                    </select>
                  </label>`
                : nothing}
              <label class="field" data-look-status-colourful>
                <span>${this._t("look_status_colourful")}</span>
                <input type="checkbox" .checked=${status.colourful} @change=${(event) => set({ colourful: event.target.checked })} />
              </label>
              ${this._renderColourField("status", "background")} ${this._renderColourField("status", "text")}
              ${this._renderSlider("status-opacity", this._t("look_opacity_short"), status.opacity, [20, 100], "%", (value) =>
                set({ opacity: value }),
              )}
              ${this._renderSlider("status-blur", this._t("look_nav_blur"), status.blur, [0, 30], " px", (value) => set({ blur: value }))}
            `
          : nothing}
      `;
    }

    _renderLookPlayer() {
      const { player } = this._look;
      const set = (change) => this._setLookGroup("player", change);
      return html`
        <h3 class="look-group">${this._t("look_group_player")}</h3>
        ${this._renderSlider("player-paused", this._t("look_player_paused"), player.paused_minutes, [0, 120], " min", (value) =>
          set({ paused_minutes: value }),
        )}
        <p class="hint">${this._t("look_player_paused_hint")}</p>
        ${this._renderColourField("player", "background")} ${this._renderColourField("player", "text")}
        ${this._renderSlider("player-opacity", this._t("look_opacity_short"), player.opacity, [20, 100], "%", (value) => set({ opacity: value }))}
        ${this._renderSlider("player-blur", this._t("look_nav_blur"), player.blur, [0, 30], " px", (value) => set({ blur: value }))}
        ${this._renderSlider("player-radius", this._t("look_radius"), player.radius, [0, 32], " px", (value) => set({ radius: value }))}
      `;
    }

    _renderLookTiles() {
      const { tiles } = this._look;
      return html`
        ${this._renderLookPreview()}
        ${this._renderSlider("opacity", this._t("look_opacity"), tiles.opacity, [20, 100], "%", (value) => this._setLookTiles({ opacity: value }))}
        ${this._renderSlider("radius", this._t("look_radius"), tiles.radius, TILE_RADIUS_RANGE, " px", (value) => this._setLookTiles({ radius: value }))}
        <p class="hint">${this._t("look_fill_hint")}</p>
        ${this._renderBackgroundChoices(
          "look-fill",
          TILE_FILLS.map((fill) => [fill, this._t(`look_fill_${fill}`)]),
          tiles.fill,
          (fill) => this._setLookTiles({ fill }),
        )}
        <p class="hint">${this._t("look_colours_hint")}</p>
        ${TILE_KINDS.map((kind) => {
          const colour = tiles.colours[kind];
          return html`
            <div class="field look-colour" data-look-colour=${kind}>
              <span>${this._t(`look_kind_${kind}`)}</span>
              ${this._renderSwatch(colour, {
                pick: (value) => this._setKindColour(kind, value),
                clear: () => this._setKindColour(kind, null),
                clearData: "data-look-colour-clear",
              })}
            </div>
          `;
        })}
      `;
    }

    _renderLookIcons() {
      const { icons } = this._look;
      const query = (this._query ?? "").trim().toLowerCase();
      const matches = query
        ? Object.keys(this.hass.states)
            .filter((id) => !(id in icons))
            .filter((id) => id.includes(query) || (this.hass.states[id].attributes.friendly_name ?? "").toLowerCase().includes(query))
            .slice(0, 12)
        : [];
      const name = (id) => this.hass.states[id]?.attributes.friendly_name ?? id;
      const iconOf = (id) => (this.hass.states[id] ? entityIcon(this.hass, id, this.config) : "mdi:help-circle-outline");
      if (this._lookEntity) {
        const id = this._lookEntity;
        return html`
          <button class="row off" data-look-icon-back @click=${() => (this._lookEntity = null)}>
            <span class="row-icon"><ha-icon .icon=${icons[id] ?? iconOf(id)}></ha-icon></span>
            <span class="row-text"><strong>${name(id)}</strong><small>${id}</small></span>
          </button>
          <input
            class="search"
            type="search"
            placeholder=${this._t("look_icon_search")}
            data-look-icon-search
            @input=${(event) => this._searchIcons(event.target.value)}
          />
          <div class="icon-grid" data-look-icon-results>
            ${this._lookIcons.map(
              (icon) => html`
                <button
                  class="choice ${icons[id] === icon ? "on" : ""}"
                  aria-label=${icon}
                  title=${icon}
                  data-look-icon=${icon}
                  @click=${() => {
                    this._setIcon(id, icon);
                    this._lookEntity = null;
                  }}
                >
                  <ha-icon .icon=${icon}></ha-icon>
                </button>
              `,
            )}
          </div>
          ${icons[id]
            ? html`<button class="row off" data-look-icon-clear @click=${() => {
                this._setIcon(id, null);
                this._lookEntity = null;
              }}>
                <span class="row-icon"><ha-icon icon="mdi:restore"></ha-icon></span>
                <span class="row-text"><strong>${this._t("look_icon_default")}</strong></span>
              </button>`
            : nothing}
        `;
      }
      return html`
        <p class="hint">${this._t("look_icons_hint")}</p>
        <input
          class="search"
          type="search"
          placeholder=${this._t("look_entity_search")}
          data-look-entity-search
          .value=${this._query ?? ""}
          @input=${(event) => (this._query = event.target.value)}
        />
        ${matches.map(
          (id) => html`
            <button class="row off" data-look-entity=${id} @click=${() => this._pickLookEntity(id)}>
              <span class="row-icon"><ha-icon .icon=${iconOf(id)}></ha-icon></span>
              <span class="row-text"><strong>${name(id)}</strong><small>${id}</small></span>
            </button>
          `,
        )}
        ${Object.entries(icons).map(
          ([id, icon]) => html`
            <div class="order-row" data-look-own-icon=${id}>
              <ha-icon .icon=${icon}></ha-icon>
              <span>${name(id)}</span>
              <button aria-label=${this._t("look_icon_change")} data-look-icon-edit @click=${() => this._pickLookEntity(id)}>
                <ha-icon icon="mdi:pencil"></ha-icon>
              </button>
              <button aria-label=${this._t("look_icon_default")} data-look-icon-remove @click=${() => this._setIcon(id, null)}>
                <ha-icon icon="mdi:close"></ha-icon>
              </button>
            </div>
          `,
        )}
      `;
    }

    _pickLookEntity(id) {
      this._lookEntity = id;
      this._lookIcons = [];
      this._query = "";
    }

    _renderLook() {
      if (this._theme) return this._renderThemeImport();
      const admin = Boolean(this.hass.user?.is_admin);
      const tabs = {
        background: this._renderLookBackground,
        tiles: this._renderLookTiles,
        colours: this._renderLookColours,
        nav: this._renderLookNav,
        sheets: this._renderLookSheets,
        icons: this._renderLookIcons,
      };
      if (this._lookEveryone) tabs.themes = this._renderLookThemes;
      const tab = tabs[this._tab] ? this._tab : "background";
      return html`
        ${this._renderHeader(this._t("look_title"), false, false)}
        <div class="rows">
          ${this._renderTabs([
            ["background", this._t("look_tab_background")],
            ["tiles", this._t("look_tab_tiles")],
            ["colours", this._t("look_tab_colours")],
            ["nav", this._t("look_tab_nav")],
            ["sheets", this._t("look_tab_sheets")],
            ["icons", this._t("look_tab_icons")],
            ...(this._lookEveryone ? [["themes", this._t("look_tab_themes")]] : []),
          ])}
          ${admin
            ? html`<label class="field" data-look-everyone>
                <span>${this._t("layout_everyone")}</span>
                <input type="checkbox" .checked=${this._lookEveryone} @change=${(event) => this._startLook(event.target.checked)} />
              </label>`
            : nothing}
          <p class="hint">${this._t(this._lookEveryone ? "look_everyone_hint" : "look_mine_hint")}</p>
          ${tabs[tab].call(this)}
          ${tab === "themes"
            ? nothing
            : html`${!this._lookEveryone && personalPrefs().appearance
            ? html`<button class="row off" data-look-reset @click=${this._resetOwnLook}>
                <span class="row-icon"><ha-icon icon="mdi:restore"></ha-icon></span>
                <span class="row-text"><strong>${this._t("look_reset")}</strong></span>
              </button>`
            : nothing}
          <button class="block-action on" data-look-save @click=${this._saveLook}>
            <span>${this._t(this._lookEveryone ? "layout_save_everyone" : "save")}</span>
          </button>`}
        </div>
      `;
    }

    // Theme ---------------------------------------------------------------------------------------

    get _themeTargets() {
      return [
        { id: "home", name: this._t("home_page") },
        { id: "scenes", name: this._t("personal_scenes") },
        ...(this.sheet.rooms ?? []).map((room) => ({ id: room.id, name: room.name })),
      ];
    }

    async _readPicture(url) {
      try {
        const response = url.startsWith("/api/") ? await this.hass.fetchWithAuth(url) : await fetch(url);
        return response.ok ? await response.blob() : null;
      } catch {
        return null;
      }
    }

    // Exports the shared look as it is now, or a theme of the library.
    async _exportTheme(theme = null) {
      this._themeBusy = true;
      const names = Object.fromEntries(this._themeTargets.map((target) => [target.id, target.name]));
      const source = theme ?? { appearance: this.raw?.appearance ?? {}, backgrounds: this.raw?.backgrounds ?? {} };
      const name = theme?.name ?? (this._themeName.trim() || activeTheme(this.raw)?.name || "Home Dashboard");
      const file = await buildTheme(source, names, (url) => this._readPicture(url), name);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
      link.download = `${themeId(name).replace(/_[a-z0-9]+$/, "")}.home-dashboard-theme.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
      this._themeBusy = false;
    }

    async _readTheme(event) {
      const input = event.target;
      const [file] = input.files;
      if (!file) return;
      const theme = parseTheme(await file.text());
      // The same file can be chosen again after a change.
      input.value = "";
      this._themeProblem = !theme;
      if (!theme) return;
      this._theme = theme;
      this._themeName = theme.name || file.name.replace(/(\.home-dashboard-theme)?\.json$/, "");
      this._themeChoices = suggestTargets(theme, this._themeTargets);
    }

    async _uploadPicture(blob, name) {
      const body = new FormData();
      body.append("file", blob, `${name}.${blob.type.split("/")[1] ?? "jpg"}`);
      const response = await this.hass.fetchWithAuth("/api/image/upload", { method: "POST", body });
      if (!response.ok) throw new Error(String(response.status));
      const { id } = await response.json();
      return `/api/image/serve/${id}/original`;
    }

    get _unsavedName() {
      return this._t("theme_unsaved", { date: new Date().toLocaleDateString(this.hass.language) });
    }

    _saveDashboard(dashboard) {
      this.dispatchEvent(new CustomEvent("sheet-theme", { detail: { dashboard } }));
    }

    // An imported theme joins the library and is used at once.
    async _importTheme() {
      this._themeBusy = true;
      this._themeProblem = false;
      try {
        const entry = await materializeTheme(
          this._theme,
          this._themeName.trim() || this._t("theme_imported"),
          this._themeChoices,
          (blob, name) => this._uploadPicture(blob, name),
          (entityId) => entityId in this.hass.states,
        );
        this._saveDashboard(useTheme(addTheme(this.raw, entry), entry, this._unsavedName));
      } catch {
        this._themeProblem = true;
      }
      this._themeBusy = false;
    }

    _saveCurrentTheme() {
      const name = this._themeName.trim();
      if (!name) return;
      const entry = currentAsTheme(this.raw, name);
      this._saveDashboard({ ...addTheme(this.raw, entry), theme: entry.id });
    }

    _renderLookThemes() {
      const library = themeLibrary(this.raw);
      const active = activeTheme(this.raw);
      const button = (key, icon, data, onTap) => html`
        <button aria-label=${this._t(key)} title=${this._t(key)} data-theme-action=${data} ?disabled=${this._themeBusy} @click=${onTap}>
          <ha-icon .icon=${icon}></ha-icon>
        </button>
      `;
      return html`
        <p class="hint">${this._t("theme_hint")}</p>
        ${active
          ? html`<p class="hint" data-theme-active>
              ${this._t(themeChanged(this.raw) ? "theme_active_changed" : "theme_active", { name: active.name })}
            </p>`
          : nothing}
        ${active && themeChanged(this.raw)
          ? html`<button class="row off" data-theme-update @click=${() => this._saveDashboard(saveIntoTheme(this.raw, active))}>
              <span class="row-icon"><ha-icon icon="mdi:content-save-edit-outline"></ha-icon></span>
              <span class="row-text"><strong>${this._t("theme_update", { name: active.name })}</strong></span>
            </button>`
          : nothing}
        ${active && themeChanged(this.raw)
          ? html`<button class="row off" data-theme-reset @click=${() => this._saveDashboard(useTheme(this.raw, active, this._unsavedName))}>
              <span class="row-icon"><ha-icon icon="mdi:restore"></ha-icon></span>
              <span class="row-text"><strong>${this._t("theme_reset", { name: active.name })}</strong></span>
            </button>`
          : nothing}
        ${library.map(
          (theme) => html`
            <div class="order-row" data-theme=${theme.id}>
              <ha-icon .icon=${theme.id === active?.id ? "mdi:check-circle" : "mdi:palette-swatch-outline"}></ha-icon>
              <span class="row-text">
                <strong>${theme.name}</strong>
                ${theme.builtin ? html`<small>${this._t(theme.own ? "theme_builtin_own" : "theme_builtin")}</small>` : nothing}
              </span>
              ${button("theme_use", "mdi:play-circle-outline", "use", () => this._saveDashboard(useTheme(this.raw, theme, this._unsavedName)))}
              ${button("theme_export", "mdi:export-variant", "export", () => this._exportTheme(theme))}
              ${!theme.builtin
                ? button("theme_delete", "mdi:delete-outline", "delete", () => this._saveDashboard(removeTheme(this.raw, theme.id)))
                : theme.own
                  ? button("theme_restore", "mdi:restore", "restore", () => this._saveDashboard(removeTheme(this.raw, theme.id)))
                  : nothing}
            </div>
          `,
        )}
        <button class="row off" data-theme-plain @click=${() => this._saveDashboard(useTheme(this.raw, null, this._unsavedName))}>
          <span class="row-icon"><ha-icon icon="mdi:palette-outline"></ha-icon></span>
          <span class="row-text"><strong>${this._t("theme_plain")}</strong><small>${this._t("theme_plain_hint")}</small></span>
        </button>
        <label class="field">
          <span>${this._t("theme_name")}</span>
          <input type="text" data-theme-name .value=${this._themeName} @input=${(event) => (this._themeName = event.target.value)} />
        </label>
        <button class="row off" data-theme-save-current ?disabled=${!this._themeName.trim()} @click=${this._saveCurrentTheme}>
          <span class="row-icon"><ha-icon icon="mdi:content-save-outline"></ha-icon></span>
          <span class="row-text"><strong>${this._t("theme_save_current")}</strong></span>
        </button>
        <button class="row off" data-theme-export ?disabled=${this._themeBusy} @click=${() => this._exportTheme()}>
          <span class="row-icon"><ha-icon icon="mdi:export-variant"></ha-icon></span>
          <span class="row-text"><strong>${this._t("theme_export_current")}</strong></span>
        </button>
        <label class="row off" data-theme-import>
          <span class="row-icon"><ha-icon icon="mdi:import"></ha-icon></span>
          <span class="row-text"><strong>${this._t("theme_import")}</strong></span>
          <input type="file" accept="application/json,.json" hidden @change=${this._readTheme} />
        </label>
        ${this._themeProblem ? html`<p class="hint" data-theme-problem>${this._t("theme_problem")}</p>` : nothing}
      `;
    }

    _renderThemeImport() {
      const theme = this._theme;
      const icons = Object.keys(theme.appearance.icons ?? {});
      const matching = Object.keys(importableIcons(theme.appearance, (entityId) => entityId in this.hass.states));
      const targets = this._themeTargets;
      return html`
        ${this._renderHeader(this._t("theme_import"), false, false)}
        <div class="rows">
          <p class="hint">${this._t("theme_import_hint")}</p>
          <label class="field">
            <span>${this._t("theme_name")}</span>
            <input type="text" data-theme-name .value=${this._themeName} @input=${(event) => (this._themeName = event.target.value)} />
          </label>
          ${icons.length ? html`<p class="hint" data-theme-icons>${this._t("theme_icons", { count: matching.length, total: icons.length })}</p>` : nothing}
          ${Object.entries(theme.backgrounds).map(([key, entry]) => {
            const shown = entry.light ?? entry.dark ?? entry.light_wide ?? entry.dark_wide;
            return html`
              <div class="field theme-background" data-theme-background=${key}>
                <span class="theme-thumb" style=${backgroundStyle(shown, "top")}></span>
                <span>${entry.name}</span>
                <select @change=${(event) => (this._themeChoices = { ...this._themeChoices, [key]: event.target.value || null })}>
                  <option value="" ?selected=${!this._themeChoices[key]}>${this._t("theme_skip")}</option>
                  ${targets.map(
                    (target) => html`<option value=${target.id} ?selected=${this._themeChoices[key] === target.id}>${target.name}</option>`,
                  )}
                </select>
              </div>
            `;
          })}
          ${this._themeProblem ? html`<p class="hint" data-theme-problem>${this._t("theme_upload_problem")}</p>` : nothing}
          <button class="row off" data-theme-cancel @click=${() => (this._theme = null)}>
            <span class="row-icon"><ha-icon icon="mdi:arrow-left"></ha-icon></span>
            <span class="row-text"><strong>${this._t("theme_back")}</strong></span>
          </button>
          <button class="block-action on" data-theme-save ?disabled=${this._themeBusy} @click=${this._importTheme}>
            <span>${this._t("layout_save_everyone")}</span>
          </button>
        </div>
      `;
    }

    _renderPage() {
      const { item } = this.sheet;
      if (!this._embedded) {
        this._embedded = document.createElement("home-dashboard-page");
        this._embedded.setConfig({ page: item.page, dashboard: this.raw, embedded: true });
      }
      this._embedded.hass = this.hass;
      return html`${this._renderHeader(item.name, false, false)}${this._embedded}`;
    }

    _renderHost() {
      return html`
        ${this._renderHeader(this.sheet.item.name, false, false)}
        <home-dashboard-host .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-host>
      `;
    }

    _renderScale() {
      return html`
        ${this._renderHeader(this.sheet.item.name, false, false)}
        <home-dashboard-scale .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-scale>
      `;
    }

    _renderSchool() {
      return html`
        ${this._renderHeader(this.sheet.item.name, false, false)}
        <home-dashboard-school .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-school>
      `;
    }

    _renderWeather() {
      return html`
        ${this._renderHeader(this.sheet.item.label, false, false)}
        <home-dashboard-weather .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-weather>
      `;
    }

    _renderDepartures() {
      return html`
        ${this._renderHeader(this.sheet.item.name, false, false)}
        <home-dashboard-departures .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-departures>
      `;
    }

    _renderApp() {
      return html`
        ${this._renderHeader(this.sheet.item.name, false, false)}
        <home-dashboard-app .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-app>
      `;
    }

    _renderHistory() {
      return html`
        ${this._renderHeader(this._t("history"), false, false)}
        <home-dashboard-history .hass=${this.hass} .config=${this.config}></home-dashboard-history>
      `;
    }

    _renderLogbook() {
      return html`
        ${this._renderHeader(this._t("logbook"), false, false)}
        <home-dashboard-logbook .hass=${this.hass} .config=${this.config}></home-dashboard-logbook>
      `;
    }

    _renderNews() {
      return html`
        ${this._renderHeader(this.sheet.item.name, false, false)}
        <home-dashboard-news .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-news>
      `;
    }

    _renderNotifications() {
      return html`
        ${this._renderHeader(this._t("notifications_title"), false, false)}
        <home-dashboard-notifications .hass=${this.hass}></home-dashboard-notifications>
      `;
    }

    _renderOverview() {
      return html`
        ${this._renderHeader(this.sheet.item.name, false, false)}
        <home-dashboard-overview .hass=${this.hass} .item=${this.sheet.item}></home-dashboard-overview>
      `;
    }

    _saveShortcuts(shortcuts, renamed) {
      this.dispatchEvent(new CustomEvent("sheet-shortcuts", { detail: { shortcuts, renamed } }));
    }

    _renderBlocks() {
      const shortcuts = this.raw?.shortcuts ?? [];
      const move = (index, delta) => {
        const next = [...shortcuts];
        const [moved] = next.splice(index, 1);
        next.splice(index + delta, 0, moved);
        this._saveShortcuts(next);
      };
      return html`
        ${this._renderHeader(this._t("block_title"), false, false)}
        <div class="rows">
          ${shortcuts.map(
            (item, index) => html`
              <div class="order-row" data-block=${item.name}>
                <span>${item.name}</span>
                <button aria-label=${this._t("block_edit")} data-block-edit @click=${() => this._change({ kind: "block-edit", item, index })}>
                  <ha-icon icon="mdi:pencil-outline"></ha-icon>
                </button>
                <button aria-label=${this._t("personal_up")} ?disabled=${index === 0} @click=${() => move(index, -1)}>
                  <ha-icon icon="mdi:arrow-up"></ha-icon>
                </button>
                <button aria-label=${this._t("personal_down")} ?disabled=${index === shortcuts.length - 1} @click=${() => move(index, 1)}>
                  <ha-icon icon="mdi:arrow-down"></ha-icon>
                </button>
              </div>
            `,
          )}
          <button class="row off" data-block-media @click=${this._editMediaSections}>
            <span class="row-icon"><ha-icon icon="mdi:play-box-multiple-outline"></ha-icon></span>
            <span class="row-text"><strong>${this._t("block_kind_media")}</strong></span>
          </button>
          <h3>${this._t("block_add_title")}</h3>
          <div class="block-actions">
            ${Object.entries(NEW_BLOCK_ICONS).map(
              ([kind, icon]) => html`
                <button class="block-action" data-block-new=${kind} @click=${() => this._change({ kind: "block-edit", item: { kind, name: "", icon } })}>
                  <ha-icon .icon=${icon}></ha-icon>
                  <span>${this._t(`block_kind_${kind}`)}</span>
                </button>
              `,
            )}
          </div>
        </div>
      `;
    }

    _editMediaSections() {
      const sections = this.raw?.media?.sections ?? [];
      const onSave = (item) => this.dispatchEvent(new CustomEvent("sheet-media", { detail: { sections: item.sections ?? [] } }));
      this._change({ kind: "block-edit", item: { kind: "media", sections }, onSave });
    }

    _blockSaved(item) {
      const { onSave, index, item: before } = this.sheet;
      if (onSave) {
        onSave(item);
        this._close();
        return;
      }
      const shortcuts = [...(this.raw?.shortcuts ?? [])];
      if (index === undefined) shortcuts.push(item);
      else shortcuts[index] = item;
      const renamed = before.name && before.name !== item.name ? { from: before.name, to: item.name } : null;
      this._saveShortcuts(shortcuts, renamed);
    }

    _blockRemoved() {
      this._saveShortcuts((this.raw?.shortcuts ?? []).filter((_, position) => position !== this.sheet.index));
    }

    _renderBlockEdit() {
      const { item, index } = this.sheet;
      return html`
        ${this._renderHeader(item.name || this._t(`block_kind_${item.kind}`), false, false)}
        <home-dashboard-block-editor
          .hass=${this.hass}
          .item=${item}
          .shortcuts=${(this.raw?.shortcuts ?? []).map(({ name }) => name)}
          .users=${this._users}
          ?removable=${index !== undefined}
          @block-save=${(event) => this._blockSaved(event.detail.item)}
          @block-remove=${this._blockRemoved}
        ></home-dashboard-block-editor>
      `;
    }
  };
