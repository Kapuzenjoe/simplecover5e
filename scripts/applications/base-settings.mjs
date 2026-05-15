import { MODULE_ID } from "../config.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * A base configuration form used by Simple Cover 5e.
 *
 * @extends {ApplicationV2}
 */
export class SimpleCoverBaseConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static FIELDSETS = [];

    /** @inheritdoc */
    static PARTS = {
        form: {
            template: "templates/generic/form-fields.hbs",
            scrollable: [""]
        },
        footer: {
            template: "templates/generic/form-footer.hbs"
        }
    };

    /** @inheritdoc */
    static DEFAULT_OPTIONS = {
        tag: "form",
        position: { width: 600 },
        window: {
            contentClasses: ["standard-form"]
        },
        form: {
            closeOnSubmit: true,
            handler: SimpleCoverBaseConfigApp._onSubmit
        }
    };

    /**
     * Get the footer buttons displayed by the form.
     * @returns {FormFooterButton[]} The footer button configuration.
     */
    _getButtons() {
        return [
            {
                type: "submit",
                icon: "fa-solid fa-floppy-disk",
                label: "SETTINGS.Save"
            }
        ];
    }

    /**
     * Prepare the application render context.
     * @param {ApplicationRenderOptions} options The active render options.
     * @returns {Promise<object>} The prepared render context.
     */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        return Object.assign(context, {
            fields: this._getFields(),
            buttons: this._getButtons()
        });
    }

    /**
     * Get grouped form fields for the configured settings.
     * @returns {FormNode[]} The grouped form field data.
     */
    _getFields() {
        const fieldsets = [];

        for (const { legend, keys } of this.constructor.FIELDSETS) {
            const fields = keys.map((key) => this._getSettingField(key)).filter(Boolean);
            if (!fields.length) continue;

            fieldsets.push({ fieldset: true, legend, fields });
        }

        return fieldsets;
    }

    /**
     * Get form field data for a registered setting.
     * @param {string} key The module setting key.
     * @returns {object|null} The form field data.
     */
    _getSettingField(key) {
        const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
        if (!(setting?.type instanceof foundry.data.fields.DataField)) return null;

        const field = setting.type;
        field.name = setting.id;
        field.label ||= setting.name;
        field.hint ||= setting.hint ?? "";

        return {
            field,
            value: game.settings.get(MODULE_ID, key)
        };
    }

    /**
     * Persist submitted form values to the corresponding settings.
     * @param {SubmitEvent} _event The triggering submit event.
     * @param {HTMLFormElement} form The submitted form element.
     * @param {FormDataExtended} formData The expanded form data.
     * @returns {Promise<void>} Resolves after settings have been updated.
     */
    static async _onSubmit(_event, form, formData) {
        let requiresClientReload = false;
        let requiresWorldReload = false;

        for (const [id, value] of Object.entries(formData.object ?? {})) {
            const setting = game.settings.settings.get(id);
            if (!setting) continue;

            const priorValue = game.settings.get(setting.namespace, setting.key, { document: true })?._source.value;
            let updated;
            try {
                updated = await game.settings.set(setting.namespace, setting.key, value, { document: true });
            } catch (error) {
                ui.notifications.error(error);
            }

            if (priorValue === updated?._source.value) continue;
            requiresClientReload ||= (setting.scope !== CONST.SETTING_SCOPES.WORLD) && setting.requiresReload;
            requiresWorldReload ||= (setting.scope === CONST.SETTING_SCOPES.WORLD) && setting.requiresReload;
        }

        if (requiresClientReload || requiresWorldReload) {
            return foundry.applications.settings.SettingsConfig.reloadConfirm({ world: requiresWorldReload });
        }
    }
}
