import { SETTING_KEYS } from "../config/constants.mjs";
import { SimpleCoverBaseConfigApp } from "./base-config.mjs";

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
