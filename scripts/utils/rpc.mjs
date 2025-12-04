import { MODULE_ID } from "../config/constants.config.mjs";

/**
 * Toggle a cover status effect on an actor over the GM socket.
 *
 * @param {string} actorUuid - UUID of the actor whose effect should be toggled.
 * @param {string} effectId  - ID of the effect to toggle on the actor.
 * @param {boolean} enable   - Whether the effect should be enabled (true) or disabled (false).
 * @returns {Promise<boolean>} Resolves to true on success, otherwise false.
 */
export async function toggleCoverEffectViaGM(actorUuid, effectId, enable) {
  const gm = game.users.activeGM;
  if (!gm) { console.warn(`[${MODULE_ID}] no active GM`); return false; }
  
  try {
    const res = await gm.query(`${MODULE_ID}.toggleCover`, { actorUuid, effectId, enable }, { timeout: 8000 });
    return !!res?.ok;
  } catch (e) {
    console.warn(`[${MODULE_ID}] GM query failed:`, e);
    return false;
  }
}

/**
 * Determine whether a token should be treated as a blocking creature for cover.
 *
 * @param {Token5e|Token} token - Token to evaluate for cover occlusion.
 * @returns {boolean} True if the token is considered blocking, otherwise false.
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
