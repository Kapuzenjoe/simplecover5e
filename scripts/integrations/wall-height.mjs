/**
 * Check whether the Wall Height module is active.
 *
 * @returns {boolean} True if the Wall Height module is currently active.
 */
export function isWallHeightModuleActive() {
  return game.modules?.get?.("wall-height")?.active === true;
}

/* -------------------------------------------- */

/**
 * Check whether Wall Height wall flags block the cover line at the collision points found by Core.
 *
 * @param {{ x: number, y: number, elevation: number }} A The segment start point.
 * @param {{ x: number, y: number, elevation: number }} B The segment end point.
 * @param {object[]} collisions The wall collision vertices returned by the sight polygon backend.
 * @returns {boolean} True if a Wall Height range blocks the segment.
 */
export function wallHeightBlocks(A, B, collisions) {
  for ( const vertex of collisions ) {
    const edgeSet = vertex?.edges ?? vertex?.cwEdges ?? vertex?.ccwEdges;
    if ( !edgeSet ) continue;

    const coverLineZ = getLineHeightAtVertex(A, B, vertex);
    if ( !Number.isFinite(coverLineZ) ) continue;

    for ( const edge of edgeSet ) {
      const wallDoc = edge?.object;
      if ( !wallDoc ) continue;
      const flags = wallDoc.flags?.["wall-height"];

      const wallTop = flags?.top != null ? Number(flags.top) : Infinity;
      const wallBottom = flags?.bottom != null ? Number(flags.bottom) : -Infinity;

      if ( (wallTop === Infinity) && (wallBottom === -Infinity) ) return true;
      if ( (A.elevation >= wallBottom) && (A.elevation <= wallTop) ) return true;
      if ( (coverLineZ >= wallBottom) && (coverLineZ <= wallTop) ) return true;
    }
  }

  return false;
}

/* -------------------------------------------- */

/**
 * Compute the ray height at a wall-intersection vertex along segment A-B.
 *
 * @param {{ x: number, y: number, elevation: number }} A The segment start point.
 * @param {{ x: number, y: number, elevation: number }} B The segment end point.
 * @param {{ x: number, y: number }} vertex The intersection vertex on the wall.
 * @returns {number} The interpolated line height at the intersection vertex.
 */
function getLineHeightAtVertex(A, B, vertex) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const useX = Math.abs(dx) >= Math.abs(dy);
  const denom = (useX ? dx : dy) || 1e-9;
  const raw = useX ? (vertex.x - A.x) / denom : (vertex.y - A.y) / denom;
  const t = Math.min(Math.max(raw, 0), 1);

  return A.elevation + (t * (B.elevation - A.elevation));
}
