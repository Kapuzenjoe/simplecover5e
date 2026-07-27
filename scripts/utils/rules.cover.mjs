/**
 * @import { CoverLevel, CoverRuleFlagObject } from "../types/shared.types.mjs";
 */

import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.config.mjs";

const EXCLUDED_UNITS = new Set(["self", "touch", "special"]);
const EXCLUDED_TEMPLATE_TYPES = new Set(["", "radius"]);
const WAND_OF_THE_WAR_MAGE_IDENTIFIERS = new Set([
  "1-wand-of-the-war-mage",
  "wand-of-the-war-mage",
  "wand-of-the-war-mage-1",
  "wand-of-the-war-mage-2",
  "wand-of-the-war-mage-3"
]);

/**
 * Parse a cover-rule flag value from actor data.
 * Supports booleans, numbers, plain objects, and JSON-like object strings.
 *
 * @param {string|number|boolean|CoverRuleFlagObject|null|undefined} value The raw flag value.
 * @returns {string|number|boolean|CoverRuleFlagObject|null} The parsed flag value.
 */
const parseFlagValue = value => {
  if ((value == null) || (value === "")) return null;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  const number = Number(trimmed);
  if (!Number.isNaN(number)) return number;
  try {
    return JSON.parse(
      trimmed.replace(/([{,]\s*)([A-Za-z_]\w*)(\s*:)/g, '$1"$2"$3')
    );
  } catch {
    return value;
  }
};

/**
 * Resolve the effective cover level for an activity, including ignore-cover rules.
 *
 * @param {Activity5e} activity The activity being evaluated.
 * @param {CoverLevel} [cover="none"] The computed or requested cover level.
 * @param {Actor5e|null} [targetActor=null] The targeted actor, if any.
 * @returns {{ cover: CoverLevel, bonus: (0|2|5|null) }} The effective cover result.
 */
export function ignoresCover(activity, cover = "none", targetActor = null) {
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
  const templateType = activity?.target?.template?.type ?? "";

  const hasFeat = (name, identifier) => Boolean(
    items?.getName?.(name) || items?.some(i => (i?.system?.identifier ?? "") === identifier)
  );

  // ------------------------------------------------------------
  // 1) TARGET: Upgrade Cover
  // ------------------------------------------------------------
  const upgradeFlags = targetActor?.flags?.[MODULE_ID]?.upgradeCover;
  const targetStatuses = targetActor?.statuses;

  // `upgradeCover` improves the cover of the actor who has the flag.
  if (upgradeFlags) {
    const current = COVER.ORDER[effectiveCover] ?? COVER.ORDER.none;
    let upgrade = 0;

    for (const raw of [upgradeFlags.all, isAttack ? upgradeFlags.attack : isSave ? upgradeFlags.save : null]) {
      const value = parseFlagValue(raw)
      if (value == null) continue;
      if (typeof value?.condition === "string"
        && value.condition.trim() !== ""
        && !targetStatuses?.has(value.condition)
      ) continue;

      let parsed = 0;
      if (typeof value !== "object") {
        parsed = Number(value);
      }
      else {
        const min = COVER.ORDER[value.min ?? "none"] ?? COVER.ORDER.none;
        const max = COVER.ORDER[value.max ?? "total"] ?? COVER.ORDER.total;
        if ((current < Math.min(min, max)) || (current > Math.max(min, max))) continue;
        parsed = Number(value.steps);
      }

      if ((parsed === 1) || (parsed === 2)) upgrade = Math.max(upgrade, parsed);
    }

    if (upgrade) {
      effectiveCover = COVER.KEYS[Math.min(COVER.ORDER.total, current + upgrade)] ?? effectiveCover;
    }
  }

  // ------------------------------------------------------------
  // 2) SOURCE: downgrade / ignore cover
  // ------------------------------------------------------------
  if ((isAttack || isSave) && (effectiveCover !== "none")) {
    const current = COVER.ORDER[effectiveCover] ?? COVER.ORDER.none;
    const sourceStatuses = sourceActor?.statuses;
    let downgradeFlags = sourceFlags?.downgradeCover;
    let downgrade = 0;

    // `downgradeCover` reduces the target’s cover for actions made by the actor who has the flag.
    if (downgradeFlags) {
      for (const raw of [downgradeFlags.all, isAttack ? downgradeFlags.attack : isSave ? downgradeFlags.save : null]) {
        const value = parseFlagValue(raw)
        if (value == null) continue;
        if (typeof value?.condition === "string"
          && value.condition.trim() !== ""
          && !sourceStatuses?.has(value.condition)
        ) continue;

        let parsed = 0;
        if (typeof value !== "object") {
          parsed = Number(value);
        }
        else {
          const min = COVER.ORDER[value.min ?? "half"] ?? COVER.ORDER.half;
          const max = COVER.ORDER[value.max ?? "total"] ?? COVER.ORDER.total;
          if ((current < Math.min(min, max)) || (current > Math.max(min, max))) continue;
          parsed = Number(value.steps);
        }

        if ((parsed === 1) || (parsed === 2)) downgrade = Math.max(downgrade, parsed);
      }
    }

    if (downgrade) {
      effectiveCover = COVER.KEYS[Math.max(COVER.ORDER.none, current - downgrade)] ?? effectiveCover;
    }

    // `ignoreCover` ignores the target’s cover for actions made by the actor who has the flag.
    const ignoreType = isSave ? "save" : "attack";

    const ignoreAll = Boolean(
      sourceFlags?.ignoreAllCover?.all
      || sourceFlags?.ignoreAllCover?.[ignoreType]
      || (isAttack && sourceFlags?.ignoreAllCover === true)
    );

    const ignoreThreeQuarters = Boolean(
      sourceFlags?.ignoreThreeQuartersCover?.all
      || sourceFlags?.ignoreThreeQuartersCover?.[ignoreType]
      || (isAttack && sourceFlags?.ignoreThreeQuartersCover === true)
    );

    const ignoreHalf = Boolean(
      sourceFlags?.ignoreHalfCover?.all
      || sourceFlags?.ignoreHalfCover?.[ignoreType]
      || (isAttack && sourceFlags?.ignoreHalfCover === true)
    );

    if (ignoreAll) {
      effectiveCover = "none";
    }
    else if (ignoreThreeQuarters && ((effectiveCover === "threeQuarters") || (effectiveCover === "half"))) {
      effectiveCover = "none";
    }
    else if (ignoreHalf && (effectiveCover === "half")) {
      effectiveCover = "none";
    }

    if (isAttack && (effectiveCover !== "total")) {
      if ((actionType === "rwak") && hasFeat("Sharpshooter", "sharpshooter")) {
        effectiveCover = "none";
      }
      if ((actionType === "rsak") && hasFeat("Spell Sniper", "spell-sniper")) {
        effectiveCover = "none";
      }
    }

    if (isAttack && (effectiveCover === "half") && ((actionType === "rsak") || (actionType === "msak"))) {
      const wand = items?.find(i =>
        /wand of the war mage/i.test(i?.name ?? "") || WAND_OF_THE_WAR_MAGE_IDENTIFIERS.has(i?.system?.identifier)
      );

      if ((wand?.system?.equipped === true) && (wand?.system?.attuned === true)) {
        effectiveCover = "none";
      }
    }
  }

  if (isSave && (effectiveCover !== "none")) {
    const sacredFlame = item?.system?.identifier === "sacred-flame" || item?.name === "Sacred Flame";
    if (sacredFlame && (effectiveCover !== "total")) {
      effectiveCover = "none";
    }
  }

  // ------------------------------------------------------------
  // 3) SOURCE ITEM: ignoreCover property
  // ------------------------------------------------------------
  if ((effectiveCover !== "none") && properties?.has?.("ignoreCover")) {
    effectiveCover = "none";
  }

  // ------------------------------------------------------------
  // 4) SOURCE TEMPLATES: AoE / Distance / Space
  // ------------------------------------------------------------
  if (effectiveCover !== "none") {
    const ignoreAllAoe = game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_ALL_AOE);
    const ignoreDistanceAoe = game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_DISTANCE_AOE);
    const ignoreDistanceSpace = game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_DISTANCE_SPACE);

    if (ignoreAllAoe) {
      if (templateType !== "") effectiveCover = "none";
    }
    else if (ignoreDistanceAoe) {
      const rangeUnits = activity?.range?.units ?? "";

      if (
        !EXCLUDED_UNITS.has(rangeUnits)
        && !EXCLUDED_TEMPLATE_TYPES.has(templateType)
      ) {
        effectiveCover = "none";
      }
    }

    if (ignoreDistanceSpace) {
      const rangeValue = activity?.range?.value ?? 0;
      if ((rangeValue > 1) && ((activity?.target?.affects?.type ?? "") === "space")) {
        effectiveCover = "none";
      }
    }
  }

  return {
    cover: effectiveCover,
    bonus: COVER.BONUS[effectiveCover]
  };
}
