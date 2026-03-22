import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.config.mjs";
import { clearCoverStatusEffect } from "../services/cover.service.mjs";
import { getCover, getCoverForTargets, getIgnoreCover, setDialogNote } from "../utils/api.mjs";
import { clearCoverDebug } from "../services/cover.debug.mjs";
import { toggleCoverEffectViaGM } from "../services/queries.service.mjs";

/**
 * Register the "ignoreCover" item property on dnd5e.
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
 * A hook event that fires before an attack roll is performed.
 * @function dnd5e.preRollAttack
 * @memberof hookEvents
 * @param {BasicRollProcessConfiguration} config Configuration information for the roll.
 * @param {BasicRollDialogConfiguration} dialog Configuration for the roll dialog.
 * @param {BasicRollMessageConfiguration} message Configuration for the roll message.
 * @returns
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

    const { desiredCover, desiredBonus } = setCoverStatuses(targetActor, calcCover, calcBonus);
    setAttackCoverBonus({ desiredBonus, targetActor, singleTarget: targets.length === 1, config, message });

    const coverHintsMode = game.settings?.get?.(MODULE_ID, SETTING_KEYS.COVER_HINTS) ?? "none";

    if (coverHintsMode === "always" || (coverHintsMode === "conditional" && desiredCover !== "none")) {
      message.data.flags[MODULE_ID].push({
        desiredCover,
        desiredBonus,
        targetId: out.target.id,
        targetName: out.target?.name || "???",
        targetActorUuid: targetActor.uuid
      });

      const coverPrefix = `${game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY)}`;
      const hint = game.i18n.format(
        COVER.I18N.HINT_KEYS.Attack[desiredCover],
        { tokenName: out.target?.name || "???" }
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
 * A hook event that fires before a saving throw is performed.
 * @function dnd5e.preRollSavingThrow
 * @memberof hookEvents
 * @param {BasicRollProcessConfiguration} config Configuration information for the roll.
 * @param {BasicRollDialogConfiguration} dialog Configuration for the roll dialog.
 * @param {BasicRollMessageConfiguration} message Configuration for the roll message.
 * @returns
 */
