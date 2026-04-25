import { MODULE_ID, COVER, COVER_ICON_PATHS, SETTING_KEYS } from "../config/constants.config.mjs";
import { clearSystemCoverEffects, getActorCoverStates, isDefeatedToken, isLibraryMode } from "../services/cover.service.mjs";
import { clearCoverOverride, getCover, getCoverForTargets, getIgnoreCover, setCoverOverride, setDialogNote } from "../utils/api.mjs";
import { clearCoverDebug } from "../services/cover.debug.mjs";
import { toggleCoverEffectViaGM } from "../services/queries.service.mjs";

/**
 * Register the `ignoreCover` item property on DnD5e items.
 *
 * @returns {void}
 */
export function ignoreCoverProperties() {
  const labelKey = "SIMPLE_COVER_5E.ItemProperties.IgnoreCover.Label";
  CONFIG.DND5E.itemProperties.ignoreCover = {
    label: game.i18n.has(labelKey) ? game.i18n.localize(labelKey) : "Ignores Cover",
    abbreviation: "iC" // Workaround for https://github.com/foundryvtt/dnd5e/issues/6378
  };
  CONFIG.DND5E.validProperties.weapon.add("ignoreCover");
  CONFIG.DND5E.validProperties.spell.add("ignoreCover");
  CONFIG.DND5E.validProperties.feat.add("ignoreCover");
}

/**
 * Resolve a token placeable from chat speaker data.
 *
 * @param {object} speaker The chat speaker data.
 * @returns {Token5e|null} The resolved token placeable, if available.
 */
function getSpeakerToken(speaker) {
  if (!speaker?.scene || !speaker?.token) return null;
  const scene = game.scenes.get(speaker.scene);
  return scene?.tokens.get(speaker.token)?.object ?? null;
}

/**
 * Resolve the source chat message for a saving throw workflow.
 *
 * @param {BasicRollProcessConfiguration} config The pending roll process configuration.
 * @returns {ChatMessage5e|null} The resolved source chat message, if any.
 */
function resolveSourceMessage(config) {
  const messageId =
    config?.sourceMessageId ??
    config?.event?.target?.closest?.("[data-message-id]")?.dataset.messageId;

  const baseMessage = messageId ? game.messages.get(messageId) : null;
  return baseMessage?.getOriginatingMessage?.() ?? baseMessage;
}

