import {
    isBlockDictionaryBlock,
    getFieldFromDictionaryBlock,
    MetaBlockKey,
    Block,
} from "../../..";

export function getFieldFromMetaBlock(metaBlock: Block, key: MetaBlockKey) {
    return isBlockDictionaryBlock(metaBlock)
        ? getFieldFromDictionaryBlock(metaBlock, key)
        : undefined;
}
