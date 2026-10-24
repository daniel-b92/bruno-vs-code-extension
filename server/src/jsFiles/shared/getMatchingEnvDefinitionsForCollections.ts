import { basename } from "path";
import { getMatchingDefinitionsFromEnvFiles } from "@global_shared";
import { JsFileInContextRootRequest } from "../../shared";

/**
 * Returns the definitions of persistent environment variables for all given collections, sorted by collection.
 * If `showCollectionNames` is set, the matches are assigned to a name that is unique among the given collections.
 */
export function getMatchingEnvDefinitionsForCollections(
    collections: JsFileInContextRootRequest["collections"],
    variableNameForFiltering: string | undefined,
    showCollectionNames: boolean,
) {
    const collectionNames = getUniqueCollectionNames(collections);

    return collections
        .map(({ collection, configuredEnvironmentName }) => ({
            collectionName: showCollectionNames
                ? collectionNames.get(collection.getRootDirectory())
                : undefined,
            matches: getMatchingDefinitionsFromEnvFiles(
                collection,
                variableNameForFiltering,
                configuredEnvironmentName,
            ),
        }))
        .sort((a, b) =>
            (a.collectionName ?? "").localeCompare(b.collectionName ?? ""),
        )
        .flatMap(({ collectionName, matches }) =>
            matches.map((match) => ({ ...match, collectionName })),
        );
}

/** Uses the directory name of each collection, or the full path if multiple collections share the same directory name. */
function getUniqueCollectionNames(
    collections: JsFileInContextRootRequest["collections"],
) {
    const rootDirectories = collections.map(({ collection }) =>
        collection.getRootDirectory(),
    );

    return new Map(
        rootDirectories.map((rootDirectory) => {
            const name = basename(rootDirectory);
            const isAmbiguous =
                rootDirectories.filter((other) => basename(other) == name)
                    .length > 1;

            return [rootDirectory, isAmbiguous ? rootDirectory : name];
        }),
    );
}
