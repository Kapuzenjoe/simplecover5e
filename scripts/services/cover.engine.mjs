import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.config.mjs";
import { isBlockingCreatureToken, getCreatureHeight, isEllipse, isV14, isWallHeightModuleActive } from "./cover.service.mjs";

/**
 * @typedef {"none"|"half"|"threeQuarters"|"total"} CoverLevel
 *
 * @typedef {object} CoverContext
 * @property {Scene} scene
 * @property {Grid} grid
 * @property {"square"|"circle"} gridlessTokenShape
 * @property {number} halfGridSize
 * @property {number} distancePixels
 * @property {number} insetAttackerPx
 * @property {number} insetTargetPx
 * @property {number} insetOccluderPx
 * @property {Record<string, number>} size
 * @property {Map<string, Array<{minX:number,minY:number,maxX:number,maxY:number,minZ:number,maxZ:number}>>} [creaturePrisms]
 *
 * @typedef {object} LosPoint
 * @property {number} x
 * @property {number} y
 * @property {boolean} blocked
 *
 * @typedef {object} LosResult
 * @property {boolean} hasLOS
 * @property {LosPoint[]} targetLosPoints
 * 
 * @typedef {{x:number, y:number, elevation?:number}} Position
 */


/**
 * Build a cover evaluation context for a single pass.
 * The context caches grid measurements and module settings used by the cover and LoS evaluators.
 *
 * @param {Scene} scene                           The scene to evaluate.
 * @returns {CoverContext}                        The cover evaluation context.
 */
export function buildCoverContext(scene) {
    const grid = scene.grid;
    const halfGridSize = grid.size / 2;
    const distancePixels = scene?.dimensions?.distancePixels ?? 1;

    const insetAttacker = Number(game.settings.get(MODULE_ID, SETTING_KEYS.INSET_ATTACKER) ?? 0);
    const insetTarget = Number(game.settings.get(MODULE_ID, SETTING_KEYS.INSET_TARGET) ?? 0);
    const insetOccluder = Number(game.settings.get(MODULE_ID, SETTING_KEYS.INSET_OCCLUDER) ?? 0);

    return {
        scene,
        grid,
        halfGridSize,
        distancePixels,
        insetAttackerPx: Math.min(grid.size * 0.3, insetAttacker),
        insetTargetPx: Math.min(grid.size * 0.3, insetTarget),
        insetOccluderPx: Math.min(grid.size * 0.3, insetOccluder),
    };
}

/**
 * Build one or more 3D occluder prisms for a creature token.
 * The prism shape depends on grid mode and token-shape settings (e.g., gridless circle uses an inscribed AABB).
 *
 * @param {TokenDocument} td                     The token document to build prisms for.
 * @param {CoverContext} ctx                     The cover evaluation context.
 * @param {{ attacker: object[], target: object[], occluders: object[] }[]} debugTokenShapes  Debug shape data for attacker, target, and occluders.
 * @returns {Array<{minX:number,minY:number,maxX:number,maxY:number,minZ:number,maxZ:number}>} The occluder prisms (AABBs) in canvas pixel space.
 */
