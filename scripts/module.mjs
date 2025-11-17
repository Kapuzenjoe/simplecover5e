import * as settings from "./config/settings.config.mjs";
import * as coverHandler from "./handlers/cover.hooks.mjs";
import * as queries from "./services/queries.service.mjs";
import * as debug from "./services/cover.debug.mjs";
import * as hover from "./services/hover.service.mjs";


// === Init Phase ===
Hooks.once("init", () => {
  settings.registerSettings();
  queries.initQueries();
  coverHandler.ignoreCoverProperties();
});
Hooks.once("canvasReady", () => {
  debug.clearCoverDebug();
});
Hooks.on('getSceneControlButtons', settings.getSceneControlButtons);

// === Calc Cover Hooks ===
Hooks.on("updateCombat", coverHandler.clearCoverOnUpdateCombat); 
Hooks.on("deleteCombat", coverHandler.clearCoverOnDeleteCombat);
Hooks.on("moveToken", coverHandler.clearCoverOnMovement); 
Hooks.on("dnd5e.preRollAttack", coverHandler.onPreRollAttack);
Hooks.on("dnd5e.preRollSavingThrow", coverHandler.onPreRollSavingThrow); 
Hooks.on("hoverToken", hover.onHoverToken);
