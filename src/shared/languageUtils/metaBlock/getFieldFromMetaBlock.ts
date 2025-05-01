import {
    castBlockToDictionaryBlock,
    getFieldFromDictionaryBlock,
    MetaBlockKey,
    RequestFileBlock,
} from "../..";

export function getFieldFromMetaBlock(
    metaBlock: RequestFileBlock,
    key: MetaBlockKey
) {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);

    if (!castedMetaBlock) {
        return undefined;
    }

    return getFieldFromDictionaryBlock(castedMetaBlock, key);
}
