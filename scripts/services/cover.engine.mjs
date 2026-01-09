import { MODULE_ID, DEFAULT_SIZE, COVER, BASE_KEYS, SETTING_KEYS, GRID_MODES, getGridMode } from "../config/constants.config.mjs";

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
 * @property {number} insetPx
 * @property {number} aabbErodePx
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
 * Check whether the wall-height module is active.
 *
 * @returns {boolean}                              True if the wall-height module is currently active.
 */
function isWallHeightModuleActive() {
    return game.modules?.get?.("wall-height")?.active === true;
}

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

    const saved = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURE_HEIGHTS) ?? {};
    const size = foundry.utils.mergeObject(
        DEFAULT_SIZE,
        saved,
        { inplace: false }
    );
    const gridlessTokenShape = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_TOKEN_SHAPE) ?? "square";

    return {
        scene,
        grid,
        gridMode,
        gridlessTokenShape,
        half,
        pxPerGridSize,
        insetPx: Math.min(grid.size * 0.20, 2.5),
        aabbErodePx: Math.min(grid.size * 0.10, 2.5),
        size
    };
}

/**
 * Get the size key for a token's actor as a normalized string.
 *
 * @param {TokenDocument|Position} td           The token document OR a generic position {x,y,elevation?}..
 * @returns {string|null}                       The size key ("tiny", "sm", "med", "lg", "huge", "grg") or null.
 */
function getSizeKey(td) {
    const size = td?.actor?.system?.traits?.size;
    return size ? String(size).toLowerCase() : null;
}

/**
 * Get the creature height in gridSize for a token document.
 * If wall-height is active, the token's LoS height is used when available.
 *
 * @param {TokenDocument|Position} td             The token document OR a generic position {x,y,elevation?}.
 * @param {CoverContext} ctx                      The cover evaluation context.
 * @returns {number}                              The creature height in gridSize or 0.
 */
function getCreatureHeight(td, ctx) {
    if (!td?.actor) return 0;

    if (isWallHeightModuleActive()) {
        const token = td?.object;
        if (!token) return 0;
        
        const elevation = Number(td.elevation ?? 0);
        const losHeight = token ? Number(token.losHeight) : NaN;

        if (Number.isFinite(losHeight)) {
            const diff = losHeight - elevation;
            if (diff > 0) {
                const height = Math.ceil(diff * 100) / 100;
                if (Number.isFinite(height)) {
                    return height;
                }
            }
        }
    }
    const key = getSizeKey(td);
    if (!key) return 0;

    return ctx.size?.[key] ?? 0;
}

/**
 * Compute pixel dimensions and center point for a token relative to the scene grid.
 *
 * @param {TokenDocument} td                     Token document to measure.
 * @param {Grid} grid                            Scene grid instance.
 * @returns {{width:number,height:number,centerX:number,centerY:number}}    Token dimensions in pixels.
 */
