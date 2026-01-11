import { MODULE_ID, SETTING_KEYS } from "../config/constants.config.mjs";
import {
    buildCoverContext,
    buildCreaturePrism,
    evaluateCoverFromOccluders,
    evaluateLOS,
} from "../services/cover.engine.mjs";
import { isBlockingCreatureToken } from "../services/cover.service.mjs";
import { ignoresCover } from "../utils/rules.cover.mjs";
import { drawCoverDebug, clearCoverDebug } from "../services/cover.debug.mjs";
import { measureTokenDistance } from "../utils/distance.mjs";

/**
 * @typedef {"none"|"half"|"threeQuarters"|"total"} CoverLevel
 *
 * @typedef {object} LosPoint
 * @property {number} x
 * @property {number} y
 * @property {boolean} blocked
 *
 * @typedef {object} LosResult
 * @property {boolean} hasLOS
 * @property {LosPoint[]} targetLosPoints
 *
 * @typedef {object} CoverEvaluationResult
 * @property {CoverLevel} cover
 * @property {0|2|5|null} bonus
 * @property {any[]} [debugSegments]
 * @property {any[]} [debugTokenShapes]
 * 
 * @typedef {{x:number, y:number, elevation?:number}} Position
 */

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
 * Resolve the effective cover level for an activity, including ignore-cover rules.
 *
 * @param {Activity5e} activity                      The activity being evaluated.
 * @param {"none"|"half"|"threeQuarters"|"total"} cover The computed/requested cover level.
 * @returns {{ CoverLevel, bonus: (number|null) }} The effective cover level and its corresponding bonus.
 *
 */
export function getIgnoreCover(activity, cover) {
    return ignoresCover(activity, cover);
}

/**
 * Evaluate line of sight (LoS) from an attacker to a target.
 *
 * @param {TokenDocument|Position} attackerDoc     The attacking token document or a generic position {x,y,elevation?}.
 * @param {TokenDocument} targetDoc                The target TokenDocument.
 * @param {object} ctx                             The cover evaluation context.
 * @returns {LosResult}                            The LoS result and sampled target points.
 */
function getLOS(attackerDoc, targetDoc, ctx = null) {
    const s = targetDoc?.parent ?? canvas?.scene;
    if (!s) return null;

    ctx ??= buildCoverContext(s);

    return evaluateLOS(attackerDoc, targetDoc, ctx);
}

/**
 * Measure the minimal 3D distance between two tokens in scene grid units.
 *
 * Gridless distance modes:
 *  - "edgeEdge":      edge-to-edge
 *  - "centerCenter":  center-to-center
 *  - "edgeToCenter":  source edge to target center
 *
 * @param {Token|TokenDocument} sourceToken      The source token or document.
 * @param {Token|TokenDocument} targetToken      The target token or document.
 * @returns {number}                             The minimal distance in grid units (clamped to 0+).
 */
function getTokenTokenDistance(sourceToken, targetToken) {
    return measureTokenDistance(sourceToken, targetToken);
}

/**
 * Build the cover evaluation context and precompute creature prisms for blocking tokens.
 *
 * @param {Scene} [scene=canvas.scene]  The scene for which to build the cover context.
 * @returns {object|null}               The cover evaluation context, or null if no scene is available.
 */
function buildContextWithPrisms(scene = canvas?.scene) {
    const s = scene ?? canvas?.scene;
    if (!s) return null;

    const ctx = buildCoverContext(s);
    const placeables = canvas?.tokens?.placeables ?? [];
    const blockingTokens = placeables.filter(t => isBlockingCreatureToken(t));

    ctx.creaturePrisms = new Map(
        blockingTokens.map(t => [t.id, buildCreaturePrism(t.document, ctx)])
    );
    return ctx;
}

/**
 * Compute cover between a single attacker and a single target, optionally including a wall LoS check.
 *
 * @param {object} [options={}]                             Options controlling the cover evaluation. 
 * @param {Token|TokenDocument|Position} options.attacker   The attacking Token or TokenDocument or a generic position {x,y,elevation?}.
 * @param {Token|TokenDocument} options.target              The target Token or TokenDocument.
 * @param {Scene} [options.scene=canvas.scene]              The scene on which to evaluate cover.
 * @param {boolean|null} [options.debug=null]               Whether to force debug output. Null uses the module Debug setting.
 * @param {boolean} [options.losCheck=false]                Whether to perform a wall line-of-sight check (no LoS => total cover).
 * @param {Activity5e|null} [options.activity=null]         The activity being evaluated for cover.
 * @returns {CoverEvaluationResult|null}                    The computed cover result, or null if inputs are invalid.
 */
