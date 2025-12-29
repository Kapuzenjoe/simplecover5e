import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.config.mjs";

const EXCLUDED_UNITS = new Set(["self", "touch", "special"]);
const EXCLUDED_TEMPLATE_TYPES = new Set(["", "radius"]);

/**
 * Resolve the effective cover level for an activity, including ignore-cover rules.
 *
 * @param {Activity5e} activity                      The activity being evaluated.
 * @param {"none"|"half"|"threeQuarters"|"total"} cover The computed/requested cover level.
 * @returns {{ cover: ("none"|"half"|"threeQuarters"|"total"), bonus: (number|null) }} The effective cover level and its corresponding bonus.
 *
 */
export function ignoresCover(activity, cover = "none") {
  // toDo: 
  // - activity props

  const item = activity?.item;
  const actor = activity?.actor;
  const actionType = activity?.actionType;
  const props = item?.system?.properties;
  const items = actor?.items;

  if (actor.flags?.simplecover5e?.ignoreAllCover) return { cover: "none", bonus: 0 };
  else if (actor.flags?.simplecover5e?.ignoreThreeQuartersCover && (cover === "threeQuarters" || cover === "half")) return { cover: "none", bonus: 0 };
  else if (actor.flags?.simplecover5e?.ignoreHalfCover && cover === "half") return { cover: "none", bonus: 0 };

  if (props?.has?.("ignoreCover")) return { cover: "none", bonus: 0 };

  if (actionType === "rwak" && cover !== "total") {
    if (items?.getName("Sharpshooter") || items?.some(i => i.system?.identifier === "sharpshooter")) return { cover: "none", bonus: 0 };
  }

  if (actionType === "rsak" && cover !== "total") {
    if (items?.getName("Spell Sniper") || items?.some(i => i.system?.identifier === "spell-sniper")) return { cover: "none", bonus: 0 };
  }

  if ((actionType === "rsak" || actionType === "msak") && cover === "half") {
    const wandIdentifier = new Set(["1-wand-of-the-war-mage", "wand-of-the-war-mage"]);
    const wand = items?.find(i =>
      /wand of the war mage/i.test(i?.name ?? "") ||
      wandIdentifier.has(i?.system?.identifier)
    );
    if (wand?.system?.equipped === true && wand?.system?.attuned === true) {
      return { cover: "none", bonus: 0 };
    }
  }

  const templateType = activity?.target?.template?.type ?? "";

  if (game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_ALL_AOE)) {
    if (templateType !== "") return { cover: "none", bonus: 0 };
  } else if (game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_DISTANCE_AOE)) {
    const rangeValue = activity?.range?.value ?? 0;
    const rangeUnits = activity?.range?.units ?? "";

    if (
      rangeValue > 1 &&
      !EXCLUDED_UNITS.has(rangeUnits) &&
      !EXCLUDED_TEMPLATE_TYPES.has(templateType)
    ) return { cover: "none", bonus: 0 };
  }

  if (game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_DISTANCE_SPACE)) {
    const rangeValue = activity?.range?.value ?? 0;
    if (rangeValue > 1 && (activity?.target?.affects?.type ?? "") === "space") return { cover: "none", bonus: 0 };
  }

  return { cover, bonus: COVER.BONUS[cover] };
}