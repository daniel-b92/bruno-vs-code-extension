import { basename, dirname, extname, resolve } from "path";
import {
    addSequencePrefix,
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
import { renameFilesAndFolders } from "../renameFileOrFolder";
import { PathRename } from "../runRequestPaths/getEditsForRunRequestPaths";
import { excludeConflictingRenames } from "../excludeConflictingRenames";

/**
 * Renames the requests, app files and folders (that have a sequence) directly within the given folders, so that their names start with their sequence.
 * Does nothing if prefixing names with the sequence is not enabled in the settings.
 *
 * All renames are executed together, so that items can take over the names of items that are renamed as well (e.g. when sequences were shifted).
 * Items are never overwritten. If the new name is taken by an item that is not renamed, the item keeps its name.
 *
 * @param previousRenames Renames that were executed shortly before and are not reflected in the collection data yet (e.g. when moving an item), so that `bru.runRequest` paths are updated correctly.
 * @returns The new paths of the renamed items, with the normalized old paths as keys.
 */
export async function syncSequencePrefixes(
    itemProvider: TypedCollectionItemProvider,
    folderPaths: string[],
    logger?: Logger,
    previousRenames?: PathRename[],
) {
    const renamedPaths = new Map<string, string>();

    if (!shouldPrefixNamesWithSequence()) {
        return renamedPaths;
    }

    const sequenceStep = getSequenceStepFromSettings();
    const plannedRenames: PathRename[] = [];

    for (const folderPath of getUniquePaths(folderPaths)) {
        const files = await getSequencesForRequestsAndAppFiles(
            itemProvider,
            folderPath,
        );
        const folders = await getSequencesForFolders(itemProvider, folderPath);

        for (const { path, sequence } of files) {
            plannedRenames.push(
                getRenameToMatchSequence(path, sequence, true, sequenceStep),
            );
        }
        for (const { folderPath: path, sequence } of folders) {
            plannedRenames.push(
                getRenameToMatchSequence(path, sequence, false, sequenceStep),
            );
        }
    }

    const renames = await excludeConflictingRenames(plannedRenames, logger);

    if (
        await renameFilesAndFolders(itemProvider, renames, {
            logger,
            previousRenames,
        })
    ) {
        renames.forEach(({ sourcePath, targetPath }) =>
            renamedPaths.set(normalizePath(sourcePath), targetPath),
        );
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

function getRenameToMatchSequence(
    path: string,
    sequence: number,
    isFile: boolean,
    sequenceStep: number,
): PathRename {
    const extension = isFile ? extname(path) : "";
    const newName = addSequencePrefix(
        basename(path, extension),
        sequence,
        sequenceStep,
    );

    return {
        sourcePath: path,
        targetPath: resolve(dirname(path), `${newName}${extension}`),
        isFile,
    };
}

function getUniquePaths(paths: string[]) {
    return Array.from(
        new Map(paths.map((path) => [normalizePath(path), path])).values(),
    );
}
