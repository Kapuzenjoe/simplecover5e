/**
 * @import {
 *   CoverContext,
 *   CoverEvaluationResult,
 *   DebugTokenShapes,
 *   LosResult,
 *   OccluderPrism,
 *   Position,
 *   TestPoint
 * } from "../_types.mjs";
 */

import { MODULE_ID, COVER, SETTING_KEYS } from "../config.mjs";
import { isWallHeightModuleActive, wallHeightBlocks } from "../integrations/wall-height.mjs";

import { getTokenExternalRadius, isBlockingCreatureToken, getCreatureHeight, isEllipse, applyProneMode } from "./token.mjs";

/**
 * Build a cover evaluation context for a single pass.
 * The context caches grid measurements and module settings used by the cover and LOS evaluators.
 *
 * @param {Scene} scene The scene to evaluate.
 * @returns {CoverContext} The cover evaluation context.
 */
export function buildCoverContext(scene) {
  const grid = scene.grid;
  const halfGridSize = grid.size / 2;
  const distancePixels = scene?.dimensions?.distancePixels ?? 1;
  const activeScene = scene === canvas?.scene;

  const insetAttacker = Number(game.settings.get(MODULE_ID, SETTING_KEYS.INSET_ATTACKER) ?? 0);
  const insetTarget = Number(game.settings.get(MODULE_ID, SETTING_KEYS.INSET_TARGET) ?? 0);
  const insetOccluder = Number(game.settings.get(MODULE_ID, SETTING_KEYS.INSET_OCCLUDER) ?? 0);

  return {
    distancePixels,
    grid,
    halfGridSize,
    scene,
    insetAttackerPx: Math.min(grid.size * 0.3, insetAttacker),
    insetOccluderPx: Math.min(grid.size * 0.3, insetOccluder),
    insetTargetPx: Math.min(grid.size * 0.3, insetTarget),
    level: activeScene ? (canvas?.level ?? null) : null
  };
}

/* -------------------------------------------- */

/**
 * Build the 3D occluder prism for a creature token.
 * The prism shape depends on grid mode and token-shape settings.
 *
 * @param {TokenDocument} td The token document to build prisms for.
 * @param {CoverContext} ctx The cover evaluation context.
 * @param {DebugTokenShapes|null} [debugTokenShapes=null] Optional debug shape collector.
 * @returns {OccluderPrism} The occluder prism in canvas pixel space.
 */
export function buildCreaturePrism(td, ctx, debugTokenShapes) {
  const { grid, insetOccluderPx, distancePixels } = ctx;
  const elevation = Number(td?.elevation ?? 0);
  const zMin = elevation * distancePixels;
  const zMax = zMin + (getCreatureHeight(td) * distancePixels);
  const { x, y } = td.getCenterPoint();

  let shape;

  if ( grid.isGridless ) {
    if ( isEllipse(td) ) {
      const radius = Math.max((getTokenExternalRadius(td) ?? 0) - insetOccluderPx, 0);
      shape = new PIXI.Circle(x, y, radius).toPolygon();
    }
    else {
      const { width, height } = td.getSize();
      const inset = insetOccluderPx / Math.SQRT2;
      const w = Math.max(width - (2 * inset), 0);
      const h = Math.max(height - (2 * inset), 0);
      shape = new PIXI.Rectangle(x - (w / 2), y - (h / 2), w, h).toPolygon();
    }
  }
  else {
    const points = td.getGridSpacePolygon().map(p => ({ x: p.x + td.x, y: p.y + td.y }));
    const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    shape = new PIXI.Polygon(points.map(p => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const L = Math.hypot(dx, dy) || 1;
      return { x: p.x - ((dx / L) * insetOccluderPx), y: p.y - ((dy / L) * insetOccluderPx) };
    }));
  }

  const prism = { polygon: shape, minZ: zMin + 0.1, maxZ: zMax - 0.1 };

  if ( debugTokenShapes ) {
    debugTokenShapes.occluders.push(polygonToPoints(shape));
  }
  return prism;
}

/* -------------------------------------------- */

