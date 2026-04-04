import {
    ConfiguredEnvironmentPerCollectionSetting,
    getEnvironmentSettingsKey,
    normalizePath,
} from "..";

type NonPromise = Exclude<unknown, Promise<any>>;

export function getConfiguredEnvironmentName(
    collectionRootFolder: string,
    settingAccessor: (sectionKey: string) => NonPromise,
) {
    const oldConfigs = settingAccessor(getEnvironmentSettingsKey());

    return getConfiguredEnvironmentNameInternal(
        collectionRootFolder,
        oldConfigs,
    );
}

export async function getConfiguredEnvironmentNameAsync(
    collectionRootFolder: string,
    settingAccessor: (sectionKey: string) => Promise<unknown>,
) {
    const oldConfigs = await settingAccessor(getEnvironmentSettingsKey());

    return getConfiguredEnvironmentNameInternal(
        collectionRootFolder,
        oldConfigs,
    );
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

function getConfiguredEnvironmentNameInternal(
    collectionRootFolder: string,
    oldConfigs: unknown,
) {
    return isTestEnvironmentsSettingValid(oldConfigs)
        ? Object.entries(oldConfigs).find(
              ([existingRootFolder]) =>
                  normalizePath(collectionRootFolder) ===
                  normalizePath(existingRootFolder),
          )?.[1]
        : undefined;
}
