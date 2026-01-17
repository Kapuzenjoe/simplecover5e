import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.config.mjs";

const EXCLUDED_UNITS = new Set(["self", "touch", "special"]);
const EXCLUDED_TEMPLATE_TYPES = new Set(["", "radius"]);

/**
 * Resolve the effective cover level for an activity, including ignore-cover rules.
 *
 * @param {Activity5e} activity                      The activity being evaluated.
 * @param {"none"|"half"|"threeQuarters"|"total"} cover The computed/requested cover level.
 * @param {Actor5e|null} targetActor
 * @returns {{ cover: ("none"|"half"|"threeQuarters"|"total"), bonus: (number|null) }} The effective cover level and its corresponding bonus.
 *
 */
export function ignoresCover(activity, cover = "none", targetActor = null) {

  let effectiveCover = cover;

  const item = activity?.item;
  const sourceActor = activity?.actor;
  const actionType = activity?.actionType;
  const props = item?.system?.properties;
  const items = sourceActor?.items;
  const templateType = activity?.target?.template?.type ?? "";

  const upgradeOnce = (c) => {
    if (c === "half") return "threeQuarters";
    if (c === "threeQuarters") return "total";
    return c;
  };

  const upgradeTwice = (c) => {
    if (c === "half") return "total";
    return c;
  };

  const hasFeat = (name, identifier) => {
    return Boolean(
      items?.getName?.(name) ||
      items?.some(i => (i?.system?.identifier ?? "") === identifier)
    );
  };

  // ------------------------------------------------------------
  // 1) TARGET: Upgrade Cover
  // ------------------------------------------------------------
  if (targetActor) {
    const upgradeFlags = targetActor.flags?.simplecover5e?.upgradeCover;

    const upgrade = Math.max(
      Number(upgradeFlags?.all ?? 0),
      activity?.type === "attack" ? Number(upgradeFlags?.attack ?? 0) : 0,
      activity?.type === "save" ? Number(upgradeFlags?.save ?? 0) : 0
    );

    if (upgrade === 1) effectiveCover = upgradeOnce(effectiveCover);
    else if (upgrade === 2) effectiveCover = upgradeTwice(effectiveCover);
  }

  // ------------------------------------------------------------
  // 2) SOURCE ATTACK: Flags + Feats + Items
  // ------------------------------------------------------------
  if (activity?.type === "attack" && effectiveCover !== "none") {
    const ignoreFlags = sourceActor?.flags?.simplecover5e;

    if (ignoreFlags?.ignoreAllCover) {
      effectiveCover = "none";
    }
    else if (ignoreFlags?.ignoreThreeQuartersCover && (effectiveCover === "threeQuarters" || effectiveCover === "half")) {
      effectiveCover = "none";
    }
    else if (ignoreFlags?.ignoreHalfCover && effectiveCover === "half") {
      effectiveCover = "none";
    }

    if (effectiveCover !== "total") {
      if (actionType === "rwak" && hasFeat("Sharpshooter", "sharpshooter")) {
        effectiveCover = "none";
      }
      if (actionType === "rsak" && hasFeat("Spell Sniper", "spell-sniper")) {
        effectiveCover = "none";
      }
    }

    if (effectiveCover === "half" && (actionType === "rsak" || actionType === "msak")) {
      const wandIdentifier = new Set(["1-wand-of-the-war-mage", "wand-of-the-war-mage"]);
      const wand = items?.find(i =>
        /wand of the war mage/i.test(i?.name ?? "") ||
        wandIdentifier.has(i?.system?.identifier)
      );

      if (wand?.system?.equipped === true && wand?.system?.attuned === true) {
        effectiveCover = "none";
      }
    }
  }

  if (activity?.type === "save" && effectiveCover !== "none") {
    const sacredFlame = item?.name === "Sacred Flame" || item?.system?.identifier === "sacred-flame"
    if (effectiveCover !== "total" && sacredFlame) {
      effectiveCover = "none";
    }
  }

  // ------------------------------------------------------------
  // 3) SOURCE ITEM: ignoreCover
  // ------------------------------------------------------------
  if (effectiveCover !== "none" && props?.has?.("ignoreCover")) {
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
      const rangeValue = activity?.range?.value ?? 0;
      const rangeUnits = activity?.range?.units ?? "";

      if (
        rangeValue > 1 &&
        !EXCLUDED_UNITS.has(rangeUnits) &&
        !EXCLUDED_TEMPLATE_TYPES.has(templateType)
      ) {
        effectiveCover = "none";
      }
    }

    if (ignoreDistanceSpace) {
      const rangeValue = activity?.range?.value ?? 0;
      if (rangeValue > 1 && (activity?.target?.affects?.type ?? "") === "space") {
        effectiveCover = "none";
      }
    }
  }

  return { cover: effectiveCover, bonus: COVER.BONUS[effectiveCover] };
}