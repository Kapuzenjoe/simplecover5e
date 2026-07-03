import { applyDialogCoverOverride } from "../applications/roll-configuration-dialog.mjs";
import { onPreCreateToken } from "../canvas/token-shape.mjs";
import { MODULE_ID, COVER, SETTING_KEYS } from "../config.mjs";
import { isMidiAutomation } from "../integrations/midi-qol.mjs";

import { getCover, getCoverForTargets } from "./api.mjs";
import { clearCoverDebug } from "./debug.mjs";
import { clearSystemCoverEffects, setCoverStatusViaGM } from "./status.mjs";
import { isDefeatedToken } from "./token.mjs";

const COVER_TARGETS_PATH = `data.flags.${MODULE_ID}.targets`;

/**
 * Register cover automation hooks for the native dnd5e workflow.
 *
 * @returns {void}
 */
export function initCoverHooks() {
  ignoreCoverProperties();
  Hooks.on("combatTurnChange", clearCoverOnCombatTurnChange);
  Hooks.on("deleteCombat", clearCoverOnDeleteCombat);
  Hooks.on("moveToken", clearCoverOnMovement);
  Hooks.on("preCreateToken", onPreCreateToken);
  Hooks.on("dnd5e.preRollAttack", onPreRollAttack);
  Hooks.on("dnd5e.preRollSavingThrow", onPreRollSavingThrow);
  Hooks.on("dnd5e.postSavingThrowRollConfiguration", onPostSavingThrowRollConfiguration);
  Hooks.on("dnd5e.buildAttackRollConfig", onBuildAttackRollConfig);
  Hooks.on("dnd5e.buildSavingThrowRollConfig", onBuildSavingThrowRollConfig);
}

/* -------------------------------------------- */

/**
 * Adjust the displayed AC for a specific target in the pending dnd5e roll message.
 *
 * @param {BasicRollMessageConfiguration} message The pending roll message configuration.
 * @param {string} targetUuid The actor UUID to match against `flags.dnd5e.targets`.
 * @param {number|null} newAC The new AC value.
 * @returns {void}
 */
function adjustMessageTargetAC(message, targetUuid, newAC) {
  const targets = message?.data?.flags?.dnd5e?.targets;
  if ( !Array.isArray(targets) ) return;

  for ( const t of targets ) {
    const uuid = t?.uuid ?? t?.tokenUuid ?? null;
    if ( !uuid || (uuid !== targetUuid) ) continue;
    t.ac = newAC;
    break;
  }
}

/* -------------------------------------------- */

/**
 * Clear cover when the active combat turn changes.
 *
 * @function combatTurnChange
 * @memberof hookEvents
 * @param {Combat} combat The combat encounter whose turn changed.
 * @param {Combatant|null} previous The previous combatant.
 * @param {Combatant|null} current The current combatant.
 * @returns {Promise<void>} Resolves after any cover cleanup has finished.
 */
async function clearCoverOnCombatTurnChange(combat, previous, current) {
  try {
    if ( !rollAutomationEnabled(combat) ) return;
    if ( !game.users.activeGM?.isSelf ) return;
    if ( !game.settings.get(MODULE_ID, SETTING_KEYS.RMV_ON_COMBAT) ) return;

    await clearSystemCoverEffects(combat);

    if ( game.settings.get(MODULE_ID, SETTING_KEYS.DEBUG) ) {
      clearCoverDebug();
    }
  } catch ( err ) {
    console.warn(`[${MODULE_ID}] clear on combat turn change`, err);
  }
}

/* -------------------------------------------- */

/**
 * Clear cover when a combat encounter is deleted.
 *
 * @function deleteCombat
 * @memberof hookEvents
 * @param {Combat} combat The combat encounter being deleted.
 * @returns {Promise<void>} Resolves after any cover cleanup has finished.
 */
async function clearCoverOnDeleteCombat(combat) {
  try {
    if ( !rollAutomationEnabled(combat) ) return;
    if ( !game.users.activeGM?.isSelf ) return;
    if ( !game.settings.get(MODULE_ID, SETTING_KEYS.RMV_ON_COMBAT) ) return;

    await clearSystemCoverEffects(combat);

    if ( game.settings.get(MODULE_ID, SETTING_KEYS.DEBUG) ) {
      clearCoverDebug();
    }
  } catch ( err ) {
    console.warn(`[${MODULE_ID}] clear on delete combat`, err);
  }
}

/* -------------------------------------------- */

/**
 * Clear cover after a token movement segment resolves during active combat.
 *
 * @function moveToken
 * @memberof hookEvents
 * @param {TokenDocument} token The token document that moved.
 * @returns {Promise<void>} Resolves after any cover cleanup has finished.
 */
