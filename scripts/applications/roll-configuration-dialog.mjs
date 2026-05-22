import { MODULE_ID, COVER, SETTING_KEYS } from "../config.mjs";
import { getHiddenNpcName } from "../integrations/hide-npc-names.mjs";
import { setCoverStatusViaGM } from "../cover/status.mjs";

const ROLL_CONFIGURATION_PART = '[data-application-part="configuration"]';
const DIALOG_NOTES_SELECTOR = 'fieldset[data-simplecover5e="dialog-notes"]';

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

    html.querySelector(DIALOG_NOTES_SELECTOR)?.remove();

    const configuration = html.querySelector(ROLL_CONFIGURATION_PART);
    if (!configuration) return;

    configuration.after(notes);

    dialog.setPosition();
}

/**
 * Resolve the display name for a cover target.
 *
 * @param {object} target The stored cover target descriptor.
 * @param {object[]} systemTargets The dnd5e target descriptors.
 * @returns {string} The display name.
 */
function getTargetName(target, systemTargets) {
    const actor = fromUuidSync(target.uuid);
    const hiddenNpcName = actor ? getHiddenNpcName(actor) : null;
    if (hiddenNpcName) return hiddenNpcName;

    const systemTarget = systemTargets.find(systemTarget => systemTarget.uuid === target.uuid);
    if (systemTarget?.name) return systemTarget.name;

    return actor?.name ?? "???";
}

/**
 * Resolve the localized cover hint text.
 *
 * @param {"attack"|"save"} type The roll type.
 * @param {"none"|"half"|"threeQuarters"|"total"} cover The cover level.
 * @param {string} targetName The target display name.
 * @returns {string} The localized hint.
 */
function getCoverHint(type, cover, targetName) {
    const tokenName = foundry.utils.escapeHTML(targetName);
    return type === "attack"
        ? game.i18n.format(COVER.I18N.HINT_KEYS.Attack[cover], { tokenName })
        : game.i18n.localize(COVER.I18N.HINT_KEYS.Save[cover]);
}

/**
 * Prepare a roll dialog note for template rendering.
 *
 * @param {object} note The note data.
 * @returns {Promise<object>} The enriched note data.
 */
async function prepareDialogNote(note) {
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
}

/**
 * Create the notes element inserted into the roll configuration dialog.
 *
 * @param {RollConfigurationDialog} dialog The roll configuration dialog.
 * @returns {Promise<HTMLElement|null>} The rendered notes element, or null if no notes are available.
 */
async function prepareNotes(dialog) {
    const optionNotes = dialog?.options?.[MODULE_ID]?.notes ?? [];
    const notes = await Promise.all(optionNotes.map(note => {
        const target = note?.target == null ? "" : note.target;
        return prepareDialogNote({
            ...note,
            name: note?.name ?? `${MODULE_ID}.${target}.cover`
        });
    }));

    const type = dialog.message?.data?.flags?.dnd5e?.roll?.type;
    const targets = dialog.message?.data?.flags?.[MODULE_ID]?.targets ?? [];
    if (((type === "attack") || (type === "save")) && targets.length) {
        const systemTargets = dialog.message?.data?.flags?.dnd5e?.targets ?? [];
        const targetNotes = await Promise.all(targets.map((target, index) => {
            const cover = target.newCover ?? target.originalCover ?? "none";
            const statusId = COVER.IDS[cover];
            return prepareDialogNote({
                name: `${MODULE_ID}.targets.${index}.newCover`,
                cover,
                icon: statusId ? (CONFIG.statusEffects[statusId]?.img ?? "") : "",
                label: game.i18n.localize(COVER.I18N.LABEL_PREFIX_KEY),
                hint: getCoverHint(type, cover, getTargetName(target, systemTargets))
            });
        }));
        notes.push(...targetNotes.filter(Boolean));
    }
    if (!notes.length) return null;

    const rendered = await foundry.applications.handlebars.renderTemplate(
        "modules/simplecover5e/templates/dialog-note.hbs",
        { notes, coverModes: COVER.I18N.LABEL }
    );

    const template = document.createElement("template");
    template.innerHTML = rendered.trim();
    return template.content.firstElementChild;
}

