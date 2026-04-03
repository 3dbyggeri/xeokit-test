import { Controller } from "./Controller.js";

/**
 * Conditional Formatting Tool — colors from Glasshouse API, optional app defaults (appColorsSettings.json),
 * and in-session edits when readOnlyRules is false.
 */
export class ConditionalFormattingTool extends Controller {
    constructor(parent, cfg = {}) {
        super(parent, cfg);

        if (!cfg.toggleButtonElement) {
            throw "Missing config: toggleButtonElement";
        }
        if (!cfg.settingsButtonElement) {
            throw "Missing config: settingsButtonElement";
        }
        if (!cfg.glasshouseLinkTool) {
            throw "Missing config: glasshouseLinkTool";
        }
        if (!cfg.glasshouseImportTool) {
            throw "Missing config: glasshouseImportTool";
        }

        this._toggleButtonElement = cfg.toggleButtonElement;
        this._settingsButtonElement = cfg.settingsButtonElement;
        this._glasshouseLinkTool = cfg.glasshouseLinkTool;
        this._glasshouseImportTool = cfg.glasshouseImportTool;

        this._active = false;
        this._selectedProperty = null;
        this._rulesMap = new Map();
        this._scopedModelId = null;
        this._scopedObjectIds = [];
        this._appliedObjectIds = [];
        this._objectColorSnapshots = new Map();
        this._propertyOptions = [];

        this._appColorsConfig = {};
        this._defaultPropertyOptions = [];
        this._workingPropertyOptions = [];
        this._apiSnapshotPropertyOptions = null;
        this._apiSnapshotLoaded = false;
        this._snapshotProjectId = undefined;

        this._appColorsSettingsPromise = this._loadAppColorsSettings();

        this._initEvents();
        this._updateButtonState();
    }

    async _loadAppColorsSettings() {
        try {
            const res = await fetch("/api/app-colors-settings");
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            this._appColorsConfig = data.configuration || {};
            this._defaultPropertyOptions = this._propertyOptionsFromMinimalMap(
                data.defaultConditionalFormattingRules || {}
            );
        } catch (err) {
            console.error("ConditionalFormattingTool: failed to load app colors settings", err);
            this._appColorsConfig = {
                alwaysFetchOnEnable: false,
                readOnlyRules: true,
                rulesApiRelativePath: "/api/glasshouse/projects/:projectId/property-sets",
                rulesApiQuery: "include_conditional_formatting=true"
            };
            this._defaultPropertyOptions = [];
        }
        this._rebuildWorkingOptionsFromSnapshots();
        this._updateButtonState();
    }

    _isReadOnlyRules() {
        return this._appColorsConfig.readOnlyRules !== false;
    }

    _canFetchFromApi() {
        return !!(this._glasshouseLinkTool?._connected && this._glasshouseLinkTool?._apiKey);
    }

    _hasStandaloneDefaultRules() {
        return Array.isArray(this._defaultPropertyOptions) && this._defaultPropertyOptions.length > 0;
    }

    _buildRulesApiUrl(projectId) {
        const rel =
            this._appColorsConfig.rulesApiRelativePath ||
            "/api/glasshouse/projects/:projectId/property-sets";
        const q =
            this._appColorsConfig.rulesApiQuery || "include_conditional_formatting=true";
        let u = rel.replace(":projectId", encodeURIComponent(projectId));
        const qStr = q.startsWith("?") ? q.slice(1) : q;
        u += u.includes("?") ? `&${qStr}` : `?${qStr}`;
        return u;
    }