/**
 * Evaluate DMG-style cover for an attacker against a target.
 * The evaluator tests Cover Lines against sight-blocking walls, creature occluder prisms, and Region
 * Obstacle behaviors, and returns the best (least blocked) sampling outcome.
 *
 * @param {TokenDocument|Position} attackerDoc The attacking token document or a generic position.
 * @param {TokenDocument} targetDoc The target token document.
 * @param {CoverContext} ctx The cover evaluation context.
 * @param {{ debug?: boolean }} [options] Optional flags, such as debug output.
 * @returns {CoverEvaluationResult} The cover result and optional debug data.
 */
export function evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, options={}) {
  const debug = !!options.debug;
  const debugTokenShapes = debug ? { attacker: [], occluders: [], target: [] } : null;
  const { grid, distancePixels, insetAttackerPx, insetTargetPx } = ctx;
  const creaturesHalfOnly = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.CREATURES_HALF_ONLY);
  const filteredTargetPoints = game.settings?.get?.(MODULE_ID, SETTING_KEYS.FILTERED_TARGET_POINTS) ?? "blocked";
  const ignoreFriendly = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.IGNORE_FRIENDLY);

  const tokenDocs = ctx.scene?.tokens?.contents ?? [];
  const blockingTokenDocs = tokenDocs.filter(td => {
    return (td.id !== attackerDoc?.id)
        && (td.id !== targetDoc?.id)
        && (!ignoreFriendly || (attackerDoc?.disposition !== td?.disposition))
        && isBlockingCreatureToken(td);
  }
  );

  const occluderPrisms = new Map(blockingTokenDocs.map(td => [td.id, buildCreaturePrism(td, ctx, debugTokenShapes)]));

  const obstacleBehaviors = (ctx.scene?.regions?.contents ?? [])
    .flatMap(region => region.behaviors.contents)
    .filter(b => !b.disabled && (b.type === "simplecover5e.coverObstacle"))
    .map(b => b.system);
  const obstacleResults = obstacleBehaviors.map(obstacle => ({
    obstacle,
    tokenResult: obstacle.evaluateTokens(attackerDoc, targetDoc)
  }));

  const attackerVisionSource = applyProneMode(
    attackerDoc,
    attackerDoc?.getVisionOrigin?.()?.elevation ?? (attackerDoc?.elevation ?? 0)
  );
  const targetVisionSource = applyProneMode(
    targetDoc,
    targetDoc?.getVisionOrigin?.()?.elevation ?? (targetDoc?.elevation ?? 0)
  );
  const attackerSamples = attackerDoc?.getContainmentTestPoints?.()
        ?? [{ x: attackerDoc.x, y: attackerDoc.y }];
  const targetSamples = targetDoc?.getContainmentTestPoints?.()
        ?? [{ x: targetDoc.x, y: targetDoc.y }];
  const attackerCenterPoint = attackerDoc?.getCenterPoint?.() ?? null;
  const targetCenterPoint = targetDoc?.getCenterPoint?.() ?? null;

  const prepareSamples = (samples, doc, elevation, centerPoint) => {
    const size = doc?.width;
    const removeCenter = centerPoint
            && (doc?.width === doc?.height)
            && Number.isInteger(size)
            && ((size % 2) === 0)
            && (size >= 2);

    return samples
      .filter(point => !removeCenter || !((point.x === centerPoint.x) && (point.y === centerPoint.y)))
      .map(point => ({
        ...point,
        elevation,
        level: doc?.level ?? ctx.level ?? null
      }));
  };

  const preparedAttackerSamples = prepareSamples(
    attackerSamples, attackerDoc, attackerVisionSource, attackerCenterPoint
  );
  const preparedTargetSamples = prepareSamples(targetSamples, targetDoc, targetVisionSource, targetCenterPoint);

  const attackerZ = (attackerVisionSource * distancePixels) + 0.1;
  const targetZ = (targetVisionSource * distancePixels) + 0.1;

  let best = { coverLevel: 2, reachable: -1, segs: [] };
  const totalLines = grid.isHexagonal ? 6 : (grid.isGridless && isEllipse(targetDoc) ? 8 : 4);
  const threshold = grid.isHexagonal ? 4 : (grid.isGridless && isEllipse(targetDoc) ? 6 : 3);

  for ( const tCenter of preparedTargetSamples ) {
    const tgtCorners = buildTokenCornersForCenter(tCenter, ctx, targetDoc, insetTargetPx);
    if ( !tgtCorners || !tgtCorners.length ) continue;

    if ( debugTokenShapes ) debugTokenShapes.target.push(tgtCorners);

    for ( const aCenter of preparedAttackerSamples ) {
      const atkCorners = buildTokenCornersForCenter(aCenter, ctx, attackerDoc, insetAttackerPx);
      if ( !atkCorners || !atkCorners.length ) continue;

      if ( debugTokenShapes ) debugTokenShapes.attacker.push(atkCorners);

      for ( const aCorner of atkCorners ) {
        let halfLines = 0;
        let threeQuartersLines = 0;
        const segs = [];

        for ( const tCorner of tgtCorners ) {
          const wallResult = wallsBlock(aCorner, tCorner, ctx);
          const attacker = { x: aCorner.x, y: aCorner.y, z: attackerZ };
          const target = { x: tCorner.x, y: tCorner.y, z: targetZ };

          let lineCover = "none";
          if ( wallResult.blocked ) {
            lineCover = "threeQuarters";
          } else {
            let creatureBlocked = false;
            for ( const prism of occluderPrisms.values() ) {
              if ( segIntersectsPolygonPrism(attacker, target, prism) ) { creatureBlocked = true; break; }
            }
            if ( creatureBlocked ) lineCover = creaturesHalfOnly ? "half" : "threeQuarters";

            for ( const { obstacle, tokenResult } of obstacleResults ) {
              if ( lineCover === "threeQuarters" ) break;
              const obstacleResult = tokenResult ?? obstacle.blocksLine(aCorner, tCorner);
              if ( obstacleResult.blocked && (COVER.ORDER[obstacleResult.cover] > COVER.ORDER[lineCover]) ) {
                lineCover = obstacleResult.cover;
              }
            }
          }

          if ( lineCover === "half" ) halfLines += 1;
          else if ( lineCover === "threeQuarters" ) threeQuartersLines += 1;

          segs.push({ lineCover, wallResult, a: aCorner, b: tCorner, blocked: lineCover !== "none" });
        }

        const missingLines = Math.max(0, totalLines - tgtCorners.length);
        const filteredBlocked = filteredTargetPoints === "blocked" ? missingLines : 0;
        threeQuartersLines += filteredBlocked;

        const activeLines = filteredTargetPoints === "dynamic" ? tgtCorners.length : totalLines;
        const threeQuartersThreshold = filteredTargetPoints === "dynamic"
          ? Math.max(1, Math.floor(tgtCorners.length * 0.75))
          : threshold;

        const reachable = Math.max(0, activeLines - halfLines - threeQuartersLines);
        const coverLevel = threeQuartersLines >= threeQuartersThreshold
          ? 2 : ((halfLines + threeQuartersLines) >= 1 ? 1 : 0);

        if ( (reachable > best.reachable) || ((reachable === best.reachable) && (coverLevel < best.coverLevel)) ) {
          best = { coverLevel, reachable, segs };
          if ( !debug && (coverLevel === 0) && (activeLines === totalLines) ) {
            const cover = "none";
            const bonus = COVER.BONUS[cover] || 0;
            return { bonus, cover };
          }
        }
      }
    }
  }

  const cover = best.coverLevel === 2 ? "threeQuarters" : (best.coverLevel === 1 ? "half" : "none");
  const bonus = COVER.BONUS[cover] || 0;
  return debug ? { bonus, cover, debugTokenShapes, debugSegments: best.segs } : { bonus, cover };
}

