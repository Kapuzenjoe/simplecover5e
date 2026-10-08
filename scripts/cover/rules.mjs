import { MODULE_ID, COVER } from "../config.mjs";

/**
 * @import { CoverLevel, CoverRuleFlagObject } from "../_types.mjs";
 */

const WAND_OF_THE_WAR_MAGE_IDENTIFIERS = new Set([
  "1-wand-of-the-war-mage",
  "wand-of-the-war-mage",
  "wand-of-the-war-mage-1",
  "wand-of-the-war-mage-2",
  "wand-of-the-war-mage-3"
]);

/**
 * Test actor items by system identifier first, with a name fallback for legacy/custom data.
 * @param {Collection<Item5e>|null} items The actor item collection.
 * @param {string} identifier The preferred system identifier.
 * @param {string} name The fallback item name.
 * @returns {boolean} Whether a matching item exists.
 */
function hasActorItem(items, identifier, name) {
  return Boolean(
    items?.some(i => (i?.identifier ?? "") === identifier)
    || items?.getName?.(name)
  );
}

/**
 * Parse a cover-rule flag value from actor data.
 * Supports booleans, numbers, plain objects, and JSON-like object strings.
 * @param {string|number|boolean|CoverRuleFlagObject|null|undefined} value The raw flag value.
 * @returns {string|number|boolean|CoverRuleFlagObject|null} The parsed flag value.
 */
