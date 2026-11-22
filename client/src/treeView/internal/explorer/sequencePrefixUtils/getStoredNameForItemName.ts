import { removeSequencePrefix } from "@global_shared";
import { shouldPrefixNamesWithSequence } from "@shared";

/**
 * The name that is stored in the file for an item with the given file or folder name (without file extension).
 * If names are prefixed with their sequence, the prefix is not part of the stored name.
 */
export function getStoredNameForItemName(itemName: string) {
    return shouldPrefixNamesWithSequence()
        ? removeSequencePrefix(itemName)
        : itemName;
}
