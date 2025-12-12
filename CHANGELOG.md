# Changelog

## Version 1.2.2

- Fixed Tiny attacker/target sampling on hex grids: Tiny tokens no longer use the full hex cell footprint for corner/ray evaluation.
- Fixed creature occluders on hex grids: occluding tokens are now approximated with shrunken per-occupied-hex AABBs (plus a center filler for larger sizes) to better match hex cell footprints while keeping fast AABB-based intersection tests (#11).

## Version 1.2.1

- Add Japanese translation. (#12)
- Better JS DOCs for the API Mode Code.

## Version 1.2.0

- Added a cover debug overlay that visualizes cover rays, token shapes, and creature occluders.
- Added a gridless token shape setting to treat tokens as either squares or circles for both distance and cover calculations (#9).
- Creatures with 0 max hit points are now ignored as cover blockers.
- Refactored cover evaluation.
- Debug mode is now also available via Library mode.

## Version 1.1.0

- Added a new Cover & Measurement Rules configuration menu.
- Added an optional prone height adjustment for cover calculations (none, half height, or treat as one size smaller) (#10).

## Version 1.0.0

- 1st Stable Release.
- Code cleanup and more JS DOCS.
- Added compatibility with the **Wall Height** module: token LOS heights and wall height bounds are now used for 3D cover evaluation when the module is active. This integration is considered transitional and may become obsolete once Foundry VTT v14 ships native Scene Levels support.

## Version 0.5.1

- Fixed cover evaluation to ignore hidden, ethereal, and dead creatures as blockers.
- Fixed cover handling to respect manually applied Total Cover (e.g. swallowed creatures): tokens with a Total Cover status are no longer recalculated or modified by the module.
- Changed hover-related settings scope from "client" to "user" so they now apply per Foundry user instead of per browser client.

## Version 0.5.0

- Added localisation support.
- Switched hover label from PIXI to HTML for better customization.
- Added new configuration options for the hover label (position and offsets) (#7).
- Added optional distance display modes (off / cover only / cover + distance) (#7).
- Added configurable gridless distance modes (center–center, edge–center, and edge–edge) for hover range measurement (#7).
- Removed obsolete code.

## Version 0.4.0

- Small internal fixes and more robust `try/catch` handling.
- Show cover information on token hover, including distance between attacker and target (#5).
- Add a button to clear cover statuses from tokens - honoring the selected Cover Removal Scope (#4).
- Add an API / library mode so other modules can consume Simple Cover 5e’s cover results directly (#6).

## Version 0.3.1

- Fixed module title.
- Added automatic cleanup when disabling **Show Cover Debug Lines**, removing existing debug drawings when DEBUG is turned off (#3).
- Fixed cover evaluation on hex maps (note: Tiny creatures currently still use the full hex as their footprint).
- Improved cover evaluation on square maps so calculations correctly respect token positions even when tokens are shifted within a grid cell (e.g. near windows or arrow slits).

## Version 0.3.0

- Added optional setting **Limit Cover from Creatures to 1/2 Cover**: creatures can no longer grant 3/4 cover by themselves (#2).
- Improved performance by short-circuiting when an attacker corner has fully clear line of effect to all target corners.
- Added **gridless cover** support using virtual cells for large/huge tokens, approximating square-grid cover where no RAW gridless guidance exists (feedback and alternative approaches welcome).
- Refined Tiny creature cover on square, gridless, and hex grids by using the token’s actual position and footprint instead of the grid cell center.
- Added optional setting **Apply Cover Only In Combat** to run automatic cover calculation only while a combat encounter is active.
- Added **hex grid cover** support using 6-ray evaluation and scaled hex footprints per creature size.

## Version 0.2.0

- Support for **Sharpshooter** and **Spell Sniper** when determining whether an attack ignores cover (#1)
- Added a dedicated **Creature Heights** settings menu

## Version 0.1.0

- first release

## Version 0.0.1

- inital comment
