import { MODULE_ID } from "../constants.mjs";

export function newIgonoreCoverType() {
  CONFIG.DND5E.itemProperties.ignoreCover = {
    label: "Ignores Cover"
  };
  CONFIG.DND5E.validProperties.weapon.add("ignoreCover");
  CONFIG.DND5E.validProperties.spell.add("ignoreCover");
  CONFIG.DND5E.validProperties.feat.add("ignoreCover");
}

/**
 * Walk up from the event target to the source chat message element and return the ChatMessage.
 * Robust gegen Shadow DOM dank composedPath; sucht nach [data-message-id] / .chat-message.
 * @param {Event} ev
 * @returns {ChatMessage|null}
 */
function getSourceChatMessageFromEvent(ev) {
  if (!ev) return null;

  const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];
  const candidates = [];
  if (Array.isArray(path)) candidates.push(...path);
  if (ev.target) candidates.push(ev.target);

  let el = null;
  for (const n of candidates) {
    if (!(n instanceof Element)) continue;
    el = n.closest?.("[data-message-id]") ?? n.closest?.(".chat-message");
    if (el) break;
  }
  if (!el) return null;
 
  const mid = el.dataset?.messageId ?? el.getAttribute?.("data-message-id");
  if (!mid) return null;

  const msg = game.messages?.get?.(mid) ?? null;
  return msg ?? null;
}



// =========================
// Config
// =========================

/** Map your system's status IDs here */
const COVER_STATUS_IDS = {
  half: "coverHalf",
  threeQuarters: "coverThreeQuarters"
  //total: "coverTotal"
};

// =========================
// Public Hooks (exports)
// =========================

/** A hook event that fires before a roll is performed.
 * @function dnd5e.preRollAttack
 * @memberof hookEvents
 * @param {BasicRollProcessConfiguration} config Configuration information for the roll.
 * @param {BasicRollDialogConfiguration} dialog Configuration for the roll dialog.
 * @param {BasicRollMessageConfiguration} message Configuration for the roll message.
 * @returns
 */
export function onPreRollAttack(config, dialog, message) {
  console.log(config)
  const actor = config.subject?.actor ?? config.subject;
  const attackerToken =
    actor?.token?.object ??
    actor?.getActiveTokens?.()[0] ??
    canvas.tokens?.controlled?.[0] ?? null;
  if (!attackerToken) return;
  const item = config.subject.item

  const targets = Array.from(game.user?.targets ?? []).filter(t => t?.document && !t.document.actor?.defeated);
  if (!targets.length) return;

  const ctx = buildCoverContext(canvas.scene);
  ctx.creaturePrisms = new Map(canvas.tokens.placeables.map(t => [t.id, buildCreaturePrism(t.document, ctx)]));

  const debugOn = !!game.settings?.get?.("simplecover5e", "debugCover");
  if (debugOn && game.users.activeGM) clearCoverDebug();

  for (const t of targets) {
    const res = evaluateCoverFromOccluders(attackerToken.document, t.document, ctx, { debug: debugOn });
    if (debugOn && res.debugSegments && res.debugSegments.length > 0 && game.users.activeGM) drawCoverDebug({ segments: res.debugSegments });

    let wantId =
      res.cover === "threeQuarters" ? COVER_STATUS_IDS.threeQuarters :
        res.cover === "half" ? COVER_STATUS_IDS.half :
          null;
    if (spellIgnoresCover(item, config)) wantId = null;

    const targetActor = t.document.actor;
    const targetActorId = targetActor.uuid; //

    const onHalf = targetActor.statuses?.has?.(COVER_STATUS_IDS.half);
    const onThree = targetActor.statuses?.has?.(COVER_STATUS_IDS.threeQuarters);

    // k = half
    if ((wantId === COVER_STATUS_IDS.half) && !onHalf) {
      adjustMessageTargetAC(message, targetActorId, +2);
      if (config.target !== undefined) {
        const cur = Number(config.target ?? 0) || 0;
        config.target = Math.max(0, cur + 2);
      }
      toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.half, true);
    } else if ((wantId !== COVER_STATUS_IDS.half) && onHalf) {
      adjustMessageTargetAC(message, targetActorId, -2);
      if (config.target !== undefined) {
        const cur = Number(config.target ?? 0) || 0;
        config.target = Math.max(0, cur + 2);
      }
      toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.half, false);
    }

    // k = three-quarters
    if ((wantId === COVER_STATUS_IDS.threeQuarters) && !onThree) {
      adjustMessageTargetAC(message, targetActorId, +5);
      if (config.target !== undefined) {
        const cur = Number(config.target ?? 0) || 0;
        config.target = Math.max(0, cur + 5);
      }
      toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.threeQuarters, true);
    } else if ((wantId !== COVER_STATUS_IDS.threeQuarters) && onThree) {
      adjustMessageTargetAC(message, targetActorId, -5);
      if (config.target !== undefined) {
        const cur = Number(config.target ?? 0) || 0;
        config.target = Math.max(0, cur - 5);
      }
      toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.threeQuarters, false);
    }
  }
};

