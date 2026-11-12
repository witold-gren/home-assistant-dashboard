// The layout editor, blocks of several entities and simple changes to a device. A part of the sheet (sheet.js), as a mixin of its methods.

import { html, nothing } from "../vendor/lit-all.min.js";
import { entityIcon } from "./model.js";
import { blockRowName, panelStats, panelValue, pressCall, rowControl, runAction, shownOptions } from "./panel.js";
import { tileCandidates } from "./room-editor.js";
import { SPLIT_PANEL, TV_ALERT_CLASSES } from "./sheet-shared.js";

export const BlockSheets = (Base) =>
  class extends Base {
    // Layout editor ---------------------------------------------------------------------------

    _pickTile(entityId) {
      this.sheet.onPick(entityId);
      this._close();
    }

    _renderTilePicker() {
      const { room, tab, domains } = this.sheet;
      const tiles = tileCandidates(this.hass, this.sheet.config ?? this.config, room, tab, this._query ?? "", domains);
      return html`
        ${this._renderHeader(this._t("edit_add_tile"), false, false)}
        <div class="rows">
          <input
            class="search"
            type="search"
            data-pick-search
            placeholder=${this._t("search")}
            @input=${(event) => {
              this._query = event.target.value;
            }}
          />
          ${tiles.map(
            (tile) => html`
              <button class="row off" data-pick=${tile.entityId} @click=${() => this._pickTile(tile.entityId)}>
                <span class="row-icon"><ha-icon .icon=${tile.icon}></ha-icon></span>
                <span class="row-text"><strong>${tile.name}</strong><small>${tile.entityId}</small></span>
              </button>
            `,
          )}
          ${tiles.length ? nothing : html`<p class="hint">${this._t("edit_no_tiles")}</p>`}
        </div>
      `;
    }

    _startRule() {
      const { only = [], except = [] } = this.sheet.rule ?? {};
      const mode = only.length ? "only" : except.length ? "except" : "everyone";
      this._rule = { mode, users: only.length ? only : except };
    }

    get _ruleResult() {
      const { mode, users } = this._rule;
      return { only: mode === "only" ? users : [], except: mode === "except" ? users : [] };
    }

    _toggleRuleUser(id) {
      const { users } = this._rule;
      this._rule = { ...this._rule, users: users.includes(id) ? users.filter((user) => user !== id) : [...users, id] };
    }

    _renderRule() {
      const { mode, users } = this._rule;
      const modes = [
        ["everyone", "who_everyone"],
        ["only", "who_only"],
        ["except", "who_except"],
      ];
      return html`
        <div class="choice-field" data-rule>
          <h3>${this._t("who_sees")}</h3>
          <div class="choices sheet-tabs">
            ${modes.map(
              ([key, label]) => html`
                <button
                  class="choice ${mode === key ? `on ${key}` : ""}"
                  data-rule-mode=${key}
                  @click=${() => (this._rule = { ...this._rule, mode: key })}
                >
                  <span>${this._t(label)}</span>
                </button>
              `,
            )}
          </div>
          ${mode === "everyone"
            ? nothing
            : html`<div class="choices rule-users">
                ${(this._users ?? []).map(
                  (user) => html`
                    <button
                      class="choice ${users.includes(user.id) ? `on ${mode}` : ""}"
                      data-rule-user=${user.id}
                      @click=${() => this._toggleRuleUser(user.id)}
                    >
                      <span>${user.name}</span>
                    </button>
                  `,
                )}
              </div>`}
        </div>
      `;
    }

    _renderTileEdit() {
      const { item, onRename, onRemove, onRule, onResize } = this.sheet;
      const size = this._tileSize ?? item.size ?? "flat";
      const save = () => {
        onRename(this.renderRoot.querySelector("[data-tile-name]").value);
        if (onResize && size !== (item.size ?? "flat")) onResize(size);
        this._tileSize = undefined;
        onRule?.(this._ruleResult);
        this._close();
      };
      const remove = () => {
        onRemove();
        this._close();
      };
      return html`
        ${this._renderHeader(item.name ?? item.entity ?? "", false, false)}
        <div class="rows">
          <input class="search" data-tile-name placeholder=${this._t("edit_tile_name")} .value=${item.name ?? ""} />
          <p class="hint">${item.entity ?? ""}</p>
          ${onResize && item.kind !== "panel"
            ? html`<h3 class="look-group">${this._t("tile_size")}</h3>
                <div class="choices" data-tile-size>
                  ${["flat", "tall"].map(
                    (key) => html`<button
                      class="choice ${size === key ? "on" : ""}"
                      data-choice=${key}
                      @click=${() => (this._tileSize = key)}
                    >
                      <ha-icon icon=${key === "tall" ? "mdi:rectangle-outline" : "mdi:minus-box-outline"}></ha-icon>
                      <span>${this._t(`tile_size_${key}`)}</span>
                    </button>`,
                  )}
                </div>`
            : nothing}
          ${onRule ? this._renderRule() : nothing}
          <button class="row off" data-tile-save @click=${save}>
            <span class="row-icon"><ha-icon icon="mdi:check"></ha-icon></span>
            <span class="row-text"><strong>${this._t("save")}</strong></span>
          </button>
          ${this.sheet.onBlock && item.kind === "panel"
            ? html`
                <button
                  class="row off"
                  data-tile-block
                  @click=${() => this._change({ kind: "block-edit", item, onSave: this.sheet.onBlock })}
                >
                  <span class="row-icon"><ha-icon icon="mdi:pencil-outline"></ha-icon></span>
                  <span class="row-text"><strong>${this._t("block_edit")}</strong></span>
                </button>
              `
            : nothing}
          <button class="row off" data-tile-remove @click=${remove}>
            <span class="row-icon"><ha-icon icon="mdi:delete-outline"></ha-icon></span>
            <span class="row-text"><strong>${this._t("edit_remove_tile")}</strong></span>
          </button>
        </div>
      `;
    }

    // Block of several entities ---------------------------------------------------------------

    _press(entityId) {
      const { domain, service, data } = pressCall(entityId);
      this.hass.callService(domain, service, data);
    }

    _runBlockAction(action) {
      if (action.service) runAction(this.hass, { service: action.service, target: action.entity });
      else this._press(action.entity);
    }

    _tapAction(action) {
      if (action.confirm) this._pending = action;
      else this._runBlockAction(action);
    }

    _confirmAction() {
      this._runBlockAction(this._pending);
      this._pending = null;
    }

    _renderFrame(item) {
      const blocked = window.location.protocol === "https:" && item.frame.startsWith("http:");
      if (blocked) return html`<p class="hint" data-frame-blocked>${this._t("panel_frame_blocked")}</p>`;
      return html`<iframe class="frame" src=${item.frame} title=${item.name}></iframe>`;
    }

    _renderActions(actions = []) {
      const shown = actions.filter((action) => this.hass.states[action.entity]);
      if (!shown.length) return nothing;
      return html`
        <div class="block-actions">
          ${shown.map(
            (action) => html`
              <button
                class="block-action"
                data-action=${action.entity}
                ?disabled=${this.hass.states[action.entity].state === "unavailable"}
                @click=${() => this._tapAction(action)}
              >
                <ha-icon .icon=${action.icon ?? "mdi:gesture-tap-button"}></ha-icon>
                <span>${action.name}</span>
              </button>
            `,
          )}
        </div>
        ${this._pending
          ? html`
              <div class="confirm" data-confirm>
                <span>${this._pending.confirm}</span>
                <button data-confirm-no @click=${() => (this._pending = null)}>${this._t("confirm_no")}</button>
                <button class="yes" data-confirm-yes @click=${this._confirmAction}>${this._t("confirm_yes")}</button>
              </div>
            `
          : nothing}
      `;
    }

    _renderRowControl(row, stateObj) {
      const { entity } = row;
      const control = rowControl(entity);
      const unavailable = stateObj.state === "unavailable";
      if (control === "select") {
        return html`
          <select
            data-select=${entity}
            ?disabled=${unavailable}
            @change=${(event) => this._selectOption(entity, event.target.value)}
          >
            ${shownOptions(stateObj, row).map(
              (option) => html`
                <option value=${option} ?selected=${option === stateObj.state}>${row.labels?.[option] ?? option}</option>
              `,
            )}
          </select>
        `;
      }
      if (control === "range") {
        const { min = 0, max = 100, step = 1 } = stateObj.attributes;
        return html`
          <input
            type="range"
            data-range=${entity}
            min=${min}
            max=${max}
            step=${step}
            .value=${stateObj.state}
            ?disabled=${unavailable || !Number.isFinite(Number.parseFloat(stateObj.state))}
            @change=${(event) => this._setNumber(entity, Number(event.target.value))}
          />
        `;
      }
      if (control === "toggle") {
        return html`
          <button
            class="switch ${stateObj.state === "on" ? "on" : ""}"
            role="switch"
            aria-checked=${stateObj.state === "on"}
            aria-label=${row.name ?? stateObj.attributes.friendly_name}
            data-toggle=${entity}
            ?disabled=${unavailable}
            @click=${() => this.hass.callService("homeassistant", "toggle", { entity_id: entity })}
          ></button>
        `;
      }
      if (control === "press") {
        return html`
          <button class="press" data-press=${entity} ?disabled=${unavailable} @click=${() => this._press(entity)}>
            <ha-icon icon="mdi:play"></ha-icon>
          </button>
        `;
      }
      return html`<small data-value=${entity}>${panelValue(this.hass, row)}</small>`;
    }

    _selectOption(entityId, option) {
      const domain = entityId.split(".")[0];
      this.hass.callService(domain, "select_option", { entity_id: entityId, option });
    }

    _setNumber(entityId, value) {
      const domain = entityId.split(".")[0];
      this.hass.callService(domain, "set_value", { entity_id: entityId, value });
    }

    // A group of controls shows what each one does instead of a list of equal rows.
    _renderControls(rows) {
      const shown = rows
        .map((row) => ({ row, stateObj: this.hass.states[row.entity], control: rowControl(row.entity) }))
        .filter(({ stateObj }) => stateObj);
      const of = (kind) => shown.filter(({ control }) => control === kind);
      return html`
        <div class="big-toggles">${of("toggle").map(({ row, stateObj }) => this._renderBigToggle(row, stateObj))}</div>
        ${of("select").map(({ row, stateObj }) => this._renderChoices(row, stateObj))}
        ${of("range").map(({ row, stateObj }) => this._renderRange(row, stateObj))}
        ${this._renderFacts(of("read").map(({ row }) => row))}
      `;
    }

    _isAlert(row) {
      const stateObj = this.hass.states[row.entity];
      return stateObj?.state === "on" && TV_ALERT_CLASSES.has(stateObj.attributes.device_class);
    }

    _renderFacts(rows) {
      const shown = rows.filter((row) => this.hass.states[row.entity]);
      if (!shown.length) return nothing;
      const name = (row) =>
        row.name ??
        blockRowName(this.hass.states[row.entity].attributes.friendly_name ?? row.entity, this.sheet.item.name);
      return html`
        <div class="facts">
          ${shown.map(
            (row) => html`
              <button
                class="fact ${this._isAlert(row) ? "alert" : ""}"
                data-value=${row.entity}
                @click=${() => this.dispatchEvent(new CustomEvent("sheet-details", { detail: { entityId: row.entity } }))}
              >
                <ha-icon .icon=${row.icon ?? entityIcon(this.hass, row.entity, this.config)}></ha-icon>
                <span><small>${name(row)}</small><b>${panelValue(this.hass, row)}</b></span>
              </button>
            `,
          )}
        </div>
      `;
    }

    // Many things that are normally fine read as one line, and open by themselves when one is not.
    _renderSummary(group) {
      const alerts = group.rows.filter((row) => this._isAlert(row)).length;
      return html`
        <details class="summary" ?open=${alerts > 0} data-summary=${group.title}>
          <summary>
            <strong>${group.title}</strong>
            <small class=${alerts ? "alert" : ""}>
              ${alerts ? this._t("group_alert", { count: alerts }) : this._t("group_ok")}
            </small>
            <ha-icon icon="mdi:chevron-down"></ha-icon>
          </summary>
          ${this._renderFacts(group.rows)}
        </details>
      `;
    }

    _renderBigToggle(row, stateObj) {
      const on = stateObj.state === "on";
      return html`
        <button
          class="big-toggle ${on ? "on" : ""}"
          role="switch"
          aria-checked=${on}
          data-toggle=${row.entity}
          ?disabled=${stateObj.state === "unavailable"}
          @click=${() => this.hass.callService("homeassistant", "toggle", { entity_id: row.entity })}
        >
          <ha-icon .icon=${row.icon ?? "mdi:power"}></ha-icon>
          <strong>${row.name}</strong>
          <small>${this.hass.formatEntityState?.(stateObj) ?? stateObj.state}</small>
        </button>
      `;
    }

    _renderChoices(row, stateObj) {
      const options = shownOptions(stateObj, row);
      const current = row.current ?? stateObj.state;
      const pick = row.onPick ?? ((option) => this._selectOption(row.entity, option));
      return html`
        <div class="choice-field" data-field=${row.entity}>
          <h3>${row.name}</h3>
          <div class="choices">
            ${options.map(
              (option) => html`
                <button
                  class="choice ${option === current ? "on" : ""}"
                  data-choice=${option}
                  ?disabled=${stateObj.state === "unavailable"}
                  @click=${() => pick(option)}
                >
                  ${row.icons?.[option] ? html`<ha-icon .icon=${row.icons[option]}></ha-icon>` : nothing}
                  <span>${row.labels?.[option] ?? option}</span>
                </button>
              `,
            )}
          </div>
        </div>
      `;
    }

    _renderRange(row, stateObj) {
      return html`
        <div class="range-field" data-field=${row.entity}>
          <h3>${row.name}<span>${panelValue(this.hass, row)}</span></h3>
          ${this._renderRowControl(row, stateObj)}
        </div>
      `;
    }

    // The window of a device's settings: one tab at a time, so a device with many entities needs no long scroll.
    _renderSettingsTabs(item) {
      const tabs = [...item.groups.map((group) => [group.key, group.title]), ["activity", this._t("settings_activity")]];
      const group = item.groups.find((candidate) => candidate.key === this._tab);
      return html`
        ${this._renderHeader(item.name, false, true, () => this._showDetails(item.details))}
        <div class="rows" data-settings-tabs>
          ${this._renderTabs(tabs)}
          ${group?.connections
            ? html`<home-dashboard-connections .hass=${this.hass} .sensors=${group.connections}></home-dashboard-connections>`
            : group
            ? group.rows.map((row) => this._renderPanelRow(row))
            : html`<home-dashboard-logbook
                class="settings-activity"
                .hass=${this.hass}
                .config=${this.config}
                .entityIds=${item.activity}
              ></home-dashboard-logbook>`}
        </div>
      `;
    }

    _renderPanelRow(row) {
      const stateObj = this.hass.states[row.entity];
      if (!stateObj) return nothing;
      const name = row.name ?? blockRowName(stateObj.attributes.friendly_name ?? row.entity, this.sheet.item.name);
      const details = rowControl(row.entity) === "read";
      const openDetails = () => {
        this.dispatchEvent(new CustomEvent("sheet-details", { detail: { entityId: row.entity } }));
      };
      return html`
        <div class="field" data-field=${row.entity} @click=${details ? openDetails : nothing}>
          <span>${name}</span>
          ${this._renderRowControl(row, stateObj)}
        </div>
      `;
    }

    // A card that needs an administrator falls back to the plain page for everyone else.
    get _usesCard() {
      const { item } = this.sheet;
      return Boolean(item?.card) && (!item.admin_card || Boolean(this.hass.user?.is_admin));
    }

    // Name, area, labels and whether it is on: simple changes to a device without leaving the app ------------------

    async _loadEdit() {
      const entityId = this.sheet.entityId;
      const deviceId = this.hass.entities[entityId]?.device_id;
      try {
        const [labels, entry] = await Promise.all([
          this.hass.callWS({ type: "config/label_registry/list" }),
          deviceId ? null : this.hass.callWS({ type: "config/entity_registry/get", entity_id: entityId }),
        ]);
        const device = deviceId ? this.hass.devices[deviceId] : null;
        const source = device ?? entry;
        if (this.sheet?.entityId !== entityId) return;
        this._edit = {
          device: Boolean(device),
          id: device ? device.id : entityId,
          name: (device ? device.name_by_user : entry.name) ?? "",
          placeholder: device ? device.name : (entry.original_name ?? this.hass.states[entityId]?.attributes.friendly_name ?? ""),
          area: source.area_id ?? "",
          labels: [...(source.labels ?? [])],
          enabled: !source.disabled_by,
          wasEnabled: !source.disabled_by,
          allLabels: [...(labels ?? [])].sort((a, b) => a.name.localeCompare(b.name, this.hass.language)),
        };
      } catch (error) {
        this._edit = { problem: error?.message ?? String(error) };
      }
    }

    _editChange(changes) {
      this._edit = { ...this._edit, ...changes };
    }

    async _saveEdit() {
      const edit = this._edit;
      const common = { area_id: edit.area || null, labels: edit.labels };
      if (edit.enabled !== edit.wasEnabled) common.disabled_by = edit.enabled ? null : "user";
      const message = edit.device
        ? { type: "config/device_registry/update", device_id: edit.id, name_by_user: edit.name.trim() || null, ...common }
        : { type: "config/entity_registry/update", entity_id: edit.id, name: edit.name.trim() || null, ...common };
      this._editChange({ busy: true, problem: null });
      try {
        await this.hass.callWS(message);
      } catch (error) {
        this._editChange({ busy: false, problem: error?.message ?? String(error) });
        return;
      }
      // A switched off device is gone from Home Assistant, and so is its window.
      if (!edit.enabled) this._close();
      else this._change(this.sheet.back ?? { kind: "panel" });
    }

    _renderDeviceEdit() {
      const edit = this._edit;
      const back = () => (this.sheet.back ? this._change(this.sheet.back) : this._close());
      const header = this._renderHeader(this._t(edit?.device === false ? "entity_edit" : "device_edit"), false, false);
      if (!edit) return html`${header}<p class="hint">${this._t("loading")}</p>`;
      if (!edit.allLabels) return html`${header}<p class="hint" data-edit-problem>${edit.problem}</p>`;
      const areas = Object.values(this.hass.areas ?? {}).sort((a, b) => a.name.localeCompare(b.name, this.hass.language));
      const toggleLabel = (id) =>
        this._editChange({ labels: edit.labels.includes(id) ? edit.labels.filter((label) => label !== id) : [...edit.labels, id] });
      return html`
        ${header}
        <div class="rows" data-device-edit>
          <label class="field">
            <span>${this._t("edit_name")}</span>
            <input
              type="text"
              data-edit-name
              placeholder=${edit.placeholder}
              .value=${edit.name}
              @input=${(event) => this._editChange({ name: event.target.value })}
            />
          </label>
          <label class="field">
            <span>${this._t("edit_area")}</span>
            <select data-edit-area @change=${(event) => this._editChange({ area: event.target.value })}>
              <option value="" ?selected=${!edit.area}>${this._t("edit_no_area")}</option>
              ${areas.map((area) => html`<option value=${area.area_id} ?selected=${area.area_id === edit.area}>${area.name}</option>`)}
            </select>
          </label>
          ${edit.allLabels.length
            ? html`<h3>${this._t("edit_labels")}</h3>
                <div class="choice-chips" data-edit-labels>
                  ${edit.allLabels.map(
                    (label) => html`<button
                      class=${edit.labels.includes(label.label_id) ? "active" : ""}
                      aria-pressed=${edit.labels.includes(label.label_id) ? "true" : "false"}
                      data-edit-label=${label.label_id}
                      @click=${() => toggleLabel(label.label_id)}
                    >
                      ${label.icon ? html`<ha-icon .icon=${label.icon}></ha-icon>` : nothing}${label.name}
                    </button>`,
                  )}
                </div>`
            : nothing}
          <label class="field">
            <span>${this._t(edit.device ? "edit_enabled_device" : "edit_enabled_entity")}</span>
            <input
              type="checkbox"
              data-edit-enabled
              .checked=${edit.enabled}
              @change=${(event) => this._editChange({ enabled: event.target.checked })}
            />
          </label>
          ${edit.enabled ? nothing : html`<p class="hint" data-edit-warning>${this._t("edit_disable_warning")}</p>`}
          ${edit.problem ? html`<p class="hint" data-edit-problem>${edit.problem}</p>` : nothing}
          <button class="row off" data-edit-save ?disabled=${edit.busy} @click=${this._saveEdit}>
            <span class="row-icon"><ha-icon icon="mdi:content-save-outline"></ha-icon></span>
            <span class="row-text"><strong>${this._t("edit_save")}</strong></span>
          </button>
          <button class="row off" data-edit-cancel @click=${back}>
            <span class="row-icon"><ha-icon icon="mdi:arrow-left"></ha-icon></span>
            <span class="row-text"><strong>${this._t("edit_back")}</strong></span>
          </button>
        </div>
      `;
    }

    _renderPanel() {
      const { item } = this.sheet;
      if (item.auto_card && this._usesCard) {
        return html`
          ${this._renderHeader(item.name, false, false)}
          <div class="live panel-card fill" data-live></div>
        `;
      }
      if (item.frame) {
        return html`${this._renderHeader(item.name, false, false)}${this._renderFrame(item)}`;
      }
      if (item.tabs) return this._renderSettingsTabs(item);
      const stats = panelStats(this.hass, item);
      if (item.fullscreen && item.card && item.card_open && !item.card_last) return this._renderSplitPanel(item, stats);
      return html`
        ${this._renderHeader(item.name, false, Boolean(item.details), () => this._showDetails(item.details))}
        <div class="rows">
          ${stats.length
            ? html`<div class="stats">
                ${stats.map((stat) => html`<span><b>${stat.value}</b><small>${stat.name}</small></span>`)}
              </div>`
            : nothing}
          ${item.card_open ? this._renderActions(item.actions) : nothing}
          ${item.card && !item.card_last && (this._live || item.card_open)
            ? html`<div class="live panel-card" data-live></div>`
            : nothing}
          ${item.card && !this._live && !item.card_open
            ? html`<button class="start-live" data-panel-card @click=${() => this._mountLive(item.card)}>
                <ha-icon .icon=${item.card_icon ?? "mdi:gamepad-variant-outline"}></ha-icon>
                ${item.card_label ?? this._t("panel_control")}
              </button>`
            : nothing}
          ${item.card_open ? nothing : this._renderActions(item.actions)}
          <div class="panel-groups" data-panel-groups>
            ${(item.groups ?? []).map(
              (group) => html`<div class="panel-group">
                ${group.title && group.layout !== "summary" ? html`<h3>${group.title}</h3>` : nothing}
                ${group.layout === "summary" ? this._renderSummary(group) : nothing}
                ${group.layout === "controls" ? this._renderControls(group.rows) : nothing}
                ${group.layout ? nothing : group.rows.map((row) => this._renderPanelRow(row))}
              </div>`,
            )}
          </div>
          ${item.card_last && item.card_open ? html`<div class="live panel-card" data-live></div>` : nothing}
        </div>
      `;
    }

    // A panel on the whole screen with its card always open, such as a vacuum's map: on a tablet on its side the
    // panel's own parts (its rows, its numbers as tiles with a bar for a share, its buttons at the bottom) stand in a
    // column beside the card, which keeps the rest of the screen; upright and on a phone they stand above it, as before.
    // The card's box is the same element in both, so turning the tablet does not start the card again.
    _renderSplitPanel(item, stats) {
      const split = window.matchMedia(SPLIT_PANEL).matches;
      const share = (index) => {
        const stat = item.stats[index];
        const value = Number(this.hass.states[stat.entity]?.state);
        return stat.unit === "%" && Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : null;
      };
      return html`
        ${this._renderHeader(item.name, false, Boolean(item.details), () => this._showDetails(item.details))}
        <div class="rows panel-split ${split ? "split" : ""}">
          <div class="side">
            ${stats.length
              ? html`<div class="stats" data-panel-stats>
                  ${stats.map(
                    (stat, index) => html`<span>
                      <b>${stat.value}</b><small>${stat.name}</small>
                      ${split && share(index) !== null ? html`<i class="share"><u style="width: ${share(index)}%"></u></i>` : nothing}
                    </span>`,
                  )}
                </div>`
              : nothing}
            ${split ? this._renderRoomPicker(item) : nothing}
            <div class="side-actions">${this._renderActions(item.actions)}</div>
            ${(item.groups ?? []).map(
              (group) => html`<div class="panel-group">
                ${group.title && group.layout !== "summary" ? html`<h3>${group.title}</h3>` : nothing}
                ${group.layout === "summary" ? this._renderSummary(group) : nothing}
                ${group.layout === "controls" ? this._renderControls(group.rows) : nothing}
                ${group.layout ? nothing : group.rows.map((row) => this._renderPanelRow(row))}
              </div>`,
            )}
          </div>
          <div class="live panel-card" data-live></div>
        </div>
      `;
    }

    // The rooms a vacuum map card offers (its mode that cleans rooms, with the rooms set up in it), as buttons beside
    // the map: the card's own buttons are put away on a tablet on its side, and its map stands alone.
    _roomMode(item) {
      const mode = (item.card?.map_modes ?? []).find(
        (entry) => entry?.template === "vacuum_clean_segment" && entry.predefined_selections?.length && entry.service_call_schema,
      );
      return mode ? { ...mode, entity: item.card.entity } : null;
    }

    _renderRoomPicker(item) {
      const mode = this._roomMode(item);
      if (!mode) return nothing;
      const { selected, repeats } = this._rooms ?? { selected: [], repeats: 1 };
      const most = Number(mode.max_repeats) || 1;
      const toggle = (id) =>
        (this._rooms = {
          repeats,
          selected: selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id],
        });
      return html`
        <div class="room-picker" data-room-picker>
          <h3>${this._t("vacuum_rooms")}</h3>
          <div class="room-chips">
            ${mode.predefined_selections.map(
              (room) => html`<button
                class="room-chip ${selected.includes(room.id) ? "on" : ""}"
                aria-pressed=${selected.includes(room.id) ? "true" : "false"}
                data-room=${room.id}
                @click=${() => toggle(room.id)}
              >
                ${room.label?.text ?? room.id}
              </button>`,
            )}
          </div>
          <div class="room-run">
            <button
              class="room-repeats"
              aria-label=${this._t("vacuum_repeats")}
              data-room-repeats
              ?disabled=${most < 2}
              @click=${() => (this._rooms = { selected, repeats: (repeats % most) + 1 })}
            >
              ×${repeats}
            </button>
            <button class="room-go" data-room-go ?disabled=${!selected.length} @click=${() => this._cleanRooms(mode)}>
              <ha-icon icon="mdi:play"></ha-icon>${this._t("vacuum_clean_rooms", { count: selected.length })}
            </button>
          </div>
        </div>
      `;
    }

    // The card's own call, its placeholders filled: [[entity_id]], [[selection]] (the rooms) and [[repeats]].
    _cleanRooms(mode) {
      const { selected, repeats } = this._rooms;
      const fill = (value) => {
        if (value === "[[selection]]") return selected;
        if (value === "[[repeats]]") return repeats;
        if (value === "[[entity_id]]") return mode.entity;
        if (Array.isArray(value)) return value.map(fill);
        if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)]));
        return value;
      };
      const { service, service_data: data } = mode.service_call_schema;
      const [domain, name] = service.split(".");
      this.hass.callService(domain, name, fill(data ?? {}));
      this._rooms = { selected: [], repeats };
    }
  };
