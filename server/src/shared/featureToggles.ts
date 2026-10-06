import { defaultFeatureToggles, FeatureToggles } from "@global_shared";

let featureToggles: FeatureToggles = defaultFeatureToggles;

export function setFeatureToggles(toggles: FeatureToggles) {
    featureToggles = toggles;
}

export function getFeatureToggles() {
    return featureToggles;
}
