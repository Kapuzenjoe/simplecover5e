/**
 * @import { Position } from "../types/shared.types.mjs";
 */

import { MODULE_ID, SETTING_KEYS, COVER } from "../config/constants.config.mjs";

export function isLibraryMode() {
  if (game.settings.get(MODULE_ID, SETTING_KEYS.LIBRARY_MODE)) return true;

  const midi = game.modules.get("midi-qol")?.api ?? globalThis.MidiQOL;
  const coverCalculation =
    midi?.currentConfigSettings?.optionalRules?.coverCalculation ??
    midi?.configSettings?.()?.optionalRules?.coverCalculation;

  return coverCalculation === "simplecover5e";
}

/**
 * Check whether a token or actor has a player owner.
 *
 * @param {{token?: Token5e, actor?: Actor5e}} data The token and actor pair to evaluate.
 * @returns {boolean} True if the token or actor has a player owner.
 */
function isPlayerOwned({ token, actor }) {
  if (token?.hasPlayerOwner !== undefined) return token.hasPlayerOwner;
  return !!actor?.hasPlayerOwner;
}

/**
 * Resolve token/actor pairs for a cover update scope.
 * Supported scopes: "all", "combatants", and "players" (player-owned combatants).
 *
 * @param {Combat|null} combat The active combat, if any.
 * @param {"all"|"combatants"|"players"} scope The selection scope.
 * @returns {Array<{token: TokenDocument|null, actor: Actor|null}>} The resolved token and actor pairs.
 */
function resolveTokensForScope(combat, scope) {
  const combatScene =
    combat?.combatants?.find(c => c?.token?.parent)?.token?.parent
    ?? (typeof combat?.scene === "string" ? game.scenes.get(combat.scene) : combat?.scene)
    ?? null;
  const scene = combatScene ?? canvas?.scene;

  let targets = [];

  if (scope === "combatants") {
    const turns = combat?.turns ?? [];
    for (const c of turns) {
      const tokenDoc =
        c?.token
        ?? scene?.tokens?.get?.(c?.tokenId)
        ?? null;

      targets.push({ token: tokenDoc, actor: c?.actor ?? tokenDoc?.actor ?? null });
    }
  } else {
    const tokenDocs = scene?.tokens?.contents ?? [];
    for (const td of tokenDocs) {
      targets.push({ token: td, actor: td?.actor ?? null });
    }
  }

  if (scope === "players") {
    targets = targets.filter(isPlayerOwned);
  }
  return targets;
}

/**
 * Resolve the system cover status effects provided by dnd5e.
 *
 * @returns {{cover: ("half"|"threeQuarters"|"total"), statusId: string, effectId: string|null}[]} The available system cover effects.
 */
export function getSystemCoverEffects() {
  return [
    ["total", COVER.IDS.total],
    ["threeQuarters", COVER.IDS.threeQuarters],
    ["half", COVER.IDS.half]
  ].map(([cover, statusId]) => ({
    cover,
    statusId,
    effectId: CONFIG.statusEffects[statusId]._id
  }));
}

/**
 * Determine the highest active status and embedded cover states on an actor.
 *
 * @param {Actor5e} actor The actor to evaluate.
 * @returns {{statusCover: ("none"|"half"|"threeQuarters"|"total"), embeddedCover: ("none"|"half"|"threeQuarters"|"total")}} The resolved cover states.
 */
export function getActorCoverStates(actor) {
  const effects = actor?.appliedEffects ?? [];
  const systemCoverEffects = getSystemCoverEffects();

  let statusCover = "none";
  for (const { cover, statusId, effectId } of systemCoverEffects) {
    const isSystemStatus = actor?.statuses?.has?.(statusId) && effects.some(effect => effect.id === effectId);
    if (isSystemStatus) {
      statusCover = cover;
      break;
    }
  }

  let embeddedCover = "none";
  for (const effect of effects) {
    const isSystemEffect = systemCoverEffects.some(({ effectId }) => effect.id === effectId);
    if (isSystemEffect) continue;

    const statuses = effect?.statuses;
    if (!statuses?.has) continue;

    if (statuses.has(COVER.IDS.total)) {
      embeddedCover = "total";
      break;
    }
    if (statuses.has(COVER.IDS.threeQuarters) && (COVER.ORDER[embeddedCover] < COVER.ORDER.threeQuarters)) {
      embeddedCover = "threeQuarters";
    }
    if (statuses.has(COVER.IDS.half) && (COVER.ORDER[embeddedCover] < COVER.ORDER.half)) {
      embeddedCover = "half";
    }
  }

  return { statusCover, embeddedCover };
}

/**
 * Clear module-managed system cover effects for the configured scope.
 * This is typically called when combat state changes or at end-of-turn boundaries.
 *
 * @param {Combat|null} combat The active combat, if any.
 * @returns {Promise<void>} Resolves when all status toggles have settled.
 */
export async function clearSystemCoverEffects(combat) {
  const scope = game.settings.get(MODULE_ID, SETTING_KEYS.COVER_SCOPE);
  const targets = resolveTokensForScope(combat, scope);
  const systemCoverEffects = getSystemCoverEffects();
  const jobs = [];

  for (const { actor } of targets) {
    if (!actor) continue;

    for (const { statusId, effectId } of systemCoverEffects) {
      const hasSystemEffect = actor.statuses?.has?.(statusId) && actor.appliedEffects?.some(effect => effect.id === effectId);
      if (hasSystemEffect) {
        jobs.push(actor.toggleStatusEffect(statusId, { active: false, overlay: false }));
      }
    }
  }

  if (jobs.length) await Promise.allSettled(jobs);
}

