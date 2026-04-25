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

    const rawNotes = data.notes ?? [];
    const notes = await Promise.all(rawNotes.map(async note => {
        const icon = String(note?.icon ?? "");
        const isIconPath = /[/.](svg|png|webp|jpg|jpeg|gif)$/i.test(icon) || icon.includes("/");
        const enrichedHint = await foundry.applications.ux.TextEditor.enrichHTML(String(note?.hint ?? ""), {
            async: true,
            secrets: true
        });
        const content = document.createElement("template");
        content.innerHTML = enrichedHint.trim();
        return {
            ...note,
            iconPath: isIconPath ? icon : "",
            iconClass: isIconPath ? "" : icon,
            hint: content.content.childElementCount === 1 && content.content.firstElementChild?.tagName === "P"
                ? content.content.firstElementChild.innerHTML
                : enrichedHint
        };
    }));
    if (!notes.length) return null;

    const rendered = await foundry.applications.handlebars.renderTemplate(
        "modules/simplecover5e/templates/dialog-note.hbs",
        {
            moduleId: MODULE_ID,
            notes,
            coverModes: COVER.I18N.LABEL
        }
    );

    data.rendered = true;

    const template = document.createElement("template");
    template.innerHTML = rendered.trim();
    return template.content.firstElementChild;
}

export function onRenderChatMessage(chatMessage, html) {
    if (!game.user.isGM) return;

    const anchor = html.querySelector(".message-content") ?? html;
    if (!anchor) return;

    anchor.querySelectorAll(".simplecover5e-cover-summary").forEach(el => el.remove());

    if (!game.settings.get(MODULE_ID, SETTING_KEYS.COVER_HINTS_GM_MESSAGE)) return;

    const messageFlags = chatMessage?.flags?.[MODULE_ID]?.notes ?? [];
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

    const wrapper = document.createElement("div");
    wrapper.classList.add("simplecover5e-cover-summary");
    wrapper.innerHTML = `
        <hr>
        <p><strong>${game.i18n.localize("SIMPLE_COVER_5E.CoverHint.CoverModeChanged")}</strong></p>
        ${content.join("<hr>")}
    `;

    anchor.append(wrapper);
}
