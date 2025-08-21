import { resolve } from "path";

export function getTemporaryJsFileNameForBruFile(
    collectionRootDirectory: string,
) {
    return resolve(collectionRootDirectory, "__temp_bru_reference.js");
}
