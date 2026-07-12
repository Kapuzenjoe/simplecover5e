# Settings

This page explains the available settings in Simple Cover 5e and the options each setting provides.

## Configure Cover Automation

Configure cover automation and what information is shown in roll dialogs. If **Library Mode** is enabled, all automation is disabled and this menu is locked.

### Cover Hints

Controls whether the module shows the current cover result in attack and saving throw roll dialogs.

- **Never**
  No cover hint is shown.
- **Only When Cover Applies** (default)
  A cover hint is shown only when the target has cover.
- **Always**
  A cover hint is shown for every evaluated target.

### GM Chat Cover Change Indicators

When enabled, the GM chat view shows a warning icon on attack target rows and saving throw totals when cover is changed manually in the roll dialog.

### Library Mode

When enabled, Simple Cover 5e acts as a cover provider only. Cover calculations remain available through the API, but automatic roll handling, cover effects, and roll dialog mutations are disabled. Some integrations, such as Midi-QOL with `simplecover5e` selected as its cover calculation mode, may cause Simple Cover 5e to behave as library-only during their workflows.

### Cover Removal Scope

Choose which tokens are affected when cover effects are cleared:

- **All Tokens on Scene**
  Clears cover from every token on the current scene.
- **Combatants Only** (default)
  Clears cover only from tokens currently in the combat tracker.
- **Player-Owned Tokens Only**
  Clears cover only from tokens that are player-owned.

### Ignore Cover: AoE Templates

Controls when cover checks are skipped for area-of-effect templates. Options are **Disabled** (default), **Ranged AoE** (skips cover for templates with a ranged origin — not self, touch, or special range), and **All AoE** (skips cover whenever any template is defined).

### Apply Cover Only In Combat

When enabled, Simple Cover 5e only performs automatic cover calculation while a combat encounter is active.

### Clear Cover on Combat Updates

When enabled, cover effects are automatically cleared when the active combat turn changes. The affected tokens depend on **Cover Removal Scope**.

### Clear Cover on Token Movement

When enabled, cover effects are automatically cleared when a token moves during an active combat encounter. The affected tokens depend on **Cover Removal Scope**.

### Scene Control: Remove Cover Effects (GM)

A GM-only button is added to the Token controls to remove cover effects using your configured **Cover Removal Scope**.

## Configure Cover & Measurement Rules

Simple Cover 5e provides a dedicated configuration menu for rules that influence cover evaluation and distance measurement.

### Cover Rules

These settings enable or disable optional cover rules. This page lists what can be configured; the mechanical rule details are documented in [Cover Rules](Cover-Rules).

- **Wall Line of Sight Check**
  Performs an additional wall-only line-of-sight check.

- **Limit Cover from Creatures to Half Cover**
  Prevents creatures from granting more than Half Cover on their own.

- **Ignore Cover from Friendly Tokens**
  Ignores friendly creature blockers during cover evaluation.

- **Prone Creature Height Adjustment**
  Controls how prone creatures are treated for 3D cover. Options are **None** (default), **Treat as one size smaller**, and **Treat as half as tall**.

### Measurement Rules

#### Gridless Distance Mode

Choose how distance is measured on gridless scenes:

- **Distance to Target Space** (default)
  Uses Foundry grid path measurement against the token spaces. This is intended to stay close to square/hex grid measurement with the global diagonal setting set to **Exact**.
- **Distance Between Tokens**
  Measures the shortest distance between token boundaries.

#### Gridless Token Shape

Controls how newly created tokens on gridless scenes are shaped for distance and cover:

- **No change** (default)
  Token shapes are left unchanged.
- **Rectangle**
  Tokens are treated as rectangular footprints.
- **Ellipse**
  Tokens are treated as elliptical footprints.

#### Apply Gridless Shape to Existing Tokens

The button next to **Gridless Token Shape** explicitly applies the selected shape to existing tokens. You can choose whether to update only the current scene or all gridless scenes.

### Engine Rules

These settings fine-tune the engine's **pixel-based geometry** used for cover and LoS checks. They help avoid corner-grazing artifacts by moving sampling points inward and by slightly shrinking creature occluder bounds.

All values are **integer pixels only** and **cannot be set below 0**. Additionally, each value is capped at **max 30% of the current grid size**.

- **Attacker Inset (px)**
  Moves the attacker's sampling points from the raw token corners toward the token center.
  **Default:** 1

- **Target Inset (px)**
  Moves the target's sampling points from the raw token corners toward the token center.
  **Default:** 3

- **Occluder Inset (px)**
  Shrinks the creature occluder bounding box slightly, making creature blocking less overly strict at edges.
  **Default:** 6

#### Filtered Target Points

Controls how target test points removed by token clipping affect cover evaluation.

- **Treat as Blocked** (default)
  Removed target points count as blocked.
- **Treat as Clear**
  Removed target points count as clear.
- **Dynamic Threshold**
  Keeps the current Half Cover behavior, but grants Three-Quarters Cover when at least three-quarters of the remaining lines are blocked instead of always using the full target shape.

## Creature Heights (3D Cover)

Creature heights are used to treat tokens as 3D blockers during cover evaluation.

Simple Cover 5e uses Foundry V14's native token depth (`token.document.depth`) together with the scene grid distance. The old configurable Creature Heights menu is no longer used.

Wall Height wall bounds can still affect wall blocking while that integration remains supported, but Wall Height no longer replaces creature height data.

## Hover (Client UI)

### Hover Cover Display

Controls whether and how cover information and distance are shown when hovering a token:

- **Disabled**
  No hover label is shown.
- **Cover icons only**
  Shows a cover icon if cover applies.
- **Cover icons and distance** (default)
  Shows a cover icon (if any) and a distance label.

### Hover Label Position

Choose where the hover label is anchored relative to the hovered token:

- **Above the token**
- **Centered on the token**
- **Below the token** (default)

### Hover Label X/Y Offset

Additional pixel offsets applied to the hover label position:

- **Y Offset** moves the label up/down (positive = down, negative = up).
- **X Offset** moves the label left/right (positive = right, negative = left).

## Debug

### Show Cover Debug Lines

When enabled, Simple Cover 5e draws helper visuals on the canvas while computing cover:

- Lines between the evaluated sample points (green for clear, red for blocked)
- Outlines of the token shapes used internally (attacker, target, and creature occluders)
- Markers for line-of-sight sample points (when LoS checks are enabled)

This is intended for troubleshooting and verifying how cover is being calculated.