function onRenderChatMessage(chatMessage, html) {
    if (!game.user.isGM) return;

    html.querySelectorAll(".simplecover5e-cover-change, .simplecover5e-cover-summary").forEach(el => el.remove());

    if (!game.settings.get(MODULE_ID, SETTING_KEYS.COVER_HINTS_GM_MESSAGE)) return;

    const changedTargets = (chatMessage.flags?.[MODULE_ID]?.targets ?? [])
        .filter(target => (target.newCover != null) && (target.newCover !== target.originalCover));
    if (!changedTargets.length) return;

    const rollType = chatMessage.flags?.dnd5e?.roll?.type;
    const changedByUuid = new Map(changedTargets.map(target => [target.uuid, target]));

    const getCoverChangeTooltip = target => {
        const originalCover = game.i18n.localize(COVER.I18N.LABEL[target.originalCover]);
        const newCover = game.i18n.localize(COVER.I18N.LABEL[target.newCover]);
        const label = game.i18n.localize("SIMPLE_COVER_5E.CoverHint.CoverModeChanged");
        const html = `<i class="fa-solid fa-triangle-exclamation"></i> `
            + `<strong>${foundry.utils.escapeHTML(label)}</strong><br>`
            + `${foundry.utils.escapeHTML(originalCover)} &rarr; ${foundry.utils.escapeHTML(newCover)}`;
        return {
            text: `${label}: ${originalCover} -> ${newCover}`,
            html
        };
    };

    if (rollType === "attack") {
        for (const row of html.querySelectorAll(".targets-tray .evaluation li.target[data-uuid]")) {
            const target = changedByUuid.get(row.dataset.uuid);
            if (!target) continue;

            const ac = row.querySelector(".ac");
            if (!ac) continue;

            const tooltip = getCoverChangeTooltip(target);

            const icon = document.createElement("i");
            icon.classList.add("fa-solid", "fa-triangle-exclamation", "simplecover5e-cover-change");
            Object.assign(icon.dataset, {
                tooltipHtml: tooltip.html,
                tooltipClass: "dnd5e2 dnd5e-tooltip"
            });
            icon.setAttribute("aria-label", tooltip.text);
            ac.prepend(icon);
        }
        return;
    }

    if (rollType === "save") {
        const total = html.querySelector(".dice-result .dice-total");
        if (!total) return;

        const target = changedTargets[0];
        const tooltip = getCoverChangeTooltip(target);

        let icons = total.querySelector(":scope > .icons");
        if (!icons) {
            icons = document.createElement("span");
            icons.classList.add("icons");
            total.prepend(icons);
        }

        const icon = document.createElement("i");
        icon.classList.add("fa-solid", "fa-triangle-exclamation", "simplecover5e-cover-change");
        Object.assign(icon.dataset, {
            tooltipHtml: tooltip.html,
            tooltipClass: "dnd5e2 dnd5e-tooltip"
        });
        icon.setAttribute("aria-label", tooltip.text);
        icons.append(icon);
    }
}

/**
 * Apply cover selection changes from the roll dialog.
 *
 * @param {RollConfigurationDialog} app The roll configuration dialog.
 * @param {FormDataExtended} [formData] Form data entered into the rolling prompt.
 * @returns {{ targetActor: Actor5e, resolvedCover: "none"|"half"|"threeQuarters"|"total", resolvedBonus: 0|2|5|null }[]} The resolved roll changes.
 */
export function applyDialogCoverOverride(app, formData) {
    if (!formData?.object) return [];

    const targets = app.message?.data?.flags?.[MODULE_ID]?.targets ?? [];
    if (!targets.length) return [];

    const changes = [];
    const changed = foundry.utils.flattenObject(formData.object);
    const pathPrefix = `${MODULE_ID}.targets.`;

    for (const [path, selectedCover] of Object.entries(changed)) {
        if (!path.startsWith(pathPrefix) || !path.endsWith(".newCover")) continue;
        if (!COVER.KEYS.includes(selectedCover)) continue;

        const index = Number(path.slice(pathPrefix.length, -".newCover".length));
        const target = targets[index];
        if (!target) continue;

        target.newCover = selectedCover === target.originalCover ? null : selectedCover;

        const resolvedCover = target.newCover ?? target.originalCover ?? "none";
        const resolvedBonus = COVER.BONUS[resolvedCover];
        const targetActor = fromUuidSync(target.uuid);
        if (!targetActor) continue;

        void setCoverStatusViaGM(targetActor.uuid, resolvedCover);
        changes.push({ targetActor, resolvedCover, resolvedBonus });
    }

    return changes;
}
