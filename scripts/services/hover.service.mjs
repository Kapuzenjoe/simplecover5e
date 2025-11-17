import { MODULE_ID, SETTING_KEYS } from "../config/constants.config.mjs";
import {
  buildCoverContext,
  buildCreaturePrism,
  evaluateCoverFromOccluders,
} from "../services/cover.engine.mjs";
import { measureTokenDistance } from "../utils/distance.mjs";

const COVER_ICON_PATHS = {
  half: "systems/dnd5e/icons/svg/statuses/cover-half.svg",
  threeQuarters: "systems/dnd5e/icons/svg/statuses/cover-three-quarters.svg",
};

function removeHoverDecorations(token) {
  if (!token) return;

  const label = token._hoverDistanceLabel;
  if (label) {
    token.removeChild?.(label);
    label.destroy?.({ children: true });
    delete token._hoverDistanceLabel;
  }

  const icon = token._hoverCoverIcon;
  if (icon) {
    token.removeChild?.(icon);
    icon.destroy?.({ children: true });
    delete token._hoverCoverIcon;
  }
}

/**
 * Decide if the distance label should be placed below the nameplate,
 * based on the token displayName mode and ownership/selection.
 *
 * displayName values:
 *  - 50: ALWAYS
 *  - 30: HOVER
 *  - 40: OWNER
 *  - 20: OWNER_HOVER
 *  - 10: CONTROL
 *  - 0:  NONE
 *
 * @param {number} mode
 * @param {object} options
 * @param {boolean} options.isOwner
 * @param {boolean} options.isControlled
 * @returns {boolean}
 */
function shouldPlaceBelowNameplate(mode, { isOwner, isControlled }) {
  switch (mode) {
    case 50: // ALWAYS
    case 30: // HOVER
      return true;
    case 40: // OWNER
    case 20: // OWNER_HOVER
      return isOwner;
    case 10: // CONTROL
      return isControlled;
    case 0: // NONE
    default:
      return false;
  }
}

/**
 * Show distance to hovered token (client-side only).
 * Uses system diagonal rules and shows cover status as icon for half / three-quarters cover.
 *
 * @param {Token5e} token        Hovered token.
 * @param {boolean} hoverState   True if hover started, false if hover ended.
 */
export async function onHoverToken(token, hoverState) {
  if (!game.settings.get(MODULE_ID, SETTING_KEYS.HOVER)) return;

  const hoveredToken = token;
  if (!hoveredToken) return;

  if (!hoverState) {
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
  const scene = hoveredToken.scene;

  if (scene) {
    const ctx = buildCoverContext(scene);
    ctx.creaturePrisms = new Map(
      canvas.tokens.placeables.map(t => [t.id, buildCreaturePrism(t.document, ctx)])
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
  const prefix = "⦿";

  const labelText = unit
    ? `${prefix} ${rounded} ${unit}`
    : `${prefix} ${rounded}`;

  const PreciseTextCtor = foundry?.canvas?.containers?.PreciseText;
  if (!PreciseTextCtor) {
    console.warn("simplecover5e | PreciseText not available.");
    removeHoverDecorations(hoveredToken);
    return;
  }


  let label = hoveredToken._hoverDistanceLabel;
  const textStyle = nameplate.style?.clone?.()
    ? nameplate.style.clone()
    : nameplate.style;

  if (!label || label.destroyed) {
    label = new PreciseTextCtor(labelText, textStyle);
    label.anchor?.set?.(0.5, 0);
    label.name = "hover-distance-label";
    hoveredToken.addChild(label);
    hoveredToken._hoverDistanceLabel = label;
  } else {
    label.setText?.(labelText);
    if (label.style && textStyle && typeof label.style.copyFrom === "function") {
      label.style.copyFrom(textStyle);
    }
  }

  const displayMode = hoveredToken.document.displayName;
  const hoveredIsOwner = hoveredToken.document.isOwner || game.user.isGM;
  const hoveredIsControlled = hoveredToken.controlled;

  const placeBelow = shouldPlaceBelowNameplate(displayMode, {
    isOwner: hoveredIsOwner,
    isControlled: hoveredIsControlled,
  });

  const padding = 2;
  let fontSize = nameplate.style?.fontSize ?? 16;
  if (typeof fontSize === "string") {
    const parsed = parseInt(fontSize, 10);
    if (!Number.isNaN(parsed)) fontSize = parsed;
  }

  label.x = nameplate.x;
  label.scale.x = nameplate.scale.x;
  label.scale.y = nameplate.scale.y;

  label.y = placeBelow
    ? nameplate.y + fontSize + padding
    : nameplate.y;

  label.zIndex = (nameplate.zIndex ?? 0) + 1;
  label.alpha = 1;
  label.visible = true;

  hoveredToken.sortChildren?.();


  if (!coverKey) {
    const oldIcon = hoveredToken._hoverCoverIcon;
    if (oldIcon) {
      hoveredToken.removeChild?.(oldIcon);
      oldIcon.destroy?.({ children: true });
      delete hoveredToken._hoverCoverIcon;
    }
    return;
  }

  const iconPath = COVER_ICON_PATHS[coverKey];
  if (!iconPath) {
    const oldIcon = hoveredToken._hoverCoverIcon;
    if (oldIcon) {
      hoveredToken.removeChild?.(oldIcon);
      oldIcon.destroy?.({ children: true });
      delete hoveredToken._hoverCoverIcon;
    }
    return;
  }

  const texture = await loadTexture(iconPath);
  if (!texture) return;

  let icon = hoveredToken._hoverCoverIcon;
  if (!icon || icon.destroyed) {
    icon = new PIXI.Sprite(texture);
    icon.name = "hover-cover-icon";
    icon.anchor.set(0.5, 0.5);
    hoveredToken.addChild(icon);
    hoveredToken._hoverCoverIcon = icon;
  } else {
    icon.texture = texture;
  }

  const bounds = label.getLocalBounds();
  const textWidth = (bounds.width ?? 0) * label.scale.x;
  const textHeight = (bounds.height ?? 0) * label.scale.y || (fontSize ?? 16);

  const texHeight = icon.texture?.height || 1;
  const scale = textHeight / texHeight;
  icon.scale.set(scale, scale);

  const iconOffset = 4;
  const iconWidth = icon.width; 

  icon.x = label.x + textWidth / 2 + iconWidth / 2 + iconOffset;
  icon.y = label.y + textHeight / 2;
  icon.zIndex = label.zIndex + 1;

  hoveredToken.sortChildren?.();
}
