import { MODULE_ID } from "../config/constants.config.mjs";

/**
 * Register GM query handlers used by the module.
 *
 * @returns {void}
 */
export function initQueries() {
    CONFIG.queries ??= {};
    if (CONFIG.queries[`${MODULE_ID}.toggleCover`]) return;

    /**
     * Handle the GM-side query used to toggle a cover status effect.
     * @param {{actorUuid?: string, effectId?: string, enable?: boolean}|null|undefined} data The query payload.
     * @returns {Promise<{ok: boolean, changed?: boolean, reason?: string}>} The query result.
     */
    CONFIG.queries[`${MODULE_ID}.toggleCover`] = async (data) => {
        try {
            if (!game.user.isGM) return { ok: false, reason: "not-gm" };
            const { actorUuid, effectId, enable } = data ?? {};

            const actor = await fromUuid(actorUuid);
            if (!actor) {
                console.warn(`[${MODULE_ID}] toggleCover: actor not found for uuid`, actorUuid);
                return { ok: false, reason: "no-actor" };
            }
            const before = !!actor.statuses?.has?.(effectId);

            if (typeof actor.toggleStatusEffect === "function") {
                await actor.toggleStatusEffect(effectId, { active: !!enable, overlay: false });
            } else {
                console.warn(`[${MODULE_ID}] toggleCover: actor has no toggleStatusEffect`, actor);
                return { ok: false, reason: "no-toggle" };
            }

            const after = !!actor.statuses?.has?.(effectId);
            return { ok: true, changed: before !== after };
        } catch (err) {
            console.warn(`[${MODULE_ID}] query toggleCover failed:`, err, data);
            return { ok: false, reason: "exception" };
        }
    };
}

/**
 * Request the active GM to toggle a cover status effect on an actor.
 *
 * @param {string} actorUuid The UUID of the actor to update.
 * @param {string} effectId The status effect ID to toggle.
 * @param {boolean} enable Whether the effect should be enabled.
 * @returns {Promise<boolean>} True if the GM handled the request successfully.
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
