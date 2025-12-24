import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.config.mjs";
import { clearCoverStatusEffect } from "../services/cover.service.mjs";
import { getCover, getCoverForTargets, getIgnoreCover } from "../utils/api.mjs";
import { clearCoverDebug } from "../services/cover.debug.mjs";
import { toggleCoverEffectViaGM } from "../utils/rpc.mjs";

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

  const targets = Array.from(game.user?.targets ?? [])
    .filter(t => t?.document && !t.document.actor?.defeated);
  if (!targets.length) return;

  const losCheck = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.LOS_CHECK);
  const resultArray = getCoverForTargets({ attacker: attackerToken, targets: targets, scene: attackerToken.scene, losCheck: losCheck });

  const activity = config.subject ?? null;

  for (const out of resultArray) {
    const targetActor = out.target?.actor
    if (!targetActor) continue;
    if (targetActor.statuses?.has?.(COVER.IDS.total) && !losCheck) continue;

    const { coverId, bonus: desiredBonus } = getIgnoreCover(activity, out?.result?.cover ?? "none");

    const currentStatus =
      targetActor.statuses?.has?.(COVER.IDS.total) ? "total"
        : targetActor.statuses?.has?.(COVER.IDS.threeQuarters) ? "threeQuarters"
          : targetActor.statuses?.has?.(COVER.IDS.half) ? "half"
            : "none";

    const currentBonus = getCurrentACCoverBonus(targetActor);

    if (desiredBonus !== null) {
      const delta = desiredBonus - currentBonus;
      if (delta) {
        adjustMessageTargetAC(message, targetActor.uuid, delta);
        if (targets.length === 1 && typeof config.target === "number") {
          config.target = Math.max(0, (config.target || 0) + delta);
        }
      }
      else if (currentStatus === "total") {
        const baseAC = targetActor?.system?.attributes?.ac?.value;
        adjustMessageTargetAC(message, targetActor.uuid, 0, baseAC);
        if (targets.length === 1) config.target = baseAC;
      }
    }
    else { //total cover
      adjustMessageTargetAC(message, targetActor.uuid, null);
      if (targets.length === 1) config.target = null;
    }

    if (coverId === "none") {
      if (currentStatus !== "none") {
        toggleCoverEffectViaGM(targetActor.uuid, COVER.IDS[currentStatus], false);
      }
    } else if (coverId !== currentStatus) {
      toggleCoverEffectViaGM(targetActor.uuid, COVER.IDS[coverId], true);
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

  const targetToken = actor.getActiveTokens?.()[0]
  if (!targetToken) return;

  const srcMsg = getSourceChatMessageFromEvent(config?.event);
  const activity = srcMsg?.getAssociatedActivity?.();
  const sourceActor = srcMsg?.speakerActor
  const sourceToken = sourceActor?.getActiveTokens?.()[0]
  if (!sourceToken) return;

  const losCheck = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.LOS_CHECK);
  if (actor.statuses?.has?.(COVER.IDS.total) && !losCheck) return;

  const result = getCover({ attacker: sourceToken, target: targetToken, scene: sourceToken.scene, losCheck: losCheck });
  const { coverId, bonus: desiredBonus } = getIgnoreCover(activity, result?.cover ?? "none");

  const currentStatus =
    actor.statuses?.has?.(COVER.IDS.total) ? "total"
      : actor.statuses?.has?.(COVER.IDS.threeQuarters) ? "threeQuarters"
        : actor.statuses?.has?.(COVER.IDS.half) ? "half"
          : "none";

  const isDex = config.ability === "dex";
  const roll0 = config.rolls?.[0];

  const addSaveBonus = (n) => {
    if (!isDex || !roll0?.parts) return;
    roll0.parts.push(String(n));
  };
  const removeSaveBonus = () => {
    if (!isDex || !roll0?.parts) return;
    const parts = roll0.parts;
    const idx = parts.lastIndexOf("@cover");
    if (idx !== -1) parts.splice(idx, 1);
  };

  removeSaveBonus();
  if (coverId === "total") {
    addSaveBonus(9999);
  }
  else if (typeof desiredBonus === "number" && Number.isFinite(desiredBonus)) {
    addSaveBonus(desiredBonus);
  }

  if (coverId === "none") {
    if (currentStatus !== "none") {
      toggleCoverEffectViaGM(actor.uuid, COVER.IDS[currentStatus], false);
    }
  } else if (coverId !== currentStatus) {
    toggleCoverEffectViaGM(actor.uuid, COVER.IDS[coverId], true);
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
    if (!game.users.activeGM?.isSelf) return;
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.RMV_ON_COMBAT)) return;

    await clearCoverStatusEffect(combat);

    if (game.settings.get(MODULE_ID, SETTING_KEYS.DEBUG)) {
      await clearCoverDebug();
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
 * @param {number} delta       AC delta (+/-).
 */
function adjustMessageTargetAC(message, targetUuid, delta, base) {  
  const targets = message?.data?.flags?.dnd5e?.targets;
  if (!Array.isArray(targets)) return;

  for (const t of targets) {
    const uuid = t?.uuid ?? t?.tokenUuid ?? null;
    if (!uuid || uuid !== targetUuid) continue;
    const base = t.ac
    if (delta === null) {
      t.ac = null;
      break;
    }
    t.ac = (Number.isFinite(base) ? base : null) + delta;
    break;
  }
}

/**
 * Get the current cover bonus applied to the actor's AC.
 * @param {Actor5e} actor 
 * @returns {number}  The current cover bonus (0/2/5).
 */
function getCurrentACCoverBonus(actor) {
  const v = actor?.system?.attributes?.ac?.cover;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}