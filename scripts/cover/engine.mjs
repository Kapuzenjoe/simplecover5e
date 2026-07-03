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
 * Build one or more 3D occluder prisms for a creature token.
 * The prism shape depends on grid mode and token-shape settings (e.g., gridless circle uses an inscribed AABB).
 *
 * @param {TokenDocument} td The token document to build prisms for.
 * @param {CoverContext} ctx The cover evaluation context.
 * @param {DebugTokenShapes|null} [debugTokenShapes=null] Optional debug shape collector.
 * @returns {OccluderPrism[]} The occluder prisms in canvas pixel space.
 */
export function buildCreaturePrism(td, ctx, debugTokenShapes) {
  const { grid, halfGridSize, insetOccluderPx, distancePixels } = ctx;
  const elevation = Number(td?.elevation ?? 0);
  const zMin = elevation * distancePixels;
  let height = getCreatureHeight(td);

  const zMax = zMin + (height * distancePixels);
  const prisms = [];
  const radius = getTokenExternalRadius(td) ?? 0;
  const { x, y } = td.getCenterPoint();
  const insetToCenter = insetOccluderPx / Math.SQRT2;

  if ( grid.isGridless && isEllipse(td) ) {
    const innerHalf = radius / Math.SQRT2;
    const halfEff = Math.max(innerHalf, 0);

    prisms.push({
      maxX: x + halfEff - insetToCenter,
      maxY: y + halfEff - insetToCenter,
      maxZ: zMax - 0.1,
      minX: x - halfEff + insetToCenter,
      minY: y - halfEff + insetToCenter,
      minZ: zMin + 0.1
    });
  }
  else if ( grid.isHexagonal ) {
    const centers = td.getContainmentTestPoints({ depth: 0 });

    let halfCenter = Math.max(radius * 0.80, 0);

    if ( centers?.length > 1 ) {
      const halfNeighbor = Math.max(halfGridSize * 0.80, 0);
      halfCenter = Math.max(radius * 0.60, 0);
      for ( const c of centers ) {
        if ( (c.x === x) && (c.y === y) ) continue;
        prisms.push({
          maxX: c.x + halfNeighbor - insetToCenter,
          maxY: c.y + halfNeighbor - insetToCenter,
          maxZ: zMax - 0.1,
          minX: c.x - halfNeighbor + insetToCenter,
          minY: c.y - halfNeighbor + insetToCenter,
          minZ: zMin + 0.1
        });
      }
    }

    prisms.push({
      maxX: x + halfCenter - insetToCenter,
      maxY: y + halfCenter - insetToCenter,
      maxZ: zMax - 0.1,
      minX: x - halfCenter + insetToCenter,
      minY: y - halfCenter + insetToCenter,
      minZ: zMin + 0.1
    });
  }
  else {
    prisms.push({
      maxX: x + radius - insetToCenter,
      maxY: y + radius - insetToCenter,
      maxZ: zMax - 0.1,
      minX: x - radius + insetToCenter,
      minY: y - radius + insetToCenter,
      minZ: zMin + 0.1
    });
  }

  for ( const b of prisms ) {
    if ( !debugTokenShapes ) continue;

    debugTokenShapes.occluders.push([
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY },
      { x: b.minX, y: b.maxY }
    ]);
  }
  return prisms;
}

/* -------------------------------------------- */

