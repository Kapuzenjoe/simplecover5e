import { MODULE_ID, COVER, SETTING_KEYS } from "../config.mjs";
import { isLegacyDnd5e } from "../utils.mjs";

const CARD_SUMMARY_SELECTOR = ".card-summary[data-message-id]";

/**
 * Register hooks used by cover notes in chat messages.
 * @returns {void}
 */
export function initChatMessageHooks() {
  Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
}

/* -------------------------------------------- */

/**
 * Build the warning icon shown next to a cover value that was overridden in the roll dialog.
 * @param {object} target The stored cover target descriptor with a `newCover` override.
 * @returns {HTMLElement} The decorated icon element.
 */
function buildCoverChangeIcon(target) {
  const originalCover = _loc(COVER.I18N.LABEL[target.originalCover]);
  const newCover = _loc(COVER.I18N.LABEL[target.newCover]);
  const label = _loc("SIMPLE_COVER_5E.CoverHint.CoverModeChanged");
  const tooltipHtml = "<i class=\"fa-solid fa-triangle-exclamation\"></i> "
          + `<strong>${foundry.utils.escapeHTML(label)}</strong><br>`
          + `${foundry.utils.escapeHTML(originalCover)} &rarr; ${foundry.utils.escapeHTML(newCover)}`;

  const icon = document.createElement("i");
  icon.classList.add("fa-solid", "fa-triangle-exclamation", "simplecover5e-cover-change");
  Object.assign(icon.dataset, { tooltipClass: "dnd5e2 dnd5e-tooltip", tooltipHtml });
  icon.setAttribute("aria-label", `${label}: ${originalCover} -> ${newCover}`);
  return icon;
}

/* -------------------------------------------- */

/**
 * Insert a cover-change warning icon into a roll message's rendered markup (dnd5e 6.0.0+).
 * @param {ChatMessage5e} targetMessage The chat message whose cover-change flags should be checked.
 * @param {HTMLElement} container The markup the roll actually renders into (own card or embedded summary).
 */
function decorateCoverChangeMessage(targetMessage, container) {
  const changedTargets = getChangedCoverTargets(targetMessage);
  if ( !changedTargets.length ) return;

  if ( targetMessage.type === "attack" ) {
    const changedByUuid = new Map(changedTargets.map(target => [target.uuid, target]));
    const actorByToken = new Map((targetMessage.system?.targets ?? []).map(t => [t.token, t.actor]));
    for ( const pill of container.querySelectorAll("target-pill") ) {
      const target = changedByUuid.get(actorByToken.get(pill.target));
      if ( !target ) continue;

      const icon = buildCoverChangeIcon(target);
      icon.style.order = "1";
      pill.append(icon);
    }
    return;
  }

  if ( targetMessage.type !== "save" ) return;

  const icon = buildCoverChangeIcon(changedTargets[0]);
  const namePill = container.querySelector("ul.pills.unlist > li.pill.target");
  if ( namePill ) {
    namePill.append(icon);
    return;
  }

  const diceRoll = container.querySelector(".dice-roll");
  if ( diceRoll ) diceRoll.after(icon);
}

/* -------------------------------------------- */

/**
 * Insert a cover-change warning icon into a roll message's rendered markup (dnd5e <6.0.0).
 * @param {ChatMessage5e} targetMessage The chat message whose cover-change flags should be checked.
 * @param {HTMLElement} container The rendered chat message markup.
 */
function decorateCoverChangeMessageLegacy(targetMessage, container) {
  const changedTargets = getChangedCoverTargets(targetMessage);
  if ( !changedTargets.length ) return;

  const rollType = targetMessage.getFlag("dnd5e", "roll.type");

  if ( rollType === "attack" ) {
    const changedByUuid = new Map(changedTargets.map(target => [target.uuid, target]));
    for ( const row of container.querySelectorAll(".targets-tray .evaluation li.target[data-uuid]") ) {
      const target = changedByUuid.get(row.dataset.uuid);
      if ( !target ) continue;

      const ac = row.querySelector(".ac");
      if ( !ac ) continue;

      ac.prepend(buildCoverChangeIcon(target));
    }
    return;
  }

  if ( rollType !== "save" ) return;

  const total = container.querySelector(".dice-result .dice-total");
  if ( !total ) return;

  let icons = total.querySelector(":scope > .icons");
  if ( !icons ) {
    icons = document.createElement("span");
    icons.classList.add("icons");
    total.prepend(icons);
  }
  icons.append(buildCoverChangeIcon(changedTargets[0]));
}

/* -------------------------------------------- */

/**
 * Resolve the changed cover targets stored on a roll message, if any.
 * @param {ChatMessage5e} targetMessage The chat message whose cover-change flags should be checked.
 * @returns {object[]} The targets whose cover was overridden in the roll dialog.
 */
function getChangedCoverTargets(targetMessage) {
  return (targetMessage.getFlag(MODULE_ID, "targets") ?? [])
    .filter(target => (target.newCover != null) && (target.newCover !== target.originalCover));
}

/* -------------------------------------------- */

/**
 * Remove existing cover-change decorations and re-render them for a chat message, if applicable.
 * Also decorates any embedded `.card-summary` (dnd5e 6.0.0+ check/save results rendered as a summary
 * inside their originating usage message instead of their own, then hidden, standalone card).
 * @param {ChatMessage5e} chatMessage The rendered chat message.
 * @param {HTMLElement} html The rendered chat message markup.
 */
function onRenderChatMessage(chatMessage, html) {
  if ( !game.user.isGM ) return;

  html.querySelectorAll(".simplecover5e-cover-change").forEach(el => el.remove());

  if ( !game.settings.get(MODULE_ID, SETTING_KEYS.COVER_HINTS_GM_MESSAGE) ) return;

  if ( isLegacyDnd5e() ) {
    decorateCoverChangeMessageLegacy(chatMessage, html);
    return;
  }

  if ( !html.hidden ) decorateCoverChangeMessage(chatMessage, html);

  for ( const summary of html.querySelectorAll(CARD_SUMMARY_SELECTOR) ) {
    const summaryMessage = game.messages.get(summary.dataset.messageId);
    if ( summaryMessage ) decorateCoverChangeMessage(summaryMessage, summary);
  }
}
