import { basename } from "path";
import {
    BrunoEnvironmentFile,
    BrunoFileType,
    Collection,
    getExtensionForBrunoFiles,
} from "../../../../../shared";

export enum EnvVariableNameMatchingMode {
    Exact = 1,
    Prefix = 2,
}

export function getMatchingEnvironmentVariableDefinitions(
    collection: Collection,
    name: string,
    matchingMode: EnvVariableNameMatchingMode,
    environmentName?: string,
) {
    const matchingEnvironmentFiles = collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) =>
                item.getItemType() == BrunoFileType.EnvironmentFile &&
                (environmentName
                    ? basename(item.getPath(), getExtensionForBrunoFiles()) ==
                      environmentName
                    : true),
        )
        .map(({ item }) => item as BrunoEnvironmentFile);

    if (matchingEnvironmentFiles.length == 0) {
        return [];
    }

    return matchingEnvironmentFiles
        .map((item) => {
            const matchingVariables = item
                .getVariables()
                .filter(({ key }) => matches(key, name, matchingMode));

            return matchingVariables.length > 0
                ? {
                      file: item.getPath(),
                      matchingVariables,
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
        case EnvVariableNameMatchingMode.Prefix:
            return actual.startsWith(toSearch);
    }
}
