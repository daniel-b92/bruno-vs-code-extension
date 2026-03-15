import { dirname } from "path";
import { normalizePath } from "../..";

export function isInFolderForEnvironmentFiles(path: string) {
    return normalizePath(dirname(path)).match(/(\/|\\)environments(\/|\\)$/);
}
