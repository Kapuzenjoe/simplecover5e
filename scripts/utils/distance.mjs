import { MODULE_ID, SETTING_KEYS } from "../config/constants.config.mjs";
import { getCreatureHeight, isV14 } from "../services/cover.service.mjs";
import { getTokenSampleCenters } from "../services/cover.engine.mjs";

/**
 * Measure the minimal 3D distance between two tokens in scene grid units.
 * Uses Foundry's grid measurement (including diagonal rules) and optionally adjusts distances in gridless modes.
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
  const mode = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_DISTANCE_MODE) ?? "edgeToCenter";

  let minDistance = Infinity;

  if (grid.isGridless && mode === "edgeEdge") {
    const distancePixels = scene?.dimensions?.distancePixels ?? 1;
    const sourceRadius = sourceDoc.object?.externalRadius ?? 0;
    const targetRadius = targetDoc.object?.externalRadius ?? 0;

    const sourceCenter = sourceDoc.getCenterPoint();
    const targetCenter = targetDoc.getCenterPoint();

    const sourceCenters = [
      { ...sourceCenter, elevation: getCreatureHeight(sourceDoc) },
      { ...sourceCenter }
    ];

    const targetCenters = [
      { ...targetCenter, elevation: getCreatureHeight(targetDoc) },
      { ...targetCenter }
    ];

    for (const s of sourceCenters) {
      for (const t of targetCenters) {
        const d = grid.measurePath([s, t]);
        if (d.cost < minDistance) minDistance = d.cost;
      }
    }

    const externalAdjust = (sourceRadius + targetRadius) / distancePixels;
    minDistance = minDistance - externalAdjust;
  }
  else {
    let sourceCenters = isV14() ? sourceDoc.getContainmentTestPoints() : getTokenSampleCenters(sourceDoc);
    let targetCenters = isV14() ? targetDoc.getContainmentTestPoints() : getTokenSampleCenters(targetDoc);

    if (isV14()) {
      sourceCenters = sourceCenters.flatMap(point => [
        { ...point, elevation: getCreatureHeight(sourceDoc) },
        { ...point, elevation: sourceDoc.elevation }
      ]);
      targetCenters = targetCenters.flatMap(point => [
        { ...point, elevation: getCreatureHeight(targetDoc) },
        { ...point, elevation: targetDoc.elevation }
      ]);
    }

    for (const s of sourceCenters) {
      for (const t of targetCenters) {
        const d = grid.measurePath([s, t]);
        if (d.cost < minDistance) minDistance = d.cost;
      }
    }
  }

  minDistance = Math.round(minDistance * 100) / 100 || 0;
  return minDistance < 0 ? 0 : minDistance;
}
