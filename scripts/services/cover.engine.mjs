import { MODULE_ID, DEFAULT_SIZE_FT, BASE_KEYS, SETTING_KEYS, GRID_MODES, getGridMode } from "../config/constants.config.mjs";

/**
 * Check whether the wall-height module is active.
 *
 * @returns {boolean} True if the wall-height module is currently active.
 */
function isWallHeightModuleActive() {
    return game.modules?.get?.("wall-height")?.active === true;
}

/**
 * Build an immutable context object for a single cover evaluation pass.
 * The context precomputes grid and setting values so they do not need to be recomputed for every ray.
 *
 * @param {Scene} scene - Scene for which cover should be evaluated.
 * @returns {object} Cover evaluation context containing grid, sizing and settings.
 */
export function buildCoverContext(scene) {
    const grid = scene.grid;
    const gridMode = getGridMode(grid);
    const half = grid.size / 2;
    const pxPerFt = grid.size / grid.distance;

    const saved = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURE_HEIGHTS) ?? {};
    const sizeFt = foundry.utils.mergeObject(
        DEFAULT_SIZE_FT,
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
        pxPerFt,
        insetPx: Math.min(grid.size * 0.20, 2.5),
        aabbErodePx: Math.min(grid.size * 0.10, 2.5),
        sizeFt
    };
}

/**
 * Get the size key for a token's actor as a normalized string.
 *
 * @param {TokenDocument} td - Token document whose actor size should be inspected.
 * @returns {string} The size key ("tiny", "sm", "med", "lg", "huge", "grg").
 */
function getSizeKey(td) {
    return (td.actor?.system?.traits?.size ?? "med").toLowerCase();
}

/**
 * Get the creature height in gridSize for a token document.
 * If wall-height is active, LOS height is used when available.
 *
 * @param {TokenDocument} td - Token document to read height for.
 * @param {object} ctx - Cover evaluation context returned by {@link buildCoverContext}.
 * @returns {number} The creature height in gridSize.
 */
