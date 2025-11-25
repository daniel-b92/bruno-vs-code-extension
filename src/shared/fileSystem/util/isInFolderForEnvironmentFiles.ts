import { dirname } from "path";
import { normalizeDirectoryPath } from "../..";

export function isInFolderForEnvironmentFiles(path: string) {
    return normalizeDirectoryPath(dirname(path)).match(
        /(\/|\\)environments(\/|\\)$/,
    );
}