    _propertyOptionsFromMinimalMap(minimalMap) {
        const options = [];
        Object.entries(minimalMap || {}).forEach(([propName, valueRules]) => {
            if (!valueRules || typeof valueRules !== "object") {
                return;
            }
            const rules = [];
            Object.entries(valueRules).forEach(([val, def]) => {
                const hex = this._normalizeHexColor(def?.background_color);
                const normalizedValue = this._normalizeValue(val);
                if (!normalizedValue || !hex) {
                    return;
                }
                const displayLabel = String(val).trim() || normalizedValue;
                rules.push({ normalizedValue, hex, displayLabel });
            });
            if (!rules.length) {
                return;
            }
            options.push({
                key: propName,
                name: propName,
                rules
            });
        });

        const deduped = new Map();
        options.forEach((opt) => {
            const identity = `${opt.key || ""}::${this._normalizeValue(opt.name)}`;
            if (!deduped.has(identity)) {
                deduped.set(identity, opt);
            }
        });

        return Array.from(deduped.values());
    }

    _cloneOption(opt) {
        return {
            key: opt.key,
            name: opt.name,
            rules: (opt.rules || []).map((r) => ({ ...r }))
        };
    }

    _clonePropertyOptions(opts) {
        return (opts || []).map((o) => this._cloneOption(o));
    }

    _mergeRuleLists(baseRules, overlayRules) {
        const rmap = new Map();
        (baseRules || []).forEach((r) => rmap.set(r.normalizedValue, { ...r }));
        (overlayRules || []).forEach((r) => rmap.set(r.normalizedValue, { ...r }));
        return Array.from(rmap.values());
    }

    _mergeApiAndDefaultOptions(apiOpts, defaultOpts) {
        const m = new Map();
        const keyFor = (o) => this._normalizeValue(o.name);
        for (const d of defaultOpts) {
            m.set(keyFor(d), this._cloneOption(d));
        }
        for (const a of apiOpts) {
            const k = keyFor(a);
            const existing = m.get(k);
            if (!existing) {
                m.set(k, this._cloneOption(a));
            } else {
                existing.key = a.key || existing.key;
                existing.rules = this._mergeRuleLists(existing.rules, a.rules);
            }
        }
        return Array.from(m.values());
    }

    _rebuildWorkingOptionsFromSnapshots() {
        const def = this._clonePropertyOptions(this._defaultPropertyOptions || []);
        const api = this._apiSnapshotPropertyOptions;

        if (api != null && api.length > 0) {
            this._workingPropertyOptions = this._mergeApiAndDefaultOptions(api, def);
        } else {
            this._workingPropertyOptions = def;
        }
    }

    _invalidateSnapshotIfProjectChanged(projectId) {
        const pid = projectId == null ? null : projectId;
        if (pid !== this._snapshotProjectId) {
            this._snapshotProjectId = pid;
            this._apiSnapshotLoaded = false;
            this._apiSnapshotPropertyOptions = null;
        }
    }

    async _loadApiSnapshotOnce(projectId) {
        if (!projectId || !this._canFetchFromApi()) {
            this._apiSnapshotLoaded = true;
            this._rebuildWorkingOptionsFromSnapshots();
            return;
        }
        try {
            const opts = await this._fetchApiPropertyOptions(projectId);
            this._apiSnapshotPropertyOptions = opts;
        } catch (err) {
            console.warn("ConditionalFormattingTool: API snapshot failed", err);
            if (this._apiSnapshotPropertyOptions == null) {
                this._apiSnapshotPropertyOptions = [];
            }
        }
        this._apiSnapshotLoaded = true;
        this._rebuildWorkingOptionsFromSnapshots();
    }

    async _refreshPropertyOptionsFromApiForEnable(projectId) {
        if (!this._canFetchFromApi() || !projectId) {
            this._apiSnapshotPropertyOptions = [];
            this._rebuildWorkingOptionsFromSnapshots();
            this._syncRulesMapFromWorkingOptions();
            return;
        }
        try {
            const opts = await this._fetchApiPropertyOptions(projectId);
            this._apiSnapshotPropertyOptions = opts;
        } catch (err) {
            console.warn("ConditionalFormattingTool: enable fetch failed, using app defaults", err);
            this._apiSnapshotPropertyOptions = [];
        }
        this._rebuildWorkingOptionsFromSnapshots();
        this._syncRulesMapFromWorkingOptions();
    }

