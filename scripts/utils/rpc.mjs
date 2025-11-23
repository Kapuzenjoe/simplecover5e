import { MODULE_ID } from "../config/constants.config.mjs";

/**
 * Toggle a cover status effect on an actor, using GM authority if needed.
 * @param {string} actorUuid
 * @param {string} effectId
 * @param {boolean} enable
 * @returns {Promise<boolean>}
 */
export async function toggleCoverEffectViaGM(actorUuid, effectId, enable) {
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
 * Decide if a token should be considered as a blocking creature for cover.
 *
 * - Ignores hidden tokens
 * - Ignores tokens that are not visible on the canvas
 * - Ignores tokens with the "ethereal" or "dead" status effect
 *
 * @param {Token5e} token
 * @returns {boolean} True if blocking.
 */
export function isBlockingCreatureToken(token) {
  if (!token) return false;

  const doc = token.document;
  if (!doc || doc.hidden) return false;
  if (!token.visible) return false;

  const actor = token.actor;
  const statuses = actor?.statuses;
  if (!statuses) return true;
  if (statuses.has("ethereal")) return false;
  if (statuses.has("dead")) return false;

  return true;
}
