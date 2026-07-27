import { MODULE_ID, COVER } from "../config/constants.config.mjs";

/**
 * Register GM query handlers used by the module.
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

            await applyCoverStatus(actor, cover);
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
        await applyCoverStatus(actor, cover);
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
 * Apply a cover status directly on the current client.
 * Requires the caller to have write permission on the actor.
 *
 * @param {Actor5e} actor The actor to update.
 * @param {"none"|"half"|"threeQuarters"|"total"} cover The desired cover level.
 * @returns {Promise<void>}
 */
async function applyCoverStatus(actor, cover) {
    const desiredStatusId = COVER.IDS[cover];

    if (desiredStatusId) {
        if (actor.statuses.has(desiredStatusId)) return;
        await actor.toggleStatusEffect(desiredStatusId, { active: true, overlay: false });
        return;
    }

    const activeStatusId = [COVER.IDS.total, COVER.IDS.threeQuarters, COVER.IDS.half].find(id => actor.statuses.has(id));
    if (activeStatusId) await actor.toggleStatusEffect(activeStatusId, { active: false, overlay: false });
}
