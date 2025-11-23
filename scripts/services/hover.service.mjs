import { MODULE_ID, SETTING_KEYS, HOVER } from "../config/constants.config.mjs";
import {
  buildCoverContext,
  buildCreaturePrism,
  evaluateCoverFromOccluders,
} from "../services/cover.engine.mjs";
import { measureTokenDistance } from "../utils/distance.mjs";
import { isBlockingCreatureToken } from "../utils/rpc.mjs";

/**
 * Property name for storing hover distance label on Token instance.
 */
const COVER_ICON_PATHS = {
  half: "systems/dnd5e/icons/svg/statuses/cover-half.svg",
  threeQuarters: "systems/dnd5e/icons/svg/statuses/cover-three-quarters.svg",
};

/**
 * Remove hover decorations from token.
 * @param {Token5e} token 
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
 * Show distance/cover to hovered token (client-side only).
 * Behavior controlled by SETTING_KEYS.HOVER:
 *  - "off"              -> no label
 *  - "coverOnly"        -> cover icon only
 *  - "coverAndDistance" -> cover icon + distance
 *
 * @param {Token5e} token        Hovered token.
 * @param {boolean} hoverState   True if hover started, false if hover ended.
 */
export async function onHoverToken(token, hoverState) {
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
    const scene = hoveredToken.scene;
    if (scene) {
      const ctx = buildCoverContext(canvas.scene);
      const blockingTokens = canvas.tokens.placeables.filter(t => isBlockingCreatureToken(t));
      ctx.creaturePrisms = new Map(
        blockingTokens.map(t => [t.id, buildCreaturePrism(t.document, ctx)])
      );

      const coverEval = evaluateCoverFromOccluders(
        actorToken.document,
        hoveredToken.document,
        ctx,
        { debug: false }
      );

      const coverResult = coverEval?.cover ?? "none";
      if (coverResult === "half" || coverResult === "threeQuarters") {
        coverKey = coverResult;
      }
    }
  }

  const showCoverIcon =
    (hoverMode === "coverOnly" || hoverMode === "coverAndDistance") &&
    !!coverKey;

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
    const rounded = Math.round(Number(distance) || 0);

    labelText = unit ? `${rounded} ${unit}` : `${rounded}`;
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
    console.warn(`${MODULE_ID} | #hud #measurement not found.`);
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
    const iconPath = COVER_ICON_PATHS[coverKey];
    if (iconPath) {
      const coverHtml = `
        <span class="img cover-icon" style="background-image: url('${iconPath}');"></span>
      `;
      coverRowHtml = `<div class="cover-row">${coverHtml}</div>`;
    }
  }

  htmlLabel.innerHTML = `
    ${distanceRowHtml}
    ${coverRowHtml}
  `;

  const center = hoveredToken.center ?? { x: hoveredToken.x, y: hoveredToken.y };
  const uiScale = canvas.dimensions?.uiScale ?? 1;

  let posX = center.x;
  let posY = center.y;

  const positionSetting = game.settings.get(MODULE_ID, SETTING_KEYS.HOVER_LABEL_POSITION); // "below" | "above" | "on"
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
