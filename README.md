# SimpleCover5e

## Summary

**SimpleCover5e** automatically evaluates cover for the **DnD5e** system in Foundry VTT during attack rolls and saving throws (multi-target supported). It applies the correct mechanical bonuses (+2 / +5) to the roll, updates chat/card displays, and sets/clears target status effects. The module also adds a custom *Ignore Cover* item property that you can enable on specific items (e.g., *Sacred Flame*) to bypass cover for that roll.

*Currently supports square grids only.*

## How It Works

- Uses the DMG-style “four lines” approach: pick an optimal attacker corner and conceptually trace to the target square’s four (inset) corners. Walls (sight) and creature volumes may block lines; tangents are allowed.
- If **1–2** lines are blocked, the target gains **Half Cover** (+2 AC / +2 DEX save). If **3–4** lines are blocked (and the effect still reaches), the target gains **Three-Quarters Cover** (+5 AC / +5 DEX save).
- Blocking tokens are treated as 3D prisms with configurable heights by creature size (see table below). Effects are pushed directly into the roll (chat target AC / save bonus) and synchronized with token status effects.
- The module introduces an *Ignore Cover* item property. Add it to spells, weapons, or feats that should ignore cover (for example, *Sacred Flame*) and the cover calculation will be skipped for that roll.
- The feats **Sharpshooter** and **Spell Sniper** are automatically respected when present on the attacker, either by their English name or by a matching `system.identifier` (e.g. `"sharpshooter"` / `"spell-sniper"`).

### Default Creature Heights

These are the default 3D heights (in feet) used for cover evaluation. They can be customized in the module settings.

| Size        | Height (ft) |
|-------------|-------------:|
| tiny        |            1 |
| small       |            3 |
| medium      |            6 |
| large       |           12 |
| huge        |           24 |
| gargantuan  |           48 |

## Settings

- **Cover Removal Scope** — Choose which tokens are affected when cover is cleared: *All Tokens on Scene*, *Combatants Only*, or *Player-Owned Tokens Only*.
- **Clear Cover on Combat Updates** — When rounds/turns/initiative change, remove cover according to the selected scope.
- **Clear Cover on Token Movement (Combat Only)** — When a token moves during active combat, remove cover according to the selected scope.
- **Show Cover Debug Lines** — Renders helper segments used during cover evaluation (GM only).
- **Creature Heights** — Configure the default 3D heights (in feet) for each size category used when treating tokens as prisms for cover.

### Notes & Limitations

- Square grids only (no gridless or hex yet).
- The *Ignore Cover* item property is added by this module and can be toggled per item.
- Multi-target rolls are supported.

## Planned Features

- Support for **gridless** and **hexagonal** maps  
- Additional configuration options
- Wall Height integration
- Midi QoL integration

## Examples (with active debug mode)
![Example 1](docs/example_1.png)
![Example 2](docs/example_2.png)
![Example 3](docs/example_3.png)
![Example 4](docs/example_4.png)