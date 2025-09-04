import {
    MetaBlockKey,
    TextDocumentHelper,
    RequestFileBlockName,
    parseBlockFromFile,
    isDictionaryBlockField,
} from "../../..";

export function getSequenceFieldFromMetaBlock(
    documentHelper: TextDocumentHelper,
) {
    const metaBlockContent = parseBlockFromFile(
        documentHelper,
        RequestFileBlockName.Meta,
    );

    const sequence =
        metaBlockContent &&
        Array.isArray(metaBlockContent) &&
        metaBlockContent.length > 0 &&
        metaBlockContent.every((content) => isDictionaryBlockField(content))
            ? metaBlockContent.find(({ key }) => key == MetaBlockKey.Sequence)
            : undefined;

    return sequence;
}
