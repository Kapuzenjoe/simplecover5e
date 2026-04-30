import { MODULE_ID, SETTING_KEYS } from "../config/constants.mjs";

/**
 * Set a newly created token with the desired shape on a gridless scene.
 *
 * @function preCreateToken
 * @memberof hookEvents
 * @param {TokenDocument5e} td The token document being created.
 * @param {object} data The source data used to create the token.
 * @param {object} options Additional workflow options.
 * @param {string} userId The initiating user's ID.
 * @returns {void}
 */
export function onPreCreateToken(td, data, options, userId) {
  if (!td?.parent?.grid?.isGridless) return

  const shapeMode = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_TOKEN_SHAPE);

  const desiredShape =
    shapeMode === "square" ? CONST.TOKEN_SHAPES.RECTANGLE_1 :
      shapeMode === "circle" ? CONST.TOKEN_SHAPES.ELLIPSE_1 :
        null;

  if (desiredShape == null) return;
  if (td.shape === desiredShape) return;

  td.updateSource({ shape: desiredShape });
}

/**
 * Update existing token shapes on gridless scenes to match the configured setting.
 *
 * @param {object} [options] Additional update options.
 * @param {Scene|null} [options.scene=null] A specific scene to update, or null for all scenes.
 * @returns {Promise<number>} The number of updated tokens.
 */
export async function changeTokenShapes({ scene = null } = {}) {
  if (!game.user.isGM) return 0;
  const shapeMode = game.settings.get(MODULE_ID, SETTING_KEYS.GRIDLESS_TOKEN_SHAPE);
  const scenes = scene ? [scene] : game.scenes;
  let count = 0;

  for (const scene of scenes) {
    if (!scene.grid?.isGridless) continue;

    const desiredShape =
      shapeMode === "square" ? CONST.TOKEN_SHAPES.RECTANGLE_1 :
        shapeMode === "circle" ? CONST.TOKEN_SHAPES.ELLIPSE_1 :
          null;

    if (desiredShape == null) continue;

    const tokenDocs = scene.tokens.contents.filter(td => td.shape !== desiredShape);
    const updates = tokenDocs.map(td => ({ _id: td.id, shape: desiredShape }));
    count += updates.length;
    await scene.updateEmbeddedDocuments("Token", updates);
  }

  return count;
}
