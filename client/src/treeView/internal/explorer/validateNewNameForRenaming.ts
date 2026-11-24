import { resolve, dirname } from "path";
import { validateNewItemNameIsUnique } from "./validateNewItemNameIsUnique";

/**
 * Validates the name that the user entered for renaming a file or folder.
 *
 * @param getFullItemName Adds the sequence prefix to the entered name, if the names of the item start with its sequence.
 */
export async function validateNewNameForRenaming(
    enteredName: string,
    originalPath: string,
    getFullItemName: (enteredName: string) => string,
) {
    // Otherwise, only the sequence prefix would remain as the name if names are prefixed with sequences.
    if (enteredName.trim() == "") {
        return "The name must not be empty";
    }

    return await validateNewItemNameIsUnique(
        resolve(dirname(originalPath), getFullItemName(enteredName)),
        originalPath,
    );
}
