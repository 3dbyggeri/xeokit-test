import { Controller } from "./Controller.js";

/**
 * Conditional Formatting Tool - Applies value-based colors by GH property rules.
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

        this._initEvents();
        this._updateButtonState();
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
        const baseEnabled = this.getEnabled() && isConnected;

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

        if (!this._selectedProperty || this._rulesMap.size === 0) {
            await this.openSettings();
            return;
        }

        const applied = this._applyFormatting();
        if (applied) {
            this._active = true;
            this.fire("active", true);
        }
        this._updateButtonState();
    }

    async openSettings() {
        if (!this._glasshouseLinkTool?._connected) {
            alert("Please connect to Glasshouse Link first.");
            return;
        }

        const selectedProject = this._glasshouseImportTool?._selectedProject;
        if (!selectedProject?.id) {
            alert("Please select a Glasshouse project first (cloud button in the toolbar).");
            return;
        }

        try {
            const propertyOptions = await this._fetchPropertyOptions(selectedProject.id);
            if (!propertyOptions.length) {
                alert("No conditional-formatting properties found for this project.");
                return;
            }
            this._propertyOptions = propertyOptions;
            this._showSettingsDialog(propertyOptions);
        } catch (error) {
            console.error("ConditionalFormattingTool: Failed to load settings", error);
            alert(`Failed to load conditional formatting settings: ${error.message}`);
        }
    }

    async _fetchPropertyOptions(projectId) {
        const response = await fetch(`/api/glasshouse/projects/${encodeURIComponent(projectId)}/property-sets?include_conditional_formatting=true`, {
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
        console.log("ConditionalFormattingTool: parsed property options", {
            propertySetCount: propertySets.length,
            optionCount: options.length
        });
        return options;
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

    _renderRulesListMarkup(rules) {
        if (!rules || !rules.length) {
            return `<div class="xeokit-cf-rules-empty">No color rules for this property.</div>`;
        }
        const sorted = [...rules].sort((a, b) =>
            (a.displayLabel || "").localeCompare(b.displayLabel || "", undefined, { sensitivity: "base" })
        );
        return `
            <div class="xeokit-cf-rules-list" role="listbox" aria-label="Conditional formatting rules">
                ${sorted
                    .map(
                        (rule) => `
                    <div class="xeokit-cf-rule-row" role="option" aria-selected="false">
                        <span class="xeokit-cf-rule-swatch" style="background-color:${rule.hex}" title="${this._escapeHtml(rule.hex)}"></span>
                        <span class="xeokit-cf-rule-label">${this._escapeHtml(rule.displayLabel)}</span>
                        <code class="xeokit-cf-rule-hex">${this._escapeHtml(rule.hex)}</code>
                    </div>`
                    )
                    .join("")}
            </div>
        `;
    }

    /**
     * Parses the property select value. Empty string must not become index 0 (Number("") === 0 in JS).
     */
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

    /**
     * Prefer the property already used for formatting, else "Category" if present, else none.
     */
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
                        <label>Rules (read-only):</label>
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
                rulePreview.innerHTML = `<div class="xeokit-cf-rules-empty">Select a property to list value-to-color rules from Glasshouse.</div>`;
                return;
            }
            rulePreview.innerHTML = this._renderRulesListMarkup(option.rules);
        };

        propertySelect.addEventListener("change", syncRulesPanel);
        syncRulesPanel();

        applyButton.addEventListener("click", () => {
            const option = this._getSelectedPropertyOptionFromSelect(propertySelect, propertyOptions);
            if (!option) {
                return;
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

    /**
     * All scene objects (no per-model id filter) so rules apply across whatever is loaded.
     * Skips model-root entities and hidden objects.
     */
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
