import { MODULE_ID, SETTING_KEYS } from "../config.mjs";
import { hasRideableRiders } from "../integrations/rideable.mjs";

/**
 * @import { Position } from "../_types.mjs";
 */

/**
 * Scale a height value by the module's prone mode for a token.
 * Returns the height unchanged when the token is not prone or prone mode is "none".
 * @param {TokenDocument} tokenDoc The token document to check.
 * @param {number} height The height above the token's base elevation to scale.
 * @returns {number} The scaled height.
 */
export function applyProneMode(tokenDoc, height) {
  if ( !tokenDoc?.actor?.statuses?.has?.("prone") ) return height;
  const proneMode = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURES_PRONE);
  if ( proneMode === "none" ) return height;
  if ( proneMode === "half" ) return height * 0.5;
  if ( proneMode === "lowerSize" ) {
    const depth = Number(tokenDoc?.depth) || 0;
    if ( !depth ) return height;
    const depthLower = (depth > 1) ? Math.max(depth - 1, 0.5) : (depth * 0.5);
    return height * (depthLower / depth);
  }
  return height;
}

/* -------------------------------------------- */

/**
 * Get the creature height in grid distance units for a token document.
 * @param {TokenDocument5e|Position} td The token document or a generic position.
 * @returns {number} The creature height in grid distance units, or 0.
 */
export function getCreatureHeight(td) {
  if ( !td?.actor ) return 0;
  const grid = td?.parent?.grid ?? canvas?.scene?.grid;
  const depth = Number(td?.depth) || 0;
  const distance = Number(grid?.distance) || 0;
  return applyProneMode(td, depth * distance);
}

/* -------------------------------------------- */

/**
 * Resolve the external token radius in pixels from document data.
 * @param {Token5e|TokenDocument5e|Position} token The token, token document, or generic position.
 * @returns {number|null} The external radius in pixels, or null if it cannot be determined.
 */
export function getTokenExternalRadius(token) {
  const doc = token?.document ?? token;
  const size = doc?.getSize?.();
  if ( !size ) return null;

  const { width, height } = size;
  if ( !Number.isFinite(width) || !Number.isFinite(height) ) return null;

  return Math.min(width, height) / 2;
}

/* -------------------------------------------- */

/**
 * Determine whether a token should be treated as a blocking creature for cover and line-of-sight (LOS) occlusion.
 * Hidden, dead, or ethereal creatures are ignored.
 * @param {Token5e|TokenDocument5e} token The token or token document to evaluate.
 * @returns {boolean} True if the token is considered blocking.
 */
export function isBlockingCreatureToken(token) {
  if ( !token ) return false;

  const doc = token.document ?? token;
  if ( !doc || doc.hidden ) return false;

  const actor = doc.actor ?? token.actor;
  if ( !actor ) return true;

  const statuses = actor?.statuses;
  if ( !statuses ) return true;

  if ( isDefeatedToken(token) ) return false;
  if ( statuses.has("ethereal") ) return false;
  if ( actor.system?.attributes?.hp?.max === 0 ) return false;

  return !hasRideableRiders(doc);
}

/* -------------------------------------------- */

/**
 * Check whether a token document represents a defeated creature.
 * @param {TokenDocument5e|Token5e} token The token or token document to evaluate.
 * @returns {boolean} True if the token is marked as defeated.
 */
export function isDefeatedToken(token) {
  if ( !token ) return false;

  const doc = token.document ?? token;
  if ( !doc ) return false;

  return doc.hasStatusEffect(CONFIG.specialStatusEffects.DEFEATED)
    || (doc.combatant?.isDefeated === true);
}

/* -------------------------------------------- */

/**
 * Check whether a token uses an ellipse shape.
 * @param {TokenDocument5e|Position} tokenDoc The token document or generic position to evaluate.
 * @returns {boolean} True if the token uses an ellipse shape.
 */
export function isEllipse(tokenDoc) {
  return (
    (tokenDoc?.shape === CONST.TOKEN_SHAPES.ELLIPSE_1)
    || (tokenDoc?.shape === CONST.TOKEN_SHAPES.ELLIPSE_2)
  );
}
