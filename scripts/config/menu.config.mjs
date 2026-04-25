import { MODULE_ID, SETTING_KEYS } from "./constants.config.mjs";
import { isLibraryMode } from "../services/cover.service.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * A base configuration form used by Simple Cover 5e.
 *
 * @extends {ApplicationV2}
 */
export class SimpleCoverBaseConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static PART_CONFIG = {};
    static SAVE_BUTTON_LABEL = "SETTINGS.Save";
    static FOOTER_PARTS = {
        footer: { template: "templates/generic/form-footer.hbs" }
    };

    /** @inheritdoc */
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS ?? {}, {
        tag: "form",
        classes: ["standard-form"],
        position: { width: 600 },
        window: {
            icon: "fas fa-list-check",
            contentClasses: ["standard-form"]
        },
        form: {
            submitOnChange: false,
            closeOnSubmit: true,
            handler(event, form, formData) {
                return this.constructor._onSubmit(event, form, formData);
            }
        }
    }, { inplace: false });

    /**
     * Get the footer buttons displayed by the form.
     * @returns {object[]} The footer button configuration.
     */
    _getButtons() {
        return [
            {
                type: "submit",
                icon: "fa-solid fa-floppy-disk",
                label: game.i18n.localize(this.constructor.SAVE_BUTTON_LABEL)
            }
        ];
    }

    /**
     * Prepare the render context for a single application part.
     * @param {string} partId The part being prepared.
     * @param {object} context The base context object.
     * @param {ApplicationRenderOptions} options The active render options.
     * @returns {Promise<object>} The prepared part context.
     */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        context.buttons ??= this._getButtons();

        const partConfig = this.constructor.PART_CONFIG?.[partId];
        if (partConfig) {
            if (partConfig.legend) context.legend = game.i18n.localize(partConfig.legend);
            if (partConfig.hint) context.hint = game.i18n.localize(partConfig.hint);
            if (Array.isArray(partConfig.keys)) {
                context.fields = partConfig.keys.map((k) => this._createSettingField(k)).filter(Boolean);
            }
        }

        return context;
    }

    /**
     * Build a field descriptor for a registered setting.
     * @param {string} key The setting key to describe.
     * @returns {object|null} The field descriptor, or null if the setting cannot be rendered.
     */
    _createSettingField(key) {
        const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
        if (!setting) return null;

        const { BooleanField, NumberField, StringField, DataField } = foundry.data.fields;

        const isDataField = setting.type instanceof DataField;
        const FieldClass = { [Boolean]: BooleanField, [Number]: NumberField, [String]: StringField }[setting.type];
        if (!isDataField && !FieldClass) return null;
        const field = isDataField ? setting.type : new FieldClass({ required: true, blank: false });

        const data = {
            name: key,
            field,
            label: game.i18n.localize(setting.name),
            hint: setting.hint ? game.i18n.localize(setting.hint) : "",
            value: game.settings.get(MODULE_ID, key)
        };

        if ((setting.type === Boolean) || (setting.type instanceof BooleanField)) {
            data.input = (_field, config) => foundry.applications.fields.createCheckboxInput(config);
        }

        const choices = setting.choices ?? field.choices ?? field.options?.choices ?? null;

        if (choices) {
            data.options = Object.entries(choices).map(([value, label]) => ({
                value,
                label: game.i18n.localize(label)
            }));
        }

        return data;
    }

    /**
     * Persist submitted form values to the corresponding settings.
     * @param {SubmitEvent} event The triggering submit event.
     * @param {HTMLFormElement} form The submitted form element.
     * @param {FormDataExtended} formData The expanded form data.
     * @returns {Promise<void>} Resolves after settings have been updated.
     */
    static async _onSubmit(event, form, formData) {
        event.preventDefault();

        const values = foundry.utils.expandObject(formData.object ?? {});
        let requiresClientReload = false;
        let requiresWorldReload = false;

        for (const [key, value] of Object.entries(values)) {
            const settingDef = game.settings.settings.get(`${MODULE_ID}.${key}`);
            if (!settingDef) continue;

            const current = game.settings.get(MODULE_ID, key, { document: true });
            const before = current?._source?.value ?? current;
            const updated = await game.settings.set(MODULE_ID, key, value, { document: true });
            if (before === (updated?._source?.value ?? updated)) continue;

            requiresClientReload ||= (settingDef.scope !== "world") && settingDef.requiresReload;
            requiresWorldReload ||= (settingDef.scope === "world") && settingDef.requiresReload;
        }

        if (requiresClientReload || requiresWorldReload) {
            return SettingsConfig.reloadConfirm({ world: requiresWorldReload });
        }
    }
}

