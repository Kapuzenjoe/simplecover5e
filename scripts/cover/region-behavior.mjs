/**
 * @import { Position, TestPoint } from "../_types.mjs";
 */

import { getTokenTokenDistance } from "../canvas/distance.mjs";

const { BooleanField, NumberField, SetField, StringField } = foundry.data.fields;

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
      cover: new StringField({
        required: true,
        blank: false,
        initial: "threeQuarters",
        choices: {
          half: "SIMPLE_COVER_5E.RegionBehavior.CoverObstacle.FIELDS.cover.Options.half",
          threeQuarters: "SIMPLE_COVER_5E.RegionBehavior.CoverObstacle.FIELDS.cover.Options.threeQuarters"
        }
      }),
      sizes: new SetField(new StringField({ choices: () => CONFIG.DND5E.actorSizes })),
      types: new SetField(new StringField({ choices: () => CONFIG.DND5E.creatureTypes })),
      interiorNeverBlocks: new BooleanField(),
      interiorBlockDistance: new NumberField({ required: false, initial: 0, min: 0 })
    };
  }

  /* -------------------------------------------- */

  /**
   * Determine whether this obstacle blocks the Cover Line between two points, for a pair not already
   * resolved by {@link evaluateTokens}.
   *
   * @param {TestPoint} a The attacker corner.
   * @param {TestPoint} b The target corner.
   * @returns {{ blocked: boolean, cover: CoverLevel }} Whether this obstacle blocks the Cover Line, and the
   *   Cover Line level it contributes.
   */
  blocksLine(a, b) {
    const waypoints = [
      { x: a.x, y: a.y, elevation: a.elevation ?? 0 },
      { x: b.x, y: b.y, elevation: b.elevation ?? 0 }
    ];
    const blocked = this.region.segmentizeMovementPath(waypoints, [{ x: 0, y: 0 }]).length > 0;
    return blocked ? { blocked: true, cover: this.cover } : { blocked: false, cover: "none" };
  }

  /* -------------------------------------------- */

  /**
   * Resolve everything about this obstacle for an attacker/target pair that does not depend on which
   * specific Cover Line is being tested: the size/type filters, whether both tokens are inside the Region,
   * and (when so) the interior distance check.
   *
   * @param {TokenDocument|Position} attackerToken The attacker token document, or a plain position (AoE origins).
   * @param {TokenDocument} targetToken The target token document.
   * @returns {{ blocked: boolean, cover: CoverLevel }|null} The final result if already resolved for every
   *   Cover Line between this pair, or `null` if `blocksLine` must still be called per Cover Line.
   */
  evaluateTokens(attackerToken, targetToken) {
    const notBlocked = { blocked: false, cover: "none" };

    if ( this.#isIgnoredToken(targetToken) ) return notBlocked;
    const aInside = attackerToken?.testInsideRegion?.(this.region)
      ?? this.region.testPoint({ x: attackerToken.x, y: attackerToken.y, elevation: attackerToken.elevation ?? 0 });
    const bInside = targetToken?.testInsideRegion?.(this.region);
    if ( !aInside || !bInside ) return null;

    if ( this.interiorNeverBlocks ) return notBlocked;
    if ( this.interiorBlockDistance === 0 ) return { blocked: true, cover: this.cover };
    const blocked = getTokenTokenDistance(attackerToken, targetToken) > this.interiorBlockDistance;
    return blocked ? { blocked: true, cover: this.cover } : notBlocked;
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
    if ( this.sizes.size && this.sizes.has(actor.system?.traits?.size) ) return true;
    if ( this.types.size && this.types.has(actor.system?.details?.type?.value) ) return true;
    return false;
  }
}

/* -------------------------------------------- */

/**
 * Register the obstacle Region Behavior type used to block Cover Lines.
 * @returns {void}
 */
export function initCoverObstacleRegionBehavior() {
  CONFIG.RegionBehavior.dataModels["simplecover5e.coverObstacle"] = CoverObstacleRegionBehaviorType;
  CONFIG.RegionBehavior.typeLabels["simplecover5e.coverObstacle"] = "SIMPLE_COVER_5E.RegionBehavior.CoverObstacle.label";
  CONFIG.RegionBehavior.typeHints["simplecover5e.coverObstacle"] = "SIMPLE_COVER_5E.RegionBehavior.CoverObstacle.hint";
}
