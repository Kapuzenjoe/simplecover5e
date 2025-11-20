# Changelog

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