/* -------------------------------------------- */

/**
 * Evaluate whether an attacker has line of sight (LOS) to a target, considering walls only.
 * The test samples target visibility points and reports which points are blocked.
 *
 * @param {TokenDocument|Position} attackerDoc The attacking token document or a generic position.
 * @param {TokenDocument} targetDoc The target token document.
 * @param {CoverContext} ctx The cover evaluation context.
 * @returns {LosResult} The LOS result and sampled target points.
 */
export function evaluateLOS(attackerDoc, targetDoc, ctx) {
  if ( !attackerDoc || !targetDoc ) return { hasLOS: true, targetLosPoints: [] };
  const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);

  const origin = attackerDoc.getVisionOrigin?.() ?? attackerDoc.getCenterPoint?.() ?? {
    elevation: attackerDoc?.elevation ?? 0,
    level: attackerDoc?.level ?? null,
    x: attackerDoc.x,
    y: attackerDoc.y
  };

  origin.elevation ??= attackerDoc?.elevation ?? 0;
  origin.level ??= attackerDoc?.level ?? ctx.level ?? null;

  if ( isWallHeightModuleActive() ) origin.elevation = (attackerDoc?.elevation ?? 0) + getCreatureHeight(attackerDoc);

  const targetTestPoints = targetDoc.getVisibilityTestPoints?.()
        ?? [{ elevation: targetDoc?.elevation ?? 0, x: targetDoc.x, y: targetDoc.y }];
  for ( const point of targetTestPoints ) point.level = targetDoc?.level ?? null;

  const targetLosPoints = [];
  let hasLOS = false;

  for ( const p of targetTestPoints ) {
    const wallResult = wallsBlock(origin, p, ctx);
    targetLosPoints.push({ blocked: wallResult.blocked, x: p.x, y: p.y });

    if ( !wallResult.blocked ) {
      hasLOS = true;
      if ( !debugOn ) break;
    }
  }

  return {
    hasLOS,
    targetLosPoints
  };
}