function parseFlagValue(value) {
  if ( (value == null) || (value === "") ) return null;
  if ( typeof value !== "string" ) return value;

  const trimmed = value.trim();
  if ( trimmed === "" ) return null;
  if ( trimmed === "true" ) return true;
  if ( trimmed === "false" ) return false;

  const number = Number(trimmed);
  if ( !Number.isNaN(number) ) return number;
  try {
    return JSON.parse(
      trimmed.replace(/([{,]\s*)([A-Za-z_]\w*)(\s*:)/g, '$1"$2"$3')
    );
  } catch {
    return value;
  }
}

/* -------------------------------------------- */

/**
 * Resolve the number of cover steps granted by an upgrade or downgrade flag group.
 * @param {Record<string, string|number|boolean|CoverRuleFlagObject>|null|undefined} flags The flag group with
 *   `all`, `attack` and `save` values.
 * @param {object} options Resolution options.
 * @param {number} options.current The cover order the steps are applied to.
 * @param {"none"|"half"} options.defaultMin The lower bound used when a flag value omits `min`.
 * @param {boolean} options.isAttack Whether the activity is an attack.
 * @param {boolean} options.isSave Whether the activity is a saving throw.
 * @param {Set<string>|undefined} options.statuses The statuses of the actor tested against a flag `condition`.
 * @returns {number} The number of steps, from 0 to 2.
 */
function resolveSteps(flags, { current, defaultMin, isAttack, isSave, statuses }) {
  if ( !flags ) return 0;

  let steps = 0;
  for ( const raw of [flags.all, isAttack ? flags.attack : isSave ? flags.save : null] ) {
    const value = parseFlagValue(raw);
    if ( value == null ) continue;
    if ( (typeof value?.condition === "string")
      && (value.condition.trim() !== "")
      && !statuses?.has(value.condition)
    ) continue;

    let parsed = 0;
    if ( typeof value !== "object" ) {
      parsed = Number(value);
    }
    else {
      const min = COVER.ORDER[value.min ?? defaultMin] ?? COVER.ORDER[defaultMin];
      const max = COVER.ORDER[value.max ?? "total"] ?? COVER.ORDER.total;
      if ( (current < Math.min(min, max)) || (current > Math.max(min, max)) ) continue;
      parsed = Number(value.steps);
    }

    if ( parsed >= 1 ) steps = Math.max(steps, Math.min(2, parsed));
  }
  return steps;
}

/* -------------------------------------------- */

/**
 * Resolve the effective cover level for an activity, including ignore-cover rules.
 * @param {Activity5e} activity The activity being evaluated.
 * @param {CoverLevel} [cover="none"] The computed or requested cover level.
 * @param {Actor5e|null} [targetActor=null] The targeted actor, if any.
 * @returns {{ cover: CoverLevel, bonus: (0|2|5|null) }} The effective cover result.
 */
export function ignoresCover(activity, cover="none", targetActor=null) {
  let effectiveCover = cover;

  const type = activity?.type;
  const isAttack = type === "attack";
  const isSave = type === "save";

  const item = activity?.item;
  const sourceActor = activity?.actor;
  const sourceFlags = sourceActor?.flags?.[MODULE_ID];
  const items = sourceActor?.items;
  const actionType = activity?.actionType;
  const properties = item?.system?.properties;

  // Target: Upgrade Cover
  const upgradeFlags = targetActor?.getFlag(MODULE_ID, "upgradeCover");

  // `upgradeCover` improves the cover of the actor who has the flag.
  if ( upgradeFlags ) {
    const current = COVER.ORDER[effectiveCover] ?? COVER.ORDER.none;
    const upgrade = resolveSteps(upgradeFlags, {
      current,
      defaultMin: "none",
      isAttack,
      isSave,
      statuses: targetActor.statuses
    });

    if ( upgrade ) {
      effectiveCover = COVER.KEYS[Math.min(COVER.ORDER.total, current + upgrade)] ?? effectiveCover;
    }
  }

  // Source: Downgrade / Ignore Cover
  if ( (isAttack || isSave) && (effectiveCover !== "none") ) {
    const current = COVER.ORDER[effectiveCover] ?? COVER.ORDER.none;

    // `downgradeCover` reduces the target’s cover for actions made by the actor who has the flag.
    const downgrade = resolveSteps(sourceFlags?.downgradeCover, {
      current,
      defaultMin: "half",
      isAttack,
      isSave,
      statuses: sourceActor?.statuses
    });

    if ( downgrade ) {
      effectiveCover = COVER.KEYS[Math.max(COVER.ORDER.none, current - downgrade)] ?? effectiveCover;
    }

    // `ignoreCover` ignores the target’s cover for actions made by the actor who has the flag.
    const ignoreType = isSave ? "save" : "attack";

    const ignoreAll = Boolean(
      sourceFlags?.ignoreAllCover?.all
      || sourceFlags?.ignoreAllCover?.[ignoreType]
      || (isAttack && (sourceFlags?.ignoreAllCover === true))
    );

    const ignoreThreeQuarters = Boolean(
      sourceFlags?.ignoreThreeQuartersCover?.all
      || sourceFlags?.ignoreThreeQuartersCover?.[ignoreType]
      || (isAttack && (sourceFlags?.ignoreThreeQuartersCover === true))
    );

    const ignoreHalf = Boolean(
      sourceFlags?.ignoreHalfCover?.all
      || sourceFlags?.ignoreHalfCover?.[ignoreType]
      || (isAttack && (sourceFlags?.ignoreHalfCover === true))
    );

    if ( ignoreAll ) {
      effectiveCover = "none";
    }
    else if ( ignoreThreeQuarters && ((current === COVER.ORDER.threeQuarters) || (current === COVER.ORDER.half)) ) {
      effectiveCover = "none";
    }
    else if ( ignoreHalf && (current === COVER.ORDER.half) ) {
      effectiveCover = "none";
    }

    if ( isAttack && (effectiveCover !== "total") ) {
      if ( (actionType === "rwak") && hasActorItem(items, "sharpshooter", "Sharpshooter") ) {
        effectiveCover = "none";
      }
      if ( ((actionType === "rsak") || (actionType === "msak")) && hasActorItem(items, "spell-sniper", "Spell Sniper") ) {
        effectiveCover = "none";
      }
    }

    if ( isAttack && (effectiveCover === "half") && ((actionType === "rsak") || (actionType === "msak")) ) {
      const wand = items?.find(i => {
        return WAND_OF_THE_WAR_MAGE_IDENTIFIERS.has(i?.identifier) || /wand of the war mage/i.test(i?.name ?? "");
      }
      );

      if ( (wand?.system?.equipped === true) && (wand?.system?.attuned === true) ) {
        effectiveCover = "none";
      }
    }
  }

  if ( isSave && (effectiveCover !== "none") ) {
    const sacredFlame = (item?.identifier === "sacred-flame") || (item?.name === "Sacred Flame");
    if ( sacredFlame && (effectiveCover !== "total") ) {
      effectiveCover = "none";
    }
  }

  // Source Item: ignoreCover Property
  if ( (effectiveCover !== "none") && properties?.has?.("ignoreCover") ) {
    effectiveCover = "none";
  }

  return {
    bonus: COVER.BONUS[effectiveCover],
    cover: effectiveCover
  };
}
