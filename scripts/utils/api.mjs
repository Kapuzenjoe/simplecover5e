import { MODULE_ID, SETTING_KEYS } from "../config/constants.config.mjs";
import {
    buildCoverContext,
    buildCreaturePrism,
    evaluateCoverFromOccluders,
} from "../services/cover.engine.mjs";
import { isBlockingCreatureToken, itemIgnoresCover } from "../utils/rpc.mjs";
import { drawCoverDebug, clearCoverDebug } from "../services/cover.debug.mjs";

/**
 * Register the library mode setting for this module.
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
 * Checks whether cover should be ignored for the given activity.
 * 
 * @param {Activtiy5e} activity - The activity being evaluated for cover.
 * @returns {boolean} True if cover should be ignored, otherwise false.
 */
function getIgnoreCover(activity) {
    return itemIgnoresCover(activity);
}

/**
 * Build the cover evaluation context and precompute creature prisms.
 *
 * @param {Scene} [scene=canvas.scene]      The scene for which to build the cover context.
 * @returns {object|null}                   The cover evaluation context.
 */
function buildContextWithPrisms(scene) {
    const s = scene ?? canvas?.scene;
    if (!s) return null;

    const ctx = buildCoverContext(s);
    const blockingTokens = canvas.tokens.placeables.filter(t => isBlockingCreatureToken(t));
    ctx.creaturePrisms = new Map(
        blockingTokens.map(t => [t.id, buildCreaturePrism(t.document, ctx)])
    );
    return ctx;
}

/**
 * Compute cover between a single attacker and a single target.
 *
 * @param {object} options                                  Options controlling the cover evaluation.
 * @param {Token|TokenDocument} options.attacker            The attacking Token or TokenDocument.
 * @param {Token|TokenDocument} options.target              The target Token or TokenDocument.
 * @param {Scene} [options.scene=canvas.scene]              The scene on which to evaluate cover.
 * @param {boolean} [options.debug=false]                   Whether to force debug output for this evaluation.
 *
 * @returns {{ cover: "none"|"half"|"threeQuarters", debugSegments?: any[], debugTokenShapes?: any[] } | null}
 */
function getCover({ attacker, target, scene = canvas?.scene, debug = false } = {}) {
    if (!attacker || !target || !scene) return null;

    const attackerDoc = attacker.document ?? attacker;
    const targetDoc = target.document ?? target;
    if (!attackerDoc || !targetDoc) return null;

    const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG) || debug;
    if (debugOn && game.users.activeGM) clearCoverDebug();

    const ctx = buildContextWithPrisms(scene);
    if (!ctx) return null;

    const result = evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, { debug: debugOn })
    if (debugOn && result.debugSegments?.length && game.users.activeGM) {
        drawCoverDebug({
            segments: result.debugSegments ?? [],
            tokenShapes: result.debugTokenShapes
        });
    }
    return result;;
}

/**
 * Compute cover between a single attacker and multiple targets.
 *
 * @param {object} options                                           Options controlling the cover evaluation.
 * @param {Token|TokenDocument} options.attacker                     The attacking Token or TokenDocument.
 * @param {Token[]|TokenDocument[]} [options.targets]                An explicit list of targets; defaults to the user's current targets.
 * @param {Scene} [options.scene=canvas.scene]                       The scene on which to evaluate cover.
 * @param {boolean} [options.debug=false]                            Whether to force debug output for this evaluation.
 *
 * @returns {Array<{ target: Token|TokenDocument, result: { cover: "none"|"half"|"threeQuarters", debugSegments?: any[], debugTokenShapes?: any[] } }>}
 */
function getCoverForTargets({ attacker, targets = null, scene = canvas?.scene, debug = false } = {}) {
    if (!attacker || !scene) return [];
    const attackerDoc = attacker.document ?? attacker;
    if (!attackerDoc) return [];

    const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG) || debug;
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
        const result = evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, { debug: debugOn });
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
 * Get whether the module is currently operating in library mode.
 */
function getLibraryMode() {
    return !!game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE);
}

/**
 * Enable or disable library mode for this module.
 */
async function setLibraryMode(enabled) {
    if (!game.user.isGM) {
        console.warn(`[${MODULE_ID}] setLibraryMode: Only a GM may change library mode.`);
        return false;
    }
    await game.settings.set(MODULE_ID, SETTING_KEYS.LIBRARY_MODE, !!enabled);
    return true;
}

/**
 * Initialize and expose the module API on the module instance.
 */
export function initApi() {
    registerLibraryModeSetting();

    const api = {
        getCover,
        getCoverForTargets,
        getLibraryMode,
        setLibraryMode,
        getIgnoreCover
    };

    const mod = game.modules.get(MODULE_ID);
    if (mod) {
        mod.api = api;
    }
    Hooks.callAll("simplecover5eReady", api);
}
