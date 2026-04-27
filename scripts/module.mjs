import { initSettings } from "./config/settings.mjs";
import { initCoverHooks } from "./cover/hooks.mjs";
import { initQueries } from "./socket/queries.mjs";
import { initCoverDebugHooks } from "./cover/debug.mjs";
import { initDaeIntegration } from "./integrations/dae.mjs";
import { initRollDialogHooks } from "./applications/roll-dialog.mjs";
import { initHoverHooks } from "./canvas/hover.mjs";
import { initApi, readyApi } from "./cover/api.mjs";

Hooks.once("init", () => {
  initSettings();
  initQueries();
  initCoverHooks();
  initCoverDebugHooks();
  initDaeIntegration();
  initRollDialogHooks();
  initHoverHooks();
  initApi();
});

Hooks.once("ready", readyApi);
