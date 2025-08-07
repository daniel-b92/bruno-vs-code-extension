import { TemporaryJsFilesRegistry } from "./temporaryJsFilesRegistry";
import {
    checkIfPathExistsAsync,
    getTemporaryJsFileName,
    OutputChannelLogger,
} from "../../../../shared";
import { Uri, workspace, WorkspaceEdit } from "vscode";
import { basename } from "path";

export async function deleteTemporaryJsFileForCollection(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collectionRootDirectory: string,
    logger?: OutputChannelLogger
) {
    const path = getTemporaryJsFileName(collectionRootDirectory);

    if (await checkIfPathExistsAsync(path)) {
        const workspaceEdit = new WorkspaceEdit();
        workspaceEdit.deleteFile(Uri.file(path));
        const wasSuccessful = await workspace.applyEdit(workspaceEdit);

        if (wasSuccessful) {
            tempJsFilesRegistry.unregisterJsFileForCollection(
                collectionRootDirectory
            );
        } else {
            logger?.warn(
                `Unexpected error occured while trying to delete temp JS file for collection '${basename(
                    collectionRootDirectory
                )}'.`
            );
        }
    }

    tempJsFilesRegistry.unregisterJsFileForCollection(collectionRootDirectory);
}
