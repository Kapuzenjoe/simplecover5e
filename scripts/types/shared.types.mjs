/**
 * @typedef {"none"|"half"|"threeQuarters"|"total"} CoverLevel
 */

/**
 * @typedef {object} Position
 * @property {number} x The horizontal canvas position.
 * @property {number} y The vertical canvas position.
 * @property {number} [elevation=0] The elevation in scene distance units.
 * @property {string|null} [level=null] The active Levels identifier, if any.
 */

/**
 * @typedef {Position} TestPoint
 */

/**
 * @typedef {object} LosPoint
 * @property {number} x The horizontal canvas position.
 * @property {number} y The vertical canvas position.
 * @property {boolean} blocked Whether the sample point is blocked.
 */

/**
 * @typedef {object} LosResult
 * @property {boolean} hasLOS Whether at least one sampled point has line of sight.
 * @property {LosPoint[]} targetLosPoints The sampled target points used for the LOS test.
 */

/**
 * @typedef {object} CoverContext
 * @property {Scene} scene The scene being evaluated.
 * @property {Grid} grid The scene grid helper.
 * @property {number} halfGridSize Half the current grid size in pixels.
 * @property {number} distancePixels The pixel-to-distance scale for the scene.
 * @property {number} insetAttackerPx The configured attacker inset in pixels.
 * @property {number} insetTargetPx The configured target inset in pixels.
 * @property {number} insetOccluderPx The configured occluder inset in pixels.
 * @property {Token[]} placeables Cached active-canvas placeables for this pass.
 * @property {object|string|null} level Cached active-canvas level for this pass.
 */

/**
 * @typedef {object} DebugPoint
 * @property {number} x The horizontal canvas position.
 * @property {number} y The vertical canvas position.
 * @property {boolean} [blocked=false] Whether the sampled point is blocked.
 */

/**
 * @typedef {DebugPoint[]} DebugPolygon
 */

/**
 * @typedef {object} DebugSegment
 * @property {DebugPoint} a The start point of the sampled segment.
 * @property {DebugPoint} b The end point of the sampled segment.
 * @property {boolean} blocked Whether the sampled segment is blocked.
 */

/**
 * @typedef {object} DebugTokenShapes
 * @property {DebugPolygon[]} attacker The sampled attacker outlines.
 * @property {DebugPolygon[]} target The sampled target outlines.
 * @property {DebugPolygon[]} occluders The sampled occluder outlines.
 */

/**
 * @typedef {object} CoverDebugOptions
 * @property {DebugSegment[]} [segments=[]] The sampled cover segments to draw.
 * @property {DebugTokenShapes|null} [tokenShapes=null] Optional token and occluder outlines to draw.
 * @property {LosPoint[]} [targetLosPoints=[]] Optional LOS sample points to draw.
 */

/**
 * @typedef {object} OccluderPrism
 * @property {number} minX The minimum X boundary in pixels.
 * @property {number} minY The minimum Y boundary in pixels.
 * @property {number} maxX The maximum X boundary in pixels.
 * @property {number} maxY The maximum Y boundary in pixels.
 * @property {number} minZ The minimum Z boundary in pixels.
 * @property {number} maxZ The maximum Z boundary in pixels.
 */

/**
 * @typedef {object} CoverRuleFlagObject
 * @property {CoverLevel} [min] The minimum current cover that allows the flag to apply.
 * @property {CoverLevel} [max] The maximum current cover that allows the flag to apply.
 * @property {number} [upgrade] The number of cover steps to add.
 * @property {number} [downgrade] The number of cover steps to remove.
 */

/**
 * @typedef {object} CoverEvaluationResult
 * @property {CoverLevel} cover The resolved cover level.
 * @property {0|2|5|null} bonus The resolved cover bonus.
 * @property {DebugSegment[]} [debugSegments] Optional debug segments gathered during evaluation.
 * @property {DebugTokenShapes} [debugTokenShapes] Optional debug shapes gathered during evaluation.
 */

/**
 * @typedef {object} CoverTargetResult
 * @property {Token|TokenDocument} target The evaluated target.
 * @property {CoverEvaluationResult} result The cover result for the target.
 * @property {LosResult} los The LOS result for the target.
 */

/**
 * @typedef {object} DialogNoteData
 * @property {CoverLevel|null} [cover=null] The cover level represented by the note.
 * @property {string|null} [target=null] The target identifier associated with the note.
 * @property {string} [icon=""] The icon class or image data used by the note.
 * @property {string} [label=""] The note label shown in the dialog.
 * @property {string} [hint=""] The note hint shown in the dialog.
 */
