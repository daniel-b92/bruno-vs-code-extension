import {
    Block,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
    MetaBlockKey,
    RequestFileBlockName,
} from "../../../..";

export function getRequestTypeField(blocks: Block[]) {
    return getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
        blocks,
        RequestFileBlockName.Meta,
        MetaBlockKey.Type,
    );
}
