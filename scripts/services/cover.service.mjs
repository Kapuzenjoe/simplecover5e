import { MODULE_ID, SETTING_KEYS, COVER } from "../config/constants.config.mjs";

/**
 * Check whether a token/actor is player-owned.
 *
 * @param {{ token?: Token5e, actor?: Actor5e }} param0               The token/actor pair to evaluate.
 * @returns {boolean}                                                True if the token/actor has a player owner.
 */
function isPlayerOwned({ token, actor }) {
  if (token?.hasPlayerOwner !== undefined) return token.hasPlayerOwner;
  return !!actor?.hasPlayerOwner;
}

/**
 * Resolve token/actor pairs for a cover update scope.
 * Supported scopes: "all", "combatants", and "players" (player-owned combatants).
 *
 * @param {Combat|null} combat                     The active combat, if any.
 * @param {"all"|"combatants"|"players"} scope     The selection scope.
 * @returns {Array<{ token: TokenDocument|null, actor: Actor|null }>} The resolved token/actor pairs.
 */
function resolveTokensForScope(combat, scope) {
  const scene = canvas?.scene

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
 * Clear all cover status effects for the configured scope.
 * This is typically called when combat state changes or at end-of-turn boundaries.
 *
 * @param {Combat|null} combat                      The active combat, if any.
 * @returns {Promise<void>}                         Resolves when all toggles have settled.
 */
export async function clearCoverStatusEffect(combat) {

  const scope = game.settings.get(MODULE_ID, SETTING_KEYS.COVER_SCOPE);
  const targets = resolveTokensForScope(combat, scope);

  const ids = Object.values(COVER.IDS).filter(Boolean);
  const jobs = [];

  for (const { actor } of targets) {
    if (!actor) continue;

    for (const id of ids) {

      if (actor.statuses?.has?.(id)) {
        jobs.push(actor.toggleStatusEffect(id));
      }
    }
  }

  if (jobs.length) await Promise.allSettled(jobs);
}

/**
 * Determine whether a token should be treated as a blocking creature for cover and LoS occlusion.
 * Hidden, invisible, dead, or ethereal creatures are ignored.
 *
 * @param {Token5e} token                           The token to evaluate.
 * @returns {boolean}                               True if the token is considered blocking; otherwise false.
 */
export function isBlockingCreatureToken(token) {
  if (!token) return false;

  const doc = token.document;
  if (!doc || doc.hidden) return false;
  if (!token.visible) return false;

  const actor = token.actor;
  if (!actor) return true;

  const statuses = actor?.statuses;
  if (!statuses) return true;

  if (statuses.has("ethereal")) return false;
  if (statuses.has("dead")) return false;
  if (actor.system?.attributes?.hp?.max === 0) return false;

  return true;
}