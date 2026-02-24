import {
    isBlockDictionaryBlock,
    getActiveFieldFromDictionaryBlock,
    MetaBlockKey,
    Block,
} from "../../..";

export function getActiveFieldFromMetaBlock(
    metaBlock: Block,
    key: MetaBlockKey,
) {
    return isBlockDictionaryBlock(metaBlock)
        ? getActiveFieldFromDictionaryBlock(metaBlock, key)
        : undefined;
}
