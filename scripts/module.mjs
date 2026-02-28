import { registerSettings, getSceneControlButtons } from "./config/settings.config.mjs";
import {
  ignoreCoverProperties,
  clearCoverOnUpdateCombat,
  clearCoverOnDeleteCombat,
  clearCoverOnMovement,
  onPreRollAttack,
  onPreRollSavingThrow,
} from "./handlers/cover.hooks.mjs";
import { initQueries } from "./services/queries.service.mjs";
import { clearCoverDebug } from "./services/cover.debug.mjs";
import { onHoverToken, onPreDeleteToken } from "./services/hover.service.mjs";
import { initApi, readyApi } from "./utils/api.mjs";
import { onRenderRollConfigurationDialog } from "./services/dialog.service.mjs"
import { onCreateToken } from "./services/cover.service.mjs";

// === Init Phase ===
Hooks.once("init", () => {
  registerSettings();
  initQueries();
  ignoreCoverProperties();
  initApi();
});

Hooks.once("ready", readyApi);
Hooks.once("canvasReady", clearCoverDebug);
Hooks.on("getSceneControlButtons", getSceneControlButtons);

// === Calc Cover Hooks ===
for (const [hook, fn] of [
  ["updateCombat", clearCoverOnUpdateCombat],
  ["deleteCombat", clearCoverOnDeleteCombat],
  ["moveToken", clearCoverOnMovement],
  ["dnd5e.preRollAttack", onPreRollAttack],
  ["dnd5e.preRollSavingThrow", onPreRollSavingThrow],
  ["hoverToken", onHoverToken],
  ["renderRollConfigurationDialog", onRenderRollConfigurationDialog],
  ["preDeleteToken", onPreDeleteToken],
  ["createToken", onCreateToken],
]) {
  Hooks.on(hook, fn);
}

// === Register Flags for DAE ===

Hooks.once("dae.setupComplete", () => {
  const fields = [
    "flags.simplecover5e.ignoreAllCover",
    "flags.simplecover5e.ignoreHalfCover",
    "flags.simplecover5e.ignoreThreeQuartersCover",
    "flags.simplecover5e.upgradeCover.all",
    "flags.simplecover5e.upgradeCover.attack",
    "flags.simplecover5e.upgradeCover.save"
  ];

  window.DAE?.addAutoFields?.(fields);
});