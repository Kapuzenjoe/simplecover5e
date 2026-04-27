import { FLAGS } from "../config/constants.mjs";

/**
 * Register DAE auto-fields once DAE has finished its setup.
 *
 * @returns {void}
 */
export function initDaeIntegration() {
  Hooks.once("dae.setupComplete", () => {
    const dae = globalThis.DAE;
    if (!dae) return;

    const fields = Object.keys(FLAGS);
    dae.addAutoFields?.(fields);
    dae.localizationMap ??= {};

    for (const field of fields) {
      const localization = FLAGS[field];
      if (!localization) continue;

      dae.localizationMap[field] = {
        name: game.i18n.localize(localization.name),
        description: game.i18n.localize(localization.hint)
      };
    }
  });
}
