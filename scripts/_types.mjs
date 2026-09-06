/**
 * @typedef {"none"|"half"|"threeQuarters"|"total"} CoverLevel
 */

/**
 * @typedef Position
 * @property {number} x The horizontal canvas position.
 * @property {number} y The vertical canvas position.
 * @property {number} [elevation=0] The elevation in scene distance units.
 * @property {string|null} [level=null] The active Levels identifier, if any.
 */

/**
 * @typedef {Position} TestPoint
 */

/**
 * @typedef {"all"|"combatants"|"players"} CoverRemovalScope
 */

/**
 * @typedef LosPoint
 * @property {number} x The horizontal canvas position.
 * @property {number} y The vertical canvas position.
 * @property {boolean} blocked Whether the sample point is blocked.
 */

/**
 * @typedef LosResult
 * @property {boolean} hasLOS Whether at least one sampled point has line of sight.
 * @property {LosPoint[]} targetLosPoints The sampled target points used for the LOS test.
 */

/**
 * @typedef CoverContext
 * @property {Scene} scene The scene being evaluated.
 * @property {BaseGrid} grid The scene grid helper.
 * @property {number} halfGridSize Half the current grid size in pixels.
 * @property {number} distancePixels The pixel-to-distance scale for the scene.
 * @property {number} insetAttackerPx The configured attacker inset in pixels.
 * @property {number} insetTargetPx The configured target inset in pixels.
 * @property {number} insetOccluderPx The configured occluder inset in pixels.
 * @property {object|string|null} level Cached active-canvas level for this pass.
 */

/**
 * @typedef DebugPoint
 * @property {number} x The horizontal canvas position.
 * @property {number} y The vertical canvas position.
 * @property {boolean} [blocked=false] Whether the sampled point is blocked.
 */

/**
 * @typedef {DebugPoint[]} DebugPolygon
 */

/**
 * @typedef DebugSegment
 * @property {DebugPoint} a The start point of the sampled segment.
 * @property {DebugPoint} b The end point of the sampled segment.
 * @property {CoverLevel} lineCover The cover level this Cover Line contributes.
 * @property {boolean} blocked Whether the sampled segment is blocked.
 */

/**
 * @typedef DebugTokenShapes
 * @property {DebugPolygon[]} attacker The sampled attacker outlines.
 * @property {DebugPolygon[]} target The sampled target outlines.
 * @property {DebugPolygon[]} occluders The sampled occluder outlines.
 */

/**
 * @typedef CoverDebugOptions
 * @property {DebugSegment[]} [segments=[]] The sampled cover segments to draw.
 * @property {DebugTokenShapes|null} [tokenShapes=null] Optional token and occluder outlines to draw.
 * @property {LosPoint[]} [targetLosPoints=[]] Optional LOS sample points to draw.
 */

/**
 * @typedef OccluderPrism
 * @property {PIXI.Polygon} polygon The occluder's 2D footprint in canvas pixels.
 * @property {number} minZ The minimum Z boundary in pixels.
 * @property {number} maxZ The maximum Z boundary in pixels.
 */

/**
 * @typedef CoverRuleFlagObject
 * @property {CoverLevel} [min] The minimum current cover that allows the flag to apply.
 * @property {CoverLevel} [max] The maximum current cover that allows the flag to apply.
 * @property {number} [steps] The number of cover steps to add or remove.
 * @property {string} [condition] The status id required for the flag to apply.
 */

/**
 * @typedef CoverEvaluationResult
 * @property {CoverLevel} cover The resolved cover level.
 * @property {0|2|5|null} bonus The resolved cover bonus.
 * @property {DebugSegment[]} [debugSegments] Optional debug segments gathered during evaluation.
 * @property {DebugTokenShapes} [debugTokenShapes] Optional debug shapes gathered during evaluation.
 */

/**
 * @typedef CoverTargetResult
 * @property {Token|TokenDocument} target The evaluated target.
 * @property {CoverEvaluationResult} result The cover result for the target.
 * @property {LosResult} los The LOS result for the target.
 */

/**
 * @typedef DialogNoteData
 * @property {CoverLevel|null} [cover=null] The cover level represented by the note.
 * @property {string|null} [target=null] The target identifier associated with the note.
 * @property {string} [icon=""] The icon class or image data used by the note.
 * @property {string} [label=""] The note label shown in the dialog.
 * @property {string} [hint=""] The note hint shown in the dialog.
 */

/**
 * @typedef CoverLevelStrings
 * @property {string} none The string value for no cover.
 * @property {string} half The string value for half cover.
 * @property {string} threeQuarters The string value for three-quarters cover.
 * @property {string} total The string value for total cover.
 */

/**
 * @typedef CoverHintKeys
 * @property {CoverLevelStrings} attack Localization keys for attack-roll cover hints, keyed by cover level.
 * @property {CoverLevelStrings} save Localization keys for saving-throw cover hints, keyed by cover level.
 */

/**
 * @typedef CoverI18N
 * @property {string} LABEL_PREFIX_KEY Localization key prefix shared by the cover status labels.
 * @property {CoverLevelStrings} LABEL Localization keys for the cover level labels, keyed by cover level.
 * @property {CoverHintKeys} HINT_KEYS Localization keys used by the roll dialog cover hints.
 */

/**
 * @typedef CoverStatusIds
 * @property {null} none No status effect for no cover.
 * @property {string} half The dnd5e system status effect id for half cover.
 * @property {string} threeQuarters The dnd5e system status effect id for three-quarters cover.
 * @property {string} total The dnd5e system status effect id for total cover.
 */

/**
 * @typedef CoverBonusMap
 * @property {number} none The AC/Dexterity-save bonus for no cover.
 * @property {number} half The AC/Dexterity-save bonus for half cover.
 * @property {number} threeQuarters The AC/Dexterity-save bonus for three-quarters cover.
 * @property {number|null} total The AC/Dexterity-save bonus for total cover, or null if it can't be targeted.
 */

/**
 * @typedef CoverOrderMap
 * @property {number} none The sort order for no cover.
 * @property {number} half The sort order for half cover.
 * @property {number} threeQuarters The sort order for three-quarters cover.
 * @property {number} total The sort order for total cover.
 */

/**
 * @typedef CoverConstants
 * @property {CoverStatusIds} IDS Maps cover levels to dnd5e system effect ids (or null for none).
 * @property {CoverBonusMap} BONUS Maps cover levels to AC/Dexterity-save bonus (null for total cover).
 * @property {CoverOrderMap} ORDER Numeric ordering for comparing cover levels.
 * @property {CoverLevel[]} KEYS The cover levels in canonical order.
 * @property {CoverI18N} I18N Localization keys used for cover labels and roll dialog hints.
 */

/**
 * @typedef ActorCoverStates
 * @property {CoverLevel} statusCover The highest active system cover status, or "none".
 * @property {CoverLevel} embeddedCover The highest active embedded cover effect, or "none".
 */

/**
 * @typedef CoverObstacleRegionBehaviorSystemData
 * @property {"half"|"threeQuarters"} cover        The cover level this obstacle grants when it blocks a Cover Line.
 * @property {Set<string>} sizes                   Actor sizes exempt from this obstacle, if any.
 * @property {Set<string>} types                   Creature types exempt from this obstacle, if any.
 * @property {boolean} interiorNeverBlocks         Never block Cover Lines between two tokens both inside the Region.
 * @property {number} interiorBlockDistance        Distance beyond which two tokens inside the Region are
 *   blocked (0 = always).
 */
