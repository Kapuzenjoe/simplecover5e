import { MODULE_ID, COVER, COVER_OBSTACLE_TYPE, SETTING_KEYS } from "../config.mjs";
import { isWallHeightModuleActive } from "../integrations/wall-height.mjs";

import {
  applyProneMode, getCreatureHeight, getTokenExternalRadius, isBlockingCreatureToken, isEllipse
} from "../utils.mjs";

/**
 * @import {
 *   CoverEvaluationResult,
 *   CoverLevel,
 *   DebugTokenShapes,
 *   LosResult,
 *   OccluderPrism,
 *   Position
 * } from "../_types.mjs";
 */

/**
 * Evaluates DMG-style cover and line of sight (LOS) of a target against an attacker on one scene.
 * The cover evaluation tests Cover Lines against walls, creature occluder prisms, and Region Obstacle behaviors,
 * and returns the best (least blocked) sampling outcome.
 */
export default class CoverEvaluation {

  /** @type {TokenDocument5e|Position} The attacking token document or a generic position. */
  #attacker;

  /** @type {number} The elevation of the attacker's vision origin, resolved once because it reads the prone
   *  setting. */
  #attackerVisionElevation;

  /** @type {"creature"|"region"|"wall"|null} The blocking element of the most recent Cover Line. */
  #blocker = null;

  /** @type {Map<string, OccluderPrism>} The creature prisms by token id. */
  #creaturePrisms;

  /** @type {DebugTokenShapes|null} The debug geometry collected during the evaluation, if debugging. */
  #debugShapes;

  /** @type {object[]} The Cover Obstacle behaviors of the scene and their results for the pair. */
  #regionObstacles;

  /** @type {Scene} The scene on which cover is evaluated. */
  #scene;

  /** @type {object} The module settings, read once per evaluation. */
  #settings;

  /** @type {TokenDocument} The target token document. */
  #target;

  /** @type {number} The elevation of the bottom of the target, or of its vision origin if it has no height,
   *  resolved once because it reads the prone setting. */
  #targetBottom;

  /** @type {number} The creature height of the target in grid distance units, resolved once because it reads the
   *  prone setting. */
  #targetHeight;

  /* -------------------------------------------- */

  /**
   * @param {TokenDocument5e|Position} attackerDoc The attacking token document or a generic position.
   * @param {TokenDocument} targetDoc The target token document.
   * @param {Scene} scene The scene on which both are evaluated.
   * @param {object} [options={}]
   * @param {boolean|null} [options.debug=null] Whether to collect debug geometry and test every LOS point.
   *   Null uses the module debug setting.
   */
  constructor(attackerDoc, targetDoc, scene, { debug=null }={}) {
    const { grid } = scene;
    const get = key => game.settings.get(MODULE_ID, key);
    const maxInset = grid.size * 0.3;

    this.#attacker = attackerDoc;
    this.#target = targetDoc;
    this.#scene = scene;
    this.#debugShapes = (debug ?? !!get(SETTING_KEYS.DEBUG)) ? { attacker: [], occluders: [], target: [] } : null;
    this.#settings = {
      creatureCover: get(SETTING_KEYS.CREATURE_COVER),
      filteredTargetPoints: get(SETTING_KEYS.FILTERED_TARGET_POINTS) ?? "blocked",
      ignoreFriendly: !!get(SETTING_KEYS.IGNORE_FRIENDLY),
      insetAttacker: Math.clamp(Number(get(SETTING_KEYS.INSET_ATTACKER) ?? 0), 1, maxInset),
      insetOccluder: Math.min(maxInset, Number(get(SETTING_KEYS.INSET_OCCLUDER) ?? 0)),
      insetTarget: Math.clamp(Number(get(SETTING_KEYS.INSET_TARGET) ?? 0), 1, maxInset),
      wallCover: get(SETTING_KEYS.WALL_COVER),
      wallType: get(SETTING_KEYS.WALL_COVER_TYPE)
    };

