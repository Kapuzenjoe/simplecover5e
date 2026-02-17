import { MODULE_ID, DEFAULT_SIZE, COVER, BASE_KEYS, SETTING_KEYS, GRID_MODES, getGridMode } from "../config/constants.config.mjs";
import { getSizeKey, getCreatureHeight, isWallHeightModuleActive, isEllipse } from "../utils/engine.helper.mjs"

/**
 * @typedef {"none"|"half"|"threeQuarters"|"total"} CoverLevel
 *
 * @typedef {object} CoverContext
 * @property {Scene} scene
 * @property {Grid} grid
 * @property {string} gridMode
 * @property {"square"|"circle"} gridlessTokenShape
 * @property {number} half
 * @property {number} pxPerGridSize
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
    const gridMode = getGridMode(grid);
    const half = grid.size / 2;
    const pxPerGridSize = grid.size / grid.distance;

    //const saved = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURE_HEIGHTS) ?? {};
    // const size = foundry.utils.mergeObject(
    //     DEFAULT_SIZE,
    //     saved,
    //     { inplace: false }
    // );
    const gridlessTokenShape = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_TOKEN_SHAPE) ?? "square";

    const insetAttacker = Number(game.settings.get(MODULE_ID, SETTING_KEYS.INSET_ATTACKER) ?? 0);
    const insetTarget = Number(game.settings.get(MODULE_ID, SETTING_KEYS.INSET_TARGET) ?? 0);
    const insetOccluder = Number(game.settings.get(MODULE_ID, SETTING_KEYS.INSET_OCCLUDER) ?? 0);

    return {
        scene,
        grid,
        gridMode,
        gridlessTokenShape,
        half,
        pxPerGridSize,
        insetAttackerPx: Math.min(grid.size * 0.3, insetAttacker),
        insetTargetPx: Math.min(grid.size * 0.3, insetTarget),
        insetOccluderPx: Math.min(grid.size * 0.3, insetOccluder),
        // size
    };
}

/**
 * Build one or more 3D occluder prisms for a creature token.
 * The prism shape depends on grid mode and token-shape settings (e.g., gridless circle uses an inscribed AABB).
 *
 * @param {TokenDocument} td                     The token document to build prisms for.
 * @param {CoverContext} ctx                     The cover evaluation context.
 * @returns {Array<{minX:number,minY:number,maxX:number,maxY:number,minZ:number,maxZ:number}>} The occluder prisms (AABBs) in canvas pixel space.
 */
export function buildCreaturePrism(td, ctx) {
    const { grid, gridMode, half, insetOccluderPx, pxPerGridSize } = ctx;
    const elevation = Number(td?.elevation) || 0;
    const depth = Number(td?.depth) || 0;
    const distance = Number(grid?.distance) || 0;
    const zMin = elevation * pxPerGridSize;

    let height = depth * distance;

    const actor = td.actor;
    const proneMode = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURES_PRONE);
    const wallHeightActive = isWallHeightModuleActive();

    if (actor?.statuses?.has?.("prone") && proneMode !== "none") {
        if (proneMode === "half" || (proneMode === "lowerSize" && wallHeightActive)) {
            height *= 0.5;
        } else if (proneMode === "lowerSize") {
            const depthLower = (depth > 1) ? Math.max(depth - 1, 0.5) : (depth * 0.5);
            height = depthLower * distance;
        }
    }

    const zMax = zMin + (height * pxPerGridSize);
    const prisms = [];
    const radius = td?.object?.externalRadius ?? 0;
    const { x, y } = td.getCenterPoint();

    if (gridMode === GRID_MODES.GRIDLESS && isEllipse(td)) {
        const innerHalf = radius / Math.SQRT2;
        const halfEff = Math.max(innerHalf, 0);

        prisms.push({
            minX: x - halfEff + insetOccluderPx,
            minY: y - halfEff + insetOccluderPx,
            maxX: x + halfEff - insetOccluderPx,
            maxY: y + halfEff - insetOccluderPx,
            minZ: zMin + 0.1,
            maxZ: zMax - 0.1
        });

        return prisms;
    }

    if (gridMode === GRID_MODES.GRIDLESS || gridMode === GRID_MODES.SQUARE) {
        prisms.push({
            minX: x - radius + insetOccluderPx,
            minY: y - radius + insetOccluderPx,
            maxX: x + radius - insetOccluderPx,
            maxY: y + radius - insetOccluderPx,
            minZ: zMin + 0.1,
            maxZ: zMax - 0.1
        });
        return prisms;
    }

    if (gridMode === GRID_MODES.HEX) {
        const centers = td.getTestPoints({ depth: 0 });

        const halfNeighbor = Math.max(half * 0.80, 0);
        let halfCenter = Math.max(radius * 0.60, 0);
        if (centers.length === 1) {
            halfCenter = Math.max(radius * 0.80, 0);
        }

        for (const c of centers) {
            if (c.x === x && c.y === y) continue;
            prisms.push({
                minX: c.x - halfNeighbor + insetOccluderPx,
                minY: c.y - halfNeighbor + insetOccluderPx,
                maxX: c.x + halfNeighbor - insetOccluderPx,
                maxY: c.y + halfNeighbor - insetOccluderPx,
                minZ: zMin + 0.1,
                maxZ: zMax - 0.1
            });
        }

        prisms.push({
            minX: x - halfCenter + insetOccluderPx,
            minY: y - halfCenter + insetOccluderPx,
            maxX: x + halfCenter - insetOccluderPx,
            maxY: y + halfCenter - insetOccluderPx,
            minZ: zMin + 0.1,
            maxZ: zMax - 0.1
        });
        return prisms;
    }
    return prisms;
}

