import { MODULE_ID, COVER_STATUS_IDS, SETTING_KEYS } from "../config/constants.config.mjs";
import { clearCoverStatusEffect } from "../services/cover.service.mjs";
import {
  buildCoverContext,
  buildCreaturePrism,
  evaluateCoverFromOccluders,
} from "../services/cover.engine.mjs";
import { drawCoverDebug, clearCoverDebug } from "../services/cover.debug.mjs";
import { toggleCoverEffectViaGM, isBlockingCreatureToken } from "../utils/rpc.mjs";


// =========================
// Config
// =========================

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

// =========================
// Public Hooks
// =========================

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

  const ctx = buildCoverContext(canvas.scene);
  const blockingTokens = canvas.tokens.placeables.filter(t => isBlockingCreatureToken(t));
  ctx.creaturePrisms = new Map(
    blockingTokens.map(t => [t.id, buildCreaturePrism(t.document, ctx)])
  );

  const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
  if (debugOn && game.users.activeGM) clearCoverDebug();

  for (const t of targets) {
    const targetActor = t.document.actor;
    const targetActorId = targetActor.uuid;

    if (targetActor.statuses?.has?.(COVER_STATUS_IDS.total)) continue;
    const res = evaluateCoverFromOccluders(attackerToken.document, t.document, ctx, { debug: debugOn });
    if (debugOn && res.debugSegments?.length && game.users.activeGM) {
      drawCoverDebug({ segments: res.debugSegments });
    }

    let wantId =
      res.cover === "threeQuarters" ? COVER_STATUS_IDS.threeQuarters :
        res.cover === "half" ? COVER_STATUS_IDS.half : null;

    const item = config.subject?.item ?? null;
    const actionType = config.subject?.actionType ?? null;
    if (spellIgnoresCover(item, actor, actionType)) wantId = null;

    const currentBonus = getCurrentACCoverBonus(targetActor);
    const desiredBonus = desiredBonusFromWant(wantId, COVER_STATUS_IDS);
    const delta = desiredBonus - currentBonus;

    if (delta) {
      adjustMessageTargetAC(message, targetActorId, delta);
      if (typeof config.target === "number") {
        config.target = Math.max(0, (config.target || 0) + delta);
      }
    }
    const onHalf = targetActor.statuses?.has?.(COVER_STATUS_IDS.half);
    const onThree = targetActor.statuses?.has?.(COVER_STATUS_IDS.threeQuarters);


    if (desiredBonus === 5) {
      if (!onThree) toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.threeQuarters, true);
    } else if (desiredBonus === 2) {
      if (!onHalf) toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.half, true);
    } else {
      if (onThree) toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.threeQuarters, false);
      if (onHalf) toggleCoverEffectViaGM(targetActorId, COVER_STATUS_IDS.half, false);
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
  if (actor.statuses?.has?.(COVER_STATUS_IDS.total)) return;

  const targetToken = actor.getActiveTokens?.()[0]
  if (!targetToken) return;

  const srcMsg = getSourceChatMessageFromEvent(config?.event);
  const item = srcMsg?.getAssociatedItem?.();
  const sourceActor = srcMsg?.speakerActor
  const sourceToken = sourceActor?.getActiveTokens?.()[0]
  if (!sourceToken) return;

  const ctx = buildCoverContext(canvas.scene);
  const blockingTokens = canvas.tokens.placeables.filter(t => isBlockingCreatureToken(t));
  ctx.creaturePrisms = new Map(
    blockingTokens.map(t => [t.id, buildCreaturePrism(t.document, ctx)])
  );

  const debugOn = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.DEBUG);
  if (debugOn && game.users.activeGM) clearCoverDebug();

  const res = evaluateCoverFromOccluders(sourceToken.document, targetToken.document, ctx, { debug: debugOn });
  if (debugOn && res.debugSegments?.length && game.users.activeGM) drawCoverDebug({ segments: res.debugSegments });

  let wantId =
    res.cover === "threeQuarters" ? COVER_STATUS_IDS.threeQuarters :
      res.cover === "half" ? COVER_STATUS_IDS.half : null;
  if (spellIgnoresCover(item, actor)) wantId = null;

  const onHalf = actor.statuses?.has?.(COVER_STATUS_IDS.half);
  const onThree = actor.statuses?.has?.(COVER_STATUS_IDS.threeQuarters);

  const isDex = config.ability === "dex";
  const roll0 = config.rolls?.[0];

  const addSaveBonus = (n) => { if (isDex && roll0?.parts) roll0.parts.push(String(n)); };
  const removeSaveBonus = () => {
    if (!isDex || !roll0?.parts) return;
    const parts = roll0.parts;
    const idx = parts.lastIndexOf("@cover");
    if (idx !== -1) parts.splice(idx, 1);
  };

  if ((wantId === COVER_STATUS_IDS.half) && !onHalf) {
    addSaveBonus(2);
    removeSaveBonus();
    toggleCoverEffectViaGM(actor.uuid, COVER_STATUS_IDS.half, true);
  } else if ((wantId === null) && onHalf) {
    removeSaveBonus();
    toggleCoverEffectViaGM(actor.uuid, COVER_STATUS_IDS.half, false);
  }

  if ((wantId === COVER_STATUS_IDS.threeQuarters) && !onThree) {
    addSaveBonus(5);
    removeSaveBonus();
    toggleCoverEffectViaGM(actor.uuid, COVER_STATUS_IDS.threeQuarters, true);
  } else if ((wantId === null) && onThree) {
    removeSaveBonus();
    toggleCoverEffectViaGM(actor.uuid, COVER_STATUS_IDS.threeQuarters, false);
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
    console.warn("[cover] clear on update combat", err);
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
      await clearCoverDebug();
    }
  } catch (err) {
    console.warn("[cover] clear on token movement", err);
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
      await clearCoverDebug();
    }
  } catch (err) {
    console.warn("[cover] clear on delete combat", err);
  }
}

