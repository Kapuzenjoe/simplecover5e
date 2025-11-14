import { MODULE_ID, DEFAULT_SIZE_FT, SETTING_KEYS } from "../config/constants.config.mjs";
// =========================
// Geometry & occlusion
// =========================

/**
 * Build an immutable context for a single cover evaluation pass.
 * @param {Scene} scene
 */
export function buildCoverContext(scene) {
    const grid = scene.grid;
    const pxPerFt = grid.size / grid.distance;

    const saved = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURE_HEIGHTS) ?? {};
    const base = foundry.utils.mergeObject(
        DEFAULT_SIZE_FT,
        saved,
        { inplace: false }
    );
    const sizeFt = {
        tiny: base.tiny,
        small: base.small,
        sm: base.small,
        medium: base.medium,
        med: base.medium,
        large: base.large,
        lg: base.large,
        huge: base.huge,
        gargantuan: base.gargantuan,
        grg: base.gargantuan
    };

    return {
        scene,
        grid,
        half: grid.size / 2,
        pxPerFt,
        insetPx: 3,
        lateralPx: Math.min(grid.size * 0.22, 3.5),
        aabbErodePx: Math.min(grid.size * 0.10, 2.5),
        sizeFt
    };
}


function getCreatureHeightFt(td, ctx) {
    const key = (td.actor?.system?.traits?.size ?? "med").toLowerCase();
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

    const offs = td.getOccupiedGridSpaceOffsets?.() ?? [];
    const centers = offs.length ? offs.map(o => grid.getCenterPoint(o))
        : [grid.getCenterPoint({ x: td.x, y: td.y })];

    const isTiny = (td.actor?.system?.traits?.size ?? "med").toLowerCase() === "tiny";
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
 * Four lines from one best attacker corner to the four (inset) corners of one best target grid.
 * Walls (sight) and other creatures (AABBs) block; tangents allowed.
 * @param {TokenDocument} attackerDoc
 * @param {TokenDocument} targetDoc
 * @param {*} ctx
 * @param {{debug?:boolean}} [options]
 * @returns {{cover: "none"|"half"|"threeQuarters", debugSegments?:Array}}
 */
export function evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, options) {
    const debug = !!options?.debug;
    const grid = ctx.grid;
    const half = ctx.half;

    const centersFromDoc = (td) => {
        const offs = td.getOccupiedGridSpaceOffsets?.() ?? [];
        return offs.length ? offs.map(o => grid.getCenterPoint(o))
            : [grid.getCenterPoint({ x: td.x, y: td.y })];
    };


    const makeCornerPair = (center, radius, insetPx) => {
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

    const baseZ = (td) => (td.elevation ?? 0) * ctx.pxPerFt + 0.1;

    const creaturePrisms = ctx.creaturePrisms;
    const attackerId = attackerDoc?.object?.id;
    const targetId = targetDoc?.object?.id;
    const boxes = [];
    creaturePrisms.forEach((box, id) => { if (id !== attackerId && id !== targetId) boxes.push(box); });

    const sizeKey = (targetDoc.actor?.system?.traits?.size ?? "med").toLowerCase();
    const targetRadius = sizeKey === "tiny" ? half * 0.5 : half;

    const attackerSquares = centersFromDoc(attackerDoc);
    const targetSquares = centersFromDoc(targetDoc);
    const sightSource = attackerDoc?.object?.vision?.source ?? null;

    let best = { reachable: -1, coverLevel: 2, segs: [] };

    for (const tCenter of targetSquares) {
        const tgtCorners = makeCornerPair(tCenter, targetRadius, Math.min(grid.size * 0.20, 2.5));
        for (const aCenter of attackerSquares) {
            const atkCorners = makeCornerPair(aCenter, half, Math.min(grid.size * 0.20, 2.5));
            for (const aCorner of atkCorners) {
                let blocked = 0;
                const segs = [];

                for (const tCorner of tgtCorners) {
                    const wb = wallsBlock(aCorner, tCorner, sightSource);
                    const wBlocked = wb.blocked;

                    const a3 = { x: aCorner.inset.x, y: aCorner.inset.y, z: baseZ(attackerDoc) };
                    const b3 = { x: tCorner.inset.x, y: tCorner.inset.y, z: baseZ(targetDoc) };
                    let cBlocked = false;
                    if (!wBlocked) {
                        for (let i = 0; i < boxes.length; i++) {
                            if (segIntersectsAABB3D(a3, b3, boxes[i])) { cBlocked = true; break; }
                        }
                    }

                    const isBlocked = wBlocked || cBlocked;
                    if (isBlocked) blocked += 1;
                    segs.push({
                        a: aCorner.inset,
                        b: tCorner.inset,
                        blocked: isBlocked,
                        _tested: { a: wb.A, b: wb.B }
                    });
                    if (blocked >= 3) break;
                }

                const reachable = 4 - blocked;
                const coverLevel = blocked >= 3 ? 2 : blocked >= 1 ? 1 : 0;

                if (reachable > best.reachable || (reachable === best.reachable && coverLevel < best.coverLevel)) {
                    best = { reachable, coverLevel, segs };
                    if (reachable === 4 && coverLevel === 0) break;
                }
            }
        }
    }

    const cover = best.coverLevel === 2 ? "threeQuarters" : best.coverLevel === 1 ? "half" : "none";
    return debug ? { cover, debugSegments: best.segs } : { cover };
}