/* -------------------------------------------- */

/**
 * Build token test points for a sample center based on grid mode and token shape.
 *
 * @param {TestPoint} center The sample center in canvas pixels.
 * @param {CoverContext} ctx The cover evaluation context.
 * @param {TokenDocument|Position} td The token document or position being sampled.
 * @param {number} inset The inset distance in pixels.
 * @returns {TestPoint[]} The test points for this center.
 */
function buildTokenCornersForCenter(center, ctx, td, inset) {
  const { halfGridSize, grid } = ctx;
  const useCircleShape = grid.isGridless && isEllipse(td);

  const externalRadius = getTokenExternalRadius(td);
  if ( externalRadius === null ) {
    return [{
      elevation: center?.elevation ?? 0,
      level: center?.level ?? null,
      x: center?.x,
      y: center?.y
    }];
  }

  const radius = (externalRadius < halfGridSize) ? externalRadius : halfGridSize;

  let corners = [];
  if ( grid.isHexagonal ) {
    const scale = Math.min(1, (2 * radius) / grid.size);
    corners = grid.getShape().map(v => {
      const L = Math.hypot(v.x, v.y) || 1;
      return {
        x: center.x + (v.x * scale) - ((v.x / L) * inset),
        y: center.y + (v.y * scale) - ((v.y / L) * inset)
      };
    });
  }
  else if ( useCircleShape ) {
    const r = Math.max(radius - inset, 0);
    corners = polygonToPoints(new PIXI.Circle(center.x, center.y, r).toPolygon({ density: 8 }));
  }
  else {
    const d = inset / Math.SQRT2;
    const side = Math.max((radius * 2) - (2 * d), 0);
    corners = polygonToPoints(new PIXI.Rectangle(center.x - radius + d, center.y - radius + d, side, side).toPolygon());
  }

  corners.forEach(c => c.elevation = center?.elevation ?? 0);
  corners.forEach(c => c.level = center?.level ?? null);

  td._constrainTestPoints(corners, {});
  return corners;
}

/* -------------------------------------------- */

/**
 * Convert a PIXI.Polygon's flat point list into an array of point objects.
 *
 * @param {PIXI.Polygon} polygon The polygon to read points from.
 * @returns {{ x: number, y: number }[]} The polygon's corner points.
 */
function polygonToPoints(polygon) {
  const points = [];
  for ( let i = 0; i < polygon.points.length; i += 2 ) points.push({ x: polygon.points[i], y: polygon.points[i + 1] });
  return points;
}

/* -------------------------------------------- */

