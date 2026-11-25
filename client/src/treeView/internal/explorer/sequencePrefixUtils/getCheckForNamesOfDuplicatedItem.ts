import { basename, dirname } from "path";
import { CollectionItem } from "@global_shared";
import { shouldPrefixNamesWithSequence, TypedCollection } from "@shared";
import { getNameWithoutSequencePrefix } from "./getNameWithoutSequencePrefix";
import { getSiblingNamesWithoutSequencePrefix } from "./getSiblingNamesWithoutSequencePrefix";

/**
 * Returns a function that checks whether the name for a duplicate of the item only differs in the sequence prefix from the one of a sibling.
 * The checked names must start with the prefix of the original item (if it has one), which is replaced after duplicating.
 * Returns `undefined` if prefixing names with the sequence is not enabled in the settings.
 */
export async function getCheckForNamesOfDuplicatedItem(
    collection: TypedCollection,
    originalItem: CollectionItem,
) {
    if (!shouldPrefixNamesWithSequence()) {
        return undefined;
    }

    const originalPath = originalItem.getPath();
    const prefixLength =
        basename(originalPath).length -
        (await getNameWithoutSequencePrefix(originalItem)).length;
    const siblingNames = await getSiblingNamesWithoutSequencePrefix(
        collection,
        dirname(originalPath),
        { isFile: originalItem.isFile() },
    );

    return (name: string) =>
        siblingNames.includes(name.substring(prefixLength));
}
