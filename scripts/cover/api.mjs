/**
 * @import { CoverContext, CoverEvaluationResult, CoverTargetResult, DialogNoteData, LosResult, Position } from "../types/shared.mjs";
 */

import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.mjs";
import {
    buildCoverContext,
    evaluateCoverFromOccluders,
    evaluateLOS,
} from "./engine.mjs";
import { ignoresCover } from "./rules.mjs";
import { drawCoverDebug, clearCoverDebug } from "./debug.mjs";
import { measureTokenDistance } from "../canvas/distance.mjs";
import { getActorCoverStates } from "./status.mjs";

/**
 * Evaluate line of sight (LOS) from an attacker to a target.
 *
 * @param {TokenDocument|Position} attackerDoc The attacking token document or a generic position.
 * @param {TokenDocument} targetDoc The target token document.
 * @param {CoverContext|null} [ctx=null] The cover evaluation context.
 * @returns {LosResult|null} The LOS result and sampled target points.
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
 * @param {Token|TokenDocument} sourceToken The source token or document.
 * @param {Token|TokenDocument} targetToken The target token or document.
 * @returns {number} The minimal distance in grid units.
 */
function getTokenTokenDistance(sourceToken, targetToken) {
    return measureTokenDistance(sourceToken, targetToken);
}

/**
 * Resolve the final cover result exposed by the provider API.
 *
 * @param {TokenDocument|Position} targetDoc The target token document or target-like object.
 * @param {CoverEvaluationResult} result The raw cover result to adjust.
 * @param {object} [options={}] Additional result options.
 * @param {Activity5e|null} [options.activity=null] The activity being evaluated.
 * @param {boolean} [options.includeEmbeddedCover=false] Whether embedded cover effects on the target should be considered.
 * @returns {CoverEvaluationResult} The effective cover result.
 */
function resolveCoverResult(targetDoc, result, { activity = null, includeEmbeddedCover = false } = {}) {
    let cover = result.cover ?? "none";
    let bonus = result.bonus;

    if (includeEmbeddedCover) {
        const { embeddedCover } = getActorCoverStates(targetDoc?.actor);
        if (COVER.ORDER[embeddedCover] > COVER.ORDER[cover]) {
            cover = embeddedCover;
            bonus = COVER.BONUS[embeddedCover];
        }
    }

    if (activity) {
        ({ cover, bonus } = ignoresCover(activity, cover, targetDoc?.actor));
    }

    result.cover = cover;
    result.bonus = bonus;
    return result;
}

/**
 * Compute cover between a single attacker and a single target, optionally including a line-of-sight check.
 *
 * @param {object} [options={}] Options controlling the cover evaluation.
 * @param {Token|TokenDocument|Position} options.attacker The attacking token, token document, or generic position.
 * @param {Token|TokenDocument} options.target The target token or token document.
 * @param {Scene} [options.scene=canvas.scene] The scene on which to evaluate cover.
 * @param {boolean|null} [options.debug=null] Whether to force debug output. Null uses the module debug setting.
 * @param {boolean} [options.losCheck=false] Whether to perform a wall line-of-sight check.
 * @param {Activity5e|null} [options.activity=null] The activity being evaluated for cover.
 * @param {boolean} [options.includeEmbeddedCover=false] Whether embedded cover effects on the target should be considered.
 * @returns {CoverEvaluationResult|null} The computed cover result, or null if inputs are invalid.
 */
export function getCover({ attacker, target, scene = canvas?.scene, debug = null, losCheck = false, activity = null, includeEmbeddedCover = false } = {}) {
    if (!attacker || !target || !scene) return null;

    const attackerDoc = attacker.document ?? attacker;
    const targetDoc = target.document ?? target;
    if (!attackerDoc || !targetDoc) return null;

    const settingDebug = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
    const debugOn = (debug === null) ? settingDebug : !!debug;

    if (debugOn && game.users.activeGM) clearCoverDebug();

    const ctx = buildCoverContext(scene);
    if (!ctx) return null;

    let los = { hasLOS: true, targetLosPoints: [] };
    if (losCheck) {
        los = evaluateLOS(attackerDoc, targetDoc, ctx);
    }

    const result = los.hasLOS
        ? evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, { debug: debugOn })
        : { cover: "total", bonus: null };

    const finalResult = resolveCoverResult(targetDoc, result, { activity, includeEmbeddedCover });

    if (debugOn && game.users.activeGM && (finalResult.debugSegments?.length || los.targetLosPoints?.length)) {
        drawCoverDebug({
            segments: finalResult.debugSegments ?? [],
            tokenShapes: finalResult.debugTokenShapes,
            targetLosPoints: los.targetLosPoints
        });
    }
    return finalResult;
}

