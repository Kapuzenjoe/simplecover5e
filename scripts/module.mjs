import { FLAGS } from "./config/constants.config.mjs";
import { registerSettings, getSceneControlButtons } from "./config/settings.config.mjs";
import {
  ignoreCoverProperties,
  clearCoverOnUpdateCombat,
  clearCoverOnDeleteCombat,
  clearCoverOnMovement,
  onPreRollAttack,
  onPreRollSavingThrow,
  onBuildAttackRollConfig,
  onBuildSavingThrowRollConfig
} from "./handlers/cover.hooks.mjs";
import { initQueries } from "./services/queries.service.mjs";
import { clearCoverDebug } from "./services/cover.debug.mjs";
import { onHoverToken, onPreDeleteToken } from "./services/hover.service.mjs";
import { initApi, readyApi } from "./utils/api.mjs";
import { onRenderRollConfigurationDialog, onPostRollConfiguration } from "./services/dialog.service.mjs";
import { onCreateToken } from "./services/cover.service.mjs";

// === Init Phase ===
Hooks.once("init", () => {
  registerSettings();
  initQueries();
  ignoreCoverProperties();
  initApi();
});

Hooks.once("ready", readyApi);
Hooks.on("canvasReady", clearCoverDebug);
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
  ["dnd5e.buildAttackRollConfig", onBuildAttackRollConfig],
  ["dnd5e.buildSavingThrowRollConfig", onBuildSavingThrowRollConfig],
  ["dnd5e.postRollConfiguration", onPostRollConfiguration]
]) {
  Hooks.on(hook, fn);
}

// === Register Flags for DAE ===

Hooks.once("dae.setupComplete", () => {
  const dae = globalThis.DAE;
  if (!dae) return;

  const fields = Object.keys(FLAGS);
  dae.addAutoFields?.(fields);
  dae.localizationMap ??= {};

  for (const field of fields) {
    const localization = FLAGS[field];
    if (!localization) continue;

    const name = game.i18n.localize(localization.name);
    const description = game.i18n.localize(localization.hint);
    dae.localizationMap[field] = { name, description };
  }
});