    _syncRulesMapFromWorkingOptions() {
        if (!this._selectedProperty || !this._workingPropertyOptions?.length) {
            return;
        }
        const wantKey = this._selectedProperty.key;
        const wantName = this._normalizeValue(this._selectedProperty.name || "");
        let opt = this._workingPropertyOptions.find((o) => o.key === wantKey);
        if (!opt) {
            opt = this._workingPropertyOptions.find((o) => this._normalizeValue(o.name) === wantName);
        }
        if (!opt) {
            return;
        }
        this._rulesMap = new Map();
        opt.rules.forEach((r) => this._rulesMap.set(r.normalizedValue, r.hex));
    }

    async _ensureBaselineOptions(projectId) {
        await this._appColorsSettingsPromise;
        this._invalidateSnapshotIfProjectChanged(projectId);

        const alwaysOnEnable = !!this._appColorsConfig.alwaysFetchOnEnable;
        if (!alwaysOnEnable && projectId && this._canFetchFromApi() && !this._apiSnapshotLoaded) {
            await this._loadApiSnapshotOnce(projectId);
        } else if (!projectId) {
            this._rebuildWorkingOptionsFromSnapshots();
        }

        return this._workingPropertyOptions || [];
    }

    async _fetchApiPropertyOptions(projectId) {
        const url = this._buildRulesApiUrl(projectId);
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "access-token": this._glasshouseLinkTool._apiKey,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload?.details?.message || errorPayload?.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const propertySets = Array.isArray(data.property_sets) ? data.property_sets : [];
        const options = this._extractPropertyOptions(propertySets);
        console.log("ConditionalFormattingTool: API property options", {
            propertySetCount: propertySets.length,
            optionCount: options.length
        });
        return options;
    }

