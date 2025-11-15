import { MODULE_ID, SETTING_KEYS, GRID_MODES, getGridMode } from "../config/constants.config.mjs";

// =========================
// debug
// =========================

/**
 * Draw up to 4 debug segments (blocked vs open).
 * @param {{segments:Array}} 
 */
export async function drawCoverDebug({ segments }) {
  if (!game.user.isGM) return
  if (!segments || segments.length === 0) return;
  const grid = canvas.scene?.grid ?? null;
  const gridMode = getGridMode(grid);

  const maxSegments = gridMode === GRID_MODES.HEX ? 6 : 4;
  const count = Math.min(maxSegments, segments.length);

  const docs = [];

  for (let i = 0; i < count; i += 1) {
    const s = segments[i];
    const A = s._tested?.a ?? s.a;
    const B = s._tested?.b ?? s.b;
    docs.push({
      shape: { type: "p", points: [A.x, A.y, B.x, B.y] },
      strokeColor: s.blocked ? "#ff2d55" : "#34c759",
      strokeAlpha: 0.95,
      strokeWidth: 4,
      fillAlpha: 0,
      flags: { [MODULE_ID]: { [SETTING_KEYS.DEBUG]: true } }
    });
  }
  await canvas.scene.createEmbeddedDocuments("Drawing", docs);
}

/**
 * Remove previously drawn cover debug drawings.
 */
export async function clearCoverDebug() {
  if (!game.user.isGM) return
  const toDelete = [];
  const drawings = canvas.scene.drawings;
  for (let i = 0; i < drawings.size; i += 1) {
    const d = drawings.contents[i];
    if (d.getFlag(MODULE_ID, SETTING_KEYS.DEBUG)) toDelete.push(d.id);
  }
  if (toDelete.length > 0) await canvas.scene.deleteEmbeddedDocuments("Drawing", toDelete);
}
