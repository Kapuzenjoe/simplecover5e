import { MODULE_ID, SETTING_KEYS } from "./constants.mjs";
import { SimpleCoverVariantConfig } from "../applications/variant-config.mjs";
import { SimpleCoverAutomationConfig } from "../applications/automation-config.mjs";
import { clearCoverDebug } from "../cover/debug.mjs";
import { clearSystemCoverEffects } from "../cover/status.mjs";

/**
 * Clear cover debug graphics when debug rendering is disabled.
 *
 * @param {boolean} value The new debug setting value.
 * @returns {void}
 */
function onDebugSettingChange(value) {
  if (value === false) clearCoverDebug();
}

/**
 * Settings definitions for Simple Cover 5e.
 * These entries are registered under {@link MODULE_ID} by {@link registerSettings}.
 */
const SETTINGS = [
  {
    key: SETTING_KEYS.COVER_SCOPE,
    name: "SIMPLE_COVER_5E.Settings.CoverScope.Name",
    hint: "SIMPLE_COVER_5E.Settings.CoverScope.Hint",
    scope: "world",
    type: new foundry.data.fields.StringField({
      choices: {
        all: "SIMPLE_COVER_5E.Settings.CoverScope.Options.All",
        combatants: "SIMPLE_COVER_5E.Settings.CoverScope.Options.Combatants",
        players: "SIMPLE_COVER_5E.Settings.CoverScope.Options.Player"
      },
      initial: "combatants",
      required: true,
      blank: false,
      trim: true
    }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.ONLY_IN_COMBAT,
    name: "SIMPLE_COVER_5E.Settings.OnlyInCombat.Name",
    hint: "SIMPLE_COVER_5E.Settings.OnlyInCombat.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.RMV_ON_COMBAT,
    name: "SIMPLE_COVER_5E.Settings.RemoveOnCombat.Name",
    hint: "SIMPLE_COVER_5E.Settings.RemoveOnCombat.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: true }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.RMV_ON_MOVE,
    name: "SIMPLE_COVER_5E.Settings.RemoveOnMove.Name",
    hint: "SIMPLE_COVER_5E.Settings.RemoveOnMove.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.COVER_HINTS,
    name: "SIMPLE_COVER_5E.Settings.coverHints.Name",
    hint: "SIMPLE_COVER_5E.Settings.coverHints.Hint",
    scope: "world",
    type: new foundry.data.fields.StringField({
      choices: {
        none: "SIMPLE_COVER_5E.Settings.coverHints.Options.None",
        conditional: "SIMPLE_COVER_5E.Settings.coverHints.Options.Conditional",
        always: "SIMPLE_COVER_5E.Settings.coverHints.Options.Always"
      },
      initial: "conditional",
      required: true,
      blank: false,
      trim: true
    }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.COVER_HINTS_GM_MESSAGE,
    name: "SIMPLE_COVER_5E.Settings.coverHintsGmMessage.Name",
    hint: "SIMPLE_COVER_5E.Settings.coverHintsGmMessage.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.LOS_CHECK,
    name: "SIMPLE_COVER_5E.Settings.losCheck.Name",
    hint: "SIMPLE_COVER_5E.Settings.losCheck.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: true }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.CREATURES_HALF_ONLY,
    name: "SIMPLE_COVER_5E.Settings.CreaturesHalfOnly.Name",
    hint: "SIMPLE_COVER_5E.Settings.CreaturesHalfOnly.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.IGNORE_DISTANCE_AOE,
    name: "SIMPLE_COVER_5E.Settings.IgnoreDistanceAOE.Name",
    hint: "SIMPLE_COVER_5E.Settings.IgnoreDistanceAOE.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.IGNORE_ALL_AOE,
    name: "SIMPLE_COVER_5E.Settings.IgnoreAllAOE.Name",
    hint: "SIMPLE_COVER_5E.Settings.IgnoreAllAOE.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.IGNORE_DISTANCE_SPACE,
    name: "SIMPLE_COVER_5E.Settings.IgnoreDistanceSpace.Name",
    hint: "SIMPLE_COVER_5E.Settings.IgnoreDistanceSpace.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.IGNORE_FRIENDLY,
    name: "SIMPLE_COVER_5E.Settings.IgnoreFriendly.Name",
    hint: "SIMPLE_COVER_5E.Settings.IgnoreFriendly.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
    config: false
  },
  {
    key: SETTING_KEYS.CREATURES_PRONE,
    name: "SIMPLE_COVER_5E.Settings.CreaturesProne.Name",
    hint: "SIMPLE_COVER_5E.Settings.CreaturesProne.Hint",
    scope: "world",
    config: false,
    type: new foundry.data.fields.StringField({
      choices: {
        none: "SIMPLE_COVER_5E.Settings.CreaturesProne.Options.None",
        lowerSize: "SIMPLE_COVER_5E.Settings.CreaturesProne.Options.LowerSize",
        half: "SIMPLE_COVER_5E.Settings.CreaturesProne.Options.Half"
      },
      initial: "none",
      required: true,
      blank: false,
      trim: true
    }),
    requiresReload: false
  },
  {
    key: SETTING_KEYS.HOVER,
    name: "SIMPLE_COVER_5E.Settings.Hover.Name",
    hint: "SIMPLE_COVER_5E.Settings.Hover.Hint",
    scope: "world",
    config: true,
    type: new foundry.data.fields.StringField({
      choices: {
        off: "SIMPLE_COVER_5E.Settings.Hover.Options.Off",
        coverOnly: "SIMPLE_COVER_5E.Settings.Hover.Options.CoverOnly",
        coverAndDistance: "SIMPLE_COVER_5E.Settings.Hover.Options.CoverAndDistance"
      },
      initial: "coverAndDistance",
      required: true,
      blank: false,
      trim: true
    }),
    requiresReload: false
  },
  {
    key: SETTING_KEYS.HOVER_LABEL_POSITION,
    name: "SIMPLE_COVER_5E.Settings.HoverLabelPosition.Name",
    hint: "SIMPLE_COVER_5E.Settings.HoverLabelPosition.Hint",
    scope: "user",
    config: true,
    type: new foundry.data.fields.StringField({
      choices: {
        below: "SIMPLE_COVER_5E.Settings.HoverLabelPosition.Options.Below",
        above: "SIMPLE_COVER_5E.Settings.HoverLabelPosition.Options.Above",
        on: "SIMPLE_COVER_5E.Settings.HoverLabelPosition.Options.On",
      },
      initial: "below",
      required: true,
      blank: false,
      trim: true,
    }),
    requiresReload: false,
  },
  {
    key: SETTING_KEYS.HOVER_LABEL_Y_OFFSET,
    name: "SIMPLE_COVER_5E.Settings.HoverLabelYOffset.Name",
    hint: "SIMPLE_COVER_5E.Settings.HoverLabelYOffset.Hint",
    scope: "user",
    config: true,
    type: new foundry.data.fields.NumberField({
      initial: 0,
      required: false,
      nullable: false
    }),
    default: 0,
    requiresReload: false
  },
  {
    key: SETTING_KEYS.HOVER_LABEL_X_OFFSET,
    name: "SIMPLE_COVER_5E.Settings.HoverLabelXOffset.Name",
    hint: "SIMPLE_COVER_5E.Settings.HoverLabelXOffset.Hint",
    scope: "user",
    config: true,
    type: new foundry.data.fields.NumberField({
      initial: 0,
      required: false,
      nullable: false
    }),
    default: 0,
    requiresReload: false
  },
  {
    key: SETTING_KEYS.GRIDLESS_DISTANCE_MODE,
    name: "SIMPLE_COVER_5E.Settings.GridlessDistanceMode.Name",
    hint: "SIMPLE_COVER_5E.Settings.GridlessDistanceMode.Hint",
    scope: "world",
    config: false,
    type: new foundry.data.fields.StringField({
      choices: {
        edgeEdge: "SIMPLE_COVER_5E.Settings.GridlessDistanceMode.Options.EdgeEdge",
        edgeToCenter: "SIMPLE_COVER_5E.Settings.GridlessDistanceMode.Options.EdgeToCenter"
      },
      initial: "edgeToCenter",
      required: true,
      blank: false,
      trim: true
    }),
    requiresReload: false
  },
  {
    key: SETTING_KEYS.GRIDLESS_TOKEN_SHAPE,
    name: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.Name",
    hint: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.Hint",
    scope: "world",
    config: false,
    type: new foundry.data.fields.StringField({
      choices: {
        none: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.Options.None",
        square: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.Options.Square",
        circle: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.Options.Circle"
      },
      initial: "none",
      required: true,
      blank: false,
      trim: true
    }),
    requiresReload: false
  },
  {
    key: SETTING_KEYS.DEBUG,
    name: "SIMPLE_COVER_5E.Settings.Debug.Name",
    hint: "SIMPLE_COVER_5E.Settings.Debug.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    config: true,
    requiresReload: false,
    onChange: onDebugSettingChange
  },
  {
    key: SETTING_KEYS.INSET_ATTACKER,
    name: "SIMPLE_COVER_5E.Settings.insetAttacker.Name",
    hint: "SIMPLE_COVER_5E.Settings.insetAttacker.Hint",
    scope: "world",
    config: false,
    type: new foundry.data.fields.NumberField({
      initial: 1,
      required: true,
      nullable: false,
      min: 0,
      integer: true
    }),
    default: 1,
    requiresReload: false
  },
  {
    key: SETTING_KEYS.INSET_TARGET,
    name: "SIMPLE_COVER_5E.Settings.insetTarget.Name",
    hint: "SIMPLE_COVER_5E.Settings.insetTarget.Hint",
    scope: "world",
    config: false,
    type: new foundry.data.fields.NumberField({
      initial: 3,
      required: true,
      nullable: false,
      min: 0,
      integer: true
    }),
    default: 3,
    requiresReload: false
  },
  {
    key: SETTING_KEYS.INSET_OCCLUDER,
    name: "SIMPLE_COVER_5E.Settings.insetOccluder.Name",
    hint: "SIMPLE_COVER_5E.Settings.insetOccluder.Hint",
    scope: "world",
    config: false,
    type: new foundry.data.fields.NumberField({
      initial: 6,
      required: true,
      nullable: false,
      min: 0,
      integer: true
    }),
    default: 6,
    requiresReload: false
  },
  {
    key: SETTING_KEYS.FILTERED_TARGET_POINTS,
    name: "SIMPLE_COVER_5E.Settings.FilteredTargetPoints.Name",
    hint: "SIMPLE_COVER_5E.Settings.FilteredTargetPoints.Hint",
    scope: "world",
    config: false,
    type: new foundry.data.fields.StringField({
      choices: {
        blocked: "SIMPLE_COVER_5E.Settings.FilteredTargetPoints.Options.Blocked",
        clear: "SIMPLE_COVER_5E.Settings.FilteredTargetPoints.Options.Clear",
        dynamic: "SIMPLE_COVER_5E.Settings.FilteredTargetPoints.Options.Dynamic"
      },
      initial: "blocked",
      required: true,
      blank: false,
      trim: true
    }),
    requiresReload: false
  },
  {
    key: SETTING_KEYS.LIBRARY_MODE,
    name: "SIMPLE_COVER_5E.Settings.LibraryMode.Name",
    hint: "SIMPLE_COVER_5E.Settings.LibraryMode.Hint",
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    config: true,
    requiresReload: true,
  }
];

/**
 * Initialize module settings and setting-related hooks.
 *
 * @returns {void}
 */
export function initSettings() {
  registerSettings();
  Hooks.on("getSceneControlButtons", getSceneControlButtons);
}

/**
 * Register all module settings and configuration menus.
 *
 * @returns {void}
 */
function registerSettings() {
  for (const { key, ...data } of SETTINGS) {
    game.settings.register(MODULE_ID, key, data);
  }

  game.settings.registerMenu(MODULE_ID, "variantRulesMenu", {
    name: "SIMPLE_COVER_5E.Settings.VariantMenu.Name",
    label: "SIMPLE_COVER_5E.Settings.VariantMenu.Label",
    hint: "SIMPLE_COVER_5E.Settings.VariantMenu.Hint",
    icon: "fas fa-list-check",
    type: SimpleCoverVariantConfig,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, "AutomationMenu", {
    name: "SIMPLE_COVER_5E.Settings.AutomationMenu.Name",
    label: "SIMPLE_COVER_5E.Settings.AutomationMenu.Label",
    hint: "SIMPLE_COVER_5E.Settings.AutomationMenu.Hint",
    icon: "fa-solid fa-cogs",
    type: SimpleCoverAutomationConfig,
    restricted: true
  });
}

/**
 * Add the module tool to the Token controls for GMs.
 *
 * @function getSceneControlButtons
 * @memberof hookEvents
 * @param {Record<string, SceneControl>} controls The current scene control configuration.
 * @returns {void}
 */
function getSceneControlButtons(controls) {
  if (!game.user.isGM) return;
  controls.tokens.tools[MODULE_ID] = {
    name: MODULE_ID,
    title: "SIMPLE_COVER_5E.Controls.ClearCover.Title",
    icon: "fa-solid fa-shield-exclamation",
    onChange: (event, active) => clearSystemCoverEffects(),
    button: true
  };
}
