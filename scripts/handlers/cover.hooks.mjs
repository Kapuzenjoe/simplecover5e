import { MODULE_ID, COVER, COVER_ICON_PATHS, SETTING_KEYS } from "../config/constants.config.mjs";
import { clearCoverStatusEffect, isMidiQol } from "../services/cover.service.mjs";
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

function isDelegatedCover(config) {
  if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE)) return true;
  if (!isMidiQol() || config?.midiOptions?.workflowId == null) return false;

  const midi = game.modules?.get?.("midi-qol")?.api ?? globalThis.MidiQOL;
  const coverCalculation =
    midi?.currentConfigSettings?.optionalRules?.coverCalculation ??
    midi?.configSettings?.()?.optionalRules?.coverCalculation;

  return coverCalculation === "simplecover5e";
}

function getSaveCoverHint(desiredCover) {
  return game.i18n.localize(COVER.I18N.HINT_KEYS.Save[desiredCover]);
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
  const coverHintsMode = game.settings?.get?.(MODULE_ID, SETTING_KEYS.COVER_HINTS) ?? "none";
  if (onlyInCombat && !game?.combats?.active) return;
  const delegated = isDelegatedCover(config);
  if (delegated && coverHintsMode === "none") return;

  const actor = config.subject?.actor
  if (!actor) return;
  const attackerToken =
    getSpeakerToken(message?.data?.speaker) ??
    actor?.token?.object ??
    actor?.getActiveTokens?.()[0] ??
    canvas.tokens?.controlled?.[0] ?? null;
  if (!attackerToken) return;
  const activity = config.subject ?? null;
  clearCoverOverride(activity);

  const targets = Array.from(game.user?.targets ?? [])
    .filter(t => t?.document && !t.document.actor?.defeated);
  if (!targets.length) return;

  const losCheck = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.LOS_CHECK);
  const resultArray = getCoverForTargets({ attacker: attackerToken, targets: targets, scene: attackerToken.scene, losCheck: losCheck, activity: activity });
  const messageNotes = getCoverMessageNotes(message);
  messageNotes.length = 0;

  for (const out of resultArray) {
    const targetActor = out.target?.actor
    if (!targetActor) continue;
    const calcCover = out.result?.cover ?? "none";
    const calcBonus = out.result?.bonus;

    const { desiredCover, desiredBonus } = setCoverStatuses(targetActor, calcCover, calcBonus, activity, !delegated);
    if (!delegated) {
      setAttackCoverBonus({ desiredBonus, targetActor, singleTarget: targets.length === 1, config, message });
    }

    const isHideNPCNamesActive = game.modules?.get?.("hide-npc-names")?.active === true;
    const targetName = isHideNPCNamesActive && game?.hnn ? game.hnn.getReplacementInfo(targetActor).displayName : out.target?.name || "???";

    if (coverHintsMode === "always" || (coverHintsMode === "conditional" && desiredCover !== "none")) {
      messageNotes.push({
        desiredCover,
        desiredBonus,
        targetId: out.target.id,
        targetName: targetName,
        targetActorUuid: targetActor.uuid,
        activityUuid: activity.uuid
      });

      const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
      const hint = game.i18n.format(
        COVER.I18N.HINT_KEYS.Attack[desiredCover],
        { tokenName: targetName }
      );

      setDialogNote(dialog, {
        cover: desiredCover,
        target: out.target.id,
        icon: COVER_ICON_PATHS[desiredCover] ?? "",
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
  const coverHintsMode = game.settings?.get?.(MODULE_ID, SETTING_KEYS.COVER_HINTS) ?? "none";
  if (onlyInCombat && !game?.combats?.active) return;
  const delegated = isDelegatedCover(config);
  if (delegated && coverHintsMode === "none") return;

  const actor = config.subject;
  const isDex = config.ability === "dex";
  if (!isDex) return;

  const targetToken =
    getSpeakerToken(message?.data?.speaker) ??
    actor?.token?.object ??
    actor.getActiveTokens?.()[0] ??
    null;
  if (!targetToken) return;

  let activity;
  let sourceActor;
  let srcMsg = null;
  let source = null;
  let sourceScene = targetToken.scene ?? targetToken?.document?.parent ?? canvas?.scene;

  if (isMidiQol() && config?.midiOptions?.workflowId != null) {
    const workflow = config?.midiOptions?.workflow;
    activity = workflow?.activity ?? null;
    sourceActor = workflow?.actor ?? null;

    const origin = workflow?.workflowOptions?.coverOrigin;
    if (origin) {
      source = {
        x: origin.x,
        y: origin.y,
        elevation: origin.elevation ?? workflow?.token?.document?.elevation ?? 0,
        disposition: workflow?.token?.document?.disposition ?? sourceActor?.token?.disposition ?? null,
        getCenterPoint() {
          return { x: origin.x, y: origin.y };
        }
      };
    }
    else if (workflow?.template) {
      const center = foundry.utils.duplicate(workflow.template.center);
      const dimensions = canvas.dimensions;
      if (workflow.template.document.t === "rect") {
        center.x += (workflow.template.document.width ?? 1) / (dimensions?.distance ?? 5) / 2 * (dimensions?.size ?? 100);
        center.y += (workflow.template.document.width ?? 1) / (dimensions?.distance ?? 5) / 2 * (dimensions?.size ?? 100);
      }

      source = {
        x: center.x,
        y: center.y,
        elevation: workflow.template.document.elevation ?? workflow?.token?.document?.elevation ?? 0,
        disposition: workflow?.token?.document?.disposition ?? sourceActor?.token?.disposition ?? null,
        getCenterPoint() {
          return { x: center.x, y: center.y };
        }
      };
    }
    else {
      source = workflow?.token ?? null;
      sourceScene = source?.scene ?? source?.document?.parent ?? sourceScene;
    }
  }
  else {
    srcMsg = resolveSourceMessage(config);
    activity = srcMsg?.getAssociatedActivity?.() ?? null;
    sourceActor = srcMsg?.getAssociatedActor?.() ?? null;
  }
  clearCoverOverride(activity);

  source ??=
    getSpeakerToken(srcMsg?.speaker) ??
    sourceActor?.token?.object ??
    sourceActor?.getActiveTokens?.()[0] ??
    null;
  sourceScene = source?.scene ?? source?.document?.parent ?? sourceScene;
  if (!source || !activity || !sourceScene) return;

  const losCheck = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.LOS_CHECK);
  const result = getCover({ attacker: source, target: targetToken, scene: sourceScene, losCheck: losCheck, activity: activity });

  const calcCover = result?.cover ?? "none";
  const calcBonus = result?.bonus;

  const { desiredCover, desiredBonus } = setCoverStatuses(actor, calcCover, calcBonus, activity, !delegated);
  if (!delegated) {
    setSaveCoverBonus(config.rolls?.[0], desiredBonus, desiredCover);
  }

  const messageNotes = getCoverMessageNotes(message);
  messageNotes.length = 0;

  if (coverHintsMode === "always" || (coverHintsMode === "conditional" && desiredCover !== "none")) {
    messageNotes.push({
      desiredCover,
      desiredBonus,
      targetId: targetToken.id,
      targetName: targetToken.name,
      targetActorUuid: actor.uuid,
      activityUuid: activity.uuid
    });

    const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
    const hint = getSaveCoverHint(desiredCover);

    setDialogNote(dialog, {
      cover: desiredCover,
      target: targetToken.id,
      icon: COVER_ICON_PATHS[desiredCover] ?? "",
      label: coverPrefix,
      hint: hint
    });
  }
}

/**
 * Clear cover when combat turn or round data changes.
 *
 * @function updateCombat
 * @memberof hookEvents
 * @param {Combat} combat The combat encounter being updated.
 * @param {object} update The changed combat data.
 * @returns {Promise<void>} Resolves after any cover cleanup has finished.
 */
export async function clearCoverOnUpdateCombat(combat, update) {
  try {
    if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE)) return;
    if (!game.users.activeGM?.isSelf) return;
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.RMV_ON_COMBAT)) return;

    await clearCoverStatusEffect(combat);

    if (game.settings.get(MODULE_ID, SETTING_KEYS.DEBUG)) {
      clearCoverDebug();
    }
  } catch (err) {
    console.warn(`[${MODULE_ID}] clear on update combat`, err);
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
    if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE)) return;
    if (!game.users.activeGM?.isSelf) return;
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.RMV_ON_MOVE)) return;

    const active = game.combats?.active;
    if (!active) return;

    await clearCoverStatusEffect(active);

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
    if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE)) return;
    if (!game.users.activeGM?.isSelf) return;
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.RMV_ON_COMBAT)) return;

    await clearCoverStatusEffect(combat);

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
    t.ac = newAC
    break;
  }
}