function getTokenDimensions(td, grid) {
    const width = (td.width ?? 1) * grid.size;
    const height = (td.height ?? 1) * grid.size;
    const centerX = td.x + width / 2;
    const centerY = td.y + height / 2;
    return { width, height, centerX, centerY };
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
    const { grid, half, aabbErodePx: er, pxPerGridSize } = ctx;
    const zMin = (td.elevation ?? 0) * pxPerGridSize;
    let height = getCreatureHeight(td, ctx);

    const actor = td.actor;
    const proneMode = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURES_PRONE);
    const wallHeightActive = isWallHeightModuleActive();

    if (actor?.statuses?.has?.("prone") && proneMode !== "none") {
        if (proneMode === "half") {
            height *= 0.5;
        } else if (proneMode === "lowerSize") {
            if (!wallHeightActive) {
                const sizeKey = getSizeKey(td);
                const idx = BASE_KEYS.indexOf(sizeKey);
                const smallerKey = idx > 0 ? BASE_KEYS[idx - 1] : sizeKey;

                const heights = ctx.size ?? DEFAULT_SIZE;
                height = heights[smallerKey] ?? height;
            } else {
                height *= 0.5;
            }
        }
    }

    const zMax = zMin + height * pxPerGridSize;

    const prisms = [];
    const gridMode = ctx.gridMode;
    const sizeKey = getSizeKey(td);

    const { width: wPx, height: hPx, centerX: cx, centerY: cy } = getTokenDimensions(td, grid);


    if (gridMode === GRID_MODES.GRIDLESS && ctx.gridlessTokenShape === "circle") {
        const rCircle = Math.min(wPx, hPx) / 2;
        const innerHalf = rCircle / Math.SQRT2;
        const halfEff = Math.max(innerHalf, 0);

        prisms.push({
            minX: cx - halfEff,
            minY: cy - halfEff,
            maxX: cx + halfEff,
            maxY: cy + halfEff,
            minZ: zMin + 0.1,
            maxZ: zMax - 0.1
        });

        return prisms;
    }

    if (gridMode === GRID_MODES.GRIDLESS || gridMode === GRID_MODES.SQUARE) {
        prisms.push({
            minX: td.x + er,
            minY: td.y + er,
            maxX: td.x + wPx - er,
            maxY: td.y + hPx - er,
            minZ: zMin + 0.1,
            maxZ: zMax - 0.1
        });
        return prisms;
    }

    if (gridMode === GRID_MODES.HEX) {
        const offs = td.getOccupiedGridSpaceOffsets?.() ?? [];
        const centers = offs.length
            ? offs.map(o => grid.getCenterPoint(o))
            : [grid.getCenterPoint({ x: td.x, y: td.y })];

        const scale = sizeKey === "tiny" ? 0.5 : 1;

        let cellHalfW = 0;
        let cellHalfH = 0;
        for (const c of centers) {
            const innerRect = getHexCellInnerRect(c, ctx);

            const cellCx = innerRect?.cx ?? c.x;
            const cellCy = innerRect?.cy ?? c.y;

            cellHalfW = Math.max(((innerRect?.halfW) * scale) - er, 0);
            cellHalfH = Math.max(((innerRect?.halfH) * scale) - er, 0);

            prisms.push({
                minX: cellCx - cellHalfW,
                minY: cellCy - cellHalfH,
                maxX: cellCx + cellHalfW,
                maxY: cellCy + cellHalfH,
                minZ: zMin + 0.1,
                maxZ: zMax - 0.1
            });
        }

        const centerScale = (sizeKey === "huge") ? 2 : (sizeKey === "grg") ? 3 : 1;

        if (centers.length > 1 || centerScale > 1) {
            const baseHalf = Math.max(cellHalfW, cellHalfH);
            const fillHalf = Math.max((baseHalf * centerScale) - er, 0);

            prisms.push({
                minX: cx - fillHalf,
                minY: cy - fillHalf,
                maxX: cx + fillHalf,
                maxY: cy + fillHalf,
                minZ: zMin + 0.1,
                maxZ: zMax - 0.1
            });
        }

        return prisms;
    }

    const offs = td.getOccupiedGridSpaceOffsets?.() ?? [];
    const centers = offs.length
        ? offs.map(o => grid.getCenterPoint(o))
        : [grid.getCenterPoint({ x: td.x, y: td.y })];

    const isTiny = sizeKey === "tiny";
    const r = isTiny ? half * 0.5 : half;

    const xs = centers.map(c => [c.x - r, c.x + r]).flat();
    const ys = centers.map(c => [c.y - r, c.y + r]).flat();

    prisms.push({
        minX: Math.min(...xs) + er,
        minY: Math.min(...ys) + er,
        maxX: Math.max(...xs) - er,
        maxY: Math.max(...ys) - er,
        minZ: zMin + 0.1,
        maxZ: zMax - 0.1
    });
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

    const collide = (P, Q) =>
        backend.testCollision(P, Q, {
            type: "sight",
            mode: "all",
            useThreshold: true
        }) || [];

    let collisions = collide(A, B);

    if (!collisions.length && aCorner.raw) collisions = collide(aCorner.raw, A);
    if (!collisions.length && bCorner.raw) collisions = collide(bCorner.raw, B);
    if (!collisions.length) {
        return { blocked: false, A, B };
    }

    if (!wallHeightActive) {
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
                console.log(
                    `[${MODULE_ID}] wall-height line check:`,
                    {
                        attacker: { id: attackerDoc?.id, z: attZ },
                        target: { id: targetDoc.id, z: tgtZ },
                        wall: { id: edge?.object?.document.id, bottom: wallBottom, top: wallTop },
                        coverLineZ,
                        losLineZ,
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
 * Compute target/attacker sample centers used for cover evaluation.
 * The sampling pattern depends on grid mode, token shape settings, and creature size.
 *
 * @param {TokenDocument} td                      The token document to sample.
 * @param {CoverContext} ctx                      The cover evaluation context.
 * @returns {Array<{x:number,y:number}>}          The sample centers in canvas pixels.
 */
function getTokenSampleCenters(td, ctx) {
    const { grid, gridMode, half, gridlessTokenShape } = ctx;
    const isGridless = gridMode === GRID_MODES.GRIDLESS;
    const isSquare = gridMode === GRID_MODES.SQUARE;
    const useCircleShape = isGridless && gridlessTokenShape === "circle";

    const centers = [];

    if (!td?.actor && typeof td.x === "number" && typeof td.y === "number") {
        return [{ x: td.x, y: td.y }];
    }

    if (useCircleShape) {
        const { width: wPx, height: hPx, centerX: cx, centerY: cy } = getTokenDimensions(td, grid);
        const bigRadius = Math.min(wPx, hPx) / 2;
        const mediumRadius = half;
        const sizeKey = getSizeKey(td);

        if (sizeKey === "tiny" || sizeKey === "sm" || sizeKey === "med") {
            centers.push({ x: cx, y: cy });
            return centers;
        }

        if (sizeKey === "lg") {
            const r1 = bigRadius - mediumRadius;

            centers.push({ x: cx + r1, y: cy });
            centers.push({ x: cx - r1, y: cy });
            centers.push({ x: cx, y: cy + r1 });
            centers.push({ x: cx, y: cy - r1 });

            return centers;
        }

        if (sizeKey === "huge") {
            const r1 = bigRadius - mediumRadius;
            const diag = r1 / Math.SQRT2;

            // centers.push({ x: cx, y: cy });
            centers.push({ x: cx + r1, y: cy });
            centers.push({ x: cx - r1, y: cy });
            centers.push({ x: cx, y: cy + r1 });
            centers.push({ x: cx, y: cy - r1 });

            centers.push({ x: cx + diag, y: cy + diag });
            centers.push({ x: cx + diag, y: cy - diag });
            centers.push({ x: cx - diag, y: cy + diag });
            centers.push({ x: cx - diag, y: cy - diag });

            return centers;
        }

        if (sizeKey === "grg") {
            const rOuter = bigRadius - mediumRadius;
            const diag = rOuter / Math.SQRT2;
            const inner = mediumRadius;

            // centers.push({ x: cx + inner, y: cy + inner });
            // centers.push({ x: cx + inner, y: cy - inner });
            // centers.push({ x: cx - inner, y: cy + inner });
            // centers.push({ x: cx - inner, y: cy - inner });

            centers.push({ x: cx + rOuter, y: cy });
            centers.push({ x: cx - rOuter, y: cy });
            centers.push({ x: cx, y: cy + rOuter });
            centers.push({ x: cx, y: cy - rOuter });

            centers.push({ x: cx + diag, y: cy + diag });
            centers.push({ x: cx + diag, y: cy - diag });
            centers.push({ x: cx - diag, y: cy + diag });
            centers.push({ x: cx - diag, y: cy - diag });

            return centers;
        }
    }

    if (isGridless || isSquare) {
        const { width: wPx, height: hPx } = getTokenDimensions(td, grid);
        const gridSize = grid.size || 1;
        const cols = Math.max(1, Math.round(wPx / gridSize));
        const rows = Math.max(1, Math.round(hPx / gridSize));
        const cellW = wPx / cols;
        const cellH = hPx / rows;

        for (let ix = 0; ix < cols; ix++) {
            for (let iy = 0; iy < rows; iy++) {
                centers.push({
                    x: td.x + (ix + 0.5) * cellW,
                    y: td.y + (iy + 0.5) * cellH
                });
            }
        }
        return centers;
    }

    const offs = td.getOccupiedGridSpaceOffsets?.() ?? [];
    if (offs.length) {
        return offs.map(o => grid.getCenterPoint(o));
    }

    return [grid.getCenterPoint({ x: td.x, y: td.y })];
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
            y: raw.y - (vy / L) * insetPx
        };
        return { raw, inset };
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
function buildHexCorners(center, insetPx, ctx, scale = 1) {
    const { grid } = ctx;

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
            y: raw.y - (vy / L) * insetPx
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
            y: raw.y - (vy / L) * insetPx
        };

        corners.push({ raw, inset });
    }

    return corners;
}

/**
 * Compute an axis-aligned rectangle which fits well *inside* a single hex cell.
 *
 * @param {{x:number,y:number}} center                  Approximate center point of the hex cell in canvas pixels.
 * @param {object} ctx                                  Cover evaluation context.
 * @returns {{cx:number,cy:number,halfW:number,halfH:number}|null} The inner rectangle parameters, or null if unavailable.
 */
function getHexCellInnerRect(center, ctx) {
    const { grid } = ctx;

    const coords = grid.getOffset(center);
    if (!coords) return null;

    const verts = grid.getVertices(coords);
    if (!Array.isArray(verts) || verts.length < 6) return null;

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

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of verts) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return null;
    }

    const bbW = Math.max(0, maxX - minX);
    const bbH = Math.max(0, maxY - minY);

    const EPS = 1e-3;
    const topCount = verts.filter(v => Math.abs(v.y - maxY) <= EPS).length;
    const flatTop = topCount >= 2;

    const halfW = flatTop ? (bbW / 4) : (bbW / 2);
    const halfH = flatTop ? (bbH / 2) : (bbH / 4);

    return {
        cx: hexCenter.x,
        cy: hexCenter.y,
        halfW,
        halfH
    };
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
function buildTokenCornersForCenter(center, radius, insetPx, gridMode, useCircleShape, ctx, sizeKey) {
    if (sizeKey === null) return [{ raw: null, inset: { x: center?.x, y: center?.y } }];

    if (gridMode === GRID_MODES.HEX) {
        const scale = (sizeKey === "tiny") ? 0.5 : 1;
        return buildHexCorners(center, insetPx, ctx, scale);
    }
    if (useCircleShape) {
        return buildCircleCorners(center, radius, insetPx);
    }
    return buildBoxCorners(center, radius, insetPx);
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
function addBigCircleDebug(td, sizeKey, bucket, ctx) {
    if (sizeKey !== "lg" && sizeKey !== "huge" && sizeKey !== "grg") return;

    const { grid } = ctx;
    const { width, height, centerX: cx, centerY: cy } = getTokenDimensions(td, grid);
    const bigRadius = Math.min(width, height) / 2;

    const bigCorners = buildCircleCorners({ x: cx, y: cy }, bigRadius, 0);
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
 * // TODO (Foundry v14+): consider core LoS/occlusion helpers once available.
 */
export function evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, options = {}) {
    const debug = !!options.debug;
    const { gridMode, half } = ctx;
    const insetPx = ctx.insetPx;

    const debugTokenShapes = debug ? { attacker: [], target: [], occluders: [] } : null;

    const creaturePrisms = ctx.creaturePrisms;
    const attackerId = attackerDoc?.object?.id ?? null;
    const targetId = targetDoc?.object?.id;
    const boxes = collectOccluderBoxes(creaturePrisms, attackerId, targetId, debugTokenShapes);

    const attackerZ = (attackerDoc?.elevation ?? 0) * ctx.pxPerGridSize + 0.1;
    const targetZ = (targetDoc.elevation ?? 0) * ctx.pxPerGridSize + 0.1;

    const attackerSizeKey = getSizeKey(attackerDoc);
    const targetSizeKey = getSizeKey(targetDoc);

    const attackerSamples = getTokenSampleCenters(attackerDoc, ctx);
    const targetSamples = getTokenSampleCenters(targetDoc, ctx);

    const attackerRadius = attackerSizeKey === "tiny" ? half * 0.5 : half;
    const targetRadius = targetSizeKey === "tiny" ? half * 0.5 : half;

    const creaturesHalfOnly = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.CREATURES_HALF_ONLY);

    let best = { reachable: -1, coverLevel: 2, segs: [] };

    const isGridless = gridMode === GRID_MODES.GRIDLESS;
    const useCircleShape = isGridless && ctx.gridlessTokenShape === "circle";
    const isHexGrid = gridMode === GRID_MODES.HEX;
    const isCircleMode = useCircleShape;

    if (debugTokenShapes && useCircleShape) {
        addBigCircleDebug(attackerDoc, attackerSizeKey, debugTokenShapes.attacker, ctx);
        addBigCircleDebug(targetDoc, targetSizeKey, debugTokenShapes.target, ctx);
    }

    for (const tCenter of targetSamples) {
        const tgtCorners = buildTokenCornersForCenter(tCenter, targetRadius, insetPx, gridMode, useCircleShape, ctx, targetSizeKey);
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
            const atkCorners = buildTokenCornersForCenter(aCenter, attackerRadius, insetPx, gridMode, useCircleShape, ctx, attackerSizeKey);
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

                    const a3 = { x: aCorner.inset.x, y: aCorner.inset.y, z: attackerZ };
                    const b3 = { x: tCorner.inset.x, y: tCorner.inset.y, z: targetZ };

                    let cBlocked = false;
                    if (!wBlocked) {
                        for (let i = 0; i < boxes.length; i++) {
                            if (segIntersectsAABB3D(a3, b3, boxes[i])) {
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

                    const breakAt = isHexGrid ? 4 : (isCircleMode ? 6 : 3);
                    if (!creaturesHalfOnly && (blockedWalls + blockedCreatures) >= breakAt) break;
                }

                const totalBlocked = blockedWalls + blockedCreatures;
                const reachable = totalLinesForThisTarget - totalBlocked;

                const threshold = isHexGrid ? 4 : (isCircleMode ? 6 : 3);

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
 * The test samples a 3×3 grid around the target center using Foundry-like tolerance and reports which points are blocked.
 *
 * @param {TokenDocument|Position} attackerDoc    The attacking token document OR a generic position {x,y,elevation?}.
 * @param {TokenDocument} targetDoc               The target token document.
 * @param {CoverContext} ctx                      The cover evaluation context.
 * @returns {LosResult}                           The LoS result and sampled target points.
 */
export function evaluateLOS(attackerDoc, targetDoc, ctx) {
    const targetToken = targetDoc?.object;
    const attackerToken = attackerDoc?.object;

    if (!attackerDoc || !targetToken) return { hasLOS: true, targetLosPoints: [] };

    const targetCenter = { x: targetToken.center.x, y: targetToken.center.y };
    const origin = attackerToken ? { x: attackerToken.center.x, y: attackerToken.center.y } : { x: attackerDoc.x, y: attackerDoc.y };

    const gridSize = ctx?.grid?.size ?? 0;
    const wPx = (Number(targetDoc.width ?? 1) || 1) * gridSize;
    const hPx = (Number(targetDoc.height ?? 1) || 1) * gridSize;
    const tol = Math.min(wPx, hPx) / 4;

    const t = Number.isFinite(tol) && tol > 0 ? tol : 0;

    const offsets = [
        { x: 0, y: 0 },
        { x: -t, y: -t },
        { x: -t, y: t },
        { x: t, y: t },
        { x: t, y: -t },
        { x: -t, y: 0 },
        { x: t, y: 0 },
        { x: 0, y: -t },
        { x: 0, y: t }
    ];

    const targetPoints = offsets.map(o => ({ x: targetCenter.x + o.x, y: targetCenter.y + o.y }));

    const targetLosPoints = [];
    let hasLOS = false;
    const losCheck = true;

    for (const p of targetPoints) {
        const originPoint = { raw: null, inset: origin };
        const targetPoint = { raw: null, inset: p };
        const wallResult = wallsBlock(originPoint, targetPoint, attackerDoc, targetDoc, ctx, losCheck);
        targetLosPoints.push({ x: p.x, y: p.y, blocked: wallResult.blocked });
        if (!wallResult.blocked) hasLOS = true;
    }

    return {
        hasLOS,
        targetLosPoints
    };
}