function getCreatureHeightFt(td, ctx) {
    if (isWallHeightModuleActive()) {
        const token = td.object;
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
    return ctx.sizeFt[key] ?? 6;
}

/**
 * Compute pixel dimensions and center point for a token relative to the scene grid.
 *
 * @param {TokenDocument} td - Token document to measure.
 * @param {Grid} grid - Scene grid instance.
 * @returns {{width:number,height:number,centerX:number,centerY:number}} Token dimensions in pixels.
 */
function getTokenDimensions(td, grid) {
    const width = (td.width ?? 1) * grid.size;
    const height = (td.height ?? 1) * grid.size;
    const centerX = td.x + width / 2;
    const centerY = td.y + height / 2;
    return { width, height, centerX, centerY };
}

/**
 * Compute one or more 3D prisms for a creature token (used as occluders).
 * In gridless circle mode, a shrunken AABB is used that fits into the largest inscribed circle inside the token's bounding box.
 *
 * @param {TokenDocument} td - Token document to build occlusion prisms for.
 * @param {object} ctx - Cover evaluation context returned by {@link buildCoverContext}.
 * @returns {Array<{minX:number,minY:number,maxX:number,maxY:number,minZ:number,maxZ:number}>} One or more axis-aligned bounding boxes in 3D.        
 */
export function buildCreaturePrism(td, ctx) {
    const { grid, half, aabbErodePx: er, pxPerFt } = ctx;
    const zMin = (td.elevation ?? 0) * pxPerFt;
    let heightFt = getCreatureHeightFt(td, ctx);

    const actor = td.actor;
    const proneMode = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURES_PRONE);
    const wallHeightActive = isWallHeightModuleActive();

    if (actor?.statuses?.has?.("prone") && proneMode !== "none") {
        if (proneMode === "half") {
            heightFt *= 0.5;
        } else if (proneMode === "lowerSize") {
            if (!wallHeightActive) {
                const sizeKey = getSizeKey(td);
                const idx = BASE_KEYS.indexOf(sizeKey);
                const smallerKey = idx > 0 ? BASE_KEYS[idx - 1] : sizeKey;

                const heights = ctx.sizeFt ?? DEFAULT_SIZE_FT;
                heightFt = heights[smallerKey] ?? heightFt;
            } else {
                heightFt *= 0.5;
            }
        }
    }

    const zMax = zMin + heightFt * pxPerFt;

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
 * Test if sight-blocking walls obstruct the segment from one corner to another.
 * If wall-height is active, the ray is tested against wall top/bottom values.
 *
 * @param {{raw:{x:number,y:number}, inset:{x:number,y:number}}} aCorner - Attacker corner (raw & inset).
 * @param {{raw:{x:number,y:number}, inset:{x:number,y:number}}} bCorner - Target corner (raw & inset).
 * @param {PointSource|null} sightSource - Foundry sight source for collision tests.
 * @param {TokenDocument} attackerDoc - Attacker token document.
 * @param {TokenDocument} targetDoc - Target token document.
 * @param {object} ctx - Cover evaluation context.
 * @returns {{blocked:boolean, A:{x:number,y:number}, B:{x:number,y:number}}} Block information and the inset segment actually tested.
 */
function wallsBlock(aCorner, bCorner, sightSource, attackerDoc, targetDoc, ctx) {
    const A = aCorner.inset;
    const B = bCorner.inset;
    const backend = CONFIG.Canvas.polygonBackends.sight;
    const wallHeightActive = isWallHeightModuleActive();
    const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
    const activeGM = game.users?.activeGM;

    const collide = (P, Q) =>
        backend.testCollision(P, Q, { type: "sight", mode: "all", source: sightSource }) || [];

    let collisions = collide(A, B);

    if (!collisions.length) collisions = collide(aCorner.raw, A);
    if (!collisions.length) collisions = collide(bCorner.raw, B);
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

        const { lineZ, attZ, tgtZ } = getLineHeightAtVertex(A, B, vertex, attackerDoc, targetDoc, ctx);
        if (!Number.isFinite(lineZ)) continue;

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
                        attacker: { id: attackerDoc.id, zFt: attZ },
                        target: { id: targetDoc.id, z: tgtZ },
                        wall: { id: edge?.object?.document.id, bottom: wallBottom, top: wallTop },
                        lineZ,
                        tVertex: {
                            x: vertex.x,
                            y: vertex.y
                        }
                    }
                );
            }
            if (lineZ >= wallBottom && lineZ <= wallTop) {
                return { blocked: true, A, B };
            }
        }
    }
    return { blocked: false, A, B };
}

/**
 * Get the line height at the given vertex along the segment A->B.
 * Used to compare ray height against wall-height top/bottom values.
 *
 * @param {{x:number,y:number}} A - Start point of the inset segment (attacker corner).
 * @param {{x:number,y:number}} B - End point of the inset segment (target corner).
 * @param {{x:number,y:number}} vertex - Intersection vertex on the wall.
 * @param {TokenDocument} attackerDoc - Attacker token document.
 * @param {TokenDocument} targetDoc - Target token document.
 * @param {object} ctx - Cover evaluation context.
 * @returns {{lineZ:number, attZ:number, tgtZ:number}} Heights for the line and creatures.
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

    const attBottomFt = Number(attackerDoc.elevation ?? 0);
    const tgtBottomFt = Number(targetDoc.elevation ?? 0);

    const attHeightFt = getCreatureHeightFt(attackerDoc, ctx);
    const tgtHeightFt = getCreatureHeightFt(targetDoc, ctx);

    const attZ = attBottomFt + (Number.isFinite(attHeightFt) ? attHeightFt * 0.7 : 0);
    const tgtZ = tgtBottomFt + (Number.isFinite(tgtHeightFt) ? tgtHeightFt * 0.5 : 0);

    const lineZ = attZ + t * (tgtZ - attZ);

    return { lineZ, attZ, tgtZ };
}

/**
 * Test if a 3D segment intersects a 3D axis-aligned bounding box (AABB).
 * Uses a Liang–Barsky style clipping algorithm.
 *
 * @param {{x:number,y:number,z:number}} p - Start point of the 3D segment.
 * @param {{x:number,y:number,z:number}} q - End point of the 3D segment.
 * @param {{minX:number,minY:number,maxX:number,maxY:number,minZ:number,maxZ:number}} b - AABB to test against.
 * @returns {boolean} True if the segment intersects the AABB.
 */
