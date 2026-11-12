// Rooms, a person's own layout and view of a room, access and the background. A part of the sheet (sheet.js), as a mixin of its methods.

import { html, nothing } from "../vendor/lit-all.min.js";
import {
  accessChoices,
  BACKGROUND_POSITIONS,
  backgroundSlot,
  favoriteCandidates,
  personalChoices,
  roomViewChoices,
  sharedLayoutChoices,
} from "./model.js";
import { personalPrefs, savePrefs } from "./prefs.js";
import { dashboardStart, setDashboardStart } from "./settings.js";
import { BACKGROUNDS, EVERYONE_ELSE } from "./sheet-shared.js";
import { roomActions } from "./status.js";
import { backgroundStyle, currentColorMode, isDark, screenShape } from "./styles.js";

export const SettingsSheets = (Base) =>
  class extends Base {
    // Rooms -----------------------------------------------------------------------------------

    _renderRooms() {
      return html`
        ${this._renderHeader(this._t("rooms_pick"), false, false)}
        <div class="rows">
          <button class="row off" data-home-link @click=${() => this.dispatchEvent(new CustomEvent("sheet-home"))}>
            <span class="row-icon"><ha-icon icon="mdi:home"></ha-icon></span>
            <span class="row-text"><strong>${this._t("home_page")}</strong></span>
          </button>
          ${this.sheet.rooms.map(
            (room) => html`
              <button
                class="row off"
                data-area-link=${room.id}
                @click=${() => this.dispatchEvent(new CustomEvent("sheet-room", { detail: { id: room.id } }))}
              >
                <span class="row-icon"><ha-icon icon="mdi:floor-plan"></ha-icon></span>
                <span class="row-text"><strong>${room.name}</strong></span>
              </button>
            `,
          )}
          <hr />
          ${this.hass.user?.is_admin
            ? html`
                <button class="row off" data-sheet-access @click=${() => this._change({ kind: "access" })}>
                  <span class="row-icon"><ha-icon icon="mdi:account-lock-outline"></ha-icon></span>
                  <span class="row-text"><strong>${this._t("access_title")}</strong></span>
                </button>
              `
            : nothing}
          ${this.sheet.onBackground
            ? html`
                <button class="row off" data-sheet-background @click=${() => this._leaveFor(this.sheet.onBackground)}>
                  <span class="row-icon"><ha-icon icon="mdi:image-outline"></ha-icon></span>
                  <span class="row-text"><strong>${this._t("screen_background")}</strong></span>
                </button>
              `
            : nothing}
          ${this.sheet.roomView
            ? html`
                <button class="row off" data-sheet-room-view @click=${() => this._change({ kind: "room-view", room: this.sheet.roomView })}>
                  <span class="row-icon"><ha-icon icon="mdi:eye-settings-outline"></ha-icon></span>
                  <span class="row-text"><strong>${this._t("room_view_title")}</strong></span>
                </button>
              `
            : nothing}
          ${this.sheet.personal
            ? html`
                <button class="row off" data-sheet-personal @click=${() => this._change({ kind: "personal" })}>
                  <span class="row-icon"><ha-icon icon="mdi:sort"></ha-icon></span>
                  <span class="row-text"><strong>${this._t("personal_title")}</strong></span>
                </button>
              `
            : nothing}
          ${this.hass.user?.is_admin && this.sheet.personal
            ? html`
                <button class="row off" data-sheet-blocks @click=${() => this._change({ kind: "blocks" })}>
                  <span class="row-icon"><ha-icon icon="mdi:view-grid-plus-outline"></ha-icon></span>
                  <span class="row-text"><strong>${this._t("block_title")}</strong></span>
                </button>
              `
            : nothing}
          ${this.sheet.onEdit
            ? html`
                <button class="row off" data-sheet-edit @click=${() => this._leaveFor(this.sheet.onEdit)}>
                  <span class="row-icon"><ha-icon icon="mdi:pencil-outline"></ha-icon></span>
                  <span class="row-text"><strong>${this._t("edit_screen")}</strong></span>
                </button>
              `
            : nothing}
        </div>
      `;
    }

    // My layout -------------------------------------------------------------------------------

    _renderTabs(tabs) {
      return html`
        <div class="choices sheet-tabs">
          ${tabs.map(
            ([key, label]) => html`
              <button class="choice ${this._tab === key ? "on" : ""}" data-tab=${key} @click=${() => (this._tab = key)}>
                <span>${label}</span>
              </button>
            `,
          )}
        </div>
      `;
    }

    // An administrator arranges rooms and favorites for everyone here too, so there is one place for both.
    _toggleShared(on) {
      const config = this.raw ?? {};
      this._shared = on
        ? { order: [...(config.rooms?.order ?? [])], hidden: [...(config.rooms?.hidden ?? [])], favorites: [...(config.favorites ?? [])] }
        : null;
      this._query = "";
    }

    _saveShared() {
      const { order, hidden, favorites } = this._shared;
      this.dispatchEvent(new CustomEvent("sheet-layout", { detail: { rooms: { order, hidden }, favorites } }));
    }

    _movePersonal(list, index, delta) {
      const order = list.map((item) => item.id);
      const [moved] = order.splice(index, 1);
      order.splice(index + delta, 0, moved);
      if (this._sharedTab) {
        this._shared = { ...this._shared, [this._tab === "rooms" ? "order" : "favorites"]: order };
        return;
      }
      savePrefs(this.hass, { ...personalPrefs(), [this._tab]: order });
      this.requestUpdate();
    }

    _togglePersonal(id) {
      if (this._sharedTab) {
        const { hidden } = this._shared;
        this._shared = { ...this._shared, hidden: hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id] };
        return;
      }
      const key = `hidden_${this._tab}`;
      const prefs = personalPrefs();
      const hidden = prefs[key] ?? [];
      const next = hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id];
      savePrefs(this.hass, { ...prefs, [key]: next });
      this.requestUpdate();
    }

    _setFavorites(ids) {
      this._query = "";
      if (this._sharedTab) {
        this._shared = { ...this._shared, favorites: ids };
        return;
      }
      savePrefs(this.hass, { ...personalPrefs(), favorites: ids });
      this.requestUpdate();
    }

    _renderFavorites(list) {
      const ids = list.map((item) => item.id);
      const matches = favoriteCandidates(this.hass, this.raw, this.hass.user?.id, ids, this._query ?? "");
      return html`
        <input
          class="search"
          type="search"
          placeholder=${this._t("favorites_add")}
          data-favorite-search
          .value=${this._query ?? ""}
          @input=${(event) => (this._query = event.target.value)}
        />
        ${matches.map(
          ({ id, name }) => html`
            <button class="row off" data-favorite-match=${id} @click=${() => this._setFavorites([...ids, id])}>
              <span class="row-icon"><ha-icon icon="mdi:plus"></ha-icon></span>
              <span class="row-text"><strong>${name}</strong><small>${id}</small></span>
            </button>
          `,
        )}
        ${list.map(
          (item, index) => html`
            <div class="order-row" data-order=${item.id}>
              <span>${item.name}</span>
              <button aria-label=${this._t("personal_remove")} data-personal="remove" @click=${() => this._setFavorites(ids.filter((id) => id !== item.id))}>
                <ha-icon icon="mdi:close"></ha-icon>
              </button>
              <button aria-label=${this._t("personal_up")} data-personal="up" ?disabled=${index === 0} @click=${() => this._movePersonal(list, index, -1)}>
                <ha-icon icon="mdi:arrow-up"></ha-icon>
              </button>
              <button
                aria-label=${this._t("personal_down")}
                data-personal="down"
                ?disabled=${index === list.length - 1}
                @click=${() => this._movePersonal(list, index, 1)}
              >
                <ha-icon icon="mdi:arrow-down"></ha-icon>
              </button>
            </div>
          `,
        )}
      `;
    }

    // Kept with the account, so every device of the person opens here; the device remembers it too.
    _toggleStart(on) {
      const start = on ? dashboardStart() : false;
      savePrefs(this.hass, { ...personalPrefs(), start });
      setDashboardStart(on ? start : null);
      this.requestUpdate();
    }

    get _sharedTab() {
      return Boolean(this._shared) && ["rooms", "favorites"].includes(this._tab);
    }

    _renderPersonal() {
      const choices = this._sharedTab
        ? sharedLayoutChoices(this.hass, this.raw, this._shared)
        : personalChoices(this.hass, this.raw, this.hass.user?.id, personalPrefs());
      const list = choices[this._tab];
      const canShare = this.hass.user?.is_admin && ["rooms", "favorites"].includes(this._tab);
      const orderable = this._tab !== "menu";
      const button = (key, icon, disabled, onTap, data) => html`
        <button aria-label=${this._t(key)} data-personal=${data} ?disabled=${disabled} @click=${onTap}>
          <ha-icon .icon=${icon}></ha-icon>
        </button>
      `;
      return html`
        ${this._renderHeader(this._t("personal_title"), false, false)}
        <div class="rows">
          ${this._renderTabs([
            ["cameras", this._t("personal_cameras")],
            ["rooms", this._t("personal_rooms")],
            ["chips", this._t("personal_chips")],
            ["scenes", this._t("personal_scenes")],
            ["favorites", this._t("personal_favorites")],
            ["menu", this._t("personal_menu")],
          ])}
          ${canShare
            ? html`<label class="field" data-layout-everyone>
                <span>${this._t("layout_everyone")}</span>
                <input type="checkbox" .checked=${Boolean(this._shared)} @change=${(event) => this._toggleShared(event.target.checked)} />
              </label>`
            : nothing}
          ${this._tab === "favorites"
            ? this._renderFavorites(list)
            : list.map(
                (item, index) => html`
                  <div class="order-row ${item.hidden ? "muted" : ""}" data-order=${item.id}>
                    <span>${item.name}</span>
                    ${button("personal_hide", item.hidden ? "mdi:eye-off-outline" : "mdi:eye-outline", false, () => this._togglePersonal(item.id), "hide")}
                    ${orderable ? button("personal_up", "mdi:arrow-up", index === 0, () => this._movePersonal(list, index, -1), "up") : nothing}
                    ${orderable
                      ? button("personal_down", "mdi:arrow-down", index === list.length - 1, () => this._movePersonal(list, index, 1), "down")
                      : nothing}
                  </div>
                `,
              )}
          ${this._sharedTab
            ? html`<button class="block-action on" data-layout-save @click=${() => this._saveShared()}>
                <span>${this._t("layout_save_everyone")}</span>
              </button>`
            : html`<label class="field" data-start-mine>
                  <span>${this._t("start_mine")}</span>
                  <input type="checkbox" .checked=${Boolean(personalPrefs().start)} @change=${(event) => this._toggleStart(event.target.checked)} />
                </label>
                <button class="block-action" data-personal-reset @click=${() => this._resetPersonal()}>
                  <span>${this._t("personal_reset")}</span>
                </button>`}
        </div>
      `;
    }

    _resetPersonal() {
      savePrefs(this.hass, {});
      this.requestUpdate();
    }

    // My view of a room ---------------------------------------------------------------------

    _toggleRoomHidden(kind, key) {
      const prefs = personalPrefs();
      const { room } = this.sheet;
      const all = prefs[kind] ?? {};
      const list = all[room] ?? [];
      const next = list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
      savePrefs(this.hass, { ...prefs, [kind]: { ...all, [room]: next } });
      this.requestUpdate();
    }

    _restoreRoom() {
      const prefs = personalPrefs();
      const { room } = this.sheet;
      const without = (kind) => Object.fromEntries(Object.entries(prefs[kind] ?? {}).filter(([key]) => key !== room));
      savePrefs(this.hass, { ...prefs, hidden_tiles: without("hidden_tiles"), hidden_sections: without("hidden_sections") });
      this.requestUpdate();
    }

    _renderRoomView() {
      const prefs = personalPrefs();
      const actionsOf = (config, model) => roomActions(this.hass, config, model, "phone");
      const sections = roomViewChoices(this.hass, this.raw, this.hass.user?.id, prefs, this.sheet.room, actionsOf);
      const eye = (hidden, label, onTap, data) => html`
        <button aria-label=${this._t("personal_hide")} data-view=${data} @click=${onTap}>
          <ha-icon .icon=${hidden ? "mdi:eye-off-outline" : "mdi:eye-outline"}></ha-icon>
        </button>
      `;
      return html`
        ${this._renderHeader(this._t("room_view_title"), false, false)}
        <div class="rows">
          <p class="hint">${this._t("room_view_hint")}</p>
          ${sections.map(
            (section) => html`
              <div class="order-row view-section ${section.hidden ? "muted" : ""}" data-view-section=${section.id}>
                <span><strong>${section.title}</strong></span>
                ${section.whole ? eye(section.hidden, section.title, () => this._toggleRoomHidden("hidden_sections", section.id), "section") : nothing}
              </div>
              ${section.hidden
                ? nothing
                : section.tiles.map(
                    (tile) => html`
                      <div class="order-row view-tile ${tile.hidden ? "muted" : ""}" data-view-tile=${tile.key}>
                        <span>${tile.name}</span>
                        ${eye(tile.hidden, tile.name, () => this._toggleRoomHidden("hidden_tiles", tile.key), "tile")}
                      </div>
                    `,
                  )}
            `,
          )}
          <button class="block-action" data-view-restore @click=${() => this._restoreRoom()}>
            <span>${this._t("room_view_restore")}</span>
          </button>
        </div>
      `;
    }

    // Access ----------------------------------------------------------------------------------

    async _loadUsers() {
      this._users = [];
      const users = await this.hass.callWS({ type: "config/auth/list" });
      this._users = (Array.isArray(users) ? users : []).filter((user) => !user.system_generated && user.is_active !== false);
      this._accessUser = this._users.find((user) => !user.is_owner)?.id ?? this._users[0]?.id;
    }

    get _accessDraft() {
      return this._access ?? this.config.access;
    }

    get _accessTargets() {
      if (this._accessUser !== EVERYONE_ELSE) return [this._accessUser];
      return (this._users ?? []).map((user) => user.id).filter((id) => id !== this.hass.user?.id);
    }

    // With several people, only what all of them have hidden counts as hidden.
    _accessHidden(key) {
      const [first, ...rest] = this._accessTargets.map((id) => this._accessDraft[id]?.[key] ?? []);
      return (first ?? []).filter((id) => rest.every((list) => list.includes(id)));
    }

    _toggleAccess(key, id) {
      const hide = !this._accessHidden(key).includes(id);
      const draft = { ...this._accessDraft };
      for (const user of this._accessTargets) {
        const rule = draft[user] ?? {};
        const others = (rule[key] ?? []).filter((item) => item !== id);
        draft[user] = { ...rule, [key]: hide ? [...others, id] : others };
      }
      this._access = draft;
    }

    _renderAccess() {
      const choices = accessChoices(this.hass, this.raw);
      const key = { rooms: "rooms", sections: "sections" }[this._tab] ?? "hide";
      const query = this._query.toLowerCase();
      const list = (choices[this._tab] ?? []).filter((item) => item.name.toLowerCase().includes(query));
      const shut = this._accessHidden(key);
      const hidden = (id) => shut.includes(id);
      return html`
        ${this._renderHeader(this._t("access_title"), false, false)}
        <div class="rows">
          <label class="field">
            <span>${this._t("access_user")}</span>
            <select data-access-user @change=${(event) => (this._accessUser = event.target.value)}>
              ${(this._users ?? []).map(
                (user) => html`<option value=${user.id} ?selected=${user.id === this._accessUser}>${user.name}</option>`,
              )}
              <option value=${EVERYONE_ELSE} ?selected=${this._accessUser === EVERYONE_ELSE}>${this._t("access_everyone_else")}</option>
            </select>
          </label>
          ${this._renderTabs([
            ["cameras", this._t("access_cameras")],
            ["rooms", this._t("access_rooms")],
            ["sections", this._t("access_sections")],
            ["chips", this._t("personal_chips")],
            ["lights", this._t("access_lights")],
            ["media", this._t("access_media")],
            ["security", this._t("access_security")],
            ["actions", this._t("access_actions")],
            ["other", this._t("access_other")],
          ])}
          <input
            class="search"
            type="search"
            placeholder=${this._t("access_search")}
            data-access-search
            .value=${this._query}
            @input=${(event) => (this._query = event.target.value)}
          />
          <small>${this._t("access_hidden", {
            count: ["hide", "rooms", "sections"].reduce((sum, key) => sum + this._accessHidden(key).length, 0),
          })}</small>
          ${[...list]
            .sort((a, b) => Number(hidden(b.id)) - Number(hidden(a.id)))
            .map(
              (item) => html`
                <div class="order-row ${hidden(item.id) ? "muted" : ""}" data-access=${item.id}>
                  <span>${item.name}</span>
                  <button aria-label=${this._t("personal_hide")} @click=${() => this._toggleAccess(key, item.id)}>
                    <ha-icon .icon=${hidden(item.id) ? "mdi:eye-off-outline" : "mdi:eye-outline"}></ha-icon>
                  </button>
                </div>
              `,
            )}
          <button
            class="block-action on"
            data-access-save
            ?disabled=${!this._access}
            @click=${() => this.dispatchEvent(new CustomEvent("sheet-access", { detail: { access: this._access } }))}
          >
            <span>${this._t("save")}</span>
          </button>
        </div>
      `;
    }

    async _leaveFor(onEdit) {
      if (this._leaving) return;
      this._leaving = true;
      await this._slideOut();
      this.dispatchEvent(new CustomEvent("sheet-edit", { detail: { onEdit } }));
    }

    // Background ------------------------------------------------------------------------------

    _startBackground() {
      const { shared, own } = this.sheet;
      const admin = Boolean(this.hass.user?.is_admin);
      const mine = (mode) => mode in own || `${mode}_wide` in own;
      const value = (mode, slot) => (mine(mode) ? (own[slot] ?? null) : shared[slot]);
      this._bg = {
        light: value("light", "light"),
        dark: value("dark", "dark"),
        light_wide: value("light", "light_wide"),
        dark_wide: value("dark", "dark_wide"),
        position: own.position ?? shared.position ?? "center",
      };
      this._bgMode = isDark() ? "dark" : "light";
      this._bgShape = screenShape();
      this._bgEveryone = { light: admin && !mine("light"), dark: admin && !mine("dark") };
    }

    _pickBackground(value) {
      this._bg = { ...this._bg, [backgroundSlot(this._bgMode, this._bgShape)]: value };
    }

    async _uploadBackground(event) {
      const [file] = event.target.files;
      if (!file) return;
      this._uploadProblem = false;
      const body = new FormData();
      body.append("file", file);
      try {
        const response = await this.hass.fetchWithAuth("/api/image/upload", { method: "POST", body });
        if (!response.ok) throw new Error(String(response.status));
        const { id } = await response.json();
        this._pickBackground(`/api/image/serve/${id}/original`);
      } catch {
        this._uploadProblem = true;
      }
    }

    // Each look goes either to everyone, which only an administrator can do, or to this account alone.
    async _saveBackground() {
      const { target, shared } = this.sheet;
      const prefs = personalPrefs();
      const nextShared = { ...shared };
      const own = {};
      ["light", "dark"].forEach((mode) => {
        const place = this._bgEveryone[mode] ? nextShared : own;
        place[mode] = this._bg[mode];
        place[`${mode}_wide`] = this._bg[`${mode}_wide`];
      });
      // A wide picture or a part to keep that nobody chose is left out, so the configuration stays short.
      [nextShared, own].forEach((place) => {
        ["light_wide", "dark_wide"].forEach((slot) => place[slot] ?? delete place[slot]);
        if (Object.keys(place).length) place.position = this._bg.position;
        if (place.position === "center") delete place.position;
      });
      const backgrounds = { ...prefs.backgrounds, [target]: own };
      if (!Object.keys(own).length) delete backgrounds[target];
      savePrefs(this.hass, { ...prefs, backgrounds });
      if (Object.values(this._bgEveryone).some(Boolean)) {
        this.dispatchEvent(new CustomEvent("sheet-background", { detail: { target, shared: nextShared } }));
      } else {
        this._close();
      }
    }

    _clearOwnBackground() {
      const prefs = personalPrefs();
      const { [this.sheet.target]: dropped, ...backgrounds } = prefs.backgrounds ?? {};
      savePrefs(this.hass, { ...prefs, backgrounds });
      this._close();
    }

    _renderBackgroundField(mode) {
      const other = this._bgShape === "wide" ? "tall" : "wide";
      const own = this._bg[backgroundSlot(mode, this._bgShape)];
      const value = own ?? this._bg[backgroundSlot(mode, other)];
      const admin = this.hass.user?.is_admin;
      const note = own ? nothing : html`<small>${this._t(value ? `background_as_${other}` : "background_none")}</small>`;
      return html`
        <div class="look ${this._bgMode === mode ? "on" : ""}" data-look=${mode}>
          <button
            class="look-preview ${own ? "" : "borrowed"}"
            style=${value ? backgroundStyle(value, this._bg.position) : nothing}
            @click=${() => (this._bgMode = mode)}
          >
            ${note}
          </button>
          <strong>${this._t(`background_${mode}`)}</strong>
          ${admin
            ? html`<label class="look-scope">
                <input
                  type="checkbox"
                  data-everyone=${mode}
                  .checked=${this._bgEveryone[mode]}
                  @change=${(event) => (this._bgEveryone = { ...this._bgEveryone, [mode]: event.target.checked })}
                />
                <span>${this._t("background_everyone")}</span>
              </label>`
            : nothing}
        </div>
      `;
    }

    _pickColorMode(mode) {
      savePrefs(this.hass, { ...personalPrefs(), color_mode: mode });
      this._bgMode = isDark() ? "dark" : "light";
      this.requestUpdate();
    }

    _renderBackgroundChoices(data, items, current, onPick) {
      return html`
        <div class="choices even" data-group=${data}>
          ${items.map(
            ([key, label]) => html`
              <button class="choice ${key === current ? "on" : ""}" data-choice=${key} @click=${() => onPick(key)}>${label}</button>
            `,
          )}
        </div>
      `;
    }

    _renderBackground() {
      const current = this._bg[backgroundSlot(this._bgMode, this._bgShape)];
      return html`
        ${this._renderHeader(this._t("screen_background"), false, false)}
        <div class="rows">
          <div class="choices" data-color-modes>
            ${["auto", "light", "dark"].map(
              (mode) => html`
                <button
                  class="choice ${mode === (personalPrefs().color_mode ?? currentColorMode()) ? "on" : ""}"
                  data-color-mode=${mode}
                  @click=${() => this._pickColorMode(mode)}
                >
                  ${this._t(`color_mode_${mode}`)}
                </button>
              `,
            )}
          </div>
          <p class="hint">${this._t("background_shape_hint")}</p>
          ${this._renderBackgroundChoices(
            "bg-shape",
            [
              ["tall", this._t("background_tall")],
              ["wide", this._t("background_wide")],
            ],
            this._bgShape,
            (shape) => (this._bgShape = shape),
          )}
          <div class="looks">${this._renderBackgroundField("light")}${this._renderBackgroundField("dark")}</div>
          <div class="swatches">
            ${BACKGROUNDS.map(
              (background) => html`
                <button
                  class="swatch ${background === current ? "selected" : ""}"
                  style=${backgroundStyle(background)}
                  data-swatch=${background}
                  @click=${() => this._pickBackground(background)}
                ></button>
              `,
            )}
          </div>
          <label class="field">
            <span>${this._t("background_colour")}</span>
            <span class="swatch-pick rainbow">
              <input type="color" data-colour @change=${(event) => this._pickBackground(event.target.value)} />
            </span>
          </label>
          <label class="field">
            <span>${this._t("background_picture")}</span>
            <input type="file" accept="image/*" data-picture @change=${this._uploadBackground} />
          </label>
          <p class="hint">${this._t("background_position_hint")}</p>
          ${this._renderBackgroundChoices(
            "bg-position",
            BACKGROUND_POSITIONS.map((position) => [position, this._t(`background_${position}`)]),
            this._bg.position,
            (position) => (this._bg = { ...this._bg, position }),
          )}
          ${this._uploadProblem ? html`<p class="hint" data-upload-problem>${this._t("background_failed")}</p>` : nothing}
          ${current
            ? html`<button class="row off" data-background-clear @click=${() => this._pickBackground(null)}>
                <span class="row-icon"><ha-icon icon="mdi:close"></ha-icon></span>
                <span class="row-text"><strong>${this._t("background_clear")}</strong></span>
              </button>`
            : nothing}
          ${Object.keys(this.sheet.own).length
            ? html`<button class="row off" data-background-own-clear @click=${this._clearOwnBackground}>
                <span class="row-icon"><ha-icon icon="mdi:restore"></ha-icon></span>
                <span class="row-text"><strong>${this._t("background_mine_clear")}</strong></span>
              </button>`
            : nothing}
          <button class="block-action on" data-background-save @click=${this._saveBackground}>
            <span>${this._t("save")}</span>
          </button>
        </div>
      `;
    }
  };
