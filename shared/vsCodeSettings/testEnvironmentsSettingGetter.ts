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
        ? oldConfigs.perCollection.find(
              ({ collectionRoot: existingRootFolder }) =>
                  normalizePath(collectionRootFolder) ==
                  normalizePath(existingRootFolder),
          )?.environmentName
        : undefined;
}

export function isTestEnvironmentsSettingValid(
    value: unknown,
): value is ConfiguredEnvironmentPerCollectionSetting {
    if (
        value == undefined ||
        typeof value != "object" ||
        !("perCollection" in value)
    ) {
        return false;
    }

    const { perCollection } = value;

    return (
        Array.isArray(perCollection) && perCollection.every(isValidArrayEntry)
    );
}

function isValidArrayEntry(entry: unknown): entry is {
    collectionRoot: string;
    environmentName: string;
} {
    return (
        entry != undefined &&
        typeof entry == "object" &&
        "collectionRoot" in entry &&
        "environmentName" in entry &&
        typeof entry.collectionRoot == "string" &&
        typeof entry.environmentName == "string"
    );
}
