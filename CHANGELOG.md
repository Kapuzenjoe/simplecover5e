# Changelog

## 2.1.0

- **Removed Foundry V13 support**. Simple Cover 5e now relies on only Foundry V14 token depth and native token geometry.
- Removed the old configurable Creature Heights menu and Wall Height creature height support. This was already disabled in V14+, so this only removes unused V13-era code.
- When Midi-QOL is configured with `coverCalculation === "simplecover5e"`, Simple Cover 5e now behaves like Library Mode and only acts as a cover provider.
  - In this mode, the cover workflow stays in Midi-QOL's hands to avoid conflicting roll mutations.
  - Roll dialog cover notes are currently disabled for this Midi-QOL workflow. Keeping them in sync with Midi-QOL causes too many edge cases, so this needs a different strategy or should remain in Midi-QOL.
- Simplified and shortened the roll dialog cover hint text for attacks and Dexterity saving throws.
  - Fixed hidden NPC names not being respected consistently in attack cover hints.
- The optional GM-only cover-change summary is now attached to the existing roll chat card instead of creating a separate blind-roll chat message.
- Aligned attack and saving throw token resolution more closely with the DnD5e roll message workflow.
  - Saving throws now resolve their target/source tokens from the current speaker and originating usage message where possible.
- Removed the old `9999` save-bonus workaround for Total Cover on Dexterity saving throws. **Total Cover now marks the roll as blocked**, removes the cover bonus, and prevents the saving throw roll/chat message from being created.
- Optimized cover status handling by resolving DnD5e cover effects from `CONFIG.statusEffects` instead of hardcoded effect ids.
  - Cover cleanup now targets the normal DnD5e cover effects more precisely, avoiding accidental cleanup of embedded/custom cover statuses from other Active Effects.
- **Prone Mode** now also affects attackers and targets during cover calculation, allowing prone to act as a simple ducking mechanic. For example, with Half Height enabled, a prone attacker uses half height as its attack height.
- Blocking creature tokens are now resolved from the current scene document data instead of active canvas placeables.
  - Hidden and defeated tokens are ignored using Foundry/DnD5e document state instead of hardcoded status assumptions.
- Changing Gridless Token Default Shape now only affects newly created tokens by default.
  - Added a separate **Apply Gridless Shape to Existing Tokens** option to explicitly update existing tokens on gridless scenes.
- Cover cleanup now runs on combat turn changes and on the recorded end of token movement, reducing redundant updates.
- Token outer radius is now resolved centrally from document data and reused consistently across cover and distance calculations.
- Updated the German localization.
- General cleanup, smaller bug fixes, and performance improvements.
- New project folder structure for better organization.

## 2.0.0

### Breaking Changes

