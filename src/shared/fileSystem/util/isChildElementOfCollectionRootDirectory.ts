import { dirname } from "path";
import { Collection, normalizeDirectoryPath } from "../..";

export function isChildElementOfCollectionRootDirectory(
    registeredCollections: Collection[],
    path: string
) {
    return registeredCollections.some(
        (collection) =>
            normalizeDirectoryPath(collection.getRootDirectory()) ==
            normalizeDirectoryPath(dirname(path))
    );
}
