import { basename } from "path";

export function doesFileNameMatchCollectionSettingsFile(path: string) {
    return basename(path) == "collection.bru";
}