export function buildCreaturePrism(td, ctx, debugTokenShapes) {
    const { grid, halfGridSize, insetOccluderPx, distancePixels } = ctx;
    const elevation = Number(td?.elevation ?? 0);
    const zMin = elevation * distancePixels;
    let height = getCreatureHeight(td, ctx);

    const zMax = zMin + (height * distancePixels);
    const prisms = [];
    const radius = td?.object?.externalRadius ?? 0;
    const { x, y } = td.getCenterPoint();
    const insetToCenter = insetOccluderPx / Math.SQRT2;

    if (grid.isGridless && isEllipse(td)) {
        const innerHalf = radius / Math.SQRT2;
        const halfEff = Math.max(innerHalf, 0);

        prisms.push({
            minX: x - halfEff + insetToCenter,
            minY: y - halfEff + insetToCenter,
            maxX: x + halfEff - insetToCenter,
            maxY: y + halfEff - insetToCenter,
            minZ: zMin + 0.1,
            maxZ: zMax - 0.1
        });
    }
    else if (grid.isHexagonal) {
        let centers = [];
        if (isV14()) {
            centers = td.getContainmentTestPoints({ depth: 0 });
        }
        else {
            const offs = td.getOccupiedGridSpaceOffsets?.() ?? [];
            centers = offs.map(o => grid.getCenterPoint(o))
        }

        let halfCenter = Math.max(radius * 0.80, 0);

        if (centers?.length > 1) {
            const halfNeighbor = Math.max(halfGridSize * 0.80, 0);
            halfCenter = Math.max(radius * 0.60, 0);
            for (const c of centers) {
                if (c.x === x && c.y === y) continue;
                prisms.push({
                    minX: c.x - halfNeighbor + insetToCenter,
                    minY: c.y - halfNeighbor + insetToCenter,
                    maxX: c.x + halfNeighbor - insetToCenter,
                    maxY: c.y + halfNeighbor - insetToCenter,
                    minZ: zMin + 0.1,
                    maxZ: zMax - 0.1
                });
            }
        }

        prisms.push({
            minX: x - halfCenter + insetToCenter,
            minY: y - halfCenter + insetToCenter,
            maxX: x + halfCenter - insetToCenter,
            maxY: y + halfCenter - insetToCenter,
            minZ: zMin + 0.1,
            maxZ: zMax - 0.1
        });
    }
    else {
        prisms.push({
            minX: x - radius + insetToCenter,
            minY: y - radius + insetToCenter,
            maxX: x + radius - insetToCenter,
            maxY: y + radius - insetToCenter,
            minZ: zMin + 0.1,
            maxZ: zMax - 0.1
        });
    }

    for (const b of prisms) {
        if (!debugTokenShapes) continue;

        debugTokenShapes.occluders.push([
            { x: b.minX, y: b.minY },
            { x: b.maxX, y: b.minY },
            { x: b.maxX, y: b.maxY },
            { x: b.minX, y: b.maxY }
        ]);
    }
    return prisms;
}

/**
 * Test whether sight-blocking walls obstruct the segment between two positions.
 * If wall-height is active, the intersection is additionally filtered by wall top/bottom values.
 *
 * @param {{x:number,y:number,elevation:number,level?:string}} aCorner                       The attacker corner.
 * @param {{x:number,y:number,elevation:number,level?:string}} bCorner                                     The target corner.
 * @returns {{blocked:boolean, A:{x:number,y:number,elevation:number}, B:{x:number,y:number,elevation:number}}}   Whether the segment is blocked and the tested inset segment.
 */