/**
 * Test whether a 3D segment intersects a vertically extruded polygon prism.
 * Clips the segment to the prism's elevation band, then tests the reduced 2D segment against the polygon.
 *
 * @param {{ x: number, y: number, z: number }} p The segment start point.
 * @param {{ x: number, y: number, z: number }} q The segment end point.
 * @param {{ polygon: PIXI.Polygon, minZ: number, maxZ: number }} prism The polygon prism.
 * @returns {boolean} True if the segment intersects the prism.
 */
function segIntersectsPolygonPrism(p, q, prism) {
  const { polygon, minZ, maxZ } = prism;
  let a = p;
  let b = q;

  if ( p.z !== q.z ) {
    const t1 = (minZ - p.z) / (q.z - p.z);
    const t2 = (maxZ - p.z) / (q.z - p.z);
    const tLo = Math.max(0, Math.min(t1, t2));
    const tHi = Math.min(1, Math.max(t1, t2));
    if ( tLo > tHi ) return false;
    a = { x: Math.mix(p.x, q.x, tLo), y: Math.mix(p.y, q.y, tLo) };
    b = { x: Math.mix(p.x, q.x, tHi), y: Math.mix(p.y, q.y, tHi) };
  }
  else if ( (p.z < minZ) || (p.z > maxZ) ) return false;

  if ( polygon.contains(a.x, a.y) || polygon.contains(b.x, b.y) ) return true;

  const pts = polygon.points;
  for ( let i = 0; i < pts.length; i += 2 ) {
    const edgeA = { x: pts[i], y: pts[i + 1] };
    const edgeB = { x: pts[(i + 2) % pts.length], y: pts[(i + 3) % pts.length] };
    if ( foundry.utils.lineSegmentIntersection(a, b, edgeA, edgeB) ) return true;
  }
  return false;
}

/* -------------------------------------------- */

/**
 * Compute the ray parameter at which sight testing switches from the source Level's walls to the target
 * Level's walls, matching Foundry's own multi-Level sight-splitting behavior.
 *
 * @param {TestPoint} A The segment start point.
 * @param {TestPoint} B The segment end point.
 * @param {Level|null} fromLevel The Level containing A.
 * @param {Level|null} toLevel The Level containing B.
 * @returns {number} The t-value (0-1) at which the source segment ends and the target segment begins.
 */
// Mirrors Foundry's private DetectionMode#getIntermediateTValue — no public equivalent exists.
function getLevelSplitT(A, B, fromLevel, toLevel) {
  if ( !fromLevel || !toLevel || (fromLevel === toLevel) ) return 1;

  const delta = (B.elevation ?? 0) - (A.elevation ?? 0);
  let t00, t01, t10, t11;

  if ( delta !== 0 ) {
    t00 = (fromLevel.elevation.bottom - A.elevation) / delta;
    t01 = (fromLevel.elevation.top - A.elevation) / delta;
    if ( t00 > t01 ) [t00, t01] = [t01, t00];

    t10 = (toLevel.elevation.bottom - A.elevation) / delta;
    t11 = (toLevel.elevation.top - A.elevation) / delta;
    if ( t10 > t11 ) [t10, t11] = [t11, t10];
  } else {
    t00 = fromLevel.elevation.bottom <= A.elevation ? -Infinity : Infinity;
    t01 = fromLevel.elevation.top >= A.elevation ? Infinity : -Infinity;
    t10 = toLevel.elevation.bottom <= A.elevation ? -Infinity : Infinity;
    t11 = toLevel.elevation.top >= A.elevation ? Infinity : -Infinity;
  }

  // The ray never reaches the target Level: test the source Level only.
  if ( (t10 > 1) || (t11 < 0) ) return 1;

  // The ray is never within the source Level: test the target Level only.
  if ( (t00 > 1) || (t01 < 0) ) return 0;

  // The ray leaves the target Level before it leaves the source Level: test the source Level only.
  t01 = Math.min(t01, 1);
  t11 = Math.min(t11, 1);
  if ( t01 > t11 ) return 1;

  // The ray enters the target Level before it enters the source Level: test the target Level only.
  t00 = Math.max(t00, 0);
  t10 = Math.max(t10, 0);
  if ( t00 > t10 ) return 0;

  // Otherwise split where the ray leaves the source Level and enters the target Level.
  return Math.max(t01, t10);
}

