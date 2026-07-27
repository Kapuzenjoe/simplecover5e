import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.config.mjs";
import { clearCoverStatusEffect, isMidiQol } from "../services/cover.service.mjs";
import { getCover, getCoverForTargets, getIgnoreCover, setDialogNote } from "../utils/api.mjs";
import { clearCoverDebug } from "../services/cover.debug.mjs";
import { setCoverStatusViaGM } from "../services/queries.service.mjs";

/**
 * Register the `ignoreCover` item property on DnD5e items.
 *
 * @returns {void}
 */
export function ignoreCoverProperties() {
  CONFIG.DND5E.itemProperties.ignoreCover = {
    label: "Ignores Cover",
    abbreviation: "iC" // Workaround for https://github.com/foundryvtt/dnd5e/issues/6378
  };
  CONFIG.DND5E.validProperties.weapon.add("ignoreCover");
  CONFIG.DND5E.validProperties.spell.add("ignoreCover");
  CONFIG.DND5E.validProperties.feat.add("ignoreCover");
}

/**
 * Resolve a target's display name, respecting the Hide NPC Names module if active.
 *
 * @param {Actor5e} actor The target actor.
 * @param {string} fallbackName The name to use when Hide NPC Names is inactive or has no replacement.
 * @returns {string} The resolved display name.
 */
function getTargetDisplayName(actor, fallbackName) {
  const isHideNPCNamesActive = game.modules?.get?.("hide-npc-names")?.active === true;
  if (!isHideNPCNamesActive || !game?.hnn) return fallbackName;
  return game.hnn.getReplacementInfo(actor)?.displayName ?? fallbackName;
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
  if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE)) return;
  const onlyInCombat = !!game.settings.get(MODULE_ID, SETTING_KEYS.ONLY_IN_COMBAT);
  if (onlyInCombat && !game?.combats?.active) return;

  const actor = config.subject?.actor
  if (!actor) return;
  const attackerToken =
    actor?.token?.object ??
    actor?.getActiveTokens?.()[0] ??
    canvas.tokens?.controlled?.[0] ?? null;
  if (!attackerToken) return;
  const activity = config.subject ?? null;

  const targets = Array.from(game.user?.targets ?? [])
    .filter(t => t?.document && !t.document.actor?.defeated);
  if (!targets.length) return;

  const losCheck = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.LOS_CHECK);
  const resultArray = getCoverForTargets({ attacker: attackerToken, targets: targets, scene: attackerToken.scene, losCheck: losCheck, activity: activity });
  message.data.flags[MODULE_ID] = [];

  for (const out of resultArray) {
    const targetActor = out.target?.actor
    if (!targetActor) continue;
    if (targetActor.statuses?.has?.(COVER.IDS.total) && !losCheck) continue;

    const calcCover = out.result?.cover ?? "none";
    const calcBonus = out.result?.bonus;

    const { desiredCover, desiredBonus } = setCoverStatuses(targetActor, calcCover, calcBonus, activity);
    setAttackCoverBonus({ desiredBonus, targetActor, singleTarget: targets.length === 1, config, message });

    const coverHintsMode = game.settings?.get?.(MODULE_ID, SETTING_KEYS.COVER_HINTS) ?? "none";

    const targetName = getTargetDisplayName(targetActor, out.target?.name || "???");

    if (coverHintsMode === "always" || (coverHintsMode === "conditional" && desiredCover !== "none")) {
      message.data.flags[MODULE_ID].push({
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
        icon: COVER.FA_ICONS[desiredCover],
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
  if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE)) return;
  const onlyInCombat = !!game.settings.get(MODULE_ID, SETTING_KEYS.ONLY_IN_COMBAT);
  if (onlyInCombat && !game?.combats?.active) return;

  const actor = config.subject;
  const isDex = config.ability === "dex";
  if (!isDex) return;

  const targetToken = actor.getActiveTokens?.()[0];
  if (!targetToken) return;

  let activity;
  let sourceActor;

  if (isMidiQol() && config?.midiOptions?.workflowId != null) {
    activity = config?.midiOptions?.workflow?.activity ?? null;
    sourceActor = config?.midiOptions?.workflow?.actor ?? null;
  }
  else {
    const messageId = config.event?.target.closest("[data-message-id]")?.dataset.messageId;
    const srcMsg = messageId ? game.messages.get(messageId) : null;
    activity = srcMsg?.getAssociatedActivity?.() ?? null;
    sourceActor = srcMsg?.getAssociatedActor?.() ?? null;
  }

  const sourceToken = sourceActor?.getActiveTokens?.()[0];
  if (!sourceToken || !activity || !sourceActor) return;

  const losCheck = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.LOS_CHECK);
  if (actor.statuses?.has?.(COVER.IDS.total) && !losCheck) return;

  const result = getCover({ attacker: sourceToken, target: targetToken, scene: sourceToken.scene, losCheck: losCheck, activity: activity });

  const calcCover = result?.cover ?? "none";
  const calcBonus = result?.bonus;

  const { desiredCover, desiredBonus } = setCoverStatuses(actor, calcCover, calcBonus, activity);
  setSaveCoverBonus(config.rolls?.[0], desiredBonus, desiredCover);

  message.data.flags[MODULE_ID] = [];

  const coverHintsMode = game.settings?.get?.(MODULE_ID, SETTING_KEYS.COVER_HINTS) ?? "none";
  const targetName = getTargetDisplayName(actor, targetToken.name);

  if (coverHintsMode === "always" || (coverHintsMode === "conditional" && desiredCover !== "none")) {
    message.data.flags[MODULE_ID].push({
      desiredCover,
      desiredBonus: desiredBonus === null ? "9999" : String(desiredBonus),
      targetId: targetToken.id,
      targetName: targetName,
      targetActorUuid: actor.uuid,
      activityUuid: activity.uuid
    });

    const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
    const hint = game.i18n.localize(COVER.I18N.HINT_KEYS.Save[desiredCover]);

    setDialogNote(dialog, {
      cover: desiredCover,
      target: targetToken.id,
      icon: COVER.FA_ICONS[desiredCover],
      label: coverPrefix,
      hint: hint
    });
  }
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
    if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE)) return;
    if (!game.users.activeGM?.isSelf) return;
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.RMV_ON_COMBAT)) return;

    await clearCoverStatusEffect(combat);

    if (game.settings.get(MODULE_ID, SETTING_KEYS.DEBUG)) {
      clearCoverDebug();
    }
  } catch (err) {
    console.warn(`[${MODULE_ID}] clear on combat turn change`, err);
  }
}

