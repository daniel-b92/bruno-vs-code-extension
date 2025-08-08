import { TemporaryJsFilesRegistry } from "./temporaryJsFilesRegistry";
import {
    checkIfPathExistsAsync,
    getTemporaryJsFileName,
} from "../../../../../shared";
import { Uri, workspace, WorkspaceEdit } from "vscode";
import { basename } from "path";
import { ConsoleLogger } from "../../logging/consoleLogger";

export async function deleteTemporaryJsFileForCollection(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collectionRootDirectory: string,
    logger?: ConsoleLogger,
) {
    const path = getTemporaryJsFileName(collectionRootDirectory);

    if (await checkIfPathExistsAsync(path)) {
        const workspaceEdit = new WorkspaceEdit();
        workspaceEdit.deleteFile(Uri.file(path));
        const wasSuccessful = await workspace.applyEdit(workspaceEdit);

        if (wasSuccessful) {
            tempJsFilesRegistry.unregisterJsFileForCollection(
                collectionRootDirectory,
            );
        } else {
            logger?.warn(
                `Unexpected error occured while trying to delete temp JS file for collection '${basename(
                    collectionRootDirectory,
                )}'.`,
            );
        }
    }

    tempJsFilesRegistry.unregisterJsFileForCollection(collectionRootDirectory);
}
