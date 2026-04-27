import { SETTING_KEYS } from "../config/constants.mjs";
import { isLibraryMode } from "../integrations/midi-qol.mjs";
import { SimpleCoverBaseConfigApp } from "./base-config.mjs";

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