export function getCover({ attacker, target, scene = canvas?.scene, debug = null, losCheck = false, activity = null } = {}) {
    if (!attacker || !target || !scene) return null;

    const attackerDoc = attacker.document ?? attacker;
    const targetDoc = target.document ?? target;
    if (!attackerDoc || !targetDoc) return null;

    const settingDebug = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
    const debugOn = (debug === null) ? settingDebug : !!debug;

    if (debugOn && game.users.activeGM) clearCoverDebug();

    const ctx = buildContextWithPrisms(scene);
    if (!ctx) return null;

    const result = evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, { debug: debugOn })

    let los = { hasLOS: true, targetLosPoints: [] };
    if (losCheck) {
        los = evaluateLOS(attackerDoc, targetDoc, ctx)
        if (!los.hasLOS) {
            result.cover = "total";
            result.bonus = null;
        }
    }

    if (activity) {
        const { cover: desiredCover, bonus: desiredBonus } = getIgnoreCover(activity, result?.cover ?? "none");
        result.cover = desiredCover;
        result.bonus = desiredBonus;
    }

    if (debugOn && result.debugSegments?.length && game.users.activeGM) {
        drawCoverDebug({
            segments: result.debugSegments ?? [],
            tokenShapes: result.debugTokenShapes,
            targetLosPoints: los.targetLosPoints
        });
    }
    return result;
}

/**
 * Compute cover between a single attacker and multiple targets, optionally including a wall LoS check.
 *
 * @param {object} [options={}]                             Options controlling the cover evaluation.
 * @param {Token|TokenDocument|Position} options.attacker   The attacking Token or TokenDocument or a generic position {x,y,elevation?}.
 * @param {Token[]|TokenDocument[]|null} [options.targets]  Explicit targets; defaults to the user's current targets.
 * @param {Scene} [options.scene=canvas.scene]              The scene on which to evaluate cover.
 * @param {boolean|null} [options.debug=null]               Whether to force debug output. Null uses the module Debug setting.
 * @param {boolean} [options.losCheck=false]                Whether to perform a wall line-of-sight check (no LoS => total cover).
 * @param {Activity5e|null} [options.activity=null]         The activity being evaluated for cover.
 * @returns {Array<{ target: Token|TokenDocument, result: CoverEvaluationResult, los: LosResult }>} The per-target cover results.
 */
export function getCoverForTargets({ attacker, targets = null, scene = canvas?.scene, debug = null, losCheck = false, activity = null } = {}) {
    if (!attacker || !scene) return [];

    const attackerDoc = attacker.document ?? attacker;
    if (!attackerDoc) return [];

    const settingDebug = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
    const debugOn = (debug === null) ? settingDebug : !!debug;

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

        const result = evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, { debug: debugOn })

        let los = { hasLOS: true, targetLosPoints: [] };
        if (losCheck) {
            los = evaluateLOS(attackerDoc, targetDoc, ctx)
            if (!los.hasLOS) {
                result.cover = "total";
                result.bonus = null;
            }
        }

        if (activity) {
            const { cover: desiredCover, bonus: desiredBonus } = getIgnoreCover(activity, result?.cover ?? "none");
            result.cover = desiredCover;
            result.bonus = desiredBonus;
        }

        out.push({ target: t, result, los });
    }

    if (debugOn && out.length && game.users.activeGM) {
        for (const e of out) {
            drawCoverDebug({
                segments: e.result?.debugSegments ?? [],
                tokenShapes: e.result?.debugTokenShapes,
                targetLosPoints: e.los?.targetLosPoints ?? []
            });
        }
    }

    return out;
}

/**
 * Add a note (icon + label + hint) to the next Roll Configuration Dialog for this roll workflow.
 *
 * @param {object} dialogConfig                 The dialog configuration object provided by DnD5e pre-roll V2 hooks.
 * @param {object} [note={}]                    The note definition.
 * @param {string} [note.icon=""]               A Font Awesome class string, e.g. `"fa-solid fa-circle-info"`.
 * @param {string} [note.label=""]              The note label text, e.g. `"Half Cover"`.
 * @param {string} [note.hint=""]               The hint HTML/text, e.g. `"+2 to save rolls."`.
 * @returns {void}
 */
export function setDialogNote(dialogConfig, { icon = "", label = "", hint = "" } = {}) {
    if (!dialogConfig) return;

    dialogConfig.options ??= {};
    const data = (dialogConfig.options[MODULE_ID] ??= {});
    data.notes ??= [];

    data.notes.push({
        icon: String(icon ?? ""),
        label: String(label ?? ""),
        hint: String(hint ?? "")
    });

    data.rendered = false;
}

/**
 * Get whether the module is currently operating in library mode.
 *
 * @returns {boolean} True if library mode is enabled.
 */
function getLibraryMode() {
    return !!game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE);
}

/**
 * Enable or disable library mode for this module.
 *
 * @param {boolean} enabled   The desired library mode state.
 * @returns {Promise<boolean>} True if the setting was updated; otherwise false.
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
 *
 * @returns {void}
 */
export function initApi() {
    registerLibraryModeSetting();

    const api = {
        getCover,
        getCoverForTargets,
        getLibraryMode,
        setLibraryMode,
        getIgnoreCover,
        getLOS,
        getTokenTokenDistance,
        setDialogNote,
    };

    const mod = game.modules.get(MODULE_ID);
    if (mod) {
        mod.api = api;
    }
    Hooks.callAll("simplecover5eReady", api);
}
