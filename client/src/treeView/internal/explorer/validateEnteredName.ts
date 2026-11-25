import { findNameUsedBySibling } from "./sequencePrefixUtils/findNameUsedBySibling";

/** Without a name, only the extension (and the sequence prefix, if names are prefixed with sequences) would remain. */
export function validateNameIsNotEmpty(enteredName: string, extension = "") {
    return ["", extension].includes(enteredName.trim())
        ? "The name must not be empty"
        : undefined;
}

/** See `findNameUsedBySibling`. */
export function validateNameIsNotUsedBySibling(
    name: string,
    siblingNamesWithoutPrefix: string[],
) {
    const usedName = findNameUsedBySibling(name, siblingNamesWithoutPrefix);

    return usedName === undefined
        ? undefined
        : getMessageForNameUsedBySibling(usedName);
}

export function getMessageForNameUsedBySibling(name: string) {
    return `An item with the name '${name}' already exists (apart from the sequence prefix)`;
}
