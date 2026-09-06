import { initChatMessageHooks } from "./applications/chat-message.mjs";
import { initCoverObstacleRegionBehaviorSheet } from "./applications/region-behavior-config.mjs";
import { initRollDialogHooks } from "./applications/roll-configuration-dialog.mjs";
import { initCoverDebugHooks } from "./canvas/debug.mjs";
import { initHoverHooks } from "./canvas/hover.mjs";
import { initApi, readyApi } from "./cover/api.mjs";
import { initCoverHooks } from "./cover/automation.mjs";
import { initCoverStatusQueries } from "./cover/status.mjs";
import { initCoverObstacleRegionBehavior } from "./data/cover-obstacle.mjs";
import { initDaeIntegration } from "./integrations/dae.mjs";
import { readyMigration } from "./migration.mjs";
import { initSettings } from "./settings.mjs";

Hooks.once("init", () => {
  initSettings();
  initCoverStatusQueries();
  initCoverHooks();
  initCoverDebugHooks();
  initCoverObstacleRegionBehavior();
  initCoverObstacleRegionBehaviorSheet();
  initDaeIntegration();
  initRollDialogHooks();
  initChatMessageHooks();
  initHoverHooks();
  initApi();
});

Hooks.once("ready", () => {
  readyApi();
  readyMigration();
});
