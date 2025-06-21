import {
    castBlockToDictionaryBlock,
    getFieldFromDictionaryBlock,
    MetaBlockKey,
    Block,
} from "../../..";

export function getFieldFromMetaBlock(
    metaBlock: Block,
    key: MetaBlockKey
) {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);

    if (!castedMetaBlock) {
        return undefined;
    }

    return getFieldFromDictionaryBlock(castedMetaBlock, key);
}
