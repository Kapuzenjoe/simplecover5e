import { MODULE_ID, SETTING_KEYS } from "./config.mjs";
import { log } from "./utils.mjs";

/**
 * Run pending data migrations for the module when the active user is a GM.
 */
export function readyMigration() {
  if ( game.user.isGM ) {
    migrateSettings();
  }
}

/* -------------------------------------------- */

/**
 * Migrate legacy module settings to their current equivalents.
 */
async function migrateSettings() {
  try {
    const ignoreAll = game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_ALL_AOE);
    const ignoreDist = game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_DISTANCE_AOE);

    if ( ignoreAll || ignoreDist ) {
      const migrated = ignoreAll ? "all" : "range";
      await game.settings.set(MODULE_ID, SETTING_KEYS.IGNORE_AOE, migrated);
      await game.settings.set(MODULE_ID, SETTING_KEYS.IGNORE_ALL_AOE, false);
      await game.settings.set(MODULE_ID, SETTING_KEYS.IGNORE_DISTANCE_AOE, false);
    }
  } catch (err) {
    log("settings migration failed:", { extras: [err] });
  }
}
