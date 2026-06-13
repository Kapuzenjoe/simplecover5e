/**
 * Resolve the replacement display name provided by Hide NPC Names.
 *
 * @param {Actor} actor The actor whose display name may be replaced.
 * @returns {string|null} The replacement name, or null when unavailable.
 */
export function getHiddenNpcName(actor) {
  if ( !actor ) return null;
  if ( game.modules?.get?.("hide-npc-names")?.active !== true ) return null;
  if ( !game.hnn ) return null;

  return game.hnn.getReplacementInfo(actor)?.displayName ?? null;
}
