import { MODULE_ID, COVER_STATUS_IDS, SETTING_KEYS } from "../config/constants.config.mjs";

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
 * Return true if cover should be skipped for this roll due to spell-specific rules.
 * @param {Activtiy5e} activity - The activity being evaluated for cover.
 * @returns {boolean} True if cover should be ignored, otherwise false.
 */
export function itemIgnoresCover(activity) {
  const item = activity?.item;
  const actor = activity?.actor;
  const actionType = activity?.actionType;
  const props = item?.system?.properties;
  const items = actor?.items;

  if (props?.has?.("ignoreCover")) return true;

  if (actionType === "rwak") {
    if (items?.getName("Sharpshooter") || items?.some(i => i.system?.identifier === "sharpshooter")) return true;
  }

  if (actionType === "rsak") {
    if (items?.getName("Spell Sniper") || items?.some(i => i.system?.identifier === "spell-sniper")) return true;
  }

  const templateType = activity?.target?.template?.type ?? "";

  if (game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_ALL_AOE)) {
    if (templateType !== "") return true;
  } else if (game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_DISTANCE_AOE)) {
    const rangeValue = activity?.range?.value ?? 0;
    const rangeUnits = activity?.range?.units ?? "";

    if (
      rangeValue > 1 &&
      !EXCLUDED_UNITS.has(rangeUnits) &&
      !EXCLUDED_TEMPLATE_TYPES.has(templateType)
    ) return true;
  }

  if (game.settings.get(MODULE_ID, SETTING_KEYS.IGNORE_DISTANCE_SPACE)) {
    const rangeValue = activity?.range?.value ?? 0;
    if (rangeValue > 1 && (activity?.target?.affects?.type ?? "") === "space") return true;
  }

  return false;
}