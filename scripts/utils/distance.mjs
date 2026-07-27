import { MODULE_ID, SETTING_KEYS } from "../config/constants.config.mjs";
import { getCreatureHeight, isV14 } from "../services/cover.service.mjs";
import { getTokenSampleCenters } from "../services/cover.engine.mjs";

/**
 * Measure the minimal 3D distance between two tokens in scene grid units.
 * Uses Foundry's grid measurement (including diagonal rules) and optionally adjusts distances in gridless modes.
 *
 * @param {Token|TokenDocument} sourceToken The source token or document.
 * @param {Token|TokenDocument} targetToken The target token or document.
 * @returns {number} The minimal distance in grid units, clamped to 0 or greater.
 */
export function measureTokenDistance(sourceToken, targetToken) {
  const sourceDoc = sourceToken.document ?? sourceToken;
  const targetDoc = targetToken.document ?? targetToken;

  const scene = sourceDoc.parent;
  const grid = scene.grid;
  const mode = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_DISTANCE_MODE) ?? "edgeToCenter";
  const sourceHeight = getCreatureHeight(sourceDoc);
  const targetHeight = getCreatureHeight(targetDoc);

  const sourceBottom = sourceDoc.elevation;
  const sourceTop = sourceDoc.elevation + sourceHeight;
  const targetBottom = targetDoc.elevation;
  const targetTop = targetDoc.elevation + targetHeight;

  let sourceElevation, targetElevation;
  if ((sourceBottom <= targetTop) && (targetBottom <= sourceTop)) {
    const shared = Math.max(sourceBottom, targetBottom);
    sourceElevation = targetElevation = shared;
  } else if (sourceBottom > targetTop) {
    sourceElevation = sourceBottom;
    targetElevation = targetTop;
  } else {
    sourceElevation = sourceTop;
    targetElevation = targetBottom;
  }

  let minDistance = Infinity;

  if (grid.isGridless && mode === "edgeEdge") {
    const distancePixels = scene?.dimensions?.distancePixels ?? 1;
    const sourceRadius = sourceDoc.object?.externalRadius ?? 0;
    const targetRadius = targetDoc.object?.externalRadius ?? 0;

    const sourceCenter = sourceDoc.getCenterPoint();
    const targetCenter = targetDoc.getCenterPoint();

    const externalAdjust = (sourceRadius + targetRadius) / distancePixels;
    const horizontal = grid.measurePath([
      { x: sourceCenter.x, y: sourceCenter.y },
      { x: targetCenter.x, y: targetCenter.y }
    ]).cost;
    const horizontalEdge = Math.max(0, horizontal - externalAdjust);
    const vertical = Math.abs(sourceElevation - targetElevation);
    minDistance = Math.hypot(horizontalEdge, vertical);
  }
  else {
    const sourceCenters = (isV14() ? sourceDoc.getContainmentTestPoints() : getTokenSampleCenters(sourceDoc))
      .map(point => ({ ...point, elevation: sourceElevation }));
    const targetCenters = (isV14() ? targetDoc.getContainmentTestPoints() : getTokenSampleCenters(targetDoc))
      .map(point => ({ ...point, elevation: targetElevation }));

    for (const s of sourceCenters) {
      for (const t of targetCenters) {
        const d = grid.measurePath([s, t]);
        if (d.cost < minDistance) minDistance = d.cost;
      }
    }
  }

  return minDistance === Infinity ? 0 : Math.max(0, minDistance.toNearest(0.01));
}
