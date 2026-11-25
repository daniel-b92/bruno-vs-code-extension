import { dirname } from "path";
import { CollectionItem, normalizePath } from "@global_shared";
import { shouldPrefixNamesWithSequence, TypedCollection } from "@shared";
import { canNameHaveSequencePrefix } from "./canNameHaveSequencePrefix";
import { findNameUsedBySibling } from "./findNameUsedBySibling";
import { getNameWithoutSequencePrefix } from "./getNameWithoutSequencePrefix";
import { getSiblingNamesWithoutSequencePrefix } from "./getSiblingNamesWithoutSequencePrefix";

/**
 * Returns the name (without sequence prefix) of the item in the target folder that conflicts with the one of an item that should be pasted or moved there.
 * Returns `undefined` if there is no conflict or if prefixing names with the sequence is not enabled in the settings.
 *
 * @param replacedPath The path of the item that is moved or overwritten. If it is already located in the target folder, no additional item is created there, so there is no conflict.
 */
export async function getNameUsedBySiblingOfInsertedItem(
    targetCollection: TypedCollection,
    sourceItem: CollectionItem,
    targetFolder: string,
    replacedPath: string,
) {
    if (
        !shouldPrefixNamesWithSequence() ||
        !canNameHaveSequencePrefix(sourceItem) ||
        (normalizePath(dirname(replacedPath)) == normalizePath(targetFolder) &&
            targetCollection.getStoredDataForPath(replacedPath) !== undefined)
    ) {
        return undefined;
    }

    const name = await getNameWithoutSequencePrefix(sourceItem);
    const siblingNames = await getSiblingNamesWithoutSequencePrefix(
        targetCollection,
        targetFolder,
        { isFile: sourceItem.isFile() },
    );

    return findNameUsedBySibling(name, siblingNames);
}
