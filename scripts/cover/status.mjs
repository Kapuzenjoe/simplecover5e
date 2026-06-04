import { MODULE_ID, SETTING_KEYS, COVER } from "../config.mjs";

/**
 * Apply a cover status directly on the current client.
 * Requires the caller to have write permission on the actor.
 *
 * @param {Actor5e} actor The actor to update.
 * @param {"none"|"half"|"threeQuarters"|"total"} cover The desired cover level.
 * @returns {Promise<void>}
 */
async function _applyCoverStatus(actor, cover) {
  const desiredStatusId = COVER.IDS[cover];
  for (const statusId of [COVER.IDS.total, COVER.IDS.threeQuarters, COVER.IDS.half]) {
    if (statusId !== desiredStatusId && actor.statuses.has(statusId)) {
      await actor.toggleStatusEffect(statusId, { active: false, overlay: false });
    }
  }
  if (desiredStatusId && !actor.statuses.has(desiredStatusId)) {
    await actor.toggleStatusEffect(desiredStatusId, { active: true, overlay: false });
  }
}

/**
 * Register GM query handlers used to synchronize dnd5e cover statuses.
 *
 * @returns {void}
 */
export function initCoverStatusQueries() {
  CONFIG.queries ??= {};
  if (CONFIG.queries[`${MODULE_ID}.setCoverStatus`]) return;

  /**
   * Handle the GM-side query used to synchronize a dnd5e cover status.
   * @param {{actorUuid?: string, cover?: "none"|"half"|"threeQuarters"|"total"}|null|undefined} data The query payload.
   * @returns {Promise<{ok: boolean, reason?: string}>} The query result.
   */
  CONFIG.queries[`${MODULE_ID}.setCoverStatus`] = async (data) => {
    try {
      if (!game.user.isGM) return { ok: false, reason: "not-gm" };
      const { actorUuid, cover = "none" } = data ?? {};
      if (!COVER.KEYS.includes(cover)) return { ok: false, reason: "invalid-cover" };

      const actor = await fromUuid(actorUuid);
      if (!actor) {
        console.warn(`[${MODULE_ID}] setCoverStatus: actor not found for uuid`, actorUuid);
        return { ok: false, reason: "no-actor" };
      }

      await _applyCoverStatus(actor, cover);
      return { ok: true };
    } catch (err) {
      console.warn(`[${MODULE_ID}] query setCoverStatus failed:`, err, data);
      return { ok: false, reason: "exception" };
    }
  };
}

/**
 * Request the active GM to synchronize the visible dnd5e cover status on an actor.
 *
 * @param {string} actorUuid The UUID of the actor to update.
 * @param {"none"|"half"|"threeQuarters"|"total"} cover The desired cover level.
 * @returns {Promise<boolean>} True if the GM handled the request successfully.
 */
export async function setCoverStatusViaGM(actorUuid, cover) {
  if (game.user.isGM) {
    if (!COVER.KEYS.includes(cover)) return false;
    const actor = await fromUuid(actorUuid);
    if (!actor) return false;
    await _applyCoverStatus(actor, cover);
    return true;
  }

  const gm = game.users.activeGM;
  if (!gm) { console.warn(`[${MODULE_ID}] no active GM`); return false; }

  try {
    const res = await gm.query(`${MODULE_ID}.setCoverStatus`, { actorUuid, cover }, { timeout: 8000 });
    return !!res?.ok;
  } catch (e) {
    console.warn(`[${MODULE_ID}] GM query failed:`, e);
    return false;
  }
}

/**
 * Check whether a token or actor has a player owner.
 *
 * @param {{token?: Token5e, actor?: Actor5e}} data The token and actor pair to evaluate.
 * @returns {boolean} True if the token or actor has a player owner.
 */
function isPlayerOwned({ token, actor }) {
  if (token?.hasPlayerOwner !== undefined) return token.hasPlayerOwner;
  return !!actor?.hasPlayerOwner;
}

/**
 * Resolve token/actor pairs for a cover update scope.
 * Supported scopes: "all", "combatants", and "players" (player-owned combatants).
 *
 * @param {Combat|null} combat The active combat, if any.
 * @param {"all"|"combatants"|"players"} scope The selection scope.
 * @returns {Array<{token: TokenDocument|null, actor: Actor|null}>} The resolved token and actor pairs.
 */
