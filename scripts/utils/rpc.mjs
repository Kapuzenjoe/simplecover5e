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
