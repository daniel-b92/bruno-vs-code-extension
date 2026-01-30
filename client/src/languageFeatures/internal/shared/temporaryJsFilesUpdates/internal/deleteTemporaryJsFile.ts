import { OutputChannelLogger } from "@shared";
import { Uri, workspace, WorkspaceEdit } from "vscode";
import { basename, dirname } from "path";
import { everyAsync, checkIfPathExistsAsync } from "@global_shared";

export async function deleteTemporaryJsFiles(
    filePaths: string[],
    logger?: OutputChannelLogger,
) {
    if (
        await everyAsync(
            filePaths,
            async (path) => await checkIfPathExistsAsync(path),
        )
    ) {
        const workspaceEdit = new WorkspaceEdit();

        for (const path of filePaths) {
            workspaceEdit.deleteFile(Uri.file(path));
        }

        const wasSuccessful = await workspace.applyEdit(workspaceEdit);

        if (!wasSuccessful) {
            logger?.warn(
                `Unexpected error occured while trying to delete temp JS files in folders ${JSON.stringify(
                    filePaths.map((path) => basename(dirname(path))),
                    null,
                    2,
                )}.`,
            );
        }
    }
}
