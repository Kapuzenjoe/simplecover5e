import { MODULE_ID } from "../config/constants.config.mjs";
import { clearCoverDebug } from "../services/cover.debug.mjs";

/**
 * Initialize module-specific GM queries.
 */
export function initQueries() {
    CONFIG.queries ??= {};

    CONFIG.queries[`${MODULE_ID}.toggleCover`] = async (data) => {
        try {
            if (!game.user.isGM) return { ok: false, reason: "not-gm" };
            const { actorUuid, effectId, enable } = data ?? {};
            if (!actorUuid || !effectId || typeof enable !== "boolean") {
                return { ok: false, reason: "bad-args" };
            }

            const actor = await fromUuid(actorUuid);
            if (!actor) {
                console.warn(`[${MODULE_ID}] toggleCover: actor not found for uuid`, actorUuid);
                return { ok: false, reason: "no-actor" };
            }
            const hasStatus = !!actor.statuses?.has?.(effectId);

            if (enable && hasStatus) {
                return { ok: true, changed: false };
            }
            if (!enable && !hasStatus) {
                return { ok: true, changed: false };
            }

            if (typeof actor.toggleStatusEffect === "function") {
                await actor.toggleStatusEffect(effectId, { overlay: false });
            } else {
                console.warn(`[${MODULE_ID}] toggleCover: actor has no toggleStatusEffect`, actor);
                return { ok: false, reason: "no-toggle" };
            }

            return { ok: true, changed: true };
        } catch (err) {
            console.warn(`[${MODULE_ID}] query toggleCover failed:`, err, data);
            return { ok: false, reason: "exception" };
        }
    };

    CONFIG.queries[`${MODULE_ID}.clearDebug`] = async () => {
        try {
            if (!game.user.isGM) return { ok: false, reason: "not-gm" };
            clearCoverDebug();
            return { ok: true };
        } catch {
            return { ok: false, reason: "exception" };
        }
    };
}