export function isDefeatedToken(token) {
  if (!token) return false;

  const doc = token.document ?? token;
  if (!doc) return false;

  return doc.hasStatusEffect(CONFIG.specialStatusEffects.DEFEATED)
    || doc.combatant?.isDefeated === true;
}

/**
 * Determine whether a token should be treated as a blocking creature for cover and line-of-sight (LOS) occlusion.
 * Hidden, dead, or ethereal creatures are ignored.
 *
 * @param {Token5e|TokenDocument5e} token The token or token document to evaluate.
 * @returns {boolean} True if the token is considered blocking.
 */
export function isBlockingCreatureToken(token) {
  if (!token) return false;

  const doc = token.document ?? token;
  if (!doc || doc.hidden) return false;

  const actor = doc.actor ?? token.actor;
  if (!actor) return true;

  const statuses = actor?.statuses;
  if (!statuses) return true;

  if (isDefeatedToken(token)) return false;
  if (statuses.has("ethereal")) return false;
  if (actor.system?.attributes?.hp?.max === 0) return false;

  if (game.modules?.get?.("Rideable")?.active) {
    if (doc.flags?.Rideable?.RidersFlag?.length > 0) return false
  }

  return true;
}

/**
 * Get the creature height in grid distance units for a token document.
 *
 * @param {TokenDocument|Position} td The token document or a generic position.
 * @returns {number} The creature height in grid distance units, or 0.
 */
export function getCreatureHeight(td) {
  if (!td?.actor) return 0;
  const proneMode = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURES_PRONE);
  const grid = td?.parent?.grid ?? canvas?.scene?.grid;
  const depth = Number(td?.depth) || 0;
  const distance = Number(grid?.distance) || 0;
  let height = depth * distance;

  if (td.actor?.statuses?.has?.("prone") && proneMode !== "none") {
    if (proneMode === "half") {
      height *= 0.5;
    }
    else if (proneMode === "lowerSize") {
      const depthLower = (depth > 1) ? Math.max(depth - 1, 0.5) : (depth * 0.5);
      height = depthLower * distance;
    }
  }

  return height;
}

/**
 * Resolve the external token radius in pixels from document data.
 *
 * @param {Token|TokenDocument|Position} token The token, token document, or generic position.
 * @returns {number|null} The external radius in pixels, or null if it cannot be determined.
 */
export function getTokenExternalRadius(token) {
  const doc = token?.document ?? token;
  const size = doc?.getSize?.();
  if (!size) return null;

  const { width, height } = size;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  return Math.min(width, height) / 2;
}

/**
 * Check whether a token uses an ellipse shape.
 *
 * @param {TokenDocument|Position} tokenDoc The token document or generic position to evaluate.
 * @returns {boolean} True if the token uses an ellipse shape.
 */
export function isEllipse(tokenDoc) {
  return (
    tokenDoc?.shape === CONST.TOKEN_SHAPES.ELLIPSE_1 ||
    tokenDoc?.shape === CONST.TOKEN_SHAPES.ELLIPSE_2
  );
};

/**
 * Check whether the Wall Height module is active.
 *
 * @returns {boolean} True if the Wall Height module is currently active.
 */
export function isWallHeightModuleActive() {
  return game.modules?.get?.("wall-height")?.active === true;
}

/**
 * Update a newly created token shape on a gridless scene to match the current setting.
 *
 * @function createToken
 * @memberof hookEvents
 * @param {TokenDocument5e} td The created token document.
 * @param {object} options Additional workflow options.
 * @param {string} userId The initiating user's ID.
 * @returns {Promise<void>} Resolves after the token has been updated when needed.
 */
export async function onCreateToken(td, options, userId) {
  if (!td?.parent?.grid?.isGridless) return
  if (!game.user.isGM) return

  const shapeMode = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_TOKEN_SHAPE);

  const desiredShape =
    shapeMode === "square" ? CONST.TOKEN_SHAPES.RECTANGLE_1 :
      shapeMode === "circle" ? CONST.TOKEN_SHAPES.ELLIPSE_1 :
        null;

  if (desiredShape == null) return;
  if (td.shape === desiredShape) return;

  await td.update(
    { shape: desiredShape }
  );
}

/**
 * Globally update token shapes on all gridless scenes to match the configured setting.
 *
 * @returns {Promise<void>} Resolves after matching token shapes have been updated.
 */
export async function changeTokenShapeGlobal() {
  if (!game.user.isGM) return
  const shapeMode = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_TOKEN_SHAPE);

  for (const scene of game.scenes) {
    if (!scene.grid?.isGridless) continue;

    const desiredShape =
      shapeMode === "square" ? CONST.TOKEN_SHAPES.RECTANGLE_1 :
        shapeMode === "circle" ? CONST.TOKEN_SHAPES.ELLIPSE_1 :
          null;

    if (desiredShape == null) continue;

    const tokenDocs = scene.tokens.contents.filter(td => td.shape !== desiredShape);
    const updates = tokenDocs.map(td => ({ _id: td.id, shape: desiredShape }));
    await scene.updateEmbeddedDocuments("Token", updates);
  }
}
