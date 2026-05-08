import { dirname } from "path";
import { normalizePath } from "../..";

export function isInFolderForEnvironmentFiles(path: string) {
    return /(\/|\\)environments(\/|\\)$/.test(normalizePath(dirname(path)));
}