/** A hook event that fires before a roll is performed.
 * @function dnd5e.preRollSavingThrow
 * @memberof hookEvents
 * @param {BasicRollProcessConfiguration} config Configuration information for the roll.
 * @param {BasicRollDialogConfiguration} dialog Configuration for the roll dialog.
 * @param {BasicRollMessageConfiguration} message Configuration for the roll message.
 * @returns
 */
export function onPreRollSavingThrow(config, dialog, message) {
  const actor = config.subject
  const targetToken = actor.getActiveTokens?.()[0]
  const srcMsg = getSourceChatMessageFromEvent(config?.event);
  const item = srcMsg.getAssociatedItem();
  const sourceActor = srcMsg?.speakerActor
  const sourceToken = sourceActor?.getActiveTokens?.()[0]
  const ctx = buildCoverContext(canvas.scene);
  ctx.creaturePrisms = new Map(canvas.tokens.placeables.map(t => [t.id, buildCreaturePrism(t.document, ctx)]));

  const debugOn = !!game.settings?.get?.("simplecover5e", "debugCover");
  if (debugOn && game.users.activeGM) clearCoverDebug();

  const res = evaluateCoverFromOccluders(sourceToken.document, targetToken.document, ctx, { debug: debugOn });
  if (debugOn && res.debugSegments && res.debugSegments.length > 0 && game.users.activeGM) drawCoverDebug({ segments: res.debugSegments });

  let wantId =
    res.cover === "threeQuarters" ? COVER_STATUS_IDS.threeQuarters :
      res.cover === "half" ? COVER_STATUS_IDS.half :
        null;
  if (spellIgnoresCover(item, config)) wantId = null;
  const targetActorId = actor.uuid;
  const onHalf = actor.statuses?.has?.(COVER_STATUS_IDS.half);
  const onThree = actor.statuses?.has?.(COVER_STATUS_IDS.threeQuarters);

  const ability = config.ability;
  const isDex = ability === "dex"

  // k = half
  if ((wantId === COVER_STATUS_IDS.half) && !onHalf) {
    if (isDex) config.rolls[0].parts.push("2");
    toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.half, true);
  } else if ((wantId !== COVER_STATUS_IDS.half) && onHalf) {
    if (isDex) {
      const i = config.rolls[0].parts.findIndex(x => x === "@cover");
      if (i !== -1) config.rolls[0].parts.splice(i, 1);
    }
    toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.half, false);
  }

  // k = three-quarters
  if ((wantId === COVER_STATUS_IDS.threeQuarters) && !onThree) {
    if (isDex) config.rolls[0].parts.push("5");
    toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.threeQuarters, true);
  } else if ((wantId !== COVER_STATUS_IDS.threeQuarters) && onThree) {
    if (isDex) {
      const i = config.rolls[0].parts.findIndex(x => x === "@cover");
      if (i !== -1) config.rolls[0].parts.splice(i, 1);
    }
    toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.threeQuarters, false);
  }


}

