/**
 * Test whether Midi-QOL is configured to use Simple Cover 5e as its cover provider.
 *
 * @returns {boolean} True if Midi-QOL owns cover automation for the current workflow.
 */
export function isMidiAutomation() {
  const midi = game.modules.get("midi-qol")?.api ?? globalThis.MidiQOL;
  const coverCalculation =
    midi?.currentConfigSettings?.optionalRules?.coverCalculation ??
    midi?.configSettings?.()?.optionalRules?.coverCalculation;

  return coverCalculation === "simplecover5e";
}
