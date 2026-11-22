import { basename, dirname, extname, resolve, sep } from "path";
import {
    addSequencePrefix,
    checkIfPathExistsAsync,
    getSequencesForRequestsAndAppFiles,
    Logger,
    normalizePath,
} from "@global_shared";
import {
    getSequencesForFolders,
    getSequenceStepFromSettings,
    shouldPrefixNamesWithSequence,
    TypedCollectionItemProvider,
} from "@shared";
import { renameFileOrFolder } from "../renameFileOrFolder";

/**
 * Renames the requests, app files and folders (that have a sequence) directly within the given folders, so that their names start with their sequence.
 * Does nothing if prefixing names with the sequence is not enabled in the settings.
 *
 * Items are never overwritten. If the new name is already taken, the item keeps its name.
 *
 * @returns The new paths of the renamed items, with the normalized old paths as keys.
 */
export async function syncSequencePrefixes(
    itemProvider: TypedCollectionItemProvider,
    folderPaths: string[],
    logger?: Logger,
) {
    const renamedPaths = new Map<string, string>();

    if (!shouldPrefixNamesWithSequence()) {
        return renamedPaths;
    }

    const sequenceStep = getSequenceStepFromSettings();

    for (const folderPath of getUniquePathsWithDescendantsFirst(folderPaths)) {
        // Folders are renamed after the files, but both only have an effect on direct children of the folder.
        const files = await getSequencesForRequestsAndAppFiles(
            itemProvider,
            folderPath,
        );
        const folders = await getSequencesForFolders(itemProvider, folderPath);

        for (const { path, sequence } of files) {
            await renameToMatchSequence(
                { path, sequence, isFile: true },
                { itemProvider, sequenceStep, renamedPaths, logger },
            );
        }
        for (const { folderPath: path, sequence } of folders) {
            await renameToMatchSequence(
                { path, sequence, isFile: false },
                { itemProvider, sequenceStep, renamedPaths, logger },
            );
        }
    }

    return renamedPaths;
}

/** Applies the renames of {@link syncSequencePrefixes} to a path that was determined before. */
export function getPathAfterSequencePrefixSync(
    path: string,
    renamedPaths: Map<string, string>,
) {
    return renamedPaths.get(normalizePath(path)) ?? path;
}

async function renameToMatchSequence(
    item: { path: string; sequence: number; isFile: boolean },
    context: {
        itemProvider: TypedCollectionItemProvider;
        sequenceStep: number;
        renamedPaths: Map<string, string>;
        logger?: Logger;
    },
) {
    const { path, sequence, isFile } = item;
    const { itemProvider, sequenceStep, renamedPaths, logger } = context;
    const extension = isFile ? extname(path) : "";
    const currentName = basename(path, extension);
    const newName = addSequencePrefix(currentName, sequence, sequenceStep);

    if (newName == currentName) {
        return;
    }

    const newPath = resolve(dirname(path), `${newName}${extension}`);

    if (await checkIfPathExistsAsync(newPath)) {
        logger?.warn(
            `Did not rename '${path}' to match its sequence, because '${newPath}' already exists.`,
        );
        return;
    }

    if (await renameFileOrFolder(itemProvider, path, newPath, isFile, logger)) {
        renamedPaths.set(normalizePath(path), newPath);
    }
}

/** Folders that are located deeper are first, so that renaming a folder does not invalidate the paths of folders that are still to be handled. */
function getUniquePathsWithDescendantsFirst(paths: string[]) {
    const uniquePaths = new Map(
        paths.map((path) => [normalizePath(path), path]),
    );

    return Array.from(uniquePaths.values()).sort(
        (a, b) => b.split(sep).length - a.split(sep).length,
    );
}
