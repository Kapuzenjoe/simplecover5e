import * as settings from "./config/settings.mjs";
import * as coverHandler from "./handlers/cover-handler.mjs";
import * as queries from "./utils/queries.mjs";


// === Init Phase ===
Hooks.once("init", () => {
  settings.registerSettings();
  queries.initQueries();
  coverHandler.ignoreCoverProperties();
});


// === Calc Cover Hooks ===
 Hooks.on("updateCombat", coverHandler.clearCoverOnUpdateCombat); // Clear Cover
 Hooks.on("deleteCombat", coverHandler.clearCoverOnDeleteCombat); // Clear Cover
 //Hooks.on("moveToken", coverHandler.calcCoverOnMovement); // Clear Cover
 Hooks.on("dnd5e.preRollAttack", coverHandler.onPreRollAttack); // Calc Cover on attack roll
 Hooks.on("dnd5e.preRollSavingThrow", coverHandler.onPreRollSavingThrow); // Calc Cover on saving throw