export function onPreRollSavingThrow(config, dialog, message) {
  if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE)) return;
  const onlyInCombat = !!game.settings.get(MODULE_ID, SETTING_KEYS.ONLY_IN_COMBAT);
  if (onlyInCombat && !game?.combats?.active) return;

  const actor = config.subject
  const isDex = config.ability === "dex";
  if (!isDex) return;

  const targetToken = actor.getActiveTokens?.()[0]
  if (!targetToken) return;

  const srcMsg = getSourceChatMessageFromEvent(config?.event);
  const activity = srcMsg?.getAssociatedActivity?.();
  const sourceActor = srcMsg?.speakerActor
  const sourceToken = sourceActor?.getActiveTokens?.()[0]
  if (!sourceToken) return;

  const losCheck = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.LOS_CHECK);
  if (actor.statuses?.has?.(COVER.IDS.total) && !losCheck) return;

  const result = getCover({ attacker: sourceToken, target: targetToken, scene: sourceToken.scene, losCheck: losCheck, activity: activity });

  const calcCover = result?.cover ?? "none";
  const calcBonus = result?.bonus;

  const { desiredCover, desiredBonus } = setCoverStatuses(actor, calcCover, calcBonus);
  setSaveCoverBonus(config, desiredBonus, desiredCover)

  message.data.flags[MODULE_ID] = [];

  const coverHintsMode = game.settings?.get?.(MODULE_ID, SETTING_KEYS.COVER_HINTS) ?? "none";

  if (coverHintsMode === "always" || (coverHintsMode === "conditional" && desiredCover !== "none")) {
    message.data.flags[MODULE_ID].push({
      desiredCover,
      desiredBonus: desiredBonus === null ? "9999" : String(desiredBonus),
      targetId: targetToken.id,
      targetName: targetToken.name,
      targetActorUuid: actor.uuid
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
 * Cleanup cover when the combat turn or round changes.
 * @function updateCombat
 * @memberof hookEvents
 * @param {Combat} combat
 * @param {object} update
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
 * Cleanup on Token Movement (during active combat).
 * @function moveToken
 * @memberof hookEvents
 * @param {TokenDocument} token                 The existing TokenDocument which was updated
 * @param {TokenMovementOperation} movement     The movement of the Token
 * @param {DatabaseUpdateOperation} operation   The update operation that contains the movement
 * @param {User} user                           The User that requested the update operation
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
 * Cleanup when a combat is deleted.
 * @function deleteCombat
 * @memberof hookEvents
 * @param {Combat} combat
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
 * Walk up from the event target to the source chat message element and return the ChatMessage.
 * @param {Event} ev
 * @returns {ChatMessage|null}
 */
function getSourceChatMessageFromEvent(ev) {
  if (!ev) return null;
  const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];
  const candidates = Array.isArray(path) ? [...path] : [];
  if (ev.target) candidates.push(ev.target);

  let el = null;
  for (const n of candidates) {
    if (!(n instanceof Element)) continue;
    el = n.closest?.("[data-message-id]") ?? n.closest?.(".chat-message");
    if (el) break;
  }
  if (!el) return null;

  const mid = el.dataset?.messageId ?? el.getAttribute?.("data-message-id");
  if (!mid) return null;
  return game.messages?.get?.(mid) ?? null;
}

/**
 * Adjust the shown AC of a specific target in the pending dnd5e chat message.
 *
 * @param {object} message     The hook's 'message' arg.
 * @param {string} targetUuid  TokenDocument UUID to match.
 * @param {number|null} newAC      The new AC value.
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
 * 
 * @param {Actor5e} actor 
 * @param {String} calcCover 
 * @param {Number|null} calcBonus 
 * @returns 
 */
function setCoverStatuses(actor, calcCover, calcBonus) {
  let desiredCover = calcCover;
  let desiredBonus = calcBonus;

  const { systemStatus, customStatus } = getCoverStatuses(actor);

  if (COVER.ORDER[customStatus] > COVER.ORDER[desiredCover]) {
    ; ({ cover: desiredCover, bonus: desiredBonus } = getIgnoreCover(activity, customStatus));
  }

  if (COVER.ORDER[calcCover] > COVER.ORDER[customStatus]) {
    if (calcCover !== systemStatus) {
      toggleCoverEffectViaGM(actor.uuid, COVER.IDS[calcCover], true);
    }
  } else {
    if (systemStatus !== "none") {
      toggleCoverEffectViaGM(actor.uuid, COVER.IDS[systemStatus], false);
    }
  }

  return { desiredCover, desiredBonus }
}

/**
 * 
 * @param {*} param0 
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
 * 
 * @param {*} config 
 * @param {String} desiredBonus 
 * @param {Number} desiredCover 
 */
function setSaveCoverBonus(config, desiredBonus, desiredCover) {
  const roll0 = config.rolls?.[0];

  const addSaveBonus = (n) => {
    if (!roll0?.parts) return;
    roll0.parts.push(String(n));
  };
  const removeSaveBonus = () => {
    if (!roll0?.parts) return;
    const parts = roll0.parts;
    const idx = parts.lastIndexOf("@cover");
    if (idx !== -1) parts.splice(idx, 1);
  };

  removeSaveBonus();
  if (desiredCover === "total") {
    addSaveBonus(9999);
  }
  else if (typeof desiredBonus === "number" && Number.isFinite(desiredBonus)) {
    addSaveBonus(desiredBonus);
  }

}

/**
 * 
 * @param {RollConfigurationDialog} app		  Roll configuration dialog.
 * @param {BasicRollConfiguration} config		Roll configuration data.
 * @param {[FormDataExtended]} formData	  	Any data entered into the rolling prompt.
 * @param {number} index		                Index of the roll within all rolls being prepared.
 */
export function onBuildAttackRollConfig(app, config, formData, index) {
  if (!formData?.object) return;

  const changed = foundry.utils.flattenObject(formData.object);
  const messageFlags = app.message?.data?.flags?.simplecover5e ?? [];

  for (const [path, mode] of Object.entries(changed)) {
    if (!path.startsWith("simplecover5e.") || !path.endsWith(".cover")) continue;

    const targetId = path.slice("simplecover5e.".length, -".cover".length);

    const original = messageFlags.find(entry => entry.targetId === targetId);
    if (!original) continue;

    const targetActor = fromUuidSync(original.targetActorUuid);
    const targets = app.message?.data?.flags?.dnd5e?.targets ?? [];

    const { desiredCover, desiredBonus } = setCoverStatuses(targetActor, mode, COVER.BONUS[mode]);

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
 * 
 * @param {RollConfigurationDialog} app		  Roll configuration dialog.
 * @param {BasicRollConfiguration} config		Roll configuration data.
 * @param {[FormDataExtended]} formData	  	Any data entered into the rolling prompt.
 * @param {number} index		                Index of the roll within all rolls being prepared.
 */
export function onBuildSavingThrowRollConfig(app, config, formData, index) {
  if (!formData?.object) return;

  const changed = foundry.utils.flattenObject(formData.object);
  const messageFlags = app.message?.data?.flags?.simplecover5e ?? [];

  for (const [path, mode] of Object.entries(changed)) {
    if (!path.startsWith("simplecover5e.") || !path.endsWith(".cover")) continue;

    const targetId = path.slice("simplecover5e.".length, -".cover".length);

    const original = messageFlags.find(entry => entry.targetId === targetId);
    if (!original) continue;

    const targetActor = fromUuidSync(original.targetActorUuid)
    const { desiredCover, desiredBonus, currentStatus } = setCoverStatuses(targetActor, mode, COVER.BONUS[mode]);

    config.parts = config.parts.filter(part => part !== String(original.desiredBonus));
    if (desiredBonus !== "0") {
      config.parts.push(desiredBonus === null ? "9999" : String(desiredBonus));
    }

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