function getCoverMessageNotes(message) {
  message.data ??= {};
  message.data.flags ??= {};
  message.data.flags[MODULE_ID] ??= {};
  message.data.flags[MODULE_ID].notes ??= [];
  return message.data.flags[MODULE_ID].notes;
}

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
export function onPreRollAttack(config, dialog, message) {
  const onlyInCombat = !!game.settings.get(MODULE_ID, SETTING_KEYS.ONLY_IN_COMBAT);
  if (onlyInCombat && !game?.combats?.active) return;
  if (isLibraryMode()) return;

  const coverHintsMode = game.settings.get(MODULE_ID, SETTING_KEYS.COVER_HINTS);

  const actor = config.subject?.actor;
  if (!actor) return;
  const attackerToken = getSpeakerToken(message?.data?.speaker ?? ChatMessage.getSpeaker({ actor }));
  if (!attackerToken) return;
  const activity = config.subject ?? null;
  clearCoverOverride(activity);

  const targets = Array.from(game.user.targets)
    .filter(t => t?.document && !isDefeatedToken(t));
  if (!targets.length) return;

  const losCheck = !!game.settings.get(MODULE_ID, SETTING_KEYS.LOS_CHECK);
  const resultArray = getCoverForTargets({ attacker: attackerToken, targets: targets, scene: attackerToken.scene, losCheck: losCheck, activity: activity });
  const messageNotes = getCoverMessageNotes(message);
  messageNotes.length = 0;

  for (const out of resultArray) {
    const targetActor = out.target?.actor;
    if (!targetActor) continue;
    const calcCover = out.result?.cover ?? "none";
    const calcBonus = out.result?.bonus;

    const {
      cover: resolvedCover,
      bonus: resolvedBonus,
      statusCover,
      embeddedCover
    } = resolveCoverState(targetActor, activity, calcCover, calcBonus);
    applyCoverAutomation(targetActor, calcCover, statusCover, embeddedCover);
    setAttackCoverBonus({ desiredBonus: resolvedBonus, targetActor, singleTarget: targets.length === 1, config, message });

    const isHideNPCNamesActive = game.modules?.get?.("hide-npc-names")?.active === true;
    const targetName = isHideNPCNamesActive && game?.hnn ? game.hnn.getReplacementInfo(targetActor).displayName : out.target?.name || "???";

    if (coverHintsMode === "always" || (coverHintsMode === "conditional" && resolvedCover !== "none")) {
      messageNotes.push({
        desiredCover: resolvedCover,
        desiredBonus: resolvedBonus,
        targetId: out.target.id,
        targetName: targetName,
        targetActorUuid: targetActor.uuid,
        activityUuid: activity.uuid
      });

      const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
      const hint = game.i18n.format(
        COVER.I18N.HINT_KEYS.Attack[resolvedCover],
        { tokenName: targetName }
      );

      setDialogNote(dialog, {
        cover: resolvedCover,
        target: out.target.id,
        icon: COVER_ICON_PATHS[resolvedCover] ?? "",
        label: coverPrefix,
        hint: hint
      });
    }
  }
};

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
export function onPreRollSavingThrow(config, dialog, message) {
  const onlyInCombat = !!game.settings.get(MODULE_ID, SETTING_KEYS.ONLY_IN_COMBAT);
  if (onlyInCombat && !game?.combats?.active) return;
  if (isLibraryMode()) return;

  const coverHintsMode = game.settings.get(MODULE_ID, SETTING_KEYS.COVER_HINTS);

  const actor = config.subject;
  const isDex = config.ability === "dex";
  if (!isDex) return;
  if (!actor) return;

  const targetToken = getSpeakerToken(message?.data?.speaker ?? ChatMessage.getSpeaker({ actor }));
  if (!targetToken) return;

  const srcMsg = resolveSourceMessage(config);
  const activity = srcMsg?.getAssociatedActivity?.() ?? null;
  const sourceActor = srcMsg?.getAssociatedActor?.() ?? null;
  clearCoverOverride(activity);

  const source = getSpeakerToken(srcMsg?.speaker ?? (sourceActor ? ChatMessage.getSpeaker({ actor: sourceActor }) : null));
  const sourceScene = source?.scene ?? source?.document?.parent ?? targetToken.scene ?? targetToken?.document?.parent ?? canvas?.scene;
  if (!source || !activity || !sourceScene) return;

  const losCheck = !!game.settings.get(MODULE_ID, SETTING_KEYS.LOS_CHECK);
  const result = getCover({ attacker: source, target: targetToken, scene: sourceScene, losCheck: losCheck, activity: activity });

  const calcCover = result?.cover ?? "none";
  const calcBonus = result?.bonus;

  const {
    cover: resolvedCover,
    bonus: resolvedBonus,
    statusCover,
    embeddedCover
  } = resolveCoverState(actor, activity, calcCover, calcBonus);
  applyCoverAutomation(actor, calcCover, statusCover, embeddedCover);
  setSaveCoverBonus(config.rolls?.[0], resolvedBonus, resolvedCover);

  const messageNotes = getCoverMessageNotes(message);
  messageNotes.length = 0;

  if (coverHintsMode === "always" || (coverHintsMode === "conditional" && resolvedCover !== "none")) {
    messageNotes.push({
      desiredCover: resolvedCover,
      desiredBonus: resolvedBonus,
      targetId: targetToken.id,
      targetName: targetToken.name,
      targetActorUuid: actor.uuid,
      activityUuid: activity.uuid
    });

    const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
    const hint = game.i18n.localize(COVER.I18N.HINT_KEYS.Save[resolvedCover]);

    setDialogNote(dialog, {
      cover: resolvedCover,
      target: targetToken.id,
      icon: COVER_ICON_PATHS[resolvedCover] ?? "",
      label: coverPrefix,
      hint: hint
    });
  }
}

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
export function onPostSavingThrowRollConfiguration(rolls, config, dialog, message) {
  const isTotalCoverSave =
    config?.ability === "dex"
    && rolls?.some?.(roll => roll?.options?.[MODULE_ID]?.totalCover === true);

  if (!isTotalCoverSave || isLibraryMode()) return;

  ui.notifications.info(game.i18n.localize(COVER.I18N.HINT_KEYS.Save.total));
  return false;
}

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
export async function clearCoverOnCombatTurnChange(combat, previous, current) {
  try {
    if (isLibraryMode()) return;
    if (!game.users.activeGM?.isSelf) return;
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.RMV_ON_COMBAT)) return;

    await clearSystemCoverEffects(combat);

    if (game.settings.get(MODULE_ID, SETTING_KEYS.DEBUG)) {
      clearCoverDebug();
    }
  } catch (err) {
    console.warn(`[${MODULE_ID}] clear on combat turn change`, err);
  }
}

