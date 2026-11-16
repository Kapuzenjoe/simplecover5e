/**
 * Check whether the Wall Height module is active.
 * @returns {boolean} True if the Wall Height module is currently active.
 */
function isWallHeightModuleActive() {
  return game.modules?.get?.("wall-height")?.active === true;
}

/* -------------------------------------------- */

/**
 * Get the elevation bounds that Wall Height compares with the height range of a wall.
 * @param {...number} elevations The elevations along the line, usually its start and end.
 * @returns {{ b?: number, t?: number }} The lowest and highest elevation.
 */
export function getWallHeightBounds(...elevations) {
  if ( !isWallHeightModuleActive() ) return {};
  return { b: Math.min(...elevations), t: Math.max(...elevations) };
}