    this.#attackerVisionElevation = resolveVisionElevation(attackerDoc);
    this.#targetHeight = getCreatureHeight(targetDoc);
    this.#targetBottom = this.#targetHeight ? Number(targetDoc?.elevation ?? 0) : resolveVisionElevation(targetDoc);
  }

  /* -------------------------------------------- */

  /**
   * The pixel-to-distance scale of the scene.
   * @type {number}
   */
  get #distancePixels() {
    return this.#scene.dimensions?.distancePixels ?? 1;
  }

  /* -------------------------------------------- */

  /**
   * The Level assumed for positions without one: the viewed Level of the active scene, otherwise the initial Level
   * of the scene.
   * @type {Level|null}
   */
  get #level() {
    return ((this.#scene === canvas?.scene) ? canvas?.level : null) ?? this.#scene.initialLevel ?? null;
  }

  /* -------------------------------------------- */

  /**
   * The number of Cover Lines per attacker corner for the target's shape on this grid, and how many of them give
   * three-quarters cover.
   * @type {{ threshold: number, total: number }}
   */
  get #lines() {
    const { grid } = this.#scene;
    if ( grid.isHexagonal ) return COVER.LINES.hexagonal;
    return (grid.isGridless && isEllipse(this.#target)) ? COVER.LINES.ellipse : COVER.LINES.square;
  }

  /* -------------------------------------------- */

  /**
   * Evaluate the cover of the target against the attacker.
   * @returns {CoverEvaluationResult} The cover result and optional debug data.
   */
  evaluateCover() {
    this.#creaturePrisms = this.#collectCreaturePrisms();
    this.#regionObstacles = this.#collectRegionObstacles();

    const attackerSamples = this.#prepareSamples(this.#attacker, this.#attackerVisionElevation);
    const targetSamples = this.#prepareSamples(this.#target, this.#targetBottom + (this.#targetHeight / 2));
    const attackerCornerSets = attackerSamples
      .map(center => this.#buildCorners(center, this.#attacker, this.#settings.insetAttacker))
      .filter(corners => corners?.length);
    this.#debugShapes?.attacker.push(...attackerCornerSets);

    let best = { coverLevel: 3, reachable: -1, segs: [] };
    for ( const center of targetSamples ) {
      const targetCorners = this.#buildCorners(center, this.#target, this.#settings.insetTarget);
      if ( !targetCorners?.length ) continue;
      this.#debugShapes?.target.push(targetCorners);

      for ( const attackerCorners of attackerCornerSets ) {
        for ( const aCorner of attackerCorners ) {
          const rating = this.#rateCorner(aCorner, targetCorners);
          if ( (rating.coverLevel < best.coverLevel)
            || ((rating.coverLevel === best.coverLevel) && (rating.reachable > best.reachable)) ) {
            best = rating;
            if ( !this.#debugShapes && rating.clear ) return this.#toResult("none", []);
          }
        }
      }
    }

    return this.#toResult(COVER.KEYS[(best.reachable < 0) ? 2 : best.coverLevel], best.segs);
  }

  /* -------------------------------------------- */

  /**
   * Evaluate whether the attacker has line of sight (LOS) to the target, considering walls only.
   * The test samples target visibility points and reports which points are blocked.
   * @returns {LosResult} The LOS result and sampled target points.
   */
  evaluateLOS() {
    const attacker = this.#attacker;
    const target = this.#target;
    if ( !attacker || !target ) return { hasLOS: true, targetLosPoints: [] };

    const origin = attacker.getVisionOrigin?.() ?? attacker.getCenterPoint?.() ?? {
      elevation: attacker?.elevation ?? 0,
      level: attacker?.level ?? null,
      x: attacker.x,
      y: attacker.y
    };

    origin.elevation ??= attacker?.elevation ?? 0;
    origin.level ??= attacker?.level ?? this.#level;

    const targetTestPoints = target.getVisibilityTestPoints?.()
      ?? [{ elevation: target?.elevation ?? 0, x: target.x, y: target.y }];
    for ( const point of targetTestPoints ) point.level = target?.level ?? null;

    const targetLosPoints = [];
    let hasLOS = false;

    for ( const p of targetTestPoints ) {
      const blocked = this.#wallsBlock(origin, p);
      targetLosPoints.push({ blocked, x: p.x, y: p.y });

      if ( !blocked ) {
        hasLOS = true;
        if ( !this.#debugShapes ) break;
      }
    }

    return { hasLOS, targetLosPoints };
  }

  /* -------------------------------------------- */

  /**
   * Build the creature occluder prisms of all tokens that can block the Cover Lines.
   * @returns {Map<string, OccluderPrism>} The prisms by token id.
   */
  #collectCreaturePrisms() {
    const { ignoreFriendly } = this.#settings;
    const blockers = (this.#scene.tokens?.contents ?? []).filter(td => {
      return (td.id !== this.#attacker?.id)
        && (td.id !== this.#target?.id)
        && (!ignoreFriendly || (this.#attacker?.disposition !== td?.disposition))
        && isBlockingCreatureToken(td);
    });
    return new Map(blockers.map(td => [td.id, this.#buildCreaturePrism(td)]));
  }

  /* -------------------------------------------- */

  /**
   * Collect the enabled Cover Obstacle behaviors of the scene together with their results for the pair.
   * @returns {object[]} The obstacle behaviors, each with its result for the pair or null if it depends on the line.
   */
  #collectRegionObstacles() {
    return (this.#scene.regions?.contents ?? [])
      .flatMap(region => region.behaviors.contents)
      .filter(b => !b.disabled && (b.type === COVER_OBSTACLE_TYPE))
      .map(b => ({ obstacle: b.system, tokenResult: b.system.evaluateTokens(this.#attacker, this.#target) }));
  }

  /* -------------------------------------------- */

  /**
   * Build the 3D occluder prism for a creature token.
   * The prism shape depends on grid mode and token-shape settings.
   * @param {TokenDocument} td The token document to build the prism for.
   * @returns {OccluderPrism} The occluder prism in canvas pixel space.
   */
  #buildCreaturePrism(td) {
    const { insetOccluder } = this.#settings;
    const elevation = Number(td?.elevation ?? 0);
    const minZ = elevation * this.#distancePixels;
    const maxZ = (elevation + getCreatureHeight(td)) * this.#distancePixels;
    const { x, y } = td.getCenterPoint();

    let shape;

    if ( this.#scene.grid.isGridless ) {
      if ( isEllipse(td) ) {
        const radius = Math.max((getTokenExternalRadius(td) ?? 0) - insetOccluder, 1);
        shape = new PIXI.Circle(x, y, radius).toPolygon();
      }
      else {
        const { width, height } = td.getSize();
        const inset = insetOccluder / Math.SQRT2;
        const w = Math.max(width - (2 * inset), 1);
        const h = Math.max(height - (2 * inset), 1);
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
        const length = Math.hypot(dx, dy) || 1;
        return { x: p.x - ((dx / length) * insetOccluder), y: p.y - ((dy / length) * insetOccluder) };
      }));
    }

    this.#debugShapes?.occluders.push(polygonToPoints(shape));
    return { polygon: shape, minZ, maxZ };
  }

  /* -------------------------------------------- */

  /**
   * Get the sample centers of a token, at the given elevation.
   * Even-sized square tokens leave out their center point, which lies on a grid corner.
   * @param {TokenDocument5e|Position} doc The token document or a generic position.
   * @param {number} elevation The elevation of the samples.
   * @returns {Position[]} The sample centers.
   */
  #prepareSamples(doc, elevation) {
    const samples = doc?.getContainmentTestPoints?.() ?? [{ x: doc.x, y: doc.y }];
    const center = doc?.getCenterPoint?.() ?? null;
    const size = doc?.width;
    const removeCenter = center
      && (doc?.width === doc?.height)
      && Number.isInteger(size)
      && ((size % 2) === 0)
      && (size >= 2);
    const level = doc?.level ?? this.#level;

    return samples
      .filter(point => !removeCenter || !((point.x === center.x) && (point.y === center.y)))
      .map(point => ({ ...point, elevation, level }));
  }

  /* -------------------------------------------- */

  /**
   * Build token test points for a sample center based on grid mode and token shape.
   * @param {Position} center The sample center in canvas pixels.
   * @param {TokenDocument5e|Position} td The token document or position being sampled.
   * @param {number} inset The inset distance in pixels.
   * @returns {Position[]} The test points for this center.
   */
  #buildCorners(center, td, inset) {
    const { grid } = this.#scene;
    const externalRadius = getTokenExternalRadius(td);
    if ( externalRadius === null ) {
      return [{
        elevation: center?.elevation ?? 0,
        level: center?.level ?? null,
        x: center?.x,
        y: center?.y
      }];
    }

    const halfGridSize = grid.size / 2;
    const radius = (externalRadius < halfGridSize) ? externalRadius : halfGridSize;

    let corners = [];
    if ( grid.isHexagonal ) {
      const scale = Math.min(1, (2 * radius) / grid.size);
      corners = grid.getShape().map(v => {
        const length = Math.hypot(v.x, v.y) || 1;
        return {
          x: center.x + (v.x * scale) - ((v.x / length) * inset),
          y: center.y + (v.y * scale) - ((v.y / length) * inset)
        };
      });
    }
    else if ( grid.isGridless && isEllipse(td) ) {
      const r = Math.max(radius - inset, 1);
      corners = polygonToPoints(new PIXI.Circle(center.x, center.y, r).toPolygon({ density: 8 }));
    }
    else {
      const d = inset / Math.SQRT2;
      const side = Math.max((radius * 2) - (2 * d), 1);
      const square = new PIXI.Rectangle(center.x - (side / 2), center.y - (side / 2), side, side);
      corners = polygonToPoints(square.toPolygon());
    }

    corners.forEach(c => c.elevation = center?.elevation ?? 0);
    corners.forEach(c => c.level = center?.level ?? null);

    td._constrainTestPoints(corners, {});
    return corners;
  }

  /* -------------------------------------------- */

  /**
   * Rate the Cover Lines from one attacker corner to all corners of one target sample.
   * @param {Position} aCorner The attacker corner.
   * @param {Position[]} targetCorners The target corners.
   * @returns {{ coverLevel: number, reachable: number, segs: object[], clear: boolean }} The rating of the corner.
   */
  #rateCorner(aCorner, targetCorners) {
    const { filteredTargetPoints } = this.#settings;
    const { threshold, total } = this.#lines;
    let halfLines = 0;
    let threeQuartersLines = 0;
    let totalCoverLines = 0;
    const segs = [];

    for ( const tCorner of targetCorners ) {
      const probes = this.#debugShapes ? [] : null;
      const lineCover = this.#getTargetCover(aCorner, tCorner, probes);

      if ( lineCover === "half" ) halfLines += 1;
      else if ( lineCover === "threeQuarters" ) threeQuartersLines += 1;
      else if ( lineCover === "total" ) {
        threeQuartersLines += 1;
        totalCoverLines += 1;
      }

      segs.push({ lineCover, a: aCorner, b: tCorner, blocked: lineCover !== "none", probes });
    }

    const missingLines = Math.max(0, total - targetCorners.length);
    const filteredBlocked = filteredTargetPoints === "blocked" ? missingLines : 0;
    threeQuartersLines += filteredBlocked;
    totalCoverLines += filteredBlocked;

    const activeLines = filteredTargetPoints === "dynamic" ? targetCorners.length : total;
    const threeQuartersThreshold = filteredTargetPoints === "dynamic"
      ? Math.max(1, Math.floor(targetCorners.length * 0.75))
      : threshold;

    const reachable = Math.max(0, activeLines - halfLines - threeQuartersLines);
    let coverLevel = (halfLines + threeQuartersLines) >= 1 ? 1 : 0;
    if ( threeQuartersLines >= threeQuartersThreshold ) coverLevel = 2;
    if ( totalCoverLines >= activeLines ) coverLevel = 3;

    return { coverLevel, reachable, segs, clear: (coverLevel === 0) && (activeLines === total) };
  }

  /* -------------------------------------------- */

  /**
   * Determine the cover of one Cover Line, probing the heights of the target.
   * @param {Position} aCorner The attacker corner.
   * @param {Position} tCorner The target corner.
   * @param {object[]|null} probes Receives one entry per probed height, when debugging.
   * @returns {CoverLevel} The cover level of the Cover Line.
   */
  #getTargetCover(aCorner, tCorner, probes) {
    const coverAt = fraction => {
      const tPoint = { ...tCorner, elevation: this.#targetBottom + (this.#targetHeight * fraction) };
      const cover = this.#getLineCover(aCorner, tPoint);
      probes?.push({ fraction, cover, blocker: this.#blocker });
      return cover;
    };
    return this.#targetHeight ? resolveHeightCover(coverAt) : coverAt(0.5);
  }

  /* -------------------------------------------- */

  /**
   * Determine the cover that occluders give to a Cover Line ending at a point on the target.
   * @param {Position} aCorner The attacker corner.
   * @param {Position} tPoint The target corner at the elevation where the Cover Line ends.
   * @returns {CoverLevel} The cover level of the Cover Line.
   */
  #getLineCover(aCorner, tPoint) {
    const { creatureCover, wallCover, wallType } = this.#settings;
    const from = { x: aCorner.x, y: aCorner.y, z: this.#attackerVisionElevation * this.#distancePixels };
    const to = { x: tPoint.x, y: tPoint.y, z: tPoint.elevation * this.#distancePixels };

    let cover = "none";
    let blocker = null;
    for ( const prism of this.#creaturePrisms.values() ) {
      if ( segIntersectsPolygonPrism(from, to, prism) ) {
        cover = creatureCover;
        blocker = "creature";
        break;
      }
    }

    for ( const { obstacle, tokenResult } of this.#regionObstacles ) {
      if ( cover === "total" ) break;
      const obstacleResult = tokenResult ?? obstacle.blocksLine(aCorner, tPoint);
      if ( obstacleResult.blocked && (COVER.ORDER[obstacleResult.cover] > COVER.ORDER[cover]) ) {
        cover = obstacleResult.cover;
        blocker = "region";
      }
    }

    if ( (COVER.ORDER[cover] < COVER.ORDER[wallCover]) && this.#wallsBlock(aCorner, tPoint, wallType) ) {
      cover = wallCover;
      blocker = "wall";
    }

    this.#blocker = blocker;
    return cover;
  }

  /* -------------------------------------------- */

  /**
   * Determine whether walls or surfaces block the segment between two corners.
   * @param {Position} aCorner The attacker corner.
   * @param {Position} bCorner The target corner.
   * @param {string} [type="sight"] The wall restriction type to test, `sight` or `move`.
   * @returns {boolean} Whether the segment is blocked.
   */
  #wallsBlock(aCorner, bCorner, type="sight") {
    const { levels } = this.#scene;
    const level = levels.get(bCorner.level?.id ?? bCorner.level);
    const wallHeightEye = this.#attacker?.object?.losHeight ?? aCorner.elevation;
    const wallHeightBounds = isWallHeightModuleActive() ? { b: wallHeightEye, t: wallHeightEye } : {};
    const source = {
      blinded: { darkness: false },
      data: { angle: 360 },
      level: levels.get(aCorner.level?.id ?? aCorner.level),
      los: { type, edgeTypes: { source: false }, useThreshold: true },
      object: { document: { hasStatusEffect: () => false }, elevation: aCorner.elevation },
      origin: { x: aCorner.x, y: aCorner.y, elevation: aCorner.elevation, ...wallHeightBounds }
    };
    const test = {
      level,
      los: new Map(),
      point: { x: bCorner.x, y: bCorner.y, elevation: bCorner.elevation }
    };
    const mode = { enabled: true, range: Infinity };
    const visible = CONFIG.Canvas.detectionModes.basicSight.testVisibility(source, mode, {
      level,
      object: null,
      tests: [test]
    });
    return !visible;
  }

  /* -------------------------------------------- */

  /**
   * Build the evaluation result for a cover level.
   * @param {CoverLevel} cover The resulting cover level.
   * @param {object[]} segs The debug segments of the best Cover Lines.
   * @returns {CoverEvaluationResult} The cover result, with debug data when debugging.
   */
  #toResult(cover, segs) {
    const bonus = COVER.BONUS[cover] ?? null;
    return this.#debugShapes
      ? { bonus, cover, debugTokenShapes: this.#debugShapes, debugSegments: segs }
      : { bonus, cover };
  }
}

/* -------------------------------------------- */

/**
 * Resolve a token's vision-source elevation, applying prone mode to its height above the base elevation.
 * @param {TokenDocument5e|Position} doc The token document or a generic position.
 * @returns {number} The vision source elevation.
 */
function resolveVisionElevation(doc) {
  const baseElevation = doc?.elevation ?? 0;
  const visionElevation = doc?.getVisionOrigin?.()?.elevation ?? baseElevation;
  return baseElevation + applyProneMode(doc, visionElevation - baseElevation);
}

/* -------------------------------------------- */

/**
 * Determine the cover level of a Cover Line from the heights of the target at which it is blocked.
 * @param {function(number): CoverLevel} coverAt  Method used to find the cover level at a fraction of the height.
 * @returns {CoverLevel}
 */
function resolveHeightCover(coverAt) {
  let strongest = 0;
  const levelAt = fraction => {
    const level = COVER.ORDER[coverAt(fraction)];
    strongest = Math.max(strongest, level);
    return level;
  };
  const isBlocked = fraction => levelAt(fraction) > 0;
  const toCover = level => COVER.KEYS[Math.min(level, strongest)];

  if ( !isBlocked(0.5) ) return "none";

  const upper = isBlocked(0.75);
  const lower = isBlocked(0.25);
  if ( !upper && !lower ) return "none";
  if ( !upper ) return isBlocked(0) ? toCover(1) : "none";
  if ( !lower ) return isBlocked(1) ? toCover(1) : "none";

  const bottom = levelAt(0);
  const top = levelAt(1);
  if ( bottom && top ) return toCover(Math.min(bottom, top) === COVER.ORDER.total ? 3 : 2);
  if ( bottom || top || isBlocked(0.15) || isBlocked(0.85) ) return toCover(2);
  return toCover(1);
}

/* -------------------------------------------- */

/**
 * Convert a PIXI.Polygon's flat point list into an array of point objects.
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
 * @param {{ x: number, y: number, z: number }} p The segment start point.
 * @param {{ x: number, y: number, z: number }} q The segment end point.
 * @param {{ polygon: PIXI.Polygon, minZ: number, maxZ: number }} prism The polygon prism.
 * @returns {boolean} True if the segment intersects the prism.
 */
function segIntersectsPolygonPrism(p, q, prism) {
  const { polygon, minZ, maxZ } = prism;
  if ( maxZ <= minZ ) return false;

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