function segIntersectsAABB3D(p, q, b) {
    //toDo: new alogorithm for hex grids
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
 * Compute grid-space center sample points used for cover evaluation.
 * The sampling pattern depends on grid mode and token size.
 *
 * @param {TokenDocument} td - Token document whose occupied space is sampled.
 * @param {object} ctx - Cover evaluation context returned by {@link buildCoverContext}.
 * @returns {Array<{x:number,y:number}>} List of sample centers in canvas pixels.
 */
function getTokenSampleCenters(td, ctx) {
    const { grid, gridMode, half, gridlessTokenShape } = ctx;
    const isGridless = gridMode === GRID_MODES.GRIDLESS;
    const isSquare = gridMode === GRID_MODES.SQUARE;
    const useCircleShape = isGridless && gridlessTokenShape === "circle";

    const centers = [];

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
 * Build a set of inset box corners around a center point.
 *
 * @param {{x:number,y:number}} center - Box center in canvas pixels.
 * @param {number} radius - Half of the box edge length in pixels.
 * @param {number} insetPx - Inset distance in pixels from each raw corner.
 * @returns {Array<{raw:{x:number,y:number}, inset:{x:number,y:number}}>}
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
   * @param {{x:number,y:number}} center - Center in canvas pixels.
   * @param {number} insetPx - Inset distance in pixels from each vertex.
   * @param {object} ctx - Cover evaluation context containing the grid.
   * @returns {Array<{raw:{x:number,y:number}, inset:{x:number,y:number}}>|null}
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
 * @param {{x:number,y:number}} center - Center of the circle in canvas pixels.
 * @param {number} radius - Radius of the circle in pixels.
 * @param {number} insetPx - Inset distance in pixels towards the center.
 * @returns {Array<{raw:{x:number,y:number}, inset:{x:number,y:number}}>}
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
 * @param {{x:number,y:number}} center - Approximate center point of the hex cell in canvas pixels.
 * @param {object} ctx - Cover evaluation context.
 * @returns {{cx:number,cy:number,halfW:number,halfH:number}|null}
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
 * Build inset token corners for a given sample center based on grid mode and shape.
 *
 * @param {{x:number,y:number}} center - Center point in canvas pixels.
 * @param {number} radius - Radius used for square/circle corner generation.
 * @param {number} insetPx - Inset distance in pixels from each corner.
 * @param {string} gridMode - Active grid mode constant.
 * @param {boolean} useCircleShape - Whether tokens are treated as circles in gridless mode.
 * @param {object} ctx - Cover evaluation context.
 * @returns {Array<{raw:{x:number,y:number}, inset:{x:number,y:number}}>|null}
 */
function buildTokenCornersForCenter(center, radius, insetPx, gridMode, useCircleShape, ctx, sizeKey) {
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
 * Flatten the creature prism map into a list of AABB boxes used as occluders.
 *
 * @param {Map<string,object|object[]>|undefined} creaturePrisms - Map of token id to prism(s).
 * @param {string|undefined} attackerId - Canvas object id of the attacking token.
 * @param {string|undefined} targetId - Canvas object id of the target token.
 * @param {{occluders:Array<Array<{x:number,y:number}>>}|null} debugTokenShapes - Optional debug accumulator.
 * @returns {Array<{minX:number,minY:number,maxX:number,maxY:number,minZ:number,maxZ:number}>}
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
 *
 * @param {TokenDocument} td - Token document to visualize.
 * @param {string} sizeKey - Normalized creature size key.
 * @param {Array<Array<{x:number,y:number}>>} bucket - Debug bucket to push shapes into.
 * @param {object} ctx - Cover evaluation context containing the grid.
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
 * Evaluate DMG cover for attacker -> target.
 * Draws lines from one best attacker corner to all corners of one best target cell (4 on square/gridless, 6 on hex). Walls (sight) and other creatures (AABBs) block.
 * 
 * toDO: in V14 use new Core Functions: https://github.com/foundryvtt/foundryvtt/issues/13683
 * 
 * @param {TokenDocument} attackerDoc - Token document of the attacking creature.
 * @param {TokenDocument} targetDoc - Token document of the target creature.
 * @param {object} ctx - Cover evaluation context created by {@link buildCoverContext}.
 * @param {{debug?:boolean}} [options] - Optional flags (e.g. debug shape output).
 * @returns {{cover: "none"|"half"|"threeQuarters", debugSegments?:Array, debugTokenShapes?:object}}   Cover result and optional debug information.
 */
export function evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, options = {}) {
    const debug = !!options.debug;
    const { gridMode, half } = ctx;
    const insetPx = ctx.insetPx;

    const debugTokenShapes = debug ? { attacker: [], target: [], occluders: [] } : null;

    const creaturePrisms = ctx.creaturePrisms;
    const attackerId = attackerDoc?.object?.id;
    const targetId = targetDoc?.object?.id;
    const boxes = collectOccluderBoxes(creaturePrisms, attackerId, targetId, debugTokenShapes);

    const attackerZ = (attackerDoc.elevation ?? 0) * ctx.pxPerFt + 0.1;
    const targetZ = (targetDoc.elevation ?? 0) * ctx.pxPerFt + 0.1;

    const attackerSizeKey = getSizeKey(attackerDoc);
    const targetSizeKey = getSizeKey(targetDoc);

    const attackerSamples = getTokenSampleCenters(attackerDoc, ctx);
    const targetSamples = getTokenSampleCenters(targetDoc, ctx);

    const attackerRadius = attackerSizeKey === "tiny" ? half * 0.5 : half;
    const targetRadius = targetSizeKey === "tiny" ? half * 0.5 : half;

    const sightSource = attackerDoc?.object?.vision?.source ?? null;
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
            debugTokenShapes.target.push(tgtCorners.map(c => c.raw));
        }

        const totalLinesForThisTarget = tgtCorners.length;

        for (const aCenter of attackerSamples) {
            const atkCorners = buildTokenCornersForCenter(aCenter, attackerRadius, insetPx, gridMode, useCircleShape, ctx, attackerSizeKey);
            if (!atkCorners || !atkCorners.length) continue;

            if (debugTokenShapes) {
                debugTokenShapes.attacker.push(atkCorners.map(c => c.raw));
            }

            for (const aCorner of atkCorners) {
                let blockedWalls = 0;
                let blockedCreatures = 0;
                const segs = [];

                for (const tCorner of tgtCorners) {
                    const wallResult = wallsBlock(aCorner, tCorner, sightSource, attackerDoc, targetDoc, ctx);
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

                let wallsThreshold;
                let totalBlockedThreshold;

                if (isHexGrid) {
                    wallsThreshold = 4;
                    totalBlockedThreshold = 4;
                } else if (isCircleMode) {
                    wallsThreshold = 6;
                    totalBlockedThreshold = 6;
                } else {
                    wallsThreshold = 3;
                    totalBlockedThreshold = 3;
                }

                let coverLevel;
                if (creaturesHalfOnly) {
                    if (blockedWalls >= wallsThreshold) coverLevel = 2;
                    else if (blockedWalls >= 1) coverLevel = 1;
                    else if (blockedCreatures >= 1) coverLevel = 1;
                    else coverLevel = 0;
                } else {
                    if (totalBlocked >= totalBlockedThreshold) coverLevel = 2;
                    else if (totalBlocked >= 1) coverLevel = 1;
                    else coverLevel = 0;
                }

                if (reachable > best.reachable || (reachable === best.reachable && coverLevel < best.coverLevel)) {
                    best = { reachable, coverLevel, segs };
                    if (reachable === totalLinesForThisTarget && coverLevel === 0) {
                        const cover = "none";
                        return debug ? { cover, debugSegments: best.segs, debugTokenShapes } : { cover };
                    }
                }
            }
        }
    }

    const cover = best.coverLevel === 2 ? "threeQuarters" : (best.coverLevel === 1 ? "half" : "none");
    return debug ? { cover, debugSegments: best.segs, debugTokenShapes } : { cover };
}