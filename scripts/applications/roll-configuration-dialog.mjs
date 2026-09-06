/**
 * @import { CoverLevel } from "../_types.mjs";
 */

import { COVER_TARGETS_PATH, MODULE_ID, COVER } from "../config.mjs";
import { setCoverStatusViaGM } from "../cover/status.mjs";
import { getHiddenNpcName } from "../integrations/hide-npc-names.mjs";
import { isLegacyDnd5e } from "../utils.mjs";

const ROLL_CONFIGURATION_SELECTOR = '[data-application-part="configuration"]';
const DIALOG_NOTES_SELECTOR = 'fieldset[data-simplecover5e="dialog-notes"]';
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
  const pathPrefix = `${MODULE_ID}.targets.`;

  for ( const [path, selectedCover] of Object.entries(formData.object) ) {
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
 * Register hooks used by cover notes in the roll configuration dialog.
 * @returns {void}
 */
export function initRollDialogHooks() {
  Hooks.on("renderRollConfigurationDialog", onRenderRollConfigurationDialog);
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
  return _loc(COVER.I18N.HINT_KEYS[type][cover], { tokenName });
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
 * Insert module notes into a rendered roll configuration dialog.
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
