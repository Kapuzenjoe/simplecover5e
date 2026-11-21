import { initApi, readyApi } from "./api.mjs";
import { onRenderChatMessage } from "./applications/chat-message.mjs";
import CoverObstacleRegionBehaviorConfig from "./applications/region-behavior-config.mjs";
import { onRenderRollConfigurationDialog } from "./applications/roll-configuration-dialog.mjs";
import { clearCoverDebug } from "./canvas/debug.mjs";
import {
  onCanvasTearDown, onControlToken, onDeleteToken, onHoverToken, onMoveToken, onRefreshToken, onTargetToken
} from "./canvas/hover.mjs";
import { onPreCreateToken } from "./canvas/token-shape.mjs";
import { COVER_OBSTACLE_TYPE, MODULE_ID } from "./config.mjs";
import {
  clearCoverOnCombatChange, clearCoverOnMovement, onBuildAttackRollConfig, onBuildSavingThrowRollConfig,
  onPostSavingThrowRollConfiguration, onPreRollAttack, onPreRollSavingThrow
} from "./data/cover-automation.mjs";
import CoverObstacleRegionBehaviorType from "./data/cover-obstacle.mjs";
import { initCoverRules } from "./data/cover-rules.mjs";
import { onSetCoverStatus } from "./data/cover-status.mjs";
import { initDaeIntegration } from "./integrations/dae.mjs";
import { readyMigration } from "./migration.mjs";
import { onGetSceneControlButtons, registerSettings } from "./settings.mjs";

Hooks.once("init", () => {
  registerSettings();
  Hooks.on("getSceneControlButtons", onGetSceneControlButtons);
  CONFIG.queries[`${MODULE_ID}.setCoverStatus`] = onSetCoverStatus;
  Hooks.on("combatTurnChange", clearCoverOnCombatChange);
  Hooks.on("deleteCombat", clearCoverOnCombatChange);
  Hooks.on("moveToken", clearCoverOnMovement);
  Hooks.on("preCreateToken", onPreCreateToken);
  Hooks.on("dnd5e.preRollAttack", onPreRollAttack);
  Hooks.on("dnd5e.preRollSavingThrow", onPreRollSavingThrow);
  Hooks.on("dnd5e.postSavingThrowRollConfiguration", onPostSavingThrowRollConfiguration);
  Hooks.on("dnd5e.buildAttackRollConfig", onBuildAttackRollConfig);
  Hooks.on("dnd5e.buildSavingThrowRollConfig", onBuildSavingThrowRollConfig);
  initCoverRules();
  Hooks.on("canvasReady", clearCoverDebug);

  CONFIG.RegionBehavior.dataModels[COVER_OBSTACLE_TYPE] = CoverObstacleRegionBehaviorType;
  CONFIG.RegionBehavior.typeLabels[COVER_OBSTACLE_TYPE] = "SIMPLE_COVER_5E.RegionBehavior.CoverObstacle.label";
  CONFIG.RegionBehavior.typeHints[COVER_OBSTACLE_TYPE] = "SIMPLE_COVER_5E.RegionBehavior.CoverObstacle.hint";
  CONFIG.RegionBehavior.typeIcons[COVER_OBSTACLE_TYPE] = "fa-solid fa-shield-halved";

  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
  DocumentSheetConfig.unregisterSheet(
    CONFIG.RegionBehavior.documentClass, "core", foundry.applications.sheets.RegionBehaviorConfig, {
      types: [COVER_OBSTACLE_TYPE]
    }
  );
  DocumentSheetConfig.registerSheet(
    CONFIG.RegionBehavior.documentClass, "simplecover5e", CoverObstacleRegionBehaviorConfig, {
      label: "SIMPLE_COVER_5E.SheetClass.CoverObstacle",
      makeDefault: true,
      types: [COVER_OBSTACLE_TYPE]
    }
  );

  initDaeIntegration();
  Hooks.on("renderRollConfigurationDialog", onRenderRollConfigurationDialog);
  Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  Hooks.on("hoverToken", onHoverToken);
  Hooks.on("targetToken", onTargetToken);
  Hooks.on("controlToken", onControlToken);
  Hooks.on("refreshToken", onRefreshToken);
  Hooks.on("moveToken", onMoveToken);
  Hooks.on("canvasTearDown", onCanvasTearDown);
  Hooks.on("deleteToken", onDeleteToken);
  initApi();
});

Hooks.once("ready", () => {
  readyApi();
  readyMigration();
});
