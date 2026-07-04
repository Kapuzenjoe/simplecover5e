import { initCoverObstacleRegionBehaviorSheet } from "./applications/region-behavior-config.mjs";
import { initRollDialogHooks } from "./applications/roll-configuration-dialog.mjs";
import { initHoverHooks } from "./canvas/hover.mjs";
import { initApi, readyApi } from "./cover/api.mjs";
import { initCoverHooks } from "./cover/automation.mjs";
import { initCoverDebugHooks } from "./cover/debug.mjs";
import { initCoverObstacleRegionBehavior } from "./cover/region-behavior.mjs";
import { initCoverStatusQueries } from "./cover/status.mjs";
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
  initHoverHooks();
  initApi();
});

Hooks.once("ready", () => {
  readyApi();
  readyMigration();
});
