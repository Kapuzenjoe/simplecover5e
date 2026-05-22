# Cover Rules

This page documents how Simple Cover 5e determines *effective cover* after the geometric cover evaluation.

## Overview

Simple Cover 5e evaluates cover in three stages:

1. **Geometric cover result** (engine): returns a cover level (`none`, `half`, `threeQuarters`) and its associated bonus (+0 / +2 / +5).
2. **Line of sight** (optional): can promote the result to `total` if wall LoS is blocked.
3. **Rule adjustments** (rules layer): can override or skip cover based on item properties, actor flags, feats, and optional settings.

## Fixed Rules

These rules are always applied when relevant.

### Cover Levels and Bonuses

| Cover | Bonus |
|------:|:-----:|
| `none` | `0` |
| `half` | `2` |
| `threeQuarters` | `5` |
| `total` | `null` |

### Legacy Item Property: Ignore Cover

If an activity's item has the `ignoreCover` property, cover is ignored for that roll:

- Effective cover becomes `none`
- Bonus becomes `0`

This is legacy support for older item-based cover exceptions. New actor-specific exceptions should use the scoped actor flags documented below.

### Feat: Sharpshooter (Ranged Weapon Attacks)

For `actionType === "rwak"` and cover is **not** `total`:

- If the attacker has **Sharpshooter**, cover is ignored (`none`, bonus `0`)

Detection:

- By `system.identifier === "sharpshooter"` **or**
- By item name `"Sharpshooter"`

### Feat: Spell Sniper (Ranged Spell Attacks)

For `actionType === "rsak"` and cover is **not** `total`:

- If the attacker has **Spell Sniper**, cover is ignored (`none`, bonus `0`)

Detection:

- By `system.identifier === "spell-sniper"` **or**
- By item name `"Spell Sniper"`

### Item: Wand of the War Mage

For ranged or melee spell attacks (`rsak` or `msak`) where cover is exactly `half`:

- If the attacker has an equipped **and attuned** *Wand of the War Mage*, half cover is ignored (`none`, bonus `0`)

Detection:

- By `system.identifier` matching one of:
  - `1-wand-of-the-war-mage`
  - `wand-of-the-war-mage`
  - `wand-of-the-war-mage-1`
  - `wand-of-the-war-mage-2`
  - `wand-of-the-war-mage-3`
- Item name matches `wand of the war mage`

### Spell: Sacred Flame

If the computed cover is **not** total, cover is ignored for Sacred Flame saving throw activities.

Detection:

- By `system.identifier === "sacred-flame"` **or**
- By item name `"Sacred Flame"`


## Optional Rules (Module Settings)

These rules can be enabled/disabled via module settings (see the Settings page).

### Wall Line of Sight Check

- **Setting:** `losCheck`
- **UI Name:** *Wall Line of Sight Check*
- **Purpose:** Detect cases where the target is fully blocked by sight-blocking walls.

When enabled, the module performs an additional wall-only LoS test. If the LoS test fails, the target is treated as having **Total Cover**.

### Limit Cover from Creatures to Half Cover

- **Setting:** `creaturesHalfCoverOnly`
- **UI Name:** *Limit Cover from Creatures to 1/2 Cover*
- **Purpose:** Prevent creatures from granting Three-Quarters Cover on their own.

When enabled:
- Creatures can grant **at most Half Cover**
- As soon as at least one line is blocked by creatures, the target gains Half Cover
- Walls continue to follow the standard DMG-style cover thresholds

### Ignore Cover from Friendly Tokens

- **Setting:** `ignoreFriendly`
- **UI Name:** *Ignore cover from friendly tokens*
- **Purpose:** Ignore creature blockers that have the same disposition as the attacker.

When enabled, friendly tokens are ignored as creature occluders during cover evaluation.

### Ignore Cover for All Area Effects

- **Setting:** `IgnoreAllAOE`
- **UI Name:** *Ignore cover for all area effects*