function wallsBlock(aCorner, bCorner, losPolygon = null) {
    const A = aCorner
    const B = bCorner
    const backend = CONFIG.Canvas.polygonBackends.sight;

    const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
    const activeGM = game.users?.activeGM;

    let fromLevel = A?.level ?? canvas?.level ?? null;
    if (typeof fromLevel === "string") fromLevel = canvas.scene?.levels?.get(fromLevel) ?? null;

    let toLevel = B?.level ?? canvas?.level ?? null;
    if (typeof toLevel === "string") toLevel = canvas.scene?.levels?.get(toLevel) ?? null;

    toLevel ??= fromLevel;

    let tSplit = 1;

    if (fromLevel && toLevel && (fromLevel !== toLevel)) {
        const delta = (B.elevation ?? 0) - (A.elevation ?? 0);

        if (delta !== 0) {
            let t00 = (fromLevel.elevation.bottom - A.elevation) / delta;
            let t01 = (fromLevel.elevation.top - A.elevation) / delta;
            if (t00 > t01) [t00, t01] = [t01, t00];

            let t10 = (toLevel.elevation.bottom - A.elevation) / delta;
            let t11 = (toLevel.elevation.top - A.elevation) / delta;
            if (t10 > t11) [t10, t11] = [t11, t10];

            tSplit = ((t11 > 0) && (t01 < t11)) ? Math.min(Math.max(t01, t10), 1) : 1;
            if (tSplit < 0) tSplit = 0;
        }
    }

    let blocked = false;
    let collisions = [];

    const debugData = {
        A,
        B,
        losPolygon,
        fromLevel: fromLevel?.id ?? null,
        toLevel: toLevel?.id ?? null,
        tSplit,
        segment1: null,
        segment2: null
    };

    // Segment 1: source level
    if ((fromLevel && (tSplit > 0)) || !isV14()) {
        const tMin = 0;
        const tMax = tSplit;

        if (losPolygon) {
            const splitX = A.x + ((B.x - A.x) * tSplit);
            const splitY = A.y + ((B.y - A.y) * tSplit);

            const losBlocked = !losPolygon.contains(splitX, splitY);
            if (losBlocked) blocked = true;
        } else {

            const surfaceBlocked = canvas.scene?.testSurfaceCollision?.(A, B, {
                type: "sight",
                mode: "any",
                level: fromLevel,
                tMin,
                tMax
            }) ?? false;

            const wallBlocked = backend.testCollision(A, B, {
                type: "sight",
                mode: "all",
                useThreshold: true,
                level: fromLevel,
                tMin,
                tMax
            }) ?? false;

            if (!isV14()) collisions = wallBlocked

            debugData.segment1 = {
                tMin,
                tMax,
                surfaceBlocked,
                wallBlocked
            };

            if (surfaceBlocked || wallBlocked.length) blocked = true;
        }
    }

    // Segment 2: target level
    if (!blocked && toLevel && (tSplit < 1)) {
        const tMin = tSplit;
        const tMax = 1;

        const surfaceBlocked = canvas.scene?.testSurfaceCollision(A, B, {
            type: "sight",
            mode: "any",
            level: toLevel,
            tMin,
            tMax
        }) ?? false;

        const wallBlocked = backend.testCollision(A, B, {
            type: "sight",
            mode: "any",
            useThreshold: true,
            level: toLevel,
            tMin,
            tMax
        }) ?? false;

        debugData.segment2 = {
            tMin,
            tMax,
            surfaceBlocked,
            wallBlocked
        };

        if (surfaceBlocked || wallBlocked) blocked = true;
    }


    if (debugOn && activeGM) {
        console.debug(
            `[${MODULE_ID}] wallsBlock: `,
            debugData
        );
    }

    if (!isWallHeightModuleActive() || losPolygon) {
        return { blocked, A, B };
    }

    for (const vertex of collisions) {
        if (!vertex) continue;

        const edgeSet = vertex.edges ?? vertex.cwEdges ?? vertex.ccwEdges;
        if (!edgeSet) continue;

        const { coverLineZ } = getLineHeightAtVertex(A, B, vertex);
        if (!Number.isFinite(coverLineZ)) continue;

        for (const edge of edgeSet) {
            const wallDoc = edge?.object?.document;
            if (!wallDoc) continue;

            const whFlags = wallDoc.flags?.["wall-height"];
            const topRaw = whFlags?.top;
            const bottomRaw = whFlags?.bottom;

            const wallTop = (topRaw != null) ? Number(topRaw) : Infinity;
            const wallBottom = (bottomRaw != null) ? Number(bottomRaw) : -Infinity;

            if (wallTop === Infinity && wallBottom === -Infinity) {
                return { blocked: true, A, B };
            }

            const wallBlocks = A.elevation >= wallBottom && A.elevation <= wallTop;
            const coverBlocks = coverLineZ >= wallBottom && coverLineZ <= wallTop;

            if (debugOn && activeGM) {
                console.debug(
                    `[${MODULE_ID}] wall-height line check:`,
                    {
                        wall: { id: edge?.object?.document.id, bottom: wallBottom, top: wallTop },
                        coverLineZ,
                        wallBlocks,
                        coverBlocks,
                        tVertex: {
                            x: vertex.x,
                            y: vertex.y
                        }
                    }
                );
            }

            if (wallBlocks || coverBlocks) {
                return { blocked: true, A, B };
            }
        }
    }
    return { blocked: false, A, B, collisions };
}

/**
 * Compute the ray height at a wall-intersection vertex along segment A→B.
 * The result is used to compare line height against wall-height top/bottom values.
 *
 * @param {{x:number,y:number}} A                The segment start point (inset).
 * @param {{x:number,y:number}} B                The segment end point (inset).
 * @param {{x:number,y:number}} vertex           The intersection vertex on the wall.
 * @param {TokenDocument|Position} attackerDoc   The attacking token document OR a generic position {x,y,elevation?}.
 * @param {TokenDocument} targetDoc              The target token document.
 * @param {CoverContext} ctx                     The cover evaluation context.
 * @returns {{lineZ:number, attZ:number, tgtZ:number}} The interpolated line height and the attacker/target sampling heights.
 */