/**
 * A configuration form for cover and measurement rule variants.
 *
 * @extends {SimpleCoverBaseConfigApp}
 */
export class SimpleCoverVariantConfig extends SimpleCoverBaseConfigApp {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        classes: ["standard-form", "simplecover5e-variant-config"],
        position: { width: 600 },
        window: {
            title: "SIMPLE_COVER_5E.Settings.VariantMenu.Name",
            icon: "fas fa-list-check",
            contentClasses: ["standard-form"]
        }
    }, { inplace: false });


    static PARTS = {
        general: { template: "modules/simplecover5e/templates/base-config.hbs" },
        measurement: { template: "modules/simplecover5e/templates/base-config.hbs" },
        engine: { template: "modules/simplecover5e/templates/base-config.hbs" },
        ...SimpleCoverBaseConfigApp.FOOTER_PARTS
    };

    static PART_CONFIG = {
        general: {
            legend: "SIMPLE_COVER_5E.Settings.VariantMenu.Groups.General",
            keys: [
                SETTING_KEYS.LOS_CHECK,
                SETTING_KEYS.CREATURES_HALF_ONLY,
                SETTING_KEYS.CREATURES_PRONE,
                SETTING_KEYS.IGNORE_FRIENDLY,
                SETTING_KEYS.IGNORE_DISTANCE_AOE,
                SETTING_KEYS.IGNORE_ALL_AOE,
                SETTING_KEYS.IGNORE_DISTANCE_SPACE
            ]
        },
        measurement: {
            legend: "SIMPLE_COVER_5E.Settings.VariantMenu.Groups.Measurement",
            keys: [
                SETTING_KEYS.GRIDLESS_DISTANCE_MODE,
                SETTING_KEYS.GRIDLESS_TOKEN_SHAPE,
                SETTING_KEYS.GRIDLESS_TOKEN_SHAPE_UPDATE_EXISTING
            ]
        },
        engine: {
            legend: "SIMPLE_COVER_5E.Settings.VariantMenu.Groups.Engine",
            keys: [
                SETTING_KEYS.INSET_ATTACKER,
                SETTING_KEYS.INSET_TARGET,
                SETTING_KEYS.INSET_OCCLUDER,
                SETTING_KEYS.FILTERED_TARGET_POINTS
            ]
        }
    };
}

/**
 * A configuration form for cover automation. 
 *
 * @extends {SimpleCoverBaseConfigApp}
 */
export class SimpleCoverAutomationConfig extends SimpleCoverBaseConfigApp {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        classes: ["standard-form", "simplecover5e-variant-config"],
        position: { width: 600 },
        window: {
            title: "SIMPLE_COVER_5E.Settings.AutomationMenu.Name",
            icon: "fas fa-list-check",
            contentClasses: ["standard-form"]
        }
    }, { inplace: false });


    static PARTS = {
        general: { template: "modules/simplecover5e/templates/base-config.hbs" },
        ...SimpleCoverBaseConfigApp.FOOTER_PARTS
    };

    static PART_CONFIG = {
        general: {
            legend: "SIMPLE_COVER_5E.Settings.AutomationMenu.Groups.General",
            keys: [
                SETTING_KEYS.COVER_HINTS,
                SETTING_KEYS.COVER_HINTS_GM_MESSAGE,
                SETTING_KEYS.COVER_SCOPE,
                SETTING_KEYS.ONLY_IN_COMBAT,
                SETTING_KEYS.RMV_ON_COMBAT,
                SETTING_KEYS.RMV_ON_MOVE
            ]
        }
    };

    /**
     * Prepare the render context for a single automation form part.
     * @param {string} partId The part being prepared.
     * @param {object} context The base context object.
     * @param {ApplicationRenderOptions} options The active render options.
     * @returns {Promise<object>} The prepared part context.
     */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);

        if (isLibraryMode()) {
            context.fields = [];
            context.message = {
                level: "warning",
                text: game.i18n.localize("SIMPLE_COVER_5E.Settings.AutomationMenu.LibraryModeWarning")
            };
        }

        return context;
    }
}
