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
 * @param getFullItemName Adds the sequence prefix to the entered name, if the names of the item start with its sequence.
 * @param siblingNamesWithoutPrefix The names that cannot be used, even if the prefixes differ (see `getSiblingNamesWithoutSequencePrefix`).
 */
export async function validateNewNameForRenaming(
    enteredName: string,
    originalPath: string,
    getFullItemName: (enteredName: string) => string,
    siblingNamesWithoutPrefix: string[] = [],
) {
    const newPath = resolve(
        dirname(originalPath),
        getFullItemName(enteredName),
    );
    const syntaxError =
        validateNameIsNotEmpty(enteredName, extname(originalPath)) ??
        validateNameHasNoPathSeparator(enteredName);

    // The name of an existing item can always be kept, even if a sibling only differs in the prefix.
    if (syntaxError || normalizePath(newPath) == normalizePath(originalPath)) {
        return syntaxError;
    }

    return (
        (await validateNewItemNameIsUnique(newPath, originalPath)) ??
        validateNameIsNotUsedBySibling(enteredName, siblingNamesWithoutPrefix)
    );
}
