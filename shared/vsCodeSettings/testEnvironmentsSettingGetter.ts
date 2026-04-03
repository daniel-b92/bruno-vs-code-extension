import {
    ConfiguredEnvironmentPerCollectionSetting,
    getEnvironmentSettingsKey,
    normalizePath,
} from "..";

export function getConfiguredEnvironmentName(
    collectionRootFolder: string,
    settingAccessor: (sectionKey: string) => unknown,
) {
    const oldConfigs = settingAccessor(getEnvironmentSettingsKey());

    return isTestEnvironmentsSettingValid(oldConfigs)
        ? Object.entries(oldConfigs).find(
              ([existingRootFolder]) =>
                  normalizePath(collectionRootFolder) ===
                  normalizePath(existingRootFolder),
          )?.[1]
        : undefined;
}

export function isTestEnvironmentsSettingValid(
    value: unknown,
): value is ConfiguredEnvironmentPerCollectionSetting {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }

    for (const key in value) {
        if (typeof (value as Record<string, unknown>)[key] !== "string") {
            return false;
        }
    }

    return true;
}
