import { MODULE_ID } from "../config/constants.config.mjs";

/**
 * Inject module-provided notes into a rendered Roll Configuration Dialog.
 * @param {object} dialog                                  The Roll Configuration Dialog application being rendered.
 * @param {HTMLElement} html                               The rendered HTML element for the dialog.
 * @returns {Promise<void>}
 */
export async function onRenderRollConfigurationDialog(dialog, html) {
    const notes = await prepareNotes(dialog);
    if (!notes) return;

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
        { notes }
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
