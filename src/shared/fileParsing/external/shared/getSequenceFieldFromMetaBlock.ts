import {
    MetaBlockKey,
    TextDocumentHelper,
    RequestFileBlockName,
    parseBlockFromFile,
} from "../../..";
import { isDictionaryBlockField } from "../../internal/util/isDictionaryBlockField";

export function getSequenceFieldFromMetaBlock(
    documentHelper: TextDocumentHelper
) {
    const metaBlockContent = parseBlockFromFile(
        documentHelper,
        RequestFileBlockName.Meta
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