/**
 * Evaluate DMG-style cover for an attacker against a target.
 * The evaluator tests rays against sight-blocking walls and creature occluder prisms and returns the best
 * (least blocked) sampling outcome.
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

  const boxes = new Map(blockingTokenDocs.map(td => [td.id, buildCreaturePrism(td, ctx, debugTokenShapes)]));

  const obstacleBehaviors = (ctx.scene?.regions?.contents ?? [])
    .flatMap(region => region.behaviors.contents)
    .filter(b => !b.disabled && (b.type === "simplecover5e.coverObstacle"))
    .map(b => b.system);

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
        let blockedWalls = 0;
        let blockedCreatures = 0;
        const segs = [];

        for ( const tCorner of tgtCorners ) {
          const wallResult = wallsBlock(aCorner, tCorner, ctx);
          const wBlocked = wallResult.blocked;

          const attacker = { x: aCorner.x, y: aCorner.y, z: attackerZ };
          const target = { x: tCorner.x, y: tCorner.y, z: targetZ };

          let cBlocked = false;
          let oBlocked = false;
          if ( !wBlocked ) {
            for ( const prisms of boxes.values() ) {
              for ( const b of prisms ) {
                if ( segIntersectsAABB3D(attacker, target, b) ) {
                  cBlocked = true;
                  break;
                }
              }
              if ( cBlocked ) break;
            }

            if ( !cBlocked ) {
              const segmentContext = { attackerToken: attackerDoc, targetToken: targetDoc };
              for ( const obstacle of obstacleBehaviors ) {
                if ( obstacle.blocksSegment(aCorner, tCorner, segmentContext) ) {
                  oBlocked = true;
                  break;
                }
              }
            }
          }

          const isBlocked = wBlocked || cBlocked || oBlocked;
          if ( isBlocked ) {
            if ( wBlocked ) blockedWalls += 1;
            else blockedCreatures += 1;
          }

          segs.push({
            cBlocked,
            oBlocked,
            wallResult,
            wBlocked,
            a: aCorner,
            b: tCorner,
            blocked: isBlocked
          });
        }

        const missingLines = Math.max(0, totalLines - tgtCorners.length);
        const filteredBlocked = filteredTargetPoints === "blocked" ? missingLines : 0;
        const activeLines = filteredTargetPoints === "dynamic" ? tgtCorners.length : totalLines;
        const threeQuartersThreshold = filteredTargetPoints === "dynamic"
          ? Math.max(1, Math.floor(tgtCorners.length * 0.75))
          : threshold;

        const totalBlocked = blockedWalls + blockedCreatures + filteredBlocked;
        const reachable = Math.max(0, activeLines - totalBlocked);

        let coverLevel;
        if ( creaturesHalfOnly ) {
          const effWalls = blockedWalls + filteredBlocked;
          if ( effWalls >= threeQuartersThreshold ) coverLevel = 2;
          else if ( effWalls >= 1 ) coverLevel = 1;
          else if ( blockedCreatures >= 1 ) coverLevel = 1;
          else coverLevel = 0;
        } else if ( totalBlocked >= threeQuartersThreshold ) coverLevel = 2;
        else if ( totalBlocked >= 1 ) coverLevel = 1;
        else coverLevel = 0;

        if ( (reachable > best.reachable) || ((reachable === best.reachable) && (coverLevel < best.coverLevel)) ) {
          best = { coverLevel, reachable, segs };
          if ( !debug && (coverLevel === 0) && (totalBlocked === 0) && (activeLines === totalLines) ) {
            const cover = "none";
            const bonus = COVER.BONUS[cover] || 0;
            return debug ? { bonus, cover, debugTokenShapes, debugSegments: best.segs } : { bonus, cover };
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
  const losPolygon = attackerDoc?.object?.vision?.los ?? null;

  if ( isWallHeightModuleActive() ) origin.elevation = (attackerDoc?.elevation ?? 0) + getCreatureHeight(attackerDoc);

  const targetTestPoints = targetDoc.getVisibilityTestPoints?.()
        ?? [{ elevation: targetDoc?.elevation ?? 0, x: targetDoc.x, y: targetDoc.y }];
  for ( const point of targetTestPoints ) point.level = targetDoc?.level ?? null;

  const targetLosPoints = [];
  let hasLOS = false;

  for ( const p of targetTestPoints ) {
    const wallResult = wallsBlock(origin, p, ctx, losPolygon);
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
 * Build inset box corners around a center point.
 * Each corner is moved by `insetPx` towards the center along the diagonal.
 *
 * @param {{ x: number, y: number }} center The box center in canvas pixels.
 * @param {number} radius Half of the box edge length in pixels.
 * @param {number} insetPx The inset distance in pixels towards the center.
 * @returns {{ x: number, y: number }[]} The corner points.
 */
