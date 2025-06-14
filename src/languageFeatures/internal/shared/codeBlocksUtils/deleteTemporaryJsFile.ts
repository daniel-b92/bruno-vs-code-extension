import { existsSync, unlinkSync } from "fs";
import { TemporaryJsFilesRegistry } from "../temporaryJsFilesRegistry";
import { getTemporaryJsFileName } from "../../../../shared";

export function deleteTemporaryJsFileForCollection(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collectionRootDirectory: string
) {
    const path = getTemporaryJsFileName(collectionRootDirectory);

    if (existsSync(path)) {
        unlinkSync(path);
    }
    tempJsFilesRegistry.unregisterJsFileForCollection(collectionRootDirectory);
}
