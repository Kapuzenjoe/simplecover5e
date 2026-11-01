import { MODULE_ID, COVER, SHIM_FLAGS } from "../config.mjs";

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
 * Cover rules of features built into the module, in the shape of Active Effect changes. A rule only applies to
 * activities for which `isApplicable` returns true.
 * @type {Record<string, object>}
 */
const BUILT_IN_RULES = {
  sharpshooter: {
    type: "reduceTargetCover",
    value: 3,
    isApplicable: ({ actor }) => hasActorItem(actor?.items, "sharpshooter", "Sharpshooter"),
    conditions: [
      { k: "simplecover5e.cover", o: "in", v: ["half", "threeQuarters"] },
      { k: "roll.attack.type", v: "ranged" },
      { k: "roll.attack.classification", v: "weapon" }
    ]
  },
  spellSniper: {
    type: "reduceTargetCover",
    value: 3,
    isApplicable: ({ actor }) => hasActorItem(actor?.items, "spell-sniper", "Spell Sniper"),
    conditions: [
      { k: "simplecover5e.cover", o: "in", v: ["half", "threeQuarters"] },
      { k: "roll.attack.classification", v: "spell" }
    ]
  },
  wandOfTheWarMage: {
    type: "reduceTargetCover",
    value: 3,
    isApplicable: ({ actor }) => actor?.items?.some(i => {
      const isWand = WAND_OF_THE_WAR_MAGE_IDENTIFIERS.has(i?.identifier)
        || /wand of the war mage/i.test(i?.name ?? "");
      return isWand && (i.system?.equipped === true) && (i.system?.attuned === true);
    }) ?? false,
    conditions: [
      { k: "simplecover5e.cover", v: "half" },
      { k: "roll.attack.classification", v: "spell" }
    ]
  },
  sacredFlame: {
    type: "reduceTargetCover",
    value: 3,
    isApplicable: ({ item }) => (item?.identifier === "sacred-flame") || (item?.name === "Sacred Flame"),
    conditions: [
      { k: "simplecover5e.cover", o: "in", v: ["half", "threeQuarters"] },
      { k: "roll.type", v: "save" }
    ]
  }
};

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
 * @deprecated since Simple Cover 5e 2.3
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
 * Convert the legacy cover flags of an actor into rules.
 * @param {Actor5e|null} actor The actor holding the flags.
 * @param {string} type The rule type to convert the flags for.
 * @param {"d20"|"attack"|"save"} category The roll category.
 * @returns {object[]} The rules.
 * @deprecated since Simple Cover 5e 2.3
 */
function shimFlags(actor, type, category) {
  const rules = [];
  for ( const [name, shim] of Object.entries(SHIM_FLAGS) ) {
    if ( shim.type !== type ) continue;

    const flag = actor?.flags?.[MODULE_ID]?.[name];
    const scopes = (flag === true) ? { attack: true } : flag;
    for ( const scope of ["all", category] ) {
      const value = parseFlagValue(scopes?.[scope]);
      if ( !value ) continue;

      foundry.utils.logCompatibilityWarning(
        `The "${name}" flag has been deprecated and should be replaced by a "${MODULE_ID}.${type}" change.`,
        { since: "Simple Cover 5e 2.3", until: "Simple Cover 5e 3.0", once: true }
      );

      const { steps=shim.value ?? value, min, max=shim.max, condition } = (typeof value === "object") ? value : {};
      if ( (typeof condition === "string") && (condition.trim() !== "") && !actor.statuses?.has(condition) ) continue;

      const count = Number(steps);
      if ( !(count >= 1) ) continue;

      const lower = COVER.ORDER[min] ?? COVER.ORDER.none;
      const upper = COVER.ORDER[max] ?? COVER.ORDER[shim.max] ?? COVER.ORDER.total;
      rules.push({
        type,
        value: Math.min(shim.value ?? 2, count),
        conditions: [{
          k: "simplecover5e.cover",
          o: "in",
          v: COVER.KEYS.slice(Math.min(lower, upper), Math.max(lower, upper) + 1)
        }]
      });
    }
  }
  return rules;
}

/* -------------------------------------------- */

/**
 * Register the cover rules as active effect change types.
 */
export function initCoverRules() {
  const keyOptions = [
    { value: "d20", label: "DND5E.EFFECT.Change.Key.D20" },
    { value: "attack", label: "DND5E.EFFECT.Change.Key.Attack" },
    { value: "save", label: "DND5E.EFFECT.Change.Key.Save" }
  ];
  for ( const type of ["increaseOwnCover", "reduceTargetCover"] ) {
    CONFIG.ActiveEffect.changeTypes[`${MODULE_ID}.${type}`] = {
      label: `SIMPLE_COVER_5E.Rules.${type}.Label`,
      defaultPriority: 100,
      handler: dnd5e.documents.ActiveEffect5e._applyChangeRule,
      group: "SIMPLE_COVER_5E.Rules.Group",
      keyOptions,
      skipConditions: true
    };
  }
}

/* -------------------------------------------- */

/**
 * Resolve the effective cover level for an activity, including ignore-cover rules.
 * @param {Activity5e} activity The activity being evaluated.
 * @param {CoverLevel} [cover="none"] The computed or requested cover level.
 * @param {Actor5e|null} [targetActor=null] The targeted actor, if any.
 * @param {string} [attackMode=""] The attack mode of the roll, which can turn a melee attack into a ranged one.
 * @returns {{ cover: CoverLevel, bonus: (0|2|5|null) }} The effective cover result.
 */
export function ignoresCover(activity, cover="none", targetActor=null, attackMode="") {
  const { AppliedRules } = dnd5e.documents;
  const category = ["attack", "save"].includes(activity.type) ? activity.type : "d20";
  const rollData = activity.getRollData({ roll: { attackMode } });
  let effectiveCover = cover;

  const applyRules = (type, actor, item, direction) => {
    const data = {
      ...rollData,
      ...((actor !== activity.actor) ? actor?.getRollData() : null),
      [MODULE_ID]: { cover: effectiveCover }
    };
    const rules = [
      ...shimFlags(actor, type, category),
      ...Object.values(BUILT_IN_RULES).filter(rule => (rule.type === type) && rule.isApplicable(activity))
    ].map(rule => ({ ...rule, type: `${MODULE_ID}.${type}`, conditions: new dnd5e.Filter.Filter(rule.conditions) }));

    const steps = Math.trunc(AppliedRules
      .createIterator([...AppliedRules.collect(`${category}:${MODULE_ID}.${type}`, actor, item), ...rules])
      .filterWith(data)
      .toLargest(0));
    if ( !steps ) return;

    const order = Math.clamp(COVER.ORDER[effectiveCover] + (direction * steps), COVER.ORDER.none, COVER.ORDER.total);
    effectiveCover = COVER.KEYS[order];
  };

  applyRules("increaseOwnCover", targetActor, null, 1);
  if ( (category !== "d20") && (effectiveCover !== "none") ) {
    applyRules("reduceTargetCover", activity.actor, activity.item, -1);
  }

  // Source Item: ignoreCover Property
  if ( (effectiveCover !== "none") && activity.item?.system?.properties?.has?.("ignoreCover") ) {
    effectiveCover = "none";
  }

  return {
    bonus: COVER.BONUS[effectiveCover],
    cover: effectiveCover
  };
}
