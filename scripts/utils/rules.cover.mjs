import { MODULE_ID, COVER, SETTING_KEYS } from "../config/constants.config.mjs";

const EXCLUDED_UNITS = new Set(["self", "touch", "special"]);
const EXCLUDED_TEMPLATE_TYPES = new Set(["", "radius"]);
const WAND_OF_THE_WAR_MAGE_IDENTIFIERS = new Set(["1-wand-of-the-war-mage", "wand-of-the-war-mage"]);

/*
 
Enhanced Camouflage (Infiltrator 17): (cover Upgrade)
While benefiting from half cover, treat it as three-quarters cover; 
while benefiting from three-quarters cover, treat it as total cover.

Penetration Shot (Sniper / Marksman): (cover Downgrade)
Against a target with cover, treat total cover as three-quarters, three-quarters as half, and ignore half-cover.

Low Profile (Sniper): (cover Upgrade)
While prone, you gain half cover. If you are already behind half-cover, it becomes three-quarters cover;
if you are behind three-quarters cover, it becomes full cover.


 */




/**
 * Resolve the effective cover level for an activity, including ignore-cover rules.
 *
 * @param {Activity5e} activity                                   The activity being evaluated.
 * @param {"none"|"half"|"threeQuarters"|"total"} [cover="none"] The computed/requested cover level.
 * @param {Actor5e|null} [targetActor=null]
 * @returns {{ cover: ("none"|"half"|"threeQuarters"|"total"), bonus: (number|null) }} The effective cover level and its corresponding bonus.
 *
 */
export function ignoresCover(activity, cover = "none", targetActor = null) {
  let effectiveCover = cover;

  const type = activity?.type;
  const isAttack = type === "attack";
  const isSave = type === "save";

  const item = activity?.item;
  const sourceActor = activity?.actor;
  const sourceFlags = sourceActor?.flags?.simplecover5e;
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
  const upgradeFlags = targetActor?.flags?.simplecover5e?.upgradeCover;

  // `upgradeCover` improves the cover of the actor who has the flag.
  if (upgradeFlags) {
    const current = COVER.ORDER[effectiveCover] ?? COVER.ORDER.none;
    let upgrade = 0;

    for (const value of [upgradeFlags.all, isAttack ? upgradeFlags.attack : isSave ? upgradeFlags.save : null]) {
      if (value == null) continue;

      let parsed = 0;
      if (typeof value !== "object") {
        parsed = Number(value);
      }
      else {
        const min = COVER.ORDER[value.min ?? "none"] ?? COVER.ORDER.none;
        const max = COVER.ORDER[value.max ?? "total"] ?? COVER.ORDER.total;
        if ((current < Math.min(min, max)) || (current > Math.max(min, max))) continue;
        parsed = Number(value.upgrade);
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
    const downgradeFlags = sourceFlags?.downgradeCover;
    let downgrade = 0;

    // `downgradeCover` reduces the target’s cover for actions made by the actor who has the flag.
    if (downgradeFlags) {
      for (const value of [downgradeFlags.all, isAttack ? downgradeFlags.attack : isSave ? downgradeFlags.save : null]) {
        if (value == null) continue;

        let parsed = 0;
        if (typeof value !== "object") {
          parsed = Number(value);
        }
        else {
          const min = COVER.ORDER[value.min ?? "half"] ?? COVER.ORDER.half;
          const max = COVER.ORDER[value.max ?? "total"] ?? COVER.ORDER.total;
          if ((current < Math.min(min, max)) || (current > Math.max(min, max))) continue;
          parsed = Number(value.downgrade);
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
      const rangeValue = activity?.range?.value ?? 0;
      const rangeUnits = activity?.range?.units ?? "";

      if (
        (rangeValue > 1)
        && !EXCLUDED_UNITS.has(rangeUnits)
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