import { MODULE_ID, SETTING_KEYS } from "../config/constants.mjs";

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
