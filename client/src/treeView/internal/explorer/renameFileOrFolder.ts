import { Uri, window, workspace, WorkspaceEdit } from "vscode";
import { Logger, getFileContent, normalizePath } from "@global_shared";
import {
    TypedCollection,
    TypedCollectionItemProvider,
    mapToVsCodeRange,
} from "@shared";
import {
    getEditsForRunRequestPaths,
    getPathAfterRenames,
    PathRename,
    RunRequestPathEdit,
} from "./runRequestPaths/getEditsForRunRequestPaths";
import {
    getRenameStepsInExecutionOrder,
    RenameStep,
    splitStepsIntoGroupsWithoutDependencies,
} from "./getRenameStepsInExecutionOrder";

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
    return await renameFilesAndFolders(
        itemProvider,
        [{ sourcePath, targetPath, isFile }],
        { logger, overwrite },
    );
}

/**
 * Renames or moves several files and folders in one workspace edit, so that all updates of `bru.runRequest` paths refer to the final locations.
 * The renames refer to the paths before any of them is executed. They are executed in an order that never overwrites an item that is renamed as well,
 * so the names of items can be shifted or swapped. This can take several workspace edits, since VS Code checks all targets of an edit before executing it.
 * The updates of `bru.runRequest` paths are part of the last one. The target paths must be distinct. Renames of an item to its own path are ignored.
 *
 * @returns Whether all items were renamed.
 */
export async function renameFilesAndFolders(
    itemProvider: TypedCollectionItemProvider,
    allRenames: PathRename[],
    options: {
        logger?: Logger;
        /** Whether existing items at the target paths should be replaced. Without it, the rename fails if a target exists. */
        overwrite?: boolean;
        /** Renames that were executed before, which are not reflected in the collection data yet (see `getEditsForRunRequestPaths`). */
        previousRenames?: PathRename[];
    } = {},
) {
    const { logger, overwrite = false, previousRenames } = options;
    const renames = allRenames.filter(
        ({ sourcePath, targetPath }) =>
            normalizePath(sourcePath) != normalizePath(targetPath),
    );

    if (renames.length == 0) {
        return true;
    }

    const pathEdits = await getRunRequestPathEditsSafely(
        itemProvider,
        renames,
        previousRenames,
        logger,
    );
    const groups = splitStepsIntoGroupsWithoutDependencies(
        getRenameStepsInExecutionOrder(
            renames.map(({ sourcePath, targetPath }) => ({
                from: sourcePath,
                to: targetPath,
            })),
        ),
    );
    const lastGroup = groups.pop() as RenameStep[];
    // Documents with unsaved changes keep them. The others are saved after the edit, so that later writes to the files do not conflict with their buffers.
    const dirtyFilePathsAfterRename = workspace.textDocuments
        .filter(({ isDirty }) => isDirty)
        .map(({ uri }) => getPathAfterRenames(uri.fsPath, renames));

    let renamedSuccessfully = true;

    for (const group of groups) {
        renamedSuccessfully = await workspace.applyEdit(
            createWorkspaceEdit(group, [], overwrite),
            { isRefactoring: true },
        );

        if (!renamedSuccessfully) {
            break;
        }
    }

    if (renamedSuccessfully) {
        renamedSuccessfully = await workspace.applyEdit(
            createWorkspaceEdit(lastGroup, pathEdits, overwrite),
            { isRefactoring: true },
        );

        if (!renamedSuccessfully && pathEdits.length > 0) {
            logger?.warn(
                `Renaming ${describeRenames(renames)} together with the updates of 'bru.runRequest' paths failed. Renaming without these updates.`,
            );
            renamedSuccessfully = await workspace.applyEdit(
                createWorkspaceEdit(lastGroup, [], overwrite),
            );
        } else if (renamedSuccessfully) {
            await saveEditedFiles(pathEdits, dirtyFilePathsAfterRename, logger);
        }
    }

    if (renamedSuccessfully) {
        return true;
    } else {
        window.showErrorMessage(
            renames.length == 1
                ? `Renaming / Moving ${
                      renames[0].isFile ? "file" : "folder"
                  } '${renames[0].sourcePath}' failed unexpectedly.`
                : `Renaming / Moving ${renames.length} items failed unexpectedly.`,
        );

        return false;
    }
}

function describeRenames(renames: PathRename[]) {
    return renames.length == 1
        ? `'${renames[0].sourcePath}'`
        : `${renames.length} items`;
}

async function getRunRequestPathEditsSafely(
    itemProvider: TypedCollectionItemProvider,
    renames: PathRename[],
    previousRenames: PathRename[] | undefined,
    logger?: Logger,
): Promise<RunRequestPathEdit[]> {
    const renamesByCollection = new Map<TypedCollection, PathRename[]>();

    for (const rename of renames) {
        const collection = itemProvider.getAncestorCollectionForPath(
            rename.sourcePath,
        );

        if (collection) {
            renamesByCollection.set(collection, [
                ...(renamesByCollection.get(collection) ?? []),
                rename,
            ]);
        }
    }

    const edits: RunRequestPathEdit[] = [];

    for (const [collection, collectionRenames] of renamesByCollection) {
        try {
            edits.push(
                ...(await getEditsForRunRequestPaths(
                    collection,
                    collectionRenames,
                    getCurrentFileContent,
                    logger,
                    previousRenames,
                )),
            );
        } catch (error) {
            logger?.error(
                `Could not determine the 'bru.runRequest' paths to update when renaming ${describeRenames(collectionRenames)}: ${error}`,
            );
        }
    }

    return edits;
}

function createWorkspaceEdit(
    steps: RenameStep[],
    pathEdits: RunRequestPathEdit[],
    overwrite: boolean,
) {
    const workspaceEdit = new WorkspaceEdit();

    // The file operations are applied in the order they were added. The text edits refer to the locations after all of them.
    steps.forEach(({ from, to }) =>
        workspaceEdit.renameFile(
            Uri.file(from),
            Uri.file(to),
            overwrite ? { overwrite: true } : undefined,
        ),
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