/**
 * Clear cover after token movement has been recorded during active combat.
 *
 * @function recordToken
 * @memberof hookEvents
 * @param {TokenDocument} token The token document whose movement was recorded.
 * @returns {Promise<void>} Resolves after any cover cleanup has finished.
 */
export async function clearCoverOnMovement(token) {
  try {
    if (isLibraryMode()) return;
    if (!game.users.activeGM?.isSelf) return;
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.RMV_ON_MOVE)) return;

    const active = game.combats?.active;
    if (!active) return;

    await clearSystemCoverEffects(active);

    if (game.settings.get(MODULE_ID, SETTING_KEYS.DEBUG)) {
      clearCoverDebug();
    }
  } catch (err) {
    console.warn(`[${MODULE_ID}] clear on token movement`, err);
  }
}

/**
 * Clear cover when a combat encounter is deleted.
 *
 * @function deleteCombat
 * @memberof hookEvents
 * @param {Combat} combat The combat encounter being deleted.
 * @returns {Promise<void>} Resolves after any cover cleanup has finished.
 */
export async function clearCoverOnDeleteCombat(combat) {
  try {
    if (isLibraryMode()) return;
    if (!game.users.activeGM?.isSelf) return;
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.RMV_ON_COMBAT)) return;

    await clearSystemCoverEffects(combat);

    if (game.settings.get(MODULE_ID, SETTING_KEYS.DEBUG)) {
      clearCoverDebug();
    }
  } catch (err) {
    console.warn(`[${MODULE_ID}] clear on delete combat`, err);
  }
}

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
  if (!Array.isArray(targets)) return;

  for (const t of targets) {
    const uuid = t?.uuid ?? t?.tokenUuid ?? null;
    if (!uuid || uuid !== targetUuid) continue;
    t.ac = newAC;
    break;
  }
}

/**
 * Resolve the cover state used for the current roll.
 *
 * Pre-calculated cover from the API already includes ignore-cover rules. Those rules only need
 * to be applied here when stronger embedded cover on the target replaces that result.
 *
 * @param {Actor5e} actor The target actor.
 * @param {Activity5e|null} activity The activity being resolved.
 * @param {("none"|"half"|"threeQuarters"|"total")} cover The candidate cover level.
 * @param {0|2|5|null} bonus The candidate cover bonus.
 * @returns {{ cover: ("none"|"half"|"threeQuarters"|"total"), bonus: (0|2|5|null), statusCover: ("none"|"half"|"threeQuarters"|"total"), embeddedCover: ("none"|"half"|"threeQuarters"|"total") }} The resolved cover state for this roll.
 */
function resolveCoverState(actor, activity, cover, bonus) {
  const { statusCover, embeddedCover } = getActorCoverStates(actor);

  if (COVER.ORDER[embeddedCover] > COVER.ORDER[cover]) {
    ({ cover, bonus } = getIgnoreCover(activity, embeddedCover, actor));
  }

  return { cover, bonus, statusCover, embeddedCover };
}

/**
 * Synchronize the active dnd5e cover status with the resolved cover state.
 *
 * @param {Actor5e} actor The actor to update.
 * @param {("none"|"half"|"threeQuarters"|"total")} cover The cover level to apply.
 * @param {("none"|"half"|"threeQuarters"|"total")} statusCover The current dnd5e cover status.
 * @param {("none"|"half"|"threeQuarters"|"total")} embeddedCover The current embedded cover status.
 * @returns {void}
 */
function applyCoverAutomation(actor, cover, statusCover, embeddedCover) {
  if (COVER.ORDER[cover] > COVER.ORDER[embeddedCover]) {
    if (cover !== statusCover) {
      toggleCoverEffectViaGM(actor.uuid, COVER.IDS[cover], true);
    }
    return;
  }

  if (statusCover !== "none") {
    toggleCoverEffectViaGM(actor.uuid, COVER.IDS[statusCover], false);
  }
}

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
  if (desiredBonus !== null) {
    const baseAC = targetActor?.system?.attributes?.ac?.value;
    const oldCoverAC = targetActor?.system?.attributes?.ac?.cover || 0;
    const newAC = baseAC + desiredBonus - oldCoverAC;

    adjustMessageTargetAC(message, targetActor.uuid, newAC);
    if (singleTarget) config.target = Math.max(0, newAC);
  }
  else {
    adjustMessageTargetAC(message, targetActor.uuid, null);
    if (singleTarget) config.target = null;
  }
}