function getLineHeightAtVertex(A, B, vertex) {
    const dx = B.x - A.x;
    const dy = B.y - A.y;

    let t;
    if (Math.abs(dx) >= Math.abs(dy)) {
        const denom = dx || 1e-9;
        t = (vertex.x - A.x) / denom;
    } else {
        const denom = dy || 1e-9;
        t = (vertex.y - A.y) / denom;
    }
    t = Math.min(Math.max(t, 0), 1);

    const coverLineZ = A.elevation + t * (B.elevation - A.elevation);

    return { coverLineZ };
}

/**
 * Test whether a 3D segment intersects a 3D axis-aligned bounding box (AABB).
 * This uses Liang–Barsky style clipping and rejects near-zero intersections using a small epsilon.
 *
 * @param {{x:number,y:number,z:number}} p        The segment start point.
 * @param {{x:number,y:number,z:number}} q        The segment end point.
 * @param {{minX:number,minY:number,maxX:number,maxY:number,minZ:number,maxZ:number}} b The AABB.
 * @returns {boolean}                             True if the segment intersects the AABB.
 */
function segIntersectsAABB3D(p, q, b) {
    let t0 = 0;
    let t1 = 1;

    const d = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z };

    function clip(pv, qv) {
        if (pv === 0) return qv >= 0;
        const t = qv / pv;
        if (pv < 0) {
            if (t > t1) return false;
            if (t > t0) t0 = t;
        } else {
            if (t < t0) return false;
            if (t < t1) t1 = t;
        }
        return true;
    }

    if (!clip(-d.x, p.x - b.minX)) return false;
    if (!clip(d.x, b.maxX - p.x)) return false;
    if (!clip(-d.y, p.y - b.minY)) return false;
    if (!clip(d.y, b.maxY - p.y)) return false;
    if (!clip(-d.z, p.z - b.minZ)) return false;
    if (!clip(d.z, b.maxZ - p.z)) return false;

    const EPS = 1e-3;
    return (t0 + EPS) < (t1 - EPS);
}

/**
 * Compute target/attacker sample centers used for cover evaluation.
 * The sampling pattern depends on grid mode and creature size.
 *
 * @param {TokenDocument|Position} td                       The token document or position to sample.
 * @param {CoverContext} ctx                                The cover evaluation context.
 * @param {boolean} coverCheck                              Whether the centers are being computed for a cover check (true) or a LoS check (false).
 * @returns {Array<{x:number,y:number,elevation:number}>}   The sample centers with elevation.
 */
export function getTokenSampleCenters(td, coverCheck = false) {
    const grid = td?.object?.scene?.grid ?? canvas?.scene.grid ?? null
    const x = td.x
    const y = td.y
    const width = td?.width ?? 0;
    const height = td?.height ?? 0;
    let elevation = Number(td?.elevation ?? 0);
    const creatureHeight = coverCheck ? getCreatureHeight(td) * 0.5 : getCreatureHeight(td);
    const steps = coverCheck ? 0 : 2;
    elevation = coverCheck ? (elevation + creatureHeight) : elevation;

    const centers = [];

    if ((width < 1) && (height < 1)) {
        const center = td.getCenterPoint?.() ?? { x, y };
        return coverCheck
            ? [{ x: center.x, y: center.y, elevation: elevation }]
            : [{ x: center.x, y: center.y, elevation: elevation }, { x: center.x, y: center.y, elevation: elevation + creatureHeight }];
    }

    if (grid.isSquare) {
        if (Number.isInteger(width) && Number.isInteger(height)) {
            for (let i = 0.5; i < height; i++) {
                for (let j = 0.5; j < width; j++) {
                    for (let k = 0; k <= steps; k++) {
                        centers.push({ x: x + (grid.size * j), y: y + (grid.size * i), elevation: elevation + (creatureHeight * 0.5 * k) });
                    }
                }
            }
        }
    }
    else if (grid.isHexagonal) {
        const offsets = td.getOccupiedGridSpaceOffsets?.() ?? [];
        for (const o of offsets) {
            const c = grid.getCenterPoint(o);
            for (let k = 0; k <= steps; k++) {
                centers.push({ x: c.x, y: c.y, elevation: elevation + (creatureHeight * 0.5 * k) });
            }
        }
    }
    else {
        const size = td?.getSize();
        const n = Math.round((size?.height / grid.size) - 1e-6) - 1;
        const m = Math.round((size?.width / grid.size) - 1e-6) - 1;
        const padX = (size?.width - (grid.size * m)) / 2;
        const padY = (size?.height - (grid.size * n)) / 2;
        const stepX = m ? (size?.width - (padX * 2)) / m : 0;
        const stepY = n ? (size?.height - (padY * 2)) / n : 0;
        for (let i = 0; i <= n; i++) {
            for (let j = 0; j <= m; j++) {
                for (let k = 0; k <= steps; k++) {
                    centers.push({
                        x: x + padX + (stepX * j),
                        y: y + padY + (stepY * i),
                        elevation: elevation + (creatureHeight * 0.5 * k)
                    });
                }
            }
        }
    }

    return centers;
}

