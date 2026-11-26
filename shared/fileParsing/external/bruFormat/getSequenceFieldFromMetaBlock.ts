import {
    getFieldFromMetaBlock,
    MetaBlockKey,
    TextDocumentHelper,
} from "../../..";

export function getSequenceFieldFromMetaBlock(
    documentHelper: TextDocumentHelper,
) {
    return getFieldFromMetaBlock(documentHelper, MetaBlockKey.Sequence);
}
