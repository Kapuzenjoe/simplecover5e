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
  LIBRARY_MODE: "libraryMode",
  HOVER_LABEL_POSITION: "hoverLabelPosition",
  HOVER_LABEL_Y_OFFSET: "hoverLabelYOffset",
  HOVER_LABEL_X_OFFSET: "hoverLabelXOffset",
  GRIDLESS_DISTANCE_MODE: "gridlessDistanceMode",
};

export const DEFAULT_SIZE_FT = {
  tiny: 1,
  sm: 3,
  med: 6,
  lg: 12,
  huge: 24,
  grg: 48
};
export const BASE_KEYS = Object.keys(DEFAULT_SIZE_FT);

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
export const HOVER = {
  DISTANCE_LABEL_PROP: `_${MODULE_ID}HoverDistanceLabel`,
  DISTANCE_LABEL_NAME: `${MODULE_ID}-hover-distance-label`,
  COVER_ICON_PROP: `_${MODULE_ID}HoverCoverIcon`,
  COVER_ICON_NAME: `${MODULE_ID}-hover-cover-icon`,
}
