import { basename } from "path";

export function isFolderSettingsFile(path: string) {
    return basename(path) == "folder.bru";
}
