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
 * Warn the GM about actors and items that still use the deprecated cover flags or the Ignore Cover property.
 * @deprecated since Simple Cover 5e 2.3
 */
function warnLegacyCoverRules() {
  const hasProperty = item => item.system.properties?.has?.("ignoreCover");
  const names = game.actors
    .filter(actor => Object.keys(SHIM_FLAGS).some(name => actor.flags?.[MODULE_ID]?.[name]))
    .map(actor => actor.name);
  names.push(...game.items.filter(hasProperty).map(item => item.name));
  for ( const actor of game.actors ) {
    names.push(...actor.items.filter(hasProperty).map(item => `${actor.name}: ${item.name}`));
  }
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
  } catch (err) {
    log("settings migration failed:", { extras: [err] });
  }
}