/**
 * Compute cover between a single attacker and multiple targets, optionally including a line-of-sight check.
 *
 * @param {object} [options={}] Options controlling the cover evaluation.
 * @param {Token|TokenDocument|Position} options.attacker The attacking token, token document, or generic position.
 * @param {Token[]|TokenDocument[]|null} [options.targets] Explicit targets, or the user's current targets.
 * @param {Scene} [options.scene=canvas.scene] The scene on which to evaluate cover.
 * @param {boolean|null} [options.debug=null] Whether to force debug output. Null uses the module debug setting.
 * @param {boolean} [options.losCheck=false] Whether to perform a wall line-of-sight check.
 * @param {Activity5e|null} [options.activity=null] The activity being evaluated for cover.
 * @param {boolean} [options.includeEmbeddedCover=false] Whether embedded cover effects on targets should be considered.
 * @returns {CoverTargetResult[]} The per-target cover results.
 */
export function getCoverForTargets({ attacker, targets = null, scene = canvas?.scene, debug = null, losCheck = false, activity = null, includeEmbeddedCover = false } = {}) {
    if (!attacker || !scene) return [];

    const attackerDoc = attacker.document ?? attacker;
    if (!attackerDoc) return [];

    const settingDebug = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
    const debugOn = (debug === null) ? settingDebug : !!debug;

    if (debugOn && game.users.activeGM) clearCoverDebug();

    const ctx = buildCoverContext(scene);
    if (!ctx) return [];

    const list = targets
        ? Array.from(targets)
        : Array.from(game.user?.targets ?? []);

    const out = [];
    for (const t of list) {
        const targetDoc = t?.document ?? t;
        if (!targetDoc) continue;

        let los = { hasLOS: true, targetLosPoints: [] };
        if (losCheck) {
            los = evaluateLOS(attackerDoc, targetDoc, ctx);
        }

        const result = los.hasLOS
            ? evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, { debug: debugOn })
            : { cover: "total", bonus: null };

        const finalResult = resolveCoverResult(targetDoc, result, { activity, includeEmbeddedCover });

        out.push({ target: t, result: finalResult, los });
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
 * @param {BasicRollDialogConfiguration|RollConfigurationDialog} dialogConfig The dialog configuration object.
 * @param {DialogNoteData} [note={}] The note definition.
 * @returns {void}
 */
export function setDialogNote(dialogConfig, note = {}) {
    if (!dialogConfig) return;

    dialogConfig.options ??= {};
    const data = (dialogConfig.options[MODULE_ID] ??= {});
    data.notes ??= [];

    const { cover, target, icon = "", label = "", hint = "", ...metadata } = note;
    const targetId = target == null ? null : String(target);
    const noteData = {
        ...metadata,
        cover: cover ?? null,
        target: targetId,
        icon: String(icon ?? ""),
        label: String(label ?? ""),
        hint: String(hint ?? "")
    };

    const existingIndex = targetId === null ? -1 : data.notes.findIndex(note => note.target === targetId);
    if (existingIndex !== -1) data.notes[existingIndex] = noteData;
    else data.notes.push(noteData);
}

/**
 * Get whether the configured Library Mode setting is enabled.
 *
 * @returns {boolean} True if the Library Mode setting is enabled.
 */
function getLibraryMode() {
    return game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE);
}

/**
 * Enable or disable library mode for this module.
 *
 * @param {boolean} enabled The desired library mode state.
 * @returns {Promise<boolean>} True if the setting was updated; otherwise false.
 */
async function setLibraryMode(enabled) {
    if (!game.user.isGM) return false;
    await game.settings.set(MODULE_ID, SETTING_KEYS.LIBRARY_MODE, !!enabled);
    return true;
}

/**
 * Initialize and expose the module API on the module instance.
 *
 * @returns {void}
 */
export function initApi() {

    const api = {
        getCover,
        getCoverForTargets,
        getLibraryMode,
        setLibraryMode,
        getLOS,
        getTokenTokenDistance,
        setDialogNote,
    };

    const mod = game.modules.get(MODULE_ID);
    if (mod) {
        mod.api = api;
    }
}

/**
 * Fire the module-ready API hook.
 *
 * @returns {void}
 */
export function readyApi() {
    const api = game.modules.get(MODULE_ID)?.api;
    if (!api) return;
    Hooks.callAll("simplecover5eReady", api);
}
