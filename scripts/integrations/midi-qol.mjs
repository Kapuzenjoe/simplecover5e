import { MODULE_ID, SETTING_KEYS } from "../config/constants.mjs";

export function isLibraryMode() {
  if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE)) return true;

  const midi = game.modules.get("midi-qol")?.api ?? globalThis.MidiQOL;
  const coverCalculation =
    midi?.currentConfigSettings?.optionalRules?.coverCalculation ??
    midi?.configSettings?.()?.optionalRules?.coverCalculation;

  return coverCalculation === "simplecover5e";
}
