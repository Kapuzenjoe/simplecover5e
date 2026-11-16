import CoverObstacleRegionBehaviorType from "../data/cover-obstacle.mjs";

/**
 * Config sheet for the Cover Obstacle region behavior.
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
    let distance = distanceInput.value || "0";
    const updateDistanceLock = () => {
      if ( checkbox.checked ) distance = distanceInput.value || distance;
      distanceInput.value = checkbox.checked ? "" : distance;
      distanceInput.disabled = checkbox.checked;
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
