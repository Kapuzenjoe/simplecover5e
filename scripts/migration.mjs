import { MODULE_ID, SETTING_KEYS, SHIM_FLAGS } from "./config.mjs";
import { log } from "./utils.mjs";

/**
 * Run pending data migrations for the module when the active user is a GM.
 */
export function readyMigration() {
  if ( game.user.isGM ) {
    migrateSettings();
    warnLegacyCoverRules();
  }
}

/* -------------------------------------------- */

/**
 * Warn the GM about actors that still use the deprecated cover flags.
 * @deprecated since Simple Cover 5e 2.3
 */
function warnLegacyCoverRules() {
  const names = game.actors
    .filter(actor => Object.keys(SHIM_FLAGS).some(name => actor.flags?.[MODULE_ID]?.[name]))
    .map(actor => actor.name);
  if ( !names.length ) return;
  ui.notifications.warn(_loc("SIMPLE_COVER_5E.Rules.LegacyRules", { names: names.join(", ") }), { permanent: true });
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

    if ( game.settings.get(MODULE_ID, SETTING_KEYS.CREATURES_HALF_ONLY) ) {
      await game.settings.set(MODULE_ID, SETTING_KEYS.CREATURE_COVER, "half");
      await game.settings.set(MODULE_ID, SETTING_KEYS.CREATURES_HALF_ONLY, false);
    }
  } catch (err) {
    log("settings migration failed:", { extras: [err] });
  }
}