If an activity defines any area template, cover checks are skipped and effective cover becomes `none`.

Rule:
- If `activity.target.template.type !== ""`, the result becomes `none` / `0`.

### Ignore Cover for Ranged AoE Templates

- **Setting:** `IgnoreDistanceAOE`
- **UI Name:** *Ignore cover for ranged AoE templates*

Skips cover checks for activities that create an area **at range** (e.g. Fireball).

Rule:
- Applies when:
  - `activity.range.value > 1`
  - range units are not `self`, `touch`, `special`
  - template type is not in the excluded list (empty or radius-only)
- If matched, the result becomes `none` / `0`.

Excluded range units:
- `self`, `touch`, `special`

Excluded template types:
- `""` (none)
- `"radius"`

### Ignore Cover for Ranged Space Targeting

- **Setting:** `IgnoreDistanceSpace`
- **UI Name:** *Ignore cover for ranged space targeting*

Skips cover checks when an activity targets a space at range. This is useful for summon features/spells where the *actual* effect originates from the summoned creature.

Rule:
- If `activity.range.value > 1` and `activity.target.affects.type === "space"`, the result becomes `none` / `0`.

## Optional Rules (Actor Flags)

Simple Cover 5e supports actor-scoped overrides via flags. Each flag supports the scopes `.all`, `.attack`, and `.save`.

### Source Actor Flags

Source actor flags are offensive flags. They change cover when the actor with the flag makes an attack or forces a saving throw.

- `flags.simplecover5e.ignoreAllCover.all`
- `flags.simplecover5e.ignoreAllCover.attack`
- `flags.simplecover5e.ignoreAllCover.save`

Ignore all target cover and set the effective result to `none` / `0`.

- `flags.simplecover5e.ignoreThreeQuartersCover.all`
- `flags.simplecover5e.ignoreThreeQuartersCover.attack`
- `flags.simplecover5e.ignoreThreeQuartersCover.save`

Ignore Half Cover and Three-Quarters Cover.

- `flags.simplecover5e.ignoreHalfCover.all`
- `flags.simplecover5e.ignoreHalfCover.attack`
- `flags.simplecover5e.ignoreHalfCover.save`

Ignore Half Cover only.

- `flags.simplecover5e.downgradeCover.all`
- `flags.simplecover5e.downgradeCover.attack`
- `flags.simplecover5e.downgradeCover.save`

Reduce the target's effective cover by 1 or 2 steps.

### Target Actor Flags

Target actor flags are defensive flags. They improve the cover of the actor who has the flag.

- `flags.simplecover5e.upgradeCover.all`
- `flags.simplecover5e.upgradeCover.attack`
- `flags.simplecover5e.upgradeCover.save`

Increase the actor's effective cover by 1 or 2 steps.

### Flag Values

Ignore flags use boolean values. Upgrade and downgrade flags accept either a numeric value (`1` or `2`) or a valid JSON object value:

```json
{
  "steps": 1,
  "min": "half",
  "max": "total",
  "condition": "prone"
}
```

- `steps`: number of cover steps to add or remove (`1` or `2`)
- `min`: minimum current cover required for the flag to apply
- `max`: maximum current cover allowed for the flag to apply
- `condition`: optional status id required on the target actor for `upgradeCover`, or on the source actor for `downgradeCover`

Legacy object-like values with unquoted keys, such as `{ steps: 1, min: "half" }`, are still accepted for existing effects, but valid JSON is preferred.

Legacy root boolean flags such as `flags.simplecover5e.ignoreAllCover = true` are still accepted for attack rolls, but scoped flags are preferred.

### Adding flags via Active Effects

You can set these flags via Active Effects by adding a change with the appropriate key, for example:

```text
flags.simplecover5e.ignoreAllCover.attack ADD true
```

```text
flags.simplecover5e.upgradeCover.all ADD 2
```

```text
flags.simplecover5e.downgradeCover.save ADD {"steps":1,"min":"half","max":"total","condition":"prone"}
```
