import { SimpleCoverAutomationConfig } from "./applications/automation-settings.mjs";
import { SimpleCoverVariantConfig } from "./applications/variant-rules-settings.mjs";
import { MODULE_ID, SETTING_KEYS } from "./config.mjs";
import { clearCoverDebug } from "./cover/debug.mjs";
import { clearSystemCoverEffects } from "./cover/status.mjs";

/**
 * Clear cover debug graphics when debug rendering is disabled.
 *
 * @param {boolean} value The new debug setting value.
 * @returns {void}
 */
function onDebugSettingChange(value) {
  if ( value === false ) clearCoverDebug();
}

/**
 * Settings definitions for Simple Cover 5e.
 * These entries are registered under {@link MODULE_ID} by {@link registerSettings}.
 */
const SETTINGS = [
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.CoverScope.Hint",
    key: SETTING_KEYS.COVER_SCOPE,
    name: "SIMPLE_COVER_5E.Settings.CoverScope.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.StringField({
      blank: false,
      choices: {
        all: "SIMPLE_COVER_5E.Settings.CoverScope.Options.All",
        combatants: "SIMPLE_COVER_5E.Settings.CoverScope.Options.Combatants",
        players: "SIMPLE_COVER_5E.Settings.CoverScope.Options.Player"
      },
      initial: "combatants",
      required: true,
      trim: true
    })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.OnlyInCombat.Hint",
    key: SETTING_KEYS.ONLY_IN_COMBAT,
    name: "SIMPLE_COVER_5E.Settings.OnlyInCombat.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.RemoveOnCombat.Hint",
    key: SETTING_KEYS.RMV_ON_COMBAT,
    name: "SIMPLE_COVER_5E.Settings.RemoveOnCombat.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: true })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.RemoveOnMove.Hint",
    key: SETTING_KEYS.RMV_ON_MOVE,
    name: "SIMPLE_COVER_5E.Settings.RemoveOnMove.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.coverHints.Hint",
    key: SETTING_KEYS.COVER_HINTS,
    name: "SIMPLE_COVER_5E.Settings.coverHints.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.StringField({
      blank: false,
      choices: {
        always: "SIMPLE_COVER_5E.Settings.coverHints.Options.Always",
        conditional: "SIMPLE_COVER_5E.Settings.coverHints.Options.Conditional",
        none: "SIMPLE_COVER_5E.Settings.coverHints.Options.None"
      },
      initial: "conditional",
      required: true,
      trim: true
    })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.coverHintsGmMessage.Hint",
    key: SETTING_KEYS.COVER_HINTS_GM_MESSAGE,
    name: "SIMPLE_COVER_5E.Settings.coverHintsGmMessage.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.losCheck.Hint",
    key: SETTING_KEYS.LOS_CHECK,
    name: "SIMPLE_COVER_5E.Settings.losCheck.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: true })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.CreaturesHalfOnly.Hint",
    key: SETTING_KEYS.CREATURES_HALF_ONLY,
    name: "SIMPLE_COVER_5E.Settings.CreaturesHalfOnly.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.IgnoreAOECover.Hint",
    key: SETTING_KEYS.IGNORE_AOE,
    name: "SIMPLE_COVER_5E.Settings.IgnoreAOECover.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.StringField({
      blank: false,
      choices: {
        all: "SIMPLE_COVER_5E.Settings.IgnoreAOECover.Options.All",
        none: "SIMPLE_COVER_5E.Settings.IgnoreAOECover.Options.None",
        range: "SIMPLE_COVER_5E.Settings.IgnoreAOECover.Options.Range"
      },
      initial: "none",
      required: true,
      trim: true
    })
  },
  // Legacy — superseded by IGNORE_AOE; kept registered for migration in migration.mjs
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.IgnoreDistanceAOE.Hint",
    key: SETTING_KEYS.IGNORE_DISTANCE_AOE,
    name: "SIMPLE_COVER_5E.Settings.IgnoreDistanceAOE.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.IgnoreAllAOE.Hint",
    key: SETTING_KEYS.IGNORE_ALL_AOE,
    name: "SIMPLE_COVER_5E.Settings.IgnoreAllAOE.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.IgnoreDistanceSpace.Hint",
    key: SETTING_KEYS.IGNORE_DISTANCE_SPACE,
    name: "SIMPLE_COVER_5E.Settings.IgnoreDistanceSpace.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.IgnoreFriendly.Hint",
    key: SETTING_KEYS.IGNORE_FRIENDLY,
    name: "SIMPLE_COVER_5E.Settings.IgnoreFriendly.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.CreaturesProne.Hint",
    key: SETTING_KEYS.CREATURES_PRONE,
    name: "SIMPLE_COVER_5E.Settings.CreaturesProne.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.StringField({
      blank: false,
      choices: {
        half: "SIMPLE_COVER_5E.Settings.CreaturesProne.Options.Half",
        lowerSize: "SIMPLE_COVER_5E.Settings.CreaturesProne.Options.LowerSize",
        none: "SIMPLE_COVER_5E.Settings.CreaturesProne.Options.None"
      },
      initial: "none",
      required: true,
      trim: true
    })
  },
  {
    config: true,
    hint: "SIMPLE_COVER_5E.Settings.Hover.Hint",
    key: SETTING_KEYS.HOVER,
    name: "SIMPLE_COVER_5E.Settings.Hover.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.StringField({
      blank: false,
      choices: {
        coverAndDistance: "SIMPLE_COVER_5E.Settings.Hover.Options.CoverAndDistance",
        coverOnly: "SIMPLE_COVER_5E.Settings.Hover.Options.CoverOnly",
        off: "SIMPLE_COVER_5E.Settings.Hover.Options.Off"
      },
      initial: "coverAndDistance",
      required: true,
      trim: true
    })
  },
  {
    config: true,
    hint: "SIMPLE_COVER_5E.Settings.HoverLabelPosition.Hint",
    key: SETTING_KEYS.HOVER_LABEL_POSITION,
    name: "SIMPLE_COVER_5E.Settings.HoverLabelPosition.Name",
    requiresReload: false,
    scope: "user",
    type: new foundry.data.fields.StringField({
      blank: false,
      choices: {
        above: "SIMPLE_COVER_5E.Settings.HoverLabelPosition.Options.Above",
        below: "SIMPLE_COVER_5E.Settings.HoverLabelPosition.Options.Below",
        on: "SIMPLE_COVER_5E.Settings.HoverLabelPosition.Options.On"
      },
      initial: "below",
      required: true,
      trim: true
    })
  },
  {
    config: true,
    hint: "SIMPLE_COVER_5E.Settings.HoverLabelYOffset.Hint",
    key: SETTING_KEYS.HOVER_LABEL_Y_OFFSET,
    name: "SIMPLE_COVER_5E.Settings.HoverLabelYOffset.Name",
    requiresReload: false,
    scope: "user",
    type: new foundry.data.fields.NumberField({
      initial: 0,
      nullable: false,
      required: false
    })
  },
  {
    config: true,
    hint: "SIMPLE_COVER_5E.Settings.HoverLabelXOffset.Hint",
    key: SETTING_KEYS.HOVER_LABEL_X_OFFSET,
    name: "SIMPLE_COVER_5E.Settings.HoverLabelXOffset.Name",
    requiresReload: false,
    scope: "user",
    type: new foundry.data.fields.NumberField({
      initial: 0,
      nullable: false,
      required: false
    })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.GridlessDistanceMode.Hint",
    key: SETTING_KEYS.GRIDLESS_DISTANCE_MODE,
    name: "SIMPLE_COVER_5E.Settings.GridlessDistanceMode.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.StringField({
      blank: false,
      choices: {
        edgeEdge: "SIMPLE_COVER_5E.Settings.GridlessDistanceMode.Options.EdgeEdge",
        edgeToCenter: "SIMPLE_COVER_5E.Settings.GridlessDistanceMode.Options.EdgeToCenter"
      },
      initial: "edgeToCenter",
      required: true,
      trim: true
    })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.Hint",
    key: SETTING_KEYS.GRIDLESS_TOKEN_SHAPE,
    name: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.StringField({
      blank: false,
      choices: {
        circle: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.Options.Circle",
        none: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.Options.None",
        square: "SIMPLE_COVER_5E.Settings.GridlessTokenShape.Options.Square"
      },
      initial: "none",
      required: true,
      trim: true
    })
  },
  {
    config: true,
    hint: "SIMPLE_COVER_5E.Settings.Debug.Hint",
    key: SETTING_KEYS.DEBUG,
    name: "SIMPLE_COVER_5E.Settings.Debug.Name",
    onChange: onDebugSettingChange,
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.insetAttacker.Hint",
    key: SETTING_KEYS.INSET_ATTACKER,
    name: "SIMPLE_COVER_5E.Settings.insetAttacker.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.NumberField({
      initial: 1,
      integer: true,
      min: 0,
      nullable: false,
      required: true
    })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.insetTarget.Hint",
    key: SETTING_KEYS.INSET_TARGET,
    name: "SIMPLE_COVER_5E.Settings.insetTarget.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.NumberField({
      initial: 3,
      integer: true,
      min: 0,
      nullable: false,
      required: true
    })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.insetOccluder.Hint",
    key: SETTING_KEYS.INSET_OCCLUDER,
    name: "SIMPLE_COVER_5E.Settings.insetOccluder.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.NumberField({
      initial: 6,
      integer: true,
      min: 0,
      nullable: false,
      required: true
    })
  },
  {
    config: false,
    hint: "SIMPLE_COVER_5E.Settings.FilteredTargetPoints.Hint",
    key: SETTING_KEYS.FILTERED_TARGET_POINTS,
    name: "SIMPLE_COVER_5E.Settings.FilteredTargetPoints.Name",
    requiresReload: false,
    scope: "world",
    type: new foundry.data.fields.StringField({
      blank: false,
      choices: {
        blocked: "SIMPLE_COVER_5E.Settings.FilteredTargetPoints.Options.Blocked",
        clear: "SIMPLE_COVER_5E.Settings.FilteredTargetPoints.Options.Clear",
        dynamic: "SIMPLE_COVER_5E.Settings.FilteredTargetPoints.Options.Dynamic"
      },
      initial: "blocked",
      required: true,
      trim: true
    })
  },
  {
    config: true,
    hint: "SIMPLE_COVER_5E.Settings.LibraryMode.Hint",
    key: SETTING_KEYS.LIBRARY_MODE,
    name: "SIMPLE_COVER_5E.Settings.LibraryMode.Name",
    requiresReload: true,
    scope: "world",
    type: new foundry.data.fields.BooleanField({ initial: false })
  }
];

