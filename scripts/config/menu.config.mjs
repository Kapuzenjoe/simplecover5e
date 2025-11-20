import { MODULE_ID, DEFAULT_SIZE_FT, SETTING_KEYS, BASE_KEYS } from "./constants.config.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

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
        })

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

        const gridUnits = canvas.scene?.grid?.units ?? "ft";
        return { sizes, buttons, gridUnits };
    }

    /**
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
     * @this {SimpleCoverCreatureHeightsConfig}
     * @param {PointerEvent} event
     * @param {HTMLButtonElement} target
     */
    static async #onReset(event, target) {
        event.preventDefault();

        await game.settings.set(MODULE_ID, SETTING_KEYS.CREATURE_HEIGHTS, foundry.utils.duplicate(DEFAULT_SIZE_FT));
        ui.notifications.info("SimpleCover5e: Creature heights reset to defaults.");

        this.render();
    }
}
