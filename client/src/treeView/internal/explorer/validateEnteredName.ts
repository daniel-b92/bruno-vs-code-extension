/** Without a name, only the extension (and the sequence prefix, if names are prefixed with sequences) would remain. */
export function validateNameIsNotEmpty(enteredName: string, extension = "") {
    return ["", extension].includes(enteredName.trim())
        ? "The name must not be empty"
        : undefined;
}

/** See `getSiblingNamesWithoutSequencePrefix`. */
export function validateNameIsNotUsedBySibling(
    name: string,
    siblingNamesWithoutPrefix: string[],
) {
    return siblingNamesWithoutPrefix.includes(name)
        ? getMessageForNameUsedBySibling(name)
        : undefined;
}

export function getMessageForNameUsedBySibling(name: string) {
    return `An item with the name '${name}' already exists (apart from the sequence prefix)`;
}
