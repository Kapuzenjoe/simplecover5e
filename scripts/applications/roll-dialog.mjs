import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.mjs";
import { setCoverStatusViaGM } from "../socket/queries.mjs";
import { setDialogNote } from "../cover/api.mjs";
import { ignoresCover } from "../cover/rules.mjs";

const COVER_NOTES_PATH = `data.flags.${MODULE_ID}.notes`;

/**
 * Register hooks used by cover notes in roll dialogs and chat messages.
 *
 * @returns {void}
 */
export function initRollDialogHooks() {
    Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
    Hooks.on("renderRollConfigurationDialog", onRenderRollConfigurationDialog);
}

/**
 * Insert module notes into a rendered roll configuration dialog.
 *
 * @function renderRollConfigurationDialog
 * @memberof hookEvents
 * @param {RollConfigurationDialog} dialog The roll configuration dialog being rendered.
 * @param {HTMLElement} html The rendered dialog element.
 * @returns {Promise<void>} Resolves after the dialog has been updated.
 */
async function onRenderRollConfigurationDialog(dialog, html) {
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
    if (!data) return null;

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

    const template = document.createElement("template");
    template.innerHTML = rendered.trim();
    return template.content.firstElementChild;
}

function onRenderChatMessage(chatMessage, html) {
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

/**
 * Add cover data to the pending roll dialog.
 *
 * @param {BasicRollDialogConfiguration} dialog The pending roll dialog configuration.
 * @param {object} data The cover note data.
 * @param {"none"|"half"|"threeQuarters"|"total"} data.cover The resolved cover level.
 * @param {0|2|5|null} data.bonus The resolved cover bonus.
 * @param {string} data.targetId The target token ID.
 * @param {string} data.targetName The display name for the target.
 * @param {string} data.targetActorUuid The target actor UUID.
 * @param {string} data.activityUuid The activity UUID.
 * @param {string} data.hint The localized hint text.
 * @returns {void}
 */
export function addCoverNote(dialog, data) {
    const statusId = COVER.IDS[data.cover];
    const note = {
        desiredCover: data.cover,
        desiredBonus: data.bonus,
        targetId: data.targetId,
        targetName: data.targetName,
        targetActorUuid: data.targetActorUuid,
        activityUuid: data.activityUuid
    };

    setDialogNote(dialog, {
        ...note,
        cover: data.cover,
        target: data.targetId,
        icon: statusId ? CONFIG.statusEffects[statusId].img : "",
        label: game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY),
        hint: data.hint
    });
}

/**
 * Apply a cover selection change from the roll dialog.
 *
 * @param {RollConfigurationDialog} app The roll configuration dialog.
 * @param {FormDataExtended} [formData] Form data entered into the rolling prompt.
 * @param {"attack"|"save"} type The dnd5e roll type being updated.
 * @returns {{ targetActor: Actor5e, resolvedCover: "none"|"half"|"threeQuarters"|"total", resolvedBonus: 0|2|5|null }[]} The resolved roll changes.
 */
export function applyDialogCoverOverride(app, formData, type) {
    if (!formData?.object) return [];

    const changes = [];
    const changed = foundry.utils.flattenObject(formData.object);
    const notes = app.options?.[MODULE_ID]?.notes ?? [];
    const pathPrefix = `${MODULE_ID}.`;

    for (const [path, selectedCover] of Object.entries(changed)) {
        if (!path.startsWith(pathPrefix) || !path.endsWith(".cover")) continue;

        const targetId = path.slice(pathPrefix.length, -".cover".length);
        const original = notes.find(entry => entry.target === targetId);
        if (!original) continue;

        const targetActor = fromUuidSync(original.targetActorUuid);
        if (!targetActor) continue;

        const activity = fromUuidSync(original.activityUuid);
        const { cover: resolvedCover, bonus: resolvedBonus } = ignoresCover(activity, selectedCover, targetActor);

        void setCoverStatusViaGM(targetActor.uuid, resolvedCover);

        const desiredCover = original.desiredCover ?? original.cover ?? "none";
        original.newMode = String(resolvedCover);
        recordCoverModeChange(app.message, {
            targetId,
            targetName: original.targetName,
            desiredCover,
            newMode: original.newMode
        });

        const hint = type === "attack"
            ? game.i18n.format(COVER.I18N.HINT_KEYS.Attack[resolvedCover], { tokenName: original?.targetName || "???" })
            : game.i18n.localize(COVER.I18N.HINT_KEYS.Save[resolvedCover]);
        const statusId = COVER.IDS[resolvedCover];

        setDialogNote(app, {
            cover: resolvedCover,
            target: targetId,
            icon: statusId ? CONFIG.statusEffects[statusId].img : "",
            label: game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY),
            hint,
            desiredCover,
            desiredBonus: original.desiredBonus ?? null,
            targetId,
            targetName: original.targetName,
            targetActorUuid: original.targetActorUuid,
            activityUuid: original.activityUuid,
            newMode: String(resolvedCover)
        });

        changes.push({ targetActor, resolvedCover, resolvedBonus });
    }

    return changes;
}

/**
 * Record a roll-dialog cover change for the optional GM chat summary.
 *
 * @param {BasicRollMessageConfiguration} message The pending roll message configuration.
 * @param {object} data The cover change data.
 * @param {string} data.targetId The target token ID.
 * @param {string} data.targetName The target display name.
 * @param {"none"|"half"|"threeQuarters"|"total"} data.desiredCover The originally resolved cover level.
 * @param {"none"|"half"|"threeQuarters"|"total"} data.newMode The selected cover level.
 * @returns {void}
 */
export function recordCoverModeChange(message, data) {
    if (!message) return;
    if (!game.settings.get(MODULE_ID, SETTING_KEYS.COVER_HINTS_GM_MESSAGE)) return;
    if (data.newMode === data.desiredCover) return;

    let notes = foundry.utils.getProperty(message, COVER_NOTES_PATH);
    if (!Array.isArray(notes)) {
        notes = [];
        foundry.utils.setProperty(message, COVER_NOTES_PATH, notes);
    }

    const note = {
        targetId: data.targetId,
        targetName: data.targetName,
        desiredCover: data.desiredCover,
        newMode: data.newMode
    };
    const existing = notes.findIndex(entry => entry.targetId === note.targetId);
    if (existing >= 0) notes[existing] = note;
    else notes.push(note);
}