/**
 * Clear cover after token movement during active combat.
 *
 * @function moveToken
 * @memberof hookEvents
 * @param {TokenDocument} token The token document being moved.
 * @param {TokenMovementOperation} movement The movement data for the token.
 * @param {DatabaseUpdateOperation} operation The update operation that contains the movement.
 * @param {User} user The user who requested the movement update.
 * @returns {Promise<void>} Resolves after any cover cleanup has finished.
 */
export async function clearCoverOnMovement(token, movement, operation, user) {
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

  let systemStatus = "none";
  for (const [level, id] of COVER.EFFECT_IDS) {
    if (effects.some(e => e?.id === id)) { systemStatus = level; break; }
  }

  const systemEffectSet = new Set(COVER.EFFECT_IDS.map(([, id]) => id));

  let customStatus = "none";
  for (const e of effects) {
    if (systemEffectSet.has(e?.id)) continue;

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
function setCoverStatuses(actor, calcCover, calcBonus, activity) {
  let desiredCover = calcCover;
  let desiredBonus = calcBonus;

  const { systemStatus, customStatus } = getCoverStatuses(actor);

  if (COVER.ORDER[customStatus] > COVER.ORDER[desiredCover]) {
    ; ({ cover: desiredCover, bonus: desiredBonus } = getIgnoreCover(activity, customStatus));
  }

  const desiredSystemStatus = (COVER.ORDER[calcCover] > COVER.ORDER[customStatus]) ? calcCover : "none";
  if (desiredSystemStatus !== systemStatus) {
    setCoverStatusViaGM(actor.uuid, desiredSystemStatus);
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
  rollConfig.data.cover = desiredCover === "total" ? 9999 : desiredBonus ?? 0;
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

  const changed = foundry.utils.flattenObject(formData.object);
  const messageFlags = app.message?.data?.flags?.simplecover5e ?? [];
  const pathPrefix = `${MODULE_ID}.`;

  for (const [path, mode] of Object.entries(changed)) {
    if (!path.startsWith(pathPrefix) || !path.endsWith(".cover")) continue;

    const targetId = path.slice(pathPrefix.length, -".cover".length);

    const original = messageFlags.find(entry => entry.targetId === targetId);
    if (!original) continue;

    const targetActor = fromUuidSync(original.targetActorUuid);
    const targets = app.message?.data?.flags?.dnd5e?.targets ?? [];
    const activity = fromUuidSync(original.activityUuid)

    const { desiredCover, desiredBonus } = setCoverStatuses(targetActor, mode, COVER.BONUS[mode], activity);

    setAttackCoverBonus({ desiredBonus, targetActor, singleTarget: targets.length === 1, config: config.options, message: app.message });
    if (desiredBonus === null) app.config.target = null;

    original.newMode = String(desiredCover);

    const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
    const hint = game.i18n.format(
      COVER.I18N.HINT_KEYS.Attack[desiredCover],
      { tokenName: original?.targetName || "???" }
    );

    setDialogNote(app, {
      cover: desiredCover,
      target: targetId,
      icon: COVER.FA_ICONS[desiredCover],
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

  const changed = foundry.utils.flattenObject(formData.object);
  const messageFlags = app.message?.data?.flags?.simplecover5e ?? [];
  const pathPrefix = `${MODULE_ID}.`;

  for (const [path, mode] of Object.entries(changed)) {
    if (!path.startsWith(pathPrefix) || !path.endsWith(".cover")) continue;

    const targetId = path.slice(pathPrefix.length, -".cover".length);

    const original = messageFlags.find(entry => entry.targetId === targetId);
    if (!original) continue;

    const targetActor = fromUuidSync(original.targetActorUuid)
    const activity = fromUuidSync(original.activityUuid)
    const { desiredCover, desiredBonus } = setCoverStatuses(targetActor, mode, COVER.BONUS[mode], activity);

    setSaveCoverBonus(config, desiredBonus, desiredCover);

    original.newMode = String(desiredCover);

    const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
    const hint = game.i18n.localize(COVER.I18N.HINT_KEYS.Save[desiredCover]);

    setDialogNote(app, {
      cover: desiredCover,
      target: targetId,
      icon: COVER.FA_ICONS[desiredCover],
      label: coverPrefix,
      hint: hint
    });
  }
}