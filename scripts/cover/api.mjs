/**
 * @import {
 *   CoverContext,
 *   CoverEvaluationResult,
 *   CoverTargetResult,
 *   DialogNoteData,
 *   LosResult,
 *   Position
 * } from "../_types.mjs";
 */

import { drawCoverDebug, clearCoverDebug } from "../canvas/debug.mjs";
import { getTokenTokenDistance } from "../canvas/distance.mjs";
import { MODULE_ID, COVER, SETTING_KEYS } from "../config.mjs";

import {
  buildCoverContext,
  evaluateCoverFromOccluders,
  evaluateLOS
} from "./engine.mjs";
import { ignoresCover } from "./rules.mjs";
import { getActorCoverStates } from "./status.mjs";

/**
 * Resolve the debug flag and cover context for a cover evaluation, clearing any prior debug drawing first.
 * @param {Scene} scene The scene on which to evaluate cover.
 * @param {boolean|null} debug Whether to force debug output. Null uses the module debug setting.
 * @returns {{ debugOn: boolean, ctx: CoverContext|null }} The resolved debug flag and cover context.
 */
function resolveDebugContext(scene, debug) {
  const settingDebug = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
  const debugOn = (debug === null) ? settingDebug : !!debug;

  if ( debugOn && game.users.activeGM ) clearCoverDebug();

  return { debugOn, ctx: buildCoverContext(scene) };
}

/* -------------------------------------------- */

/**
 * Compute cover between a single attacker and a single target, optionally including a line-of-sight check.
 * @param {object} [options={}] Options controlling the cover evaluation.
 * @param {Token5e|TokenDocument5e|Position} options.attacker The attacking token, token document, or generic position.
 * @param {Token|TokenDocument} options.target The target token or token document.
 * @param {Scene} [options.scene] The scene on which to evaluate cover.
 * @param {boolean|null} [options.debug=null] Whether to force debug output. Null uses the module debug setting.
 * @param {boolean} [options.losCheck=false] Whether to perform a wall line-of-sight check.
 * @param {Activity5e|null} [options.activity=null] The activity being evaluated for cover.
 * @param {boolean} [options.includeEmbeddedCover=false] Whether embedded cover effects on the target should be
 *   considered.
 * @returns {CoverEvaluationResult|null} The computed cover result, or null if inputs are invalid.
 */
export function getCover({
  attacker,
  target,
  scene,
  debug = null,
  losCheck = false,
  activity = null,
  includeEmbeddedCover = false
}={}) {
  if ( !attacker || !target ) return null;

  const attackerDoc = attacker.document ?? attacker;
  const targetDoc = target.document ?? target;
  if ( !attackerDoc || !targetDoc ) return null;

  scene ??= attackerDoc.parent ?? canvas?.scene;
  if ( !scene ) return null;
  if ( targetDoc.parent !== scene ) return null;

  const { debugOn, ctx } = resolveDebugContext(scene, debug);
  if ( !ctx ) return null;

  const { result, los } = evaluateTargetCover(attackerDoc, targetDoc, ctx, {
    activity,
    includeEmbeddedCover,
    losCheck,
    debug: debugOn
  });

  if ( debugOn && game.users.activeGM && (result.debugSegments?.length || los.targetLosPoints?.length) ) {
    drawCoverDebug({
      segments: result.debugSegments ?? [],
      targetLosPoints: los.targetLosPoints,
      tokenShapes: result.debugTokenShapes
    });
  }
  return result;
}


/* -------------------------------------------- */

/**
 * Compute cover between a single attacker and multiple targets, optionally including a line-of-sight check.
 * @param {object} [options={}] Options controlling the cover evaluation.
 * @param {Token5e|TokenDocument5e|Position} options.attacker The attacking token, token document, or generic position.
 * @param {Token5e[]|TokenDocument5e[]|null} [options.targets] Explicit targets, or the user's current targets.
 * @param {Scene} [options.scene] The scene on which to evaluate cover.
 * @param {boolean|null} [options.debug=null] Whether to force debug output. Null uses the module debug setting.
 * @param {boolean} [options.losCheck=false] Whether to perform a wall line-of-sight check.
 * @param {Activity5e|null} [options.activity=null] The activity being evaluated for cover.
 * @param {boolean} [options.includeEmbeddedCover=false] Whether embedded cover effects on targets should be considered.
 * @returns {CoverTargetResult[]} The per-target cover results.
 */
export function getCoverForTargets({
  attacker,
  targets = null,
  scene,
  debug = null,
  losCheck = false,
  activity = null,
  includeEmbeddedCover = false
}={}) {
  if ( !attacker ) return [];

  const attackerDoc = attacker.document ?? attacker;
  if ( !attackerDoc ) return [];

  scene ??= attackerDoc.parent ?? canvas?.scene;
  if ( !scene ) return [];

  const { debugOn, ctx } = resolveDebugContext(scene, debug);
  if ( !ctx ) return [];

  const list = targets
    ? Array.from(targets)
    : Array.from(game.user?.targets ?? []);

  const out = [];
  for ( const t of list ) {
    const targetDoc = t?.document ?? t;
    if ( !targetDoc ) continue;
    if ( targetDoc.parent !== scene ) continue;

    const { result, los } = evaluateTargetCover(attackerDoc, targetDoc, ctx, {
      activity,
      includeEmbeddedCover,
      losCheck,
      debug: debugOn
    });

    out.push({ los, result, target: t });
  }

  if ( debugOn && out.length && game.users.activeGM ) {
    for ( const e of out ) {
      drawCoverDebug({
        segments: e.result?.debugSegments ?? [],
        targetLosPoints: e.los?.targetLosPoints ?? [],
        tokenShapes: e.result?.debugTokenShapes
      });
    }
  }

  return out;
}

