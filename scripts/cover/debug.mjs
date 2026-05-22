/**
 * @import { CoverDebugOptions, DebugPoint, DebugPolygon, DebugSegment } from "../_types.mjs";
 */

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

const DEFAULT_POINT_ALPHA = 0.9;
const DEFAULT_POINT_RADIUS = 2;
const DEFAULT_POINT_LINE_WIDTH = 1;

/** @type {PIXI.Graphics|null} */
let debugGraphics = null;

/**
 * Register hooks used by the cover debug overlay.
 *
 * @returns {void}
 */
export function initCoverDebugHooks() {
  Hooks.on("canvasReady", clearCoverDebug);
}

/**
 * Lazily create or return the shared debug PIXI.Graphics instance.
 * The graphics object is attached to the canvas interface and reused between debug draws for performance.
 *
 * @returns {PIXI.Graphics|null} A reusable graphics instance, or null if the canvas is not ready.
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
 * Clear the current cover debug graphics without destroying the shared graphics object.
 *
 * @returns {void}
 */
export function clearCoverDebug() {
  if (!debugGraphics || debugGraphics.destroyed) return;
  debugGraphics.clear();
}

/**
 * Draw a collection of polygons with a shared style.
 *
 * @param {PIXI.Graphics} g The graphics object to draw on.
 * @param {DebugPolygon[]} polygons The polygons to render.
 * @param {number} color The line color.
 * @param {number} alpha The line opacity.
 * @param {number} width The line width in pixels.
 * @returns {void}
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
 * @param {PIXI.Graphics} g The graphics object to draw on.
 * @param {DebugSegment} segment The segment configuration to render.
 * @returns {void}
 */
function drawDebugSegment(g, segment) {
  if (!segment) return;

  const from = segment.a;
  const to = segment.b;
  if (!from || !to) return;

  const blocked = !!segment.blocked;
  const color = (blocked ? SEGMENT_COLOR_BLOCKED : SEGMENT_COLOR_CLEAR);
  const alpha = DEFAULT_SEGMENT_ALPHA;
  const width = DEFAULT_SEGMENT_WIDTH;

  g.lineStyle(width, color, alpha);
  g.moveTo(from.x, from.y);
  g.lineTo(to.x, to.y);
}

/**
 * Draw a set of debug points as circles.
 *
 * @param {PIXI.Graphics} g The graphics object to draw on.
 * @param {DebugPoint[]} points The points to draw.
 * @param {number} color The circle color.
 * @param {number} alpha The point opacity.
 * @param {number} radius The circle radius in pixels.
 * @param {number} lineWidth The outline width in pixels.
 * @returns {void}
 */
function drawPointSet(g, points, color, alpha, radius, lineWidth) {
  if (!points.length) return;

  g.lineStyle(lineWidth, color, alpha);
  g.beginFill(color, alpha * 0.35);

  for (const p of points) {
    if (!p) continue;
    g.drawCircle(p.x, p.y, radius);
  }

  g.endFill();
}

/**
 * Draw cover debug information onto the canvas.
 *
 * @param {CoverDebugOptions} [options={}] Debug rendering options.
 * @returns {void}
 */
export function drawCoverDebug({ segments = [], tokenShapes, targetLosPoints = [] } = {}) {
  const g = getDebugGraphics();
  if (!g) return;

  for (const seg of segments) {
    drawDebugSegment(g, seg);
  }

  if (targetLosPoints.length) {
    const blockedPts = targetLosPoints.filter(p => p?.blocked);
    const clearPts = targetLosPoints.filter(p => p && !p.blocked);

    drawPointSet(
      g,
      blockedPts,
      SEGMENT_COLOR_BLOCKED,
      DEFAULT_POINT_ALPHA,
      DEFAULT_POINT_RADIUS,
      DEFAULT_POINT_LINE_WIDTH
    );

    drawPointSet(
      g,
      clearPts,
      SEGMENT_COLOR_CLEAR,
      DEFAULT_POINT_ALPHA,
      DEFAULT_POINT_RADIUS,
      DEFAULT_POINT_LINE_WIDTH
    );
  }

  if (!tokenShapes) return;

  const attackerPolys = tokenShapes?.attacker ?? [];
  const targetPolys = tokenShapes?.target ?? [];
  const occluderPolys = tokenShapes?.occluders ?? [];

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
