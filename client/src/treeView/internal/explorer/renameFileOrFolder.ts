import { Uri, window, workspace, WorkspaceEdit } from "vscode";
import { Logger, getFileContent } from "@global_shared";
import { TypedCollectionItemProvider, mapToVsCodeRange } from "@shared";
import {
    getEditsForRunRequestPaths,
    getPathAfterRenames,
    RunRequestPathEdit,
} from "./runRequestPaths/getEditsForRunRequestPaths";

/**
 * Renames or moves the file or folder. Paths in `bru.runRequest` calls that refer to renamed requests are updated within the same workspace edit.
 */
export async function renameFileOrFolder(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    targetPath: string,
    isFile: boolean,
    logger?: Logger,
    /** Whether an existing item at the target path should be replaced. Without it, the rename fails if the target exists. */
    overwrite = false,
) {
    const pathEdits = await getRunRequestPathEditsSafely(
        itemProvider,
        sourcePath,
        targetPath,
        isFile,
        logger,
    );
    // Documents with unsaved changes keep them. The others are saved after the edit, so that later writes to the files do not conflict with their buffers.
    const dirtyFilePathsAfterRename = workspace.textDocuments
        .filter(({ isDirty }) => isDirty)
        .map(({ uri }) =>
            getPathAfterRenames(uri.fsPath, [
                { sourcePath, targetPath, isFile },
            ]),
        );

    let renamedSuccessfully = await workspace.applyEdit(
        createWorkspaceEdit(sourcePath, targetPath, pathEdits, overwrite),
        { isRefactoring: true },
    );

    if (!renamedSuccessfully && pathEdits.length > 0) {
        logger?.warn(
            `Renaming '${sourcePath}' together with the updates of 'bru.runRequest' paths failed. Renaming without these updates.`,
        );
        renamedSuccessfully = await workspace.applyEdit(
            createWorkspaceEdit(sourcePath, targetPath, [], overwrite),
        );
    } else if (renamedSuccessfully) {
        await saveEditedFiles(pathEdits, dirtyFilePathsAfterRename, logger);
    }

    if (renamedSuccessfully) {
        return true;
    } else {
        window.showErrorMessage(
            `Renaming / Moving ${
                isFile ? "file" : "folder"
            } '${sourcePath}' failed unexpectedly.`,
        );

        return false;
    }
}

async function getRunRequestPathEditsSafely(
    itemProvider: TypedCollectionItemProvider,
    sourcePath: string,
    targetPath: string,
    isFile: boolean,
    logger?: Logger,
): Promise<RunRequestPathEdit[]> {
    const collection = itemProvider.getAncestorCollectionForPath(sourcePath);

    if (!collection) {
        return [];
    }

    try {
        return await getEditsForRunRequestPaths(
            collection,
            [{ sourcePath, targetPath, isFile }],
            getCurrentFileContent,
            logger,
        );
    } catch (error) {
        logger?.error(
            `Could not determine the 'bru.runRequest' paths to update when renaming '${sourcePath}': ${error}`,
        );
        return [];
    }
}

function createWorkspaceEdit(
    sourcePath: string,
    targetPath: string,
    pathEdits: RunRequestPathEdit[],
    overwrite: boolean,
) {
    const workspaceEdit = new WorkspaceEdit();

    workspaceEdit.renameFile(
        Uri.file(sourcePath),
        Uri.file(targetPath),
        overwrite ? { overwrite: true } : undefined,
    );
    pathEdits.forEach(({ filePath, range, newText }) =>
        workspaceEdit.replace(
            Uri.file(filePath),
            mapToVsCodeRange(range),
            newText,
        ),
    );

    return workspaceEdit;
}

async function saveEditedFiles(
    pathEdits: RunRequestPathEdit[],
    dirtyFilePaths: string[],
    logger?: Logger,
) {
    const filesToSave = new Set(
        pathEdits
            .map(({ filePath }) => filePath)
            .filter((filePath) => !dirtyFilePaths.includes(filePath)),
    );

    for (const filePath of filesToSave) {
        try {
            await workspace.save(Uri.file(filePath));
        } catch (error) {
            logger?.warn(
                `Could not save '${filePath}' after updating 'bru.runRequest' paths: ${error}`,
            );
        }
    }
}

/** Prefers the content of open documents, since their ranges have to match the (possibly unsaved) buffer. */
async function getCurrentFileContent(path: string) {
    const openDocument = workspace.textDocuments.find(
        ({ uri }) => uri.fsPath == path,
    );

    return openDocument ? openDocument.getText() : await getFileContent(path);
}
