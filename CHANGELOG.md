# Changelog

## Version 1.4.1

- Prevented duplicate SimpleCover5e dialog notes fieldsets by removing any existing `dialog-notes` fieldset before injecting the notes during dialog render.
- Removed hover labels from deleted tokens (if present) (#23).
- Added support for the **Rideable** module. Tokens on rideables are no longer blocked by the rideable itself (#24).
- The `Hooks.on("simplecover5eReady", (api) => {}` hook is now fired during Foundry VTT’s `ready` phase instead of `init`.

## Version 1.4.0

This may be the last larger update before Foundry VTT v14. In V14, I plan to directly support the core scene level. I'm keeping the future integration of the wall-height module open for now, and I may further optimize the occluder algorithm (for example by using pseudo-walls).

- Added an optional setting to display cover notes in attack and saving throw roll dialogs (#18).
- Added `api.setDialogNote()` for injecting custom notes into roll configuration dialogs (see Wiki: [API-(Library-Mode)](https://github.com/Kapuzenjoe/simplecover5e/wiki/API-(Library-Mode))).
- Fixed `getTokenTokenDistance()` to correctly accept either a `Token` or a `TokenDocument` as the parameter type.
- Fixed an issue where actor flags were incorrectly read from the attacker during saving throw rolls (they are now only applied to attack rolls) (#20).
- Added new `upgradeCover` flags to increase a target actor’s current cover level by one or two steps (depending on the configured value). For example, setting `flags.simplecover5e.upgradeCover.all ADD 1` upgrades half cover to three-quarters cover, while setting it to `2` upgrades half cover directly to total cover (#19).
- Added an Automation setting menu to sort and manage all automation configs. These automations are disabled when Library Mode is active.
- Refactored and harmonized the Settings menu classes and their corresponding .hbs templates.
- The spell "Sacred Flame" now automatically ignores cover unless it is total cover. While the 2014 and 2024 versions use different wording, both only ignore cover if the target is LoS. Detection is performed via the spell’s name `Sacred Flame` or its item identifier `sacred-flame`.

## Version 1.3.2

- Fixed an issue where custom cover granted by an Active Effect (e.g., “Swallow” applying Total Cover) could be ignored or overwritten. Cover resolution for attack rolls and saving throws now applies the highest active cover level across both the calculated cover result and any custom cover statuses on the target (#16).
- Added support for using a generic position object `{ x, y, elevation? }` as the `attacker` parameter in `getCover()` and `getCoverForTargets()`, and as the `attackerDoc` parameter in `getLOS()` (#17).
- Added new settings to configure pixel-based inset values for cover sampling points (attacker/target) and creature occluder bounds. These insets shift sampling points toward token centers and slightly shrink creature occluder bounding boxes (previously hardcoded to 2 px; now defaults to 1 px for the attacker token and 3 px each for the target token and blocking creature occluders, as this yields better results in my testing).
- General code cleanup and optimizations. When the wall-height module is active, wall-blocking checks should be more performant.

## Version 1.3.1

This update primarily includes fixes and optimizations following the last [1.3.0](<https://github.com/Kapuzenjoe/simplecover5e/releases/tag/1.3.0>) release.

- Updated and corrected the German localization.
- Improved item detection by also searching for the identifier **"wand-of-the-war-mage"** (#14).
- Updated `getLOS()` so the evaluation context (`ctx`) is now optional. If `getLOS()` is called without a `ctx`, the function automatically builds a default context from the current scene.
- Added `api.getTokenTokenDistance(sourceToken, targetToken)` to retrieve the distance between two tokens in grid units. Gridless distance mode settings are respected.

## Version 1.3.0

Big Holiday Update: optional wall-based LoS checks (Total Cover), actor flags and a more capable Library Mode API.

- **Cover rules expansion:** cover rules evaluation now considers the *computed* cover level and returns the resolved `cover` plus its associated AC/DEX `bonus`.
- **Breaking (API):** `api.getIgnoreCover(activity)` --> `api.getIgnoreCover(activity, cover)`  
  - Return type changed from `boolean` to `{ cover: ("none"|"half"|"threeQuarters"|"total"), bonus: (number|null) }`.
- **New (Optional): Wall LoS check for Total Cover** (#15)  
  - Mirrors Foundry’s visibility sampling: a single origin at the attacker’s vision-source position and a 3×3 grid around the target center.
- **API extensions:** `api.getCover` and `api.getCoverForTargets` now support:
  - `losCheck` to automatically run the wall-based LoS check as part of cover evaluation.
  - `activity` for direct cover rules integration.
- **API output improvement:** `api.getCover` / `api.getCoverForTargets` now also return the AC/DEX cover `bonus` (0, 2, 5, or `null` for Total Cover).
- **New (API):** `api.getLOS(attackerDoc, targetDoc, ctx)` to run the wall-based LoS check independently (without computing cover).
- **Debug:** cover debug overlay now supports multi-target workflows and shows LoS check Points.
- **Rules:** added actor flags for ignore-cover behavior (#14).
- **Rules:** automated cover rules handling for *Wand of the War Mage* (currently detected by name only) (#14).
- **Maintenance:** general code cleanup, harmonization, and optimizations.
- **Docs:** new Wiki pages for Settings, Cover Rules, and API (Library Mode): [Wiki](<https://github.com/Kapuzenjoe/simplecover5e/wiki>)

## Version 1.2.4

- Added `api.getIgnoreCover(activity)` to let integrations determine whether cover should be ignored for a given activity when "Library Mode" is enabled.
- Extended the optional “Ignore cover for ranged AoE spells” behavior with two additional toggles: “Ignore cover for all area effects” and “Ignore cover for ranged space targeting” (#13).

## Version 1.2.3

- Added optional setting “Ignore cover for ranged AoE spells” to skip cover checks for ranged area effects (e.g., Fireball) when range is greater than 1 and the effect uses an AoE template (non-self/touch/special) or targets space (#13).

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
