# Cover Rules

This page documents how Simple Cover 5e determines *effective cover* after the geometric cover evaluation.

## Overview

Simple Cover 5e evaluates cover in three stages:

1. **Geometric cover result** (engine): returns a cover level (`none`, `half`, `threeQuarters`) and its associated bonus (+0 / +2 / +5).
2. **Line of sight** (optional): can promote the result to `total` if wall LoS is blocked.
3. **Rule adjustments** (rules layer): can raise or lower the result based on Active Effect rules, feats, items, and optional settings.

Rule adjustments run in this order:

1. **Increase Own Cover** rules of the target raise the cover.
2. **Reduce Target's Cover** rules of the attacker lower it. Their conditions see the cover after step 1.
3. The **Ignore Cover** item property sets the cover to `none`.

## Fixed Rules

These rules are always applied when relevant. They are built-in **Reduce Target's Cover** rules and work like the Active Effect rules below.

### Cover Levels and Bonuses

| Cover | Bonus |
|------:|:-----:|
| `none` | `0` |
| `half` | `2` |
| `threeQuarters` | `5` |
| `total` | `null` |

### Feat: Sharpshooter (Ranged Weapon Attacks)

For weapon attacks that count as ranged and cover is `half` or `threeQuarters`:

- If the attacker has **Sharpshooter**, cover is ignored (`none`, bonus `0`)

A melee weapon thrown or used at range counts as ranged through its attack mode.

Detection:

- By `system.identifier === "sharpshooter"` **or**
- By item name `"Sharpshooter"`

### Feat: Spell Sniper (Spell Attacks)

For spell attacks and cover is `half` or `threeQuarters`:

- If the attacker has **Spell Sniper**, cover is ignored (`none`, bonus `0`)

Detection:

- By `system.identifier === "spell-sniper"` **or**
- By item name `"Spell Sniper"`

### Item: Wand of the War Mage

For spell attacks where cover is exactly `half`:

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

If the computed cover is `half` or `threeQuarters`, it is ignored for Sacred Flame saving throw activities.

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

## Optional Rules (Active Effects)

Active Effects can change cover with two change types in the group **Simple Cover 5e**.

| Change Type | Acts when the actor... | Effect |
|:------------|:-----------------------|:-------|
| **Reduce Target's Cover** (`simplecover5e.reduceTargetCover`) | makes an attack or forces a saving throw | Lowers the cover of the target |
| **Increase Own Cover** (`simplecover5e.increaseOwnCover`) | is attacked or makes a saving throw | Raises the cover of the actor |

### Key

The key selects the rolls a change applies to: `d20` (attacks and saving throws), `attack`, or `save`. With dnd5e 6.1.0 or later the key is a drop-down, with dnd5e 6.0.x it is entered as text.

### Value

The value is the number of cover steps, from `1` to `3`. Reduce Target's Cover with `3` lowers any cover to `none`. Larger values count as `3`. A value of `0`, a negative value, or a value that is not a number does nothing. If several changes apply, the highest value is used, steps do not add up.

### Conditions

Conditions work like for other dnd5e rules. The effect and each change can have conditions.

- **Effect conditions** check the actor holding the effect. For example `{ "k": "statuses.prone", "o": "gte", "v": 1 }` applies the effect only while the actor is prone.
- **Change conditions** are checked for each roll against the roll data of the activity and one extra value:
  - `simplecover5e.cover`: the cover level before the change (`none`, `half`, `threeQuarters`, or `total`)
  - `roll.type`: `attack` or `save`
  - `roll.attack.type`: `melee` or `ranged`
  - `roll.attack.classification`: `weapon`, `spell`, or `unarmed`
  - `roll.attack.mode`: the attack mode of the roll, such as `thrown`

Compare `simplecover5e.cover` with `in` or an exact match. Operators such as `gt` and `lt` compare the names alphabetically, not the order of the cover levels. A condition with a misspelled key or value never applies.

Without a change condition, a change applies at every cover level. Reduce Target's Cover only acts when there is cover to reduce, Increase Own Cover also raises `none`.

### Examples

**Enhanced Camouflage:** one step more cover against Half and Three-Quarters Cover.

- Change Type: **Increase Own Cover**, Key: `d20`, Value: `1`
- Change condition:

```json
{ "k": "simplecover5e.cover", "o": "in", "v": ["half", "threeQuarters"] }
```

**Low Profile:** one step more cover, only while prone.

- Effect condition:

```json
{ "k": "statuses.prone", "o": "gte", "v": 1 }
```

- Change Type: **Increase Own Cover**, Key: `d20`, Value: `1`
- Change condition:

```json
{ "k": "simplecover5e.cover", "o": "in", "v": ["none", "half", "threeQuarters"] }
```

**Penetration Shot:** the target's cover is one step lower, even Total Cover.

- Change Type: **Reduce Target's Cover**, Key: `d20`, Value: `1`
- Change condition:

```json
{ "k": "simplecover5e.cover", "o": "in", "v": ["half", "threeQuarters", "total"] }
```

### Rules on Items

An Enchantment effect on an item applies its rules only to the rolls of that item. Use it for an item that changes cover only for itself.

**Sniper Bow:** the bow ignores Half and Three-Quarters Cover for its attacks.

- Effect type: **Enchantment**
- Change Type: **Reduce Target's Cover**, Key: `attack`, Value: `3`
- Change condition:

```json
{ "k": "simplecover5e.cover", "o": "in", "v": ["half", "threeQuarters"] }
```

**Ignore all cover:** the item ignores all cover for its attacks and saving throws. This replaces the deprecated **Ignore Cover** item property.

- Effect type: **Enchantment**
- Change Type: **Reduce Target's Cover**, Key: `d20`, Value: `3`
- No change condition

Items are only read for **Reduce Target's Cover**. **Increase Own Cover** on an item has no effect.

## Legacy Actor Flags (Deprecated)

Actor flags are deprecated since Simple Cover 5e 2.3 and will be removed in Simple Cover 5e 3.0. They still work and log a deprecation warning when used. Each flag supports the scopes `.all`, `.attack`, and `.save`.

### Converting Flags to Rules

| Flag | Rule |
|:-----|:-----|
| `ignoreAllCover` | **Reduce Target's Cover**, value `3` |
| `ignoreThreeQuartersCover` | **Reduce Target's Cover**, value `3`, change condition: cover is `threeQuarters` or lower |
| `ignoreHalfCover` | **Reduce Target's Cover**, value `3`, change condition: cover is `half` or lower |
| `downgradeCover` | **Reduce Target's Cover** |
| `upgradeCover` | **Increase Own Cover** |

The scopes map to the key: `.all` to `d20`, `.attack` to `attack`, `.save` to `save`. In a flag value object, `steps` becomes the value, `min` and `max` become a change condition on `simplecover5e.cover`, and `condition` becomes an effect condition on `statuses.<id>`.

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

## Legacy Item Property (Deprecated)

The `ignoreCover` item property is deprecated since Simple Cover 5e 2.3. It still works. If an activity's item has the property, cover is ignored for that roll:

- Effective cover becomes `none`
- Bonus becomes `0`

To replace it, use an Enchantment effect as described in [Rules on Items](#rules-on-items).
