import { parseSequencePrefix, removeSequencePrefix } from "@global_shared";
import { shouldPrefixNamesWithSequence } from "@shared";

/**
 * The name that has to be stored in the file for a copied item. All names of files and folders are without file extension.
 * If names are prefixed with their sequence and the original item has a prefix, the prefix is not part of the stored name.
 * Names that were entered by the user must not be passed, since they are never changed.
 *
 * @param copiedItemName Derived from the name of the original item, so it has a prefix if the original item has one.
 */
export function getStoredNameForCopiedItem(
    copiedItemName: string,
    original: {
        name: string;
        sequence: number | undefined;
        storedName: string | undefined;
    },
) {
    const { name, sequence, storedName } = original;

    if (!shouldPrefixNamesWithSequence() || sequence === undefined) {
        return copiedItemName;
    }

    const hasPrefix =
        removeSequencePrefix(name, { sequence, storedName }) != name;

    return hasPrefix
        ? (parseSequencePrefix(copiedItemName)?.nameWithoutPrefix ??
              copiedItemName)
        : copiedItemName;
}
