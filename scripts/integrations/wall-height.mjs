/**
 * Check whether the Wall Height module is active.
 * @returns {boolean} True if the Wall Height module is currently active.
 */
export function isWallHeightModuleActive() {
  return game.modules?.get?.("wall-height")?.active === true;
}

/* -------------------------------------------- */

/**
 * Check whether Wall Height wall flags block the cover line at the collision points found by Core.
 * @param {{ x: number, y: number, elevation: number }} origin The segment start point.
 * @param {{ x: number, y: number, elevation: number }} destination The segment end point.
 * @param {object[]} collisions The wall collision vertices returned by the sight polygon backend.
 * @returns {boolean} True if a Wall Height range blocks the segment.
 */
export function wallHeightBlocks(origin, destination, collisions) {
  for ( const vertex of collisions ) {
    const edgeSet = vertex?.edges ?? vertex?.cwEdges ?? vertex?.ccwEdges;
    if ( !edgeSet ) continue;

    const coverLineZ = getLineHeightAtVertex(origin, destination, vertex);
    if ( !Number.isFinite(coverLineZ) ) continue;

    for ( const edge of edgeSet ) {
      const wallDoc = edge?.object;
      if ( !wallDoc ) continue;

      const top = wallDoc.getFlag("wall-height", "top");
      const bottom = wallDoc.getFlag("wall-height", "bottom");
      const wallTop = top != null ? Number(top) : Infinity;
      const wallBottom = bottom != null ? Number(bottom) : -Infinity;

      if ( (wallTop === Infinity) && (wallBottom === -Infinity) ) return true;
      if ( origin.elevation.between(wallBottom, wallTop) ) return true;
      if ( coverLineZ.between(wallBottom, wallTop) ) return true;
    }
  }

  return false;
}

/* -------------------------------------------- */

/**
 * Compute the ray height at a wall-intersection vertex along the origin-destination segment.
 * @param {{ x: number, y: number, elevation: number }} origin The segment start point.
 * @param {{ x: number, y: number, elevation: number }} destination The segment end point.
 * @param {{ x: number, y: number }} vertex The intersection vertex on the wall.
 * @returns {number} The interpolated line height at the intersection vertex.
 */
function getLineHeightAtVertex(origin, destination, vertex) {
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;
  const useX = Math.abs(dx) >= Math.abs(dy);
  const denom = (useX ? dx : dy) || 1e-9;
  const raw = useX ? (vertex.x - origin.x) / denom : (vertex.y - origin.y) / denom;
  const t = Math.clamp(raw, 0, 1);

  return origin.elevation + (t * (destination.elevation - origin.elevation));
}
