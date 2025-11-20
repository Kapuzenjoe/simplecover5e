import { MODULE_ID, DEFAULT_SIZE_FT, SETTING_KEYS, GRID_MODES, getGridMode } from "../config/constants.config.mjs";
// =========================
// Geometry & occlusion
// =========================

/**
 * Build an immutable context for a single cover evaluation pass.
 * @param {Scene} scene
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
    return {
        scene,
        grid,
        gridMode,
        half,
        pxPerFt,
        insetPx: Math.min(grid.size * 0.20, 2.5),
        aabbErodePx: Math.min(grid.size * 0.10, 2.5),
        sizeFt
    };
}


function getSizeKey(td) {
    return (td.actor?.system?.traits?.size ?? "med").toLowerCase();
}

function getCreatureHeightFt(td, ctx) {
    const key = getSizeKey(td);
    return ctx.sizeFt[key] ?? 6;
}

/**
 * Compute a 3D AABB for a creature token (used as occluder).
 * @param {TokenDocument} td
 * @param {*} ctx
 */
export function buildCreaturePrism(td, ctx) {
    const grid = ctx.grid;
    const half = ctx.half;
    const er = ctx.aabbErodePx;
    const zMin = (td.elevation ?? 0) * ctx.pxPerFt;
    const zMax = zMin + getCreatureHeightFt(td, ctx) * ctx.pxPerFt;

    if (ctx.gridMode === GRID_MODES.GRIDLESS || ctx.gridMode === GRID_MODES.SQUARE) {
        const w = (td.width ?? 1) * grid.size;
        const h = (td.height ?? 1) * grid.size;
        return {
            minX: td.x + er,
            minY: td.y + er,
            maxX: td.x + w - er,
            maxY: td.y + h - er,
            minZ: zMin + 0.1,
            maxZ: zMax - 0.1
        };
    }

    const offs = td.getOccupiedGridSpaceOffsets?.() ?? [];
    const centers = offs.length ? offs.map(o => grid.getCenterPoint(o))
        : [grid.getCenterPoint({ x: td.x, y: td.y })];

    const isTiny = getSizeKey(td) === "tiny";
    const r = isTiny ? half * 0.5 : half;

    const xs = centers.map(c => [c.x - r, c.x + r]).flat();
    const ys = centers.map(c => [c.y - r, c.y + r]).flat();

    return {
        minX: Math.min(...xs) + er,
        minY: Math.min(...ys) + er,
        maxX: Math.max(...xs) - er,
        maxY: Math.max(...ys) - er,
        minZ: zMin + 0.1,
        maxZ: zMax - 0.1
    };
}


/**
 * Test if sight-blocking walls obstruct the segment from attackerCorner to targetCorner.
 * @param {{raw:{x:number,y:number}, inset:{x:number,y:number}}} aCorner 
 * @param {{raw:{x:number,y:number}, inset:{x:number,y:number}}} bCorner 
 * @param {PointSource|null} sightSource
 * @returns {{blocked:boolean, A:{x:number,y:number}, B:{x:number,y:number}}}
 */
function wallsBlock(aCorner, bCorner, sightSource) {
    const A = aCorner.inset;
    const B = bCorner.inset;
    const backend = CONFIG.Canvas.polygonBackends.sight;
    const collide = (P, Q) => backend.testCollision(P, Q, { type: "sight", mode: "any", source: sightSource });
    if (collide(A, B)) return { blocked: true, A, B };
    if (collide(aCorner.raw, A)) return { blocked: true, A, B };
    if (collide(bCorner.raw, B)) return { blocked: true, A, B };
    return { blocked: false, A, B };
}


