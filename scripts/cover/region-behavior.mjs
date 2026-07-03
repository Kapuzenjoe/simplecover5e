/**
 * @import { TestPoint } from "../_types.mjs";
 */

import { getTokenTokenDistance } from "../canvas/distance.mjs";

const { NumberField, SetField, StringField } = foundry.data.fields;

/**
 * A Region Behavior that blocks Cover Lines through a Region, like a creature would.
 *
 * @extends {foundry.data.regionBehaviors.RegionBehaviorType}
 */
export default class CoverObstacleRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static LOCALIZATION_PREFIXES = ["BEHAVIOR.TYPES.base", "SIMPLE_COVER_5E.RegionBehavior.CoverObstacle"];

  /* -------------------------------------------- */

  /** @override */
  static defineSchema() {
    return {
      ignoredSizes: new SetField(new StringField({ choices: () => CONFIG.DND5E.actorSizes })),
      ignoredTypes: new SetField(new StringField({ choices: () => CONFIG.DND5E.creatureTypes })),
      interiorBlockDistance: new NumberField({ required: false, initial: 0, min: 0 })
    };
  }

  /**
   * Determine whether this obstacle blocks the Cover Line between two points.
   *
   * @param {TestPoint} a The attacker corner.
   * @param {TestPoint} b The target corner.
   * @param {{ attackerToken: TokenDocument, targetToken: TokenDocument }} context The attacker/target documents.
   * @returns {boolean} True if this obstacle blocks the Cover Line.
   */
  blocksSegment(a, b, { attackerToken, targetToken }) {
    if ( this.#isIgnoredToken(attackerToken) && this.#isIgnoredToken(targetToken) ) return false;

    const aInside = this.region.testPoint({ x: a.x, y: a.y, elevation: a.elevation ?? 0 });
    const bInside = this.region.testPoint({ x: b.x, y: b.y, elevation: b.elevation ?? 0 });

    if ( aInside && bInside ) {
      if ( this.interiorBlockDistance === 0 ) return true;
      return getTokenTokenDistance(attackerToken, targetToken) >= this.interiorBlockDistance;
    }

    const waypoints = [
      { x: a.x, y: a.y, elevation: a.elevation ?? 0 },
      { x: b.x, y: b.y, elevation: b.elevation ?? 0 }
    ];
    return this.region.segmentizeMovementPath(waypoints, [{ x: 0, y: 0 }]).length > 0;
  }

  /* -------------------------------------------- */

  /**
   * Check whether a token is exempt from this obstacle via the size/type filters.
   *
   * @param {TokenDocument} token The attacker or target token document.
   * @returns {boolean} True if the token's size or type is ignored.
   */
  #isIgnoredToken(token) {
    const actor = token?.actor;
    if ( !actor ) return false;
    if ( this.ignoredSizes.size && this.ignoredSizes.has(actor.system?.traits?.size) ) return true;
    if ( this.ignoredTypes.size && this.ignoredTypes.has(actor.system?.details?.type?.value) ) return true;
    return false;
  }
}

/* -------------------------------------------- */

/**
 * Register the obstacle Region Behavior type used to block cover rays.
 * @returns {void}
 */
export function initCoverObstacleRegionBehavior() {
  CONFIG.RegionBehavior.dataModels["simplecover5e.coverObstacle"] = CoverObstacleRegionBehaviorType;
  CONFIG.RegionBehavior.typeLabels["simplecover5e.coverObstacle"] = "SIMPLE_COVER_5E.RegionBehavior.CoverObstacle.label";
  CONFIG.RegionBehavior.typeHints["simplecover5e.coverObstacle"] = "SIMPLE_COVER_5E.RegionBehavior.CoverObstacle.hint";
  CONFIG.RegionBehavior.typeIcons["simplecover5e.coverObstacle"] = "fa-solid fa-shield-halved";
}
