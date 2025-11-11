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
            if (!actorUuid || !effectId || typeof enable !== "boolean")
                return { ok: false, reason: "bad-args" };

            const actor = await fromUuid(actorUuid);
            if (!actor) return { ok: false, reason: "no-actor" };

            const on = !!actor.statuses?.has?.(effectId);
            if (enable && !on) await actor.toggleStatusEffect(effectId, { overlay: false });
            if (!enable && on) await actor.toggleStatusEffect(effectId, { overlay: false });

            return { ok: true, changed: (enable !== on) };
        } catch (e) {
            console.warn("[cover] query toggleCover failed:", e, data);
            return { ok: false, reason: "exception" };
        }
    };

    CONFIG.queries[`${MODULE_ID}.clearDebug`] = async () => {
        try {
            if (!game.user.isGM) return { ok: false, reason: "not-gm" };
            await clearCoverDebug();
            return { ok: true };
        } catch {
            return { ok: false, reason: "exception" };
        }
    };
}

