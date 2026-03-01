# Changelog

## 2.0.0

This release was originally planned as a **Foundry V14-only** update. However, most of the work is already possible in **V13**, so 2.0.0 now ships with **V13 compatibility** while being **V14-ready**.

⚠️ **V14 is still in development.** V14 support in this release should be considered **“V14-ready / beta”** until it has been verified against a V14 stable build.

### Breaking Changes

* **V14+ only:** Removed the module’s custom **Token Height** support. The module now relies on Foundry’s built-in **Token Depth** (Token Configuration). Height is calculated as `token.depth * grid.distance`.
* **Gridless Token Default Shape:** This optional setting now defines the **default token shape on gridless scenes** and is applied to all tokens on gridless scenes as a workaround for **[dnd5e#6739](https://github.com/foundryvtt/dnd5e/issues/6739)**.

### Changes

* **Line of Sight (LoS):** Testing now uses Foundry’s built-in `canvas.visibility._createVisibilityTestConfig` with `tolerance = canvas.grid.size / 4`. This increases sampling points for larger tokens and aligns results more closely with Foundry’s vision rules. LoS tests now **short-circuit** on the first successful hit (**disabled in Debug Mode**).
* Expanded the workaround for **[foundryvtt#4509](https://github.com/foundryvtt/foundryvtt/issues/4509)** (introduced in **v1.4.2**): for clipping tokens, any test points that **do not** have LoS to the token’s center are **filtered out** before evaluating LoS or Cover.
* **Gridless scenes:** Token shape now uses `tokenDoc.shape` (`CONST.TOKEN_SHAPES`) instead of a module-specific override.
* **3D Cover & Line of Sight (LoS)**

  * **Vision Origin Handling**

    * **Attacker:** Always uses the token’s **vision-origin elevation** for both **Cover** and **LoS**.
    * **Target (Cover only):** Uses the target’s **vision-origin elevation** for **Cover** checks. This better matches the “**at least ~50% visible**” intent (“Another creature or an object that covers at least half of the target…”) and prevents **Small creatures from fully blocking larger tokens**. This is consistent with the behavior already used for **wall checks** when running with **wall-height**.
    * **V13 fallback / approximation:** Since Foundry **V13** doesn’t expose native **vision-origin elevation**, we approximate it using the token’s **midpoint elevation** (≈ **50% of token height**).
  * **LoS Target Sampling**

    * For **LoS** we do **not** rely only on the target’s vision origin. Instead, we sample **multiple elevation test points** across the target based on **Token Height**. This mirrors the practical effect of Foundry **V14**’s `getTestPoint()` behavior and improves LoS reliability on **3D scenes**. (On strictly **2D** scenes the impact is minimal, since LoS is typically dominated by walls.)
  * **Notes**

    * These changes (a) improve compatibility with upcoming **V14 Scene Levels**, and (b) stop **undersized tokens** from producing unrealistic full-block situations against **larger creatures**.
    * There’s no clear RAW requirement that rays must be computed strictly from “**token bottom**”; from an RAI perspective this approach is generally more sensible.
    * If there’s demand, we can add an optional setting to restore classic **token-bottom-only** Cover checks.

* Optimized `buildCreaturePrism` across all grid types for improved performance. **Occluder Inset (px)** now scales consistently with other inset values.
* Reworked distance calculations, as the previous implementation did not behave as intended:
  * **Square/hex grids:** Measure as usual **center-to-center**.
  * **Gridless scenes:** Respect the selected distance mode; **Edge** mode uses the token’s **outer radius**, including rectangular tokens (not perfect for every edge case, but avoids disproportionate complexity).
  * Distance now uses the **shortest effective range**, taking into account each token’s vertical span (bottom elevation through creature height), where applicable.
* General cleanup, bug fixes, and performance improvements.

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