async function clearCoverOnMovement(token) {
  try {
    const active = game.combats?.active;
    if ( !rollAutomationEnabled(active) ) return;
    if ( !game.users.activeGM?.isSelf ) return;
    if ( !game.settings.get(MODULE_ID, SETTING_KEYS.RMV_ON_MOVE) ) return;

    await clearSystemCoverEffects(active);

    if ( game.settings.get(MODULE_ID, SETTING_KEYS.DEBUG) ) {
      clearCoverDebug();
    }
  } catch ( err ) {
    console.warn(`[${MODULE_ID}] clear on token movement`, err);
  }
}

/* -------------------------------------------- */

/**
 * Resolve a token placeable from chat speaker data.
 *
 * @param {object} speaker The chat speaker data.
 * @returns {Token5e|null} The resolved token placeable, if available.
 */
function getSpeakerToken(speaker) {
  if ( !speaker?.scene || !speaker?.token ) return null;
  const scene = game.scenes.get(speaker.scene);
  return scene?.tokens.get(speaker.token)?.object ?? null;
}

/* -------------------------------------------- */

/**
 * Register the `ignoreCover` item property on DnD5e items.
 *
 * @returns {void}
 */
function ignoreCoverProperties() {
  CONFIG.DND5E.itemProperties.ignoreCover = {
    label: game.i18n.localize("SIMPLE_COVER_5E.ItemProperties.IgnoreCover.Label")
  };
  CONFIG.DND5E.validProperties.weapon.add("ignoreCover");
  CONFIG.DND5E.validProperties.spell.add("ignoreCover");
  CONFIG.DND5E.validProperties.feat.add("ignoreCover");
}

/* -------------------------------------------- */

/**
 * Update attack roll configuration when the cover selection changes in the roll dialog.
 *
 * @function dnd5e.buildAttackRollConfig
 * @memberof hookEvents
 * @param {RollConfigurationDialog} app The roll configuration dialog.
 * @param {BasicRollConfiguration} config The roll configuration data being updated.
 * @param {FormDataExtended} [formData] Form data entered into the rolling prompt.
 * @param {number} index The index of the roll being prepared.
 * @returns {void}
 */
function onBuildAttackRollConfig(app, config, formData, index) {
  if ( !rollAutomationEnabled() ) return;

  const changes = applyDialogCoverOverride(app, formData);
  const targets = app.message?.data?.flags?.dnd5e?.targets ?? [];

  for ( const change of changes ) {
    setAttackCoverBonus({
      config: config.options,
      desiredBonus: change.resolvedBonus,
      message: app.message,
      singleTarget: targets.length === 1,
      targetActor: change.targetActor
    });
    if ( change.resolvedBonus === null ) app.config.target = null;
  }
}

/* -------------------------------------------- */

/**
 * Update saving throw roll configuration when the cover selection changes in the roll dialog.
 *
 * @function dnd5e.buildSavingThrowRollConfig
 * @memberof hookEvents
 * @param {RollConfigurationDialog} app The roll configuration dialog.
 * @param {BasicRollConfiguration} config The roll configuration data being updated.
 * @param {FormDataExtended} [formData] Form data entered into the rolling prompt.
 * @param {number} index The index of the roll being prepared.
 * @returns {void}
 */
function onBuildSavingThrowRollConfig(app, config, formData, index) {
  if ( !rollAutomationEnabled() ) return;

  for ( const change of applyDialogCoverOverride(app, formData) ) {
    setSaveCoverBonus(config, change.resolvedBonus, change.resolvedCover);
  }
}

/* -------------------------------------------- */

/**
 * Block Dexterity saving throws when Total Cover prevents the roll.
 *
 * @function dnd5e.postSavingThrowRollConfiguration
 * @memberof hookEvents
 * @param {BasicRoll[]} rolls Rolls that have been constructed but not evaluated.
 * @param {BasicRollProcessConfiguration} config The pending roll process configuration.
 * @param {BasicRollDialogConfiguration} dialog The pending roll dialog configuration.
 * @param {BasicRollMessageConfiguration} message The pending roll message configuration.
 * @returns {false|void} Returns false to prevent the saving throw roll.
 */
function onPostSavingThrowRollConfiguration(rolls, config, dialog, message) {
  const isTotalCoverSave =
    (config?.ability === "dex")
    && rolls?.some?.(roll => roll?.options?.[MODULE_ID]?.totalCover === true);

  if ( !isTotalCoverSave || !rollAutomationEnabled() ) return;

  ui.notifications.info(game.i18n.localize(COVER.I18N.HINT_KEYS.Save.total));
  return false;
}

/* -------------------------------------------- */

/**
 * Apply cover adjustments before an attack roll is built.
 *
 * @function dnd5e.preRollAttack
 * @memberof hookEvents
 * @param {BasicRollProcessConfiguration} config The pending roll process configuration.
 * @param {BasicRollDialogConfiguration} dialog The pending roll dialog configuration.
 * @param {BasicRollMessageConfiguration} message The pending roll message configuration.
 * @returns {void}
 */
