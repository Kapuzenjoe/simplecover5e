import { MODULE_ID, SETTING_KEYS } from "../config.mjs";
import { isMidiAutomation } from "../integrations/midi-qol.mjs";
import { SimpleCoverBaseConfigApp } from "./base-settings.mjs";

/**
 * A configuration form for cover automation. 
 *
 * @extends {SimpleCoverBaseConfigApp}
 */
export class SimpleCoverAutomationConfig extends SimpleCoverBaseConfigApp {
    static DEFAULT_OPTIONS = {
        window: {
            title: "SIMPLE_COVER_5E.Settings.AutomationMenu.Name",
            icon: "fa-solid fa-cogs"
        }
    };

    static FIELDSETS = [
        {
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
    ];

    /**
     * Prepare the automation settings render context.
     * @param {ApplicationRenderOptions} options The active render options.
     * @returns {Promise<object>} The prepared render context.
     */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE) || isMidiAutomation()) {
            context.fields = [];
            context.hint = "SIMPLE_COVER_5E.Settings.AutomationMenu.LibraryModeWarning";
        }

        return context;
    }
}
