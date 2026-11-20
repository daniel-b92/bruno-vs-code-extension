import { dirname } from "path";
import { normalizePath, ReadyOnlyCollection } from "../..";

/**
 * Only checks the name of the parent folder, independently of its location within a collection.
 * Use `isInEnvironmentsFolderOfCollection` if the collection is known.
 */
export function isInFolderForEnvironmentFiles(path: string) {
    return /(\/|\\)environments(\/|\\)$/.test(normalizePath(dirname(path)));
}

/**
 * Only files directly inside the `environments` folder located in the collection root are environment files.
 * This excludes e.g. the root file of a collection that is itself located in a folder named `environments`
 * and files in `environments` folders further down the tree.
 */
export function isInEnvironmentsFolderOfCollection<T>(
    collection: ReadyOnlyCollection<T>,
    path: string,
) {
    return (
        isInFolderForEnvironmentFiles(path) &&
        collection.isRootDirectory(dirname(dirname(path)))
    );
}
