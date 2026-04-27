import { MODULE_ID, SETTING_KEYS, HOVER, COVER } from "../config/constants.mjs";
import { measureTokenDistance } from "./distance.mjs";
import { getCover } from "../cover/api.mjs";

/**
 * Register hooks used by the token hover cover display.
 *
 * @returns {void}
 */
export function initHoverHooks() {
  Hooks.on("hoverToken", onHoverToken);
  Hooks.on("preDeleteToken", onPreDeleteToken);
}

/**
 * Remove any hover label elements previously attached to a token.
 *
 * @param {Token5e} token The token to clean up.
 * @returns {void}
 */
function removeHoverDecorations(token) {
  if (!token) return;
  const label = token[HOVER.DISTANCE_LABEL_PROP];
  if (label && label instanceof HTMLElement) {
    label.remove();
  }
  delete token[HOVER.DISTANCE_LABEL_PROP];
}

/**
 * Remove hover decorations before a token is deleted.
 *
 * @function preDeleteToken
 * @memberof hookEvents
 * @param {TokenDocument5e} td The token document being deleted.
 * @param {object} options Additional hook options.
 * @param {string} userId The ID of the user who initiated the deletion.
 * @returns {void}
 */
function onPreDeleteToken(td, options, userId){
  removeHoverDecorations(td?.object)
}

/**
 * Update the hover UI for a token based on the single controlled token.
 * The output is client-side only and controlled by the hover setting.
 *
 * @function hoverToken
 * @memberof hookEvents
 * @param {Token5e} token The hovered token.
 * @param {boolean} hoverState True when hover starts, or false when hover ends.
 * @returns {Promise<void>} Resolves after the hover label has been updated.
 */
async function onHoverToken(token, hoverState) {
  const hoveredToken = token;
  if (!hoveredToken) return;

  const hoverMode = game.settings.get(MODULE_ID, SETTING_KEYS.HOVER);

  if (!hoverState || hoverMode === "off") {
    removeHoverDecorations(hoveredToken);
    return;
  }

  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    removeHoverDecorations(hoveredToken);
    return;
  }

  const actorToken = controlled[0];

  const actorIsOwner = actorToken?.document?.isOwner || game.user.isGM;
  if (!actorIsOwner || actorToken === hoveredToken) {
    removeHoverDecorations(hoveredToken);
    return;
  }

  const nameplate = hoveredToken.nameplate;
  if (!nameplate) {
    removeHoverDecorations(hoveredToken);
    return;
  }

  let coverKey = "";
  if (hoverMode === "coverOnly" || hoverMode === "coverAndDistance") {
    const losCheck = !!game.settings?.get?.(MODULE_ID, SETTING_KEYS.LOS_CHECK);
    const result = getCover({
      attacker: actorToken,
      target: hoveredToken,
      scene: hoveredToken.scene,
      debug: false,
      losCheck,
      includeEmbeddedCover: true
    });

    if (result?.cover !== "none") {
      coverKey = result?.cover || "";
    }
  }

  const showCoverIcon =
    (hoverMode === "coverOnly" || hoverMode === "coverAndDistance") && !!coverKey;

  let labelText = "";
  if (hoverMode === "coverAndDistance") {
    const distance = measureTokenDistance(
      actorToken.document,
      hoveredToken.document
    );

    if (!Number.isFinite(distance)) {
      removeHoverDecorations(hoveredToken);
      return;
    }

    const unit = hoveredToken?.scene?.grid?.units ?? "";
    labelText = unit ? `${distance} ${unit}` : `${distance}`;
  }

  const showDistance = hoverMode === "coverAndDistance" && !!labelText;

  if (!showCoverIcon && !showDistance) {
    removeHoverDecorations(hoveredToken);
    return;
  }

  let fontSize = nameplate.style?.fontSize ?? 16;
  if (typeof fontSize === "string") {
    const parsed = parseInt(fontSize, 10);
    if (!Number.isNaN(parsed)) fontSize = parsed;
  }

  const measurementHud = document.querySelector("#hud #measurement");
  if (!measurementHud) {
    removeHoverDecorations(hoveredToken);
    return;
  }

  /** @type {HTMLDivElement} */
  let htmlLabel = hoveredToken[HOVER.DISTANCE_LABEL_PROP];

  if (!htmlLabel || !(htmlLabel instanceof HTMLElement)) {
    htmlLabel = document.createElement("div");
    htmlLabel.classList.add("waypoint-label", "hover-distance-label");
    measurementHud.appendChild(htmlLabel);
    hoveredToken[HOVER.DISTANCE_LABEL_PROP] = htmlLabel;
  }

  let distanceRowHtml = "";
  if (showDistance) {
    distanceRowHtml = `
      <div class="distance-row">
        <span class="icon"><i class="fa-solid fa-ruler"></i></span>
        <span class="total-measurement">${labelText}</span>
      </div>
    `;
  }

  let coverRowHtml = "";
  if (showCoverIcon) {
    const iconPath = CONFIG.statusEffects[COVER.IDS[coverKey]].img;
    const coverHtml = `
      <span class="img cover-icon" style="background-image: url('${iconPath}');"></span>
    `;
    coverRowHtml = `<div class="cover-row">${coverHtml}</div>`;
  }

  htmlLabel.innerHTML = `
    ${distanceRowHtml}
    ${coverRowHtml}
  `;

  const center = hoveredToken.center ?? { x: hoveredToken.x, y: hoveredToken.y };
  const uiScale = canvas.dimensions?.uiScale ?? 1;

  let posX = center.x;
  let posY = center.y;

  const positionSetting = game.settings.get(MODULE_ID, SETTING_KEYS.HOVER_LABEL_POSITION);
  const extraYOffset = Number(
    game.settings.get(MODULE_ID, SETTING_KEYS.HOVER_LABEL_Y_OFFSET) ?? 0
  );
  const extraXOffset = Number(
    game.settings.get(MODULE_ID, SETTING_KEYS.HOVER_LABEL_X_OFFSET) ?? 0
  );

  const tokenHalfHeight = (hoveredToken.h ?? hoveredToken.height ?? 0) / 2;

  htmlLabel.style.setProperty("--transformX", "-50%");

  switch (positionSetting) {
    case "above": {
      posY = center.y - tokenHalfHeight;
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
      posY = center.y + tokenHalfHeight;
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
