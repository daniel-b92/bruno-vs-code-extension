import { Collection, VariableNameMatchingMode } from "../..";

export function getMatchingDefinitionsFromEnvFiles(
    collection: Collection<unknown>,
    variableName: string,
    matchingMode: VariableNameMatchingMode,
    environmentName?: string,
) {
    const matchingEnvironmentFiles = collection
        .getEnvironments()
        .map(({ item, environmentName: name }) => ({
            item,
            selected: name === environmentName,
        }));

    if (matchingEnvironmentFiles.length == 0) {
        return [];
    }

    return matchingEnvironmentFiles
        .sort(({ selected: isConfigured1 }, { selected: isConfigured2 }) =>
            isConfigured1 ? -1 : isConfigured2 ? 1 : 0,
        )
        .map(({ item, selected: isConfiguredEnv }) => {
            const matchingVariables = item
                .getVariables()
                .filter(({ key }) => matches(key, variableName, matchingMode));

            return matchingVariables.length > 0
                ? {
                      file: item.getPath(),
                      matchingVariables,
                      isConfiguredEnv: isConfiguredEnv ?? false,
                  }
                : undefined;
        })
        .filter((result) => result != undefined);
}

function matches(
    actual: string,
    toSearch: string,
    matchingMode: VariableNameMatchingMode,
) {
    switch (matchingMode) {
        case VariableNameMatchingMode.Exact:
            return actual == toSearch;
        case VariableNameMatchingMode.Ignore:
            return actual;
    }
}