/**
 * Build inset box corners around a center point.
 * Each corner is moved by `insetPx` towards the center along the diagonal.
 * 
 * @param {{x:number,y:number}} center                             The box center in canvas pixels.
 * @param {number} radius                                          Half of the box edge length in pixels.
 * @param {number} insetPx                                         The inset distance (pixels) towards the center.
 * @returns {Array<{x:number, y:number}>}                          The corners points.
 */
function buildBoxCorners(center, radius, insetPx) {
    const { x: cx, y: cy } = center;
    const d = insetPx / Math.SQRT2;

    return [
        { x: cx - radius + d, y: cy - radius + d },
        { x: cx + radius - d, y: cy - radius + d },
        { x: cx + radius - d, y: cy + radius - d },
        { x: cx - radius + d, y: cy + radius - d },
    ];
}

/**
 * Build inset corners for a hex cell at a given center.
 * Each corner is moved by `insetPx` towards the center along the diagonal.
 *
 * @param {{x:number,y:number}} center            The hex cell center in canvas pixels.
 * @param {number} insetPx                        The inset distance (pixels) towards the center.
 * @param {CoverContext} ctx                      The cover evaluation context containing the grid.
 * @param {Grid} grid                             The current scene grid.
 * @returns {Array<{x:number, y:number}>}         The hex corners points.
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
            x: cx + dx * scale - (dx / L) * insetPx,
            y: cy + dy * scale - (dy / L) * insetPx,
        };
    });
}

/**
 * Build a set of inset "corners" on the circumference of a circle.
 * Each point is moved by `insetPx` towards the center along the radius.
 *
 * @param {{x:number,y:number}} center                          Center of the circle in canvas pixels.
 * @param {number} radius                                       Radius of the circle in pixels.
 * @param {number} insetPx                                      The inset distance (pixels) towards the center.
 * @returns {Array<{x:number, y:number}>}                       The points (clockwise from angle 0°)
 */
function buildCircleCorners(center, radius, insetPx) {
    const { x: cx, y: cy } = center;
    const r = radius - insetPx;
    const k = Math.SQRT1_2;

    return [
        { x: cx + r, y: cy }, //   0°
        { x: cx + r * k, y: cy + r * k }, //  45°
        { x: cx, y: cy + r }, //  90°
        { x: cx - r * k, y: cy + r * k }, // 135°
        { x: cx - r, y: cy }, // 180°
        { x: cx - r * k, y: cy - r * k }, // 225°
        { x: cx, y: cy - r }, // 270°
        { x: cx + r * k, y: cy - r * k }, // 315°
    ];
}

/**
 * Build token test points for a sample center based on grid mode and token shape.
 *
 * @param {{x:number,y:number}} center            The sample center in canvas pixels.
 * @param {CoverContext} ctx                      The cover evaluation context.
 * @param {TokenDocument} td                      The token document.
 * @param {number} insetPx                        The inset distance (pixels) towards the center.
 * @returns {Array<{x:number, y:number}>}         The points for this center.
 */