function buildBoxCorners(center, radius, insetPx) {
  const { x: cx, y: cy } = center;
  const d = insetPx / Math.SQRT2;

  return [
    { x: cx - radius + d, y: cy - radius + d },
    { x: cx + radius - d, y: cy - radius + d },
    { x: cx + radius - d, y: cy + radius - d },
    { x: cx - radius + d, y: cy + radius - d }
  ];
}

/* -------------------------------------------- */

/**
 * Build a set of inset "corners" on the circumference of a circle.
 * Each point is moved by `insetPx` towards the center along the radius.
 *
 * @param {{ x: number, y: number }} center The circle center in canvas pixels.
 * @param {number} radius The circle radius in pixels.
 * @param {number} insetPx The inset distance in pixels towards the center.
 * @returns {{ x: number, y: number }[]} The points, clockwise from angle 0 degrees.
 */
function buildCircleCorners(center, radius, insetPx) {
  const { x: cx, y: cy } = center;
  const r = radius - insetPx;
  const k = Math.SQRT1_2;

  return [
    { x: cx + r, y: cy }, //   0°
    { x: cx + (r * k), y: cy + (r * k) }, //  45°
    { x: cx, y: cy + r }, //  90°
    { x: cx - (r * k), y: cy + (r * k) }, // 135°
    { x: cx - r, y: cy }, // 180°
    { x: cx - (r * k), y: cy - (r * k) }, // 225°
    { x: cx, y: cy - r }, // 270°
    { x: cx + (r * k), y: cy - (r * k) } // 315°
  ];
}

/* -------------------------------------------- */

/**
 * Build inset corners for a hex cell at a given center.
 * Each corner is moved by `insetPx` towards the center along the diagonal.
 *
 * @param {{ x: number, y: number }} center The hex cell center in canvas pixels.
 * @param {number} radius The effective hex radius in pixels.
 * @param {number} insetPx The inset distance in pixels.
 * @param {Grid} grid The current scene grid.
 * @returns {{ x: number, y: number }[]} The inset hex corner points.
 */
function buildHexCorners(center, radius, insetPx, grid) {
  const { x: cx, y: cy } = center;
  const verts = grid.getVertices(center);

  const scale = Math.min(1, (2 * radius) / grid.size);

  return verts.map(v => {
    const dx = v.x - cx;
    const dy = v.y - cy;
    const L = Math.hypot(dx, dy) || 1;

    return {
      x: cx + (dx * scale) - ((dx / L) * insetPx),
      y: cy + (dy * scale) - ((dy / L) * insetPx)
    };
  });
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
    corners = buildHexCorners(center, radius, inset, grid);
  }
  else if ( useCircleShape ) {
    corners = buildCircleCorners(center, radius, inset);
  }
  else corners = buildBoxCorners(center, radius, inset);

  corners.forEach(c => c.elevation = center?.elevation ?? 0);
  corners.forEach(c => c.level = center?.level ?? null);

  return constrainCoverTestPoints(corners, td);
}

/* -------------------------------------------- */

/**
 * Constrain cover-specific token test points against the token's movement area.
 *
 * This mirrors Foundry's protected `TokenDocument#_constrainTestPoints` for custom cover corners.
 *
 * @param {TestPoint[]} points The points to constrain. Modified in place.
 * @param {TokenDocument} td The token document whose movement constraints are applied.
 * @returns {TestPoint[]} The constrained points array.
 */
