import { MODULE_ID, SETTING_KEYS } from "../config/constants.config.mjs";
import { getCreatureHeight } from "../services/cover.service.mjs";

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
  const grid = scene.grid;

  const sourceHeight = getCreatureHeight(sourceDoc);
  const targetHeight = getCreatureHeight(targetDoc);
  const sourceCenter = sourceDoc.getCenterPoint();
  const targetCenter = targetDoc.getCenterPoint();

  let minDistance = Infinity;

  const sourcePoints = [
    { x: sourceCenter.x, y: sourceCenter.y, elevation: sourceCenter.elevation },
    { x: sourceCenter.x, y: sourceCenter.y, elevation: sourceCenter.elevation + sourceHeight },
  ];

  const targetsPoints = [
    { x: targetCenter.x, y: targetCenter.y, elevation: targetCenter.elevation },
    { x: targetCenter.x, y: targetCenter.y, elevation: targetCenter.elevation + targetHeight },
  ];

  for (const s of sourcePoints) {
    for (const t of targetsPoints) {
      const d = grid.measurePath([s, t]).distance;
      if (d < minDistance) minDistance = d;
    }
  }

  let result = minDistance

  if (grid.isGridless) {
    const mode = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_DISTANCE_MODE) ?? "edgeToCenter";

    if (mode === "edgeEdge" || mode === "edgeToCenter") {
      const distancePixels = scene?.dimensions?.distancePixels ?? 1;
      const sourceRadius = sourceDoc.object?.externalRadius ?? 0;
      const targetRadius = targetDoc.object?.externalRadius ?? 0;

      if (mode === "edgeEdge") {
        const externalAdjust = (sourceRadius + targetRadius) / distancePixels;
        result = result - externalAdjust;
      }
      else if (mode === "edgeToCenter") {
        const externalAdjust = sourceRadius / distancePixels;
        result = result - externalAdjust;
      }
    }
  }
  result = Math.round(result * 10) / 10 || 0;

  return result < 0 ? 0 : result;
}
