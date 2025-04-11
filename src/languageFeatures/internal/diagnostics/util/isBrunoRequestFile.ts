import { basename, dirname, extname } from "path";
import { Collection, normalizeDirectoryPath } from "../../../../shared";
import { existsSync } from "fs";

export function isBrunoRequestFile(
    registeredCollections: Collection[],
    path: string
) {
    if (!existsSync(path)) {
        return false;
    }

    const isBrunoRequestFile =
        extname(path) == ".bru" &&
        registeredCollections.some((collection) =>
            path.startsWith(
                normalizeDirectoryPath(collection.getRootDirectory())
            )
        ) &&
        !normalizeDirectoryPath(dirname(path)).match(
            /(\/|\\)environments(\/|\\)$/
        ) &&
        basename(path) != "folder.bru" &&
        (basename(path) != "collection.bru" ||
            registeredCollections.every(
                (collection) =>
                    normalizeDirectoryPath(collection.getRootDirectory()) !=
                    normalizeDirectoryPath(dirname(path))
            ));

    return isBrunoRequestFile;
}
