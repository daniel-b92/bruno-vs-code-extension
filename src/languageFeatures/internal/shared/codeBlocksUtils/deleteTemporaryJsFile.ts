import { unlinkSync } from "fs";
import { TemporaryJsFilesRegistry } from "../temporaryJsFilesRegistry";
import { getTemporaryJsFileName } from "./getTemporaryJsFileName";

export function deleteTemporaryJsFileForCollection(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collectionRootDirectory: string
) {
    unlinkSync(getTemporaryJsFileName(collectionRootDirectory));
    tempJsFilesRegistry.unregisterJsFileForCollection(collectionRootDirectory);
}