function segIntersectsAABB3D(p, q, b) {
    let t0 = 0, t1 = 1;
    const d = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z };
    function clip(pv, qv) {
        if (pv === 0) return qv >= 0;
        const t = qv / pv;
        if (pv < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
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

// =========================
// Cover evaluation
// =========================

/**
 * Evaluate DMG cover for attacker -> target.
 * Draws lines from one best attacker corner to all corners of one best target cell (4 on square/gridless, 6 on hex).
 * Walls (sight) and other creatures (AABBs) block.
 * @param {TokenDocument} attackerDoc
 * @param {TokenDocument} targetDoc
 * @param {*} ctx
 * @param {{debug?:boolean}} [options]
 * @returns {{cover: "none"|"half"|"threeQuarters", debugSegments?:Array}}
 */
export function evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, options) {
    const debug = !!options?.debug;
    const { grid, gridMode } = ctx;
    const half = ctx.half;
    const insetPx = ctx.insetPx

    const getTokenSampleCenters = (td) => {
        if (gridMode === GRID_MODES.GRIDLESS || gridMode === GRID_MODES.SQUARE) {
            const wPx = (td.width ?? 1) * grid.size;
            const hPx = (td.height ?? 1) * grid.size;
            const cols = Math.max(1, Math.round(wPx / grid.size));
            const rows = Math.max(1, Math.round(hPx / grid.size));
            const cellW = wPx / cols;
            const cellH = hPx / rows;

            const centers = [];
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
        return offs.length
            ? offs.map(o => grid.getCenterPoint(o))
            : [grid.getCenterPoint({ x: td.x, y: td.y })];
    };


    const buildBoxCorners = (center, radius, insetPx) => {
        const raws = [
            { x: center.x - radius, y: center.y - radius },
            { x: center.x + radius, y: center.y - radius },
            { x: center.x + radius, y: center.y + radius },
            { x: center.x - radius, y: center.y + radius }
        ];
        return raws.map(raw => {
            const vx = raw.x - center.x, vy = raw.y - center.y;
            const L = Math.hypot(vx, vy) || 1;
            const inset = { x: raw.x - (vx / L) * insetPx, y: raw.y - (vy / L) * insetPx };
            return { raw, inset };
        });
    };

    const buildHexCorners = (center, insetPx) => {
        if (!grid || typeof grid.getOffset !== "function" || typeof grid.getVertices !== "function") {
            return null;
        }
        const coords = grid.getOffset(center);
        if (!coords) return null;
        const verts = grid.getVertices(coords);
        if (!Array.isArray(verts) || verts.length === 0) return null;

        const hexCenter = verts.reduce((acc, v) => {
            acc.x += v.x;
            acc.y += v.y;
            return acc;
        }, { x: 0, y: 0 });
        hexCenter.x /= verts.length;
        hexCenter.y /= verts.length;

        return verts.map(v => {
            const vx = v.x - hexCenter.x;
            const vy = v.y - hexCenter.y;
            const L = Math.hypot(vx, vy) || 1;

            const raw = { x: v.x, y: v.y };
            const inset = {
                x: v.x - (vx / L) * insetPx,
                y: v.y - (vy / L) * insetPx
            };
            return { raw, inset };
        });
    };

    const creaturePrisms = ctx.creaturePrisms;
    const attackerId = attackerDoc?.object?.id;
    const targetId = targetDoc?.object?.id;
    const boxes = [];
    creaturePrisms.forEach((box, id) => { if (id !== attackerId && id !== targetId) boxes.push(box); });

    const attackerZ = (attackerDoc.elevation ?? 0) * ctx.pxPerFt + 0.1;
    const targetZ = (targetDoc.elevation ?? 0) * ctx.pxPerFt + 0.1;
    const attackerSizeKey = getSizeKey(attackerDoc);
    const targetSizeKey = getSizeKey(targetDoc);
    const attackerSamples = getTokenSampleCenters(attackerDoc);
    const targetSamples = getTokenSampleCenters(targetDoc);
    const attackerRadius = attackerSizeKey === "tiny" ? half * 0.5 : half;
    const targetRadius = targetSizeKey === "tiny" ? half * 0.5 : half;

    const sightSource = attackerDoc?.object?.vision?.source ?? null;
    const creaturesHalfOnly = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.CREATURES_HALF_ONLY);

    let best = { reachable: -1, coverLevel: 2, segs: [] };

    for (const tCenter of targetSamples) {
        let tgtCorners;
        if (gridMode === GRID_MODES.HEX) {
            tgtCorners = buildHexCorners(tCenter, insetPx);
        } else {
            tgtCorners = buildBoxCorners(tCenter, targetRadius, insetPx);
        }
        if (!tgtCorners || !tgtCorners.length) continue;
        const totalLinesForThisTarget = tgtCorners.length;

        for (const aCenter of attackerSamples) {
            let atkCorners;
            if (gridMode === GRID_MODES.HEX) {
                atkCorners = buildHexCorners(aCenter, insetPx);
            } else {
                atkCorners = buildBoxCorners(aCenter, attackerRadius, insetPx);
            }
            if (!atkCorners || !atkCorners.length) continue;

            for (const aCorner of atkCorners) {
                let blockedWalls = 0;
                let blockedCreatures = 0;
                const segs = [];

                for (const tCorner of tgtCorners) {
                    const wb = wallsBlock(aCorner, tCorner, sightSource);
                    const wBlocked = wb.blocked;

                    const a3 = { x: aCorner.inset.x, y: aCorner.inset.y, z: attackerZ };
                    const b3 = { x: tCorner.inset.x, y: tCorner.inset.y, z: targetZ };
                    let cBlocked = false;
                    if (!wBlocked) {
                        for (let i = 0; i < boxes.length; i++) {
                            if (segIntersectsAABB3D(a3, b3, boxes[i])) { cBlocked = true; break; }
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
                        _tested: { a: wb.A, b: wb.B }
                    });

                    const breakAt = (gridMode === GRID_MODES.HEX) ? 4 : 3;
                    if (!creaturesHalfOnly && (blockedWalls + blockedCreatures) >= breakAt) break;
                }

                const totalBlocked = blockedWalls + blockedCreatures;
                const totalLines = totalLinesForThisTarget;
                const reachable = totalLines - totalBlocked;

                let coverLevel;
                if (creaturesHalfOnly) {
                    const wallsThreshold = (gridMode === GRID_MODES.HEX) ? 4 : 3;
                    if (blockedWalls >= wallsThreshold) coverLevel = 2;
                    else if (blockedWalls >= 1) coverLevel = 1;
                    else if (blockedCreatures >= 1) coverLevel = 1;
                    else coverLevel = 0;
                } else {
                    if (gridMode === GRID_MODES.HEX) {
                        coverLevel = totalBlocked >= 4 ? 2 : totalBlocked >= 1 ? 1 : 0;
                    } else {
                        coverLevel = totalBlocked >= 3 ? 2 : totalBlocked >= 1 ? 1 : 0;
                    }
                }

                if (reachable > best.reachable || (reachable === best.reachable && coverLevel < best.coverLevel)) {
                    best = { reachable, coverLevel, segs };
                    if (reachable === totalLines && coverLevel === 0) {
                        const cover = "none";
                        return debug ? { cover, debugSegments: best.segs } : { cover };
                    }
                }
            }
        }
    }

    const cover = best.coverLevel === 2 ? "threeQuarters" : best.coverLevel === 1 ? "half" : "none";
    return debug ? { cover, debugSegments: best.segs } : { cover };
}
