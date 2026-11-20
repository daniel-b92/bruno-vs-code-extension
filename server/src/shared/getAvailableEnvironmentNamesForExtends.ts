import { basename } from "path";
import { getFileExtensionForFormat } from "@global_shared";
import { TypedCollection } from "./interfaces";

/** The names of all environments that the environment in the given file can extend without causing a cycle. */
export function getAvailableEnvironmentNamesForExtends(
    filePath: string,
    collection: TypedCollection,
): string[] {
    const ownEnvironmentName = basename(
        filePath,
        getFileExtensionForFormat(collection.getFormat()),
    );

    return collection
        .getEnvironments()
        .map(({ environmentName }) => environmentName)
        .filter((environmentName) => environmentName != ownEnvironmentName)
        .filter(
            (environmentName) =>
                !collection
                    .getEnvironmentInheritanceChain(environmentName)
                    .includes(ownEnvironmentName),
        );
}