- **V14+ only:** Removed the module’s custom **Token Height** support. The module now relies on Foundry’s built-in **Token Depth** setting in Token Configuration. Height is calculated as `Z (token.dept) * grid.distance`.
- **Gridless Token Default Shape:** This optional setting now defines the **default token shape for gridless scenes**. It is applied to all tokens on gridless scenes as a workaround for **[dnd5e#6739](https://github.com/foundryvtt/dnd5e/issues/6739)**.

### Changes

- **Line of Sight (LoS):** When the attacker is a token with active vision, LoS testing now uses the attacker's `losPolygon`. Target sampling now uses Foundry's built-in `getVisibilityTestPoints()` where available; in V13, this behavior is simulated.
- Improved token clipping: test points that are unreachable from the token's center are now filtered out before cover is evaluated.
- Added a new **Engine Rules** setting, **Filtered Target Points**, to control how target test points removed by token clipping affect cover evaluation. (#31)
  - **Treat as Blocked** (default) preserves the previous behavior and counts filtered target points as blocked.
  - **Treat as Clear** treats filtered target points as unblocked.
  - **Dynamic Threshold** keeps the current Half Cover behavior (at least one blocked line), but grants Three-Quarters Cover when at least three-quarters of the remaining valid lines are blocked.
- **3D Cover:**
  - Cover and LoS checks now use the token's **vision origin** (approximated as half the token's height), aligning more closely with Foundry's own vision behavior.
  - This improves forward compatibility with expected **V14 Scene Levels** behavior.
  - This also avoids unrealistic "fully blocked" results caused by undersized tokens when targeting larger creatures.
- **Gridless scenes:** Token shape now uses `tokenDoc.shape` (`CONST.TOKEN_SHAPES`) instead of a module-specific override.
- Optimized `buildCreaturePrism` across all grid types for improved performance and accuracy.
- **Occluder Inset (px)** now scales consistently with the module’s other inset values.
- Reworked distance calculations:
  - **Square/hex grids:** distance is now calculated in a way that is comparable to movement distance, without applying movement penalties or extra costs. The check now uses both the token's bottom elevation and top elevation (`elevation + height`).
  - Removed **Center to Center**, as it produced unintuitive results in play. For example, a Huge token attacking a Small token could always end up with a range greater than 5 ft, which does not make sense for gameplay.
  - Renamed **Edge to Edge** to **Distance Between Tokens**.
  - Renamed **Source Center to Edge** to **Distance to Target Space**.
  - **Gridless scenes:** **Distance to Target Space** is intended to match the same result as square/hex grids, at least when the global diagonal setting is **Exact (√2)**.
  - **Gridless scenes with "Distance Between Tokens":** this mode uses the token’s **outer radius**, including rectangular tokens. This is not perfect for every edge case involving rectangular tokens, but avoids disproportionate complexity. (It may be improved further in a future update.)
- Added support for adjusting the calculated cover status directly in the roll dialog’s cover notes. The active GM also receives an optional chat message whenever the cover status changes. (#29)
  - Also added compatibility with the "Hide NPC Names" mod.
  - This dialog feature currently only works when Library Mode is disabled.
  - When using Midi-QOL, disable Library Mode and set Midi-QOL's "Calculate Cover" option to `none` for now.
- Changed the cover notes display setting from a toggle to a mode selection: `never`, `only when cover applies` or `always`.
- Cover automation now only applies to Dexterity saving throws.
- Added object support for `flags.simplecover5e.upgradeCover.all`, `.attack`, and `.save`. These flags now accept `{ steps, min, max, condition? }` in addition to legacy numeric values (`1` / `2`), which remain fully backward compatible. `steps` accepts `1` or `2`, while `min` and `max` accept `none`, `half`, `threeQuarters`, or `total` as min/max current Cover. With `condition`, you can specify an optional status the target actor must have for the upgrade effect to apply. (#30)
  - example for "Enhanced Camouflage" from Ultramodern5E Redux: `flags.simplecover5e.upgradeCover.all ADD { steps: 1, min: "half", max: "threeQuarters" }`
  - example for "Low Profile" from Ultramodern5E Redux: `flags.simplecover5e.upgradeCover.all ADD { steps: 1, min: "none", max: "threeQuarters", condition: "prone" }`
- Added new `flags.simplecover5e.downgradeCover.all`, `.attack`, and `.save` flags. These flags accept `{ steps, min, max,condition? }`, where `steps` accepts `1` or `2`, and `min` / `max` accept `none`, `half`, `threeQuarters`, or `total` as min/max current Cover. With `condition`, you can specify an optional status the source actor must have for the upgrade effect to apply. (#32)
  - example for "Penetration Shot" from Ultramodern5E Redux: `flags.simplecover5e.downgradeCover.all ADD { steps: 1, min: "half", max: "total" }`
- Added scoped variants for `flags.simplecover5e.ignoreAllCover`, `ignoreThreeQuartersCover`, and `ignoreHalfCover` via `.all`, `.attack`, and `.save` boolean flags. Legacy flags remain supported and continue to behave as attack-only flags for backward compatibility.
- Refactored cover flag semantics for clearer source/target behavior:
  - **`upgradeCover`** is a **defensive** flag placed on the actor being protected. It increases that actor’s effective cover when they are the target of an attack or effect.
  - **`ignore*Cover`** is an **offensive** flag placed on the actor making the attack or effect. It causes the targeted actor’s cover to be ignored.
  - **`downgradeCover`** is an **offensive** flag placed on the actor making the attack or effect. It reduces the targeted actor’s effective cover instead of ignoring it completely.
- Due to changes in Midi-QOL, SimpleCover5e no longer strictly requires Library Mode to be active when used with Midi-QOL (thanks to @tposney).
- General cleanup, bug fixes, and performance improvements.

## Version 1.4.4

- Minor fix to cover and line-of-sight checks when using positions instead of the actor document.

## Version 1.4.3

- Added an optional setting to treat friendly tokens (occluder) as non-blocking for attacker cover calculation (#27).
- Fixed an issue in the wall-height module where walls with infinite height didn’t block correctly (#28).

## Version 1.4.2

- Library Mode can now be enabled/disabled directly from the Settings menu. (#26)
- Reworked wall collision detection for edge cases: a (configured inset) corner used for attacker/target cover calculation must now have LoS to the corresponding token center; corners blocked by a wall are automatically treated as blocked. These corners may still show up in debug visuals for some 3/4 cover cases (e.g., if no other corner has at least two non-blocked lines and it was the last corner checked).

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
