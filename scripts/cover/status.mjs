import { MODULE_ID, SETTING_KEYS, COVER } from "../config/constants.mjs";

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
    effectId: CONFIG.statusEffects.find(effect => effect.id === statusId)._id
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
 * @returns {Promise<void>} Resolves when all status toggles have settled.
 */
export async function clearSystemCoverEffects(combat) {
  const scope = game.settings.get(MODULE_ID, SETTING_KEYS.COVER_SCOPE);
  const targets = resolveTokensForScope(combat, scope);
  const systemCoverEffects = getSystemCoverEffects();
  const jobs = [];

  for (const { actor } of targets) {
    if (!actor) continue;

    for (const { statusId, effectId } of systemCoverEffects) {
      const hasSystemEffect = actor.statuses?.has?.(statusId) && actor.appliedEffects?.some(effect => effect.id === effectId);
      if (hasSystemEffect) {
        jobs.push(actor.toggleStatusEffect(statusId, { active: false, overlay: false }));
      }
    }
  }

  if (jobs.length) await Promise.allSettled(jobs);
}
