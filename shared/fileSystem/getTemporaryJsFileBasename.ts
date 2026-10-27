/**
 * Older versions of the extension created files with this name in the collections for providing the Javascript intellisense.
 * They can still exist and must not be treated as part of a collection.
 */
export function getTemporaryJsFileBasenameWithoutExtension() {
    return "__temp_bru_reference";
}

export function getTemporaryJsFileBasename() {
    return `${getTemporaryJsFileBasenameWithoutExtension()}.js`;
}