// =========================
// Helper
// =========================

/**
 * Return true if cover should be skipped for this roll due to spell-specific rules.
 * @param {Item5e} item
 * @param {object} config
 */
function spellIgnoresCover(item, actor, actionType = null) {
  const props = item?.system?.properties;
  const items = actor?.items;
  if (props?.has?.("ignoreCover")) return true;
  if (actionType === "rwak") {
    if (
      items.getName("Sharpshooter") ||
      items.some(i => i.system?.identifier === "sharpshooter")
    ) {
      return true;
    }
  }
  if (actionType === "rsak") {
    if (
      items.getName("Spell Sniper") ||
      items.some(i => i.system?.identifier === "spell-sniper")
    ) {
      return true;
    }
  }
  return false;
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
 * Safely no-ops if the structure doesn't match.
 * @param {object} message     The hook's 'message' arg.
 * @param {string} targetUuid  TokenDocument UUID to match.
 * @param {number} delta       AC delta (+/-).
 */
function adjustMessageTargetAC(message, targetUuid, delta) {
  const targets = message?.data?.flags?.dnd5e?.targets;
  if (!Array.isArray(targets) || !targetUuid || !delta) return;
  for (const t of targets) {
    const uuid = t?.uuid ?? t?.tokenUuid ?? null;
    if (!uuid || uuid !== targetUuid) continue;
    const base = Number(t.ac ?? 0);
    t.ac = (Number.isFinite(base) ? base : 0) + delta;
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

/**
 * Return the desired cover bonus from the desired cover status ID.
 * @param {*} wantId  
 * @param {*} IDS 
 * @returns {number}  The desired cover bonus (0/2/5).
 */
function desiredBonusFromWant(wantId, IDS) {
  if (wantId === IDS.threeQuarters) return 5;
  if (wantId === IDS.half) return 2;
  return 0;
}