function buildTokenCornersForCenter(center, ctx, td, inset) {
    const { halfGridSize, grid } = ctx
    const useCircleShape = grid.isGridless && isEllipse(td);

    const externalRadius = td?.object?.externalRadius ?? null
    if (externalRadius === null) return [{ x: center?.x, y: center?.y }];

    const radius = (externalRadius < halfGridSize) ? externalRadius : halfGridSize

    let corners = [];
    if (grid.isHexagonal) {
        corners = buildHexCorners(center, radius, inset, grid);
    }
    else if (useCircleShape) {
        corners = buildCircleCorners(center, radius, inset);
    }
    else corners = buildBoxCorners(center, radius, inset);

    corners.forEach(c => c.elevation = center?.elevation ?? 0);
    corners.forEach(c => c.level = center?.level ?? null);

    return getConstrainedTestPoints(corners, td);
}

/**
 * Evaluate DMG-style cover for an attacker against a target.
 * The evaluator tests rays against sight-blocking walls and creature occluder prisms and returns the best (least blocked) sampling outcome.
 *
 * @param {TokenDocument|Position} attackerDoc    The attacking token document OR a generic position {x,y,elevation?}.
 * @param {TokenDocument} targetDoc               The target token document.
 * @param {CoverContext} ctx                      The cover evaluation context.
 * @param {{debug?:boolean}} [options]            Optional flags (e.g. debug shape output).
 * @returns {{cover: "none"|"half"|"threeQuarters", bonus: 0|2|5|null, debugSegments?:Array, debugTokenShapes?:object}} The cover result and optional debug data.
 *
 */
