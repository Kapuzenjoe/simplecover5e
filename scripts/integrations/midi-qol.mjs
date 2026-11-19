/**
 * Test whether Midi-QOL is configured to use Simple Cover 5e as its cover provider.
 * @returns {boolean} True if Midi-QOL owns cover automation for the current workflow.
 */
export function isMidiAutomation() {
  if ( !game.modules.get("midi-qol")?.active ) return false;
  const coverCalculation = game.settings.get("midi-qol", "ConfigSettings")
    ?.optionalRules?.coverCalculation;
  return coverCalculation === "simplecover5e";
}

/* -------------------------------------------- */

/**
 * Test whether Midi-QOL lets the actor ignore walls for Total Cover.
 * @param {Actor|null} [actor] The attacking actor.
 * @returns {boolean} True if the actor has the Midi-QOL flag.
 */
export function ignoresWalls(actor) {
  return !!actor?.flags?.["midi-qol"]?.ignoreWalls;
}
