const SETTINGS = [
  {
    key: "debugCover",
    name: "Show debug cover lines",
    hint: "Show debug lines when calculating cover between tokens.",
    initial: false,
    reload: false,
  },
];

const { BooleanField, NumberField } = foundry.data.fields;

/**
 * Registers all settings defined in SETTINGS array.
 */
export function registerSettings() {
  SETTINGS.forEach(({ key, name, hint, reload }) => {
    game.settings.register("simplecover5e", key, {
      name,
      hint,
      scope: "world",
      config: true,
      type: new BooleanField({ initial: true }),
      requiresReload: reload,
    });
  });
}

