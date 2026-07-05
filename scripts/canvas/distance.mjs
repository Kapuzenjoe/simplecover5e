import { MODULE_ID, SETTING_KEYS } from "../config.mjs";
import { getTokenExternalRadius } from "../cover/token.mjs";

/**
 * @import { Position } from "../_types.mjs";
 */

/**
 * Measure the minimal 3D distance between two tokens in scene grid units.
 * Uses Foundry's grid measurement (including diagonal rules) and optionally adjusts distances in gridless modes.
 *
 * @param {Token|TokenDocument|Position} sourceToken The source token, document, or a plain position (AoE origins).
 * @param {Token|TokenDocument|Position} targetToken The target token, document, or a plain position.
 * @returns {number} The minimal distance in grid units, clamped to 0 or greater.
 */
export function getTokenTokenDistance(sourceToken, targetToken) {
  const sourceDoc = sourceToken.document ?? sourceToken;
  const targetDoc = targetToken.document ?? targetToken;

  const scene = sourceDoc.parent ?? targetDoc.parent;
  const grid = scene.grid;
  const mode = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_DISTANCE_MODE) ?? "edgeToCenter";

  const sourceBottom = sourceDoc.elevation;
  const sourceTop = sourceDoc.elevation + ((sourceDoc.depth ?? 0) * grid.distance);
  const targetBottom = targetDoc.elevation;
  const targetTop = targetDoc.elevation + ((targetDoc.depth ?? 0) * grid.distance);

  let sourceElevation; let targetElevation;
  if ( (sourceBottom <= targetTop) && (targetBottom <= sourceTop) ) {
    const shared = Math.max(sourceBottom, targetBottom);
    sourceElevation = targetElevation = shared;
  } else if ( sourceBottom > targetTop ) {
    sourceElevation = sourceBottom;
    targetElevation = targetTop;
  } else {
    sourceElevation = sourceTop;
    targetElevation = targetBottom;
  }

  let minDistance = Infinity;

  if ( grid.isGridless && (mode === "edgeEdge") ) {
    const distancePixels = scene?.dimensions?.distancePixels ?? 1;
    const sourceRadius = getTokenExternalRadius(sourceDoc) ?? 0;
    const targetRadius = getTokenExternalRadius(targetDoc) ?? 0;

    const sourceCenter = sourceDoc.getCenterPoint?.() ?? { x: sourceDoc.x, y: sourceDoc.y };
    const targetCenter = targetDoc.getCenterPoint?.() ?? { x: targetDoc.x, y: targetDoc.y };

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
    const sourceCenters = (sourceDoc.getContainmentTestPoints?.() ?? [{ x: sourceDoc.x, y: sourceDoc.y }])
      .map(p => ({ ...p, elevation: sourceElevation }));
    const targetCenters = (targetDoc.getContainmentTestPoints?.() ?? [{ x: targetDoc.x, y: targetDoc.y }])
      .map(p => ({ ...p, elevation: targetElevation }));

    for ( const s of sourceCenters ) {
      for ( const t of targetCenters ) {
        const d = grid.measurePath([s, t]);
        if ( d.cost < minDistance ) minDistance = d.cost;
      }
    }
  }

  return minDistance === Infinity ? 0 : Math.max(0, minDistance.toNearest(0.01));
}
