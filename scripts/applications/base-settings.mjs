import { MODULE_ID } from "../config.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * A base configuration form used by Simple Cover 5e.
 * @extends {ApplicationV2}
 * @mixes HandlebarsApplicationMixin
 */
export class SimpleCoverBaseConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @override
   */
  static DEFAULT_OPTIONS = {
    form: {
      closeOnSubmit: true,
      handler: SimpleCoverBaseConfigApp._onSubmit
    },
    position: { width: 600 },
    tag: "form",
    window: {
      contentClasses: ["standard-form"]
    }
  };

  static FIELDSETS = [];

  /**
   * @override
   */
  static PARTS = {
    form: {
      scrollable: [""],
      template: "templates/generic/form-fields.hbs"
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

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

    for ( const [id, value] of Object.entries(formData.object ?? {}) ) {
      const setting = game.settings.settings.get(id);
      if ( !setting ) continue;

      const prior = game.settings.get(setting.namespace, setting.key);
      let updated;
      try {
        updated = await game.settings.set(setting.namespace, setting.key, value);
      } catch ( error ) {
        ui.notifications.error(error);
      }

      if ( prior === updated ) continue;
      requiresClientReload ||= (setting.scope !== CONST.SETTING_SCOPES.WORLD) && setting.requiresReload;
      requiresWorldReload ||= (setting.scope === CONST.SETTING_SCOPES.WORLD) && setting.requiresReload;
    }

    if ( requiresClientReload || requiresWorldReload ) {
      return foundry.applications.settings.SettingsConfig.reloadConfirm({ world: requiresWorldReload });
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the footer buttons displayed by the form.
   * @returns {FormFooterButton[]} The footer button configuration.
   */
  _getButtons() {
    return [
      {
        icon: "fa-solid fa-floppy-disk",
        label: "SETTINGS.Save",
        type: "submit"
      }
    ];
  }

  /* -------------------------------------------- */

  /**
   * Get grouped form fields for the configured settings.
   * @returns {FormNode[]} The grouped form field data.
   */
  _getFields() {
    const fieldsets = [];

    for ( const { legend, keys } of this.constructor.FIELDSETS ) {
      const fields = keys.map(key => this._getSettingField(key)).filter(Boolean);
      if ( !fields.length ) continue;

      fieldsets.push({ fields, legend, fieldset: true });
    }

    return fieldsets;
  }

  /* -------------------------------------------- */

  /**
   * Get form field data for a registered setting.
   * @param {string} key The module setting key.
   * @returns {object|null} The form field data.
   */
  _getSettingField(key) {
    const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
    if ( !(setting?.type instanceof foundry.data.fields.DataField) ) return null;

    const field = setting.type;
    field.name = setting.id;
    field.label ||= setting.name;
    field.hint ||= setting.hint ?? "";

    return {
      field,
      value: game.settings.get(MODULE_ID, key)
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare the application render context.
   * @param {ApplicationRenderOptions} options The active render options.
   * @returns {Promise<object>} The prepared render context.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      buttons: this._getButtons(),
      fields: this._getFields()
    });
  }
}