/**
 * Resolve the current system cover status effects from CONFIG.statusEffects.
 *
 * @returns {{level: ("half"|"threeQuarters"|"total"), statusId: string, effectId: string|null}[]} The known cover statuses.
 */
function getSystemCoverEffects() {
  return [
    ["total", COVER.IDS.total],
    ["threeQuarters", COVER.IDS.threeQuarters],
    ["half", COVER.IDS.half]
  ].map(([level, statusId]) => ({
    level,
    statusId,
    effectId: CONFIG.statusEffects?.[statusId]?._id ?? null
  }));
}

/**
 * Determine cover-related statuses for an actor.
 *
 * - overallStatus: The highest cover status currently present on the actor.
 * - systemStatus: The highest cover status implied by active *system* cover effects.
 * - customStatus: The highest cover status applied by active effects which set a cover status.
 *
 * @param {Actor5e} actor The actor to evaluate.
 * @returns {{overallStatus: ("none"|"half"|"threeQuarters"|"total"), systemStatus: ("none"|"half"|"threeQuarters"|"total"), customStatus: ("none"|"half"|"threeQuarters"|"total")}} The resolved cover statuses.
 */
function getCoverStatuses(actor) {
  const statuses = actor?.statuses;

  const overallStatus =
    statuses?.has?.(COVER.IDS.total) ? "total"
      : statuses?.has?.(COVER.IDS.threeQuarters) ? "threeQuarters"
        : statuses?.has?.(COVER.IDS.half) ? "half"
          : "none";

  const effects = actor?.appliedEffects ?? [];
  const systemCoverEffects = getSystemCoverEffects();

  let systemStatus = "none";
  for (const { level, statusId, effectId } of systemCoverEffects) {
    const isMatch = effectId
      ? effects.some(e => e?.id === effectId)
      : effects.some(e => (e?.statuses?.size === 1) && e?.statuses?.has?.(statusId));
    if (isMatch) {
      systemStatus = level;
      break;
    }
  }

  let customStatus = "none";
  for (const e of effects) {
    const isSystemEffect = systemCoverEffects.some(({ statusId, effectId }) =>
      (effectId && e?.id === effectId)
      || (!effectId && (e?.statuses?.size === 1) && e?.statuses?.has?.(statusId))
    );
    if (isSystemEffect) continue;

    const s = e?.statuses;
    if (!s?.has) continue;

    if (s.has(COVER.IDS.total)) { customStatus = "total"; break; } // highest possible
    if (s.has(COVER.IDS.threeQuarters) && COVER.ORDER[customStatus] < COVER.ORDER.threeQuarters) customStatus = "threeQuarters";
    if (s.has(COVER.IDS.half) && COVER.ORDER[customStatus] < COVER.ORDER.half) customStatus = "half";
  }

  return { overallStatus, systemStatus, customStatus };
}

