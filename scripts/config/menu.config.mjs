import { MODULE_ID, DEFAULT_SIZE_FT, SETTING_KEYS, BASE_KEYS } from "./constants.config.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Configuration application for default creature heights used by Simple Cover 5e.
 *
 * @extends {ApplicationV2}
 */
export class SimpleCoverCreatureHeightsConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    /** @inheritdoc */
    static DEFAULT_OPTIONS = {
        tag: "form",
        position: {
            width: 500,
        },
        window: {
            title: "SimpleCover5e – Creature Heights",
            icon: "fas fa-ruler-vertical",
            contentClasses: ["standard-form"],
        },
        form: {
            submitOnChange: false,
            closeOnSubmit: true,
            handler: SimpleCoverCreatureHeightsConfig.#onSubmit,
        },
        actions: {
            reset: SimpleCoverCreatureHeightsConfig.#onReset,
        },
    };

    /** @inheritdoc */
    static PARTS = {
        inputs: {
            template: "modules/simplecover5e/templates/creature-heights-config.hbs",
        },
        footer: {
            template: "templates/generic/form-footer.hbs",
        },
    };

    /** @inheritdoc */
    async _prepareContext(options) {
        const current = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURE_HEIGHTS) ?? {};
        const base = foundry.utils.mergeObject(
            DEFAULT_SIZE_FT,
            current,
            { inplace: false }
        );

        const actorSizes = CONFIG.DND5E?.actorSizes ?? {};

        const sizes = BASE_KEYS.map((key) => {
            const sizeData = actorSizes[key];

            const label =
                sizeData?.label ||
                key.charAt(0).toUpperCase() + key.slice(1);

            return {
                key,
                value: base[key],
                label,
                default: DEFAULT_SIZE_FT[key]
            };
        });

        const buttons = [
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

        const gridUnits = canvas?.scene?.grid?.units ?? "ft";
        return { sizes, buttons, gridUnits };
    }

    /**
     * Handle form submission and persist the cleaned creature height values.
     *
     * @param {SubmitEvent} event
     * @param {HTMLFormElement} form
     * @param {FormDataExtended} formData
     */
    static async #onSubmit(event, form, formData) {
        event.preventDefault();

        const cleaned = {};
        const obj = formData.object ?? {};
        for (const key of BASE_KEYS) {
            const fallback = DEFAULT_SIZE_FT[key] ?? 0;
            let raw = obj[key];
            raw = raw === undefined || raw === null ? "" : String(raw).trim();
            if (raw === "") {
                cleaned[key] = fallback;
                continue;
            }
            const n = Number(raw);
            cleaned[key] = Number.isFinite(n) && n >= 0 ? n : fallback;
        }

        await game.settings.set(MODULE_ID, SETTING_KEYS.CREATURE_HEIGHTS, cleaned);
    }

    /**
     * Reset all creature heights back to the module defaults.
     *
     * @this {SimpleCoverCreatureHeightsConfig}
     * @param {PointerEvent} event
     * @param {HTMLButtonElement} target
     */
    static async #onReset(event, target) {
        event.preventDefault();

        await game.settings.set(
            MODULE_ID,
            SETTING_KEYS.CREATURE_HEIGHTS,
            foundry.utils.duplicate(DEFAULT_SIZE_FT)
        );

        ui.notifications.info("SimpleCover5e: Creature heights reset to defaults.");

        this.render();
    }
}

/**
 * Configuration application for Cover & Measurement rules used by Simple Cover 5e.
 *
 * @extends {ApplicationV2}
 */
export class SimpleCoverVariantConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    /** @override */
    static DEFAULT_OPTIONS = {
        tag: "form",
        classes: ["standard-form", "simplecover5e-variant-config"],
        position: {
            width: 600,
        },
        window: {
            title: "SimpleCover5e – Cover & Measurement Rules",
            icon: "fas fa-list-check",
            contentClasses: ["standard-form"]
        },
        form: {
            submitOnChange: false,
            closeOnSubmit: true,
            handler: SimpleCoverVariantConfig.#onSubmit
        }
    };

    /** @override */
    static PARTS = {
        general: {
            template: "modules/simplecover5e/templates/base-config.hbs"
        },
        measurement: {
            template: "modules/simplecover5e/templates/base-config.hbs"
        },
        footer: {
            template: "templates/generic/form-footer.hbs"
        }
    };

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if (!context.buttons) {
            context.buttons = [
                {
                    type: "submit",
                    icon: "fa-solid fa-check",
                    label: game.i18n.localize("SIMPLE_COVER_5E.Settings.VariantMenu.Buttons.Save")
                }
            ];
        }
        switch (partId) {
            case "general":
                context.fields = [
                    this.#createSettingField(SETTING_KEYS.CREATURES_HALF_ONLY), 
                    this.#createSettingField(SETTING_KEYS.CREATURES_PRONE),
                ].filter(Boolean);
                context.legend = game.i18n.localize("SIMPLE_COVER_5E.Settings.VariantMenu.Groups.General");
                break;

            case "measurement":
                context.fields = [
                    this.#createSettingField(SETTING_KEYS.GRIDLESS_DISTANCE_MODE)
                ].filter(Boolean);
                context.legend = game.i18n.localize("SIMPLE_COVER_5E.Settings.VariantMenu.Groups.Measurement");
                break;

            default:
                break;
        }

        return context;
    }

    /** 
     * Create a setting field data object for rendering.
     * 
     * @param {string} key  
     * @returns {object|null}
     */
    #createSettingField(key) {
        const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
        if (!setting) {
            return null;
        }

        let FieldClass;
        if (setting.type instanceof foundry.data.fields.BooleanField) {
            FieldClass = foundry.data.fields.BooleanField;
        } else if (setting.type instanceof foundry.data.fields.NumberField) {
            FieldClass = foundry.data.fields.NumberField;
        } else if (setting.type instanceof foundry.data.fields.StringField) {
            FieldClass = foundry.data.fields.StringField;
        } else {
            const def = setting.default;
            if (typeof def === "boolean") FieldClass = foundry.data.fields.BooleanField;
            else if (typeof def === "number") FieldClass = foundry.data.fields.NumberField;
            else FieldClass = foundry.data.fields.StringField;
        }

        const field = new FieldClass({
            label: game.i18n.localize(setting.name),
            hint: setting.hint ? game.i18n.localize(setting.hint) : "",
            required: true,
            blank: false
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

    /** 
     * Handle form submission and persist changed setting values.
     * 
     * @param {SubmitEvent} event
     * @param {HTMLFormElement} form
     * @param {FormDataExtended} formData
     */
    static async #onSubmit(event, form, formData) {
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