/**
 * Adjust the shown AC of a specific target in the pending dnd5e chat message.
 * Looks up the target by UUID and adds 'delta' to its AC.
 * Safely no-ops if structure doesn't match.
 * @param {object} message         The hook's 'message' arg
 * @param {string} targetUuid      TokenDocument UUID to match
 * @param {number} delta           +2 / +5 (or negative to subtract)
 */
function adjustMessageTargetAC(message, targetUuid, delta) {
  const targets = message?.data?.flags?.dnd5e?.targets;
  if (!Array.isArray(targets) || !targetUuid || !delta) return;
  for (const t of targets) {
    const uuid = t?.uuid ?? t?.tokenUuid ?? null;
    if (!uuid || uuid !== targetUuid) continue;

    const base = Number(t.ac ?? 0);
    const next = (Number.isFinite(base) ? base : 0) + delta;
    t.ac = next;
    break;
  }
}

/**
 * Toggle a cover status effect on an actor, using GM authority if needed.
 * @param {string} actorUuid  Actor or TokenDocument Actor UUID
 * @param {string} effectId   StatusEffect id (e.g., COVER_STATUS_IDS.half)
 * @param {boolean} enable    true to enable, false to disable
 */
async function toggleCoverEffectViaGM(actorUuid, effectId, enable) {
  const gm = game.users.activeGM;
  if (!gm) { console.warn("[cover] no active GM"); return false; }
  try {
    const res = await gm.query(`${MODULE_ID}.toggleCover`, { actorUuid, effectId, enable }, { timeout: 8000 });
    return !!res?.ok;
  } catch (e) {
    console.warn("[cover] GM query failed:", e);
    return false;
  }
}


/**
 * Return true if cover should be skipped for this roll due to spell-specific rules.
 * @param {Item5e|Activity} item
 * @param {object} config    // dein preRollAttack / preRollSave config
 */
function spellIgnoresCover(item, config) {
  const name = (item?.name ?? "").trim();
  //if(item.system.properties.has("ignoreCover")) return true;

  //if (SPELLS_IGNORE_COVER.has(name)) return true;

  // Optional: Feat-Interaktionen
  // Spell Sniper -> Ranged Spell Attacks ignore half/three-quarters cover.
  // if (isRangedSpellAttack(config) && actorHasSpellSniper(item?.actor)) return true;

  return false;
}


/**
 * Recalculate cover when the combat turn or round changes.
 * @param {Combat} combat
 * @param {object} update
 */
export async function calcCoverOnUpdateCombat(combat, update) {
  try {
    if (!game.users.activeGM?.isSelf) return;
    await clearAllCoverInCombat(combat);
    await clearCoverDebug();
  } catch (err) {
    console.warn("[cover] clear on delete combat", err);
  }
}

/**
 * Recalculate cover after a token has finished moving during an active combat.
 * @param {TokenDocument} token                 The existing TokenDocument which was updated
 * @param {TokenMovementOperation} movement     The movement of the Token
 * @param {DatabaseUpdateOperation} operation   The update operation that contains the movement
 * @param {User} user                           The User that requested the update operation
 */
export async function calcCoverOnMovement(token, movement, operation, user) {
  try {
    if (!game.users.activeGM?.isSelf) return;
    await clearAllCoverInCombat(combat);
    await clearCoverDebug();
  } catch (err) {
    console.warn("[cover] clear on delete combat", err);
  }
}

/**
 * Cleanup when a combat is deleted.
 * @param {Combat} combat
 */
