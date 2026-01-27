import { basename } from "path";

export function doesFileNameMatchFolderSettingsFileName(path: string) {
    return basename(path) == "folder.bru";
}
