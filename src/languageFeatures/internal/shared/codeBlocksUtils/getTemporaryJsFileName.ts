import { resolve } from "path";

export function getTemporaryJsFileName(collectionRootDirectory: string) {
    return resolve(collectionRootDirectory, "__temp.js");
}
