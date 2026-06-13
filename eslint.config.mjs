import foundry from "@bytestruct/foundry-eslint";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "packs/"] },
  ...foundry.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,

        // Foundry VTT
        game: "readonly",
        canvas: "readonly",
        Hooks: "readonly",
        ui: "readonly",
        CONFIG: "readonly",
        CONST: "readonly",
        foundry: "readonly",
        Handlebars: "readonly",
        Dialog: "readonly",
        ChatMessage: "readonly",
        Actor: "readonly",
        Item: "readonly",
        ActiveEffect: "readonly",
        Roll: "readonly",
        TokenDocument: "readonly",
        Scene: "readonly",
        JournalEntry: "readonly",
        Macro: "readonly",
        RollTable: "readonly",
        loadTemplates: "readonly",
        renderTemplate: "readonly",
        fromUuid: "readonly",
        fromUuidSync: "readonly",
        getDocumentClass: "readonly"
      },
      sourceType: "module"
    }
  },
  {
    rules: {
      "foundry/sort-object-keys": "off"
    }
  }
];
