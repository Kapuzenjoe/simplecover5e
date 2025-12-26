# Simple Cover 5e

![Static Badge](https://img.shields.io/badge/Foundry-v13-informational)
![Static Badge](https://img.shields.io/badge/Dnd5e-v5.2-informational)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/peterlankton86911)

**Simple Cover 5e** automatically evaluates cover for the **DnD5e** system in Foundry VTT during attack rolls and saving throws (multi-target supported). It applies the correct mechanical bonuses (+2 / +5) to the roll, updates chat/card displays, and sets/clears target status effects.

## How It Works

- Uses a DMG-style line-of-effect approach:
  - **Square grid**: choose an optimal attacker corner and trace to the target’s four (inset) corners.
  - **Gridless (Square mode)**: tokens are treated as squares; cover is evaluated by tracing to four (inset) corners of each sampled target cell, similar to a square grid.
  - **Gridless (Circle mode)**: tokens are treated as circular footprints; cover is evaluated using a fixed set of sample points within the token footprint (size-dependent), and corner samples are taken from an 8-point inset ring on the circumference.
  - **Hex**: choose an optimal attacker corner and trace to the target hex’s inset corner samples.
- Cover thresholds:
  - **Square / Gridless (Square mode)**: if **1–2** lines are blocked, the target gains **Half Cover**; if **3** lines are blocked, the target gains **Three-Quarters Cover**.
  - **Hex**: if **1–3** lines are blocked, the target gains **Half Cover**; if **4+** lines are blocked, the target gains **Three-Quarters Cover**.
  - **Gridless (Circle mode)**: uses an 8-sample perimeter; if **1–5** lines are blocked, the target gains **Half Cover**; if **6+** lines are blocked, the target gains **Three-Quarters Cover**.
- Blocking tokens are treated as 3D prisms with configurable heights by creature size. When the **Wall Height** module is active, creature heights are taken from that module instead of these defaults. Non-blocking creatures (hidden tokens, ethereal/dead creatures, or creatures with 0 max HP) are ignored when evaluating cover.
- In **gridless Circle mode**, blocking creatures use a slightly smaller internal square AABB as their blocking footprint, sized to sit safely inside the circular radius.
- Effects are pushed directly into the roll (target AC / save DC adjustments) and synchronized with token status effects.
- On **gridless** scenes, larger tokens are evaluated using multiple sample centers (virtual sub-cells / multi-sample layouts) to approximate multi-square behavior where no RAW gridless procedure exists.
- (Optional) A token hover helper can display cover icons and/or a distance label near the hovered token, styled similarly to the core distance ruler and configurable in position and offset.
- (Optional) A wall-only **line of sight (LoS)** check can be performed. The LoS test mirrors Foundry’s vision sampling: a single origin at the attacker’s vision-source position and a 3×3 sampling grid around the target’s center. If the LoS test fails, the target is treated as having **Total Cover**.
- (Optional) A debug overlay can draw the evaluated cover segments as colored lines (green for clear, red for blocked), outline the token shapes used internally (attacker, target and creature occluders), and mark LoS sample points.
- Cover rules (including fixed rules and optional rule switches such as ignore-cover logic and feat interactions) are documented in the Wiki: [Cover Rules](https://github.com/Kapuzenjoe/simplecover5e/wiki/Cover-Rules).

## Settings

You can find the possible settings in the Wiki: [Settings](https://github.com/Kapuzenjoe/simplecover5e/wiki/Settings).

## Integration & API (Library Mode)

Simple Cover 5e exposes a small API that other modules can use to query cover without relying on Active Effects or automatic roll mutation. The API is available via the module entry:

The functions and usage of Library Mode can be found in the Wiki: [API-(Library-Mode)](https://github.com/Kapuzenjoe/simplecover5e/wiki/API-(Library-Mode)).

## Compatibility

### Midi-QOL

- Official integration is available with **Midi-QOL v13.0.30+**.

### Ready Set Roll 5e

Simple Cover 5e is **partially compatible** with **Ready Set Roll 5e**:

- When the **chat log is not open**, Ready Set Roll may internally trigger certain rolls twice or in an unexpected order. This can lead to:
  - Cover status effects being toggled multiple times on temporary `ActorDelta` documents, e.g.  
    `_id [dnd5ecoverHalf00] already exists within the parent collection: ActorDelta[…] effects`
  - Harmless console errors from debug drawings (if enabled), e.g.  
    `Drawing "<id>" does not exist!`
- These messages only appear in the GM’s browser console and do **not** crash the game.
- Cover calculation for saving throws (save DC adjustment) is correct.
- Attack rolls:
  - Mechanics (hit / miss) work for **single-target** attacks.
  - The AC values shown under **Targets** on the Ready Set Roll card can sometimes be incorrect, because Simple Cover 5e mutates the dnd5e `messageFlags` during the attack roll, while Ready Set Roll appears to use its own data built earlier in the activity workflow.

### Wall Height

- When the **Wall Height** module is active, simplecover5e uses its per-token LOS height for 3D cover evaluation and ignores this module’s default creature height settings.
- Walls with Wall Height bounds (`top` / `bottom`) are treated as 3D barriers: a cover line is only blocked if the 3D line between attacker and target passes through the wall’s height range.
- For 3D LOS checks, the attacker’s ray starts at about **70%** of their height (approximate eye level) and aims at **50%** of the target’s height, so low walls tend to grant partial cover instead of behaving like unrealistic full-height barriers.

## Examples (with active debug mode)

![Example 1](docs/example_1.png)
![Example 2](docs/example_2.png)
![Example 3](docs/example_3.png)
![Example 4](docs/example_4.png)