/* -------------------------------------------- */

/**
 * Initialize and expose the module API on the module instance.
 * @returns {void}
 */
export function initApi() {

  const api = {
    getCover,
    getCoverForTargets,
    getLibraryMode,
    getLOS,
    getTokenTokenDistance,
    setDialogNote,
    setLibraryMode
  };

  const mod = game.modules.get(MODULE_ID);
  if ( mod ) {
    mod.api = api;
  }
}

/* -------------------------------------------- */

/**
 * Fire the module-ready API hook.
 * @returns {void}
 */
export function readyApi() {
  const api = game.modules.get(MODULE_ID)?.api;
  if ( !api ) return;

  /**
   * A hook event that fires once the Simple Cover 5e API has been attached to the module.
   * @function simplecover5eReady
   * @memberof hookEvents
   * @param {object} api The module's public API.
   */
  Hooks.callAll("simplecover5eReady", api);
}

/* -------------------------------------------- */

/**
 * Add a note (icon + label + hint) to the next Roll Configuration Dialog for this roll workflow.
 * @param {BasicRollDialogConfiguration|RollConfigurationDialog} dialogConfig The dialog configuration object.
 * @param {DialogNoteData} [note={}] The note definition.
 * @returns {void}
 */
export function setDialogNote(dialogConfig, note={}) {
  if ( !dialogConfig ) return;

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
  if ( existingIndex !== -1 ) data.notes[existingIndex] = noteData;
  else data.notes.push(noteData);
}

/* -------------------------------------------- */

/**
 * Evaluate the cover workflow for a prepared attacker/target pair.
 * @param {TokenDocument5e|Position} attackerDoc The attacking token document or a generic position.
 * @param {TokenDocument} targetDoc The target token document.
 * @param {CoverContext} ctx The cover evaluation context.
 * @param {object} [options={}] Cover workflow options.
 * @param {boolean} [options.debug=false] Whether debug geometry should be collected.
 * @param {boolean} [options.losCheck=false] Whether wall line-of-sight can force total cover.
 * @param {Activity5e|null} [options.activity=null] The activity being evaluated for cover rules.
 * @param {boolean} [options.includeEmbeddedCover=false] Whether embedded cover effects should be considered.
 * @returns {{ result: CoverEvaluationResult, los: LosResult }} The final cover result and LOS data.
 */
function evaluateTargetCover(attackerDoc, targetDoc, ctx, {
  debug = false,
  losCheck = false,
  activity = null,
  includeEmbeddedCover = false
}={}) {
  const los = losCheck
    ? evaluateLOS(attackerDoc, targetDoc, ctx)
    : { hasLOS: true, targetLosPoints: [] };

  const result = los.hasLOS
    ? evaluateCoverFromOccluders(attackerDoc, targetDoc, ctx, { debug })
    : { bonus: null, cover: "total" };

  let cover = result.cover ?? "none";
  let bonus = result.bonus;

  if ( includeEmbeddedCover ) {
    const { embeddedCover } = getActorCoverStates(targetDoc?.actor);
    if ( COVER.ORDER[embeddedCover] > COVER.ORDER[cover] ) {
      cover = embeddedCover;
      bonus = COVER.BONUS[embeddedCover];
    }
  }

  if ( activity ) {
    ({ cover, bonus } = ignoresCover(activity, cover, targetDoc?.actor));
  }

  result.cover = cover;
  result.bonus = bonus;
  return { los, result };
}

/* -------------------------------------------- */

/**
 * Get whether the configured Library Mode setting is enabled.
 * @returns {boolean} True if the Library Mode setting is enabled.
 */
function getLibraryMode() {
  return game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE);
}

/* -------------------------------------------- */

/**
 * Evaluate line of sight (LOS) from an attacker to a target.
 * @param {TokenDocument5e|Position} attackerDoc The attacking token document or a generic position.
 * @param {TokenDocument} targetDoc The target token document.
 * @param {CoverContext|null} [ctx=null] The cover evaluation context.
 * @returns {LosResult|null} The LOS result and sampled target points.
 */
function getLOS(attackerDoc, targetDoc, ctx=null) {
  const s = targetDoc?.parent ?? canvas?.scene;
  if ( !s ) return null;

  ctx ??= buildCoverContext(s);

  return evaluateLOS(attackerDoc, targetDoc, ctx);
}

/* -------------------------------------------- */

/**
 * Enable or disable library mode for this module.
 * @param {boolean} enabled The desired library mode state.
 * @returns {Promise<boolean>} True if the setting was updated; otherwise false.
 */
async function setLibraryMode(enabled) {
  if ( !game.user.isGM ) return false;
  await game.settings.set(MODULE_ID, SETTING_KEYS.LIBRARY_MODE, !!enabled);
  return true;
}
