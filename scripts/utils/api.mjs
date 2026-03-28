/**
 * @import { CoverContext, CoverEvaluationResult, CoverLevel, CoverTargetResult, DialogNoteData, LosResult, Position } from "../types/shared.types.mjs";
 */

import { MODULE_ID, SETTING_KEYS } from "../config/constants.config.mjs";
import {
    buildCoverContext,
    evaluateCoverFromOccluders,
    evaluateLOS,
} from "../services/cover.engine.mjs";
import { ignoresCover } from "../utils/rules.cover.mjs";
import { drawCoverDebug, clearCoverDebug } from "../services/cover.debug.mjs";
import { measureTokenDistance } from "../utils/distance.mjs";

/**
 * Resolve the effective cover level for an activity, including ignore-cover rules.
 *
 * @param {Activity5e} activity The activity being evaluated.
 * @param {CoverLevel} cover The computed/requested cover level.
 * @param {Actor5e|null} [targetActor=null] The targeted actor.
 * @returns {{cover: CoverLevel, bonus: (0|2|5|null)}} The effective cover level and its corresponding bonus.
 */
export function getIgnoreCover(activity, cover, targetActor = null) {
    return ignoresCover(activity, cover, targetActor);
}

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
 * Build the cover evaluation context.
 *
 * @param {Scene} [scene=canvas.scene] The scene for which to build the cover context.
 * @returns {CoverContext|null} The cover evaluation context, or null if no scene is available.
 */
function buildContext(scene = canvas?.scene) {
    if (!scene) return null;
    return buildCoverContext(scene);
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
 * @returns {CoverEvaluationResult|null} The computed cover result, or null if inputs are invalid.
 */
export function getCover({ attacker, target, scene = canvas?.scene, debug = null, losCheck = false, activity = null } = {}) {
    if (!attacker || !target || !scene) return null;

    const attackerDoc = attacker.document ?? attacker;
    const targetDoc = target.document ?? target;
    if (!attackerDoc || !targetDoc) return null;

    const settingDebug = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
    const debugOn = (debug === null) ? settingDebug : !!debug;

    if (debugOn && game.users.activeGM) clearCoverDebug();

    const ctx = buildContext(scene);
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
        const { cover: desiredCover, bonus: desiredBonus } = getIgnoreCover(activity, result?.cover ?? "none", targetDoc?.actor);
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
 * Compute cover between a single attacker and multiple targets, optionally including a line-of-sight check.
 *
 * @param {object} [options={}] Options controlling the cover evaluation.
 * @param {Token|TokenDocument|Position} options.attacker The attacking token, token document, or generic position.
 * @param {Token[]|TokenDocument[]|null} [options.targets] Explicit targets, or the user's current targets.
 * @param {Scene} [options.scene=canvas.scene] The scene on which to evaluate cover.
 * @param {boolean|null} [options.debug=null] Whether to force debug output. Null uses the module debug setting.
 * @param {boolean} [options.losCheck=false] Whether to perform a wall line-of-sight check.
 * @param {Activity5e|null} [options.activity=null] The activity being evaluated for cover.
 * @returns {CoverTargetResult[]} The per-target cover results.
 */
export function getCoverForTargets({ attacker, targets = null, scene = canvas?.scene, debug = null, losCheck = false, activity = null } = {}) {
    if (!attacker || !scene) return [];

    const attackerDoc = attacker.document ?? attacker;
    if (!attackerDoc) return [];

    const settingDebug = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
    const debugOn = (debug === null) ? settingDebug : !!debug;

    if (debugOn && game.users.activeGM) clearCoverDebug();

    const ctx = buildContext(scene);
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
            const { cover: desiredCover, bonus: desiredBonus } = getIgnoreCover(activity, result?.cover ?? "none", targetDoc?.actor);
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
 * @param {BasicRollDialogConfiguration|RollConfigurationDialog} dialogConfig The dialog configuration object.
 * @param {DialogNoteData} [note={}] The note definition.
 * @returns {void}
 */
export function setDialogNote(dialogConfig, { cover, target, icon = "", label = "", hint = "" } = {}) {
    if (!dialogConfig) return;

    dialogConfig.options ??= {};
    const data = (dialogConfig.options[MODULE_ID] ??= {});
    data.notes ??= [];

    const noteData = {
        cover: cover ?? null,
        target: String(target) ?? null,
        icon: String(icon ?? ""),
        label: String(label ?? ""),
        hint: String(hint ?? "")
    };

    const existingIndex = data.notes.findIndex(note => String(note.target) === String(target) && note.target != null);

    if (existingIndex !== -1) {
        data.notes[existingIndex] = noteData;
    } else {
        data.notes.push(noteData);
    }

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
        getIgnoreCover,
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