export async function clearCoverOnDeleteCombat(combat) {
  try {
    if (!game.users.activeGM?.isSelf) return;
    await clearAllCoverInCombat(combat);
    await clearCoverDebug();
  } catch (err) {
    console.warn("[cover] clear on delete combat", err);
  }
}



// =========================
// Status
// =========================


async function clearAllCoverInCombat(combat) {
  for (const combatant of (combat.turns ?? [])) {
    const actor = combatant?.actor;
    const ids = Object.values(COVER_STATUS_IDS);
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      if (actor.statuses?.has?.(id)) await actor.toggleStatusEffect(id);
    }
  }
}


// =========================
// Geometry & occlusion
// =========================

/** Build immutable context for one cover pass. */
function buildCoverContext(scene) {
  const grid = scene.grid;
  const pxPerFt = grid.size / grid.distance;
  return {
    scene,
    grid,
    half: grid.size / 2,
    pxPerFt,
    insetPx: 3,                      // 2px Start/End-Offset
    lateralPx: Math.min(grid.size * 0.22, 3.5), // Parallel-Ray-Offset
    aabbErodePx: Math.min(grid.size * 0.10, 2.5), // AABBs leicht schrumpfen
    sizeFt: { tiny: 1, sm: 3, small: 3, med: 6, medium: 6, lg: 12, large: 12, huge: 24, grg: 48, gargantuan: 48 }
  };
}

/** Default creature height in ft by size. */
function getCreatureHeightFt(td, ctx) {
  const key = (td.actor?.system?.traits?.size ?? "med").toLowerCase();
  return ctx.sizeFt[key] ?? 6;
}

/** Axis-aligned 3D box of a token used as occluder (slightly eroded in X/Y). */
function buildCreaturePrism(td, ctx) {
  const grid = ctx.grid;
  const half = ctx.half;
  const er = ctx.aabbErodePx;
  const zMin = (td.elevation ?? 0) * ctx.pxPerFt;          // Bodenhöhe
  const zMax = zMin + getCreatureHeightFt(td, ctx) * ctx.pxPerFt;

  const offs = td.getOccupiedGridSpaceOffsets?.() ?? [];
  const centers = offs.length ? offs.map(o => grid.getCenterPoint(o))
    : [grid.getCenterPoint({ x: td.x, y: td.y })];

  // Tiny: halbe Kantenlänge
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
 *
 * @param {{raw:{x:number,y:number}, inset:{x:number,y:number}}} aCorner  Angreifer-Ecke (roh + inset)
 * @param {{raw:{x:number,y:number}, inset:{x:number,y:number}}} bCorner  Ziel-Ecke (roh + inset)
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



/** Liang–Barsky in 3D: true if *proper* intersection (tangents don't block). */
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


// =========================
// debug
// =========================


async function drawCoverDebug({ segments }) {
  if (!segments || segments.length === 0) return;
  const docs = [];
  const count = Math.min(4, segments.length);

  for (let i = 0; i < count; i += 1) {
    const s = segments[i];
    const A = s._tested?.a ?? s.a;
    const B = s._tested?.b ?? s.b;
    docs.push({
      shape: { type: "p", points: [A.x, A.y, B.x, B.y] },
      strokeColor: s.blocked ? "#ff2d55" : "#34c759",
      strokeAlpha: 0.95,
      strokeWidth: 4,
      fillAlpha: 0,
      flags: { "simplecover5e": { coverDebug: true } }
    });
  }
  await canvas.scene.createEmbeddedDocuments("Drawing", docs);
}

export async function clearCoverDebug() {
  const toDelete = [];
  const drawings = canvas.scene.drawings;
  for (let i = 0; i < drawings.size; i += 1) {
    const d = drawings.contents[i];
    if (d.getFlag("simplecover5e", "coverDebug")) toDelete.push(d.id);
  }
  if (toDelete.length > 0) await canvas.scene.deleteEmbeddedDocuments("Drawing", toDelete);
}
