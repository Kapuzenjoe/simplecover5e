import { getCover } from "../api.mjs";
import { MODULE_ID, SETTING_KEYS, COVER } from "../config.mjs";

import { getTokenTokenDistance } from "./distance.mjs";

const hoverLabels = new Map();

const refreshTargetLabelsDebounced = foundry.utils.debounce(() => refreshTargetLabels(), 0);

/**
 * Update the hover UI for a hovered token.
 * @param {Token5e} token The hovered token.
 * @returns {Promise<void>} Resolves after the hover decorations have been updated.
 */
export function onHoverToken(token) {
  return refreshTokenLabel(token);
}

/* -------------------------------------------- */

/**
 * Update the label of a token based on the single controlled token.
 * The output is client-side only and controlled by the hover setting.
 * @see Foundry-Core — TokenRuler#_getWaypointLabelContext()
 * @param {Token5e} token The hovered or targeted token.
 * @returns {Promise<void>} Resolves after the label has been updated.
 */
async function refreshTokenLabel(token) {
  if ( !token ) return;

  const hoverMode = game.settings.get(MODULE_ID, SETTING_KEYS.HOVER);
  const actorToken = getLabelSource(token);

  if ( !actorToken || (hoverMode === "off") ) {
    removeHoverDecorations(token);
    return;
  }

  let coverKey = "";
  if ( (hoverMode === "coverOnly") || (hoverMode === "coverAndDistance") ) {
    const result = getCover({
      attacker: actorToken,
      debug: false,
      includeEmbeddedCover: true,
      scene: token.scene,
      target: token
    });

    if ( result?.cover !== "none" ) {
      coverKey = result?.cover || "";
    }
  }

  const showCoverIcon = !!coverKey;

  let distanceText = "";
  let units = "";
  if ( hoverMode === "coverAndDistance" ) {
    const distance = getTokenTokenDistance(
      actorToken.document,
      token.document
    );

    if ( !Number.isFinite(distance) ) {
      removeHoverDecorations(token);
      return;
    }

    units = token?.scene?.grid?.units ?? "";
    distanceText = distance.toLocaleString(game.i18n.lang);
  }

  const showDistance = (hoverMode === "coverAndDistance") && !!distanceText;

  if ( !showCoverIcon && !showDistance ) {
    removeHoverDecorations(token);
    return;
  }

  const measurementHud = document.querySelector("#hud #measurement");
  if ( !measurementHud ) {
    removeHoverDecorations(token);
    return;
  }

  const uiScale = canvas.dimensions.uiScale;
  let htmlLabel;

  if ( showDistance ) {
    const rendered = await foundry.applications.handlebars.renderTemplate(
      "templates/hud/waypoint-label.hbs",
      {
        uiScale,
        units,
        action: { icon: "fa-solid fa-ruler" },
        cssClass: "hover-distance-label",
        distance: { total: distanceText }
      }
    );
    if ( getLabelSource(token) !== actorToken ) return;
    htmlLabel = foundry.utils.parseHTML(rendered);
  }
  else {
    htmlLabel = document.createElement("div");
    htmlLabel.classList.add("waypoint-label", "hover-distance-label");
  }

  if ( showCoverIcon ) {
    const iconPath = CONFIG.statusEffects[COVER.IDS[coverKey]].img;
    const coverIcon = document.createElement("span");
    coverIcon.classList.add("img");
    coverIcon.style.backgroundImage = `url("${iconPath}")`;
    htmlLabel.append(coverIcon);
  }

  removeHoverDecorations(token);
  measurementHud.appendChild(htmlLabel);
  hoverLabels.set(token.id, htmlLabel);

  const center = token.center ?? { x: token.x, y: token.y };

  let posX = center.x;
  let posY = center.y;

  const positionSetting = game.settings.get(MODULE_ID, SETTING_KEYS.HOVER_LABEL_POSITION);
  const extraYOffset = Number(
    game.settings.get(MODULE_ID, SETTING_KEYS.HOVER_LABEL_Y_OFFSET) ?? 0
  );
  const extraXOffset = Number(
    game.settings.get(MODULE_ID, SETTING_KEYS.HOVER_LABEL_X_OFFSET) ?? 0
  );

  htmlLabel.style.setProperty("--transformX", "-50%");

  switch ( positionSetting ) {
    case "above": {
      posY = center.y - (token.h * 0.5) - (16 * uiScale);
      htmlLabel.style.setProperty("--transformY", "-100%");
      break;
    }
    case "on": {
      posY = center.y;
      htmlLabel.style.setProperty("--transformY", "-50%");
      break;
    }
    case "below":
    default: {
      posY = center.y + (token.h * 0.5) + (16 * uiScale);
      htmlLabel.style.setProperty("--transformY", "0%");
      break;
    }
  }

  posY += extraYOffset;
  posX += extraXOffset;

  htmlLabel.style.setProperty("--position-x", `${posX}px`);
  htmlLabel.style.setProperty("--position-y", `${posY}px`);
  htmlLabel.style.setProperty("--ui-scale", uiScale);
  htmlLabel.classList.remove("hidden");
}

