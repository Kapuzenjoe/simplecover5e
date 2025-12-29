/**
 * @typedef {"none"|"half"|"threeQuarters"|"total"} CoverLevel
 * @typedef {"square"|"gridless"|"hex"} GridMode
 */

/**
 * Simple Cover 5e module id.
 * @type {string}
 */
export const MODULE_ID = "simplecover5e";

/**
 * Central cover constants.
 *
 * - IDS: maps cover levels ("none"|"half"|"threeQuarters"|"total") to system effect ids (or null for none).
 * - EFFECT_IDS: list of system effect ids used for cover.
 * - BONUS: maps cover levels ("none"|"half"|"threeQuarters"|"total") to AC/DEX bonus (null for total cover).
 * 
 * @readonly
 * @type {{
 *   IDS: { none: null, half: string, threeQuarters: string, total: string },
 *   EFFECT_IDS: string[],
 *   BONUS: { none: number, half: number, threeQuarters: number, total: (number|null) }
 * }}
 */
export const COVER = Object.freeze({
  IDS: Object.freeze({
    none: null,
    half: "coverHalf",
    threeQuarters: "coverThreeQuarters",
    total: "coverTotal"
  }),
  EFFECT_IDS: Object.freeze([
    ["total", "dnd5ecoverTotal0"],
    ["threeQuarters", "dnd5ecoverThreeQ"],
    ["half", "dnd5ecoverHalf00"]
  ]),
  BONUS: Object.freeze({
    none: 0,
    half: 2,
    threeQuarters: 5,
    total: null
  }),
  ORDER: Object.freeze({
    none: 0,
    half: 1,
    threeQuarters: 2,
    total: 3
  })
});

/**
 * Setting keys used by this module.
 * All settings are registered under {@link MODULE_ID} using these keys.
 *
 * @readonly
 * @enum {string}
 */
export const SETTING_KEYS = {
  COVER_SCOPE: "coverRemovalScope",
  ONLY_IN_COMBAT: "onlyInCombat",
  RMV_ON_COMBAT: "rmvCovCombat",
  RMV_ON_MOVE: "rmvCovMovement",
  LOS_CHECK: "losCheck",
  CREATURES_HALF_ONLY: "creaturesHalfCoverOnly",
  IGNORE_DISTANCE_AOE: "IgnoreDistanceAOE",
  IGNORE_ALL_AOE: "IgnoreAllAOE",
  IGNORE_DISTANCE_SPACE: "IgnoreDistanceSpace",
  DEBUG: "debugCover",
  CREATURE_HEIGHTS: "creatureHeights",
  HOVER: "hover",
  LIBRARY_MODE: "libraryMode",
  HOVER_LABEL_POSITION: "hoverLabelPosition",
  HOVER_LABEL_Y_OFFSET: "hoverLabelYOffset",
  HOVER_LABEL_X_OFFSET: "hoverLabelXOffset",
  GRIDLESS_DISTANCE_MODE: "gridlessDistanceMode",
  GRIDLESS_TOKEN_SHAPE: "gridlessTokenShape",
  CREATURES_PRONE: "proneCreatures"
};

/**
 * Default creature heights in feet by size category.
 *
 * @type {Record<string, number>}
 */
export const DEFAULT_SIZE_FT = {
  tiny: 1,
  sm: 3,
  med: 6,
  lg: 12,
  huge: 24,
  grg: 48
};

/**
 * Base size keys used for iteration and configuration UIs.
 * @type {string[]}
 */
export const BASE_KEYS = Object.keys(DEFAULT_SIZE_FT);

/**
 * Simplified grid modes used by this module.
 *
 * @readonly
 * @enum {GridMode}
 */
export const GRID_MODES = {
  SQUARE: "square",
  GRIDLESS: "gridless",
  HEX: "hex"
};

/**
 * Normalize a scene's grid configuration into a supported grid mode.
 *
 * @param {Scene["grid"]} grid        The scene grid configuration.
 * @returns {GridMode}               The simplified grid mode.
 */
export function getGridMode(grid) {
  const t = grid?.type;
  switch (t) {
    case CONST.GRID_TYPES.GRIDLESS:
      return GRID_MODES.GRIDLESS;
    case CONST.GRID_TYPES.SQUARE:
      return GRID_MODES.SQUARE;
    case CONST.GRID_TYPES.HEXODDR:
    case CONST.GRID_TYPES.HEXEVENR:
    case CONST.GRID_TYPES.HEXODDQ:
    case CONST.GRID_TYPES.HEXEVENQ:
      return GRID_MODES.HEX;
    default:
      return GRID_MODES.SQUARE;
  }
}

/**
 * Constants related to hover labels and icons used by this module.
 *
 * @readonly
 * @type {{DISTANCE_LABEL_PROP:string, DISTANCE_LABEL_NAME:string, COVER_ICON_PROP:string, COVER_ICON_NAME:string}}
 */
export const HOVER = {
  DISTANCE_LABEL_PROP: `_${MODULE_ID}HoverDistanceLabel`,
  DISTANCE_LABEL_NAME: `${MODULE_ID}-hover-distance-label`,
  COVER_ICON_PROP: `_${MODULE_ID}HoverCoverIcon`,
  COVER_ICON_NAME: `${MODULE_ID}-hover-cover-icon`
};