/**
 * Resolve the desired cover state and synchronize module-managed cover effects.
 *
 * @param {Actor5e} actor The actor to update.
 * @param {("none"|"half"|"threeQuarters"|"total")} calcCover The calculated cover level.
 * @param {0|2|5|null} calcBonus The calculated cover bonus.
 * @param {Activity5e|null} activity The activity being resolved.
 * @returns {{ desiredCover: ("none"|"half"|"threeQuarters"|"total"), desiredBonus: (0|2|5|null) }} The desired cover state and bonus after existing cover effects have been considered.
 */
function setCoverStatuses(actor, calcCover, calcBonus, activity, applyAutomation = true) {
  let desiredCover = calcCover;
  let desiredBonus = calcBonus;

  const { systemStatus, customStatus } = getCoverStatuses(actor);

  if (COVER.ORDER[customStatus] > COVER.ORDER[desiredCover]) {
    ; ({ cover: desiredCover, bonus: desiredBonus } = getIgnoreCover(activity, customStatus));
  }

  if (applyAutomation) {
    if (COVER.ORDER[calcCover] > COVER.ORDER[customStatus]) {
      if (calcCover !== systemStatus) {
        if (systemStatus !== "none") {
          toggleCoverEffectViaGM(actor.uuid, COVER.IDS[systemStatus], false);
        }
        toggleCoverEffectViaGM(actor.uuid, COVER.IDS[calcCover], true);
      }
    } else {
      if (systemStatus !== "none") {
        toggleCoverEffectViaGM(actor.uuid, COVER.IDS[systemStatus], false);
      }
    }
  }

  return { desiredCover, desiredBonus }
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
  const delegated = isDelegatedCover(app.config);
  const coverHintsMode = game.settings?.get?.(MODULE_ID, SETTING_KEYS.COVER_HINTS) ?? "none";
  if (delegated && coverHintsMode === "none") return;

  const changed = foundry.utils.flattenObject(formData.object);
  const messageFlags = app.message?.data?.flags?.simplecover5e?.notes ?? [];
  const pathPrefix = `${MODULE_ID}.`;

  for (const [path, mode] of Object.entries(changed)) {
    if (!path.startsWith(pathPrefix) || !path.endsWith(".cover")) continue;

    const targetId = path.slice(pathPrefix.length, -".cover".length);

    const original = messageFlags.find(entry => entry.targetId === targetId);
    if (!original) continue;

    const targetActor = fromUuidSync(original.targetActorUuid);
    const targets = app.message?.data?.flags?.dnd5e?.targets ?? [];
    const activity = fromUuidSync(original.activityUuid)

    const { desiredCover, desiredBonus } = setCoverStatuses(targetActor, mode, COVER.BONUS[mode], activity, !delegated);
    if (!delegated) {
      setAttackCoverBonus({ desiredBonus, targetActor, singleTarget: targets.length === 1, config: config.options, message: app.message });
      if (desiredBonus === null) app.config.target = null;
    }
    setCoverOverride(activity, { id: targetId, actor: { uuid: original.targetActorUuid } }, {
      cover: desiredCover,
      bonus: desiredBonus
    });

    original.newMode = String(desiredCover);

    const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
    const hint = game.i18n.format(
      COVER.I18N.HINT_KEYS.Attack[desiredCover],
      { tokenName: original?.targetName || "???" }
    );

    setDialogNote(app, {
      cover: desiredCover,
      target: targetId,
      icon: COVER_ICON_PATHS[desiredCover] ?? "",
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
  const delegated = isDelegatedCover(app.config);
  const coverHintsMode = game.settings?.get?.(MODULE_ID, SETTING_KEYS.COVER_HINTS) ?? "none";
  if (delegated && coverHintsMode === "none") return;

  const changed = foundry.utils.flattenObject(formData.object);
  const messageFlags = app.message?.data?.flags?.simplecover5e?.notes ?? [];
  const pathPrefix = `${MODULE_ID}.`;

  for (const [path, mode] of Object.entries(changed)) {
    if (!path.startsWith(pathPrefix) || !path.endsWith(".cover")) continue;

    const targetId = path.slice(pathPrefix.length, -".cover".length);

    const original = messageFlags.find(entry => entry.targetId === targetId);
    if (!original) continue;

    const targetActor = fromUuidSync(original.targetActorUuid)
    const activity = fromUuidSync(original.activityUuid)
    const { desiredCover, desiredBonus } = setCoverStatuses(targetActor, mode, COVER.BONUS[mode], activity, !delegated);
    if (!delegated) {
      setSaveCoverBonus(config, desiredBonus, desiredCover);
    }
    setCoverOverride(activity, { id: targetId, actor: { uuid: original.targetActorUuid } }, {
      cover: desiredCover,
      bonus: desiredBonus
    });

    original.newMode = String(desiredCover);

    const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
    const hint = getSaveCoverHint(desiredCover);

    setDialogNote(app, {
      cover: desiredCover,
      target: targetId,
      icon: COVER_ICON_PATHS[desiredCover] ?? "",
      label: coverPrefix,
      hint: hint
    });
  }
}
