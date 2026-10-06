/**
 * Toggles for features that are still under development.
 * They can only be activated when launching the extension via one of the launch configs in `.vscode/launch.json`.
 */
export interface FeatureToggles {
    yamlCollectionSupport: boolean;
}

export const defaultFeatureToggles: FeatureToggles = {
    yamlCollectionSupport: false,
};
