import { ReadyOnlyCollection } from "../../../../..";

export function getMatchingDefinitionsFromEnvFiles(
    collection: ReadyOnlyCollection<unknown>,
    variableNameForFiltering?: string,
    environmentName?: string,
) {
    const inheritanceChain = environmentName
        ? collection.getEnvironmentInheritanceChain(environmentName)
        : [];

    const matchingEnvironmentFiles = collection
        .getEnvironments()
        .map(({ item, environmentName: name }) => ({
            item,
            selected: name === environmentName,
            // The environment file itself is not "inherited", even though it is technically part of its own chain start.
            inheritedByEnvironmentName:
                name !== environmentName && inheritanceChain.includes(name)
                    ? environmentName
                    : undefined,
        }));

    if (matchingEnvironmentFiles.length == 0) {
        return [];
    }

    return matchingEnvironmentFiles
        .sort(({ selected: isConfigured1 }, { selected: isConfigured2 }) =>
            isConfigured1 ? -1 : isConfigured2 ? 1 : 0,
        )
        .map(
            ({
                item,
                selected: isConfiguredEnv,
                inheritedByEnvironmentName,
            }) => {
                const matchingVariables = item
                    .getVariables()
                    .filter(({ key }) =>
                        variableNameForFiltering !== undefined
                            ? key == variableNameForFiltering
                            : true,
                    );

                return matchingVariables.length > 0
                    ? {
                          file: item.getPath(),
                          matchingVariables,
                          isConfiguredEnv: isConfiguredEnv ?? false,
                          inheritedByEnvironmentName,
                      }
                    : undefined;
            },
        )
        .filter((result) => result != undefined);
}