export function evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, options = {}) {
    const debug = !!options.debug;
    const debugTokenShapes = debug ? { attacker: [], target: [], occluders: [] } : null;
    const { grid, distancePixels, insetAttackerPx, insetTargetPx } = ctx;
    const creaturesHalfOnly = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.CREATURES_HALF_ONLY);
    const ignoreFriendly = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.IGNORE_FRIENDLY);

    const placeables = canvas?.tokens?.placeables ?? [];
    const blockingTokens = placeables.filter(t =>
        t.id !== attackerDoc?.id &&
        t.id !== targetDoc?.id &&
        (!ignoreFriendly || attackerDoc?.disposition !== t?.document?.disposition) &&
        isBlockingCreatureToken(t)
    );

    const boxes = new Map(blockingTokens.map(t => [t.id, buildCreaturePrism(t.document, ctx, debugTokenShapes)]));

    let attackerVisionSource = 0;
    let targetVisionSource = 0;
    let attackerSamples = [];
    let targetSamples = [];

    if (isV14()) {
        attackerVisionSource = attackerDoc?.getVisionOrigin?.()?.elevation ?? attackerDoc?.elevation ?? 0;
        targetVisionSource = targetDoc?.getVisionOrigin?.()?.elevation ?? targetDoc?.elevation ?? 0;

        attackerSamples = attackerDoc?.getContainmentTestPoints?.()
            ?? [{ x: attackerDoc.x, y: attackerDoc.y }];
        for (const point of attackerSamples) {
            point.elevation = attackerVisionSource;
            point.level = attackerDoc?.level ?? canvas?.level ?? null;
        }

        targetSamples = targetDoc?.getContainmentTestPoints?.()
            ?? [{ x: targetDoc.x, y: targetDoc.y }];
        for (const point of targetSamples) {
            point.elevation = targetVisionSource;
            point.level = targetDoc?.level ?? canvas?.level ?? null;
        }
    }
    else {
        attackerSamples = getTokenSampleCenters(attackerDoc, true);
        targetSamples = getTokenSampleCenters(targetDoc, true);
        attackerVisionSource = targetSamples[0]?.elevation ?? attackerDoc?.elevation ?? 0;
        targetVisionSource = attackerSamples[0]?.elevation ?? targetDoc?.elevation ?? 0;
    }

    const attackerZ = attackerVisionSource * distancePixels + 0.1;
    const targetZ = targetVisionSource * distancePixels + 0.1;

    const isAttackerCircleShape = grid.isGridless && isEllipse(attackerDoc)
    const isTargetCircleShape = grid.isGridless && isEllipse(targetDoc)
 

    let best = { reachable: -1, coverLevel: 2, segs: [] };
    const totalLines = grid.isHexagonal ? 6 : (isTargetCircleShape ? 8 : 4);
    const threshold = grid.isHexagonal ? 4 : (isTargetCircleShape ? 6 : 3);

    for (const tCenter of targetSamples) {
        const tgtCorners = buildTokenCornersForCenter(tCenter, ctx, targetDoc, insetTargetPx);
        if (!tgtCorners || !tgtCorners.length) continue;

        if (debugTokenShapes) debugTokenShapes.target.push(tgtCorners);

        for (const aCenter of attackerSamples) {
            const atkCorners = buildTokenCornersForCenter(aCenter, ctx, attackerDoc, insetAttackerPx);
            if (!atkCorners || !atkCorners.length) continue;

            if (debugTokenShapes) debugTokenShapes.attacker.push(atkCorners);

            for (const aCorner of atkCorners) {
                let blockedWalls = 0;
                let blockedCreatures = 0;
                const segs = [];

                for (const tCorner of tgtCorners) {
                    const wallResult = wallsBlock(aCorner, tCorner);
                    const wBlocked = wallResult.blocked;

                    const attacker = { x: aCorner.x, y: aCorner.y, z: attackerZ };
                    const target = { x: tCorner.x, y: tCorner.y, z: targetZ };

                    let cBlocked = false;
                    if (!wBlocked) {
                        for (const prisms of boxes.values()) {
                            for (const b of prisms) {
                                if (segIntersectsAABB3D(attacker, target, b)) {
                                    cBlocked = true;
                                    break;
                                }
                            }
                            if (cBlocked) break;
                        }
                    }

                    const isBlocked = wBlocked || cBlocked;
                    if (isBlocked) {
                        if (wBlocked) blockedWalls += 1;
                        else blockedCreatures += 1;
                    }

                    segs.push({
                        a: aCorner,
                        b: tCorner,
                        blocked: isBlocked,
                        wallResult,
                        wBlocked,
                        cBlocked,
                    });
                }

                const totalBlocked = blockedWalls + blockedCreatures + Math.max(0, totalLines - tgtCorners.length);
                const reachable = Math.max(0, totalLines - totalBlocked);

                let coverLevel;
                if (creaturesHalfOnly) {
                    const effWalls = blockedWalls + Math.max(0, totalLines - tgtCorners.length);
                    if (effWalls >= threshold) coverLevel = 2;
                    else if (effWalls >= 1) coverLevel = 1;
                    else if (blockedCreatures >= 1) coverLevel = 1;
                    else coverLevel = 0;
                } else {
                    if (totalBlocked >= threshold) coverLevel = 2;
                    else if (totalBlocked >= 1) coverLevel = 1;
                    else coverLevel = 0;
                }

                if (reachable > best.reachable || (reachable === best.reachable && coverLevel < best.coverLevel)) {
                    best = { reachable, coverLevel, segs };
                    if (!debug && coverLevel === 0 && totalBlocked === 0 && tgtCorners.length === totalLines) {
                        const cover = "none";
                        const bonus = COVER.BONUS[cover] || 0;
                        return debug ? { cover, bonus, debugSegments: best.segs, debugTokenShapes } : { cover, bonus };
                    }
                }
            }
        }
    }

    const cover = best.coverLevel === 2 ? "threeQuarters" : (best.coverLevel === 1 ? "half" : "none");
    const bonus = COVER.BONUS[cover] || 0;
    return debug ? { cover, bonus, debugSegments: best.segs, debugTokenShapes } : { cover, bonus };
}

/**
 * Evaluate whether an attacker has line of sight (LoS) to a target, considering walls only.
 * The test samples a 3×3 grid around the target center using Foundry-like tolerance and reports which points are blocked.
 *
 * @param {TokenDocument|Position} attackerDoc    The attacking token document OR a generic position {x,y,elevation?}.
 * @param {TokenDocument} targetDoc               The target token document.
 * @param {CoverContext} ctx                      The cover evaluation context.
 * @returns {LosResult}                           The LoS result and sampled target points.
 */