/**
 * Apply the resolved cover bonus to a dexterity saving throw roll configuration.
 *
 * @param {D20RollConfiguration} rollConfig The roll configuration to update.
 * @param {0|2|5|null} desiredBonus The resolved cover bonus.
 * @param {("none"|"half"|"threeQuarters"|"total")} desiredCover The resolved cover level.
 * @returns {void}
 */
function setSaveCoverBonus(rollConfig, desiredBonus, desiredCover) {
  if (!rollConfig) return;

  rollConfig.data ??= {};
  rollConfig.options ??= {};
  rollConfig.options[MODULE_ID] ??= {};
  rollConfig.options[MODULE_ID].totalCover = desiredCover === "total";

  if (desiredCover === "total") {
    delete rollConfig.data.cover;
    return;
  }

  rollConfig.data.cover = desiredBonus ?? 0;
}

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
export function onBuildAttackRollConfig(app, config, formData, index) {
  if (!formData?.object) return;
  if (isLibraryMode()) return;

  const changed = foundry.utils.flattenObject(formData.object);
  const messageFlags = app.message?.data?.flags?.[MODULE_ID]?.notes ?? [];
  const pathPrefix = `${MODULE_ID}.`;

  for (const [path, selectedCover] of Object.entries(changed)) {
    if (!path.startsWith(pathPrefix) || !path.endsWith(".cover")) continue;

    const targetId = path.slice(pathPrefix.length, -".cover".length);

    const original = messageFlags.find(entry => entry.targetId === targetId);
    if (!original) continue;

    const targetActor = fromUuidSync(original.targetActorUuid);
    const targets = app.message?.data?.flags?.dnd5e?.targets ?? [];
    const activity = fromUuidSync(original.activityUuid);

    const {
      cover: resolvedCover,
      bonus: resolvedBonus,
      statusCover,
      embeddedCover
    } = resolveCoverState(targetActor, activity, selectedCover, COVER.BONUS[selectedCover]);
    applyCoverAutomation(targetActor, selectedCover, statusCover, embeddedCover);
    setAttackCoverBonus({ desiredBonus: resolvedBonus, targetActor, singleTarget: targets.length === 1, config: config.options, message: app.message });
    if (resolvedBonus === null) app.config.target = null;

    setCoverOverride(activity, { id: targetId, actor: { uuid: original.targetActorUuid } }, {
      cover: resolvedCover,
      bonus: resolvedBonus
    });

    original.newMode = String(resolvedCover);

    const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
    const hint = game.i18n.format(
      COVER.I18N.HINT_KEYS.Attack[resolvedCover],
      { tokenName: original?.targetName || "???" }
    );

    setDialogNote(app, {
      cover: resolvedCover,
      target: targetId,
      icon: COVER_ICON_PATHS[resolvedCover] ?? "",
      label: coverPrefix,
      hint: hint
    });
  }
}

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
export function onBuildSavingThrowRollConfig(app, config, formData, index) {
  if (!formData?.object) return;
  if (isLibraryMode()) return;

  const changed = foundry.utils.flattenObject(formData.object);
  const messageFlags = app.message?.data?.flags?.[MODULE_ID]?.notes ?? [];
  const pathPrefix = `${MODULE_ID}.`;

  for (const [path, selectedCover] of Object.entries(changed)) {
    if (!path.startsWith(pathPrefix) || !path.endsWith(".cover")) continue;

    const targetId = path.slice(pathPrefix.length, -".cover".length);

    const original = messageFlags.find(entry => entry.targetId === targetId);
    if (!original) continue;

    const targetActor = fromUuidSync(original.targetActorUuid);
    const activity = fromUuidSync(original.activityUuid);
    const {
      cover: resolvedCover,
      bonus: resolvedBonus,
      statusCover,
      embeddedCover
    } = resolveCoverState(targetActor, activity, selectedCover, COVER.BONUS[selectedCover]);
    applyCoverAutomation(targetActor, selectedCover, statusCover, embeddedCover);
    setSaveCoverBonus(config, resolvedBonus, resolvedCover);

    setCoverOverride(activity, { id: targetId, actor: { uuid: original.targetActorUuid } }, {
      cover: resolvedCover,
      bonus: resolvedBonus
    });

    original.newMode = String(resolvedCover);

    const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
    const hint = game.i18n.localize(COVER.I18N.HINT_KEYS.Save[resolvedCover]);

    setDialogNote(app, {
      cover: resolvedCover,
      target: targetId,
      icon: COVER_ICON_PATHS[resolvedCover] ?? "",
      label: coverPrefix,
      hint: hint
    });
  }
}
