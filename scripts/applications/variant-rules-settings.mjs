import { changeTokenShapes } from "../canvas/token-shape.mjs";
import { MODULE_ID, SETTING_KEYS } from "../config.mjs";

import SimpleCoverBaseSettingsConfig from "./base-settings.mjs";

/**
 * A configuration form for cover and measurement rule variants.
 * @extends {SimpleCoverBaseSettingsConfig}
 */
export default class SimpleCoverVariantRulesSettingsConfig extends SimpleCoverBaseSettingsConfig {
  /** @override */
  static DEFAULT_OPTIONS = {
    actions: {
      applyGridlessTokenShape: SimpleCoverVariantRulesSettingsConfig.#onApplyGridlessTokenShape
    },
    window: {
      icon: "fas fa-list-check",
      title: "SIMPLE_COVER_5E.Settings.VariantMenu.Name"
    }
  };

  /** @override */
  static FIELDSETS = [
    {
      keys: [
        SETTING_KEYS.LOS_CHECK,
        SETTING_KEYS.CREATURES_HALF_ONLY,
        SETTING_KEYS.CREATURES_PRONE,
        SETTING_KEYS.IGNORE_FRIENDLY
      ],
      legend: "SIMPLE_COVER_5E.Settings.VariantMenu.Groups.General"
    },
    {
      keys: [
        SETTING_KEYS.GRIDLESS_DISTANCE_MODE,
        SETTING_KEYS.GRIDLESS_TOKEN_SHAPE
      ],
      legend: "SIMPLE_COVER_5E.Settings.VariantMenu.Groups.Measurement"
    },
    {
      keys: [
        SETTING_KEYS.INSET_ATTACKER,
        SETTING_KEYS.INSET_TARGET,
        SETTING_KEYS.INSET_OCCLUDER,
        SETTING_KEYS.FILTERED_TARGET_POINTS
      ],
      legend: "SIMPLE_COVER_5E.Settings.VariantMenu.Groups.Engine"
    }
  ];

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#insertGridlessTokenShapeButton();
  }

  /* -------------------------------------------- */

  /**
   * Insert the gridless token shape bulk-action button into the related form field.
   * @returns {void}
   */
  #insertGridlessTokenShapeButton() {
    const input = this.element.querySelector(`[name="${MODULE_ID}.${SETTING_KEYS.GRIDLESS_TOKEN_SHAPE}"]`);
    const formFields = input?.closest(".form-fields");
    if ( !formFields || formFields.querySelector("[data-action='applyGridlessTokenShape']") ) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "applyGridlessTokenShape";
    button.dataset.tooltip = "SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyExisting";
    button.setAttribute("aria-label", "SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyExisting");
    button.innerHTML = '<i class="fa-solid fa-rotate" inert></i>';
    formFields.append(button);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Apply the selected gridless token shape to existing tokens after explicit confirmation.
   * @this {SimpleCoverVariantRulesSettingsConfig}
   * @returns {Promise<void>} Resolves after matching tokens have been updated.
   */
  static async #onApplyGridlessTokenShape() {
    await this.submit();

    const currentScene = canvas?.scene ?? null;
    const scope = await foundry.applications.api.DialogV2.wait({
      buttons: [
        {
          action: "scene",
          disabled: !currentScene?.grid?.isGridless,
          icon: "fa-solid fa-map",
          label: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyCurrentScene"
        },
        {
          action: "all",
          icon: "fa-solid fa-globe",
          label: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyAllScenes"
        },
        {
          action: "cancel",
          icon: "fa-solid fa-xmark",
          label: "COMMON.Cancel"
        }
      ],
      content: `<p>${game.i18n.localize("SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyHint")}</p>`,
      rejectClose: false,
      window: { title: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyTitle" }
    });
    if ( (scope !== "scene") && (scope !== "all") ) return;

    const count = await changeTokenShapes({ scene: scope === "scene" ? currentScene : null });
    ui.notifications.info(_loc("SIMPLE_COVER_5E.Settings.GridlessTokenShape.ApplyUpdated", { count }));
  }
}