function constrainCoverTestPoints(points, td) {
  const level = td.parent?.levels.get(td.level);
  if ( !level ) return points;
  const origin = td.getMovementOrigin();

  if ( (points.length === 1) && (points[0].x === origin.x) && (points[0].y === origin.y)
        && ((points[0].elevation === undefined) || (points[0].elevation === origin.elevation)) ) {
    return points;
  }

  const { width, height } = td.getSize();
  const boundingBox = new PIXI.Rectangle(td.x, td.y, width, height);
  const polygon = foundry.canvas.geometry.ClockwiseSweepPolygon.create(origin, { boundingBox, level, type: "move" });
  const options = { level, mode: "any", type: "move" };
  for ( let i = points.length - 1; i >= 0; i-- ) {
    const point = points[i];
    if ( polygon.contains(point.x, point.y) && ((point.elevation === undefined)
            || !level.parent.testSurfaceCollision(origin, point, options)) ) continue;

    points[i] = points[points.length - 1];
    points.length--;
  }

  // If all test points are behind a wall/surface, the origin becomes the single test point.
  if ( !points.length ) points.push(origin);
  return points;
}

/* -------------------------------------------- */

/**
 * Test whether a 3D segment intersects a 3D axis-aligned bounding box (AABB).
 * This uses Liang–Barsky style clipping and rejects near-zero intersections using a small epsilon.
 *
 * @param {{ x: number, y: number, z: number }} p The segment start point.
 * @param {{ x: number, y: number, z: number }} q The segment end point.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number, minZ: number, maxZ: number }} b The AABB.
 * @returns {boolean} True if the segment intersects the AABB.
 */
function segIntersectsAABB3D(p, q, b) {
  let t0 = 0;
  let t1 = 1;

  const d = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z };

  /**
   * Clip the current segment interval against a single axis plane.
   * @param {number} pv The projected segment delta on the axis.
   * @param {number} qv The projected offset from the boundary.
   * @returns {boolean} True if the clipped interval still intersects the box.
   */
  function clip(pv, qv) {
    if ( pv === 0 ) return qv >= 0;
    const t = qv / pv;
    if ( pv < 0 ) {
      if ( t > t1 ) return false;
      if ( t > t0 ) t0 = t;
    } else {
      if ( t < t0 ) return false;
      if ( t < t1 ) t1 = t;
    }
    return true;
  }

  if ( !clip(-d.x, p.x - b.minX) ) return false;
  if ( !clip(d.x, b.maxX - p.x) ) return false;
  if ( !clip(-d.y, p.y - b.minY) ) return false;
  if ( !clip(d.y, b.maxY - p.y) ) return false;
  if ( !clip(-d.z, p.z - b.minZ) ) return false;
  if ( !clip(d.z, b.maxZ - p.z) ) return false;

  const EPS = 1e-3;
  return (t0 + EPS) < (t1 - EPS);
}

/* -------------------------------------------- */

/**
 * Test whether sight-blocking walls obstruct the segment between two positions.
 * If the Wall Height module is active, the intersection is additionally filtered by wall top and bottom values.
 *
 * @param {{ x: number, y: number, elevation: number, level?: string|null }} aCorner The attacker corner.
 * @param {{ x: number, y: number, elevation: number, level?: string|null }} bCorner The target corner.
 * @param {CoverContext} ctx The cover evaluation context.
 * @param {PIXI.Polygon|null} [losPolygon=null] A precomputed LOS polygon for the attacker, if available.
 * @returns {{ blocked: boolean, A: TestPoint, B: TestPoint, collisions?: object[] }} A result describing whether
 *   the tested segment is blocked.
 */
