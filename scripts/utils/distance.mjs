import { MODULE_ID, SETTING_KEYS, GRID_MODES, getGridMode } from "../config/constants.config.mjs";

/**
 * Measure the minimal 3D distance between two tokens in scene grid units.
 * Uses Foundry's grid measurement (including diagonal rules) and optionally adjusts distances in gridless modes.
 *
 * Gridless distance modes:
 *  - "edgeEdge":      edge-to-edge
 *  - "centerCenter":  center-to-center
 *  - "edgeToCenter":  source edge to target center
 *
 * @param {Token|TokenDocument} sourceToken      The source token or document.
 * @param {Token|TokenDocument} targetToken      The target token or document.
 * @returns {number}                             The minimal distance in grid units (clamped to 0+).
 */
export function measureTokenDistance(sourceToken, targetToken) {
  const sourceDoc = sourceToken.document ?? sourceToken;
  const targetDoc = targetToken.document ?? targetToken;

  const scene = sourceDoc.parent;
  const { grid } = scene;

  const gridMode = getGridMode(grid);
  const isGridless = gridMode === GRID_MODES.GRIDLESS;

  const shapeMode = isGridless
    ? (game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_TOKEN_SHAPE) ?? "square")
    : null;
  const useSquareShape = isGridless && shapeMode === "square";

  const getGridlessPseudoSquareOffsets = (td) => {
    const wPx = (td.width ?? 1) * grid.size;
    const hPx = (td.height ?? 1) * grid.size;
    const cols = Math.max(1, Math.round(wPx / grid.size));
    const rows = Math.max(1, Math.round(hPx / grid.size));
    const cellW = wPx / cols;
    const cellH = hPx / rows;

    const centers = [];
    for (let ix = 0; ix < cols; ix++) {
      for (let iy = 0; iy < rows; iy++) {
        centers.push({
          x: td.x + (ix + 0.5) * cellW,
          y: td.y + (iy + 0.5) * cellH
        });
      }
    }
    return centers;
  };

  const sourceOffsets = isGridless
    ? (useSquareShape
      ? getGridlessPseudoSquareOffsets(sourceDoc)
      : [sourceDoc.getCenterPoint()])
    : sourceDoc.getOccupiedGridSpaceOffsets();

  const targetOffsets = isGridless
    ? (useSquareShape
      ? getGridlessPseudoSquareOffsets(targetDoc)
      : [targetDoc.getCenterPoint()])
    : targetDoc.getOccupiedGridSpaceOffsets();

  const sourceElevation = sourceDoc.elevation ?? 0;
  const targetElevation = targetDoc.elevation ?? 0;

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
    const mode = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_DISTANCE_MODE) ?? "edgeToCenter";

    if (mode === "edgeEdge" || mode === "edgeToCenter") {
      const unitsPerPixel = grid.distance / grid.size;
      const sourceRadiusPx = sourceDoc.object?.externalRadius ?? 0;
      const targetRadiusPx = targetDoc.object?.externalRadius ?? 0;

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
