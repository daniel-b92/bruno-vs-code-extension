import { basename } from "path";
import { CollectionFormat } from "../../baseModel/interfaces";
import { getFolderSettingsFileName } from "./collectionFormatFileNames";

export function doesFileNameMatchFolderSettingsFileName(
    path: string,
    format: CollectionFormat,
) {
    return basename(path) == getFolderSettingsFileName(format);
}
