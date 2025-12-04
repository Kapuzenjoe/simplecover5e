const DEBUG_Z_INDEX = 1000;
const DEFAULT_SEGMENT_ALPHA = 0.9;
const DEFAULT_SEGMENT_WIDTH = 2;

const DEFAULT_SHAPE_ALPHA = 0.7;
const DEFAULT_SHAPE_LINE_WIDTH = 2;

const SEGMENT_COLOR_BLOCKED = 0xff0000;
const SEGMENT_COLOR_CLEAR = 0x00ff00;

const TOKEN_COLOR_ATTACKER = 0x00ff00;
const TOKEN_COLOR_TARGET = 0x0000ff;
const TOKEN_COLOR_OCCLUDER = 0xffa500;

/** @type {PIXI.Graphics|null} */
let debugGraphics = null;

/**
 * Lazily create or return the shared debug PIXI.Graphics instance.
 * The graphics object is attached to the canvas interface and reused between debug draws for performance.
 *
 * @returns {PIXI.Graphics|null} A reusable graphics instance or null if the canvas is not ready.
 */
function getDebugGraphics() {
  if (!debugGraphics || debugGraphics.destroyed) {
    if (!canvas?.ready) return null;

    const g = new PIXI.Graphics();
    g.zIndex = DEBUG_Z_INDEX;
    g.eventMode = "none";

    debugGraphics = g;
    canvas.interface.addChild(debugGraphics);
  }
  return debugGraphics;
}


/**
 * Clear the current cover debug graphics without destroying the graphics object.
 * 
 */
export function clearCoverDebug() {
  if (!debugGraphics || debugGraphics.destroyed) return;
  debugGraphics.clear();
}

/**
 * Draw a collection of polygons with a shared style.
 *
 * @param {PIXI.Graphics} g - Graphics object to draw on.
 * @param {TokenPolygon[]} polygons - List of polygons to render.
 * @param {number} color - Line color (0xRRGGBB).
 * @param {number} alpha - Line opacity (0–1).
 * @param {number} width - Line width in pixels.
 */
function drawPolygonSet(g, polygons, color, alpha, width) {
  if (!Array.isArray(polygons) || !polygons.length) return;

  g.lineStyle(width, color, alpha);

  for (const poly of polygons) {
    if (!poly?.length) continue;

    g.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) {
      g.lineTo(poly[i].x, poly[i].y);
    }
    g.lineTo(poly[0].x, poly[0].y);
  }
}

/**
 * Draw a single debug segment onto the graphics context.
 *
 * @param {PIXI.Graphics} g - Graphics object to draw on.
 * @param {DebugSegment} segment - Segment configuration to render.
 */
function drawDebugSegment(g, segment) {
  if (!segment) return;

  const from = segment.from ?? segment.a;
  const to = segment.to ?? segment.b;
  if (!from || !to) return;

  const blocked = !!segment.blocked;
  const color = segment.color ?? (blocked ? SEGMENT_COLOR_BLOCKED : SEGMENT_COLOR_CLEAR);
  const alpha = segment.alpha ?? DEFAULT_SEGMENT_ALPHA;
  const width = segment.width ?? DEFAULT_SEGMENT_WIDTH;

  g.lineStyle(width, color, alpha);
  g.moveTo(from.x, from.y);
  g.lineTo(to.x, to.y);
}


/**
   * Draw debug information for cover evaluation onto the canvas.
   *
   * @param {Object} [options={}] - Debug rendering options.
   * @param {DebugSegment[]} [options.segments=[]] - Segments to draw between sample points.
   * @param {TokenShapeDebug} [options.tokenShapes] - Optional token and occluder polygons.
   */
export function drawCoverDebug({ segments = [], tokenShapes } = {}) {
  const g = getDebugGraphics();
  if (!g) return;

  for (const seg of segments) {
    drawDebugSegment(g, seg);
  }

  if (!tokenShapes) return;

  const attackerPolys = tokenShapes.attacker ?? [];
  const targetPolys = tokenShapes.target ?? [];
  const occluderPolys = tokenShapes.occluders ?? [];

  drawPolygonSet(
    g,
    attackerPolys,
    TOKEN_COLOR_ATTACKER,
    DEFAULT_SHAPE_ALPHA,
    DEFAULT_SHAPE_LINE_WIDTH
  );
  drawPolygonSet(
    g,
    targetPolys,
    TOKEN_COLOR_TARGET,
    DEFAULT_SHAPE_ALPHA,
    DEFAULT_SHAPE_LINE_WIDTH
  );
  drawPolygonSet(
    g,
    occluderPolys,
    TOKEN_COLOR_OCCLUDER,
    DEFAULT_SHAPE_ALPHA,
    DEFAULT_SHAPE_LINE_WIDTH
  );
}