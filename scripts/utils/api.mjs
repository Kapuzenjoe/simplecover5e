import { MODULE_ID, SETTING_KEYS } from "../config/constants.config.mjs";
import {
    buildCoverContext,
    buildCreaturePrism,
    evaluateCoverFromOccluders,
} from "../services/cover.engine.mjs";
import { isBlockingCreatureToken } from "../utils/rpc.mjs";
import { drawCoverDebug, clearCoverDebug } from "../services/cover.debug.mjs";

/**
 * Register the library mode setting.
 */
function registerLibraryModeSetting() {
    if (game.settings.settings.has(`${MODULE_ID}.${SETTING_KEYS.LIBRARY_MODE}`)) return;

    game.settings.register(MODULE_ID, SETTING_KEYS.LIBRARY_MODE, {
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
    });
}

/**
 * Helper: create a reusable cover context + creature prisms.
 * @param {Scene} scene
 * @returns {object|null}  The cover context or null.
 */
function buildContextWithPrisms(scene) {
    const s = scene ?? canvas?.scene;
    if (!s) return null;

    const ctx = buildCoverContext(canvas.scene);
    const blockingTokens = canvas.tokens.placeables.filter(t => isBlockingCreatureToken(t));
    ctx.creaturePrisms = new Map(
        blockingTokens.map(t => [t.id, buildCreaturePrism(t.document, ctx)])
    );
    return ctx;
}

/**
 * API: compute cover between attacker + target.
 *
 * @param {object} options
 * @param {Token|TokenDocument} options.attacker
 * @param {Token|TokenDocument} options.target
 * @param {Scene} [options.scene]
 * @param {boolean} [options.debug]
 *
 * @returns { { cover: "none"|"half"|"threeQuarters", debugSegments?: any[] } | null }
 */
function getCover({ attacker, target, scene = canvas?.scene, debug = false } = {}) {
    if (!attacker || !target || !scene) return null;

    const attackerDoc = attacker.document ?? attacker;
    const targetDoc = target.document ?? target;
    if (!attackerDoc || !targetDoc) return null;

    const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
    if (debugOn && game.users.activeGM) clearCoverDebug();

    const ctx = buildContextWithPrisms(scene);
    if (!ctx) return null;

    const result = evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, { debug })
    if (debugOn && result.debugSegments?.length && game.users.activeGM) {
        drawCoverDebug({
            segments: result.debugSegments ?? [],
            tokenShapes: result.debugTokenShapes
        });
    }
    return result;;
}

/**
 * API: compute cover between attacker and a list of targets
 *
 * @param {object} options
 * @param {Token|TokenDocument} options.attacker
 * @param {Token[]|TokenDocument[]} [options.targets] 
 * @param {Scene} [options.scene]
 * @param {boolean} [options.debug]
 *
 * @returns {Array<{ target: Token|TokenDocument, result: { cover: string, debugSegments?: any[] } }>}
 */
function getCoverForTargets({ attacker, targets = null, scene = canvas?.scene, debug = false } = {}) {
    if (!attacker || !scene) return [];
    const attackerDoc = attacker.document ?? attacker;
    if (!attackerDoc) return [];

    const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
    if (debugOn && game.users.activeGM) clearCoverDebug();

    const ctx = buildContextWithPrisms(scene);
    if (!ctx) return [];

    const list = targets
        ? Array.from(targets)
        : Array.from(game.user?.targets ?? []);

    const out = [];
    for (const t of list) {
        const targetDoc = t?.document ?? t;
        if (!targetDoc) continue;
        const result = evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, { debug });
        if (debugOn && result.debugSegments?.length && game.users.activeGM) {
            drawCoverDebug({
                segments: result.debugSegments ?? [],
                tokenShapes: result.debugTokenShapes
            });
        }
        out.push({ target: t, result });
    }
    return out;
}

/**
 * API: library mode helpers
 */
function getLibraryMode() {
    return !!game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE);
}

async function setLibraryMode(enabled) {
    if (!game.user.isGM) {
        console.warn(`[${MODULE_ID}] setLibraryMode: Only a GM may change library mode.`);
        return false;
    }
    await game.settings.set(MODULE_ID, SETTING_KEYS.LIBRARY_MODE, !!enabled);
    return true;
}

/**
 * Init entrypoint
 */
export function initApi() {
    registerLibraryModeSetting();

    const api = {
        getCover,
        getCoverForTargets,
        getLibraryMode,
        setLibraryMode,
    };

    const mod = game.modules.get(MODULE_ID);
    if (mod) {
        mod.api = api;
    }
    Hooks.callAll("simplecover5eReady", api);
}
