import { basename } from "path";
import { getExtensionForBrunoFiles } from "@global_shared";
import { BrunoEnvironmentFile, BrunoFileType, Collection } from "@shared";

export enum EnvVariableNameMatchingMode {
    Exact = 1,
    Ignore = 2,
}

export function getMatchingDefinitionsFromEnvFiles(
    collection: Collection,
    name: string,
    matchingMode: EnvVariableNameMatchingMode,
    environmentName?: string,
) {
    const matchingEnvironmentFiles = collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) => item.getItemType() == BrunoFileType.EnvironmentFile,
        )
        .map(({ item }) => ({
            item,
            isConfigured:
                environmentName != undefined &&
                environmentName ==
                    basename(item.getPath(), getExtensionForBrunoFiles())
                    ? true
                    : false,
        })) as { item: BrunoEnvironmentFile; isConfigured: boolean }[];

    if (matchingEnvironmentFiles.length == 0) {
        return [];
    }

    return matchingEnvironmentFiles
        .sort(
            (
                { isConfigured: isConfigured1 },
                { isConfigured: isConfigured2 },
            ) => (isConfigured1 ? -1 : isConfigured2 ? 1 : 0),
        )
        .map(({ item, isConfigured: isConfiguredEnv }) => {
            const matchingVariables = item
                .getVariables()
                .filter(({ key }) => matches(key, name, matchingMode));

            return matchingVariables.length > 0
                ? {
                      file: item.getPath(),
                      matchingVariables,
                      isConfiguredEnv,
                  }
                : undefined;
        })
        .filter((result) => result != undefined);
}

function matches(
    actual: string,
    toSearch: string,
    matchingMode: EnvVariableNameMatchingMode,
) {
    switch (matchingMode) {
        case EnvVariableNameMatchingMode.Exact:
            return actual == toSearch;
        case EnvVariableNameMatchingMode.Ignore:
            return actual;
    }
}
