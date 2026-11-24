import { removeSequencePrefix } from "@global_shared";
import {
    getSequenceStepFromSettings,
    shouldPrefixNamesWithSequence,
} from "@shared";

/**
 * The name that is stored in the file for an existing item with the given file or folder name (without file extension).
 * If names are prefixed with their sequence, the prefix of an item that has a sequence is not part of the stored name.
 * Names that were entered by the user must not be passed, since they are never changed.
 */
export function getStoredNameForItemName(
    itemName: string,
    itemSequence: number | undefined,
) {
    return shouldPrefixNamesWithSequence() && itemSequence !== undefined
        ? removeSequencePrefix(itemName, {
              sequence: itemSequence,
              sequenceStep: getSequenceStepFromSettings(),
          })
        : itemName;
}
