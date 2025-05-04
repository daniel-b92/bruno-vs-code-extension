import { dirname, extname } from "path";
import { Collection, normalizeDirectoryPath } from "../../../../../shared";
import { existsSync } from "fs";

export function isBrunoEnvironmentFile(
    registeredCollections: Collection[],
    path: string
) {
    if (!existsSync(path)) {
        return false;
    }

    return (
        extname(path) == ".bru" &&
        registeredCollections.some((collection) =>
            path.startsWith(
                normalizeDirectoryPath(collection.getRootDirectory())
            )
        ) &&
        normalizeDirectoryPath(dirname(path)).match(
            /(\/|\\)environments(\/|\\)$/
        )
    );
}
