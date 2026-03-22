import { MODULE_ID, COVER } from "../config/constants.config.mjs";

/**
 * Inject module-provided notes into a rendered Roll Configuration Dialog.
 * @param {object} dialog                                  The Roll Configuration Dialog application being rendered.
 * @param {HTMLElement} html                               The rendered HTML element for the dialog.
 * @returns {Promise<void>}
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
 * Prepare the notes element for injection into a Roll Configuration Dialog.
 * @param {object} dialog                                  The Roll Configuration Dialog application.
 * @returns {Promise<HTMLElement|null>}                    The notes element to inject, or null if none are present.
 */
async function prepareNotes(dialog) {
    const data = dialog?.options?.[MODULE_ID];
    if (!data || data.rendered) return null;

    const notes = data.notes ?? [];
    if (!notes.length) return null;

    const rendered = await foundry.applications.handlebars.renderTemplate(
        "modules/simplecover5e/templates/dialog-note.hbs",
        {
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
 * 
 * @param {BasicRoll[]} rolls                           Rolls that have been constructed but not evaluated.
 * @param {BasicRollProcessConfiguration} config        Configuration information for the roll.
 * @param {BasicRollDialogConfiguration} dialog         Configuration for the roll dialog.
 * @param {BasicRollMessageConfiguration} message       Configuration for the roll message.
 */
export async function onPostRollConfiguration(rolls, config, dialog, message) {
    const messageFlags = message?.data?.flags?.simplecover5e ?? [];
    if (!messageFlags.length) return;
    const content = [];

    for (const flag of messageFlags) {
        if (Object.hasOwn(flag, "newMode") && flag.newMode !== flag.desiredCover) {
            content.push(`
                <p><strong>${flag?.targetName || "???"}</strong></p>
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