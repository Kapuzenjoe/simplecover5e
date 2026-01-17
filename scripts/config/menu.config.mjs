import { MODULE_ID, DEFAULT_SIZE, SETTING_KEYS, BASE_KEYS } from "./constants.config.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * A base configuration form used by Simple Cover 5e.
 *
 * @extends {ApplicationV2}
 */
export class SimpleCoverBaseConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static PART_CONFIG = {};
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
     * Return footer buttons for the form.
     */
    _getButtons() {
        return [
            {
                type: "submit",
                icon: "fa-solid fa-check",
                label: game.i18n.localize("SIMPLE_COVER_5E.Settings.HeightsMenu.Buttons.Save")
            }
        ];
    }

    /** @inheritdoc */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        context.buttons ??= this._getButtons();

        const partConfig = this.constructor.PART_CONFIG?.[partId];
        if (partConfig) {
            if (partConfig.legend) context.legend = game.i18n.localize(partConfig.legend);
            if (Array.isArray(partConfig.keys)) {
                context.fields = partConfig.keys.map((k) => this._createSettingField(k)).filter(Boolean);
            }
        }

        return context;
    }

    /**
     * Build a fieldlist descriptor for a registered setting.
     */
    _createSettingField(key) {
        const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
        if (!setting) return null;

        const { BooleanField, NumberField, StringField } = foundry.data.fields;

        const FieldClass = setting.type?.constructor;
        if (FieldClass !== BooleanField && FieldClass !== NumberField && FieldClass !== StringField) return null;

        const field = new FieldClass({
            label: game.i18n.localize(setting.name),
            hint: setting.hint ? game.i18n.localize(setting.hint) : ""
        });

        const data = {
            name: key,
            field,
            value: game.settings.get(MODULE_ID, key)
        };

        const choices =
            setting.choices ??
            setting.type?.choices ??
            setting.type?.options?.choices ??
            null;

        if (choices) {
            data.options = Object.entries(choices).map(([value, label]) => ({
                value,
                label: game.i18n.localize(label)
            }));
        }

        return data;
    }

    /** @inheritDoc */
    static async _onSubmit(event, form, formData) {
        event.preventDefault();

        const values = foundry.utils.expandObject(formData.object ?? {});
        let requiresClientReload = false;
        let requiresWorldReload = false;

        for (const [key, value] of Object.entries(values)) {
            const settingDef = game.settings.settings.get(`${MODULE_ID}.${key}`);
            if (!settingDef) continue;

            const before = game.settings.get(MODULE_ID, key);
            const after = await game.settings.set(MODULE_ID, key, value);
            if (before === after) continue;

            requiresClientReload ||= (settingDef.scope !== "world") && settingDef.requiresReload;
            requiresWorldReload ||= (settingDef.scope === "world") && settingDef.requiresReload;
        }

        if (requiresClientReload || requiresWorldReload) {
            return SettingsConfig.reloadConfirm({ world: requiresWorldReload });
        }
    }
}

/**
 * A configuration form for default creature heights.
 *
 * @extends {SimpleCoverBaseConfigApp}
 */
export class SimpleCoverCreatureHeightsConfig extends SimpleCoverBaseConfigApp {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        position: { width: 500 },
        window: {
            title: "SIMPLE_COVER_5E.Settings.HeightsMenu.Name",
            icon: "fas fa-ruler-vertical",
            contentClasses: ["standard-form"]
        },
        actions: {
            reset: this._onReset
        }
    }, { inplace: false });

    static PARTS = {
        inputs: { template: "modules/simplecover5e/templates/base-config.hbs" },
        ...SimpleCoverBaseConfigApp.FOOTER_PARTS
    };

    /** @inheritDoc */
    _getButtons() {
        return [
            {
                type: "submit",
                icon: "fa-solid fa-check",
                label: game.i18n.localize("SIMPLE_COVER_5E.Settings.HeightsMenu.Buttons.Save")
            },
            {
                type: "button",
                icon: "fa-solid fa-recycle",
                label: game.i18n.localize("SIMPLE_COVER_5E.Settings.HeightsMenu.Buttons.Reset"),
                action: "reset"
            }
        ];
    }

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if (partId !== "inputs") return context;

        const current = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURE_HEIGHTS) ?? {};
        const base = foundry.utils.mergeObject(DEFAULT_SIZE, current, { inplace: false });

        const actorSizes = CONFIG.DND5E?.actorSizes ?? {};
        const sizes = BASE_KEYS.map((key) => {
            const sizeData = actorSizes[key];
            const label = sizeData?.label || key.charAt(0).toUpperCase() + key.slice(1);
            return { key, value: base[key], label, default: DEFAULT_SIZE[key] };
        });

        return {
            ...context,
            sizes,
            gridUnits: canvas?.scene?.grid?.units ?? "ft",
            legend: game.i18n.localize("SIMPLE_COVER_5E.Settings.HeightsMenu.Legend"),
            settingKey: SETTING_KEYS.CREATURE_HEIGHTS
        };
    }

    /** @inheritDoc */
    static async _onReset(event, target) {
        event.preventDefault();

        await game.settings.set(MODULE_ID, SETTING_KEYS.CREATURE_HEIGHTS, foundry.utils.duplicate(DEFAULT_SIZE));
        ui.notifications.info("SimpleCover5e: Creature heights reset to defaults.");

        this.render();
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
                SETTING_KEYS.IGNORE_DISTANCE_AOE,
                SETTING_KEYS.IGNORE_ALL_AOE,
                SETTING_KEYS.IGNORE_DISTANCE_SPACE
            ]
        },
        measurement: {
            legend: "SIMPLE_COVER_5E.Settings.VariantMenu.Groups.Measurement",
            keys: [
                SETTING_KEYS.GRIDLESS_DISTANCE_MODE,
                SETTING_KEYS.GRIDLESS_TOKEN_SHAPE
            ]
        },
        engine: {
            legend: "SIMPLE_COVER_5E.Settings.VariantMenu.Groups.Engine",
            keys: [
                SETTING_KEYS.INSET_ATTACKER,
                SETTING_KEYS.INSET_TARGET,
                SETTING_KEYS.INSET_OCCLUDER
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
                SETTING_KEYS.COVER_SCOPE,
                SETTING_KEYS.ONLY_IN_COMBAT,
                SETTING_KEYS.RMV_ON_COMBAT,
                SETTING_KEYS.RMV_ON_MOVE
            ]
        }
    };

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);

        if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE)) {
            context.fields = [];
            context.message = {
                level: "warning",
                text: game.i18n.localize("SIMPLE_COVER_5E.Settings.AutomationMenu.LibraryModeWarning")
            };
        }

        return context;
    }
}