export function evaluateLOS(attackerDoc, targetDoc, ctx) {
    if (!attackerDoc || !targetDoc) return { hasLOS: true, targetLosPoints: [] };
    const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);

    const origin = isV14()
        ? attackerDoc.getVisionOrigin()
        : (attackerDoc.getCenterPoint?.() ?? {
            x: attackerDoc.x,
            y: attackerDoc.y,
            elevation: (attackerDoc?.elevation ?? 0) + (getCreatureHeight(attackerDoc, ctx) * 0.5),
        });

    origin.level = attackerDoc?.level ?? canvas?.level ?? null;
    const losPolygon = attackerDoc?.object?.vision?.los ?? null;

    if (isWallHeightModuleActive()) origin.elevation = (attackerDoc?.elevation ?? 0) + getCreatureHeight(attackerDoc, ctx);

    let targetTestPoints = [];
    if (isV14()) {
        targetTestPoints = targetDoc.getVisibilityTestPoints();
    }
    else {
        const tolerance = canvas.grid.size / 4;
        const testPoints = pullOnlyOuterCorners(
            targetDoc,
            getTokenSampleCenters(targetDoc)
        ).flatMap(samplePoint => {
            const { tests } = canvas.visibility._createVisibilityTestConfig(samplePoint, {
                tolerance,
                object: targetDoc.object
            });

            return tests.map(({ point }) => point);
        });

        targetTestPoints = getConstrainedTestPoints(testPoints, targetDoc);
    }

    for (const point of targetTestPoints) point.level = targetDoc?.level ?? null;

    const targetLosPoints = [];
    let hasLOS = false;

    for (const p of targetTestPoints) {
        const wallResult = wallsBlock(origin, p, losPolygon);
        targetLosPoints.push({ x: p.x, y: p.y, blocked: wallResult.blocked });

        if (!wallResult.blocked) {
            hasLOS = true;
            if (!debugOn) break;
        }
    }

    return {
        hasLOS,
        targetLosPoints
    };
}

/**
 * Given a array of test points and a token document, filter out points that are behind sight-blocking walls relative to the token's vision origin.
 * 
 * @param {Array<{x:number,y:number}>} points 
 * @param {TokenDocument} td 
 * @returns {Array<{x:number,y:number}>} 
 */
function getConstrainedTestPoints(points, td) {
    const level = td.parent?.levels?.get(td?.level) ?? null;
    const origin = isV14() ? td.getVisionOrigin() : td.getCenterPoint();

    if ((points.length === 1) && (points[0].x === origin.x) && (points[0].y === origin.y)) {
        return points;
    }

    const { width, height } = td.getSize();
    const boundingBox = new PIXI.Rectangle(td.x, td.y, width, height);
    const polygon = foundry.canvas.geometry.ClockwiseSweepPolygon.create(origin, { type: "move", level, boundingBox });
    for (let i = points.length - 1; i >= 0; i--) {
        const { x, y } = points[i];
        if (polygon.contains(x, y)) continue;
        points[i] = points[points.length - 1];
        points.length--;
    }

    if (!points.length) points.push(origin);
    return points;
}

/**
 * For gridless circular tokens, pull four outer corners towards the center.
 * 
 * @param {TokenDocument} tokenDoc 
 * @param {Array<{x:number,y:number}>} points 
 * @param {number} pull 
 * @param {number} eps 
 * @returns {Array<{x:number,y:number}>} 
 */
function pullOnlyOuterCorners(tokenDoc, points, pull = 0.30, eps = 0.5) {
    if (!(tokenDoc.parent.grid.isGridless && isEllipse(tokenDoc))) return points;
    const c = tokenDoc.getCenterPoint();
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const near = (a, b) => Math.abs(a - b) <= eps;
    const isCorner = (p) =>
        (near(p.x, minX) || near(p.x, maxX)) &&
        (near(p.y, minY) || near(p.y, maxY));

    return points.map(p => isCorner(p) ? ({
        ...p,
        x: p.x + pull * (c.x - p.x),
        y: p.y + pull * (c.y - p.y),
    }) : p);
}