function onPreRollAttack(config, dialog, message) {
  if ( !rollAutomationEnabled() ) return;

  const actor = config.subject?.actor;
  if ( !actor ) return;
  const attackerToken = getSpeakerToken(message?.data?.speaker ?? ChatMessage.getSpeaker({ actor }));
  if ( !attackerToken ) return;
  const activity = config.subject ?? null;

  const targets = Array.from(game.user.targets)
    .filter(t => t?.document && !isDefeatedToken(t));
  if ( !targets.length ) return;

  const losCheck = !!game.settings.get(MODULE_ID, SETTING_KEYS.LOS_CHECK);
  const resultArray = getCoverForTargets({
    activity,
    losCheck,
    targets,
    attacker: attackerToken,
    includeEmbeddedCover: true,
    scene: attackerToken.scene
  });

  for ( const out of resultArray ) {
    const targetActor = out.target?.actor;
    if ( !targetActor ) continue;
    const resolvedCover = out.result?.cover ?? "none";
    const resolvedBonus = out.result?.bonus ?? COVER.BONUS[resolvedCover];

    void setCoverStatusViaGM(targetActor.uuid, resolvedCover);
    setAttackCoverBonus({
      config,
      message,
      targetActor,
      desiredBonus: resolvedBonus,
      singleTarget: targets.length === 1
    });

    setCoverTarget(message, targetActor, resolvedCover);
  }
}

/* -------------------------------------------- */

/**
 * Apply cover adjustments before a dexterity saving throw roll is built.
 *
 * @function dnd5e.preRollSavingThrow
 * @memberof hookEvents
 * @param {BasicRollProcessConfiguration} config The pending roll process configuration.
 * @param {BasicRollDialogConfiguration} dialog The pending roll dialog configuration.
 * @param {BasicRollMessageConfiguration} message The pending roll message configuration.
 * @returns {void}
 */
function onPreRollSavingThrow(config, dialog, message) {
  if ( !rollAutomationEnabled() ) return;

  const actor = config.subject;
  const isDex = config.ability === "dex";
  if ( !isDex ) return;
  if ( !actor ) return;

  const targetToken = getSpeakerToken(message?.data?.speaker ?? ChatMessage.getSpeaker({ actor }));
  if ( !targetToken ) return;

  const srcMsg = resolveSourceMessage(config);
  const activity = srcMsg?.getAssociatedActivity?.() ?? null;
  const sourceActor = srcMsg?.getAssociatedActor?.() ?? null;

  const source = getSpeakerToken(
    srcMsg?.speaker ?? (sourceActor ? ChatMessage.getSpeaker({ actor: sourceActor }) : null)
  );
  const sourceScene = source?.scene
    ?? source?.document?.parent
    ?? targetToken.scene
    ?? targetToken?.document?.parent
    ?? canvas?.scene;
  if ( !source || !activity || !sourceScene ) return;

  const templateType = activity.target?.template?.type ?? "";
  if ( (templateType === "wall") || (templateType === "ring") ) return;

  let attacker = source;
  if ( templateType ) {
    const rangeUnits = activity.range?.units ?? "";
    if ( (rangeUnits !== "self") && (rangeUnits !== "touch") && (rangeUnits !== "special") ) {
      const origin = resolveAoEOrigin(activity, targetToken);
      if ( !origin ) {
        void setCoverStatusViaGM(actor.uuid, "none");
        setSaveCoverBonus(config.rolls?.[0], 0, "none");
        setCoverTarget(message, actor, "none");
        return;
      }
      attacker = origin;
    }
  }

  const losCheck = !!game.settings.get(MODULE_ID, SETTING_KEYS.LOS_CHECK);
  const result = getCover({
    activity,
    attacker,
    losCheck,
    includeEmbeddedCover: true,
    scene: sourceScene,
    target: targetToken
  });

  const resolvedCover = result?.cover ?? "none";
  const resolvedBonus = result?.bonus ?? COVER.BONUS[resolvedCover];

  void setCoverStatusViaGM(actor.uuid, resolvedCover);
  setSaveCoverBonus(config.rolls?.[0], resolvedBonus, resolvedCover);

  setCoverTarget(message, actor, resolvedCover);
}

/* -------------------------------------------- */

/**
 * Resolve the AoE origin position from a placed template region for a saving throw.
 *
 * @param {Activity5e} activity The activity triggering the saving throw.
 * @param {Token5e} targetToken The token making the saving throw.
 * @returns {{ x: number, y: number, elevation: number, level: string|null }|null} The AoE origin
 */
