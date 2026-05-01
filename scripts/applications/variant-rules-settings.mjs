import { MODULE_ID, SETTING_KEYS } from "../config.mjs";
import { SimpleCoverBaseConfigApp } from "./base-settings.mjs";
import { changeTokenShapes } from "../canvas/token-shape.mjs";

/**
 * A configuration form for cover and measurement rule variants.
 *
 * @extends {SimpleCoverBaseConfigApp}
 */
export class SimpleCoverVariantConfig extends SimpleCoverBaseConfigApp {
    static DEFAULT_OPTIONS = {
        window: {
            title: "SIMPLE_COVER_5E.Settings.VariantMenu.Name",
            icon: "fas fa-list-check"
        },
        actions: {
            applyGridlessTokenShape: SimpleCoverVariantConfig.#onApplyGridlessTokenShape
        }
    };

    static FIELDSETS = [
        {
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
        {
            legend: "SIMPLE_COVER_5E.Settings.VariantMenu.Groups.Measurement",
            keys: [
                SETTING_KEYS.GRIDLESS_DISTANCE_MODE,
                SETTING_KEYS.GRIDLESS_TOKEN_SHAPE
            ]
        },
        {
            legend: "SIMPLE_COVER_5E.Settings.VariantMenu.Groups.Engine",
            keys: [
                SETTING_KEYS.INSET_ATTACKER,
                SETTING_KEYS.INSET_TARGET,
                SETTING_KEYS.INSET_OCCLUDER,
                SETTING_KEYS.FILTERED_TARGET_POINTS
            ]
        }
    ];

    /** @inheritdoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        this.#insertGridlessTokenShapeButton();
    }

    /**
     * Insert the gridless token shape bulk-action button into the related form field.
     *
     * @returns {void}
     */
    #insertGridlessTokenShapeButton() {
        const input = this.element.querySelector(`[name="${MODULE_ID}.${SETTING_KEYS.GRIDLESS_TOKEN_SHAPE}"]`);
        const formFields = input?.closest(".form-fields");
        if (!formFields || formFields.querySelector("[data-action='applyGridlessTokenShape']")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = "applyGridlessTokenShape";
        button.dataset.tooltip = "SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyExisting";
        button.setAttribute("aria-label", "SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyExisting");
        button.innerHTML = '<i class="fa-solid fa-rotate" inert></i>';
        formFields.append(button);
    }

    /**
     * Apply the selected gridless token shape to existing tokens after explicit confirmation.
     *
     * @returns {Promise<void>} Resolves after matching tokens have been updated.
     */
    static async #onApplyGridlessTokenShape() {
        await this.submit();

        const currentScene = canvas?.scene ?? null;
        const scope = await foundry.applications.api.DialogV2.wait({
            window: { title: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyTitle" },
            content: `<p>${game.i18n.localize("SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyHint")}</p>`,
            buttons: [
                {
                    action: "scene",
                    label: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyCurrentScene",
                    icon: "fa-solid fa-map",
                    disabled: !currentScene?.grid?.isGridless
                },
                {
                    action: "all",
                    label: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyAllScenes",
                    icon: "fa-solid fa-globe"
                },
                {
                    action: "cancel",
                    label: "COMMON.Cancel",
                    icon: "fa-solid fa-xmark"
                }
            ],
            rejectClose: false
        });
        if ((scope !== "scene") && (scope !== "all")) return;

        const count = await changeTokenShapes({ scene: scope === "scene" ? currentScene : null });
        ui.notifications.info(game.i18n.format("SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyUpdated", { count }));
    }
}
