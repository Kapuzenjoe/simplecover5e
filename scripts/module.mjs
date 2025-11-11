import * as settings from "./config/settings.config.mjs";
import * as coverHandler from "./handlers/cover.hooks.mjs";
import * as queries from "./services/queries.service.mjs";
import * as debug from "./services/cover.debug.mjs";


// === Init Phase ===
Hooks.once("init", () => {
  settings.registerSettings();
  queries.initQueries();
  coverHandler.ignoreCoverProperties();
});
Hooks.once("ready", () => {
  debug.clearCoverDebug();
});


// === Calc Cover Hooks ===
Hooks.on("updateCombat", coverHandler.clearCoverOnUpdateCombat); // Clear Cover
Hooks.on("deleteCombat", coverHandler.clearCoverOnDeleteCombat); // Clear Cover
Hooks.on("moveToken", coverHandler.clearCoverOnMovement); // Clear Cover
Hooks.on("dnd5e.preRollAttack", coverHandler.onPreRollAttack); // Calc Cover on attack roll
Hooks.on("dnd5e.preRollSavingThrow", coverHandler.onPreRollSavingThrow); // Calc Cover on saving throw
