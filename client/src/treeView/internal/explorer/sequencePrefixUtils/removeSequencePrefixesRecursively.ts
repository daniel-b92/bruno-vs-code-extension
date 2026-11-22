import { basename, dirname, extname, resolve, sep } from "path";
import {
    BrunoFileType,
    checkIfPathExistsAsync,
    isCollectionItemWithSequence,
    isPathEqualOrDescendant,
    Logger,
    NonBrunoSpecificItemType,
    normalizePath,
    parseSequencePrefix,
} from "@global_shared";
import { TypedCollection, TypedCollectionItemProvider } from "@shared";
import { renameFileOrFolder } from "../renameFileOrFolder";

/**
 * Removes the sequence prefixes (e.g. `010_`) from the names of all requests, app files and folders with a sequence below the given folder.
 * The given folder itself keeps its name. Items are never overwritten. If the name without prefix is already taken, the item keeps its name.
 * Does not depend on the setting for prefixing names with their sequence.
 *
 * @returns The number of renamed items.
 */
export async function removeSequencePrefixesRecursively(
    itemProvider: TypedCollectionItemProvider,
    collection: TypedCollection,
    folderPath: string,
    logger?: Logger,
) {
    const itemsToRename: { path: string; isFile: boolean }[] = [];

    for (const { item } of collection.getAllStoredDataForCollection()) {
        const itemPath = item.getPath();
        const itemType = item.getItemType();

        if (
            normalizePath(itemPath) == normalizePath(folderPath) ||
            !isPathEqualOrDescendant(itemPath, folderPath) ||
            !isCollectionItemWithSequence(item) ||
            item.getSequence() === undefined
        ) {
            continue;
        }

        if (
            itemType == BrunoFileType.RequestFile ||
            itemType == BrunoFileType.AppFile
        ) {
            itemsToRename.push({ path: itemPath, isFile: true });
        } else if (itemType == NonBrunoSpecificItemType.Directory) {
            itemsToRename.push({ path: itemPath, isFile: false });
        }
    }

    // Folders must be renamed after the items within them, since the paths of their descendants change.
    itemsToRename.sort(
        (a, b) => b.path.split(sep).length - a.path.split(sep).length,
    );

    let renamedCount = 0;

    for (const { path, isFile } of itemsToRename) {
        const extension = isFile ? extname(path) : "";
        const nameWithoutPrefix = parseSequencePrefix(
            basename(path, extension),
        )?.nameWithoutPrefix;

        if (nameWithoutPrefix === undefined) {
            continue;
        }

        const newPath = resolve(
            dirname(path),
            `${nameWithoutPrefix}${extension}`,
        );

        if (await checkIfPathExistsAsync(newPath)) {
            logger?.warn(
                `Did not remove the sequence prefix of '${path}', because '${newPath}' already exists.`,
            );
            continue;
        }

        if (
            await renameFileOrFolder(
                itemProvider,
                path,
                newPath,
                isFile,
                logger,
            )
        ) {
            renamedCount++;
        }
    }

    return renamedCount;
}
