import {
    checkIfPathExistsAsync,
    OutputChannelLogger,
} from "../../../../../shared";
import { Uri, workspace, WorkspaceEdit } from "vscode";
import { basename } from "path";

export async function deleteTemporaryJsFile(
    filePath: string,
    logger?: OutputChannelLogger,
) {
    if (await checkIfPathExistsAsync(filePath)) {
        const workspaceEdit = new WorkspaceEdit();
        workspaceEdit.deleteFile(Uri.file(filePath));
        const wasSuccessful = await workspace.applyEdit(workspaceEdit);

        if (!wasSuccessful) {
            logger?.warn(
                `Unexpected error occured while trying to delete temp JS file '${basename(
                    filePath,
                )}'.`,
            );
        }
    }
}
