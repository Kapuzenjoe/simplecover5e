import { MODULE_ID, SETTING_KEYS, COVER, BASE_KEYS } from "../config/constants.config.mjs";

/**
 * Check whether a token/actor is player-owned.
 *
 * @param {{ token?: Token5e, actor?: Actor5e }} param0               The token/actor pair to evaluate.
 * @returns {boolean}                                                True if the token/actor has a player owner.
 */
function isPlayerOwned({ token, actor }) {
  if (token?.hasPlayerOwner !== undefined) return token.hasPlayerOwner;
  return !!actor?.hasPlayerOwner;
}

/**
 * Resolve token/actor pairs for a cover update scope.
 * Supported scopes: "all", "combatants", and "players" (player-owned combatants).
 *
 * @param {Combat|null} combat                     The active combat, if any.
 * @param {"all"|"combatants"|"players"} scope     The selection scope.
 * @returns {Array<{ token: TokenDocument|null, actor: Actor|null }>} The resolved token/actor pairs.
 */
function resolveTokensForScope(combat, scope) {
  const scene = canvas?.scene

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
 * Clear all cover status effects for the configured scope.
 * This is typically called when combat state changes or at end-of-turn boundaries.
 *
 * @param {Combat|null} combat                      The active combat, if any.
 * @returns {Promise<void>}                         Resolves when all toggles have settled.
 */
export async function clearCoverStatusEffect(combat) {

  const scope = game.settings.get(MODULE_ID, SETTING_KEYS.COVER_SCOPE);
  const targets = resolveTokensForScope(combat, scope);

  const ids = Object.values(COVER.IDS).filter(Boolean);
  const jobs = [];

  for (const { actor } of targets) {
    if (!actor) continue;

    for (const id of ids) {

      if (actor.statuses?.has?.(id)) {
        jobs.push(actor.toggleStatusEffect(id));
      }
    }
  }

  if (jobs.length) await Promise.allSettled(jobs);
}

/**
 * Determine whether a token should be treated as a blocking creature for cover and LoS occlusion.
 * Hidden, invisible, dead, or ethereal creatures are ignored.
 *
 * @param {Token5e} token                           The token to evaluate.
 * @returns {boolean}                               True if the token is considered blocking; otherwise false.
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

  if (game.modules?.get?.("Rideable")?.active) {
    if (doc.flags?.Rideable?.RidersFlag?.length > 0) return false
  }

  return true;
}

/**
 * Get the creature height in gridSize for a token document.
 * If wall-height is active, the token's LoS height is used when available.
 *
 * @param {TokenDocument|Position} td             The token document OR a generic position {x,y,elevation?}.
 * @returns {number}                              The creature height in grid distance units or 0.
 */
export function getCreatureHeight(td) {
  if (!td?.actor) return 0;
  const proneMode = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURES_PRONE);
  const savedCreatureHeights = game.settings.get(MODULE_ID, SETTING_KEYS.CREATURE_HEIGHTS) ?? {};
  const grid = td?.parent?.grid ?? canvas?.scene?.grid;
  const depth = Number(td?.depth) || 0;
  const distance = Number(grid?.distance) || 0;
  const sizeKey = td?.actor?.system?.traits?.size || null;

  let height = 0;

  if (isV14()) {
    height = depth * distance;
  }
  else if (isWallHeightModuleActive()) {
    const elevation = Number(td?.elevation) || 0;
    const losHeight = td?.object ? Number(td?.object?.losHeight) : NaN;

    if (Number.isFinite(losHeight)) {
      const diff = losHeight - elevation;
      if (diff > 0) {
        height = Math.ceil(diff * 100) / 100;
      }
    }
  }
  else {
    height = savedCreatureHeights[sizeKey] || 0;
  }

  if (td.actor?.statuses?.has?.("prone") && proneMode !== "none") {
    if (proneMode === "half") {
      height *= 0.5;
    }
    else if (proneMode === "lowerSize") {
      if (isV14()) {
        const depthLower = (depth > 1) ? Math.max(depth - 1, 0.5) : (depth * 0.5);
        height = depthLower * distance;
      }
      else if (!isWallHeightModuleActive()) {
        const idx = BASE_KEYS.indexOf(sizeKey);
        const smallerKey = idx > 0 ? BASE_KEYS[idx - 1] : sizeKey;
        height = savedCreatureHeights[smallerKey] || 0;
      }
      else {
        height *= 0.5;
      }
    }
  }
  return height;
}

/**
 * Check whether the current Foundry version is 14 or higher.
 * 
 * @returns {boolean}       true if the current Foundry version is 14 or higher. 
 */
export function isV14() {
  return game.release.generation >= 14;
}

/**
 * Check if a token has an ellipse shape.
 * @param {TokenDocument} tokenDoc 
 * @returns {boolean} 
 */
export function isEllipse(tokenDoc) {
  return (
    tokenDoc?.shape === CONST.TOKEN_SHAPES.ELLIPSE_1 ||
    tokenDoc?.shape === CONST.TOKEN_SHAPES.ELLIPSE_2
  );
};

/**
 * Check whether the wall-height module is active.
 *
 * @returns {boolean}                              True if the wall-height module is currently active.
 */
export function isWallHeightModuleActive() {
  return game.modules?.get?.("wall-height")?.active === true;
}

/** 
 * Sets the shape of newly created tokens on gridless scenes to match the configured setting.
 * 
 * @function createToken
 * @memberof hookEvents
 * @param {TokenDocument5e} td      The token being deleted
 * @param {Object} options          Additional options
 * @param {String} userId           The initiating User's ID
 */
export async function onCreateToken(td, options, userId) {
  if (!td?.shape) return
  if (!td?.scene?.grid?.isGridless) return
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