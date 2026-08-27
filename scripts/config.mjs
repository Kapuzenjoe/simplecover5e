/**
 * @import { CoverConstants } from "./_types.mjs";
 */

/**
 * Simple Cover 5e module id.
 * @type {string}
 */
export const MODULE_ID = "simplecover5e";

/**
 * Message data path where per-target cover state is stored for the roll dialog and GM chat summary.
 * @type {string}
 */
export const COVER_TARGETS_PATH = `data.flags.${MODULE_ID}.targets`;

/**
 * Central cover constants.
 *
 * - IDS: maps cover levels to system effect ids (or null for none).
 * - BONUS: maps cover levels to AC/DEX bonus (null for total cover).
 * - ORDER: numeric ordering for comparing cover levels.
 * - I18N: localization keys used for cover labels and roll dialog hints.
 *
 * @readonly
 * @type {CoverConstants}
 */
export const COVER = Object.freeze({
  BONUS: Object.freeze({
    half: 2,
    none: 0,
    threeQuarters: 5,
    total: null
  }),
  I18N: Object.freeze({
    HINT_KEYS: Object.freeze({
      Attack: Object.freeze({
        half: "SIMPLE_COVER_5E.CoverHint.Attack.half",
        none: "SIMPLE_COVER_5E.CoverHint.Attack.none",
        threeQuarters: "SIMPLE_COVER_5E.CoverHint.Attack.threeQuarters",
        total: "SIMPLE_COVER_5E.CoverHint.Attack.total"
      }),
      Save: Object.freeze({
        half: "SIMPLE_COVER_5E.CoverHint.Save.half",
        none: "SIMPLE_COVER_5E.CoverHint.Save.none",
        threeQuarters: "SIMPLE_COVER_5E.CoverHint.Save.threeQuarters",
        total: "SIMPLE_COVER_5E.CoverHint.Save.total"
      })
    }),
    LABEL: {
      half: "EFFECT.DND5E.StatusHalfCover",
      none: "DND5E.None",
      threeQuarters: "EFFECT.DND5E.StatusThreeQuartersCover",
      total: "EFFECT.DND5E.StatusTotalCover"
    },
    LABEL_PREFIX_KEY: "DND5E.Cover"
  }),
  IDS: Object.freeze({
    half: "coverHalf",
    none: null,
    threeQuarters: "coverThreeQuarters",
    total: "coverTotal"
  }),
  KEYS: Object.freeze(["none", "half", "threeQuarters", "total"]),
  ORDER: Object.freeze({
    half: 1,
    none: 0,
    threeQuarters: 2,
    total: 3
  })
});

/**
 * Setting keys used by this module.
 * All settings are registered under {@link MODULE_ID} using these keys.
 *
 * @readonly
 * @enum {string}
 */
export const SETTING_KEYS = {
  COVER_HINTS: "coverHints",
  COVER_HINTS_GM_MESSAGE: "coverHintsGmMessage",
  COVER_SCOPE: "coverRemovalScope",
  CREATURES_HALF_ONLY: "creaturesHalfCoverOnly",
  CREATURES_PRONE: "proneCreatures",
  DEBUG: "debugCover",
  FILTERED_TARGET_POINTS: "filteredTargetPoints",
  GRIDLESS_DISTANCE_MODE: "gridlessDistanceMode", // Legacy
  GRIDLESS_TOKEN_SHAPE: "gridlessTokenShape", // Legacy
  HOVER: "hover",
  HOVER_LABEL_POSITION: "hoverLabelPosition",
  HOVER_LABEL_X_OFFSET: "hoverLabelXOffset",
  HOVER_LABEL_Y_OFFSET: "hoverLabelYOffset",
  IGNORE_ALL_AOE: "IgnoreAllAOE",
  IGNORE_AOE: "ignoreAOECover",
  IGNORE_DISTANCE_AOE: "IgnoreDistanceAOE",
  IGNORE_FRIENDLY: "ignoreFriendly",
  INSET_ATTACKER: "insetAttacker",
  INSET_OCCLUDER: "insetOccluder",
  INSET_TARGET: "insetTarget",
  LIBRARY_MODE: "libraryMode",
  LOS_CHECK: "losCheck",
  ONLY_IN_COMBAT: "onlyInCombat",
  RMV_ON_COMBAT: "rmvCovCombat",
  RMV_ON_MOVE: "rmvCovMovement"
};

/**
 * Constants related to hover labels and icons used by this module.
 *
 * @readonly
 * @type {{ DISTANCE_LABEL_PROP: string }}
 */
export const HOVER = {
  DISTANCE_LABEL_PROP: `_${MODULE_ID}HoverDistanceLabel`
};

const DAE_FLAG_SCOPES = Object.freeze(["all", "attack", "save"]);
const DAE_IGNORE_FLAGS = Object.freeze(["ignoreAllCover", "ignoreHalfCover", "ignoreThreeQuartersCover"]);
const DAE_RANGED_FLAGS = Object.freeze(["upgradeCover", "downgradeCover"]);
const DAE_FLAGS = Object.freeze([...DAE_IGNORE_FLAGS, ...DAE_RANGED_FLAGS]);

export const FLAGS = Object.freeze(
  Object.fromEntries(
    DAE_FLAGS.flatMap(flag => {
      return DAE_FLAG_SCOPES.map(scope => {
        const baseKey = `SIMPLE_COVER_5E.Flags.${flag}.${scope}`;
        return [
          `flags.${MODULE_ID}.${flag}.${scope}`,
          Object.freeze({
            hint: `${baseKey}.Hint`,
            name: `${baseKey}.Name`
          })
        ];
      });
    }
    )
  )
);
