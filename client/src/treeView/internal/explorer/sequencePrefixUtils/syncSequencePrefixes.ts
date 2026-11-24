import { basename, dirname, extname, resolve } from "path";
import {
    addSequencePrefix,
    canSequenceBeUsedAsPrefix,
    getSequencesForRequestsAndAppFiles,
    getStoredItemNameFromFile,
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
 * Items whose sequence cannot be used as a prefix (see `canSequenceBeUsedAsPrefix`) keep their names.
 * Does nothing if prefixing names with the sequence is not enabled in the settings.
 *
 * All renames are executed together, so that items can take over the names of items that are renamed as well (e.g. when sequences were shifted).
 * Items are never overwritten. If the new name is taken by an item that is not renamed, the item keeps its name.
 *
 * @param options.previousRenames Renames that were executed shortly before and are not reflected in the collection data yet (e.g. when moving an item), so that `bru.runRequest` paths are updated correctly.
 * @param options.sequenceStep The step that determines the number of digits of the prefixes. Defaults to the step of the settings. The sequences may have been normalized with another one.
 * @returns The renames that were executed. Use `getPathAfterRenames` to get the new location of an item, which can also be affected by the rename of an ancestor folder.
 */
export async function syncSequencePrefixes(
    itemProvider: TypedCollectionItemProvider,
    folderPaths: string[],
    options: {
        logger?: Logger;
        previousRenames?: PathRename[];
        sequenceStep?: number;
    } = {},
): Promise<PathRename[]> {
    if (!shouldPrefixNamesWithSequence()) {
        return [];
    }

    const {
        logger,
        previousRenames,
        sequenceStep = getSequenceStepFromSettings(),
    } = options;
    const plannedRenames: PathRename[] = [];

    for (const folderPath of getUniquePaths(folderPaths)) {
        const items = [
            ...(
                await getSequencesForRequestsAndAppFiles(
                    itemProvider,
                    folderPath,
                )
            ).map(({ path, sequence }) => ({
                path,
                sequence,
                fileWithStoredName: path,
                isFile: true,
            })),
            ...(await getSequencesForFolders(itemProvider, folderPath)).map(
                ({ folderPath: path, settingsFile, sequence }) => ({
                    path,
                    sequence,
                    fileWithStoredName: settingsFile,
                    isFile: false,
                }),
            ),
        ];

        for (const item of items) {
            if (canSequenceBeUsedAsPrefix(item.sequence)) {
                plannedRenames.push(
                    await getRenameToMatchSequence(item, sequenceStep),
                );
            }
        }
    }

    const renames = await excludeConflictingRenames(plannedRenames, logger);

    return (await renameFilesAndFolders(itemProvider, renames, {
        logger,
        previousRenames,
    }))
        ? renames
        : [];
}

async function getRenameToMatchSequence(
    {
        path,
        sequence,
        fileWithStoredName,
        isFile,
    }: {
        path: string;
        sequence: number;
        fileWithStoredName: string;
        isFile: boolean;
    },
    sequenceStep: number,
): Promise<PathRename> {
    const extension = isFile ? extname(path) : "";
    const newName = addSequencePrefix(basename(path, extension), {
        sequence,
        sequenceStep,
        storedName: await getStoredItemNameFromFile(fileWithStoredName),
    });

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
