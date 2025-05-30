import { unlinkSync } from "fs";
import { TemporaryJsFilesRegistry } from "../temporaryJsFilesRegistry";

export function deleteTemporaryJsFile(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    filePath: string
) {
    unlinkSync(filePath);
    tempJsFilesRegistry.unregisterJsFile(filePath);
}
