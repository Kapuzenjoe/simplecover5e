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
function onPreDeleteToken(td, options, userId) {
  removeHoverDecorations(td?.object);
}

/**
 * Update the hover UI for a token based on the single controlled token.
 * The output is client-side only and controlled by the hover setting.
 *
 * @function hoverToken
 * @memberof hookEvents
 * @param {Token5e} token The hovered token.
 * @param {boolean} hoverState True when hover starts, or false when hover ends.
 * @returns {void}
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

  const showCoverIcon = !!coverKey;

  let distanceText = "";
  let units = "";
  if (hoverMode === "coverAndDistance") {
    const distance = measureTokenDistance(
      actorToken.document,
      hoveredToken.document
    );

    if (!Number.isFinite(distance)) {
      removeHoverDecorations(hoveredToken);
      return;
    }

    units = hoveredToken?.scene?.grid?.units ?? "";
    distanceText = distance.toNearest(0.01).toLocaleString(game.i18n.lang);
  }

  const showDistance = hoverMode === "coverAndDistance" && !!distanceText;

  if (!showCoverIcon && !showDistance) {
    removeHoverDecorations(hoveredToken);
    return;
  }

  const measurementHud = document.querySelector("#hud #measurement");
  if (!measurementHud) {
    removeHoverDecorations(hoveredToken);
    return;
  }

  removeHoverDecorations(hoveredToken);

  const uiScale = canvas.dimensions.uiScale;
  let htmlLabel;

  if (showDistance) {
    const rendered = await foundry.applications.handlebars.renderTemplate(
      "templates/hud/waypoint-label.hbs",
      {
        cssClass: "hover-distance-label",
        action: { icon: "fa-solid fa-ruler" },
        distance: { total: distanceText },
        units,
        uiScale
      }
    );
    if (!hoveredToken.hover) return;
    htmlLabel = foundry.utils.parseHTML(rendered);
  }
  else {
    htmlLabel = document.createElement("div");
    htmlLabel.classList.add("waypoint-label", "hover-distance-label");
  }

  if (showCoverIcon) {
    const iconPath = CONFIG.statusEffects[COVER.IDS[coverKey]].img;
    const coverIcon = document.createElement("span");
    coverIcon.classList.add("img");
    coverIcon.style.backgroundImage = `url("${iconPath}")`;
    htmlLabel.append(coverIcon);
  }

  measurementHud.appendChild(htmlLabel);
  hoveredToken[HOVER.DISTANCE_LABEL_PROP] = htmlLabel;

  const center = hoveredToken.center ?? { x: hoveredToken.x, y: hoveredToken.y };

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
