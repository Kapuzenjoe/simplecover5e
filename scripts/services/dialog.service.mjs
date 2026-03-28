import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.config.mjs";

/**
 * Insert module notes into a rendered roll configuration dialog.
 *
 * @function renderRollConfigurationDialog
 * @memberof hookEvents
 * @param {RollConfigurationDialog} dialog The roll configuration dialog being rendered.
 * @param {HTMLElement} html The rendered dialog element.
 * @returns {Promise<void>} Resolves after the dialog has been updated.
 */
export async function onRenderRollConfigurationDialog(dialog, html) {
    const notes = await prepareNotes(dialog);
    if (!notes) return;

    html.querySelector('fieldset[data-simplecover5e="dialog-notes"]')?.remove();

    const configFieldset = html.querySelector('fieldset[data-application-part="configuration"]');
    configFieldset?.after(notes);

    dialog.setPosition();
}

/**
 * Create the notes element inserted into the roll configuration dialog.
 *
 * @param {RollConfigurationDialog} dialog The roll configuration dialog.
 * @returns {Promise<HTMLElement|null>} The rendered notes element, or null if no notes are available.
 */
async function prepareNotes(dialog) {
    const data = dialog?.options?.[MODULE_ID];
    if (!data || data.rendered) return null;

    const notes = data.notes ?? [];
    if (!notes.length) return null;

    const rendered = await foundry.applications.handlebars.renderTemplate(
        "modules/simplecover5e/templates/dialog-note.hbs",
        {
            moduleId: MODULE_ID,
            notes,
            coverModes: COVER.I18N.LABEL
        }
    );

    const enriched = await foundry.applications.ux.TextEditor.enrichHTML(rendered, {
        async: true,
        secrets: true
    });

    data.rendered = true;

    const template = document.createElement("template");
    template.innerHTML = enriched.trim();
    return template.content.firstElementChild;
}

/**
 * Send a GM-only summary message when the selected cover mode changes the effective result.
 *
 * @function dnd5e.postRollConfiguration
 * @memberof hookEvents
 * @param {BasicRoll[]} rolls Rolls that have been constructed but not evaluated.
 * @param {BasicRollProcessConfiguration} config The pending roll process configuration.
 * @param {BasicRollDialogConfiguration} dialog The pending roll dialog configuration.
 * @param {BasicRollMessageConfiguration} message The pending roll message configuration.
 * @returns {Promise<void>} Resolves after any GM summary message has been created.
 */
export async function onPostRollConfiguration(rolls, config, dialog, message) {
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.COVER_HINTS_GM_MESSAGE)) return;

    const messageFlags = message?.data?.flags?.[MODULE_ID] ?? [];
    if (!messageFlags.length) return;
    const content = [];
    const escapeHTML = foundry.utils.escapeHTML;

    for (const flag of messageFlags) {
        if (Object.hasOwn(flag, "newMode") && flag.newMode !== flag.desiredCover) {
            content.push(`
                <p><strong>${escapeHTML(flag?.targetName || "???")}</strong></p>
                <p>
                    ${game.i18n.format("SIMPLE_COVER_5E.CoverHint.CoverModeDesired", { desiredCover: game.i18n.localize(COVER.I18N.LABEL[flag.desiredCover]) })}
                     <br>
                    ${game.i18n.format("SIMPLE_COVER_5E.CoverHint.CoverModeNew", { newMode: game.i18n.localize(COVER.I18N.LABEL[flag.newMode]) })}
                </p>
            `);
        }
    }

    if (!content.length) return;

    const chatData = {
        user: game.user.id,
        flavor: game.i18n.localize("SIMPLE_COVER_5E.CoverHint.CoverModeChanged"),
        whisper: ChatMessage.getWhisperRecipients("GM"),
        content: content.join("<hr>")
    };

    ChatMessage.applyRollMode(chatData, "blindroll");
    await ChatMessage.create(chatData);
}