/* -------------------------------------------- */

/**
 * Test whether sight-blocking walls or surfaces obstruct one ray segment within a single Level.
 * If the Wall Height module is active, wall collisions are additionally filtered by wall top/bottom values.
 *
 * @param {TestPoint} A The segment start point.
 * @param {TestPoint} B The segment end point.
 * @param {CoverContext} ctx The cover evaluation context.
 * @param {Level|null} level The Level to test walls and surfaces against.
 * @param {number} tMin The ray parameter marking the start of the segment.
 * @param {number} tMax The ray parameter marking the end of the segment.
 * @returns {{ blocked: boolean, surfaceBlocked: boolean, collisions: object[] }} The segment test result.
 */
function testSightSegment(A, B, ctx, level, tMin, tMax) {
  const scene = ctx.scene ?? canvas?.scene;
  const backend = CONFIG.Canvas.polygonBackends.sight;

  const surfaceBlocked = scene?.testSurfaceCollision?.(A, B, {
    tMax,
    tMin,
    level,
    mode: "any",
    type: "sight"
  }) ?? false;

  let wallBlocked = false;
  let collisions = [];
  if ( isWallHeightModuleActive() ) {
    collisions = backend.testCollision(A, B, {
      tMax,
      tMin,
      level,
      mode: "all",
      type: "sight",
      edgeTypes: { source: false },
      useThreshold: true
    }) ?? [];
    wallBlocked = collisions.length > 0;
  }
  else {
    wallBlocked = backend.testCollision(A, B, {
      tMax,
      tMin,
      level,
      mode: "any",
      type: "sight",
      edgeTypes: { source: false },
      useThreshold: true
    }) ?? false;
  }

  return { blocked: surfaceBlocked || wallBlocked, surfaceBlocked, collisions };
}

/* -------------------------------------------- */

/**
 * Test whether sight-blocking walls obstruct the segment between two positions.
 * If the Wall Height module is active, the intersection is additionally filtered by wall top and bottom values.
 *
 * @param {{ x: number, y: number, elevation: number, level?: string|null }} aCorner The attacker corner.
 * @param {{ x: number, y: number, elevation: number, level?: string|null }} bCorner The target corner.
 * @param {CoverContext} ctx The cover evaluation context.
 * @returns {{ blocked: boolean, A: TestPoint, B: TestPoint, collisions?: object[] }} A result describing whether
 *   the tested segment is blocked.
 */
function wallsBlock(aCorner, bCorner, ctx) {
  const A = aCorner;
  const B = bCorner;
  const scene = ctx.scene ?? canvas?.scene;

  let fromLevel = A?.level ?? ctx.level ?? null;
  if ( typeof fromLevel === "string" ) fromLevel = scene?.levels?.get(fromLevel) ?? null;

  let toLevel = B?.level ?? ctx.level ?? null;
  if ( typeof toLevel === "string" ) toLevel = scene?.levels?.get(toLevel) ?? null;

  toLevel ??= fromLevel;

  const tSplit = getLevelSplitT(A, B, fromLevel, toLevel);

  let blocked = false;
  let surfaceCollisionBlocked = false;
  let collisions = [];

  // Segment 1: source level
  if ( fromLevel && (tSplit > 0) ) {
    const segment = testSightSegment(A, B, ctx, fromLevel, 0, tSplit);
    surfaceCollisionBlocked ||= segment.surfaceBlocked;
    collisions.push(...segment.collisions);
    if ( segment.blocked ) blocked = true;
  }

  // Segment 2: target level
  if ( !blocked && toLevel && (tSplit < 1) ) {
    const segment = testSightSegment(A, B, ctx, toLevel, tSplit, 1);
    surfaceCollisionBlocked ||= segment.surfaceBlocked;
    collisions.push(...segment.collisions);
    if ( segment.blocked ) blocked = true;
  }

  if ( !isWallHeightModuleActive() || surfaceCollisionBlocked ) {
    return { A, B, blocked };
  }

  return wallHeightBlocks(A, B, collisions)
    ? { A, B, blocked: true }
    : { A, B, collisions, blocked: false };
}
