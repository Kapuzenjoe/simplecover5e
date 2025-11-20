import { MODULE_ID, SETTING_KEYS, GRID_MODES, getGridMode } from "../config/constants.config.mjs";

/**
 * Measure the minimal 3D distance between two tokens in grid units.
 * Uses the system's grid measurement, including its diagonal rule (e.g. 1/1/1 or 1/2/1).
 *
 * Gridless modes:
 *  - edgeEdge      -> edge to edge (source + target radius)
 *  - centerCenter  -> center to center (no adjustment)
 *  - edgeCenter    -> source edge to target center (legacy / previous behaviour)
 *
 * @param {TokenDocument} sourceToken   The source token.
 * @param {TokenDocument} targetToken   The target token.
 * @returns {number}                    The minimal distance in grid units.
 */
export function measureTokenDistance(sourceToken, targetToken) {
  const scene = sourceToken.parent;
  const { grid } = scene;

  const gridMode = getGridMode(grid);
  const isGridless = gridMode === GRID_MODES.GRIDLESS;

  const sourceOffsets = isGridless
    ? [sourceToken.getCenterPoint()]
    : sourceToken.getOccupiedGridSpaceOffsets();

  const targetOffsets = isGridless
    ? [targetToken.getCenterPoint()]
    : targetToken.getOccupiedGridSpaceOffsets();

  const sourceElevation = sourceToken.elevation ?? 0;
  const targetElevation = targetToken.elevation ?? 0;

  let minDistance = Infinity;

  for (let i = 0; i < sourceOffsets.length; i++) {
    const sourceCenter = grid.getCenterPoint(sourceOffsets[i]);
    const fromPoint = {
      x: sourceCenter.x,
      y: sourceCenter.y,
      elevation: sourceElevation
    };

    for (let j = 0; j < targetOffsets.length; j++) {
      const targetCenter = grid.getCenterPoint(targetOffsets[j]);
      const toPoint = {
        x: targetCenter.x,
        y: targetCenter.y,
        elevation: targetElevation
      };

      const distance = grid.measurePath([fromPoint, toPoint]).distance;

      if (distance < minDistance) {
        minDistance = distance;
        if (minDistance === 0) break;
      }
    }

    if (minDistance === 0) break;
  }

  let result = minDistance;

  if (isGridless) {
    const mode = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_DISTANCE_MODE) ?? "edgeCenter";

    if (mode === "edgeEdge" || mode === "edgeToCenter") {
      const unitsPerPixel = grid.distance / grid.size;
      const sourceRadiusPx = sourceToken.object?.externalRadius ?? 0;
      const targetRadiusPx = targetToken.object?.externalRadius ?? 0;

      if (mode === "edgeEdge") {
        const externalAdjust = unitsPerPixel * (sourceRadiusPx + targetRadiusPx);
        result = minDistance - externalAdjust;
      } else if (mode === "edgeToCenter") {
        const externalAdjust = unitsPerPixel * sourceRadiusPx;
        result = minDistance - externalAdjust;
      }
    }
    else if (mode === "centerCenter") {
      result = minDistance;
    }
  }

  return result < 0 ? 0 : result;
}
