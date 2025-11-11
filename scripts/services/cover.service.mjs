import { MODULE_ID, SETTING_KEYS, COVER_STATUS_IDS } from "../config/constants.config.mjs";

function isPlayerOwned({ token, actor }) {
  if (token?.hasPlayerOwner !== undefined) return token.hasPlayerOwner;
  return !!actor?.hasPlayerOwner;
}

/**
 *  - "all":     all tokens on scene
 *  - "combatants": only combatants
 *  - "players": only player-owned combatants
 * @param {Combat} combat
 * @param {String} scope 
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
 * clear cover statuses
 * @param {Combat} combat
 */
export async function clearAllCoverInCombat(combat) {
  if (!combat) return;

  const scope = game.settings.get(MODULE_ID, SETTING_KEYS.COVER_SCOPE); // "all" | "combatants" | "players"
  const targets = resolveTokensForScope(combat, scope);

  const ids = Object.values(COVER_STATUS_IDS);
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
