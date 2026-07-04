import CoverObstacleRegionBehaviorType from "../cover/region-behavior.mjs";

/**
 * Config sheet for the Cover Obstacle region behavior.
 *
 * @extends {foundry.applications.sheets.RegionBehaviorConfig}
 */
export default class CoverObstacleRegionBehaviorConfig extends foundry.applications.sheets.RegionBehaviorConfig {

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);

    const { fields } = CoverObstacleRegionBehaviorType.schema;
    const checkbox = this.element.querySelector(`[name="${fields.interiorNeverBlocks.fieldPath}"]`);
    const distanceInput = this.element.querySelector(`[name="${fields.interiorBlockDistance.fieldPath}"]`);
    if ( !checkbox || !distanceInput ) return;

    const distanceGroup = distanceInput.closest(".form-group");
    const checkboxGroup = checkbox.closest(".form-group");
    const checkboxLabel = document.createElement("label");
    checkboxLabel.className = "checkbox";
    checkboxLabel.append(checkbox, fields.interiorNeverBlocks.label);
    checkboxGroup?.remove();
    distanceInput.before(checkboxLabel);

    distanceInput.placeholder = "∞";
    const updateDistanceLock = () => {
      distanceInput.readOnly = checkbox.checked;
      distanceInput.value = checkbox.checked ? "" : (distanceInput.value || "0");
    };
    updateDistanceLock();
    checkbox.addEventListener("change", updateDistanceLock);

    const units = this.document.parent?.parent?.grid?.units;
    if ( units ) {
      const span = document.createElement("span");
      span.className = "units";
      span.textContent = ` (${units})`;
      distanceGroup?.querySelector("label")?.append(span);
    }
  }
}

/* -------------------------------------------- */

/**
 * Register the config sheet used by the obstacle Region Behavior.
 * @returns {void}
 */
export function initCoverObstacleRegionBehaviorSheet() {
  CONFIG.RegionBehavior.typeIcons["simplecover5e.coverObstacle"] = "fa-solid fa-shield-halved";

  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
  DocumentSheetConfig.unregisterSheet(CONFIG.RegionBehavior.documentClass, "core", foundry.applications.sheets.RegionBehaviorConfig, {
    types: ["simplecover5e.coverObstacle"]
  });
  DocumentSheetConfig.registerSheet(CONFIG.RegionBehavior.documentClass, "simplecover5e", CoverObstacleRegionBehaviorConfig, {
    types: ["simplecover5e.coverObstacle"],
    makeDefault: true
  });
}
