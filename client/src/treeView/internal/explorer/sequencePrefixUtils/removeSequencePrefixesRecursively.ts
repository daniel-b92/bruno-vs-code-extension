import { basename, dirname, extname, resolve } from "path";
import {
    BrunoFileType,
    CollectionDirectory,
    isCollectionItemWithSequence,
    isPathEqualOrDescendant,
    Logger,
    normalizePath,
    removeSequencePrefix,
} from "@global_shared";
import {
    getSequenceStepFromSettings,
    TypedCollection,
    TypedCollectionItemProvider,
} from "@shared";
import { renameFilesAndFolders } from "../renameFileOrFolder";
import { PathRename } from "../runRequestPaths/getEditsForRunRequestPaths";
import { excludeConflictingRenames } from "../excludeConflictingRenames";

export interface RemovalOfSequencePrefixesResult {
    renamedCount: number;
    /** The number of items that were not renamed, because an item with the name without the prefix already exists. */
    skippedCount: number;
    /** Whether renaming the items failed. The user has already been informed about it then. */
    failed: boolean;
}

/**
 * Removes the sequence prefixes (e.g. `0010_`) from the names of all requests, app files and folders (with a settings file) below the given folder.
 * Items that have no sequence (any more) are included, since the prefix cannot match their sequence.
 * Only prefixes that look like they were created by the extension are removed, so a name like `2024_reports` is kept (see `removeSequencePrefix`).
 * The given folder itself keeps its name. All renames are executed together. Items are never overwritten. If the name without prefix is already taken, the item keeps its name.
 * Does not depend on the setting for prefixing names with their sequence.
 */
export async function removeSequencePrefixesRecursively(
    itemProvider: TypedCollectionItemProvider,
    collection: TypedCollection,
    folderPath: string,
    logger?: Logger,
): Promise<RemovalOfSequencePrefixesResult> {
    const plannedRenames: PathRename[] = [];
    const sequenceStep = getSequenceStepFromSettings();

    for (const { item } of collection.getAllStoredDataForCollection()) {
        const itemPath = item.getPath();
        const itemType = item.getItemType();

        if (
            normalizePath(itemPath) == normalizePath(folderPath) ||
            !isPathEqualOrDescendant(itemPath, folderPath)
        ) {
            continue;
        }

        const isFile =
            itemType == BrunoFileType.RequestFile ||
            itemType == BrunoFileType.AppFile;
        const isFolderWithSettings =
            item instanceof CollectionDirectory &&
            item.getSettingsFilePath() !== undefined;

        if (!isFile && !isFolderWithSettings) {
            continue;
        }

        const extension = isFile ? extname(itemPath) : "";
        const name = basename(itemPath, extension);
        const nameWithoutPrefix = removeSequencePrefix(name, {
            sequence: isCollectionItemWithSequence(item)
                ? item.getSequence()
                : undefined,
            sequenceStep,
        });

        if (nameWithoutPrefix != name) {
            plannedRenames.push({
                sourcePath: itemPath,
                targetPath: resolve(
                    dirname(itemPath),
                    `${nameWithoutPrefix}${extension}`,
                ),
                isFile,
            });
        }
    }

    const renames = await excludeConflictingRenames(plannedRenames, logger);
    const skippedCount = plannedRenames.length - renames.length;

    if (!(await renameFilesAndFolders(itemProvider, renames, { logger }))) {
        return { renamedCount: 0, skippedCount, failed: true };
    }

    return { renamedCount: renames.length, skippedCount, failed: false };
}
