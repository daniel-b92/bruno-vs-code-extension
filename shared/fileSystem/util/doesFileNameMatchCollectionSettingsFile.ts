import { basename } from "path";
import { CollectionFormat } from "../../baseModel/interfaces";
import { getCollectionSettingsFileName } from "./collectionFormatFileNames";

export function doesFileNameMatchCollectionSettingsFile(
    path: string,
    format: CollectionFormat,
) {
    return basename(path) == getCollectionSettingsFileName(format);
}
