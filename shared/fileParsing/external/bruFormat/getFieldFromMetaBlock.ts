import {
    MetaBlockKey,
    TextDocumentHelper,
    RequestFileBlockName,
    parseBlockFromFile,
    isDictionaryBlockField,
} from "../../..";

/** Returns the (not disabled) field with the given key from the meta block, if there is one. */
export function getFieldFromMetaBlock(
    documentHelper: TextDocumentHelper,
    key: MetaBlockKey,
) {
    const content = parseBlockFromFile(
        documentHelper,
        RequestFileBlockName.Meta,
    )?.content;

    return content &&
        Array.isArray(content) &&
        content.length > 0 &&
        content.every((field) => isDictionaryBlockField(field))
        ? content.find((field) => field.key == key && !field.disabled)
        : undefined;
}