    _initEvents() {
        this._toggleButtonElement.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (!this.getEnabled()) {
                return;
            }
            this.toggle();
        });

        this._settingsButtonElement.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!this.getEnabled()) {
                return;
            }
            this.openSettings();
        });

        this.on("enabled", () => this._updateButtonState());

        this._glasshouseLinkTool.on("connected", () => {
            this._updateButtonState();
            if (!this._glasshouseLinkTool._connected) {
                this.clearFormatting();
            }
        });
    }

    _updateButtonState() {
        const isConnected = !!this._glasshouseLinkTool?._connected;
        const hasDefaults = this._hasStandaloneDefaultRules();
        const baseEnabled = this.getEnabled() && (isConnected || hasDefaults);

        this._toggleButtonElement.classList.toggle("disabled", !baseEnabled);
        this._settingsButtonElement.classList.toggle("disabled", !baseEnabled || !this._active);
        this._toggleButtonElement.classList.toggle("active", this._active);

        const toggleTitle = this._active ? "Disable Conditional Formatting" : "Enable Conditional Formatting";
        const propName = this._selectedProperty?.name;
        const propSuffix = propName ? ` — ${propName}` : "";
        const settingsTitle = this._active
            ? `Conditional Formatting Settings${propSuffix}`
            : `Conditional Formatting Settings (activate first)${propSuffix}`;

        this._toggleButtonElement.setAttribute("title", toggleTitle);
        this._toggleButtonElement.setAttribute("data-tippy-content", toggleTitle);
        this._settingsButtonElement.setAttribute("title", settingsTitle);
        this._settingsButtonElement.setAttribute("data-tippy-content", settingsTitle);
    }

    async toggle() {
        if (this._active) {
            this.clearFormatting();
            return;
        }

        await this._appColorsSettingsPromise;

        if (this._appColorsConfig.alwaysFetchOnEnable) {
            const projectId = this._glasshouseImportTool?._selectedProject?.id;
            await this._refreshPropertyOptionsFromApiForEnable(projectId || null);
        } else {
            const projectId = this._glasshouseImportTool?._selectedProject?.id;
            if (projectId && this._canFetchFromApi() && !this._apiSnapshotLoaded) {
                this._invalidateSnapshotIfProjectChanged(projectId);
                await this._loadApiSnapshotOnce(projectId);
            }
        }

        if (!this._selectedProperty || this._rulesMap.size === 0) {
            await this.openSettings();
            return;
        }

        this._syncRulesMapFromWorkingOptions();

        const applied = this._applyFormatting();
        if (applied) {
            this._active = true;
            this.fire("active", true);
        }
        this._updateButtonState();
    }

    async openSettings() {
        await this._appColorsSettingsPromise;

        const hasDefaults = this._hasStandaloneDefaultRules();
        const isConnected = !!this._glasshouseLinkTool?._connected;
        const projectId = this._glasshouseImportTool?._selectedProject?.id || null;

        if (!isConnected && !hasDefaults) {
            alert("Connect to Glasshouse Link or add default rules in appColorsSettings.json.");
            return;
        }
        if (isConnected && !projectId) {
            alert("Please select a Glasshouse project first (cloud button in the toolbar).");
            return;
        }

        try {
            const propertyOptions = await this._ensureBaselineOptions(isConnected ? projectId : null);
            if (!propertyOptions.length) {
                alert("No conditional-formatting properties found. Check the API or appColorsSettings.json defaults.");
                return;
            }
            this._propertyOptions = propertyOptions;
            this._showSettingsDialog(propertyOptions);
        } catch (error) {
            console.error("ConditionalFormattingTool: Failed to load settings", error);
            alert(`Failed to load conditional formatting settings: ${error.message}`);
        }
    }

    _extractPropertyOptions(propertySets) {
        const options = [];

        propertySets.forEach((setItem) => {
            const properties = Array.isArray(setItem?.properties) ? setItem.properties : [];
            properties.forEach((property) => {
                const rules = this._extractRulesFromProperty(property);
                if (!rules.length) {
                    return;
                }

                const propertyName = this._resolvePropertyName(property);
                if (!propertyName) {
                    return;
                }

                options.push({
                    key: this._resolvePropertyKey(property),
                    name: propertyName,
                    rules
                });
            });
        });

        const deduped = new Map();
        options.forEach((opt) => {
            const identity = `${opt.key || ""}::${this._normalizeValue(opt.name)}`;
            if (!deduped.has(identity)) {
                deduped.set(identity, opt);
            }
        });

        return Array.from(deduped.values());
    }

    _resolvePropertyName(property) {
        return property?.original_name || property?.human_name || property?.name || null;
    }

    _resolvePropertyKey(property) {
        return property?.name || property?.original_name || property?.id || null;
    }

    _extractRulesFromProperty(property) {
        const rulesContainer = property?.conditional_formatting_rules;
        if (!rulesContainer || typeof rulesContainer !== "object") {
            return [];
        }

        const parsedRules = [];
        Object.entries(rulesContainer).forEach(([ruleValue, ruleDef]) => {
            if (ruleDef === null || ruleDef === undefined || typeof ruleDef !== "object") {
                return;
            }

            const valueCandidate = ruleValue;
            const colorCandidate = ruleDef.background_color;

            const normalizedValue = this._normalizeValue(valueCandidate);
            const hex = this._normalizeHexColor(colorCandidate);

            if (!normalizedValue || !hex) {
                return;
            }

            const displayLabel = String(valueCandidate).trim() || normalizedValue;
            parsedRules.push({ normalizedValue, hex, displayLabel });
        });

        return parsedRules;
    }

    _escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text == null ? "" : String(text);
        return div.innerHTML;
    }

    _hexForColorInput(hex) {
        if (!hex) return "#000000";
        const h = hex.startsWith("#") ? hex : `#${hex}`;
        return /^#[0-9a-fA-F]{6}$/.test(h) ? h : "#000000";
    }

    _renderRulesListMarkup(rules, readOnly) {
        if (!rules || !rules.length) {
            return `<div class="xeokit-cf-rules-empty">No color rules for this property.</div>`;
        }
        const sorted = [...rules].sort((a, b) =>
            (a.displayLabel || "").localeCompare(b.displayLabel || "", undefined, { sensitivity: "base" })
        );
        return `
            <div class="xeokit-cf-rules-list" role="listbox" aria-label="Conditional formatting rules">
                ${sorted
                    .map((rule) => {
                        const colorInput = readOnly
                            ? ""
                            : `<input type="color" class="xeokit-cf-rule-color" data-nv="${encodeURIComponent(rule.normalizedValue)}" value="${this._escapeHtml(this._hexForColorInput(rule.hex))}" title="Change color" />`;
                        return `
                    <div class="xeokit-cf-rule-row" role="option" aria-selected="false">
                        <span class="xeokit-cf-rule-swatch" style="background-color:${rule.hex}" title="${this._escapeHtml(rule.hex)}"></span>
                        <span class="xeokit-cf-rule-label">${this._escapeHtml(rule.displayLabel)}</span>
                        ${colorInput}
                        <code class="xeokit-cf-rule-hex">${this._escapeHtml(rule.hex)}</code>
                    </div>`;
                    })
                    .join("")}
            </div>
        `;
    }

    _getSelectedPropertyOptionFromSelect(propertySelect, propertyOptions) {
        const raw = propertySelect.value;
        if (raw === "" || raw == null) {
            return null;
        }
        const idx = Number(raw);
        if (!Number.isFinite(idx) || idx < 0 || idx >= propertyOptions.length) {
            return null;
        }
        return propertyOptions[idx];
    }

    _resolveDefaultPropertyIndex(propertyOptions) {
        if (this._selectedProperty) {
            const wantKey = this._selectedProperty.key;
            if (wantKey != null && wantKey !== "") {
                for (let i = 0; i < propertyOptions.length; i++) {
                    if (propertyOptions[i].key === wantKey) {
                        return i;
                    }
                }
            }
            const wantName = this._normalizeValue(this._selectedProperty.name || "");
            if (wantName) {
                for (let i = 0; i < propertyOptions.length; i++) {
                    if (this._normalizeValue(propertyOptions[i].name) === wantName) {
                        return i;
                    }
                }
            }
        }
        for (let i = 0; i < propertyOptions.length; i++) {
            if (this._normalizeValue(propertyOptions[i].name) === "category") {
                return i;
            }
        }
        return -1;
    }

    _showSettingsDialog(propertyOptions) {
        const readOnly = this._isReadOnlyRules();
        const rulesLabel = readOnly ? "Rules (read-only):" : "Rules:";

        const modal = document.createElement("div");
        modal.className = "xeokit-modal-backdrop";
        modal.innerHTML = `
            <div class="xeokit-modal xeokit-cf-settings-dialog">
                <div class="xeokit-modal-header">
                    <h3>Conditional Formatting</h3>
                    <button class="xeokit-modal-close">&times;</button>
                </div>
                <div class="xeokit-modal-body">
                    <div class="form-group">
                        <label>Property:</label>
                        <select id="xeokit-cf-property-select" class="form-control">
                            <option value="">Select property...</option>
                            ${propertyOptions.map((option, idx) => `<option value="${idx}">${this._escapeHtml(option.name)}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group xeokit-cf-rules-form-group">
                        <label>${this._escapeHtml(rulesLabel)}</label>
                        <div id="xeokit-cf-rule-preview" class="xeokit-cf-rules-panel"></div>
                    </div>
                </div>
                <div class="xeokit-modal-footer">
                    <button class="xeokit-button xeokit-button-cancel">Cancel</button>
                    <button class="xeokit-button xeokit-button-primary" id="xeokit-cf-apply-btn" disabled>Apply</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const close = () => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        };

        const propertySelect = modal.querySelector("#xeokit-cf-property-select");
        const rulePreview = modal.querySelector("#xeokit-cf-rule-preview");
        const applyButton = modal.querySelector("#xeokit-cf-apply-btn");

        const defaultIdx = this._resolveDefaultPropertyIndex(propertyOptions);
        if (defaultIdx >= 0) {
            propertySelect.value = String(defaultIdx);
        }

        const syncRulesPanel = () => {
            const option = this._getSelectedPropertyOptionFromSelect(propertySelect, propertyOptions);
            applyButton.disabled = !option;
            if (!option) {
                rulePreview.innerHTML = `<div class="xeokit-cf-rules-empty">Select a property to list value-to-color rules.</div>`;
                return;
            }
            rulePreview.innerHTML = this._renderRulesListMarkup(option.rules, readOnly);

            if (!readOnly) {
                rulePreview.querySelectorAll(".xeokit-cf-rule-color").forEach((inp) => {
                    const row = inp.closest(".xeokit-cf-rule-row");
                    const swatch = row && row.querySelector(".xeokit-cf-rule-swatch");
                    const hexBadge = row && row.querySelector(".xeokit-cf-rule-hex");
                    inp.addEventListener("input", () => {
                        const hex = this._normalizeHexColor(inp.value);
                        if (hex && swatch) {
                            swatch.style.backgroundColor = hex;
                        }
                        if (hex && hexBadge) {
                            hexBadge.textContent = hex;
                        }
                    });
                });
            }
        };

        propertySelect.addEventListener("change", syncRulesPanel);
        syncRulesPanel();

        applyButton.addEventListener("click", () => {
            const option = this._getSelectedPropertyOptionFromSelect(propertySelect, propertyOptions);
            if (!option) {
                return;
            }

            if (!readOnly) {
                modal.querySelectorAll(".xeokit-cf-rule-color").forEach((inp) => {
                    const nv = decodeURIComponent(inp.getAttribute("data-nv") || "");
                    const hex = this._normalizeHexColor(inp.value);
                    const rule = option.rules.find((r) => r.normalizedValue === nv);
                    if (rule && hex) {
                        rule.hex = hex;
                    }
                });
            }

            this._selectedProperty = {
                key: option.key,
                name: option.name
            };
            this._rulesMap = new Map();
            option.rules.forEach((rule) => {
                this._rulesMap.set(rule.normalizedValue, rule.hex);
            });

            console.log("ConditionalFormattingTool: selected property", {
                property: this._selectedProperty,
                ruleCount: this._rulesMap.size
            });

            const applied = this._applyFormatting();
            if (applied) {
                this._active = true;
                this.fire("active", true);
            }
            this._updateButtonState();
            close();
        });

        modal.querySelector(".xeokit-modal-close").addEventListener("click", close);
        modal.querySelector(".xeokit-button-cancel").addEventListener("click", close);
        modal.addEventListener("click", (event) => {
            if (event.target === modal) {
                close();
            }
        });
    }

    _applyFormatting() {
        try {
            if (!this._selectedProperty || this._rulesMap.size === 0) {
                alert("Select a conditional formatting property first.");
                return false;
            }

            const objectIds = this._getAllObjectIdsForFormatting();
            this._scopedModelId = null;
            this._scopedObjectIds = objectIds;

            const selectedIds = new Set(this.viewer.scene.selectedObjectIds || []);
            const highlightedIds = new Set(this.viewer.scene.highlightedObjectIds || []);

            this.clearFormatting(false);

            const matched = [];
            let unmatchedCount = 0;
            let skippedInteractiveCount = 0;

            objectIds.forEach((objectId) => {
                if (selectedIds.has(objectId) || highlightedIds.has(objectId)) {
                    skippedInteractiveCount++;
                    return;
                }

                const entity = this.viewer.scene.objects[objectId];
                if (!entity) return;

                const propertyValue = this._readEntityPropertyValue(entity);
                const normalizedValue = this._normalizeValue(propertyValue);
                if (!normalizedValue) {
                    unmatchedCount++;
                    return;
                }

                const hex = this._rulesMap.get(normalizedValue);
                if (!hex) {
                    unmatchedCount++;
                    return;
                }

                this._objectColorSnapshots.set(objectId, Array.isArray(entity.colorize) ? [...entity.colorize] : null);
                entity.colorize = this._hexToColorize(hex);
                matched.push(objectId);
            });

            this._appliedObjectIds = matched;

            console.log("ConditionalFormattingTool: apply summary", {
                property: this._selectedProperty,
                objectCount: objectIds.length,
                matchedCount: matched.length,
                unmatchedCount,
                skippedInteractiveCount
            });

            if (!matched.length) {
                alert("No matching objects found for the selected property rules.");
            }

            return true;
        } catch (error) {
            console.error("ConditionalFormattingTool: failed to apply formatting", error);
            alert(`Failed to apply conditional formatting: ${error.message}`);
            return false;
        }
    }

    _getAllObjectIdsForFormatting() {
        const scene = this.viewer.scene;
        if (!Object.keys(scene.models || {}).length) {
            throw new Error("No loaded xeokit models.");
        }

        const objectIds = [];
        Object.entries(scene.objects || {}).forEach(([objectId, entity]) => {
            if (!entity || entity.visible === false) {
                return;
            }
            if (entity.isModel === true) {
                return;
            }
            objectIds.push(objectId);
        });

        if (!objectIds.length) {
            throw new Error("No objects found in the scene. Load a model first.");
        }

        console.log("ConditionalFormattingTool: formatting scope", { objectCount: objectIds.length });
        return objectIds;
    }

    _readEntityPropertyValue(entity) {
        const selected = this._selectedProperty;
        if (!selected) return null;

        const result = window.getPropertiesForEntity ? window.getPropertiesForEntity(entity) : null;
        if (!result?.props) return null;

        const props = result.props;
        const legend = result.legend;
        const want = this._normalizeValue(selected.name);

        if (selected.key !== undefined && selected.key !== null && props[selected.key] !== undefined) {
            return props[selected.key];
        }
        if (selected.name && props[selected.name] !== undefined) {
            return props[selected.name];
        }

        if (legend) {
            for (const [key, legendInfo] of Object.entries(legend)) {
                const displayName = legendInfo?.Name ?? legendInfo?.name;
                if (!displayName) continue;
                const n = this._normalizeValue(displayName);
                if (n === want || (want === "category" && n.includes("category"))) {
                    if (props[key] !== undefined) {
                        return props[key];
                    }
                }
            }
        }

        for (const [k, v] of Object.entries(props)) {
            if (this._normalizeValue(k) === want) {
                return v;
            }
        }

        return null;
    }

    clearFormatting(updateButtons = true) {
        this._appliedObjectIds.forEach((objectId) => {
            const entity = this.viewer.scene.objects[objectId];
            if (!entity) return;

            const snapshot = this._objectColorSnapshots.get(objectId);
            if (Array.isArray(snapshot)) {
                entity.colorize = [...snapshot];
            } else {
                entity.colorize = null;
            }
        });

        this._appliedObjectIds = [];
        this._objectColorSnapshots.clear();
        this._active = false;
        this.fire("active", false);

        if (updateButtons) {
            this._updateButtonState();
        }
    }

    _normalizeValue(value) {
        if (value === null || value === undefined) {
            return "";
        }
        return String(value).trim().toLowerCase();
    }

    _normalizeHexColor(value) {
        if (!value) return null;
        const text = String(value).trim();
        const withHash = text.startsWith("#") ? text : `#${text}`;
        if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
            return withHash.toUpperCase();
        }
        return null;
    }

    _hexToColorize(hex) {
        const cleaned = hex.replace("#", "");
        const r = parseInt(cleaned.slice(0, 2), 16) / 255;
        const g = parseInt(cleaned.slice(2, 4), 16) / 255;
        const b = parseInt(cleaned.slice(4, 6), 16) / 255;
        return [r, g, b];
    }

    destroy() {
        this.clearFormatting(false);
        super.destroy();
    }
}