/* -------------------------------------------- */

/**
 * Resolve the token that the label of the given token is measured from.
 * @param {Token5e} token The token that would carry the label.
 * @returns {Token5e|null} The single controlled token, or null if the token carries no label.
 */
function getLabelSource(token) {
  const targeted = game.settings.get(MODULE_ID, SETTING_KEYS.TARGET_LABELS) && game.user.targets.has(token);
  if ( (!token.hover && !targeted) || !token.visible ) return null;

  const controlled = canvas?.tokens?.controlled ?? [];
  if ( controlled.length !== 1 ) return null;

  const actorToken = controlled[0];
  const actorIsOwner = actorToken?.document?.isOwner || game.user.isGM;
  return (actorIsOwner && (actorToken !== token)) ? actorToken : null;
}

/* -------------------------------------------- */

/**
 * Update the labels of all targeted tokens and of the hovered token.
 * @returns {void}
 */
export function refreshTargetLabels() {
  const tokens = new Set(game.user.targets);
  const hovered = canvas.tokens?.hover;
  if ( hovered ) tokens.add(hovered);
  for ( const token of tokens ) void refreshTokenLabel(token);
}

/* -------------------------------------------- */

/**
 * Update the label of a token when the user targets or untargets it.
 * @param {User} user The user who targeted or untargeted the token.
 * @param {Token5e} token The token that was targeted or untargeted.
 * @returns {void}
 */
export function onTargetToken(user, token) {
  if ( user.isSelf ) void refreshTokenLabel(token);
}

/* -------------------------------------------- */

/**
 * Update the labels of all targeted tokens when the selection changes.
 * @returns {void}
 */
export function onControlToken() {
  refreshTargetLabelsDebounced();
}

/* -------------------------------------------- */

/**
 * Hide the label of a token while the token is not visible to the user.
 * @param {Token5e} token The token that was refreshed.
 * @param {object} flags The render flags of the refresh.
 * @returns {void}
 */
export function onRefreshToken(token, flags) {
  if ( !flags.refreshVisibility ) return;
  hoverLabels.get(token.id)?.classList.toggle("hidden", !token.visible);
}

/* -------------------------------------------- */

/**
 * Update the labels of all targeted tokens after the controlled token or a targeted token has moved.
 * @param {TokenDocument5e} document The token document that moved.
 * @param {TokenMovementOperation} movement The movement of the token.
 * @returns {Promise<void>} Resolves after the labels have been updated.
 */
export async function onMoveToken(document, movement) {
  if ( !game.settings.get(MODULE_ID, SETTING_KEYS.TARGET_LABELS) ) return;
  const token = document.object;
  if ( !token || (!token.controlled && !game.user.targets.has(token)) ) return;
  await movement.animation.ended;
  refreshTargetLabels();
}

/* -------------------------------------------- */

/**
 * Remove all hover labels when the canvas is torn down.
 * @returns {void}
 */
export function onCanvasTearDown() {
  for ( const label of hoverLabels.values() ) label.remove();
  hoverLabels.clear();
}

/* -------------------------------------------- */

/**
 * Remove the hover decorations of a deleted token.
 * @param {TokenDocument5e} td The token document that was deleted.
 * @param {object} options Additional hook options.
 * @param {string} userId The ID of the user who initiated the deletion.
 * @returns {void}
 */
export function onDeleteToken(td, options, userId) {
  removeHoverDecorations(td);
}

/* -------------------------------------------- */

/**
 * Remove any hover label elements previously attached to a token.
 * @param {Token5e|TokenDocument5e} token The token to clean up.
 * @returns {void}
 */
function removeHoverDecorations(token) {
  if ( !token ) return;
  const label = hoverLabels.get(token.id);
  if ( label && (label instanceof HTMLElement) ) {
    label.remove();
  }
  hoverLabels.delete(token.id);
}
