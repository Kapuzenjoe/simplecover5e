/**
 * @import { CoverLevel } from "./_types.mjs";
 */

/**
 * Simple Cover 5e module id.
 * @type {string}
 */
export const MODULE_ID = "simplecover5e";

/**
 * Central cover constants.
 *
 * - IDS: maps cover levels to system effect ids (or null for none).
 * - BONUS: maps cover levels to AC/DEX bonus (null for total cover).
 * - ORDER: numeric ordering for comparing cover levels.
 * - I18N: localization keys used for cover labels and roll dialog hints.
 *
 * @readonly
 * @type {{
 *   IDS: { none: null, half: string, threeQuarters: string, total: string },
 *   BONUS: { none: number, half: number, threeQuarters: number, total: (number|null) },
 *   ORDER: { none: number, half: number, threeQuarters: number, total: number },
 *   KEYS: CoverLevel[],
 *   I18N: {
 *     LABEL_PREFIX_KEY: string,
 *     LABEL: { none: string, half: string, threeQuarters: string, total: string },
 *     HINT_KEYS: {
 *       Attack: { none: string, half: string, threeQuarters: string, total: string },
 *       Save: { none: string, half: string, threeQuarters: string, total: string }
 *     }
 *   }
 * }}
 */
export const COVER = Object.freeze({
  IDS: Object.freeze({
    none: null,
    half: "coverHalf",
    threeQuarters: "coverThreeQuarters",
    total: "coverTotal"
  }),
  BONUS: Object.freeze({
    none: 0,
    half: 2,
    threeQuarters: 5,
    total: null
  }),
  ORDER: Object.freeze({
    none: 0,
    half: 1,
    threeQuarters: 2,
    total: 3
  }),
  KEYS: Object.freeze(["none", "half", "threeQuarters", "total"]),
  I18N: Object.freeze({
    LABEL_PREFIX_KEY: "DND5E.Cover",
    LABEL: {
      none: "DND5E.None",
      half: "EFFECT.DND5E.StatusHalfCover",
      threeQuarters: "EFFECT.DND5E.StatusThreeQuartersCover",
      total: "EFFECT.DND5E.StatusTotalCover"
    },
    HINT_KEYS: Object.freeze({
      Attack: Object.freeze({
        none: "SIMPLE_COVER_5E.CoverHint.Attack.none",
        half: "SIMPLE_COVER_5E.CoverHint.Attack.half",
        threeQuarters: "SIMPLE_COVER_5E.CoverHint.Attack.threeQuarters",
        total: "SIMPLE_COVER_5E.CoverHint.Attack.total"
      }),
      Save: Object.freeze({
        none: "SIMPLE_COVER_5E.CoverHint.Save.none",
        half: "SIMPLE_COVER_5E.CoverHint.Save.half",
        threeQuarters: "SIMPLE_COVER_5E.CoverHint.Save.threeQuarters",
        total: "SIMPLE_COVER_5E.CoverHint.Save.total"
      })
    })
  }),
});

/**
 * Setting keys used by this module.
 * All settings are registered under {@link MODULE_ID} using these keys.
 *
 * @readonly
 * @enum {string}
 */
export const SETTING_KEYS = {
  COVER_SCOPE: "coverRemovalScope",
  ONLY_IN_COMBAT: "onlyInCombat",
  RMV_ON_COMBAT: "rmvCovCombat",
  RMV_ON_MOVE: "rmvCovMovement",
  LOS_CHECK: "losCheck",
  CREATURES_HALF_ONLY: "creaturesHalfCoverOnly",
  IGNORE_DISTANCE_AOE: "IgnoreDistanceAOE",
  IGNORE_ALL_AOE: "IgnoreAllAOE",
  IGNORE_DISTANCE_SPACE: "IgnoreDistanceSpace",
  DEBUG: "debugCover",
  HOVER: "hover",
  LIBRARY_MODE: "libraryMode",
  HOVER_LABEL_POSITION: "hoverLabelPosition",
  HOVER_LABEL_Y_OFFSET: "hoverLabelYOffset",
  HOVER_LABEL_X_OFFSET: "hoverLabelXOffset",
  GRIDLESS_DISTANCE_MODE: "gridlessDistanceMode",
  GRIDLESS_TOKEN_SHAPE: "gridlessTokenShape",
  CREATURES_PRONE: "proneCreatures",
  INSET_ATTACKER: "insetAttacker",
  INSET_TARGET: "insetTarget",
  INSET_OCCLUDER: "insetOccluder",
  FILTERED_TARGET_POINTS: "filteredTargetPoints",
  COVER_HINTS: "coverHints",
  COVER_HINTS_GM_MESSAGE: "coverHintsGmMessage",
  IGNORE_FRIENDLY: "ignoreFriendly",
};

/**
 * Constants related to hover labels and icons used by this module.
 *
 * @readonly
 * @type {{DISTANCE_LABEL_PROP:string}}
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
    DAE_FLAGS.flatMap(flag =>
      DAE_FLAG_SCOPES.map(scope => {
        const baseKey = `SIMPLE_COVER_5E.Flags.${flag}.${scope}`;
        return [
          `flags.${MODULE_ID}.${flag}.${scope}`,
          Object.freeze({
            name: `${baseKey}.Name`,
            hint: `${baseKey}.Hint`
          })
        ];
      })
    )
  )
);
