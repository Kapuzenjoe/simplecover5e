/**
 * @import { CoverLevel } from "../_types.mjs";
 */

import { COVER_TARGETS_PATH, MODULE_ID, COVER, SETTING_KEYS } from "../config.mjs";
import { setCoverStatusViaGM } from "../cover/status.mjs";
import { getHiddenNpcName } from "../integrations/hide-npc-names.mjs";

const ROLL_CONFIGURATION_SELECTOR = '[data-application-part="configuration"]';
const DIALOG_NOTES_SELECTOR = 'fieldset[data-simplecover5e="dialog-notes"]';
const CARD_SUMMARY_SELECTOR = ".card-summary[data-message-id]";
const DIALOG_NOTE_TEMPLATE = `modules/${MODULE_ID}/templates/dialog-note.hbs`;

/**
 * Apply cover selection changes from the roll dialog.
 * @param {RollConfigurationDialog} app The roll configuration dialog.
 * @param {FormDataExtended} [formData] Form data entered into the rolling prompt.
 * @returns {{ targetActor: Actor5e, resolvedCover: CoverLevel, resolvedBonus: 0|2|5|null }[]} The resolved
 *   roll changes.
 */
export function applyDialogCoverOverride(app, formData) {
  if ( !formData?.object ) return [];

  const targets = foundry.utils.getProperty(app.message, COVER_TARGETS_PATH) ?? [];
  if ( !targets.length ) return [];

  const changes = [];
  const changed = foundry.utils.flattenObject(formData.object);
  const pathPrefix = `${MODULE_ID}.targets.`;

  for ( const [path, selectedCover] of Object.entries(changed) ) {
    if ( !path.startsWith(pathPrefix) || !path.endsWith(".newCover") ) continue;
    if ( !COVER.KEYS.includes(selectedCover) ) continue;

    const index = Number(path.slice(pathPrefix.length, -".newCover".length));
    const target = targets[index];
    if ( !target ) continue;

    target.newCover = selectedCover === target.originalCover ? null : selectedCover;

    const resolvedCover = target.newCover ?? target.originalCover ?? "none";
    const resolvedBonus = COVER.BONUS[resolvedCover];
    const targetActor = fromUuidSync(target.uuid);
    if ( !targetActor ) continue;

    void setCoverStatusViaGM(targetActor.uuid, resolvedCover);
    changes.push({ resolvedBonus, resolvedCover, targetActor });
  }

  return changes;
}

/* -------------------------------------------- */

/**
 * Register hooks used by cover notes in roll dialogs and chat messages.
 */
