/**
 * Check whether Rideable marks a token as currently carrying riders.
 *
 * @param {TokenDocument} tokenDoc The token document to inspect.
 * @returns {boolean} True if the token has Rideable riders.
 */
export function hasRideableRiders(tokenDoc) {
  if ( game.modules.get("Rideable")?.active !== true ) return false;

  return tokenDoc?.getFlag("Rideable", "RidersFlag")?.length > 0;
}
