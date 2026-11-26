import { basename, dirname, resolve } from "path";
import {
    isPathEqualOrDescendant,
    isReservedPath,
    Logger,
    normalizePath,
} from "@global_shared";
import { TypedCollection, TypedCollectionItemProvider } from "@shared";
import { renameFilesAndFolders } from "../renameFileOrFolder";
import { PathRename } from "../runRequestPaths/getEditsForRunRequestPaths";
import { excludeConflictingRenames } from "../excludeConflictingRenames";
import { canNameHaveSequencePrefix } from "./canNameHaveSequencePrefix";
import { getNameWithoutSequencePrefix } from "./getNameWithoutSequencePrefix";

export interface RemovalOfSequencePrefixesResult {
    renamedCount: number;
    /** The number of items that were not renamed, because an item with the name without the prefix already exists or the name is reserved (see `isReservedPath`). */
    skippedCount: number;
    /** Whether renaming the items failed. The user has already been informed about it then. */
    failed: boolean;
}

/**
 * Removes the sequence prefixes (e.g. `00010_`) from the names of all requests, app files and folders (with a settings file) below the given folder.
 * Items that have no sequence (any more) are included, since the prefix cannot match their sequence.
 * Folders without a settings file are not included (e.g. if it was deleted), since their leading digits cannot be told apart from ones entered by the user (e.g. `007_bond`), see `canNameHaveSequencePrefix`.
 * Digits that belong to the actual name are kept (e.g. `2024_reports`, see `removeSequencePrefix`).
 * The given folder itself keeps its name. All renames are executed together. Items are never overwritten. If the name without prefix is already taken or reserved (e.g. for settings files), the item keeps its name.
 * Does not depend on the setting for prefixing names with their sequence.
 */
export async function removeSequencePrefixesRecursively(
    itemProvider: TypedCollectionItemProvider,
    collection: TypedCollection,
    folderPath: string,
    logger?: Logger,
): Promise<RemovalOfSequencePrefixesResult> {
    const plannedRenames: PathRename[] = [];
    let reservedCount = 0;

    for (const { item } of collection.getAllStoredDataForCollection()) {
        const itemPath = item.getPath();

        if (
            normalizePath(itemPath) == normalizePath(folderPath) ||
            !isPathEqualOrDescendant(itemPath, folderPath) ||
            !canNameHaveSequencePrefix(item)
        ) {
            continue;
        }

        const nameWithoutPrefix = await getNameWithoutSequencePrefix(item);

        if (nameWithoutPrefix == basename(itemPath)) {
            continue;
        }

        const targetPath = resolve(dirname(itemPath), nameWithoutPrefix);

        if (isReservedPath(collection, targetPath, item.isFile())) {
            logger?.warn(
                `Did not rename '${itemPath}' to '${targetPath}', because the new name is reserved.`,
            );
            reservedCount++;
            continue;
        }

        plannedRenames.push({
            sourcePath: itemPath,
            targetPath,
            isFile: item.isFile(),
        });
    }

    const renames = await excludeConflictingRenames(plannedRenames, logger);
    const skippedCount = reservedCount + plannedRenames.length - renames.length;

    if (!(await renameFilesAndFolders(itemProvider, renames, { logger }))) {
        return { renamedCount: 0, skippedCount, failed: true };
    }

    return { renamedCount: renames.length, skippedCount, failed: false };
}
