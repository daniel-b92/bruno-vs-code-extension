import { Uri, window, workspace, WorkspaceEdit } from "vscode";

export async function renameFileOrFolder(
    sourcePath: string,
    targetPath: string,
    isFile: boolean
) {
    const workspaceEdit = new WorkspaceEdit();

    workspaceEdit.renameFile(Uri.file(sourcePath), Uri.file(targetPath));

    const renamedSuccessfully = await workspace.applyEdit(workspaceEdit);

    if (renamedSuccessfully) {
        return true;
    } else {
        window.showErrorMessage(
            `Renaming / Moving ${
                isFile ? "file" : "folder"
            } '${sourcePath}' failed unexpectedly.`
        );

        return false;
    }
}
