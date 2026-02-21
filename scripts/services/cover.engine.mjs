import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.config.mjs";

/**
 * @typedef {"none"|"half"|"threeQuarters"|"total"} CoverLevel
 *
 * @typedef {object} CoverContext
 * @property {Scene} scene
 * @property {Grid} grid
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
 * Helper
 * @param {TokenDocument} tokenDoc 
 * @returns {boolean} 
 */
function isEllipse(tokenDoc) {
    return (
        tokenDoc?.shape === CONST.TOKEN_SHAPES.ELLIPSE_1 ||
        tokenDoc?.shape === CONST.TOKEN_SHAPES.ELLIPSE_2
    );
};

/**
 * Build one or more 3D occluder prisms for a creature token.
 * The prism shape depends on grid mode and token-shape settings (e.g., gridless circle uses an inscribed AABB).
 *
 * @param {TokenDocument} td                     The token document to build prisms for.
 * @param {CoverContext} ctx                     The cover evaluation context.
 * @returns {Array<{minX:number,minY:number,maxX:number,maxY:number,minZ:number,maxZ:number}>} The occluder prisms (AABBs) in canvas pixel space.
 */
export function buildCreaturePrism(td, ctx) {
    const { grid, halfGridSize, insetOccluderPx, distancePixels } = ctx;
    const elevation = Number(td?.elevation) || 0;
    const depth = Number(td?.depth) || 0;
    const distance = Number(grid?.distance) || 0;
    const zMin = elevation * distancePixels;
    let height = depth * distance;

    const actor = td?.actor;
    const proneMode = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURES_PRONE);

    if (actor?.statuses?.has?.("prone") && proneMode !== "none") {
        if (proneMode === "half") {
            height *= 0.5;
        }
        else if (proneMode === "lowerSize") {
            const depthLower = (depth > 1) ? Math.max(depth - 1, 0.5) : (depth * 0.5);
            height = depthLower * distance;
        }
    }

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

        return prisms;
    }
    else if (grid.isHexagonal) {
        const centers = td.getTestPoints({ depth: 0 });

        const halfNeighbor = Math.max(halfGridSize * 0.80, 0);
        let halfCenter = Math.max(radius * 0.60, 0);
        if (centers?.length === 1) {
            halfCenter = Math.max(radius * 0.80, 0);
        }

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

        prisms.push({
            minX: x - halfCenter + insetToCenter,
            minY: y - halfCenter + insetToCenter,
            maxX: x + halfCenter - insetToCenter,
            maxY: y + halfCenter - insetToCenter,
            minZ: zMin + 0.1,
            maxZ: zMax - 0.1
        });
        return prisms;
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
        return prisms;
    }
}

/**
 * Test whether sight-blocking walls obstruct the segment between two inset corners.
 * If wall-height is active, the intersection is additionally filtered by wall top/bottom values.
 *
 * @param {{x:number,y:number}} aCorner                                         The attacker corner
 * @param {{x:number,y:number}} bCorner                                         The target corner
 * @param {TokenDocument|Position} attackerDoc                                  The attacking token document OR a generic position {x,y,elevation?}.
 * @param {TokenDocument} targetDoc                                             The target token document.
 * @param {CoverContext} ctx                                                    The cover evaluation context.
 * @returns {{blocked:boolean, A:{x:number,y:number}, B:{x:number,y:number}}} Whether the segment is blocked and the tested inset segment.
 */
