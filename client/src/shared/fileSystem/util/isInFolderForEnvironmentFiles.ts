import { dirname } from "path";
import { normalizeDirectoryPath } from "@global_shared";

export function isInFolderForEnvironmentFiles(path: string) {
    return normalizeDirectoryPath(dirname(path)).match(
        /(\/|\\)environments(\/|\\)$/,
    );
}