function wallsBlock(aCorner, bCorner, ctx, losPolygon=null) {
  const A = aCorner;
  const B = bCorner;
  const scene = ctx.scene ?? canvas?.scene;
  const backend = CONFIG.Canvas.polygonBackends.sight;

  let fromLevel = A?.level ?? ctx.level ?? null;
  if ( typeof fromLevel === "string" ) fromLevel = scene?.levels?.get(fromLevel) ?? null;

  let toLevel = B?.level ?? ctx.level ?? null;
  if ( typeof toLevel === "string" ) toLevel = scene?.levels?.get(toLevel) ?? null;

  toLevel ??= fromLevel;

  let tSplit = 1;

  if ( fromLevel && toLevel && (fromLevel !== toLevel) ) {
    const delta = (B.elevation ?? 0) - (A.elevation ?? 0);

    if ( delta !== 0 ) {
      let t00 = (fromLevel.elevation.bottom - A.elevation) / delta;
      let t01 = (fromLevel.elevation.top - A.elevation) / delta;
      if ( t00 > t01 ) [t00, t01] = [t01, t00];

      let t10 = (toLevel.elevation.bottom - A.elevation) / delta;
      let t11 = (toLevel.elevation.top - A.elevation) / delta;
      if ( t10 > t11 ) [t10, t11] = [t11, t10];

      tSplit = ((t11 > 0) && (t01 < t11)) ? Math.clamp(t01, t10, 1) : 1;
      if ( tSplit < 0 ) tSplit = 0;
    }
  }

  let blocked = false;
  let surfaceCollisionBlocked = false;
  let collisions = [];

  // Segment 1: source level
  if ( fromLevel && (tSplit > 0) ) {
    const tMin = 0;
    const tMax = tSplit;

    if ( losPolygon ) {
      const splitX = A.x + ((B.x - A.x) * tSplit);
      const splitY = A.y + ((B.y - A.y) * tSplit);

      const losBlocked = !losPolygon.contains(splitX, splitY);
      if ( losBlocked ) blocked = true;
    } else {

      const surfaceBlocked = scene?.testSurfaceCollision?.(A, B, {
        tMax,
        tMin,
        level: fromLevel,
        mode: "any",
        type: "sight"
      }) ?? false;
      surfaceCollisionBlocked ||= surfaceBlocked;

      let wallBlocked = false;
      if ( isWallHeightModuleActive() ) {
        const wallCollisions = backend.testCollision(A, B, {
          tMax,
          tMin,
          level: fromLevel,
          mode: "all",
          type: "sight",
          useThreshold: true
        }) ?? [];
        collisions.push(...wallCollisions);
        wallBlocked = wallCollisions.length > 0;
      }
      else {
        wallBlocked = backend.testCollision(A, B, {
          tMax,
          tMin,
          level: fromLevel,
          mode: "any",
          type: "sight",
          useThreshold: true
        }) ?? false;
      }

      if ( surfaceBlocked || wallBlocked ) blocked = true;
    }
  }

  // Segment 2: target level
  if ( !blocked && toLevel && (tSplit < 1) ) {
    const tMin = tSplit;
    const tMax = 1;

    const surfaceBlocked = scene?.testSurfaceCollision?.(A, B, {
      tMax,
      tMin,
      level: toLevel,
      mode: "any",
      type: "sight"
    }) ?? false;
    surfaceCollisionBlocked ||= surfaceBlocked;

    let wallBlocked = false;
    if ( isWallHeightModuleActive() ) {
      const wallCollisions = backend.testCollision(A, B, {
        tMax,
        tMin,
        level: toLevel,
        mode: "all",
        type: "sight",
        useThreshold: true
      }) ?? [];
      collisions.push(...wallCollisions);
      wallBlocked = wallCollisions.length > 0;
    }
    else {
      wallBlocked = backend.testCollision(A, B, {
        tMax,
        tMin,
        level: toLevel,
        mode: "any",
        type: "sight",
        useThreshold: true
      }) ?? false;
    }

    if ( surfaceBlocked || wallBlocked ) blocked = true;
  }

  if ( !isWallHeightModuleActive() || losPolygon || surfaceCollisionBlocked ) {
    return { A, B, blocked };
  }

  return wallHeightBlocks(A, B, collisions)
    ? { A, B, blocked: true }
    : { A, B, collisions, blocked: false };
}