export function initRollDialogHooks() {
  Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  Hooks.on("renderRollConfigurationDialog", onRenderRollConfigurationDialog);
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
 * Resolve the localized cover hint text.
 * @param {"attack"|"save"} type The roll type.
 * @param {CoverLevel} cover The cover level.
 * @param {string} targetName The target display name.
 * @returns {string} The localized hint.
 */
function getCoverHint(type, cover, targetName) {
  const tokenName = foundry.utils.escapeHTML(targetName);
  return type === "attack"
    ? _loc(COVER.I18N.HINT_KEYS.Attack[cover], { tokenName })
    : _loc(COVER.I18N.HINT_KEYS.Save[cover]);
}

/* -------------------------------------------- */

/**
 * Resolve the display name for a cover target.
 * @param {object} target The stored cover target descriptor.
 * @param {object[]} systemTargets The dnd5e target descriptors.
 * @returns {string} The display name.
 */
function getTargetName(target, systemTargets) {
  const actor = fromUuidSync(target.uuid);
  const hiddenNpcName = actor ? getHiddenNpcName(actor) : null;
  if ( hiddenNpcName ) return hiddenNpcName;

  const systemTarget = systemTargets.find(systemTarget => (systemTarget.actor ?? systemTarget.uuid) === target.uuid);
  if ( systemTarget?.name ) return systemTarget.name;

  return actor?.name ?? "???";
}

/* -------------------------------------------- */

/**
 * Whether the active dnd5e system predates the 6.0.0 chat message rework.
 * @returns {boolean}
 */
function isLegacyDnd5e() {
  return foundry.utils.isNewerVersion("6.0.0", game.system.version);
}

/* -------------------------------------------- */

/**
 * Remove existing cover-change decorations and re-render them for a chat message, if applicable.
 * Also decorates any embedded `.card-summary` (dnd5e 6.0.0+ check/save results rendered as a summary
 * inside their originating usage message instead of their own, then hidden, standalone card).
 * @function dnd5e.renderChatMessage
 * @memberof hookEvents
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

/* -------------------------------------------- */

/**
 * Insert module notes into a rendered roll configuration dialog.
 * @function renderRollConfigurationDialog
 * @memberof hookEvents
 * @param {RollConfigurationDialog} dialog The roll configuration dialog being rendered.
 * @param {HTMLElement} html The rendered dialog element.
 * @returns {Promise<void>} Resolves after the dialog has been updated.
 */
async function onRenderRollConfigurationDialog(dialog, html) {
  const notes = await prepareNotes(dialog);
  if ( !notes ) return;

  html.querySelector(DIALOG_NOTES_SELECTOR)?.remove();

  const configuration = html.querySelector(ROLL_CONFIGURATION_SELECTOR);
  if ( !configuration ) return;

  configuration.after(notes);

  dialog.setPosition();
}

/* -------------------------------------------- */

/**
 * Prepare a roll dialog note for template rendering.
 * @param {object} note The note data.
 * @returns {Promise<object>} The enriched note data.
 */
async function prepareDialogNote(note) {
  const icon = String(note?.icon ?? "");
  const isIconPath = icon.includes("/");
  const enrichedHint = await foundry.applications.ux.TextEditor.enrichHTML(String(note?.hint ?? ""), {
    secrets: true
  });
  const content = document.createElement("template");
  content.innerHTML = enrichedHint.trim();
  return {
    ...note,
    iconPath: isIconPath ? icon : "",
    iconClass: isIconPath ? "" : icon,
    hint: (content.content.childElementCount === 1) && (content.content.firstElementChild?.tagName === "P")
      ? content.content.firstElementChild.innerHTML
      : enrichedHint
  };
}

/* -------------------------------------------- */

/**
 * Create the notes element inserted into the roll configuration dialog.
 * @param {RollConfigurationDialog} dialog The roll configuration dialog.
 * @returns {Promise<HTMLElement|null>} The rendered notes element, or null if no notes are available.
 */
async function prepareNotes(dialog) {
  const optionNotes = dialog?.options?.[MODULE_ID]?.notes ?? [];
  const notes = await Promise.all(optionNotes.map(note => {
    const target = note?.target ?? "";
    return prepareDialogNote({
      ...note,
      name: note?.name ?? `${MODULE_ID}.${target}.cover`
    });
  }));

  const type = isLegacyDnd5e()
    ? dialog.message?.data?.flags?.dnd5e?.roll?.type
    : dialog.message?.data?.type;
  const targets = foundry.utils.getProperty(dialog.message, COVER_TARGETS_PATH) ?? [];
  if ( ((type === "attack") || (type === "save")) && targets.length ) {
    const systemTargets = dialog.message?.data?.system?.targets ?? dialog.message?.data?.flags?.dnd5e?.targets ?? [];
    const targetNotes = await Promise.all(targets.map((target, index) => {
      const cover = target.newCover ?? target.originalCover ?? "none";
      const statusId = COVER.IDS[cover];
      return prepareDialogNote({
        cover,
        hint: getCoverHint(type, cover, getTargetName(target, systemTargets)),
        icon: statusId ? (CONFIG.statusEffects[statusId]?.img ?? "") : "",
        label: game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY),
        name: `${MODULE_ID}.targets.${index}.newCover`
      });
    }));
    notes.push(...targetNotes);
  }
  if ( !notes.length ) return null;

  const rendered = await foundry.applications.handlebars.renderTemplate(
    DIALOG_NOTE_TEMPLATE,
    { notes, coverModes: COVER.I18N.LABEL }
  );

  return foundry.utils.parseHTML(rendered);
}
