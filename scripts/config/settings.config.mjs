import { MODULE_ID, DEFAULT_SIZE_FT, SETTING_KEYS } from "./constants.config.mjs";
import { SimpleCoverCreatureHeightsConfig } from "./menu.config.mjs";
import { clearCoverDebug } from "../services/cover.debug.mjs";

const SETTINGS = [
  {
    key: SETTING_KEYS.COVER_SCOPE,
    name: "Cover Removal Scope",
    hint: "Choose which tokens are affected when cover is cleared: everyone on the scene, only combatants, or player-owned tokens.",
    type: new foundry.data.fields.StringField({
      choices: {
        all: "All Tokens on Scene",
        combatants: "Combatants Only",
        players: "Player-Owned Tokens Only",
      },
      initial: "combatants",
      required: true,
      blank: false,
      trim: true,
    }),
    requiresReload: false,
  },
  {
    key: SETTING_KEYS.ONLY_IN_COMBAT,
    name: "Apply Cover Only In Combat",
    hint: "If enabled, automatic cover calculation only runs while a combat encounter is active.",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
  },
  {
    key: SETTING_KEYS.RMV_ON_COMBAT,
    name: "Clear Cover on Combat Updates",
    hint: "Automatically remove the Cover condition on combat changes (turn/round/initiative), honoring the selected Cover Removal Scope.",
    type: new foundry.data.fields.BooleanField({ initial: true }),
    requiresReload: false,
  },
  {
    key: SETTING_KEYS.RMV_ON_MOVE,
    name: "Clear Cover on Token Movement",
    hint: "Automatically remove the Cover condition when a token moves during active combat, honoring the selected Cover Removal Scope.",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
  },
  {
    key: SETTING_KEYS.CREATURES_HALF_ONLY,
    name: "Limit Cover from Creatures to 1/2 Cover",
    hint: "When enabled, creatures can grant at most Half Cover. As soon as at least one line is blocked purely by creatures, the target gains Half Cover, but never Three-Quarters Cover from creatures alone. Walls continue to follow the standard DMG rules.",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
  },
  {
    key: SETTING_KEYS.DEBUG,
    name: "Show Cover Debug Lines",
    hint: "Draw helper lines while computing cover between tokens (for debugging/troubleshooting).",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
    onChange: (value) => {
      if (value === false) {
        clearCoverDebug();
      }
    },
  },
  {
    key: SETTING_KEYS.CREATURE_HEIGHTS,
    name: "Default Creature Heights",
    hint: "Default creature heights (in feet) per size category used for 3D cover evaluation.",
    type: new foundry.data.fields.ObjectField({
      initial: DEFAULT_SIZE_FT,
    }),
    requiresReload: false,
    config: false,
  },
];

export function registerSettings() {
  for (const { key, name, hint, type, requiresReload, config = true, onChange } of SETTINGS) {
    game.settings.register(MODULE_ID, key, {
      name,
      hint,
      scope: "world",
      config,
      type,
      requiresReload,
      onChange,
    });
  }

  game.settings.registerMenu(MODULE_ID, "creatureHeightsMenu", {
    name: "Creature Heights",
    label: "Configure Creature Heights",
    hint: "Adjust default heights (in ft) for each creature size used when computing cover.",
    icon: "fas fa-ruler-vertical",
    type: SimpleCoverCreatureHeightsConfig,
    restricted: true,
  });
}