function wallsBlock(aCorner, bCorner, attackerDoc, targetDoc, ctx, losCheck = false) {
    const A = aCorner
    const B = bCorner
    const backend = CONFIG.Canvas.polygonBackends.sight;

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

    // https://github.com/foundryvtt/foundryvtt/issues/13736  Constrain getTestPoints() by Walls/Surfaces
    if (!collisions.length && (typeof attackerDoc.getCenterPoint === "function")) collisions = wallCollide(A, attackerDoc.getCenterPoint());
    if (!collisions.length) collisions = wallCollide(B, targetDoc.getCenterPoint()); // wait for https://github.com/foundryvtt/foundryvtt/issues/4509
    if (!collisions.length && !surfaceBlocked) {
        return { blocked: false, A, B };
    }

    if (!game.modules?.get?.("wall-height")?.active === true) { // wall-height obsolet in V14??
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
 * @param {{x:number,y:number}} A                The segment start point
 * @param {{x:number,y:number}} B                The segment end point
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

    const attHeight = (attackerDoc?.losHeight - attackerDoc?.elevation) || 0;
    const tgtHeight = (targetDoc?.losHeight - targetDoc?.elevation) || 0;

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
    const useCircleShape = grid.isGridless && isEllipse(td)

    const externalRadius = td?.object?.externalRadius ?? null
    if (externalRadius === null) return [{ x: center?.x, y: center?.y }];

    const radius = (externalRadius < halfGridSize) ? externalRadius : halfGridSize

    if (grid.isHexagonal) {
        return buildHexCorners(center, radius, inset, grid);
    }
    else if (useCircleShape) {
        return buildCircleCorners(center, radius, inset);
    }
    else return buildBoxCorners(center, radius, inset);
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
    const { grid, creaturePrisms, distancePixels, insetAttackerPx, insetTargetPx } = ctx;
    const creaturesHalfOnly = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.CREATURES_HALF_ONLY);

    // temp for workaround 
    const isAttackerCircleShape = grid.isGridless && isEllipse(attackerDoc)
    const isTargetCircleShape = grid.isGridless && isEllipse(targetDoc)

    const attackerId = attackerDoc?.object?.id ?? null;
    const targetId = targetDoc?.object?.id ?? null;
    const boxes = collectOccluderBoxes(creaturePrisms, attackerId, targetId, debugTokenShapes); // Add Broadcast Ray to limit tokens     

    const attackerVisionSource = attackerDoc?.getVisionOrigin();
    const targetVisionSource = targetDoc?.getVisionOrigin();

    let attackerSamples = attackerDoc?.getTestPoints({ depth: 0, elevation: attackerVisionSource?.elevation })
        ?? [{ x: attackerDoc.x, y: attackerDoc.y, elevation: attackerDoc?.elevation ?? 0 }];
    let targetSamples = targetDoc?.getTestPoints({ depth: 0, elevation: targetVisionSource?.elevation })
        ?? [{ x: targetDoc.x, y: targetDoc.y, elevation: targetDoc?.elevation ?? 0 }];

    const attackerZ = (attackerVisionSource?.elevation ?? attackerDoc?.elevation ?? 0) * distancePixels + 0.1;
    const targetZ = (targetVisionSource?.elevation ?? targetDoc?.elevation ?? 0) * distancePixels + 0.1;

    // workaround for https://github.com/foundryvtt/foundryvtt/issues/13830
    if (isAttackerCircleShape) attackerSamples = pullOnlyOuterCorners(attackerDoc, attackerSamples, 0.30);
    if (isTargetCircleShape) targetSamples = pullOnlyOuterCorners(targetDoc, targetSamples, 0.30);

    let best = { reachable: -1, coverLevel: 2, segs: [] };


    for (const tCenter of targetSamples) {
        const tgtCorners = buildTokenCornersForCenter(tCenter, ctx, targetDoc, insetTargetPx);
        if (!tgtCorners || !tgtCorners.length) continue;

        if (debugTokenShapes) debugTokenShapes.target.push(tgtCorners);

        const totalLinesForThisTarget = tgtCorners.length;

        for (const aCenter of attackerSamples) {
            const atkCorners = buildTokenCornersForCenter(aCenter, ctx, attackerDoc, insetAttackerPx);
            if (!atkCorners || !atkCorners.length) continue;

            if (debugTokenShapes) debugTokenShapes.attacker.push(atkCorners);

            for (const aCorner of atkCorners) {
                let blockedWalls = 0;
                let blockedCreatures = 0;
                const segs = [];

                for (const tCorner of tgtCorners) {
                    const wallResult = wallsBlock(aCorner, tCorner, attackerDoc, targetDoc, ctx);
                    const wBlocked = wallResult.blocked;

                    const attacker = { x: aCorner.x, y: aCorner.y, z: attackerZ };
                    const target = { x: tCorner.x, y: tCorner.y, z: targetZ };

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
                        a: aCorner,
                        b: tCorner,
                        blocked: isBlocked,
                        wBlocked,
                        cBlocked,
                        _tested: { a: wallResult.A, b: wallResult.B }
                    });

                    const breakAt = grid.isHexagonal ? 4 : (isTargetCircleShape ? 6 : 3);
                    if (!creaturesHalfOnly && (blockedWalls + blockedCreatures) >= breakAt) break;
                }

                const totalBlocked = blockedWalls + blockedCreatures;
                const reachable = totalLinesForThisTarget - totalBlocked;

                const threshold = grid.isHexagonal ? 4 : (isTargetCircleShape ? 6 : 3);

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

    for (const p of targetTestPoints) {
        const wallResult = wallsBlock(origin, p, attackerDoc, targetDoc, ctx, losCheck);
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