function resolveTokensForScope(combat, scope) {
  const combatScene =
    combat?.combatants?.find(c => c?.token?.parent)?.token?.parent
    ?? (typeof combat?.scene === "string" ? game.scenes.get(combat.scene) : combat?.scene)
    ?? null;
  const scene = combatScene ?? canvas?.scene;

  let targets = [];

  if (scope === "combatants") {
    const turns = combat?.turns ?? [];
    for (const c of turns) {
      const tokenDoc =
        c?.token
        ?? scene?.tokens?.get?.(c?.tokenId)
        ?? null;

      targets.push({ token: tokenDoc, actor: c?.actor ?? tokenDoc?.actor ?? null });
    }
  } else {
    const tokenDocs = scene?.tokens?.contents ?? [];
    for (const td of tokenDocs) {
      targets.push({ token: td, actor: td?.actor ?? null });
    }
  }

  if (scope === "players") {
    targets = targets.filter(isPlayerOwned);
  }
  return targets;
}

/**
 * Resolve the system cover status effects provided by dnd5e.
 *
 * @returns {{cover: ("half"|"threeQuarters"|"total"), statusId: string, effectId: string|null}[]} The available system cover effects.
 */
export function getSystemCoverEffects() {
  return [
    ["total", COVER.IDS.total],
    ["threeQuarters", COVER.IDS.threeQuarters],
    ["half", COVER.IDS.half]
  ].map(([cover, statusId]) => ({
    cover,
    statusId,
    effectId: CONFIG.statusEffects[statusId]._id
  }));
}

/**
 * Determine the highest active status and embedded cover states on an actor.
 *
 * @param {Actor5e} actor The actor to evaluate.
 * @returns {{statusCover: ("none"|"half"|"threeQuarters"|"total"), embeddedCover: ("none"|"half"|"threeQuarters"|"total")}} The resolved cover states.
 */
export function getActorCoverStates(actor) {
  const effects = actor?.appliedEffects ?? [];
  const systemCoverEffects = getSystemCoverEffects();

  let statusCover = "none";
  for (const { cover, statusId, effectId } of systemCoverEffects) {
    const isSystemStatus = actor?.statuses?.has?.(statusId) && effects.some(effect => effect.id === effectId);
    if (isSystemStatus) {
      statusCover = cover;
      break;
    }
  }

  let embeddedCover = "none";
  for (const effect of effects) {
    const isSystemEffect = systemCoverEffects.some(({ effectId }) => effect.id === effectId);
    if (isSystemEffect) continue;

    const statuses = effect?.statuses;
    if (!statuses?.has) continue;

    if (statuses.has(COVER.IDS.total)) {
      embeddedCover = "total";
      break;
    }
    if (statuses.has(COVER.IDS.threeQuarters) && (COVER.ORDER[embeddedCover] < COVER.ORDER.threeQuarters)) {
      embeddedCover = "threeQuarters";
    }
    if (statuses.has(COVER.IDS.half) && (COVER.ORDER[embeddedCover] < COVER.ORDER.half)) {
      embeddedCover = "half";
    }
  }

  return { statusCover, embeddedCover };
}

/**
 * Clear module-managed system cover effects for the configured scope.
 * This is typically called when combat state changes or at end-of-turn boundaries.
 *
 * @param {Combat|null} combat The active combat, if any.
 * @returns {Promise<void>} Resolves when the batch delete operation has settled.
 */
export async function clearSystemCoverEffects(combat) {
  const scope = game.settings.get(MODULE_ID, SETTING_KEYS.COVER_SCOPE);
  const targets = resolveTokensForScope(combat, scope);
  const systemCoverEffects = getSystemCoverEffects();
  const operations = [];

  for (const { actor } of targets) {
    if (!actor) continue;
    const ids = [];
    for (const { statusId, effectId } of systemCoverEffects) {
      if (!effectId) continue;
      if (actor.statuses?.has?.(statusId) && actor.appliedEffects?.some(e => e.id === effectId)) {
        ids.push(effectId);
      }
    }
    if (ids.length) {
      operations.push({ action: "delete", documentName: "ActiveEffect", parent: actor, ids });
    }
  }

  if (operations.length) await foundry.documents.modifyBatch(operations);
}