/* -------------------------------------------- */

/**
 * Initialize module settings and setting-related hooks.
 *
 * @returns {void}
 */
export function initSettings() {
  registerSettings();
  Hooks.on("getSceneControlButtons", getSceneControlButtons);
}

/* -------------------------------------------- */

/**
 * Add the module tool to the Token controls for GMs.
 *
 * @function getSceneControlButtons
 * @memberof hookEvents
 * @param {Record<string, SceneControl>} controls The current scene control configuration.
 * @returns {void}
 */
function getSceneControlButtons(controls) {
  if ( !game.user.isGM ) return;
  controls.tokens.tools[MODULE_ID] = {
    button: true,
    icon: "fa-solid fa-shield-exclamation",
    name: MODULE_ID,
    onChange: (event, active) => clearSystemCoverEffects(),
    title: "SIMPLE_COVER_5E.Controls.ClearCover.Title"
  };
}

/* -------------------------------------------- */

/**
 * Register all module settings and configuration menus.
 *
 * @returns {void}
 */
function registerSettings() {
  for ( const { key, ...data } of SETTINGS ) {
    game.settings.register(MODULE_ID, key, data);
  }

  game.settings.registerMenu(MODULE_ID, "variantRulesMenu", {
    hint: "SIMPLE_COVER_5E.Settings.VariantMenu.Hint",
    icon: "fas fa-list-check",
    label: "SIMPLE_COVER_5E.Settings.VariantMenu.Label",
    name: "SIMPLE_COVER_5E.Settings.VariantMenu.Name",
    restricted: true,
    type: SimpleCoverVariantConfig
  });

  game.settings.registerMenu(MODULE_ID, "AutomationMenu", {
    hint: "SIMPLE_COVER_5E.Settings.AutomationMenu.Hint",
    icon: "fa-solid fa-cogs",
    label: "SIMPLE_COVER_5E.Settings.AutomationMenu.Label",
    name: "SIMPLE_COVER_5E.Settings.AutomationMenu.Name",
    restricted: true,
    type: SimpleCoverAutomationConfig
  });
}
