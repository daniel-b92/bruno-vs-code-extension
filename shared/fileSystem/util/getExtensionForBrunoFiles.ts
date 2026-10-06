import { CollectionFormat } from "../../baseModel/interfaces";
import { getFileExtensionForFormat } from "./collectionFormatFileNames";

export function getExtensionForBrunoFiles() {
    return getFileExtensionForFormat(CollectionFormat.Bru);
}
