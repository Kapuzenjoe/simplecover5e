/**
 * Check whether the wall-height module is active.
 *
 * @returns {boolean}                              True if the wall-height module is currently active.
 */
export function isWallHeightModuleActive() {
    return game.modules?.get?.("wall-height")?.active === true;
}


/**
 * Get the size key for a token's actor as a normalized string.
 *
 * @param {TokenDocument|Position} td           The token document OR a generic position {x,y,elevation?}..
 * @returns {string|null}                       The size key ("tiny", "sm", "med", "lg", "huge", "grg") or null.
 */
export function getSizeKey(td) {
    const size = td?.actor?.system?.traits?.size;
    return size ? String(size).toLowerCase() : null;
}

/**
 * Get the creature height in gridSize for a token document.
 * If wall-height is active, the token's LoS height is used when available.
 *
 * @param {TokenDocument|Position} td             The token document OR a generic position {x,y,elevation?}.
 * @param {CoverContext} ctx                      The cover evaluation context.
 * @returns {number}                              The creature height in gridSize or 0.
 */
export function getCreatureHeight(td, ctx) {
    if (!td?.actor) return 0;

    if (isWallHeightModuleActive()) {
        const token = td?.object;
        if (!token) return 0;

        const elevation = Number(td.elevation ?? 0);
        const losHeight = token ? Number(token.losHeight) : NaN;

        if (Number.isFinite(losHeight)) {
            const diff = losHeight - elevation;
            if (diff > 0) {
                const height = Math.ceil(diff * 100) / 100;
                if (Number.isFinite(height)) {
                    return height;
                }
            }
        }
    }
    const key = getSizeKey(td);
    if (!key) return 0;

    return ctx.size?.[key] ?? 0;
}

export function isEllipse(tokenDoc) {
    return (
        tokenDoc.shape === CONST.TOKEN_SHAPES.ELLIPSE_1 ||
        tokenDoc.shape === CONST.TOKEN_SHAPES.ELLIPSE_2
    );
};