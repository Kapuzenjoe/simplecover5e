import { MODULE_ID } from "../constants.mjs";
import { clearCoverDebug } from "../handlers/cover-handler.mjs";

/**
 * Initialize module-specific queries.
 */
export function initQueries() {

    CONFIG.queries ??= {};
    CONFIG.queries[`${MODULE_ID}.toggleCover`] = async (data) => {
        try {
               if (!game.user.isGM) return { ok: false, reason: "not-gm" };

            const { actorUuid, effectId, enable } = data ?? {};
            if (!actorUuid || !effectId || typeof enable !== "boolean")
                return { ok: false, reason: "bad-args" };

            const actor = await fromUuid(actorUuid);
            if (!actor) return { ok: false, reason: "no-actor" };

            const on = !!actor.statuses?.has?.(effectId);
            const want = enable;
            if (want && !on) await actor.toggleStatusEffect(effectId, { overlay: false });
            if (!want && on) await actor.toggleStatusEffect(effectId, { overlay: false });

            return { ok: true, changed: (want !== on) };
        } catch (e) {
            console.warn("[cover] query toggleCover failed:", e, data);
            return { ok: false, reason: "exception" };
        }
    };

    /** Optional: Debug-Linien beim GM löschen */
    CONFIG.queries[`${MODULE_ID}.clearDebug`] = async () => {
        try {
            if (!game.user.isGM) return { ok: false, reason: "not-gm" };
            await clearCoverDebug();
            return { ok: true };
        } catch (e) {
            return { ok: false, reason: "exception" };
        }
    };

};

