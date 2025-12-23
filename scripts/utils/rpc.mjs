import { MODULE_ID, COVER_STATUS_IDS, COVER_BONUS_BY_ID, SETTING_KEYS } from "../config/constants.config.mjs";

const EXCLUDED_UNITS = new Set(["self", "touch", "special"]);
const EXCLUDED_TEMPLATE_TYPES = new Set(["", "radius"]);


/**
 * Toggle a cover status effect on an actor over the GM socket.
 *
 * @param {string} actorUuid - UUID of the actor whose effect should be toggled.
 * @param {string} effectId  - ID of the effect to toggle on the actor.
 * @param {boolean} enable   - Whether the effect should be enabled (true) or disabled (false).
 * @returns {Promise<boolean>} Resolves to true on success, otherwise false.
 */
export async function toggleCoverEffectViaGM(actorUuid, effectId, enable) {
  const gm = game.users.activeGM;
  if (!gm) { console.warn(`[${MODULE_ID}] no active GM`); return false; }

  try {
    const res = await gm.query(`${MODULE_ID}.toggleCover`, { actorUuid, effectId, enable }, { timeout: 8000 });
    return !!res?.ok;
  } catch (e) {
    console.warn(`[${MODULE_ID}] GM query failed:`, e);
    return false;
  }
}

/**
 * Determine whether a token should be treated as a blocking creature for cover.
 *
 * @param {Token5e|Token} token - Token to evaluate for cover occlusion.
 * @returns {boolean} True if the token is considered blocking, otherwise false.
 */
export function isBlockingCreatureToken(token) {
  if (!token) return false;

  const doc = token.document;
  if (!doc || doc.hidden) return false;
  if (!token.visible) return false;

  const actor = token.actor;
  if (!actor) return true;

  const statuses = actor?.statuses;
  if (!statuses) return true;

  if (statuses.has("ethereal")) return false;
  if (statuses.has("dead")) return false;
  if (actor.system?.attributes?.hp?.max === 0) return false;

  return true;
}

/**
 * Checks whether cover should be ignored for the given activity and returns
 * the effective cover id plus its associated bonus.
 *
 * @param {Activity5e} activity - The activity being evaluated for cover.
 * @param {string|null} coverId - The requested cover status effect id (e.g. "coverHalf") or null for none.
 * @returns {{ coverId: (string|null), bonus: number }} The effective cover id and its corresponding bonus.
 */
export function itemIgnoresCover(activity, coverId = COVER_STATUS_IDS.none) {
  // toDo: 
  // - automated Wand of the War Mage 
  // - flags on actors
  // - activity props

  const item = activity?.item;
  const actor = activity?.actor;
  const actionType = activity?.actionType;
  const props = item?.system?.properties;
  const items = actor?.items;

  if (props?.has?.("ignoreCover")) return { coverId: COVER_STATUS_IDS.none, bonus: 0 };

  if (actionType === "rwak" && coverId !== COVER_STATUS_IDS.total) {
    if (items?.getName("Sharpshooter") || items?.some(i => i.system?.identifier === "sharpshooter")) return { coverId: COVER_STATUS_IDS.none, bonus: 0 };
  }

  if (actionType === "rsak" && coverId !== COVER_STATUS_IDS.total) {
    if (items?.getName("Spell Sniper") || items?.some(i => i.system?.identifier === "spell-sniper")) return { coverId: COVER_STATUS_IDS.none, bonus: 0 };
  }

  const templateType = activity?.target?.template?.type ?? "";

  if (game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_ALL_AOE)) {
    if (templateType !== "") return { coverId: COVER_STATUS_IDS.none, bonus: 0 };
  } else if (game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_DISTANCE_AOE)) {
    const rangeValue = activity?.range?.value ?? 0;
    const rangeUnits = activity?.range?.units ?? "";

    if (
      rangeValue > 1 &&
      !EXCLUDED_UNITS.has(rangeUnits) &&
      !EXCLUDED_TEMPLATE_TYPES.has(templateType)
    ) return { coverId: COVER_STATUS_IDS.none, bonus: 0 };
  }

  if (game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_DISTANCE_SPACE)) {
    const rangeValue = activity?.range?.value ?? 0;
    if (rangeValue > 1 && (activity?.target?.affects?.type ?? "") === "space") return { coverId: COVER_STATUS_IDS.none, bonus: 0 };
  }

  return { coverId, bonus: COVER_BONUS_BY_ID.get(coverId) };
}