import { Uri, window, workspace, WorkspaceEdit } from "vscode";
import {
    checkIfPathExistsAsync,
    filterAsync,
    Logger,
    getFileContent,
    normalizePath,
} from "@global_shared";
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
 * Renames or moves several files and folders together, so that all updates of `bru.runRequest` paths refer to the final locations.
 * The renames refer to the paths before any of them is executed. They are executed in an order that never overwrites an item that is renamed as well,
 * so the names of items can be shifted or swapped. This can take several workspace edits, since the renames of an edit must not depend on each other (see `splitStepsIntoGroupsWithoutDependencies`).
 * The updates of `bru.runRequest` paths are part of the last one. The target paths must be distinct. Renames of an item to its own path are ignored.
 *
 * If one of the edits fails, the renames that were already executed are rolled back, so that either all or none of the items are renamed.
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
        /** Items that were created shortly before and may not be in the collection data yet (see `getEditsForRunRequestPaths`). */
        uncachedItemPaths?: string[];
    } = {},
) {
    const {
        logger,
        overwrite = false,
        previousRenames,
        uncachedItemPaths,
    } = options;
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
        { previousRenames, uncachedItemPaths },
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
    // Documents with unsaved changes keep them. The others are saved after the edit, so that later writes to the files do not conflict with their buffers.
    const dirtyFilePathsAfterRename = workspace.textDocuments
        .filter(({ isDirty }) => isDirty)
        .map(({ uri }) => getPathAfterRenames(uri.fsPath, renames));

    const executedSteps: RenameStep[] = [];

    for (const [index, group] of groups.entries()) {
        const groupEdits = index == groups.length - 1 ? pathEdits : [];
        // Without this, a step whose source was missing before the edit would count as executed if its target exists.
        const existingSources = await getExistingSources(group);
        const isExecuted = (step: RenameStep) =>
            isStepExecuted(step, existingSources);
        let wasSuccessful = await workspace.applyEdit(
            createWorkspaceEdit(group, groupEdits, overwrite),
            { isRefactoring: true },
        );

        if (wasSuccessful) {
            await saveEditedFiles(
                groupEdits,
                dirtyFilePathsAfterRename,
                logger,
            );
        } else if (groupEdits.length > 0) {
            logger?.warn(
                `Renaming ${describeRenames(renames)} together with the updates of 'bru.runRequest' paths failed. Renaming without these updates.`,
            );
            const remainingSteps = await filterAsync(
                group,
                async (step) => !(await isExecuted(step)),
            );
            wasSuccessful =
                remainingSteps.length == 0 ||
                (await workspace.applyEdit(
                    createWorkspaceEdit(remainingSteps, [], overwrite),
                ));
        }

        if (!wasSuccessful) {
            // Some of the steps may have been executed before the edit failed.
            executedSteps.push(...(await filterAsync(group, isExecuted)));
            showErrorForFailedRenames(
                renames,
                await rollBackSteps(executedSteps, logger),
            );

            return false;
        }

        executedSteps.push(...group);
    }

    return true;
}

/** @returns Whether all items have their original names again. */
async function rollBackSteps(executedSteps: RenameStep[], logger?: Logger) {
    const groups = splitStepsIntoGroupsWithoutDependencies(
        executedSteps.map(({ from, to }) => ({ from: to, to: from })).reverse(),
    );

    for (const group of groups) {
        if (
            !(await workspace.applyEdit(createWorkspaceEdit(group, [], false), {
                isRefactoring: true,
            }))
        ) {
            logger?.error(
                `Could not undo the renames that were executed before a rename failed: ${executedSteps.map(({ from, to }) => `'${from}' to '${to}'`).join(", ")}`,
            );
            return false;
        }
    }

    return true;
}

async function getExistingSources(steps: RenameStep[]) {
    return new Set(
        (
            await filterAsync(steps, ({ from }) => checkIfPathExistsAsync(from))
        ).map(({ from }) => from),
    );
}

/**
 * The steps of a group do not depend on each other, so a step was executed by the edit if its source existed before and was moved to its target.
 * @param existingSources The sources that existed before the edit (see `getExistingSources`).
 */
async function isStepExecuted(
    { from, to }: RenameStep,
    existingSources: Set<string>,
) {
    return (
        existingSources.has(from) &&
        !(await checkIfPathExistsAsync(from)) &&
        (await checkIfPathExistsAsync(to))
    );
}

function showErrorForFailedRenames(
    renames: PathRename[],
    wasRolledBack: boolean,
) {
    const message =
        renames.length == 1
            ? `Renaming / Moving ${
                  renames[0].isFile ? "file" : "folder"
              } '${renames[0].sourcePath}' failed unexpectedly.`
            : `Renaming / Moving ${renames.length} items failed unexpectedly.`;

    window.showErrorMessage(
        wasRolledBack
            ? message
            : `${message} Some of the items could not be renamed back to their original names.`,
    );
}

function describeRenames(renames: PathRename[]) {
    return renames.length == 1
        ? `'${renames[0].sourcePath}'`
        : `${renames.length} items`;
}

async function getRunRequestPathEditsSafely(
    itemProvider: TypedCollectionItemProvider,
    renames: PathRename[],
    options: { previousRenames?: PathRename[]; uncachedItemPaths?: string[] },
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
                    options,
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