function resolveAoEOrigin(activity, targetToken) {
  const itemUuid = activity.item?.uuid;
  if ( !itemUuid ) return null;

  const regions = canvas.regions?.placeables?.filter(
    r => r.document.getFlag("dnd5e", "item") === itemUuid
  ) ?? [];

  const targetDoc = targetToken.document;
  const containing = regions.find(r => r.document.tokens.has(targetDoc));
  if ( !containing ) return null;

  return {
    elevation: containing.document.elevation.bottom ?? 0,
    level: targetDoc.level ?? null,
    x: containing.center.x,
    y: containing.center.y
  };
}

/* -------------------------------------------- */

/**
 * Resolve the source chat message for a saving throw workflow.
 *
 * @param {BasicRollProcessConfiguration} config The pending roll process configuration.
 * @returns {ChatMessage5e|null} The resolved source chat message, if any.
 */
function resolveSourceMessage(config) {
  const messageId =
    config?.sourceMessageId
    ?? config?.event?.target?.closest?.("[data-message-id]")?.dataset.messageId;

  const baseMessage = messageId ? game.messages.get(messageId) : null;
  return baseMessage?.getOriginatingMessage?.() ?? baseMessage;
}

/* -------------------------------------------- */

/**
 * Test whether the native roll automation should run for the current workflow.
 *
 * @param {Combat|null} [combat=game.combats.active] The combat context for combat-only automation.
 * @returns {boolean} True when cover automation may mutate the roll workflow.
 */
function rollAutomationEnabled(combat=game.combats?.active) {
  if ( game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE) ) return false;
  if ( isMidiAutomation() ) return false;
  return !game.settings.get(MODULE_ID, SETTING_KEYS.ONLY_IN_COMBAT) || !!combat;
}

/* -------------------------------------------- */

/**
 * Apply the resolved cover bonus to the pending attack roll and message target data.
 *
 * @param {object} options The values used to update the pending roll.
 * @param {0|2|5|null} options.desiredBonus The resolved cover bonus.
 * @param {Actor5e} options.targetActor The targeted actor.
 * @param {boolean} [options.singleTarget=true] Whether only one target is being rolled against.
 * @param {{ target?: number|null }} options.config The process or roll options object to update.
 * @param {BasicRollMessageConfiguration} options.message The pending message configuration.
 * @returns {void}
 */
function setAttackCoverBonus({ desiredBonus, targetActor, singleTarget = true, config, message }) {
  if ( desiredBonus !== null ) {
    const baseAC = targetActor?.system?.attributes?.ac?.value;
    const oldCoverAC = targetActor?.system?.attributes?.ac?.cover || 0;
    const newAC = baseAC + desiredBonus - oldCoverAC;

    adjustMessageTargetAC(message, targetActor.uuid, newAC);
    if ( singleTarget ) config.target = Math.max(0, newAC);
  }
  else {
    adjustMessageTargetAC(message, targetActor.uuid, null);
    if ( singleTarget ) config.target = null;
  }
}

/* -------------------------------------------- */

/**
 * Store cover state for the roll dialog and optional GM chat summary.
 *
 * @param {BasicRollMessageConfiguration} message The pending roll message configuration.
 * @param {Actor5e} actor The target actor.
 * @param {("none"|"half"|"threeQuarters"|"total")} cover The resolved cover level.
 * @returns {void}
 */
function setCoverTarget(message, actor, cover) {
  if ( !message || !actor || !COVER.KEYS.includes(cover) ) return;

  const mode = game.settings.get(MODULE_ID, SETTING_KEYS.COVER_HINTS);
  if ( (mode !== "always") && ((mode !== "conditional") || (cover === "none")) ) return;

  let targets = foundry.utils.getProperty(message, COVER_TARGETS_PATH);
  if ( !Array.isArray(targets) ) {
    targets = [];
    foundry.utils.setProperty(message, COVER_TARGETS_PATH, targets);
  }

  const data = { newCover: null, originalCover: cover, uuid: actor.uuid };
  const existing = targets.findIndex(target => target.uuid === actor.uuid);
  if ( existing >= 0 ) targets[existing] = data;
  else targets.push(data);
}

/* -------------------------------------------- */

/**
 * Apply the resolved cover bonus to a dexterity saving throw roll configuration.
 *
 * @param {D20RollConfiguration} rollConfig The roll configuration to update.
 * @param {0|2|5|null} desiredBonus The resolved cover bonus.
 * @param {("none"|"half"|"threeQuarters"|"total")} desiredCover The resolved cover level.
 * @returns {void}
 */
function setSaveCoverBonus(rollConfig, desiredBonus, desiredCover) {
  if ( !rollConfig ) return;

  rollConfig.data ??= {};
  rollConfig.options ??= {};
  rollConfig.options[MODULE_ID] ??= {};
  rollConfig.options[MODULE_ID].totalCover = desiredCover === "total";

  rollConfig.data.cover = desiredBonus ?? 0;
}
