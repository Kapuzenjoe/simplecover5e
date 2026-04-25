# API

Simple Cover 5e exposes a small API that other modules can use to query cover without relying on Active Effects or automatic roll mutation. The API is available through the module entry:

```js
const sc = game.modules.get("simplecover5e")?.api;
```

## API Surface

### Get Cover

```js
api.getCover({ attacker, target, scene?, debug?, losCheck?, activity? })
```

Compute cover between a single attacker (`Token | TokenDocument`) or a position object (`{ x, y, elevation? }`) and a single target (`Token | TokenDocument`). This returns `null` if inputs are invalid; otherwise it returns a result object.

- `debug`: `null` uses the module Debug setting; `true` forces debug on; `false` forces it off.
- `losCheck`: when `true`, an additional wall LoS check is performed; if LoS fails, the result is forced to **Total Cover**.
- `activity`: when provided, Simple Cover 5e applies ignore-cover rules to the computed cover before returning.

**Return Shape:**

```js
{
  cover: "none" | "half" | "threeQuarters" | "total",
  bonus: 0 | 2 | 5 | null,
  debugSegments?: any[],
  debugTokenShapes?: any[]
}
```

**Example:**

```js
const result = sc.getCover({ attacker, target, losCheck: true });
if (result) {
  // result.cover is "none", "half", "threeQuarters", or "total"
  // result.bonus is 0|2|5|null (null for total cover)
  console.log(result.cover, result.bonus);
}
```

```js
const result = sc.getCover({
  attacker: { x: 4160, y: 3040 },
  target: targetDoc,
  losCheck: true
});
if (result) {
  // result.cover is "none", "half", "threeQuarters", or "total"
  // result.bonus is 0|2|5|null (null for total cover)
  console.log(result.cover, result.bonus);
}
```

### Get Cover for Multiple Targets

```js
api.getCoverForTargets({ attacker, targets?, scene?, debug?, losCheck?, activity? })
```

Compute cover for a single attacker (`Token | TokenDocument`) or a position object (`{ x, y, elevation? }`) against multiple targets (`Token[] | TokenDocument[] | null`). If `targets` is omitted, the function defaults to the current user's targeted tokens. Returns an array of entries:

**Return Shape:**

```js
{
  target: Token | TokenDocument,
  result: { cover, bonus, debugSegments?, debugTokenShapes? },
  los: { hasLOS: boolean, targetLosPoints: Array<{ x: number, y: number, blocked: boolean }> }
}
```

**Example:**

```js
const entries = sc.getCoverForTargets({ attacker, losCheck: true });

for (const { target, result, los } of entries) {
  console.log(target.name, result.cover, los.hasLOS);
}
```

### Get or Set Library Mode

```js
api.getLibraryMode()
api.setLibraryMode(enabled)
```

Query or toggle *Library Mode*. When Library Mode is enabled, Simple Cover 5e still exposes cover calculations through the API, but its own roll automation, cover effect handling, and roll dialog mutations are disabled.

Library Mode is stored as a visible world setting with a caution label. It can also be enabled through the API by integrations that want to use Simple Cover 5e only as a cover provider. Only GMs can change the setting through `setLibraryMode`, which returns `true` when the setting was updated. During Midi-QOL workflows, Simple Cover 5e also behaves as library-only when Midi-QOL is configured to use `simplecover5e` as its cover calculation mode, preventing both modules from applying cover automation at the same time.

### Evaluate Ignore Cover Rules

```js
api.getIgnoreCover(activity, cover, targetActor?)
// returns: { cover: ("none"|"half"|"threeQuarters"|"total"), bonus: (number|null) }
```

Resolve the effective cover level for an activity, including Simple Cover 5e's ignore-cover rules, such as item properties and feat-based checks for Sharpshooter or Spell Sniper.

- `targetActor`: optional actor used for defensive cover flags such as `upgradeCover`.

Library Mode disables Simple Cover 5e's automation only. API calls still evaluate ignore-cover rules when an `activity` is provided. Integrations can either:

- pass `activity` to `getCover(...)` / `getCoverForTargets(...)`, or
- call `getIgnoreCover(activity, cover, targetActor)` manually and apply the returned `{ cover, bonus }` as desired.

### Get LoS

```js
api.getLOS(attackerDoc, targetDoc, ctx = null)
// returns: { hasLOS: boolean, targetLosPoints: Array<{ x: number, y: number, blocked: boolean }> } | null
```

Check whether the target is in **line of sight (LoS)**. The LoS test uses Foundry visibility test points and checks them from the attacker's vision origin against walls. If `hasLOS` is `false`, the target is not visible and is treated as blocked. The `ctx` value is optional.

The array `targetLosPoints` is used only for debugging purposes.

### Get Token-to-Token Distance

```js
api.getTokenTokenDistance(sourceToken, targetToken)
// returns: number
```

Measure the minimal 3D distance between two tokens in scene grid units.

### Set Dialog Note

Add a note (icon + label + hint) to the next Roll Configuration Dialog for current roll workflow.

```js
api.setDialogNote(dialogConfig, { cover, target, icon = "", label = "", hint = "" } = {})
```

- `dialogConfig`: `object` - The dialog configuration object provided by the dnd5e pre-roll hooks.
- `cover`: `string | null` - The cover level associated with the note.
- `target`: `string | null` - The target identifier used to update an existing note for the same target.
- `icon`: `string` - A Font Awesome class string, e.g. `"fa-solid fa-circle-info"`.
- `label`: `string` - The note label text, e.g. `"Half Cover"`.
- `hint`: `string` - The note HTML/text, e.g. `"+2 to save rolls."`.

## Ready Hook

Consumers can also subscribe to a dedicated hook to safely attach to the API regardless of module load order:

```js
Hooks.on("simplecover5eReady", (api) => {
  // e.g. enable library mode and use the API
  api.setLibraryMode(true);
});
```

This pattern allows other modules (such as automation/conditions modules) to reuse Simple Cover 5e's cover engine while retaining full control over how bonuses are applied, how workflows are modified, and how any UI indicators are displayed.