/**
 * Test whether sight-blocking walls obstruct the segment between two inset corners.
 * If wall-height is active, the intersection is additionally filtered by wall top/bottom values.
 *
 * @param {{raw:{x:number,y:number}|null, inset:{x:number,y:number}}} aCorner   The attacker corner (raw and inset).
 * @param {{raw:{x:number,y:number}|null, inset:{x:number,y:number}}} bCorner   The target corner (raw and inset).
 * @param {TokenDocument|Position} attackerDoc                                  The attacking token document OR a generic position {x,y,elevation?}.
 * @param {TokenDocument} targetDoc                                             The target token document.
 * @param {CoverContext} ctx                                                    The cover evaluation context.
 * @returns {{blocked:boolean, A:{x:number,y:number}, B:{x:number,y:number}}} Whether the segment is blocked and the tested inset segment.
 */
function wallsBlock(aCorner, bCorner, attackerDoc, targetDoc, ctx, losCheck = false) {
    const A = aCorner.inset;
    const B = bCorner.inset;
    const backend = CONFIG.Canvas.polygonBackends.sight;
    const wallHeightActive = isWallHeightModuleActive();
    const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
    const activeGM = game.users?.activeGM;

    const levelId = attackerDoc?.level ?? targetDoc?.level ?? canvas.level?.id;

    const wallCollide = (P, Q) =>
        backend.testCollision(P, Q, {
            type: "sight",
            mode: "all",
            useThreshold: true
        }) || [];

    const surfaceCollide = (P, Q) => {
        if (!levelId) return false;
        return canvas.scene.testSurfaceCollision(P, Q, { type: "sight", mode: "any", level: levelId });
    };

    let collisions = wallCollide(A, B);
    let surfaceBlocked = surfaceCollide(A, B);

    if (!collisions.length && (typeof attackerDoc.getCenterPoint === "function")) collisions = wallCollide(A, attackerDoc.getCenterPoint());
    if (!collisions.length) collisions = wallCollide(B, targetDoc.getCenterPoint()); // wait for https://github.com/foundryvtt/foundryvtt/issues/4509
    if (!collisions.length && !surfaceBlocked) {
        return { blocked: false, A, B };
    }

    if (!wallHeightActive) { // wall-height obsolet in V14??
        return { blocked: true, A, B };
    }

    for (const vertex of collisions) {
        if (!vertex) continue;

        const edgeSet = vertex.edges ?? vertex.cwEdges ?? vertex.ccwEdges;
        if (!edgeSet) continue;

        for (const edge of edgeSet) {
            const whFlags = edge?.object?.document?.flags?.["wall-height"];
            if (!whFlags) {
                return { blocked: true, A, B };
            }
        }

        const { coverLineZ, attZ, tgtZ, losLineZ } = getLineHeightAtVertex(A, B, vertex, attackerDoc, targetDoc, ctx);
        if (!Number.isFinite(coverLineZ)) continue;

        for (const edge of edgeSet) {
            const whFlags = edge?.object?.document?.flags?.["wall-height"];
            const topRaw = whFlags?.top;
            const bottomRaw = whFlags?.bottom;

            let wallTop = Number(topRaw);
            let wallBottom = Number(bottomRaw);

            if (!Number.isFinite(wallTop)) wallTop = Infinity;
            if (!Number.isFinite(wallBottom)) wallBottom = -Infinity;

            if (debugOn && activeGM) {
                const losBlock = losLineZ >= wallBottom && losLineZ <= wallTop
                const wallBlock = coverLineZ >= wallBottom && coverLineZ <= wallTop
                console.log(
                    `[${MODULE_ID}] wall-height line check:`,
                    {
                        attacker: { id: attackerDoc?.id, z: attZ },
                        target: { id: targetDoc.id, z: tgtZ },
                        wall: { id: edge?.object?.document.id, bottom: wallBottom, top: wallTop },
                        coverLineZ,
                        wallBlock,
                        losLineZ,
                        losBlock,
                        tVertex: {
                            x: vertex.x,
                            y: vertex.y
                        }
                    }
                );
            }
            if (losCheck) {
                if (losLineZ >= wallBottom && losLineZ <= wallTop) {
                    return { blocked: true, A, B };
                }
            }
            else if (coverLineZ >= wallBottom && coverLineZ <= wallTop) {
                return { blocked: true, A, B };
            }
        }
    }
    return { blocked: false, A, B };
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
function getLineHeightAtVertex(A, B, vertex, attackerDoc, targetDoc, ctx) {
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

    const attBottom = Number(attackerDoc.elevation ?? 0);
    const tgtBottom = Number(targetDoc.elevation ?? 0);

    const attHeight = getCreatureHeight(attackerDoc, ctx);
    const tgtHeight = getCreatureHeight(targetDoc, ctx);

    const attZ = attBottom + (Number.isFinite(attHeight) ? attHeight * 0.7 : 0);
    const losAttZ = attBottom + (Number.isFinite(attHeight) ? attHeight : 0);
    const tgtZ = tgtBottom + (Number.isFinite(tgtHeight) ? tgtHeight * 0.5 : 0);
    const losTgtZ = tgtBottom + (Number.isFinite(tgtHeight) ? tgtHeight : 0);

    const coverLineZ = attZ + t * (tgtZ - attZ);
    const losLineZ = Math.min(losAttZ, attZ + t * (losTgtZ - attZ));

    return { coverLineZ, attZ, tgtZ, losLineZ };
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
 * Build inset box corners around a center point.
 *
 * @param {{x:number,y:number}} center            The box center in canvas pixels.
 * @param {number} radius                         Half of the box edge length in pixels.
 * @param {number} insetPx                        The inset distance (pixels) towards the center.
 * @returns {Array<{raw:{x:number,y:number}, inset:{x:number,y:number}}>} The raw and inset corners.
 */
function buildBoxCorners(center, radius, insetPx) {
    const raws = [
        { x: center.x - radius, y: center.y - radius },
        { x: center.x + radius, y: center.y - radius },
        { x: center.x + radius, y: center.y + radius },
        { x: center.x - radius, y: center.y + radius }
    ];

    return raws.map(raw => {
        const vx = raw.x - center.x;
        const vy = raw.y - center.y;
        const L = Math.hypot(vx, vy) || 1;
        const inset = {
            x: raw.x - (vx / L) * insetPx,
            y: raw.y - (vy / L) * insetPx,
            elevation: center?.elevation ?? 0
        };
        return { raw, inset }; // toDo: Remove RAW
    });
}

/**
 * Build inset corners for a hex cell at a given center.
 *
 * @param {{x:number,y:number}} center            The hex cell center in canvas pixels.
 * @param {number} insetPx                        The inset distance (pixels) towards the center.
 * @param {CoverContext} ctx                      The cover evaluation context containing the grid.
 * @param {number} [scale=1]                      Scale factor for shrinking the hex (e.g., tiny tokens).
 * @returns {Array<{raw:{x:number,y:number}, inset:{x:number,y:number}}>|null} The inset corners, or null if unavailable.
 */
function buildHexCorners(center, insetPx, grid, scale = 1) {
    const coords = grid.getOffset(center);
    if (!coords) return null;

    const verts = grid.getVertices(coords);
    if (!Array.isArray(verts) || verts.length === 0) return null;

    const hexCenter = verts.reduce(
        (acc, v) => {
            acc.x += v.x;
            acc.y += v.y;
            return acc;
        },
        { x: 0, y: 0 }
    );
    hexCenter.x /= verts.length;
    hexCenter.y /= verts.length;

    return verts.map(v => {
        const raw = {
            x: hexCenter.x + (v.x - hexCenter.x) * scale,
            y: hexCenter.y + (v.y - hexCenter.y) * scale
        };

        const vx = raw.x - hexCenter.x;
        const vy = raw.y - hexCenter.y;
        const L = Math.hypot(vx, vy) || 1;

        const inset = {
            x: raw.x - (vx / L) * insetPx,
            y: raw.y - (vy / L) * insetPx,
            elevation: center?.elevation ?? 0
        };
        return { raw, inset };
    });
}

/**
 * Build a set of inset "corners" on the circumference of a circle.
 *
 * @param {{x:number,y:number}} center                   Center of the circle in canvas pixels.
 * @param {number} radius                                Radius of the circle in pixels.
 * @param {number} insetPx                               Inset distance in pixels towards the center.
 * @returns {Array<{raw:{x:number,y:number}, inset:{x:number,y:number}}>} The inset corners.
 */
function buildCircleCorners(center, radius, insetPx) {
    const { x, y } = center;
    const angles = [
        0,
        Math.PI / 4,
        Math.PI / 2,
        (3 * Math.PI) / 4,
        Math.PI,
        (5 * Math.PI) / 4,
        (3 * Math.PI) / 2,
        (7 * Math.PI) / 4
    ];

    const corners = [];

    for (const theta of angles) {
        const raw = {
            x: x + radius * Math.cos(theta),
            y: y + radius * Math.sin(theta)
        };

        const vx = raw.x - x;
        const vy = raw.y - y;
        const L = Math.hypot(vx, vy) || 1;

        const inset = {
            x: raw.x - (vx / L) * insetPx,
            y: raw.y - (vy / L) * insetPx,
            elevation: center?.elevation ?? 0
        };

        corners.push({ raw, inset });
    }

    return corners;
}

/**
 * Build inset token corners for a sample center based on grid mode and token shape.
 *
 * @param {{x:number,y:number}} center            The sample center in canvas pixels.
 * @param {number} radius                         The radius used for square/circle sampling.
 * @param {number} insetPx                        The inset distance (pixels) towards the center.
 * @param {string} gridMode                       The active grid mode.
 * @param {boolean} useCircleShape                Whether gridless tokens are treated as circles.
 * @param {CoverContext} ctx                      The cover evaluation context.
 * @param {string} sizeKey                        The normalized size key for the token.
 * @returns {Array<{raw:{x:number,y:number}, inset:{x:number,y:number}}>|null} The inset corners for this center.
 */
function buildTokenCornersForCenter(center, ctx, useCircleShape, sizeKey) {
    const { insetTargetPx, gridMode, half, grid } = ctx

    const radius = (sizeKey === "tiny") ? half / 2 : half
    // Case Position
    if (sizeKey === null) return [{ raw: null, inset: { x: center?.x, y: center?.y, elevation: center?.elevation } }];

    if (gridMode === GRID_MODES.HEX) {
        const scale = (sizeKey === "tiny") ? 0.5 : 1;
        return buildHexCorners(center, insetTargetPx, grid, scale);
    }
    if (useCircleShape) {
        return buildCircleCorners(center, radius, insetTargetPx);
    }
    return buildBoxCorners(center, radius, insetTargetPx);
}

/**
 * Flatten a creature-prism map into a list of 3D occluder boxes, excluding attacker and target tokens.
 * When debug output is enabled, this also appends 2D outlines for the occluders.
 *
 * @param {Map<string, object|object[]>|undefined} creaturePrisms             The map of token id to prism(s).
 * @param {string|undefined} attackerId                                      The attacker canvas object id.
 * @param {string|undefined} targetId                                        The target canvas object id.
 * @param {{occluders:Array<Array<{x:number,y:number}>>}|null} debugTokenShapes Optional debug accumulator.
 * @returns {Array<{minX:number,minY:number,maxX:number,maxY:number,minZ:number,maxZ:number}>} The occluder boxes.
 */
function collectOccluderBoxes(creaturePrisms, attackerId, targetId, debugTokenShapes) {
    const boxes = [];
    if (!(creaturePrisms instanceof Map)) return boxes;

    creaturePrisms.forEach((value, id) => {
        if (id === attackerId || id === targetId) return;

        const prisms = Array.isArray(value)
            ? value
            : (value ? [value] : []);

        for (const b of prisms) {
            boxes.push(b);
            if (!debugTokenShapes) continue;

            debugTokenShapes.occluders.push([
                { x: b.minX, y: b.minY },
                { x: b.maxX, y: b.minY },
                { x: b.maxX, y: b.maxY },
                { x: b.minX, y: b.maxY }
            ]);
        }
    });

    return boxes;
}

/**
 * Add debug circle outlines for large circular tokens in gridless mode.
 * This is used to visualize the circle sampling boundary for lg/huge/grg sizes.
 *
 * @param {TokenDocument} td                      The token document to visualize.
 * @param {string} sizeKey                        The normalized size key.
 * @param {Array<Array<{x:number,y:number}>>} bucket The debug bucket to append shapes to.
 * @param {CoverContext} ctx                      The cover evaluation context.
 * @returns {void}
 */
function addBigCircleDebug(td, half, bucket) {
    const radius = td?.object?.externalRadius ?? 0;
    if (radius <= half) return;

    const { x, y } = td.getCenterPoint();
    const bigCorners = buildCircleCorners({ x, y }, radius, 0);

    bucket.push(bigCorners.map(c => c.raw));
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
    const { gridMode, creaturePrisms, half, pxPerGridSize } = ctx;

    const isGridless = gridMode === GRID_MODES.GRIDLESS;
    const isHexGrid = gridMode === GRID_MODES.HEX;

    const isAttackerCircleShape = isGridless && isEllipse(attackerDoc)
    const isTargetCircleShape = isGridless && isEllipse(targetDoc)

    const debugTokenShapes = debug ? { attacker: [], target: [], occluders: [] } : null;

    const attackerId = attackerDoc?.object?.id ?? null;
    const targetId = targetDoc?.object?.id;
    const boxes = collectOccluderBoxes(creaturePrisms, attackerId, targetId, debugTokenShapes); // Add Broadcast Ray to limit tokens 

    const attackerZ = (attackerDoc?.elevation ?? 0) * pxPerGridSize + 0.1;
    const targetZ = (targetDoc.elevation ?? 0) * pxPerGridSize + 0.1;

    const attackerSizeKey = getSizeKey(attackerDoc);
    const targetSizeKey = getSizeKey(targetDoc);

    // Check for Position Option
    const attackerVisionSource = attackerDoc.getVisionOrigin();
    let attackerSamples = attackerDoc.getTestPoints({ depth: 0, elevation: attackerVisionSource.elevation });
    let targetSamples = targetDoc.getTestPoints();

    // workaround for https://github.com/foundryvtt/foundryvtt/issues/13830
    if (isAttackerCircleShape) attackerSamples = pullOnlyOuterCorners(attackerDoc, attackerSamples, 0.30);
    if (isTargetCircleShape) targetSamples = pullOnlyOuterCorners(targetDoc, targetSamples, 0.30);

    // https://github.com/foundryvtt/foundryvtt/issues/13736  Constrain getTestPoints() by Walls/Surfaces

    const creaturesHalfOnly = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.CREATURES_HALF_ONLY);

    let best = { reachable: -1, coverLevel: 2, segs: [] };

    if (debugTokenShapes) {
        if (isAttackerCircleShape) addBigCircleDebug(attackerDoc, half, debugTokenShapes.attacker);
        if (isTargetCircleShape) addBigCircleDebug(targetDoc, half, debugTokenShapes.target);
    }
    for (const tCenter of targetSamples) {
        const tgtCorners = buildTokenCornersForCenter(tCenter, ctx, isTargetCircleShape, targetSizeKey);
        if (!tgtCorners || !tgtCorners.length) continue;

        if (debugTokenShapes) {
            debugTokenShapes.target.push(
                tgtCorners
                    .map(c => c?.raw)
                    .filter(p => p != null)
            );
        }

        const totalLinesForThisTarget = tgtCorners.length;

        for (const aCenter of attackerSamples) {
            const atkCorners = buildTokenCornersForCenter(aCenter, ctx, isAttackerCircleShape, attackerSizeKey);
            if (!atkCorners || !atkCorners.length) continue;

            if (debugTokenShapes) {
                debugTokenShapes.attacker.push(
                    atkCorners
                        .map(c => c.raw)
                        .filter(p => p != null)
                );
            }

            for (const aCorner of atkCorners) {
                let blockedWalls = 0;
                let blockedCreatures = 0;
                const segs = [];

                for (const tCorner of tgtCorners) {
                    const wallResult = wallsBlock(aCorner, tCorner, attackerDoc, targetDoc, ctx);
                    const wBlocked = wallResult.blocked;

                    const attacker = { x: aCorner.inset.x, y: aCorner.inset.y, z: attackerZ };
                    const target = { x: tCorner.inset.x, y: tCorner.inset.y, z: targetZ };

                    let cBlocked = false;
                    if (!wBlocked) {
                        for (let i = 0; i < boxes.length; i++) {
                            if (segIntersectsAABB3D(attacker, target, boxes[i])) {
                                cBlocked = true;
                                break;
                            }
                        }
                    }

                    const isBlocked = wBlocked || cBlocked;
                    if (isBlocked) {
                        if (wBlocked) blockedWalls += 1;
                        else blockedCreatures += 1;
                    }

                    segs.push({
                        a: aCorner.inset,
                        b: tCorner.inset,
                        blocked: isBlocked,
                        wBlocked,
                        cBlocked,
                        _tested: { a: wallResult.A, b: wallResult.B }
                    });

                    const breakAt = isHexGrid ? 4 : (isTargetCircleShape ? 6 : 3);
                    if (!creaturesHalfOnly && (blockedWalls + blockedCreatures) >= breakAt) break;
                }

                const totalBlocked = blockedWalls + blockedCreatures;
                const reachable = totalLinesForThisTarget - totalBlocked;

                const threshold = isHexGrid ? 4 : (isTargetCircleShape ? 6 : 3);

                let coverLevel;
                if (creaturesHalfOnly) {
                    if (blockedWalls >= threshold) coverLevel = 2;
                    else if (blockedWalls >= 1) coverLevel = 1;
                    else if (blockedCreatures >= 1) coverLevel = 1;
                    else coverLevel = 0;
                } else {
                    if (totalBlocked >= threshold) coverLevel = 2;
                    else if (totalBlocked >= 1) coverLevel = 1;
                    else coverLevel = 0;
                }

                if (reachable > best.reachable || (reachable === best.reachable && coverLevel < best.coverLevel)) {
                    best = { reachable, coverLevel, segs };
                    if (reachable === totalLinesForThisTarget && coverLevel === 0) {
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
 * The test samples a 3×3 grid around the targets Test points using Foundry-like tolerance and reports which points are blocked.
 *
 * @param {TokenDocument|Position} attackerDoc    The attacking token document OR a generic position {x,y,elevation?}.
 * @param {TokenDocument} targetDoc               The target token document.
 * @param {CoverContext} ctx                      The cover evaluation context.
 * @returns {LosResult}                           The LoS result and sampled target points.
 */
export function evaluateLOS(attackerDoc, targetDoc, ctx) {
    if (!attackerDoc || !targetDoc) return { hasLOS: true, targetLosPoints: [] };
    const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);

    const origin = (typeof attackerDoc.getVisionOrigin === "function") ? attackerDoc.getVisionOrigin() : { x: attackerDoc.x, y: attackerDoc.y, elevation: attackerDoc.elevation ?? 0 };

    const attackerLevel = attackerDoc?.level
    const targetLevel = targetDoc?.level
    let baseTestPoints = []

    if (attackerLevel === targetLevel) {
        const target = targetDoc.getVisionOrigin();
        baseTestPoints = targetDoc.getTestPoints({ depth: 0, elevation: target.elevation });
    }
    else {
        const rawTestPoints = targetDoc.getTestPoints();
        baseTestPoints = closestElevationPoints(rawTestPoints, origin.elevation)
    }

    const tolerance = canvas.grid.size / 4;
    const cfg = canvas.visibility._createVisibilityTestConfig(baseTestPoints, { tolerance, object: targetDoc.object });
    const targetTestPoints = cfg.tests.map(t => t.point);

    const targetLosPoints = [];
    let hasLOS = false;
    const losCheck = true;
    const originPoint = { raw: null, inset: origin };

    for (const p of targetTestPoints) {
        const targetPoint = { raw: null, inset: p };
        const wallResult = wallsBlock(originPoint, targetPoint, attackerDoc, targetDoc, ctx, losCheck);
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


function pullOnlyOuterCorners(tokenDoc, points, pull = 0.30, eps = 0.5) {
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


function closestElevationPoints(points, originElevation) {
    const m = new Map();

    for (const p of points) {
        const key = `${p.x},${p.y}`;
        const e = p.elevation ?? 0;
        const dist = Math.abs(e - originElevation);

        const cur = m.get(key);
        if (!cur || dist < cur.dist) m.set(key, { p, dist });
    }

    return Array.from(m.values(), v => v.p);
}
