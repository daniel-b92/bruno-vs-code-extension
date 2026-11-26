import { resolve, dirname, extname } from "path";
import { normalizePath } from "@global_shared";
import {
    validateNameHasNoPathSeparator,
    validateNameIsNotEmpty,
    validateNameIsNotUsedBySibling,
} from "./validateEnteredName";
import { validateNewItemNameIsUnique } from "./validateNewItemNameIsUnique";

/**
 * Validates the name that the user entered for renaming a file or folder.
 *
 * @param sequencePrefix The prefix that the name of the item has to start with, if names are prefixed with sequences (e.g. `00010_`).
 * It cannot be changed when renaming, since it has to match the sequence of the item.
 * @param siblingNamesWithoutPrefix The names that cannot be used, even if the prefixes differ (see `getSiblingNamesWithoutSequencePrefix`).
 */
export async function validateNewNameForRenaming(
    enteredName: string,
    originalPath: string,
    sequencePrefix?: string,
    siblingNamesWithoutPrefix: string[] = [],
) {
    const nameWithoutPrefix = removeEnteredSequencePrefix(
        enteredName,
        sequencePrefix,
    );
    const newPath = resolve(dirname(originalPath), enteredName);
    const syntaxError =
        validateNameIsNotEmpty(nameWithoutPrefix, extname(originalPath)) ??
        validateNameHasNoPathSeparator(enteredName) ??
        validateSequencePrefixIsKept(enteredName, sequencePrefix);

    // The name of an existing item can always be kept, even if a sibling only differs in the prefix.
    if (syntaxError || normalizePath(newPath) == normalizePath(originalPath)) {
        return syntaxError;
    }

    return (
        (await validateNewItemNameIsUnique(newPath, originalPath)) ??
        validateNameIsNotUsedBySibling(
            nameWithoutPrefix,
            siblingNamesWithoutPrefix,
        )
    );
}

/**
 * Removes the given sequence prefix from the start of the entered name.
 * Only exactly this prefix is removed, so that digits that belong to the actual name are kept (e.g. `00010_404_not-found.bru`).
 */
export function removeEnteredSequencePrefix(
    enteredName: string,
    sequencePrefix?: string,
) {
    return sequencePrefix !== undefined &&
        enteredName.startsWith(sequencePrefix)
        ? enteredName.substring(sequencePrefix.length)
        : enteredName;
}

function validateSequencePrefixIsKept(
    enteredName: string,
    sequencePrefix?: string,
) {
    return sequencePrefix === undefined ||
        enteredName.startsWith(sequencePrefix)
        ? undefined
        : `The prefix '${sequencePrefix}' must be kept, since it matches the sequence. Change the sequence to reorder the item.`;
}
