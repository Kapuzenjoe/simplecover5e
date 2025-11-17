export const MODULE_ID = "simplecover5e";

export const COVER_STATUS_IDS = {
  half: "coverHalf",
  threeQuarters: "coverThreeQuarters"
  //total: "coverTotal"
};

export const SETTING_KEYS = {
  COVER_SCOPE: "coverRemovalScope",
  ONLY_IN_COMBAT: "onlyInCombat",
  RMV_ON_COMBAT: "rmvCovCombat",
  RMV_ON_MOVE: "rmvCovMovement",
  CREATURES_HALF_ONLY: "creaturesHalfCoverOnly",
  DEBUG: "debugCover",
  CREATURE_HEIGHTS: "creatureHeights",
  HOVER: "hover",
};

export const DEFAULT_SIZE_FT = {
  tiny: 1,
  small: 3,
  medium: 6,
  large: 12,
  huge: 24,
  gargantuan: 48
};

export const GRID_MODES = {
  SQUARE: "square",
  GRIDLESS: "gridless",
  HEX: "hex",
};

export function getGridMode(grid) {
  const t = grid?.type;
  switch (t) {
    case CONST.GRID_TYPES.GRIDLESS: return GRID_MODES.GRIDLESS;
    case CONST.GRID_TYPES.SQUARE: return GRID_MODES.SQUARE;
    case CONST.GRID_TYPES.HEXODDR:
    case CONST.GRID_TYPES.HEXEVENR:
    case CONST.GRID_TYPES.HEXODDQ:
    case CONST.GRID_TYPES.HEXEVENQ:
      return GRID_MODES.HEX;
    default:
      return GRID_MODES.SQUARE;
  }
}