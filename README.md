# SimpleCover5e
## Summary
Status: Work in Progress.

A small module that calculates cover for the **DnD5e-System** and applies the appropriate effects.

SimpleCover5e automatically determines whether targets have Half Cover or Three-Quarters Cover during attack rolls and saving throws. Multi-target is supported. The module also applies the effect directly to the roll (AC or bonus) and sets/clears target statuses. Items with the Ignore Cover property (e.g., Sacred Flame) are excluded from the calculation and can remove cover status for that roll.

> Currently supports square grids only!

Supports: FoundryVTT V13 350 and DnD5e v5.1.10

## How It Works

- Based on the DMG-style four-line approach: choose a corner of the attacker (or origin) and conceptually trace lines to the target’s square corners to determine obstruction.
- If 1–2 lines are blocked by obstacles (including creatures), the target gains Half Cover; if 3–4 are blocked and the effect still reaches, the target gains Three-Quarters Cover.
- Blocking tokens are treated as 3D volumes with default heights by size (see table below).
- The computed cover adds +2 / +5 to the appropriate defense/bonus and is reflected directly in the roll and the target’s status effects.
- Items (Spells, Weapons or Feats) with a new custom "Ignore Cover" property skip/remedy cover for that roll.

| Size       | Height (ft) |
| ---------- | ----------: |
| tiny       |           1 |
| sm         |           3 |
| small      |           3 |
| med        |           6 |
| medium     |           6 |
| lg         |          12 |
| large      |          12 |
| huge       |          24 |
| grg        |          48 |
| gargantuan |          48 |

## Examples (with active debug mode)
![Example 1](docs/example_1.png)
![Example 2](docs/example_2.png)
![Example 3](docs/example_3.png)
![Example 4](docs/example_4.png)