import { MODULE_ID } from "./constants.config.mjs";

const SETTINGS = [
  {
    key: "coverRemovalScope",
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
    key: "rmvCovCombat",
    name: "Clear Cover on Combat Updates",
    hint: "Automatically remove the Cover condition on combat changes (turn/round/initiative), honoring the selected Cover Removal Scope.",
    type: new foundry.data.fields.BooleanField({ initial: true }),
    requiresReload: false,
  },
  {
    key: "rmvCovMovement",
    name: "Clear Cover on Token Movement (Combat Only)",
    hint: "Automatically remove the Cover condition when a token moves during active combat, honoring the selected Cover Removal Scope.",
    type: new foundry.data.fields.BooleanField({ initial: true }),
    requiresReload: false,
  },
  {
    key: "debugCover",
    name: "Show Cover Debug Lines",
    hint: "Draw helper lines while computing cover between tokens (for debugging/troubleshooting).",
    type: new foundry.data.fields.BooleanField({ initial: false }),
    requiresReload: false,
  },
];

export function registerSettings() {
  for (const { key, name, hint, type, requiresReload } of SETTINGS) {
    game.settings.register(MODULE_ID, key, {
      name,
      hint,
      scope: "world",
      config: true,
      type,
      requiresReload,
    });
  }
}
